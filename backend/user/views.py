# users/views.py
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.exceptions import PermissionDenied
from django.contrib.auth import get_user_model

from .models import UserProfile
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    UserProfileUpdateSerializer,
    ChangePasswordSerializer,
)
from library.permissions import IsAdminOrLibrarian

User = get_user_model()


# ─────────────────────────────────────────────
#  USER LIST & CREATE
# ─────────────────────────────────────────────

class UserListCreateAPIView(generics.ListCreateAPIView):
    serializer_class   = UserSerializer
    permission_classes = [IsAuthenticated, IsAdminOrLibrarian]

    def get_queryset(self):
        if self.request.user.role == 'admin':
            return User.objects.select_related('profile').all()
        # Librarians can only see members — not other librarians or admins
        return User.objects.select_related('profile').filter(role='member')

    def create(self, request, *args, **kwargs):
        # librarians cannot create admin or librarian accounts
        requested_role = request.data.get('role', 'member')
        if request.user.role != 'admin' and requested_role in ['admin', 'librarian']:
            raise PermissionDenied('Librarians can only create member accounts.')

        serializer = UserCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            # admin/librarian-created accounts are active immediately
            user = serializer.save()
            user.is_active = True
            user.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─────────────────────────────────────────────
#  USER DETAIL, UPDATE & SOFT-DELETE
# ─────────────────────────────────────────────

class UserRetrieveUpdateDestroyAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = UserSerializer

    def get_queryset(self):
        return User.objects.select_related('profile').all()

    def get_permissions(self):
        if self.request.method == 'DELETE':
            return [IsAuthenticated(), IsAdminUser()]
        return [IsAuthenticated(), IsAdminOrLibrarian()]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()

        if user == request.user:
            return Response(
                {'error': 'You cannot deactivate your own account.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if user.role == 'admin' and not request.user.is_superuser:
            return Response(
                {'error': 'Only a superuser can deactivate another admin.'},
                status=status.HTTP_403_FORBIDDEN
            )

        user.is_active = False
        user.save()
        return Response(
            {'message': f'{user.email} has been deactivated.'},
            status=status.HTTP_200_OK
        )

    def update(self, request, *args, **kwargs):
        requested_role = request.data.get('role')
        if requested_role and request.user.role != 'admin' and requested_role in ['admin', 'librarian']:
            raise PermissionDenied('Librarians cannot change a user\'s role to admin or librarian.')
        return super().update(request, *args, **kwargs)


# ─────────────────────────────────────────────
#  CURRENT USER
# ─────────────────────────────────────────────

class CurrentUserRetrieveUpdateAPIView(generics.RetrieveUpdateAPIView):
    serializer_class   = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return User.objects.select_related('profile').get(pk=self.request.user.pk)

    def update(self, request, *args, **kwargs):
        user = self.get_object()

        user_serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        user_serializer.is_valid(raise_exception=True)
        user_serializer.save()

        if 'profile' in request.data:
            profile, _ = UserProfile.objects.get_or_create(user=user)
            profile_data = request.data.get('profile', {})
            if isinstance(profile_data, str):
                import json
                profile_data = json.loads(profile_data)
            profile_serializer = UserProfileUpdateSerializer(profile, data=profile_data, partial=True)
            profile_serializer.is_valid(raise_exception=True)
            profile_serializer.save()

        user.refresh_from_db()
        return Response(UserSerializer(user).data)


# ─────────────────────────────────────────────
#  CHANGE PASSWORD
# ─────────────────────────────────────────────

class ChangePasswordAPIView(generics.GenericAPIView):
    serializer_class   = ChangePasswordSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        if not user.check_password(serializer.validated_data.get('old_password')):
            return Response(
                {'old_password': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(serializer.validated_data.get('new_password'))
        user.save()
        return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)


# ─────────────────────────────────────────────
#  REACTIVATE USER  (admin only)
# ─────────────────────────────────────────────

class UserReactivateAPIView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request, pk, *args, **kwargs):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if user.is_active:
            return Response({'message': 'User is already active.'}, status=status.HTTP_200_OK)

        user.is_active = True
        user.save()
        return Response(
            {'message': f'{user.email} has been reactivated.'},
            status=status.HTTP_200_OK
        )