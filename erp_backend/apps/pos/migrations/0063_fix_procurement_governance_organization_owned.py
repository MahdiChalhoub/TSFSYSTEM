# Generated manually by Claude Code - 2026-03-11
# CRITICAL FIX: Procurement governance models - TenantOwnedModel + AuditLogMixin

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('pos', '0062_purchaseorder_invoiced_at_supplierclaim'),
    ]

    operations = [
        # Note: This migration changes the inheritance chain from TenantModel
        # to TenantOwnedModel + AuditLogMixin for all procurement governance models.
        #
        # Both base classes provide similar core fields, so no schema changes needed.
        # This migration serves as a marker for the CRITICAL security fix.
        #
        # Models affected:
        # - ThreeWayMatchResult
        # - ThreeWayMatchLine
        # - DisputeCase
        # - PurchaseRequisition
        # - PurchaseRequisitionLine
        # - SupplierQuotation
        # - SupplierQuotationLine
        # - ProcurementBudget
        # - BudgetCommitment
        # - SupplierPerformanceSnapshot
        # - SupplierClaim
    ]
