# library/urls.py
from django.urls import path
from . import views

urlpatterns = [

    # ── Dashboard ─────────────────────────────────────────────
    path('dashboard/', views.dashboard_stats, name='dashboard-stats'),

    # ── Categories ────────────────────────────────────────────
    path('categories/',          views.CategoryListCreateAPIView.as_view(),          name='category-list-create'),
    path('categories/<int:pk>/', views.CategoryRetrieveUpdateDestroyAPIView.as_view(), name='category-detail'),

    # ── Authors ───────────────────────────────────────────────
    path('authors/',          views.AuthorListCreateAPIView.as_view(),          name='author-list-create'),
    path('authors/<int:pk>/', views.AuthorRetrieveUpdateDestroyAPIView.as_view(), name='author-detail'),

    # ── Departments ───────────────────────────────────────────
    path('departments/',          views.DepartmentListCreateAPIView.as_view(),          name='department-list-create'),
    path('departments/<int:pk>/', views.DepartmentRetrieveUpdateDestroyAPIView.as_view(), name='department-detail'),

    # ── Books ─────────────────────────────────────────────────
    path('books/',          views.BookListCreateAPIView.as_view(),          name='book-list-create'),
    path('books/<int:pk>/', views.BookRetrieveUpdateDestroyAPIView.as_view(), name='book-detail'),

    # ── Semesters ─────────────────────────────────────────────
    path('semesters/',                        views.SemesterListCreateAPIView.as_view(),          name='semester-list-create'),
    path('semesters/<int:pk>/set-active/',    views.SemesterSetActiveAPIView.as_view(),           name='semester-set-active'),
    path('semesters/<int:pk>/',               views.SemesterRetrieveUpdateDestroyAPIView.as_view(), name='semester-detail'),

    # ── Borrow Requests ───────────────────────────────────────
    path('borrow-requests/',                    views.BorrowRequestListCreateAPIView.as_view(),    name='borrow-request-list-create'),
    path('borrow-requests/<int:pk>/approve/',   views.BorrowRequestApproveAPIView.as_view(),       name='borrow-request-approve'),
    path('borrow-requests/<int:pk>/reject/',    views.BorrowRequestRejectAPIView.as_view(),        name='borrow-request-reject'),
    path('borrow-requests/<int:pk>/',           views.BorrowRequestRetrieveDestroyAPIView.as_view(), name='borrow-request-detail'),

    # ── Loans ─────────────────────────────────────────────────
    path('loans/', views.LoanListCreateAPIView.as_view(), name='loan-list-create'),

    # matches api.ts: req('POST', '/library/loans/return-request/', { loan_id, notes })
    path('loans/return-request/', views.LoanReturnRequestAPIView.as_view(),  name='loan-return-request'),
    # matches api.ts: req('POST', '/library/loans/return-verify/', { loan_id, status, notes })
    path('loans/return-verify/',  views.LoanReturnVerifyAPIView.as_view(),   name='loan-return-verify'),
    # matches api.ts: req('GET', '/library/loans/by-semester/?semester=<id>')
    path('loans/by-semester/',    views.LoanBySemesterAPIView.as_view(),     name='loan-by-semester'),
    path('loans/<int:pk>/', views.LoanRetrieveUpdateDestroyAPIView.as_view(), name='loan-detail'),

    # ── Reservations ──────────────────────────────────────────
    path('reservations/',          views.ReservationListCreateAPIView.as_view(),          name='reservation-list-create'),
    path('reservations/<int:pk>/', views.ReservationRetrieveUpdateDestroyAPIView.as_view(), name='reservation-detail'),
    path('reservations/<int:pk>/fulfill/', views.ReservationFulfillAPIView.as_view(), name='reservation-fulfill'),

    # ── Fines ─────────────────────────────────────────────────
    path('fines/',                views.FineListAPIView.as_view(),     name='fine-list'),
    path('fines/<int:pk>/',       views.FineRetrieveAPIView.as_view(), name='fine-detail'),
    path('fines/<int:pk>/pay/',   views.FinePayAPIView.as_view(),      name='fine-pay'),
    
    path('chat/', views.ChatbotAPIView.as_view(), name='chatbot'),
    path('knowledge/', views.KnowledgeBaseView.as_view(), name='knowledge-base'),
]