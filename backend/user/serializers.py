# users/serializers.py
from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from djoser.serializers import UserCreateSerializer as DjoserUserCreateSerializer
from djoser.serializers import UserSerializer as DjoserUserSerializer
from .models import User, UserProfile


# ─────────────────────────────────────────────
#  USER PROFILE
# ─────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    age = serializers.ReadOnlyField()
    sex_display = serializers.CharField(
        source='get_sex_display',
        read_only=True,
        default=None
    )

    class Meta:
        model  = UserProfile
        fields = [
            'profile_picture',
            'phone_number',
            'address',
            'bio',
            'birthday',     
            'sex',         
            'sex_display',
            'age',          
        ]
        read_only_fields = ['age', 'sex_display']


# ─────────────────────────────────────────────
#  USER
# ─────────────────────────────────────────────

class UserSerializer(DjoserUserSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta(DjoserUserSerializer.Meta):
        model  = User
        fields = [
            'id',
            'email',
            'username',
            'full_name',
            'role',
            'is_active',
            'date_joined',
            'profile',  
        ]
        read_only_fields = ['id', 'date_joined', 'is_active']


# ─────────────────────────────────────────────
#  USER CREATE  (registration)
# ─────────────────────────────────────────────

class UserCreateSerializer(DjoserUserCreateSerializer):
    password  = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True, label='Confirm password')
    phone_number = serializers.CharField(max_length=20, required=False, allow_blank=True) 
    birthday = serializers.DateField(required=False, allow_null=True)
    sex      = serializers.ChoiceField(
        choices=UserProfile.SEX_CHOICES,
        required=False,
        allow_null=True,
        allow_blank=True,
    )

    class Meta(DjoserUserCreateSerializer.Meta):
        model  = User
        fields = [
            'id',
            'email',
            'username',
            'full_name',
            'password',
            'password2',
            'phone_number',
            'birthday',
            'sex',
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({'password2': "Passwords didn't match."})
        return attrs

    def validate_role(self, value):
        return 'member'

    def create(self, validated_data):
        validated_data.pop('password2')
        phone_number = validated_data.pop('phone_number', None)
        birthday = validated_data.pop('birthday', None)
        sex      = validated_data.pop('sex', None)
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.is_active = False     
        user.save()

        if birthday is not None or sex is not None or phone_number is not None:
            profile = user.profile
            if birthday is not None:
                profile.birthday = birthday
            if sex is not None:
                profile.sex = sex
            if phone_number is not None:
                profile.phone_number = phone_number
            profile.save()

        return user


# ─────────────────────────────────────────────
#  USER UPDATE
# ─────────────────────────────────────────────

class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = [
            'full_name',
            'username',
        ]


# ─────────────────────────────────────────────
#  USER PROFILE UPDATE
# ─────────────────────────────────────────────

class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = UserProfile
        fields = [
            'profile_picture',
            'phone_number',
            'address',
            'bio',
            'birthday',     
            'sex',          
        ]
        read_only_fields = []


# ─────────────────────────────────────────────
#  CHANGE PASSWORD
# ─────────────────────────────────────────────

class ChangePasswordSerializer(serializers.Serializer):
    old_password     = serializers.CharField(required=True, write_only=True)
    new_password     = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password]  
    )
    confirm_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError(
                {'confirm_password': "New passwords didn't match."}
            )
        if attrs['new_password'] == attrs['old_password']:
            raise serializers.ValidationError(
                {'new_password': 'New password must be different from the current password.'}
            )
        return attrs