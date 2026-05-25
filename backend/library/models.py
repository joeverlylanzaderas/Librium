# library/models.py
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from datetime import date, timedelta


# ─────────────────────────────────────────────
#  AUTHOR
# ─────────────────────────────────────────────

class Author(models.Model):
    name        = models.CharField(max_length=100)
    biography   = models.TextField(blank=True, null=True)
    nationality = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
#  CATEGORY
# ─────────────────────────────────────────────

class Category(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
#  DEPARTMENT
# ─────────────────────────────────────────────

class Department(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
#  SEMESTER
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
#  BOOK
# ─────────────────────────────────────────────

class Book(models.Model):
    title            = models.CharField(max_length=200)
    isbn             = models.CharField(max_length=20, unique=True)
    author      = models.ForeignKey(Author,     on_delete=models.CASCADE)
    category    = models.ForeignKey(Category,   on_delete=models.SET_NULL, null=True, blank=True)
    department  = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    available   = models.BooleanField(default=True)
    cover_image = models.URLField(max_length=500, null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    publication_year = models.IntegerField(
        validators=[
            MinValueValidator(1000),
            MaxValueValidator(date.today().year),
        ]
    )

    def __str__(self):
        return self.title
    

# ─────────────────────────────────────────────
# BOOKMARK
# ─────────────────────────────────────────────
class Bookmark(models.Model):
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookmarks'
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='bookmarks'
    )
    bookmarked_date = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ['-bookmarked_date']
        constraints = [
            models.UniqueConstraint(
                fields=['member', 'book'],
                name='unique_bookmark_per_member_book'
            )
        ]

    def __str__(self):
        return f"{self.member} bookmarked {self.book.title}"



# ─────────────────────────────────────────────
#  BORROW REQUEST
#  Created by a member when they want to borrow a book.
#  A librarian/admin approves it, which creates a Loan automatically.
#  Walk-in loans issued directly by staff bypass this entirely.
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
    book        = models.ForeignKey(
        Book,
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
    book                  = models.ForeignKey(Book, on_delete=models.CASCADE, related_name='loans')
    loan_date             = models.DateField(default=date.today)
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

    @property
    def is_overdue(self):
        if self.return_status == 'verified':
            return False
        return bool(self.due_date and date.today() > self.due_date)

    @property
    def overdue_days(self):
        if not self.is_overdue:
            return 0
        return (date.today() - self.due_date).days

    def _sync_book_availability(self, is_new: bool) -> None:
        if not self.book_id:
            return
        # FIX: only run if the loan row is actually persisted in the DB
        if not self.pk:
            return
        book = Book.objects.get(pk=self.book_id)
        if is_new:
            book.available = False
        else:
            book.available = bool(self.return_verified_date)
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
        is_new = not self.pk

        if is_new:
            if isinstance(self.loan_date, str):
                from datetime import datetime
                self.loan_date = datetime.strptime(self.loan_date, '%Y-%m-%d').date()
            self.due_date = self.loan_date + timedelta(days=LOAN_PERIOD_DAYS)
            self._auto_assign_semester()

        # FIX: super().save() FIRST so self.pk exists before _sync_book_availability runs.
        # Previously the book could be marked unavailable even if the loan save failed.
        super().save(*args, **kwargs)
        self._sync_book_availability(is_new)

    def delete(self, *args, **kwargs):
        if self.book_id and self.return_status != 'verified':
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
        Book,
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
    loan      = models.OneToOneField(
        Loan,
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

    def __str__(self):
        return f"{self.member} — ₱{self.amount} ({'Paid' if self.paid else 'Unpaid'})"
    
# CHATBOT
class KnowledgeBase(models.Model):
    title = models.CharField(max_length=255)
    text_content = models.TextField(blank=True, null=True)
    pdf_file = models.FileField(upload_to='pdfs/', null=True, blank=True)
    website_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class ChatMessage(models.Model):
    ROLE_CHOICES = (
        ('user', 'User'),
        ('assistant', 'Assistant'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    session_id = models.CharField(max_length=100, null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='chat_messages'
    )

    def __str__(self):
        return f"{self.role}: {self.message[:50]}"