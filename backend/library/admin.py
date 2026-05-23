from django.contrib import admin
from .models import Category, Author, Department, Book, Semester, Loan, Reservation, Fine
from config.admin_site import librium_admin

librium_admin.register(Category)
librium_admin.register(Author)
librium_admin.register(Department)
librium_admin.register(Book)
librium_admin.register(Semester)
librium_admin.register(Loan)
librium_admin.register(Reservation)
librium_admin.register(Fine)