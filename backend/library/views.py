# library/views.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Prefetch

from circulation.models import Loan
from .models import Bookmark, Category, Author, Book, Department
from .serializers import BookmarkSerializer, CategorySerializer, AuthorSerializer, BookSerializer, DepartmentSerializer
from library.permissions import IsAdminOrLibrarian


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


# ────────────────────────────────────────────
# BOOKMARK
# ────────────────────────────────────────────
class BookmarkListCreateAPIView(generics.ListCreateAPIView):
    """
    GET: List all bookmarks for the logged-in member.
    POST: Create a new bookmark linked to the logged-in member.
    """
    serializer_class = BookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Strict user isolation: Only show the logged-in user's bookmarks
        # select_related('book') optimizes the SQL query to fetch book details efficiently
        return Bookmark.objects.filter(member=self.request.user).select_related('book')


class BookmarkDestroyAPIView(generics.DestroyAPIView):
    """
    DELETE: Remove a bookmark by its ID.
    """
    serializer_class = BookmarkSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Ensures a user can only delete their own bookmarks
        return Bookmark.objects.filter(member=self.request.user)


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
        from django.db.models import Prefetch, Q
        
        # FIX #16: Filter active books by default, allow admins to see inactive
        include_inactive = self.request.query_params.get('include_inactive', 'false').lower() == 'true'
        
        queryset = Book.objects.select_related('author', 'category', 'department')
        
        # Only show active books unless explicitly requested otherwise
        if not include_inactive or not self.request.user.is_staff:
            queryset = queryset.filter(is_active=True)

        if self.request.user.is_authenticated:
            queryset = queryset.prefetch_related(
                Prefetch(
                    'bookmarks',
                    Bookmark.objects.filter(member=self.request.user)
                )
            )
        else:
            queryset = queryset.prefetch_related(
                Prefetch('bookmarks', Bookmark.objects.none())
            )

        author_id   = self.request.query_params.get('author')
        category_id = self.request.query_params.get('category')
        dept_id     = self.request.query_params.get('department')
        available   = self.request.query_params.get('available')
        search      = self.request.query_params.get('search')
        is_active   = self.request.query_params.get('is_active')  # Allow explicit filter

        if author_id:
            queryset = queryset.filter(author_id=author_id)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        if dept_id:
            queryset = queryset.filter(department_id=dept_id)
        if available is not None:
            queryset = queryset.filter(available=available.lower() == 'true')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        if search:
            queryset = queryset.filter(title__icontains=search)

        return queryset

    def get_serializer_context(self):
        return {'request': self.request}


class BookRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BookSerializer
    parser_classes   = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        from django.db.models import Prefetch

        # FIX #16: Allow retrieval of inactive books by ID, but only for staff
        if self.request.method == 'GET' and not self.request.user.is_staff:
            queryset = Book.objects.filter(is_active=True).select_related('author', 'category', 'department')
        else:
            queryset = Book.objects.all().select_related('author', 'category', 'department')

        if self.request.user.is_authenticated:
            queryset = queryset.prefetch_related(
                Prefetch(
                    'bookmarks',
                    Bookmark.objects.filter(member=self.request.user)
                )
            )
        else:
            queryset = queryset.prefetch_related(
                Prefetch('bookmarks', Bookmark.objects.none())
            )
        return queryset

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
                val = data.get('cover_image')
                if val in [None, '', 'null']:
                    del data['cover_image']

        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # FIX #9 & #16: Soft-delete with active loan check
    def destroy(self, request, *args, **kwargs):
        book = self.get_object()
        
        # Check for active loans
        active = Loan.objects.filter(
            book=book
        ).exclude(return_status='verified').exists()
        
        if active:
            return Response(
                {'error': 'Cannot delete a book with active loans.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Soft-delete: mark as inactive instead of hard delete
        book.is_active = False
        book.save(update_fields=['is_active'])
        
        # Optional: Also mark as unavailable
        if book.available:
            book.available = False
            book.save(update_fields=['available'])
        
        return Response(
            {'message': 'Book has been deactivated successfully.'},
            status=status.HTTP_200_OK
        )

class BookRestoreAPIView(APIView):
    """
    POST /api/library/books/<pk>/restore/
    Restore a soft-deleted book (admin/librarian only)
    """
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def post(self, request, pk):
        book = get_object_or_404(Book, pk=pk, is_active=False)
        
        # Check if restoration would cause conflicts
        if Book.objects.filter(isbn=book.isbn, is_active=True).exclude(pk=pk).exists():
            return Response(
                {'error': 'Cannot restore: Another active book with this ISBN already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        book.is_active = True
        book.save(update_fields=['is_active'])
        
        return Response(
            {'message': f'Book "{book.title}" has been restored successfully.'},
            status=status.HTTP_200_OK
        )

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

        serializer = BorrowRequestCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        borrow_request = serializer.save()

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

    # 🟡 FIX #11: Add audit trail for cancellation
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
        borrow_request.processed_date = timezone.now().date()  # ADDED: audit trail
        borrow_request.processed_by = request.user  # ADDED: records who cancelled
        borrow_request.save()

        return Response(
            {'message': 'Borrow request cancelled.'},
            status=status.HTTP_200_OK
        )


# 🟡 FIX #6: Add select_for_update() to prevent race condition
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

        # FIX: Move availability check inside atomic block with select_for_update
        serializer = BorrowRequestActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            # Re-fetch book with row lock INSIDE the transaction
            book = Book.objects.select_for_update().get(pk=borrow_request.book_id)
            if not book.available:
                return Response(
                    {'error': 'This book is no longer available.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            loan = Loan.objects.create(
                member=borrow_request.member,
                book=book,
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
            with transaction.atomic():
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


# 🔵 FIX #17: Member loan cancellation path before pickup
class LoanCancelBeforePickupAPIView(APIView):
    """
    POST /api/library/loans/<pk>/cancel-before-pickup/
    Allow member to cancel loan before picking up the book.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        loan = get_object_or_404(Loan, pk=pk, member=request.user)
        if loan.return_status != 'none':
            return Response({'error': 'Cannot cancel this loan.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Only allow cancellation within 24 hours of loan creation
        hours_since_loan = (timezone.now() - loan.loan_date).total_seconds() / 3600
        if hours_since_loan > 24:
            return Response({'error': 'Loan can only be cancelled within 24 hours of creation.'}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            loan.delete()  # Loan.delete() restores book.available=True
        return Response({'message': 'Loan cancelled successfully.'}, status=status.HTTP_200_OK)


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


# ──────────────────────────
#  LOAN — RETURN VERIFY 
# ──────────────────────────
# 🔴 FIX #1 & #3: Capture overdue BEFORE mutation & Wrap in atomic transaction
class LoanReturnVerifyAPIView(generics.GenericAPIView):
    serializer_class   = LoanReturnVerifySerializer
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        loan = get_object_or_404(Loan, id=serializer.validated_data['loan_id'])
        status_choice = serializer.validated_data['status']
        
        # FIX #1: Capture overdue state BEFORE mutating the loan
        was_overdue = loan.due_date and timezone.localdate() > loan.due_date
        overdue_days = (timezone.localdate() - loan.due_date).days if was_overdue else 0

        # FIX #3: Wrap everything in atomic transaction
        with transaction.atomic():
            if status_choice == 'verified':
                today = timezone.now().date()
                loan.return_status = 'verified'
                loan.return_date = today
                loan.return_verified_date = today
                loan.verified_by = request.user
                loan.save()

                # Update book availability INSIDE the transaction
                loan.book.available = True
                loan.book.save(update_fields=['available'])

                # Create fine if overdue (using pre-captured flag)
                if was_overdue:
                    Fine.objects.get_or_create(
                        loan=loan,
                        defaults={
                            'member': loan.member,
                            'amount': overdue_days * FINE_RATE_PER_DAY,
                            'issued_by': request.user,
                        }
                    )

                # Check for waiting reservations
                next_reservation = Reservation.objects.filter(
                    book=loan.book, status='waiting'
                ).order_by('reserved_date').first()

                if next_reservation:
                    next_reservation.status = 'ready'
                    next_reservation.notified_date = timezone.now().date()
                    next_reservation.save()

            elif status_choice == 'rejected':
                loan.return_status = 'rejected'
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

# 🔵 FIX #15: Add unpaid fine check for reservations
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
        # FIX #15: Check for unpaid fines before allowing reservation
        if Fine.objects.filter(member=request.user, paid=False).exists():
            return Response(
                {'error': 'You have unpaid fines. Please settle them to make reservations.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ReservationCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)

        book = serializer.validated_data['book']

        if book.available:
            return Response(
                {'error': 'This book is available — submit a borrow request instead of reserving.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        already_active = Reservation.objects.filter(
            member=request.user,
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
            member=request.user,
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


# 🔴 FIX #2 & 🟡 FIX #7: Remove redundant book availability update & Add re-ranking
class ReservationFulfillAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def post(self, request, pk):
        reservation = get_object_or_404(
            Reservation.objects.select_related('member', 'book'),
            pk=pk
        )

        if reservation.status != 'ready':
            return Response(
                {'error': f'Cannot fulfill reservation with status "{reservation.status}". Only "ready" reservations can be fulfilled.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not reservation.book.available:
            return Response(
                {'error': 'This book is no longer available.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Loan.save() → _sync_book_availability(is_new=True) handles book.available=False
            loan = Loan.objects.create(
                member=reservation.member,
                book=reservation.book,
            )
            reservation.status = 'fulfilled'
            reservation.save()
            
            # FIX #7: Re-rank remaining waiting reservations
            remaining = Reservation.objects.filter(
                book=reservation.book, status='waiting'
            ).order_by('reserved_date')

            for i, r in enumerate(remaining, start=1):
                if r.queue_position != i:
                    r.queue_position = i
                    r.save(update_fields=['queue_position'])

        return Response(
            {
                'message': 'Reservation fulfilled and loan created successfully.',
                'loan_id': loan.id,
                'reservation_id': reservation.id
            },
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


# 🟡 FIX #8: Restrict FinePayAPIView to staff only
class FinePayAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]  # CHANGED: Staff only

    def post(self, request, pk):
        fine = get_object_or_404(
            Fine.objects.select_related('member', 'loan'),
            id=pk
        )

        if fine.paid:
            return Response(
                {'error': 'This fine has already been paid.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        fine.paid      = True
        fine.paid_date = timezone.now().date()
        fine.issued_by = request.user  # Record who marked it paid
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
    
    # 🟡 FIX #5: Fix active loans count - all loans where book hasn't been verified as returned
    stats = {
        'total_books':     Book.objects.count(),
        'available_books': Book.objects.filter(available=True).count(),

        'total_authors':    Author.objects.count(),
        'total_categories': Category.objects.count(),

        # borrow requests
        'pending_borrow_requests': BorrowRequest.objects.filter(status='pending').count(),

        # FIX #5: Active loans = all loans where return_status is not 'verified'
        'active_loans':    Loan.objects.exclude(return_status='verified').count(),
        'pending_returns': Loan.objects.filter(return_status='pending').count(),
        'overdue_loans':   Loan.objects.exclude(
                               return_status='verified'
                           ).filter(due_date__lt=today).count(),

        'active_reservations': Reservation.objects.filter(status='waiting').count(),
        'ready_reservations':  Reservation.objects.filter(status='ready').count(),

        'unpaid_fines':       Fine.objects.filter(paid=False).count(),
        'unpaid_fines_total': Fine.objects.filter(paid=False).aggregate(total=Sum('amount'))['total'] or 0,

        'total_users':      User.objects.count(),
        'total_admins':     User.objects.filter(role='admin').count(),
        'total_librarians': User.objects.filter(role='librarian').count(),
        'total_members':    User.objects.filter(role='member').count(),

        'active_semester': SemesterSerializer(
            Semester.objects.filter(is_active=True).first()
        ).data,
    }

    # FIX: Optimize recent activity queries - fetch separate but don't chain in Python
    # This reduces N+1 by fetching only what we need without nested iteration
    recent_loans = Loan.objects.select_related('member', 'book').order_by('-loan_date')[:5]
    recent_returns = Loan.objects.select_related('member', 'book').filter(
        return_verified_date__isnull=False
    ).order_by('-return_verified_date')[:5]
    recent_fines = Fine.objects.select_related('member', 'loan__book').order_by('-issued_date')[:5]
    recent_requests = BorrowRequest.objects.select_related('member', 'book').order_by('-request_date')[:5]

    # FIX: Build activity list efficiently without unnecessary operations
    activities = []
    for loan in recent_loans:
        activities.append({
            'type': 'loan',
            'label': 'Book issued',
            'member': loan.member.full_name,
            'book': loan.book.title,
            'date': str(loan.loan_date)
        })
    for loan in recent_returns:
        activities.append({
            'type': 'return',
            'label': 'Book returned',
            'member': loan.member.full_name,
            'book': loan.book.title,
            'date': str(loan.return_verified_date)
        })
    for fine in recent_fines:
        activities.append({
            'type': 'fine',
            'label': 'Fine issued',
            'member': fine.member.full_name,
            'book': fine.loan.book.title,
            'date': str(fine.issued_date)
        })
    for request_obj in recent_requests:
        activities.append({
            'type': 'request',
            'label': 'Borrow request',
            'member': request_obj.member.full_name,
            'book': request_obj.book.title,
            'date': str(request_obj.request_date)
        })

    # FIX: Sort once at end instead of with itertools.chain
    activities.sort(key=lambda x: x['date'], reverse=True)
    stats['recent_activity'] = activities[:8]

    return Response(stats)


class KnowledgeBaseView(ListCreateAPIView):
    queryset = KnowledgeBase.objects.all()
    serializer_class = KnowledgeBaseSerializer
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]  # Admin only


# 🟡 FIX #10, #12, & 🟢 #19: Add conversation history, library settings, and optional guest support
class ChatbotAPIView(APIView):
    # 🟢 Option A (demo-safe): keep IsAuthenticated
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    def get_session_id(self, request):
        if request.user.is_authenticated:
            return f"user_{request.user.id}"
        # 🟢 Option B (per spec): uncomment below for guest support
        # session = request.session
        # if not session.session_key:
        #     session.create()
        # return f"guest_{session.session_key}"
        return None

    def post(self, request):
        user_message = request.data.get("message", "").strip()
        session_id = self.get_session_id(request)
        
        if not user_message:
            return Response(
                {"error": "Message is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save user message
        user_chat = ChatMessage.objects.create(
            role='user',
            message=user_message,
            session_id=session_id,
            user=request.user
        )

        # 🟡 FIX #10: Fetch conversation history for context
        history_qs = ChatMessage.objects.filter(
            session_id=session_id
        ).order_by('-created_at')[:10]
        
        history_messages = [
            {'role': msg.role, 'content': msg.message}
            for msg in reversed(list(history_qs))
        ]

        # Get knowledge base content
        knowledge_items = KnowledgeBase.objects.all()
        context = ""
        for item in knowledge_items:
            if item.text_content:
                context += f"- **{item.title}**: {item.text_content}\n\n"

        # 🟡 FIX #12: Enhance system prompt with library settings and user context
        user = request.user
        loans = Loan.objects.filter(member=user).exclude(return_status='verified').select_related('book')
        fines = Fine.objects.filter(member=user, paid=False)
        
        system_prompt = f"""You are Libi, the Librium University Library assistant.
Loan duration: {LOAN_PERIOD_DAYS} days. Fine rate: ₱{FINE_RATE_PER_DAY}/day.
Logged-in user: {user.full_name}
Active loans: {[f"{l.book.title} due {l.due_date}" for l in loans]}
Unpaid fines: ₱{sum(f.amount for f in fines)}
Answer helpfully and concisely. You cannot approve loans or waive fines.

Library Knowledge Base:
{context if context else "No specific policies found."}"""

        user_prompt = f"User Question: {user_message}\n\nAnswer directly and concisely:"

        GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
        
        if not GROQ_API_KEY:
            ai_response = "AI service is unavailable. Please try again later."
        else:
            try:
                # 🟡 FIX #10: Inject conversation history into Groq request
                response = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "llama-3.1-8b-instant",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            *history_messages,  # ← Inject conversation history
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.7,
                        "max_tokens": 500
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    ai_response = data['choices'][0]['message']['content']
                    ai_response = re.sub(r'<[^>]+>', '', ai_response)
                else:
                    ai_response = "Sorry, I couldn't process your question. Please try again."
                    
            except requests.Timeout:
                ai_response = "Request timed out. Please try again."
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Chatbot error: {str(e)}", exc_info=True)
                ai_response = "An error occurred. Please try again later."

        ai_chat = ChatMessage.objects.create(
            role='assistant',
            message=ai_response,
            session_id=session_id,
            user=request.user
        )

        return Response({
            "user": ChatMessageSerializer(user_chat).data,
            "assistant": ChatMessageSerializer(ai_chat).data
        }, status=status.HTTP_201_CREATED)

    def get(self, request):
        session_id = self.get_session_id(request)
        messages = ChatMessage.objects.filter(
            session_id=session_id
        ).order_by('-created_at')[:50]
        
        serializer = ChatMessageSerializer(messages, many=True)
        return Response(serializer.data)