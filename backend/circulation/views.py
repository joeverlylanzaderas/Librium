from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import BorrowRequest, Loan, Reservation, Fine, Semester, LOAN_PERIOD_DAYS, FINE_RATE_PER_DAY
from .serializers import (
	SemesterSerializer,
	BorrowRequestSerializer,
	BorrowRequestCreateSerializer,
	BorrowRequestActionSerializer,
	LoanSerializer,
	LoanCreateSerializer,
	LoanReturnRequestSerializer,
	LoanReturnVerifySerializer,
	ReservationSerializer,
	ReservationCreateSerializer,
	FineSerializer,
)
from library.models import Author, Book, Category
from library.permissions import IsAdminOrLibrarian

User = get_user_model()


class SemesterListCreateAPIView(generics.ListCreateAPIView):
	queryset = Semester.objects.all()
	serializer_class = SemesterSerializer

	def get_permissions(self):
		if self.request.method == 'GET':
			return [IsAuthenticated()]
		return [IsAuthenticated(), IsAdminUser()]


class SemesterRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
	queryset = Semester.objects.all()
	serializer_class = SemesterSerializer

	def get_permissions(self):
		if self.request.method == 'GET':
			return [IsAuthenticated()]
		return [IsAuthenticated(), IsAdminUser()]


class SemesterSetActiveAPIView(APIView):
	permission_classes = [IsAuthenticated, IsAdminUser]

	def patch(self, request, pk):
		semester = get_object_or_404(Semester, pk=pk)
		Semester.objects.update(is_active=False)
		semester.is_active = True
		semester.save()
		return Response(SemesterSerializer(semester).data, status=status.HTTP_200_OK)


class BorrowRequestListCreateAPIView(generics.ListCreateAPIView):
	permission_classes = [IsAuthenticated]

	def get_serializer_class(self):
		if self.request.method == 'POST':
			return BorrowRequestCreateSerializer
		return BorrowRequestSerializer

	def get_queryset(self):
		user = self.request.user
		base = BorrowRequest.objects.select_related('member', 'book', 'book__author', 'processed_by', 'loan')
		if user.role == 'member':
			return base.filter(member=user)
		status_filter = self.request.query_params.get('status')
		if status_filter:
			return base.filter(status=status_filter)
		return base.all()

	def create(self, request, *args, **kwargs):
		if request.user.role != 'member':
			raise PermissionDenied('Staff issue loans directly via POST /loans/. Borrow requests are for members only.')
		serializer = self.get_serializer(data=request.data, context={'request': request})
		serializer.is_valid(raise_exception=True)
		borrow_request = serializer.save()
		return Response(BorrowRequestSerializer(borrow_request).data, status=status.HTTP_201_CREATED)


class BorrowRequestRetrieveDestroyAPIView(generics.RetrieveDestroyAPIView):
	serializer_class = BorrowRequestSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		user = self.request.user
		base = BorrowRequest.objects.select_related('member', 'book', 'processed_by', 'loan')
		if user.role == 'member':
			return base.filter(member=user)
		return base.all()

	def destroy(self, request, *args, **kwargs):
		borrow_request = self.get_object()
		if borrow_request.member != request.user and request.user.role not in ['admin', 'librarian']:
			raise PermissionDenied('You can only cancel your own borrow requests.')
		if borrow_request.status != 'pending':
			return Response({'error': f'Cannot cancel a request with status "{borrow_request.status}".'}, status=status.HTTP_400_BAD_REQUEST)
		borrow_request.status = 'cancelled'
		borrow_request.processed_date = timezone.now().date()
		borrow_request.processed_by = request.user
		borrow_request.save()
		return Response({'message': 'Borrow request cancelled.'}, status=status.HTTP_200_OK)


class BorrowRequestApproveAPIView(APIView):
	permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

	def post(self, request, pk):
		borrow_request = get_object_or_404(BorrowRequest.objects.select_related('member', 'book'), pk=pk)
		if borrow_request.status != 'pending':
			return Response({'error': f'Cannot approve a request with status "{borrow_request.status}".'}, status=status.HTTP_400_BAD_REQUEST)
		serializer = BorrowRequestActionSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		with transaction.atomic():
			book = Book.objects.select_for_update().get(pk=borrow_request.book_id)
			if not book.available:
				return Response({'error': 'This book is no longer available.'}, status=status.HTTP_400_BAD_REQUEST)
			loan = Loan.objects.create(member=borrow_request.member, book=book)
			today = timezone.now().date()
			borrow_request.status = 'approved'
			borrow_request.processed_date = today
			borrow_request.processed_by = request.user
			borrow_request.loan = loan
			if serializer.validated_data.get('notes'):
				borrow_request.notes = serializer.validated_data['notes']
			borrow_request.save()
		return Response(BorrowRequestSerializer(borrow_request).data, status=status.HTTP_200_OK)


class BorrowRequestRejectAPIView(APIView):
	permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

	def post(self, request, pk):
		borrow_request = get_object_or_404(BorrowRequest, pk=pk)
		if borrow_request.status != 'pending':
			return Response({'error': f'Cannot reject a request with status "{borrow_request.status}".'}, status=status.HTTP_400_BAD_REQUEST)
		serializer = BorrowRequestActionSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		today = timezone.now().date()
		borrow_request.status = 'rejected'
		borrow_request.processed_date = today
		borrow_request.processed_by = request.user
		if serializer.validated_data.get('notes'):
			borrow_request.notes = serializer.validated_data['notes']
		borrow_request.save()
		return Response(BorrowRequestSerializer(borrow_request).data, status=status.HTTP_200_OK)


class LoanListCreateAPIView(generics.ListCreateAPIView):
	serializer_class = LoanSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		user = self.request.user
		base = Loan.objects.select_related('member', 'book', 'book__author', 'semester', 'verified_by')
		if user.role == 'member':
			return base.filter(member=user)
		return base.all()

	def create(self, request, *args, **kwargs):
		if request.user.role not in ['admin', 'librarian']:
			raise PermissionDenied('Members must submit a borrow request. Only staff can issue walk-in loans directly.')
		serializer = LoanCreateSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		with transaction.atomic():
			loan = serializer.save()
		return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)


class LoanRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
	serializer_class = LoanSerializer
	permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

	def get_queryset(self):
		return Loan.objects.select_related('member', 'book', 'book__author', 'semester', 'verified_by').all()


class LoanReturnRequestAPIView(generics.GenericAPIView):
	serializer_class = LoanReturnRequestSerializer
	permission_classes = [IsAuthenticated]

	def post(self, request, *args, **kwargs):
		serializer = self.get_serializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		loan = get_object_or_404(Loan, id=serializer.validated_data['loan_id'])
		if loan.member != request.user and request.user.role not in ['admin', 'librarian']:
			raise PermissionDenied('You can only request a return for your own loans.')
		if loan.return_status == 'verified':
			return Response({'error': 'This book has already been returned and verified.'}, status=status.HTTP_400_BAD_REQUEST)
		if loan.return_status == 'pending':
			return Response({'error': 'A return request is already pending for this loan.'}, status=status.HTTP_400_BAD_REQUEST)
		loan.return_requested_date = timezone.now().date()
		loan.return_status = 'pending'
		loan.notes = serializer.validated_data.get('notes', '')
		loan.save()
		return Response(LoanSerializer(loan).data, status=status.HTTP_200_OK)


class LoanReturnVerifyAPIView(generics.GenericAPIView):
	serializer_class = LoanReturnVerifySerializer
	permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

	def post(self, request, *args, **kwargs):
		serializer = self.get_serializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		loan = get_object_or_404(Loan, id=serializer.validated_data['loan_id'])
		status_choice = serializer.validated_data['status']
		was_overdue = loan.due_date and timezone.localdate() > loan.due_date
		overdue_days = (timezone.localdate() - loan.due_date).days if was_overdue else 0
		with transaction.atomic():
			if status_choice == 'verified':
				today = timezone.now().date()
				loan.return_status = 'verified'
				loan.return_date = today
				loan.return_verified_date = today
				loan.verified_by = request.user
				loan.save()
				loan.book.available = True
				loan.book.save(update_fields=['available'])
				if was_overdue:
					Fine.objects.get_or_create(
						loan=loan,
						defaults={
							'member': loan.member,
							'amount': overdue_days * FINE_RATE_PER_DAY,
							'issued_by': request.user,
						}
					)
				next_reservation = Reservation.objects.filter(book=loan.book, status='waiting').order_by('reserved_date').first()
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


class LoanBySemesterAPIView(generics.ListAPIView):
	serializer_class = LoanSerializer
	permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

	def get_queryset(self):
		queryset = Loan.objects.select_related('member', 'book', 'book__author', 'semester', 'verified_by').all().order_by('-loan_date')
		semester_id = self.request.query_params.get('semester')
		if semester_id:
			queryset = queryset.filter(semester_id=semester_id)
		return queryset


class ReservationListCreateAPIView(generics.ListCreateAPIView):
	serializer_class = ReservationSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		user = self.request.user
		base = Reservation.objects.select_related('member', 'book', 'book__author')
		if user.role == 'member':
			return base.filter(member=user).exclude(status__in=['cancelled', 'fulfilled', 'expired'])
		return base.all()

	def create(self, request, *args, **kwargs):
		if Fine.objects.filter(member=request.user, paid=False).exists():
			return Response({'error': 'You have unpaid fines. Please settle them to make reservations.'}, status=status.HTTP_400_BAD_REQUEST)
		serializer = ReservationCreateSerializer(data=request.data, context={'request': request})
		serializer.is_valid(raise_exception=True)
		book = serializer.validated_data['book']
		if book.available:
			return Response({'error': 'This book is available — submit a borrow request instead of reserving.'}, status=status.HTTP_400_BAD_REQUEST)
		already_active = Reservation.objects.filter(member=request.user, book=book, status__in=['waiting', 'ready']).exists()
		if already_active:
			return Response({'error': 'You already have an active reservation for this book.'}, status=status.HTTP_400_BAD_REQUEST)
		active_count = Reservation.objects.filter(book=book, status__in=['waiting', 'ready']).count()
		queue_position = active_count + 1
		reservation = Reservation.objects.create(member=request.user, book=book, queue_position=queue_position)
		return Response(ReservationSerializer(reservation).data, status=status.HTTP_201_CREATED)


class ReservationRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
	serializer_class = ReservationSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		return Reservation.objects.select_related('member', 'book').all()

	def destroy(self, request, *args, **kwargs):
		reservation = self.get_object()
		if reservation.member != request.user and request.user.role not in ['admin', 'librarian']:
			raise PermissionDenied('You can only cancel your own reservations.')
		if reservation.status not in ['waiting', 'ready']:
			return Response({'error': 'This reservation cannot be cancelled.'}, status=status.HTTP_400_BAD_REQUEST)
		reservation.status = 'cancelled'
		reservation.save()
		remaining = Reservation.objects.filter(book=reservation.book, status='waiting').order_by('reserved_date')
		for i, r in enumerate(remaining, start=1):
			if r.queue_position != i:
				r.queue_position = i
				r.save()
		return Response({'message': 'Reservation cancelled successfully.'}, status=status.HTTP_200_OK)


class ReservationFulfillAPIView(APIView):
	permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

	def post(self, request, pk):
		reservation = get_object_or_404(Reservation.objects.select_related('member', 'book'), pk=pk)
		if reservation.status != 'ready':
			return Response({'error': f'Cannot fulfill reservation with status "{reservation.status}".'}, status=status.HTTP_400_BAD_REQUEST)
		if not reservation.book.available:
			return Response({'error': 'This book is no longer available.'}, status=status.HTTP_400_BAD_REQUEST)
		with transaction.atomic():
			loan = Loan.objects.create(member=reservation.member, book=reservation.book)
			reservation.status = 'fulfilled'
			reservation.save()
			remaining = Reservation.objects.filter(book=reservation.book, status='waiting').order_by('reserved_date')
			for i, r in enumerate(remaining, start=1):
				if r.queue_position != i:
					r.queue_position = i
					r.save(update_fields=['queue_position'])
		return Response({'message': 'Reservation fulfilled and loan created successfully.', 'loan_id': loan.id, 'reservation_id': reservation.id}, status=status.HTTP_200_OK)


class FineRetrieveAPIView(generics.RetrieveAPIView):
	serializer_class = FineSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		user = self.request.user
		base = Fine.objects.select_related('member', 'loan', 'loan__book', 'issued_by')
		if user.role == 'member':
			return base.filter(member=user)
		return base.all()


class FineListAPIView(generics.ListAPIView):
	serializer_class = FineSerializer
	permission_classes = [IsAuthenticated]

	def get_queryset(self):
		user = self.request.user
		base = Fine.objects.select_related('member', 'loan', 'loan__book', 'issued_by')
		if user.role == 'member':
			return base.filter(member=user, paid=False)
		return base.all()


class FinePayAPIView(generics.GenericAPIView):
	permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

	def post(self, request, pk):
		fine = get_object_or_404(Fine.objects.select_related('member', 'loan'), id=pk)
		if fine.paid:
			return Response({'error': 'This fine has already been paid.'}, status=status.HTTP_400_BAD_REQUEST)
		fine.paid = True
		fine.paid_date = timezone.now().date()
		fine.issued_by = request.user
		fine.save()
		return Response({'message': 'Fine paid successfully.', 'amount': fine.amount}, status=status.HTTP_200_OK)


class DashboardStatsAPIView(APIView):
	permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

	def get(self, request):
		today = timezone.now().date()
		stats = {
			'total_books': Book.objects.count(),
			'available_books': Book.objects.filter(available=True).count(),
			'total_authors': Author.objects.count(),
			'total_categories': Category.objects.count(),
			'pending_borrow_requests': BorrowRequest.objects.filter(status='pending').count(),
			'active_loans': Loan.objects.exclude(return_status='verified').count(),
			'pending_returns': Loan.objects.filter(return_status='pending').count(),
			'overdue_loans': Loan.objects.exclude(return_status='verified').filter(due_date__lt=today).count(),
			'active_reservations': Reservation.objects.filter(status='waiting').count(),
			'ready_reservations': Reservation.objects.filter(status='ready').count(),
			'unpaid_fines': Fine.objects.filter(paid=False).count(),
			'unpaid_fines_total': Fine.objects.filter(paid=False).aggregate(total=Sum('amount'))['total'] or 0,
			'total_users': User.objects.count(),
			'total_admins': User.objects.filter(role='admin').count(),
			'total_librarians': User.objects.filter(role='librarian').count(),
			'total_members': User.objects.filter(role='member').count(),
			'active_semester': SemesterSerializer(Semester.objects.filter(is_active=True).first()).data,
		}
		return Response(stats)
