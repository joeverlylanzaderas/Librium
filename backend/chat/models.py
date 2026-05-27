from django.db import models
from django.conf import settings


# ─────────────────────────────────────────────
#  CHAT MESSAGE
# ─────────────────────────────────────────────
class ChatMessage(models.Model):
    ROLE_CHOICES = (
        ('user', 'User'),
        ('assistant', 'Assistant'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    session_id = models.CharField(max_length=100, null=True, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name='chat_messages'
    )

    class Meta:
        indexes = [
            models.Index(fields=['session_id', '-created_at']),
        ]

    def __str__(self):
        return f"{self.role}: {self.message[:50]}"
    
    
# ────────────────────────────────────────────
#  KNOWLEDGE BASE ENTRY
# ────────────────────────────────────────────
class KnowledgeBase(models.Model):
    title = models.CharField(max_length=255)
    text_content = models.TextField(blank=True, null=True)
    pdf_file = models.FileField(upload_to='pdfs/', null=True, blank=True)
    website_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title