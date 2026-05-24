# user/email.py
import threading
from djoser.email import ActivationEmail as DjoserActivationEmail


class ActivationEmail(DjoserActivationEmail):
    """
    Overrides Djoser's ActivationEmail to send in a background thread.

    Why: Gmail SMTP (and Brevo) can take 10–30 seconds to connect.
    Gunicorn's default worker timeout is 30s, so a synchronous send
    kills the worker and returns a 500 before the response reaches the user.

    With threading:
    - HTTP response returns immediately (registration succeeds instantly)
    - Email sends in the background without blocking anything
    - SEND_ACTIVATION_EMAIL = True stays in settings (instructor requirement)
    - is_active = False is still set by the model default (instructor flow works)
    """

    def get_context_data(self):
        context = super().get_context_data()
        context['subject'] = 'Activate Your Librium Account'
        return context
    
    def send(self, to, *args, **kwargs):
        thread = threading.Thread(
            target=super().send,
            args=(to,),
            kwargs=kwargs,
            daemon=True,   # daemon=True so thread doesn't block app shutdown
        )
        thread.start()