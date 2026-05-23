# user/models.py
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import date


# ─────────────────────────────────────────────
#  MANAGER
# ─────────────────────────────────────────────

class UserManager(BaseUserManager):
    def create_user(self, email, username, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        if not username:
            raise ValueError('Username is required')
        if not extra_fields.get('full_name'):
            raise ValueError('Full name is required')

        email = self.normalize_email(email)
        user  = self.model(email=email, username=username, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff',     True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active',    True)
        extra_fields.setdefault('role',         'admin')
        return self.create_user(email, username, password, **extra_fields)


# ─────────────────────────────────────────────
#  USER  (auth only — no personal/profile data)
# ─────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('admin',     'Admin'),
        ('librarian', 'Librarian'),
        ('member',    'Member'),
    ]

    email     = models.EmailField(unique=True)
    username  = models.CharField(max_length=150, unique=True)
    full_name = models.CharField(max_length=255)
    role      = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')

    is_active    = models.BooleanField(default=False)   # False until email verified
    is_staff     = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    date_joined  = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['username', 'full_name']

    class Meta:
        db_table = 'users'

    def save(self, *args, **kwargs):
        if self.role == 'admin':
            self.is_staff = True
            self.is_superuser = True
        else:
            self.is_staff = False
            self.is_superuser = False
        super().save(*args, **kwargs)

    def __str__(self):
        return self.email


# ─────────────────────────────────────────────
#  USER PROFILE  (personal / demographic info)
# ─────────────────────────────────────────────

class UserProfile(models.Model):
    SEX_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('O', 'Other'),
    ]

    user            = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    phone_number    = models.CharField(max_length=20, blank=True)
    address         = models.TextField(blank=True)
    bio             = models.TextField(blank=True)
    birthday = models.DateField(null=True, blank=True)
    sex      = models.CharField(max_length=1, choices=SEX_CHOICES, null=True, blank=True, default=None)

    class Meta:
        db_table = 'user_profiles'

    @property
    def age(self):
        """Calculate current age from birthday, accounting for month/day boundary."""
        if not self.birthday:
            return None
        today = date.today()
        return today.year - self.birthday.year - (
            (today.month, today.day) < (self.birthday.month, self.birthday.day)
        )

    def __str__(self):
        return f"Profile of {self.user.email}"

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)