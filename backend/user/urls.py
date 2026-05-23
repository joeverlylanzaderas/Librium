# user/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # SELF-SERVICE
    path('me/', views.CurrentUserRetrieveUpdateAPIView.as_view(), name='user-me'),
    path('me/change-password/', views.ChangePasswordAPIView.as_view(), name='user-change-password'),

    # USER MANAGEMENT
    path('', views.UserListCreateAPIView.as_view(), name='user-list-create'),
    path('<int:pk>/', views.UserRetrieveUpdateDestroyAPIView.as_view(), name='user-detail'),
    path('<int:pk>/reactivate/', views.UserReactivateAPIView.as_view(), name='user-reactivate'),
]