# library/models.py
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


# ─────────────────────────────────────────────
#  AUTHOR
# ─────────────────────────────────────────────

class Author(models.Model):
    name        = models.CharField(max_length=100)
    biography   = models.TextField(blank=True, null=True)
    nationality = models.CharField(max_length=50, blank=True, null=True)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
#  CATEGORY
# ─────────────────────────────────────────────

class Category(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
#  DEPARTMENT
# ─────────────────────────────────────────────

class Department(models.Model):
    name        = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name


# ─────────────────────────────────────────────
#  BOOK
# ─────────────────────────────────────────────

class Book(models.Model):
    title            = models.CharField(max_length=200)
    is_active        = models.BooleanField(default=True)
    isbn             = models.CharField(max_length=20, unique=True)
    author           = models.ForeignKey(Author,     on_delete=models.CASCADE)
    category         = models.ForeignKey(Category,   on_delete=models.SET_NULL, null=True, blank=True)
    department       = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    available        = models.BooleanField(default=True)
    cover_image      = models.URLField(max_length=500, null=True, blank=True)
    description      = models.TextField(blank=True, null=True)
    publication_year = models.IntegerField(
        validators=[
            MinValueValidator(1000),
            MaxValueValidator(timezone.localdate().year),
        ]
    )

    def __str__(self):
        return self.title
    

# ─────────────────────────────────────────────
# BOOKMARK
# ─────────────────────────────────────────────
class Bookmark(models.Model):
    member = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookmarks'
    )
    book = models.ForeignKey(
        Book,
        on_delete=models.CASCADE,
        related_name='bookmarks'
    )
    bookmarked_date = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ['-bookmarked_date']
        constraints = [
            models.UniqueConstraint(
                fields=['member', 'book'],
                name='unique_bookmark_per_member_book'
            )
        ]

    def __str__(self):
        return f"{self.member} bookmarked {self.book.title}"
