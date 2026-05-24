# library/serializers.py
from rest_framework import serializers
from .models import Category, Author, Book, Department, Loan, Reservation, Fine, Semester, BorrowRequest


# ─────────────────────────────────────────────
#  CATEGORY
# ─────────────────────────────────────────────

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model  = Category
        fields = ['id', 'name', 'description']


# ─────────────────────────────────────────────
#  AUTHOR
# ─────────────────────────────────────────────

class AuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Author
        fields = ['id', 'name', 'biography', 'nationality']


# ─────────────────────────────────────────────
#  DEPARTMENT
# ─────────────────────────────────────────────

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Department
        fields = ['id', 'name', 'description']


# ─────────────────────────────────────────────
#  SEMESTER
# ─────────────────────────────────────────────

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
        model  = Semester
        fields = [
            'id', 'academic_year', 'semester_type', 'semester_type_display',
            'start_date', 'end_date', 'is_active', 'loan_count',
        ]


# ─────────────────────────────────────────────
#  BOOK
# ─────────────────────────────────────────────

class BookSerializer(serializers.ModelSerializer):
    author_name     = serializers.CharField(source='author.name',     read_only=True)
    category_name   = serializers.CharField(source='category.name',   read_only=True, default=None)
    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model  = Book
        fields = [
            'id', 'title', 'isbn', 'publication_year',
            'author', 'author_name',
            'category', 'category_name',
            'department', 'department_name',
            'available',
            'cover_image',
            'description',
        ]

    def get_cover_image_url(self, obj):
        if not obj.cover_image:
            return None
        request = self.context.get('request')
        url = obj.cover_image.url
        url = url.replace('/upload/', '/upload/f_auto/')
        if request:
            return request.build_absolute_uri(url)
        return url


# ─────────────────────────────────────────────
#  BORROW REQUEST
# ─────────────────────────────────────────────

class BorrowRequestSerializer(serializers.ModelSerializer):
    member_name    = serializers.CharField(source='member.full_name',       read_only=True)
    book_title     = serializers.CharField(source='book.title',             read_only=True)
    book_cover     = serializers.SerializerMethodField()
    processed_by_name = serializers.CharField(
        source='processed_by.full_name', read_only=True, default=None
    )
    status_display = serializers.CharField(source='get_status_display',     read_only=True)
    loan_id        = serializers.IntegerField(source='loan.id', read_only=True, default=None)

    class Meta:
        model  = BorrowRequest
        fields = [
            'id',
            'member', 'member_name',
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
    """Used by members to create a new borrow request."""
    # read_only: the view passes context={'request': request} and we inject
    # member in validate(), so the client never needs to send it
    member = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model  = BorrowRequest
        fields = ['member', 'book', 'notes']

    def validate(self, attrs):
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError("Authentication required.")

        book   = attrs['book']
        member = request.user

        # block if book is already on loan
        if not book.available:
            raise serializers.ValidationError(
                {'book': 'This book is currently unavailable. You can reserve it instead.'}
            )

        # block duplicate active requests
        already_active = BorrowRequest.objects.filter(
            member=member,
            book=book,
            status__in=['pending', 'approved']
        ).exists()
        if already_active:
            raise serializers.ValidationError(
                {'book': 'You already have an active borrow request for this book.'}
            )

        # inject member so serializer.save() works without extra kwargs
        attrs['member'] = member
        return attrs


class BorrowRequestActionSerializer(serializers.Serializer):
    """Used by staff to approve or reject a borrow request (optional notes only)."""
    notes = serializers.CharField(required=False, allow_blank=True)


# ─────────────────────────────────────────────
#  LOAN
# ─────────────────────────────────────────────

class LoanSerializer(serializers.ModelSerializer):
    member_name      = serializers.CharField(source='member.full_name',      read_only=True)
    book_title       = serializers.CharField(source='book.title',            read_only=True)
    book_cover       = serializers.SerializerMethodField()
    book_category    = serializers.CharField(source='book.category.name',    read_only=True, default=None)
    book_department  = serializers.CharField(source='book.department.name',  read_only=True, default=None)
    verified_by_name = serializers.CharField(source='verified_by.full_name', read_only=True, default=None)
    semester_label   = serializers.CharField(source='semester.__str__',      read_only=True, default=None)
    is_overdue       = serializers.ReadOnlyField()
    overdue_days     = serializers.ReadOnlyField()
    borrow_request_id = serializers.SerializerMethodField()

    class Meta:
        model  = Loan
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
        read_only_fields = [
            'due_date', 'return_verified_date', 'verified_by',
            'is_overdue', 'overdue_days',
        ]

    def get_book_cover(self, obj):
        if not obj.book or not obj.book.cover_image:
            return None
        url = obj.book.cover_image.url
        return url.replace('/upload/', '/upload/f_auto,w_200/')

    def get_borrow_request_id(self, obj):
        try:
            return obj.borrow_request.id
        except Exception:
            return None


class LoanCreateSerializer(serializers.ModelSerializer):
    """Used by staff when issuing a walk-in loan directly (no borrow request)."""
    class Meta:
        model  = Loan
        fields = ['member', 'book', 'loan_date']
        extra_kwargs = {
            'loan_date': {'required': False}   # defaults to date.today in the model
        }

    def validate_book(self, value):
        if not value.available:
            raise serializers.ValidationError(
                'This book is currently on loan and cannot be borrowed.'
            )
        return value


class LoanReturnRequestSerializer(serializers.Serializer):
    """Member submits a return request for their own loan."""
    loan_id = serializers.IntegerField()
    notes   = serializers.CharField(required=False, allow_blank=True)

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
    """Librarian/admin verifies, rejects, or disputes a return request."""
    loan_id = serializers.IntegerField()
    status  = serializers.ChoiceField(choices=['verified', 'rejected', 'disputed'])
    notes   = serializers.CharField(required=False, allow_blank=True)

    def validate_loan_id(self, value):
        try:
            verify_loan = Loan.objects.get(pk=value)
        except Loan.DoesNotExist:
            raise serializers.ValidationError('Loan not found.')
        if verify_loan.return_status == 'verified':
            raise serializers.ValidationError('This return has already been verified.')
        return value


# ─────────────────────────────────────────────
#  RESERVATION
# ─────────────────────────────────────────────

class ReservationSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    book_title  = serializers.CharField(source='book.title',       read_only=True)
    book_author = serializers.CharField(source='book.author.name', read_only=True, default=None)

    class Meta:
        model  = Reservation
        fields = [
            'id',
            'member', 'member_name',
            'book', 'book_title', 'book_author',
            'reserved_date', 'status', 'queue_position', 'notified_date',
        ]
        read_only_fields = ['reserved_date', 'queue_position', 'notified_date']


class ReservationCreateSerializer(serializers.ModelSerializer):
    # read_only: the view passes context={'request': request} and create() injects member
    member = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model  = Reservation
        fields = ['member', 'book']

    def create(self, validated_data):
        request = self.context.get('request')
        if not request or not request.user:
            raise serializers.ValidationError("Authentication required.")
        validated_data['member'] = request.user
        return super().create(validated_data)


# ─────────────────────────────────────────────
#  FINE
# ─────────────────────────────────────────────

class FineSerializer(serializers.ModelSerializer):
    member_name    = serializers.CharField(source='member.full_name',     read_only=True)
    book_title     = serializers.CharField(source='loan.book.title',      read_only=True)
    issued_by_name = serializers.CharField(source='issued_by.full_name',  read_only=True, default=None)

    class Meta:
        model  = Fine
        fields = [
            'id',
            'member', 'member_name',
            'loan', 'book_title',
            'amount',
            'paid', 'paid_date',
            'issued_date', 'issued_by', 'issued_by_name',
            'notes',
        ]
        read_only_fields = ['issued_date', 'issued_by', 'issued_by_name']