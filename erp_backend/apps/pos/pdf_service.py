"""
PDF Generation Service
Uses xhtml2pdf to render HTML templates into PDF documents.
"""
import io
from django.template.loader import get_template
from xhtml2pdf import pisa
from django.conf import settings

class PDFService:
    @staticmethod
    def render_to_pdf(template_src, context_dict={}):
        """Renders an HTML template into a PDF byte stream."""
        template = get_template(template_src)
        html = template.render(context_dict)
        result = io.BytesIO()
        
        # Link callback for relative paths (images, fonts, etc.)
        def link_callback(uri, rel):
            """
            Convert HTML URIs to absolute system paths so xhtml2pdf can access them
            """
            import os
            # use internal path
            if uri.startswith(settings.STATIC_URL):
                path = os.path.join(settings.STATIC_ROOT, uri.replace(settings.STATIC_URL, ""))
            elif uri.startswith(settings.MEDIA_URL):
                path = os.path.join(settings.MEDIA_ROOT, uri.replace(settings.MEDIA_URL, ""))
            else:
                return uri
            
            # make sure file exists
            if not os.path.isfile(path):
                return uri
            return path

        pdf = pisa.pisaDocument(io.BytesIO(html.encode("UTF-8")), result, link_callback=link_callback)
        if not pdf.err:
            return result.getvalue()
        return None

    @staticmethod
    def get_invoice_context(order):
        """Prepares the context data for the invoice template."""
        return {
            'order': order,
            'lines': order.lines.all(),
            'organization': order.organization,
            'contact': order.contact,
            'total': float(order.total_amount),
            'subtotal': float(order.total_amount - order.tax_amount),
            'tax': float(order.tax_amount),
            'discount': float(order.discount),
            'date': order.created_at.strftime('%d/%m/%Y') if order.created_at else '',
            'currency': 'XOF', # Default
        }
