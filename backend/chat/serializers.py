from rest_framework import serializers
from .models import KnowledgeBase, ChatMessage


class KnowledgeBaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgeBase
        fields = ['id', 'title', 'content', 'created_at', 'updated_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ['id', 'session_id', 'user', 'role', 'message', 'created_at']
