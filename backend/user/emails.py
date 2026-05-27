#  user/emails.py
from djoser import email
from django.conf import settings
from django.core.mail import EmailMultiAlternatives


class ActivationEmail(email.ActivationEmail):
    template_name = None  # Disable template lookup

    def send(self, to, *args, **kwargs):
        # Clean the recipient list
        if isinstance(to, str):
            recipient_list = [to]
        elif isinstance(to, list):
            recipient_list = [str(e).strip("[]'\" ") for e in to if e]
        else:
            recipient_list = list(to) if to else []

        # Get activation context from Djoser
        context = self.get_context_data()
        uid = context.get('uid')
        token = context.get('token')
        
        # Build activation URL
        protocol = settings.DJOSER.get('PROTOCOL', 'https')
        domain = settings.DOMAIN
        activation_url = f"{protocol}://{domain}/activate/{uid}/{token}"
        
        # Email content
        subject = "Activate Your Librium Account"
        body = f"""
Hello,

Thank you for registering with Librium Library System.

Please click the link below to activate your account:

{activation_url}

This link expires in 24 hours.

If you did not request this, please ignore this email.

Best regards,
Librium Support Team
"""
        
        # Send email directly
        from_email = settings.DEFAULT_FROM_EMAIL
        email_msg = EmailMultiAlternatives(subject, body.strip(), from_email, recipient_list)
        email_msg.send(fail_silently=False)