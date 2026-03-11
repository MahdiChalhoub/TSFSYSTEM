"""
Async Invoice PDF Generation — Celery Tasks
===========================================
Tasks for generating PDF invoices, receipts, and purchase orders
asynchronously via weasyprint (HTML → PDF pipeline).
"""
import os
import logging
from celery import shared_task
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


def _get_media_dir() -> str:
    """Ensure the documents directory exists and return its path."""
    path = os.path.join(settings.MEDIA_ROOT, 'documents')
    os.makedirs(path, exist_ok=True)
    return path


@shared_task(
    name='pos.tasks.generate_invoice_pdf',
    bind=True,
    max_retries=2,
    default_retry_delay=10,
)
def generate_invoice_pdf(self, doc_id: int):
    """
    Generate a PDF for a GeneratedDocument record.
    Fetches the order, renders an HTML template, converts via weasyprint,
    saves the file, and updates the GeneratedDocument status.

    Args:
        doc_id: PK of the GeneratedDocument (status=PENDING) to process.
    """
    from apps.pos.models import GeneratedDocument, Order, OrderLine
    from apps.pos.models import OrderLineTaxEntry

    try:
        doc = GeneratedDocument.objects.select_related('organization').get(pk=doc_id)
    except GeneratedDocument.DoesNotExist:
        logger.error(f"[generate_invoice_pdf] GeneratedDocument {doc_id} not found")
        return

    try:
        # ── 1. Fetch order data ──────────────────────────────────────
        order = Order.objects.select_related(
            'organization', 'contact'
        ).prefetch_related('lines').get(
            id=doc.order_id,
            tenant_id=doc.organization_id
        )
        lines = OrderLine.objects.filter(order=order).select_related('product')
        tax_entries = OrderLineTaxEntry.objects.filter(
            order_line__order=order
        ).values(
            'tax_type', 'tax_rate', 'tax_amount', 'order_line_id'
        )

        # Group tax entries by line
        tax_by_line: dict = {}
        for te in tax_entries:
            tax_by_line.setdefault(te['order_line_id'], []).append(te)

        # Build line context
        line_data = []
        for line in lines:
            line_data.append({
                'product_name': line.product.name if line.product else 'N/A',
                'quantity':     line.quantity,
                'unit_price':   float(line.unit_price or 0),
                'total':        float((line.unit_price or 0) * line.quantity),
                'taxes':        tax_by_line.get(line.id, []),
            })

        # ── 2. Render HTML template ──────────────────────────────────
        org = doc.organization
        context = {
            'org_name':     org.name,
            'org_address':  getattr(org, 'address', ''),
            'order':        order,
            'lines':        line_data,
            'generated_at': timezone.now(),
            'doc_type':     doc.doc_type,
        }
        html_str = render_to_string('pos/invoice_pdf.html', context)

        # ── 3. Convert HTML → PDF via weasyprint ─────────────────────
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=html_str, base_url=settings.MEDIA_ROOT).write_pdf()
        except Exception as wp_err:
            raise RuntimeError(f"weasyprint rendering failed: {wp_err}") from wp_err

        # ── 4. Save PDF file ─────────────────────────────────────────
        filename   = f"invoice_{doc.organization_id}_{doc.order_id}_{doc.pk}.pdf"
        media_dir  = _get_media_dir()
        file_path  = os.path.join(media_dir, filename)
        with open(file_path, 'wb') as f:
            f.write(pdf_bytes)

        rel_path = os.path.join('documents', filename)

        # ── 5. Mark document READY ────────────────────────────────────
        doc.status    = 'READY'
        doc.file_path = rel_path
        doc.save(update_fields=['status', 'file_path', 'updated_at'])

        logger.info(f"[generate_invoice_pdf] doc_id={doc_id} → {rel_path}")
        return {'status': 'READY', 'file_path': rel_path}

    except Exception as exc:
        logger.exception(f"[generate_invoice_pdf] doc_id={doc_id} failed: {exc}")
        try:
            doc.status    = 'FAILED'
            doc.error_msg = str(exc)[:1000]
            doc.save(update_fields=['status', 'error_msg', 'updated_at'])
        except Exception:
            pass
        # Retry if retries remain
        raise self.retry(exc=exc)
