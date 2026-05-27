from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.dashboard_stats, name='circulation-dashboard'),

    path('semesters/', views.SemesterListCreateAPIView.as_view(), name='semester-list-create'),
    path('semesters/<int:pk>/', views.SemesterRetrieveUpdateDestroyAPIView.as_view(), name='semester-detail'),
    path('semesters/<int:pk>/set-active/', views.SemesterSetActiveAPIView.as_view(), name='semester-set-active'),

    path('borrow-requests/', views.BorrowRequestListCreateAPIView.as_view(), name='borrow-request-list-create'),
    path('borrow-requests/<int:pk>/', views.BorrowRequestRetrieveDestroyAPIView.as_view(), name='borrow-request-detail'),
    path('borrow-requests/<int:pk>/approve/', views.BorrowRequestApproveAPIView.as_view(), name='borrow-request-approve'),
    path('borrow-requests/<int:pk>/reject/', views.BorrowRequestRejectAPIView.as_view(), name='borrow-request-reject'),

    path('loans/', views.LoanListCreateAPIView.as_view(), name='loan-list-create'),
    path('loans/<int:pk>/', views.LoanRetrieveUpdateDestroyAPIView.as_view(), name='loan-detail'),
    path('loans/<int:pk>/return-request/', views.LoanReturnRequestAPIView.as_view(), name='loan-return-request'),
    path('loans/<int:pk>/verify-return/', views.LoanReturnVerifyAPIView.as_view(), name='loan-return-verify'),
    path('loans/by-semester/<int:semester_id>/', views.LoanBySemesterAPIView.as_view(), name='loan-by-semester'),

    path('reservations/', views.ReservationListCreateAPIView.as_view(), name='reservation-list-create'),
    path('reservations/<int:pk>/', views.ReservationRetrieveUpdateDestroyAPIView.as_view(), name='reservation-detail'),
    path('reservations/<int:pk>/fulfill/', views.ReservationFulfillAPIView.as_view(), name='reservation-fulfill'),

    path('fines/', views.FineListAPIView.as_view(), name='fine-list'),
    path('fines/<int:pk>/', views.FineRetrieveAPIView.as_view(), name='fine-detail'),
    path('fines/<int:pk>/pay/', views.FinePayAPIView.as_view(), name='fine-pay'),
]
