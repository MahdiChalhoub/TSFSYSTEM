from .base import (
    status, Response, action, viewsets, get_current_tenant_id
)
from apps.finance.invoice_models import Invoice

class EInvoiceViewSet(viewsets.ViewSet):
    """Manual e-invoice submission, status check, and QR code retrieval."""

    @action(detail=False, methods=['post'], url_path='submit/(?P<invoice_id>[^/.]+)')
    def submit(self, request, invoice_id=None):
        """
        Submit an invoice for e-invoicing certification.
        Auto-detects ZATCA (via ZATCAConfig) or FNE (via country_code).
        Supports ?provider=zatca|fne to force a specific provider.
        """
        from apps.finance.einvoicing_service import ZATCAService, FNEService
        org_id = get_current_tenant_id()

        try:
            invoice = Invoice.objects.get(pk=invoice_id, tenant_id=org_id)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=404)

        provider = request.query_params.get('provider', '').lower()
        clearance = request.data.get('clearance', True)

        # Auto-detect provider
        if not provider:
            from apps.finance.zatca_config import ZATCAConfig
            if ZATCAConfig.objects.filter(tenant_id=org_id, is_active=True).exists():
                provider = 'zatca'
            else:
                org = invoice.organization
                country_code = getattr(org, 'country_code', None) or org.settings.get('country_code', '')
                if country_code in ('LB', 'LBN', 'CI', 'CIV'):
                    provider = 'fne'

        if provider == 'zatca':
            service = ZATCAService(str(org_id))
            result = service.submit_for_clearance(invoice, clearance=clearance)
        elif provider == 'fne':
            service = FNEService(str(org_id))
            result = service.submit_for_certification(invoice)
        else:
            return Response({
                'error': 'E-invoicing not configured. Create a ZATCAConfig or set country_code in org settings.'
            }, status=400)

        return Response(result)

    @action(detail=False, methods=['get'], url_path='status/(?P<invoice_id>[^/.]+)')
    def status(self, request, invoice_id=None):
        """Get e-invoicing status of an invoice."""
        org_id = get_current_tenant_id()
        try:
            invoice = Invoice.objects.get(pk=invoice_id, tenant_id=org_id)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=404)

        return Response({
            'invoice_id': str(invoice.id),
            'fne_status': invoice.fne_status,
            'fne_reference': invoice.fne_reference,
            'fne_token': invoice.fne_token,
            'fne_error': invoice.fne_error,
            'invoice_hash': invoice.invoice_hash,
            'previous_invoice_hash': invoice.previous_invoice_hash,
            'zatca_clearance_id': invoice.zatca_clearance_id,
        })

    @action(detail=False, methods=['get'], url_path='qr/(?P<invoice_id>[^/.]+)')
    def qr_code(self, request, invoice_id=None):
        """Get QR code data for an e-invoice."""
        from apps.finance.einvoicing_service import ZATCAService
        org_id = get_current_tenant_id()
        try:
            invoice = Invoice.objects.get(pk=invoice_id, tenant_id=org_id)
        except Invoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=404)

        try:
            service = ZATCAService(str(invoice.organization_id))
            qr_data = service.generate_qr_code_data(invoice)
            return Response({'qr_data': qr_data})
        except Exception as e:
            return Response({'error': str(e)}, status=500)
