from django.db import models, transaction
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

# ─────────────────────────────────────────────
#  SEMESTER MODEL
# ─────────────────────────────────────────────
class Semester(models.Model):
    SEMESTER_CHOICES = [
        ('1st_sem', '1st Semester'),
        ('2nd_sem', '2nd Semester'),
        ('summer',  'Summer'),
    ]

    academic_year = models.CharField(max_length=20)
    semester_type = models.CharField(max_length=20, choices=SEMESTER_CHOICES)
    start_date    = models.DateField()
    end_date      = models.DateField()
    is_active     = models.BooleanField(default=False)

    class Meta:
        unique_together = ('academic_year', 'semester_type')
        ordering        = ['-academic_year', 'semester_type']

    def save(self, *args, **kwargs):
        if self.is_active:
            Semester.objects.exclude(pk=self.pk).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_semester_type_display()} — {self.academic_year}"


# ─────────────────────────────────────────────
#  BORROW REQUEST MODEL
# ─────────────────────────────────────────────
class BorrowRequest(models.Model):
    STATUS_CHOICES = [
        ('pending',   'Pending'),
        ('approved',  'Approved'),
        ('rejected',  'Rejected'),
        ('cancelled', 'Cancelled'),
    ]

    member      = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='borrow_requests'
    )
    book = models.ForeignKey(
        'library.Book',
        on_delete=models.CASCADE,
        related_name='borrow_requests'
    )
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    request_date    = models.DateField(auto_now_add=True)
    processed_date  = models.DateField(null=True, blank=True)
    processed_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='processed_borrow_requests'
    )
    loan            = models.OneToOneField(        # set when approved → loan created
        'Loan',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='borrow_request'
    )
    notes           = models.TextField(blank=True, null=True)  # rejection reason or member note

    class Meta:
        ordering = ['-request_date']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['member', 'status']),
            models.Index(fields=['book', 'status']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['member', 'book'],
                condition=models.Q(status__in=['pending']),
                name='unique_active_borrow_request_per_member_book'
            )
        ]

    def __str__(self):
        return f"{self.member} → {self.book.title} [{self.get_status_display()}]"


# ─────────────────────────────────────────────
#  LOAN
# ─────────────────────────────────────────────
LOAN_PERIOD_DAYS  = 14
FINE_RATE_PER_DAY = 10

class Loan(models.Model):
    RETURN_STATUS_CHOICES = [
        ('none',     'No Request'),
        ('pending',  'Pending Return'),
        ('verified', 'Returned & Verified'),
        ('rejected', 'Return Rejected'),
        ('disputed', 'Disputed'),
    ]

    member   = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='loans'
    )
    semester = models.ForeignKey(
        Semester,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='loans'
    )
    book = models.ForeignKey('library.Book', on_delete=models.CASCADE, related_name='loans')
    loan_date             = models.DateField(default=timezone.localdate)
    due_date              = models.DateField(null=True, blank=True)
    return_date           = models.DateField(null=True, blank=True)
    return_requested_date = models.DateField(null=True, blank=True)
    return_verified_date  = models.DateField(null=True, blank=True)
    return_status         = models.CharField(
        max_length=20,
        choices=RETURN_STATUS_CHOICES,
        default='none'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='verified_returns'
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-loan_date']
        # FIX: Add indexes for commonly filtered/sorted fields
        indexes = [
            models.Index(fields=['due_date']),
            models.Index(fields=['return_status']),
            models.Index(fields=['member', 'return_status']),
            models.Index(fields=['-loan_date']),
        ]

    @property
    def is_overdue(self):
        if self.return_status == 'verified':
            return False
        return bool(self.due_date and timezone.localdate() > self.due_date)

    @property
    def overdue_days(self):
        if not self.is_overdue:
            return 0
        return (timezone.localdate() - self.due_date).days

    def _sync_book_availability(self, is_new: bool) -> None:
        if not self.book_id:
            return
        # FIX: only run if the loan row is actually persisted in the DB
        if not self.pk:
            return
        from library.models import Book

        book = Book.objects.get(pk=self.book_id)
        if is_new:
            book.available = False
        else:
            book.available = bool(self.return_verified_date)
            # If book is inactive but being returned, keep it inactive but available=False
            if not book.is_active:
                book.available = False
        book.save(update_fields=['available'])

    def _auto_assign_semester(self) -> None:
        if self.semester_id:
            return
        matched = Semester.objects.filter(
            start_date__lte=self.loan_date,
            end_date__gte=self.loan_date
        ).first()
        if matched:
            self.semester = matched

    def save(self, *args, **kwargs):
        from django.db import transaction
        is_new = not self.pk

        if is_new:
            if isinstance(self.loan_date, str):
                from datetime import datetime
                self.loan_date = datetime.strptime(self.loan_date, '%Y-%m-%d').date()
            self.due_date = self.loan_date + timedelta(days=LOAN_PERIOD_DAYS)
            self._auto_assign_semester()

        # FIX: Wrap in atomic transaction to prevent race condition
        # Book availability sync MUST succeed with loan creation or both rollback
        with transaction.atomic():
            super().save(*args, **kwargs)
            self._sync_book_availability(is_new)

    def delete(self, *args, **kwargs):
        if self.book_id and self.return_status != 'verified':
            from library.models import Book
            Book.objects.filter(pk=self.book_id).update(available=True)
        super().delete(*args, **kwargs)

    def __str__(self):
        return f"{self.member} borrowed {self.book.title} — {self.get_return_status_display()}"
    
    
# ─────────────────────────────────────────────
#  RESERVATION
# ─────────────────────────────────────────────

class Reservation(models.Model):
    STATUS_CHOICES = [
        ('waiting',   'Waiting'),
        ('ready',     'Ready to Borrow'),
        ('cancelled', 'Cancelled'),
        ('expired',   'Expired'),
        ('fulfilled', 'Fulfilled'),
    ]

    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reservations'
    )
    book = models.ForeignKey(
        'library.Book',
        on_delete=models.CASCADE,
        related_name='reservations'
    )
    reserved_date  = models.DateField(auto_now_add=True)
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='waiting')
    notified_date  = models.DateField(null=True, blank=True)
    queue_position = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['reserved_date']
        constraints = [
            models.UniqueConstraint(
                fields=['member', 'book'],
                condition=models.Q(status__in=['waiting', 'ready']),
                name='unique_active_reservation_per_member_book'
            )
        ]

    def __str__(self):
        return f"{self.member} reserved {self.book.title} — {self.get_status_display()}"



# ─────────────────────────────────────────────
#  FINE
# ─────────────────────────────────────────────

class Fine(models.Model):
    member    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='fines'
    )
    loan = models.OneToOneField(
        'Loan',
        on_delete=models.CASCADE,
        related_name='fine'
    )
    amount    = models.DecimalField(max_digits=10, decimal_places=2)
    paid      = models.BooleanField(default=False)
    paid_date = models.DateField(null=True, blank=True)
    issued_date = models.DateField(auto_now_add=True)
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='issued_fines'
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        # FIX: Add indexes for commonly filtered fields
        # FIX: Prevent duplicate fines per loan
        indexes = [
            models.Index(fields=['paid']),
            models.Index(fields=['member', 'paid']),
            models.Index(fields=['-issued_date']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['loan'],
                name='unique_fine_per_loan'
            )
        ]

    def __str__(self):
        return f"{self.member} — ₱{self.amount} ({'Paid' if self.paid else 'Unpaid'})"
    
