import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'fallback-dev-secret-key-change-in-production')

DEBUG = True

ALLOWED_HOSTS = []

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = True  # development only


# ─────────────────────────────────────────────
# APPS
# ─────────────────────────────────────────────

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'rest_framework',
    'corsheaders',
    'djoser',
    'cloudinary',
    'cloudinary_storage',  

    'user',       
    'library',      
]


# ─────────────────────────────────────────────
# MIDDLEWARE
# ─────────────────────────────────────────────

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',   
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]


WSGI_APPLICATION = 'config.wsgi.application'


# ─────────────────────────────────────────────
# DATABASE
# ─────────────────────────────────────────────

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# ─────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────

AUTH_USER_MODEL = 'user.User'   

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# ─────────────────────────────────────────────
# REST FRAMEWORK
# ─────────────────────────────────────────────

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}


# ─────────────────────────────────────────────
# SIMPLE JWT
# ─────────────────────────────────────────────

SIMPLE_JWT = {
    'AUTH_HEADER_TYPES': ('Bearer',),
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
}


# ─────────────────────────────────────────────
# DJOSER
# ─────────────────────────────────────────────

DJOSER = {
    'LOGIN_FIELD': 'email',                  
    'USER_CREATE_PASSWORD_RETYPE': False,    
    'SEND_ACTIVATION_EMAIL': True,
    'ACTIVATION_URL': 'activate/{uid}/{token}',   
    'PASSWORD_RESET_CONFIRM_URL': 'password/reset/confirm/{uid}/{token}',
    'SERIALIZERS': {
        'user_create': 'user.serializers.UserCreateSerializer',
        'user':        'user.serializers.UserSerializer',
        'current_user': 'user.serializers.UserSerializer',
    },
}


# ─────────────────────────────────────────────
# EMAIL  —  console backend for development
# Emails print to the terminal instead of being sent.
# Copy the activation link from the terminal output to activate accounts.
# Switch to smtp.EmailBackend (or similar) for production.
# ─────────────────────────────────────────────

EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'


# ─────────────────────────────────────────────
# CLOUDINARY / MEDIA
# ─────────────────────────────────────────────

CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME'),
    'API_KEY':    os.environ.get('CLOUDINARY_API_KEY'),
    'API_SECRET': os.environ.get('CLOUDINARY_API_SECRET'),
}

STORAGES = {
    'default': {
        'BACKEND': 'cloudinary_storage.storage.MediaCloudinaryStorage',
    },
    'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
    },
}

MEDIA_URL  = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


# ─────────────────────────────────────────────
# STATIC / I18N / MISC
# ─────────────────────────────────────────────

STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles' 

LANGUAGE_CODE = 'en-us'
TIME_ZONE     = 'Asia/Manila'
USE_I18N      = True
USE_TZ        = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'




JAZZMIN_SETTINGS = {
    # ── Branding ──────────────────────────────────────────────
    "site_title": "Librium",
    "site_header": "Librium Library System",
    "site_brand": "Librium",
    "site_logo": None,           
    "login_logo": None,
    "site_icon": None,
    "welcome_sign": "Welcome to Librium Admin",
    "copyright": "Librium University Library",

    # ── Top navigation ────────────────────────────────────────
    "topmenu_links": [
        {"name": "Dashboard", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"name": "API Docs",  "url": "/api/schema/swagger-ui/", "new_window": True},
        {"name": "View Site", "url": "/", "new_window": True},
    ],

    # ── User menu (top-right) ─────────────────────────────────
    "usermenu_links": [
        {"name": "Support", "url": "#", "icon": "fas fa-circle-question"},
    ],

    # ── Sidebar ───────────────────────────────────────────────
    "show_sidebar": True,
    "navigation_expanded": True,
    "hide_apps": [],
    "hide_models": [],

    # Custom sidebar order
    "order_with_respect_to": [
        "auth",
        "user",
        "library.book",
        "library.author",
        "library.category",
        "library.department",
        "library.semester",
        "library.borrowrequest",
        "library.loan",
        "library.reservation",
        "library.fine",
    ],

    # Custom sidebar icons per model
    "icons": {
        "auth":                     "fas fa-users-cog",
        "auth.group":               "fas fa-layer-group",
        "user.user":                "fas fa-user",
        "user.userprofile":         "fas fa-id-card",
        "library.book":             "fas fa-book",
        "library.author":           "fas fa-pen-nib",
        "library.category":         "fas fa-tags",
        "library.department":       "fas fa-building-columns",
        "library.semester":         "fas fa-calendar-alt",
        "library.borrowrequest":    "fas fa-hand-holding-heart",
        "library.loan":             "fas fa-book-open",
        "library.reservation":      "fas fa-bookmark",
        "library.fine":             "fas fa-file-invoice-dollar",
    },
    "default_icon_parents": "fas fa-chevron-circle-right",
    "default_icon_children": "fas fa-circle",

    # ── UI tweaks ─────────────────────────────────────────────
    "related_modal_active": True,       
    "custom_css": "admin/css/librium.css",
    "custom_js": None,
    "use_google_fonts_cdn": True,
    "show_ui_builder": False,           
    "changeform_format": "horizontal_tabs",
    "changeform_format_overrides": {
        "auth.user":  "collapsible",
        "auth.group": "vertical_tabs",
    },
    "language_chooser": False,
}

JAZZMIN_UI_TWEAKS = {
    "navbar_small_text": False,
    "footer_small_text": False,
    "body_small_text":   False,
    "brand_small_text":  False,
    "brand_colour":      "navbar-dark",
    "accent":            "accent-warning",   
    "navbar":            "navbar-dark",
    "no_navbar_border":  True,
    "navbar_fixed":      True,
    "layout_boxed":      False,
    "footer_fixed":      False,
    "sidebar_fixed":     True,
    "sidebar":           "sidebar-dark-warning",  
    "theme":             "cosmo",           
    "dark_mode_theme":   "darkly",
    "button_classes": {
        "primary":   "btn-primary",
        "secondary": "btn-secondary",
        "info":      "btn-info",
        "warning":   "btn-warning",
        "danger":    "btn-danger",
        "success":   "btn-success",
    },
}