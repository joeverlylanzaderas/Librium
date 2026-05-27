from django.urls import path
from . import views

urlpatterns = [
    path('chat/', views.ChatbotAPIView.as_view(), name='chatbot'),
    path('knowledge/', views.KnowledgeBaseView.as_view(), name='knowledge-base'),
    path('knowledge/<int:pk>/', views.KnowledgeBaseView.as_view(), name='knowledge-base-detail'),
]