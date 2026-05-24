from djoser.email import ActivationEmail

class CustomActivationEmail(ActivationEmail):
    # Points to the activation HTML file inside your templates
    template_name = 'activation.html' 

    def send(self, to, *args, **kwargs):
        # Force a subject line so Brevo/Anymail doesn't reject it
        self.subject = "Activate your Librium Account"
        super().send(to, *args, **kwargs)