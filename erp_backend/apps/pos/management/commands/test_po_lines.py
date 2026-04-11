"""Quick diagnostic: check existing POs and their line counts, create test PO."""
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    help = 'Test PO line creation directly'

    def handle(self, *args, **options):
        import traceback
        from decimal import Decimal
        from apps.pos.models import PurchaseOrder, PurchaseOrderLine
        from erp.models import Organization
        from apps.crm.models import Contact
        from apps.inventory.models import Product

        org = Organization.objects.first()
        if not org:
            self.stdout.write("No orgs!")
            return
        self.stdout.write(f"Org: {org.id}")

        # Show existing POs and line counts
        self.stdout.write("\n=== EXISTING POs ===")
        for po in PurchaseOrder.original_objects.order_by('-id')[:10]:
            lc = PurchaseOrderLine.original_objects.filter(order=po).count()
            self.stdout.write(f"  PO {po.id} ({po.po_number}): {lc} lines, supplier={po.supplier_id}, total={po.total_amount}")

        # Get a supplier
        supplier = Contact.original_objects.filter(organization=org).first()
        if not supplier:
            self.stdout.write("No contacts!")
            return
        self.stdout.write(f"\nFirst contact: {supplier.id} - {supplier.name} (type={supplier.type})")

        # Get a product
        product = Product.original_objects.filter(organization=org).first()
        if not product:
            self.stdout.write("No products!")
            return
        self.stdout.write(f"First product: {product.id} - {product.name}")

        # Create test PO
        self.stdout.write("\n=== CREATE TEST PO ===")
        try:
            po = PurchaseOrder(
                organization=org,
                supplier=supplier,
                supplier_name=supplier.name,
                status='DRAFT',
            )
            po.save()
            self.stdout.write(f"PO created: {po.id} / {po.po_number}")
        except Exception as e:
            self.stdout.write(f"PO FAILED: {e}")
            traceback.print_exc()
            return

        # Create test line
        self.stdout.write("\n=== CREATE TEST LINE ===")
        try:
            line = PurchaseOrderLine(
                order=po,
                organization=org,
                product=product,
                quantity=Decimal('5'),
                unit_price=Decimal('100.00'),
                line_total=Decimal('500.00'),
            )
            line.save()
            self.stdout.write(f"Line OK: id={line.id}, product={line.product_id}, qty={line.quantity}")
        except Exception as e:
            self.stdout.write(f"Line FAILED: {e}")
            traceback.print_exc()

        # Verify
        lc = PurchaseOrderLine.original_objects.filter(order=po).count()
        self.stdout.write(f"\nVerify: PO {po.po_number} has {lc} lines")

        # Cleanup
        po.delete()
        self.stdout.write("Cleaned up test PO. Done!")
