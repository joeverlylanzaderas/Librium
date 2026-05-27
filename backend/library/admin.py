from django.contrib import admin
from .models import Category, Author, Department, Book, Bookmark
from config.admin_site import librium_admin

librium_admin.register(Category)
librium_admin.register(Author)
librium_admin.register(Department)
librium_admin.register(Book)
librium_admin.register(Bookmark)