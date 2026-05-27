from rest_framework import serializers
from .models import Semester, BorrowRequest, Loan, Reservation, Fine


class SemesterSerializer(serializers.ModelSerializer):
    semester_type_display = serializers.CharField(
        source='get_semester_type_display',
        read_only=True
    )
    loan_count = serializers.IntegerField(
        source='loans.count',
        read_only=True
    )

    class Meta:
        model = Semester
        fields = [
            'id', 'academic_year', 'semester_type', 'semester_type_display',
            'start_date', 'end_date', 'is_active', 'loan_count',
        ]


class BorrowRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    book_title = serializers.CharField(source='book.title', read_only=True)
    book_cover = serializers.SerializerMethodField()
    processed_by_name = serializers.CharField(
        source='processed_by.full_name', read_only=True, default=None
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    loan_id = serializers.IntegerField(source='loan.id', read_only=True, default=None)

    class Meta:
        model = BorrowRequest
        fields = [
            'id', 'member', 'member_name',
            'book', 'book_title', 'book_cover',
            'status', 'status_display',
            'request_date', 'processed_date',
            'processed_by', 'processed_by_name',
            'loan_id',
            'notes',
        ]
        read_only_fields = [
            'status', 'request_date', 'processed_date',
            'processed_by', 'loan_id',
        ]

    def get_book_cover(self, obj):
        if not obj.book or not obj.book.cover_image:
            return None
        url = str(obj.book.cover_image)
        return url.replace('/upload/', '/upload/f_auto,w_200/')


class BorrowRequestCreateSerializer(serializers.ModelSerializer):
    member = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = BorrowRequest
        fields = ['member', 'book', 'notes']

    def validate(self, attrs):
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError('Authentication required.')

        book = attrs['book']
        member = request.user

        if not book.is_active:
            raise serializers.ValidationError({'book': 'This book has been deactivated and cannot be borrowed.'})

        has_unpaid_fine = Fine.objects.filter(member=member, paid=False).exists()
        if has_unpaid_fine:
            raise serializers.ValidationError({'non_field_errors': 'You have unpaid fines. Please settle them before borrowing.'})

        MAX_BOOKS = 3
        active_loan_count = Loan.objects.filter(member=member).exclude(return_status='verified').count()
        if active_loan_count >= MAX_BOOKS:
            raise serializers.ValidationError({'non_field_errors': f'You have reached the limit of {MAX_BOOKS} borrowed books. Please return some books before borrowing more.'})

        if not book.available:
            raise serializers.ValidationError({'book': 'This book is currently unavailable. You can reserve it instead.'})

        already_active = BorrowRequest.objects.filter(member=member, book=book, status='pending').exists()
        if already_active:
            raise serializers.ValidationError({'book': 'You already have an active borrow request for this book.'})

        active_loan = Loan.objects.filter(member=member, book=book).exclude(return_status='verified').exists()
        if active_loan:
            raise serializers.ValidationError({'book': 'You currently have an unreturned loan for this book.'})

        attrs['member'] = member
        return attrs


class BorrowRequestActionSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)


class LoanSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    book_title = serializers.CharField(source='book.title', read_only=True)
    book_cover = serializers.SerializerMethodField()
    book_category = serializers.CharField(source='book.category.name', read_only=True, default=None)
    book_department = serializers.CharField(source='book.department.name', read_only=True, default=None)
    verified_by_name = serializers.CharField(source='verified_by.full_name', read_only=True, default=None)
    semester_label = serializers.CharField(source='semester.__str__', read_only=True, default=None)
    is_overdue = serializers.ReadOnlyField()
    overdue_days = serializers.ReadOnlyField()
    borrow_request_id = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = [
            'id',
            'member', 'member_name',
            'book', 'book_title', 'book_cover', 'book_category', 'book_department',
            'semester', 'semester_label',
            'loan_date', 'due_date',
            'return_date', 'return_requested_date', 'return_verified_date',
            'return_status',
            'verified_by', 'verified_by_name',
            'is_overdue', 'overdue_days',
            'borrow_request_id',
            'notes',
        ]
        read_only_fields = ['due_date', 'return_verified_date', 'verified_by', 'is_overdue', 'overdue_days']

    def get_book_cover(self, obj):
        if not obj.book or not obj.book.cover_image:
            return None
        url = str(obj.book.cover_image)
        return url.replace('/upload/', '/upload/f_auto,w_200/')

    def get_borrow_request_id(self, obj):
        try:
            return obj.borrow_request.id
        except Exception:
            return None


class LoanCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Loan
        fields = ['member', 'book', 'loan_date']
        extra_kwargs = {'loan_date': {'required': False}}

    def validate_book(self, value):
        if not value.available:
            raise serializers.ValidationError('This book is currently on loan and cannot be borrowed.')
        return value


class LoanReturnRequestSerializer(serializers.Serializer):
    loan_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_loan_id(self, value):
        try:
            return_loan = Loan.objects.get(pk=value)
        except Loan.DoesNotExist:
            raise serializers.ValidationError('Loan not found.')
        if return_loan.return_status == 'verified':
            raise serializers.ValidationError('This book has already been returned and verified.')
        if return_loan.return_status == 'pending':
            raise serializers.ValidationError('A return request is already pending.')
        return value


class LoanReturnVerifySerializer(serializers.Serializer):
    loan_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=['verified', 'rejected', 'disputed'])
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_loan_id(self, value):
        try:
            verify_loan = Loan.objects.get(pk=value)
        except Loan.DoesNotExist:
            raise serializers.ValidationError('Loan not found.')
        if verify_loan.return_status == 'verified':
            raise serializers.ValidationError('This return has already been verified.')
        return value


class ReservationSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    book_title = serializers.CharField(source='book.title', read_only=True)
    book_author = serializers.CharField(source='book.author.name', read_only=True, default=None)

    class Meta:
        model = Reservation
        fields = [
            'id', 'member', 'member_name',
            'book', 'book_title', 'book_author',
            'reserved_date', 'status', 'queue_position', 'notified_date',
        ]
        read_only_fields = ['reserved_date', 'queue_position', 'notified_date']


class ReservationCreateSerializer(serializers.ModelSerializer):
    member = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Reservation
        fields = ['member', 'book']

    def create(self, validated_data):
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError('Authentication required.')
        validated_data['member'] = request.user
        return super().create(validated_data)


class FineSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    book_title = serializers.CharField(source='loan.book.title', read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.full_name', read_only=True, default=None)

    class Meta:
        model = Fine
        fields = [
            'id', 'member', 'member_name',
            'loan', 'book_title',
            'amount',
            'paid', 'paid_date',
            'issued_date', 'issued_by', 'issued_by_name',
            'notes',
        ]
        read_only_fields = ['issued_date', 'issued_by', 'issued_by_name']
