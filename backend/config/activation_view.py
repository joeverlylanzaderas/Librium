from django.shortcuts import render
from django.views import View
from djoser.utils import decode_uid
from django.contrib.auth import get_user_model
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth.tokens import default_token_generator

User = get_user_model()

class ActivateAccountView(View):
    def get(self, request, uid, token):
        # Validate uid + token first regardless of client
        try:
            user_id = decode_uid(uid)
            user    = User.objects.get(pk=user_id)
        except (ObjectDoesNotExist, ValueError, TypeError):
            return render(request, 'activation.html', {
                'success': False,
                'message': 'Invalid activation link.',
                'uid': uid, 'token': token,
            })

        if not default_token_generator.check_token(user, token):
            return render(request, 'activation.html', {
                'success': False,
                'message': 'This link has expired or already been used.',
                'uid': uid, 'token': token,
            })

        already_active = user.is_active

        if not already_active:
            user.is_active = True
            user.save()

        # Detect if request came from Android APK via intent
        # Android Chrome adds an intent header; also check user-agent
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        is_mobile  = 'android' in user_agent or 'iphone' in user_agent

        return render(request, 'activation.html', {
            'success':      True,
            'already_active': already_active,
            'message':      'Your account has been activated! You can now log in.',
            'uid':          uid,
            'token':        token,
            'is_mobile':    is_mobile,
            # deep link the app can intercept
            'app_link':     f'librium://activated',
        })