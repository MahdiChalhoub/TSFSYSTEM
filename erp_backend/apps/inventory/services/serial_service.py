from decimal import Decimal
from django.core.exceptions import ValidationError

class SerialService:
    @staticmethod
    def register_serial_exit(organization, product, warehouse, serial_number, reference, user_name=None):
        from apps.inventory.models import ProductSerial, SerialLog
        serial = ProductSerial.objects.filter(
            tenant=organization,
            product=product,
            serial_number=serial_number,
            status='AVAILABLE'
        ).first()
        
        if not serial:
            raise ValidationError(f"Serial {serial_number} not available in inventory for {product.name}.")
            
        serial.status = 'SOLD'
        serial.warehouse = None
        serial.save()
        
        SerialLog.objects.create(
            tenant=organization,
            serial=serial,
            action='SALE',
            reference=reference,
            user_name=user_name
        )

    @staticmethod
    def register_serial_entry(organization, product, warehouse, serial_number, reference, cost_price=Decimal('0'), user_name=None):
        from apps.inventory.models import ProductSerial, SerialLog
        serial, created = ProductSerial.objects.get_or_create(
            tenant=organization,
            product=product,
            serial_number=serial_number,
            defaults={
                'status': 'AVAILABLE',
                'warehouse': warehouse,
                'cost_price': cost_price
            }
        )
        
        if not created:
            if serial.status == 'AVAILABLE':
                raise ValidationError(f"Serial {serial_number} already exists in inventory (Warehouse: {serial.warehouse.name}).")
            serial.status = 'AVAILABLE'
            serial.warehouse = warehouse
            serial.cost_price = cost_price
            serial.save()
            
        SerialLog.objects.create(
            tenant=organization,
            serial=serial,
            action='PURCHASE',
            reference=reference,
            warehouse=warehouse,
            user_name=user_name
        )
