from django.urls import path
from . import views

urlpatterns = [
    path('categories/', views.CategoryListCreateAPIView.as_view(), name='category-list-create'),
    path('categories/<int:pk>/', views.CategoryRetrieveUpdateDestroyAPIView.as_view(), name='category-detail'),

    path('authors/', views.AuthorListCreateAPIView.as_view(), name='author-list-create'),
    path('authors/<int:pk>/', views.AuthorRetrieveUpdateDestroyAPIView.as_view(), name='author-detail'),

    path('departments/', views.DepartmentListCreateAPIView.as_view(), name='department-list-create'),
    path('departments/<int:pk>/', views.DepartmentRetrieveUpdateDestroyAPIView.as_view(), name='department-detail'),

    path('bookmarks/', views.BookmarkListCreateAPIView.as_view(), name='bookmark-list-create'),
    path('bookmarks/<int:pk>/', views.BookmarkDestroyAPIView.as_view(), name='bookmark-detail'),

    path('books/', views.BookListCreateAPIView.as_view(), name='book-list-create'),
    path('books/<int:pk>/', views.BookRetrieveUpdateDestroyAPIView.as_view(), name='book-detail'),
    path('books/<int:pk>/restore/', views.BookRestoreAPIView.as_view(), name='book-restore'),
]
