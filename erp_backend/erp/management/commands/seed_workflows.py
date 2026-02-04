# Seed Workflow Definitions Management Command

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Seeds workflow definitions for approval workflows'

    def handle(self, *args, **options):
        from erp.models_audit import WorkflowDefinition, ApprovalMode
        
        workflows = [
            {
                'name': 'Price Change Approval',
                'event_type': 'product.price_change',
                'description': 'Requires manager approval for price changes on products',
                'requires_approval': True,
                'approval_mode': ApprovalMode.PRE,  # Block until approved
                'priority_threshold': 5,
                'is_active': True,
            },
            {
                'name': 'Stock Adjustment Approval',
                'event_type': 'inventory.stock_adjustment',
                'description': 'Requires supervisor approval for manual stock adjustments',
                'requires_approval': True,
                'approval_mode': ApprovalMode.PRE,
                'priority_threshold': 5,
                'is_active': False,  # Disabled by default
            },
            {
                'name': 'Large Purchase Order Approval',
                'event_type': 'purchasing.po_create',
                'description': 'Requires approval for purchase orders above threshold',
                'requires_approval': True,
                'approval_mode': ApprovalMode.PRE,
                'priority_threshold': 8,  # High priority only
                'is_active': False,  # Disabled by default
            },
            {
                'name': 'Discount Application Audit',
                'event_type': 'pos.discount_applied',
                'description': 'Logs discount application for audit (POST mode)',
                'requires_approval': False,  # Just audit, no blocking
                'approval_mode': ApprovalMode.POST,
                'priority_threshold': 1,
                'is_active': True,
            },
            {
                'name': 'Journal Entry Posting',
                'event_type': 'finance.journal_post',
                'description': 'Requires approval for manual journal entries',
                'requires_approval': True,
                'approval_mode': ApprovalMode.PRE,
                'priority_threshold': 5,
                'is_active': False,  # Disabled by default
            },
        ]
        
        created_count = 0
        updated_count = 0
        
        for workflow_data in workflows:
            workflow, created = WorkflowDefinition.objects.update_or_create(
                event_type=workflow_data['event_type'],
                defaults=workflow_data
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"  Created: {workflow.name}"))
            else:
                updated_count += 1
                self.stdout.write(f"  Updated: {workflow.name}")
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f"Workflow seeding complete: {created_count} created, {updated_count} updated"
        ))
        
        # Show active workflows
        active = WorkflowDefinition.objects.filter(is_active=True)
        if active.exists():
            self.stdout.write('')
            self.stdout.write('Active workflows:')
            for w in active:
                mode = 'PRE (blocks)' if w.approval_mode == ApprovalMode.PRE else 'POST (audit)'
                self.stdout.write(f"  - {w.name}: {w.event_type} [{mode}]")
