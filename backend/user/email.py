# user/email.py
import threading
from djoser.email import ActivationEmail as DjoserActivationEmail


class ActivationEmail(DjoserActivationEmail):
    """
    Overrides Djoser's ActivationEmail to send in a background thread.
    Also explicitly sets the subject line required by Brevo API.
    """
    subject = 'Activate Your Librium Account'

    def send(self, to, *args, **kwargs):
        thread = threading.Thread(
            target=super().send,
            args=(to,),
            kwargs=kwargs,
            daemon=True,
        )
        thread.start()