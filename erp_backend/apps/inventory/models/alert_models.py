"""
Stock Alert Models
==================
StockAlert model for tracking low-stock, overstock, and reorder conditions.
Alert service scans inventory and creates alerts when thresholds are breached.

Integrates with:
  - Product model (apps/inventory/models.py) — reorder fields
  - Inventory model (apps/inventory/models.py) — current stock levels
  - Warehouse model (apps/inventory/models.py) — location-specific alerts
"""
from django.db import models
from django.utils import timezone
from decimal import Decimal
from kernel.tenancy.models import TenantOwnedModel
from kernel.audit.mixins import AuditLogMixin
from kernel.events import emit_event


# =============================================================================
# STOCK ALERT
# =============================================================================

class StockAlert(AuditLogMixin, TenantOwnedModel):
    """
    Alert generated when stock levels breach configured thresholds.
    Created by the Stock Alert Service (manual trigger or Celery periodic task).
    """
    ALERT_TYPES = (
        ('LOW_STOCK', 'Low Stock'),
        ('OUT_OF_STOCK', 'Out of Stock'),
        ('OVERSTOCK', 'Overstock'),
        ('REORDER', 'Reorder Point Reached'),
        ('EXPIRY_WARNING', 'Expiry Warning'),
    )
    SEVERITY_CHOICES = (
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('CRITICAL', 'Critical'),
    )
    STATUS_CHOICES = (
        ('ACTIVE', 'Active'),
        ('ACKNOWLEDGED', 'Acknowledged'),
        ('RESOLVED', 'Resolved'),
        ('SNOOZED', 'Snoozed'),
    )

    product = models.ForeignKey('inventory.Product', on_delete=models.CASCADE, related_name='stock_alerts')
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE, null=True, blank=True,
                                   related_name='stock_alerts',
                                   help_text='Specific warehouse, or null for org-wide alert')

    alert_type = models.CharField(max_length=20, choices=ALERT_TYPES)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='WARNING')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='ACTIVE')

    # Snapshot at alert time
    current_stock = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                         help_text='Stock level when alert was created')
    threshold = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                     help_text='Threshold that was breached')
    reorder_qty = models.DecimalField(max_digits=15, decimal_places=2, default=Decimal('0.00'),
                                       help_text='Suggested reorder quantity')

    # Message
    message = models.TextField(null=True, blank=True)

    # Resolution
    acknowledged_by = models.ForeignKey('erp.User', on_delete=models.SET_NULL, null=True, blank=True,
                                         related_name='acknowledged_alerts')
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolution_note = models.TextField(null=True, blank=True)
    snoozed_until = models.DateTimeField(null=True, blank=True)

    # Link to PO (if a purchase order was created to resolve)
    purchase_order = models.ForeignKey('pos.PurchaseOrder', on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='stock_alerts')

    # Audit
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)

    class Meta:
        db_table = 'stock_alert'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['tenant', 'status']),
            models.Index(fields=['tenant', 'alert_type']),
            models.Index(fields=['tenant', 'product']),
        ]

    def __str__(self):
        return f"{self.alert_type}: {self.product} ({self.current_stock}/{self.threshold})"

    def acknowledge(self, user):
        """Mark alert as acknowledged."""
        self.status = 'ACKNOWLEDGED'
        self.acknowledged_by = user
        self.acknowledged_at = timezone.now()
        self.save()

    def resolve(self, note=None):
        """Mark alert as resolved."""
        self.status = 'RESOLVED'
        self.resolved_at = timezone.now()
        self.resolution_note = note
        self.save()

    def snooze(self, until):
        """Snooze alert until a given datetime."""
        self.status = 'SNOOZED'
        self.snoozed_until = until
        self.save()


# =============================================================================
# STOCK ALERT SERVICE — Scanning Logic
# =============================================================================

class StockAlertService:
    """
    Service that scans inventory and creates StockAlert records
    when thresholds are breached.
    
    Usage:
        service = StockAlertService(organization)
        alerts = service.scan_all()
    """
    
    def __init__(self, tenant):
        self.tenant = tenant

    def scan_all(self):
        """Scan all products and create alerts for threshold breaches."""
        from apps.inventory.models import Product, Inventory
        
        products = Product.objects.filter(
            tenant=self.tenant,
            is_active=True
        ).select_related('category', 'unit')

        created_alerts = []
        for product in products:
            alerts = self._check_product(product)
            created_alerts.extend(alerts)
        
        return created_alerts

    def _check_product(self, product):
        """Check a single product against all thresholds."""
        from apps.inventory.models import Inventory
        from django.db.models import Sum

        alerts = []
        
        # Get total stock across all warehouses
        total_stock = Inventory.objects.filter(
            tenant=self.tenant,
            product=product
        ).aggregate(total=Sum('quantity'))['total'] or Decimal('0.00')

        # 1. Out of Stock
        if total_stock <= 0:
            alert = self._create_alert_if_not_exists(
                product=product,
                alert_type='OUT_OF_STOCK',
                severity='CRITICAL',
                current_stock=total_stock,
                threshold=Decimal('0'),
                reorder_qty=getattr(product, 'reorder_quantity', Decimal('0')) or product.min_stock_level * 2,
                message=f"{product.name} is OUT OF STOCK across all warehouses."
            )
            if alert:
                alerts.append(alert)

        # 2. Low Stock (below min_stock_level)
        elif total_stock <= product.min_stock_level:
            alert = self._create_alert_if_not_exists(
                product=product,
                alert_type='LOW_STOCK',
                severity='WARNING',
                current_stock=total_stock,
                threshold=Decimal(str(product.min_stock_level)),
                reorder_qty=getattr(product, 'reorder_quantity', Decimal('0')) or product.min_stock_level,
                message=f"{product.name} is below minimum stock level. Current: {total_stock}, Min: {product.min_stock_level}"
            )
            if alert:
                alerts.append(alert)

        # 3. Reorder Point
        reorder_point = getattr(product, 'reorder_point', None)
        if reorder_point and total_stock <= reorder_point and total_stock > 0:
            alert = self._create_alert_if_not_exists(
                product=product,
                alert_type='REORDER',
                severity='INFO',
                current_stock=total_stock,
                threshold=reorder_point,
                reorder_qty=getattr(product, 'reorder_quantity', Decimal('0')) or product.min_stock_level,
                message=f"{product.name} has reached reorder point. Current: {total_stock}, Reorder at: {reorder_point}"
            )
            if alert:
                alerts.append(alert)

        # 4. Overstock
        max_stock = getattr(product, 'max_stock_level', None)
        if max_stock and total_stock > max_stock:
            alert = self._create_alert_if_not_exists(
                product=product,
                alert_type='OVERSTOCK',
                severity='INFO',
                current_stock=total_stock,
                threshold=max_stock,
                message=f"{product.name} exceeds maximum stock level. Current: {total_stock}, Max: {max_stock}"
            )
            if alert:
                alerts.append(alert)

        return alerts

    def _create_alert_if_not_exists(self, product, alert_type, severity, current_stock,
                                     threshold, message, reorder_qty=Decimal('0')):
        """Create alert only if no active alert of same type exists for this product."""
        existing = StockAlert.objects.filter(
            tenant=self.tenant,
            product=product,
            alert_type=alert_type,
            status__in=['ACTIVE', 'ACKNOWLEDGED']
        ).exists()

        if existing:
            return None

        alert = StockAlert.objects.create(
            tenant=self.tenant,
            product=product,
            alert_type=alert_type,
            severity=severity,
            current_stock=current_stock,
            threshold=threshold,
            reorder_qty=reorder_qty,
            message=message
        )

        # ── Auto-Task: fire inventory triggers ──
        try:
            if alert_type in ('LOW_STOCK', 'REORDER'):
                emit_event(
                    event_type='inventory.low_stock',
                    payload={
                        'product_id': product.id,
                        'product_name': str(product),
                        'amount': float(current_stock),
                        'threshold': float(threshold),
                        'reorder_qty': float(reorder_qty),
                        'tenant_id': self.tenant.id if hasattr(self.tenant, 'id') else self.tenant
                    },
                    aggregate_type='inventory.product',
                    aggregate_id=product.id
                )
            elif alert_type == 'OUT_OF_STOCK':
                emit_event(
                    event_type='inventory.negative_stock',
                    payload={
                        'product_id': product.id,
                        'product_name': str(product),
                        'amount': float(current_stock),
                        'tenant_id': self.tenant.id if hasattr(self.tenant, 'id') else self.tenant
                    },
                    aggregate_type='inventory.product',
                    aggregate_id=product.id
                )
        except Exception:
            pass

        return alert
