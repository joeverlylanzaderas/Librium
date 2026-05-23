# library/views.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.utils import timezone
from itertools import chain
import operator

from .models import (
    Category, Author, Book, Department,
    BorrowRequest, Loan, Reservation, Fine, Semester,
    LOAN_PERIOD_DAYS, FINE_RATE_PER_DAY,
)
from .serializers import (
    CategorySerializer, AuthorSerializer, BookSerializer, DepartmentSerializer,
    BorrowRequestSerializer, BorrowRequestCreateSerializer, BorrowRequestActionSerializer,
    LoanSerializer, LoanCreateSerializer, LoanReturnRequestSerializer,
    LoanReturnVerifySerializer, ReservationSerializer, ReservationCreateSerializer,
    FineSerializer, SemesterSerializer,
)
from library.permissions import IsAdminOrLibrarian
from django.contrib.auth import get_user_model

User = get_user_model()


# ─────────────────────────────────────────────
#  CATEGORY
# ─────────────────────────────────────────────

class CategoryListCreateAPIView(generics.ListCreateAPIView):
    queryset         = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrLibrarian()]


class CategoryRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Category.objects.all()
    serializer_class = CategorySerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrLibrarian()]


# ─────────────────────────────────────────────
#  AUTHOR
# ─────────────────────────────────────────────

class AuthorListCreateAPIView(generics.ListCreateAPIView):
    queryset         = Author.objects.all()
    serializer_class = AuthorSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrLibrarian()]


class AuthorRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Author.objects.all()
    serializer_class = AuthorSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrLibrarian()]


# ─────────────────────────────────────────────
#  DEPARTMENT
# ─────────────────────────────────────────────

class DepartmentListCreateAPIView(generics.ListCreateAPIView):
    queryset         = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]


class DepartmentRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]


# ─────────────────────────────────────────────
#  BOOK
# ─────────────────────────────────────────────

class BookListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BookSerializer
    parser_classes   = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrLibrarian()]

    def get_queryset(self):
        queryset = Book.objects.select_related('author', 'category', 'department').all()

        author_id   = self.request.query_params.get('author')
        category_id = self.request.query_params.get('category')
        dept_id     = self.request.query_params.get('department')
        available   = self.request.query_params.get('available')
        search      = self.request.query_params.get('search')

        if author_id:
            queryset = queryset.filter(author_id=author_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if dept_id:
            queryset = queryset.filter(department_id=dept_id)
        if available is not None:
            queryset = queryset.filter(available=available.lower() == 'true')
        if search:
            queryset = queryset.filter(title__icontains=search)

        return queryset

    def get_serializer_context(self):
        return {'request': self.request}


class BookRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BookSerializer
    parser_classes   = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        return Book.objects.select_related('author', 'category', 'department').all()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminOrLibrarian()]

    def get_serializer_context(self):
        return {'request': self.request}

    def update(self, request, *args, **kwargs):
        partial  = kwargs.pop('partial', False)
        instance = self.get_object()

        if request.content_type and 'application/json' in request.content_type:
            data = request.data
        else:
            data = request.data.copy()
            if 'cover_image' in data and not request.FILES.get('cover_image'):
                del data['cover_image']

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


# ─────────────────────────────────────────────
#  SEMESTER
# ─────────────────────────────────────────────

class SemesterListCreateAPIView(generics.ListCreateAPIView):
    queryset         = Semester.objects.all()
    serializer_class = SemesterSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]


class SemesterRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Semester.objects.all()
    serializer_class = SemesterSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminUser()]


class SemesterSetActiveAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        semester = get_object_or_404(Semester, pk=pk)

        # deactivate all semesters
        Semester.objects.update(is_active=False)

        # activate selected semester
        semester.is_active = True
        semester.save()

        return Response(
            SemesterSerializer(semester).data,
            status=status.HTTP_200_OK
        )


# ─────────────────────────────────────────────
#  BORROW REQUEST
#
#  Online flow:
#    Member   → POST /borrow-requests/              create request
#    Member   → DELETE /borrow-requests/<pk>/       cancel (pending only)
#    Staff    → GET /borrow-requests/               see all pending/history
#    Staff    → POST /borrow-requests/<pk>/approve/ approve → loan auto-created
#    Staff    → POST /borrow-requests/<pk>/reject/  reject with optional note
#
#  Walk-in flow (bypasses borrow requests entirely):
#    Staff    → POST /loans/                        issue loan directly
# ─────────────────────────────────────────────

class BorrowRequestListCreateAPIView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return BorrowRequestCreateSerializer
        return BorrowRequestSerializer

    def get_queryset(self):
        user = self.request.user
        base = BorrowRequest.objects.select_related(
            'member', 'book', 'book__author', 'processed_by', 'loan'
        )
        if user.role == 'member':
            return base.filter(member=user)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            return base.filter(status=status_filter)
        return base.all()

    def create(self, request, *args, **kwargs):
        if request.user.role not in ['member']:
            raise PermissionDenied(
                'Staff issue loans directly via POST /loans/. '
                'Borrow requests are for members only.'
            )

        serializer = BorrowRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        borrow_request = serializer.save(member=request.user)

        return Response(
            BorrowRequestSerializer(borrow_request).data,
            status=status.HTTP_201_CREATED
        )


class BorrowRequestRetrieveDestroyAPIView(generics.RetrieveDestroyAPIView):
    serializer_class   = BorrowRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = BorrowRequest.objects.select_related(
            'member', 'book', 'processed_by', 'loan'
        )
        if user.role == 'member':
            return base.filter(member=user)
        return base.all()

    def destroy(self, request, *args, **kwargs):
        """Member cancels their own pending request."""
        borrow_request = self.get_object()

        if borrow_request.member != request.user and request.user.role not in ['admin', 'librarian']:
            raise PermissionDenied('You can only cancel your own borrow requests.')

        if borrow_request.status != 'pending':
            return Response(
                {'error': f'Cannot cancel a request with status "{borrow_request.status}".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        borrow_request.status = 'cancelled'
        borrow_request.save()

        return Response(
            {'message': 'Borrow request cancelled.'},
            status=status.HTTP_200_OK
        )


class BorrowRequestApproveAPIView(APIView):
    """
    POST /api/library/borrow-requests/<pk>/approve/
    Librarian/admin approves the request → Loan is created automatically.
    Book is marked unavailable.
    """
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def post(self, request, pk):
        borrow_request = get_object_or_404(
            BorrowRequest.objects.select_related('member', 'book'),
            pk=pk
        )

        if borrow_request.status != 'pending':
            return Response(
                {'error': f'Cannot approve a request with status "{borrow_request.status}".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not borrow_request.book.available:
            return Response(
                {'error': 'This book is no longer available.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = BorrowRequestActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        loan = Loan.objects.create(
            member=borrow_request.member,
            book=borrow_request.book,
        )

        today = timezone.now().date()
        borrow_request.status         = 'approved'
        borrow_request.processed_date = today
        borrow_request.processed_by   = request.user
        borrow_request.loan           = loan
        if serializer.validated_data.get('notes'):
            borrow_request.notes = serializer.validated_data['notes']
        borrow_request.save()

        return Response(
            BorrowRequestSerializer(borrow_request).data,
            status=status.HTTP_200_OK
        )


class BorrowRequestRejectAPIView(APIView):
    """
    POST /api/library/borrow-requests/<pk>/reject/
    Librarian/admin rejects the request. Book stays available.
    """
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def post(self, request, pk):
        borrow_request = get_object_or_404(BorrowRequest, pk=pk)

        if borrow_request.status != 'pending':
            return Response(
                {'error': f'Cannot reject a request with status "{borrow_request.status}".'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = BorrowRequestActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        today = timezone.now().date()
        borrow_request.status         = 'rejected'
        borrow_request.processed_date = today
        borrow_request.processed_by   = request.user
        if serializer.validated_data.get('notes'):
            borrow_request.notes = serializer.validated_data['notes']
        borrow_request.save()

        return Response(
            BorrowRequestSerializer(borrow_request).data,
            status=status.HTTP_200_OK
        )


# ─────────────────────────────────────────────
#  LOAN
# ─────────────────────────────────────────────

class LoanListCreateAPIView(generics.ListCreateAPIView):
    serializer_class   = LoanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = Loan.objects.select_related(
            'member', 'book', 'book__author', 'semester', 'verified_by'
        )
        if user.role == 'member':
            return base.filter(member=user)
        return base.all()

    def create(self, request, *args, **kwargs):
        # walk-in loans: staff only
        if request.user.role not in ['admin', 'librarian']:
            raise PermissionDenied(
                'Members must submit a borrow request. '
                'Only staff can issue walk-in loans directly.'
            )

        serializer = LoanCreateSerializer(data=request.data)
        if serializer.is_valid():
            loan = serializer.save()
            return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoanRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = LoanSerializer
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def get_queryset(self):
        return Loan.objects.select_related(
            'member', 'book', 'book__author', 'semester', 'verified_by'
        ).all()


# ─────────────────────────────────────────────
#  LOAN — RETURN REQUEST  (member-facing)
# ─────────────────────────────────────────────

class LoanReturnRequestAPIView(generics.GenericAPIView):
    serializer_class   = LoanReturnRequestSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        loan = get_object_or_404(Loan, id=serializer.validated_data['loan_id'])

        if loan.member != request.user and request.user.role not in ['admin', 'librarian']:
            raise PermissionDenied('You can only request a return for your own loans.')

        if loan.return_status == 'verified':
            return Response(
                {'error': 'This book has already been returned and verified.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if loan.return_status == 'pending':
            return Response(
                {'error': 'A return request is already pending for this loan.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        loan.return_requested_date = timezone.now().date()
        loan.return_status         = 'pending'
        loan.notes                 = serializer.validated_data.get('notes', '')
        loan.save()

        return Response(LoanSerializer(loan).data, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
#  LOAN — RETURN VERIFY  (librarian/admin-facing)
# ─────────────────────────────────────────────

class LoanReturnVerifyAPIView(generics.GenericAPIView):
    serializer_class   = LoanReturnVerifySerializer
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        loan          = get_object_or_404(Loan, id=serializer.validated_data['loan_id'])
        status_choice = serializer.validated_data['status']

        if status_choice == 'verified':
            today = timezone.now().date()
            loan.return_date          = today
            loan.return_verified_date = today
            loan.return_status        = 'verified'
            loan.verified_by          = request.user
            loan.save()

            if loan.is_overdue:
                Fine.objects.get_or_create(
                    loan=loan,
                    defaults={
                        'member':    loan.member,
                        'amount':    loan.overdue_days * FINE_RATE_PER_DAY,
                        'issued_by': request.user,
                        'paid':      False,
                    }
                )

            next_reservation = Reservation.objects.filter(
                book=loan.book, status='waiting'
            ).order_by('reserved_date').first()

            if next_reservation:
                next_reservation.status        = 'ready'
                next_reservation.notified_date = timezone.now().date()
                next_reservation.save()
                loan.book.available = False
                loan.book.save(update_fields=['available'])

        elif status_choice == 'rejected':
            loan.return_status         = 'rejected'
            loan.return_requested_date = None
            loan.save()

        elif status_choice == 'disputed':
            loan.return_status = 'disputed'
            loan.save()

        if serializer.validated_data.get('notes'):
            loan.notes = serializer.validated_data['notes']
            loan.save(update_fields=['notes'])

        return Response(LoanSerializer(loan).data, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
#  LOAN — FILTERED BY SEMESTER
# ─────────────────────────────────────────────

class LoanBySemesterAPIView(generics.ListAPIView):
    serializer_class   = LoanSerializer
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def get_queryset(self):
        queryset = Loan.objects.select_related(
            'member', 'book', 'book__author', 'semester', 'verified_by'
        ).all().order_by('-loan_date')

        semester_id = self.request.query_params.get('semester')
        if semester_id:
            queryset = queryset.filter(semester_id=semester_id)
        return queryset


# ─────────────────────────────────────────────
#  RESERVATION
# ─────────────────────────────────────────────

class ReservationListCreateAPIView(generics.ListCreateAPIView):
    serializer_class   = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = Reservation.objects.select_related('member', 'book', 'book__author')
        if user.role == 'member':
            return base.filter(member=user).exclude(
                status__in=['cancelled', 'fulfilled', 'expired']
            )
        return base.all()

    def create(self, request, *args, **kwargs):
        serializer = ReservationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        book = serializer.validated_data['book']

        if book.available:
            return Response(
                {'error': 'This book is available — submit a borrow request instead of reserving.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        already_active = Reservation.objects.filter(
            member=serializer.validated_data['member'],
            book=book,
            status__in=['waiting', 'ready']
        ).exists()

        if already_active:
            return Response(
                {'error': 'You already have an active reservation for this book.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        active_count   = Reservation.objects.filter(
            book=book, status__in=['waiting', 'ready']
        ).count()
        queue_position = active_count + 1

        reservation = Reservation.objects.create(
            member=serializer.validated_data['member'],
            book=book,
            queue_position=queue_position
        )

        return Response(
            ReservationSerializer(reservation).data,
            status=status.HTTP_201_CREATED
        )


class ReservationRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class   = ReservationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Reservation.objects.select_related('member', 'book').all()

    def destroy(self, request, *args, **kwargs):
        reservation = self.get_object()

        if reservation.member != request.user and request.user.role not in ['admin', 'librarian']:
            raise PermissionDenied('You can only cancel your own reservations.')

        if reservation.status not in ['waiting', 'ready']:
            return Response(
                {'error': 'This reservation cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reservation.status = 'cancelled'
        reservation.save()

        remaining = Reservation.objects.filter(
            book=reservation.book, status='waiting'
        ).order_by('reserved_date')

        for i, r in enumerate(remaining, start=1):
            if r.queue_position != i:
                r.queue_position = i
                r.save()

        return Response(
            {'message': 'Reservation cancelled successfully.'},
            status=status.HTTP_200_OK
        )


# ─────────────────────────────────────────────
#  FINE
# ─────────────────────────────────────────────

class FineRetrieveAPIView(generics.RetrieveAPIView):
    serializer_class   = FineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = Fine.objects.select_related('member', 'loan', 'loan__book', 'issued_by')
        if user.role == 'member':
            return base.filter(member=user)
        return base.all()


class FineListAPIView(generics.ListAPIView):
    serializer_class   = FineSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = Fine.objects.select_related('member', 'loan', 'loan__book', 'issued_by')
        if user.role == 'member':
            return base.filter(member=user, paid=False)
        return base.all()


class FinePayAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        fine = get_object_or_404(
            Fine.objects.select_related('member', 'loan'),
            id=pk
        )

        if fine.member != request.user and request.user.role not in ['admin', 'librarian']:
            raise PermissionDenied('You cannot pay this fine.')

        if fine.paid:
            return Response(
                {'error': 'This fine has already been paid.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        fine.paid      = True
        fine.paid_date = timezone.now().date()
        fine.save()

        return Response(
            {'message': 'Fine paid successfully.', 'amount': fine.amount},
            status=status.HTTP_200_OK
        )


# ─────────────────────────────────────────────
#  DASHBOARD STATS
# ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminOrLibrarian])
def dashboard_stats(request):
    today = timezone.now().date()
    overdue_statuses = ['none', 'pending', 'rejected', 'disputed']

    stats = {
        'total_books':     Book.objects.count(),
        'available_books': Book.objects.filter(available=True).count(),

        'total_authors':    Author.objects.count(),
        'total_categories': Category.objects.count(),

        # borrow requests
        'pending_borrow_requests': BorrowRequest.objects.filter(status='pending').count(),

        'active_loans':    Loan.objects.filter(
                               return_status='none',
                               return_verified_date__isnull=True
                           ).count(),
        'pending_returns': Loan.objects.filter(return_status='pending').count(),
        'overdue_loans':   Loan.objects.filter(
                               return_status__in=overdue_statuses,
                               due_date__lt=today
                           ).count(),

        'active_reservations': Reservation.objects.filter(status='waiting').count(),
        'ready_reservations':  Reservation.objects.filter(status='ready').count(),

        'unpaid_fines':       Fine.objects.filter(paid=False).count(),
        'unpaid_fines_total': sum(Fine.objects.filter(paid=False).values_list('amount', flat=True)),

        'total_users':      User.objects.count(),
        'total_admins':     User.objects.filter(role='admin').count(),
        'total_librarians': User.objects.filter(role='librarian').count(),
        'total_members':    User.objects.filter(role='member').count(),

        'active_semester': SemesterSerializer(
            Semester.objects.filter(is_active=True).first()
        ).data,
    }

    recent_loans = Loan.objects.select_related('member', 'book').order_by('-loan_date')[:5]
    recent_returns = Loan.objects.select_related('member', 'book').filter(
        return_verified_date__isnull=False
    ).order_by('-return_verified_date')[:5]
    recent_fines = Fine.objects.select_related('member', 'loan__book').order_by('-issued_date')[:5]
    recent_requests = BorrowRequest.objects.select_related('member', 'book').order_by('-request_date')[:5]

    def activity_entry(type, label, name, book, date):
        return {'type': type, 'label': label, 'member': name, 'book': book, 'date': str(date) if date else None}

    activities = sorted(
        list(chain(
            [activity_entry('loan',    'Book issued',     l.member.full_name, l.book.title, l.loan_date)           for l in recent_loans],
            [activity_entry('return',  'Book returned',   l.member.full_name, l.book.title, l.return_verified_date) for l in recent_returns],
            [activity_entry('fine',    'Fine issued',     f.member.full_name, f.loan.book.title, f.issued_date)     for f in recent_fines],
            [activity_entry('request', 'Borrow request',  r.member.full_name, r.book.title, r.request_date)         for r in recent_requests],
        )),
        key=lambda x: x['date'] or '',
        reverse=True
    )[:8]

    stats['recent_activity'] = activities
    
    return Response(stats)