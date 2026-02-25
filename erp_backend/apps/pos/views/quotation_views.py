from .base import (
    Response, action, transaction, Decimal,
    TenantModelViewSet, Product
)
from apps.pos.quotation_models import Quotation, QuotationLine
from apps.pos.serializers import (
    QuotationSerializer, QuotationLineSerializer
)

class QuotationViewSet(TenantModelViewSet):
    """Full CRUD for quotations + lifecycle actions."""
    queryset = Quotation.objects.select_related('contact', 'user', 'site').prefetch_related('lines').all()
    serializer_class = QuotationSerializer

    @action(detail=True, methods=['post'], url_path='add-line')
    def add_line(self, request, pk=None):
        """Add a product line to a quotation."""
        quotation = self.get_object()
        if quotation.status not in ('DRAFT', 'SENT'):
            return Response({'error': 'Cannot modify quotation in this status'}, status=400)

        product_id = request.data.get('product_id')
        quantity = Decimal(str(request.data.get('quantity', 1)))
        unit_price_ttc = request.data.get('unit_price_ttc')
        line_discount = Decimal(str(request.data.get('discount', 0)))

        try:
            product = Product.objects.get(id=product_id, organization=quotation.organization)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=404)

        price_ttc = Decimal(str(unit_price_ttc)) if unit_price_ttc else product.selling_price_ttc
        price_ht = product.selling_price_ht or (price_ttc / (1 + product.tva_rate / 100))
        tax_rate = product.tva_rate or Decimal('0.00')
        total_ht = (price_ht * quantity) - line_discount
        tax_amount = total_ht * tax_rate / 100
        total_ttc = total_ht + tax_amount

        line = QuotationLine.objects.create(
            quotation=quotation,
            product=product,
            quantity=quantity,
            unit_price_ht=price_ht,
            unit_price_ttc=price_ttc,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            discount=line_discount,
            total_ht=total_ht,
            total_ttc=total_ttc,
            organization=quotation.organization,
        )
        quotation.recalculate_totals()
        return Response(QuotationLineSerializer(line).data, status=201)

    @action(detail=True, methods=['delete'], url_path='remove-line/(?P<line_id>[0-9]+)')
    def remove_line(self, request, pk=None, line_id=None):
        """Remove a line from a quotation."""
        quotation = self.get_object()
        deleted, _ = QuotationLine.objects.filter(quotation=quotation, id=line_id).delete()
        if deleted:
            quotation.recalculate_totals()
            return Response({'success': True})
        return Response({'error': 'Line not found'}, status=404)

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status != 'DRAFT':
            return Response({'error': 'Only DRAFT quotations can be sent'}, status=400)
        quotation.status = 'SENT'
        quotation.save(update_fields=['status'])
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status not in ('DRAFT', 'SENT'):
            return Response({'error': 'Cannot accept this quotation'}, status=400)
        quotation.status = 'ACCEPTED'
        quotation.save(update_fields=['status'])
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        quotation = self.get_object()
        if quotation.status in ('CONVERTED',):
            return Response({'error': 'Cannot reject a converted quotation'}, status=400)
        quotation.status = 'REJECTED'
        quotation.save(update_fields=['status'])
        return Response(QuotationSerializer(quotation).data)

    @action(detail=True, methods=['post'], url_path='convert-to-order')
    def convert_to_order(self, request, pk=None):
        """Convert a quotation into a sale order."""
        quotation = self.get_object()
        if quotation.status not in ('ACCEPTED', 'SENT', 'DRAFT'):
            return Response({'error': 'Quotation must be DRAFT/SENT/ACCEPTED'}, status=400)
        if quotation.converted_order:
            return Response({'error': 'Already converted', 'order_id': quotation.converted_order_id}, status=400)

        from apps.pos.models import Order, OrderLine
        from apps.finance.models import TransactionSequence

        with transaction.atomic():
            ref = TransactionSequence.next_value(quotation.organization, 'SALE')
            order = Order.objects.create(
                organization=quotation.organization,
                type='SALE', status='DRAFT', ref_code=ref,
                contact=quotation.contact,
                user=request.user if request.user.is_authenticated else quotation.user,
                site=quotation.site,
                total_amount=quotation.total_ttc,
                tax_amount=quotation.total_tax,
                discount=quotation.discount,
                notes=f"From quotation {quotation.reference or quotation.id}",
                scope='OFFICIAL',
            )
            for line in quotation.lines.all():
                OrderLine.objects.create(
                    organization=quotation.organization,
                    order=order, product=line.product,
                    quantity=line.quantity,
                    unit_price=line.unit_price_ttc,
                    unit_cost_ht=line.unit_price_ht,
                    unit_cost_ttc=line.unit_price_ttc,
                    vat_amount=line.tax_amount,
                    total=line.total_ttc,
                    total_amount=line.total_ttc,
                    tax_rate=line.tax_rate,
                )
            quotation.status = 'CONVERTED'
            quotation.converted_order = order
            quotation.save(update_fields=['status', 'converted_order'])

        return Response({
            'success': True,
            'order_id': order.id,
            'ref_code': order.ref_code,
            'quotation': QuotationSerializer(quotation).data,
        })
