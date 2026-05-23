from django.shortcuts import render
from django.utils import timezone
from datetime import date

from library.models import Book, Loan, Fine, Reservation, BorrowRequest
from user.models import User


def admin_dashboard_view(request):
    today = timezone.now().date()

    # ── Stats cards ───────────────────────────────────────────
    # Book: uses `available` (BooleanField), no `status` field
    # Loan: uses `return_status`, not `status`
    # Reservation: uses `status` with choices: waiting/ready/cancelled/expired/fulfilled
    # Fine: uses `paid` (BooleanField), `issued_date` (not created_at)
    stats = {
        'total_books':        Book.objects.count(),
        'available_books':    Book.objects.filter(available=True).count(),
        'borrowed_books':     Book.objects.filter(available=False).count(),
        'total_members':      User.objects.filter(role='member').count(),

        # Loan has no status field — active = not yet verified return
        'active_loans':       Loan.objects.filter(return_status='none').count(),
        'overdue_loans':      Loan.objects.filter(
                                  return_status='none',
                                  due_date__lt=today
                              ).count(),
        'pending_returns':    Loan.objects.filter(return_status='pending').count(),

        'pending_requests':   BorrowRequest.objects.filter(status='pending').count(),

        # Reservation: active = waiting or ready
        'active_reservations': Reservation.objects.filter(
                                   status__in=['waiting', 'ready']
                               ).count(),

        'unpaid_fines':       Fine.objects.filter(paid=False).count(),
        'unpaid_fines_total': sum(
                                  Fine.objects.filter(paid=False)
                                  .values_list('amount', flat=True)
                              ) or 0,
    }

    # ── Overdue loans ─────────────────────────────────────────
    # Overdue = return not yet verified AND past due date
    overdue_loans = (
        Loan.objects
        .filter(return_status='none', due_date__lt=today)
        .select_related('member', 'book')
        .order_by('due_date')[:10]
    )

    # ── Recent activity feed ──────────────────────────────────
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

    # Fine uses `issued_date` (not created_at)
    recent_fines = (
        Fine.objects
        .select_related('member', 'loan__book')
        .order_by('-issued_date')[:5]
    )

    activity = []

    for loan in recent_loans:
        activity.append({
            'icon':    '📖',
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
            'icon':    '🙋',
            'color':   color,
            'message': f'{req.member.full_name or req.member.email} requested <strong>{req.book.title}</strong> ({req.get_status_display()})',
            'time':    req.request_date,
        })

    for fine in recent_fines:
        activity.append({
            'icon':    '💸',
            'color':   'activity-red',
            'message': f'Fine of <strong>₱{fine.amount}</strong> issued to {fine.member.full_name or fine.member.email}',
            'time':    fine.issued_date,
        })

    # Sort all activity by date descending
    activity.sort(key=lambda x: x['time'], reverse=True)
    activity = activity[:10]

    context = {
        'stats':         stats,
        'overdue_loans': overdue_loans,
        'activity':      activity,
        'today':         today,
        'title':         'Dashboard',
        'has_permission': True,
    }

    return render(request, 'admin/dashboard.html', context)