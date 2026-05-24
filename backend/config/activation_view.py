# config/activation_view.py
from django.shortcuts import render
from django.views import View
from django.conf import settings
from djoser.utils import decode_uid
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth.tokens import default_token_generator

User = get_user_model()

# Get URLs from settings (so they can be configured per environment)
FRONTEND_LOGIN_URL    = getattr(settings, 'FRONTEND_LOGIN_URL', 'https://librium-web.netlify.app/login')
FRONTEND_REGISTER_URL = getattr(settings, 'FRONTEND_REGISTER_URL', 'https://librium-web.netlify.app/register')

class ActivateAccountView(View):
    def get(self, request, uid, token):
        # ── Validate uid ──────────────────────────────────────────
        try:
            user_id = decode_uid(uid)
            user = User.objects.get(pk=user_id)
        except (ObjectDoesNotExist, ValueError, TypeError):
            return render(request, 'activation.html', {
                'success': False,
                'message': 'This activation link is invalid or has been tampered with.',
                'login_url': FRONTEND_LOGIN_URL,
                'register_url': FRONTEND_REGISTER_URL,
            })

        # ── Validate token ────────────────────────────────────────
        if not default_token_generator.check_token(user, token):
            return render(request, 'activation.html', {
                'success': False,
                'message': 'This link has expired or has already been used. Links are valid for 24 hours — please register again.',
                'login_url': FRONTEND_LOGIN_URL,
                'register_url': FRONTEND_REGISTER_URL,
            })

        # ── Activate user ─────────────────────────────────────────
        already_active = user.is_active

        if not already_active:
            user.is_active = True
            user.save(update_fields=['is_active'])

        # ── Detect mobile client ──────────────────────────────────
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        is_mobile = 'android' in user_agent or 'iphone' in user_agent or 'expo' in user_agent

        # For web users, send to Netlify login page
        login_url_for_user = 'librium://activated' if is_mobile else FRONTEND_LOGIN_URL

        return render(request, 'activation.html', {
            'success': True,
            'already_active': already_active,
            'message': 'Your Librium account is now active. You can sign in.',
            'uid': uid,
            'token': token,
            'is_mobile': is_mobile,
            'app_link': 'librium://activated',
            'login_url': login_url_for_user,  # Mobile gets deep link, web gets Netlify URL
            'register_url': FRONTEND_REGISTER_URL,
        })