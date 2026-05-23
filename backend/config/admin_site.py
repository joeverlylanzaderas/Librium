# config/admin_site.py
from django.contrib import admin
from django.utils import timezone
from datetime import date

from library.models import Book, Loan, Fine, Reservation, BorrowRequest
from user.models import User


class LibriumAdminSite(admin.AdminSite):
    site_header = "Librium Library System"
    site_title  = "Librium"
    index_title = "Dashboard"

    def index(self, request, extra_context=None):
        extra_context = extra_context or {}
        today = timezone.now().date()

        # ── Stats ─────────────────────────────────────────────
        extra_context['stats'] = {
            'total_books':         Book.objects.count(),
            'available_books':     Book.objects.filter(available=True).count(),
            'borrowed_books':      Book.objects.filter(available=False).count(),
            'total_members':       User.objects.filter(role='member').count(),
            'active_loans':        Loan.objects.filter(return_status='none').count(),
            'overdue_loans':       Loan.objects.filter(
                                       return_status='none',
                                       due_date__lt=today
                                   ).count(),
            'pending_returns':     Loan.objects.filter(return_status='pending').count(),
            'pending_requests':    BorrowRequest.objects.filter(status='pending').count(),
            'active_reservations': Reservation.objects.filter(
                                       status__in=['waiting', 'ready']
                                   ).count(),
            'unpaid_fines':        Fine.objects.filter(paid=False).count(),
            'unpaid_fines_total':  sum(
                                       Fine.objects.filter(paid=False)
                                       .values_list('amount', flat=True)
                                   ) or 0,
        }

        # ── Overdue loans ─────────────────────────────────────
        extra_context['overdue_loans'] = (
            Loan.objects
            .filter(return_status='none', due_date__lt=today)
            .select_related('member', 'book')
            .order_by('due_date')[:10]
        )

        # ── Recent activity ───────────────────────────────────
        recent_loans = (
            Loan.objects
            .select_related('member', 'book')
            .order_by('-loan_date')[:5]
        )
        recent_requests = (
            BorrowRequest.objects
            .select_related('member', 'book')
            .order_by('-request_date')[:5]
        )
        recent_fines = (
            Fine.objects
            .select_related('member', 'loan__book')
            .order_by('-issued_date')[:5]
        )

        activity = []

        for loan in recent_loans:
            activity.append({
                'fa_icon': 'fas fa-book-reader',
                'color':   'activity-blue',
                'message': f'{loan.member.full_name or loan.member.email} borrowed <strong>{loan.book.title}</strong>',
                'time':    loan.loan_date,
            })

        for req in recent_requests:
            color = {
                'pending':   'activity-yellow',
                'approved':  'activity-green',
                'rejected':  'activity-red',
                'cancelled': 'activity-gray',
            }.get(req.status, 'activity-gray')
            activity.append({
                'fa_icon': 'fas fa-hand-holding-heart',
                'color':   color,
                'message': f'{req.member.full_name or req.member.email} requested <strong>{req.book.title}</strong> ({req.get_status_display()})',
                'time':    req.request_date,
            })

        for fine in recent_fines:
            activity.append({
                'fa_icon': 'fas fa-file-invoice-dollar',
                'color':   'activity-red',
                'message': f'Fine of <strong>₱{fine.amount}</strong> issued to {fine.member.full_name or fine.member.email}',
                'time':    fine.issued_date,
            })

        activity.sort(key=lambda x: x['time'], reverse=True)
        extra_context['activity'] = activity[:10]
        extra_context['today']    = today

        return super().index(request, extra_context)


librium_admin = LibriumAdminSite(name='admin')