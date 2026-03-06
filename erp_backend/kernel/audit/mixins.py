"""
Audit Mixins

Mixin classes for automatic model change tracking.
"""

from django.db import models
from .audit_logger import audit_model_change


class AuditableModel(models.Model):
    """
    Abstract base class for models that need automatic audit tracking.

    Automatically tracks:
    - Create events
    - Update events (with field-level changes)
    - Delete events

    Usage:
        class Invoice(AuditableModel, TenantOwnedModel):
            invoice_number = models.CharField(max_length=20)
            total = models.DecimalField(max_digits=12, decimal_places=2)

        # Changes are automatically audited
        invoice = Invoice.objects.create(invoice_number='INV-001', total=100.00)
        # → Audit log: 'invoice.create'

        invoice.total = 150.00
        invoice.save()
        # → Audit log: 'invoice.update' with field change: total 100.00 → 150.00
    """

    class Meta:
        abstract = True

    # Exclude these fields from audit tracking
    AUDIT_EXCLUDE_FIELDS = ['id', 'created_at', 'updated_at', 'modified_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Store original values for change detection
        self._original_values = self._get_field_values() if self.pk else {}

    def save(self, *args, **kwargs):
        """Override save to track changes."""
        is_new = self.pk is None

        if is_new:
            # CREATE
            super().save(*args, **kwargs)
            self._audit_create()
        else:
            # UPDATE - detect changes
            current_values = self._get_field_values()
            changed_fields = self._detect_changes(self._original_values, current_values)

            super().save(*args, **kwargs)

            if changed_fields:
                self._audit_update(changed_fields)

            # Update original values for next save
            self._original_values = self._get_field_values()

    def delete(self, *args, **kwargs):
        """Override delete to track deletion."""
        self._audit_delete()
        return super().delete(*args, **kwargs)

    def _get_field_values(self):
        """Get all field values as a dict."""
        values = {}
        for field in self._meta.fields:
            if field.name not in self.AUDIT_EXCLUDE_FIELDS:
                values[field.name] = getattr(self, field.name)
        return values

    def _detect_changes(self, old_values, new_values):
        """Detect which fields changed."""
        changes = {}
        for field_name, new_value in new_values.items():
            old_value = old_values.get(field_name)
            if old_value != new_value:
                changes[field_name] = (old_value, new_value)
        return changes

    def _audit_create(self):
        """Audit creation."""
        model_name = self.__class__.__name__.lower()
        audit_model_change(
            action=f'{model_name}.create',
            instance=self,
            details={'action_type': 'create'}
        )

    def _audit_update(self, changed_fields):
        """Audit update with field changes."""
        model_name = self.__class__.__name__.lower()
        audit_model_change(
            action=f'{model_name}.update',
            instance=self,
            changed_fields=changed_fields,
            details={'action_type': 'update', 'fields_changed': list(changed_fields.keys())}
        )

    def _audit_delete(self):
        """Audit deletion."""
        model_name = self.__class__.__name__.lower()
        audit_model_change(
            action=f'{model_name}.delete',
            instance=self,
            details={'action_type': 'delete'}
        )


class SelectiveAuditMixin(models.Model):
    """
    Mixin for models that only want to audit specific fields.

    Usage:
        class Invoice(SelectiveAuditMixin, TenantOwnedModel):
            invoice_number = models.CharField(max_length=20)
            total = models.DecimalField(max_digits=12, decimal_places=2)
            notes = models.TextField()  # Don't audit this

            AUDIT_FIELDS = ['invoice_number', 'total', 'status']
    """

    class Meta:
        abstract = True

    AUDIT_FIELDS = []  # Override in subclass

    def _get_field_values(self):
        """Get only audited field values."""
        if not self.AUDIT_FIELDS:
            return super()._get_field_values()

        values = {}
        for field_name in self.AUDIT_FIELDS:
            if hasattr(self, field_name):
                values[field_name] = getattr(self, field_name)
        return values

# Alias for backward compatibility — apps import 'AuditLogMixin' 
AuditLogMixin = AuditableModel

