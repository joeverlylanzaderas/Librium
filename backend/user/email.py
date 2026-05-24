from djoser import email
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.core.mail import EmailMultiAlternatives


class ActivationEmail(email.ActivationEmail):
    subject = 'Activate Your Librium Account'
    template_name = 'activation.html'

    def send(self, to, *args, **kwargs):
        context = self.get_context_data()
        
        # Render HTML and plain text versions
        html_message = render_to_string(self.template_name, context)
        plain_message = strip_tags(html_message)
        
        # Create email with both HTML and plain text
        email_message = EmailMultiAlternatives(
            subject=self.subject,
            body=plain_message,
            from_email='lanzaderas.joeverlypearl04@gmail.com',
            to=[to],
        )
        email_message.attach_alternative(html_message, "text/html")
        
        email_message.send(fail_silently=False)