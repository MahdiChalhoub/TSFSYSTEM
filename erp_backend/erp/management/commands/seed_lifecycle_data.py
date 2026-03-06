"""
Management command to seed default transaction types and policies.
Usage: python manage.py seed_lifecycle_data
"""
from django.core.management.base import BaseCommand
from erp.models import Organization, TransactionType, TransactionVerificationPolicy


class Command(BaseCommand):
    help = 'Seed default transaction types and verification policies for all organizations'

    def handle(self, *args, **options):
        """Seed default lifecycle data for each organization."""
        
        # Default transaction types to create
        transaction_types = [
            {
                'code': 'SALES_INVOICE',
                'name': 'Sales Invoice',
                'description': 'Customer invoice requiring approval',
            },
            {
                'code': 'REFUND',
                'name': 'Refund',
                'description': 'Customer refund transaction',
            },
            {
                'code': 'PRICE_CHANGE',
                'name': 'Price Change',
                'description': 'Manual price adjustment on invoice/order',
            },
            {
                'code': 'STOCK_ADJUSTMENT',
                'name': 'Stock Adjustment',
                'description': 'Inventory stock level adjustment',
            },
            {
                'code': 'JOURNAL_ENTRY',
                'name': 'Journal Entry',
                'description': 'Manual accounting journal entry',
            },
            {
                'code': 'PAYMENT',
                'name': 'Payment',
                'description': 'Payment transaction',
            },
        ]
        
        organizations = Organization.objects.all()
        self.stdout.write(f'Processing {organizations.count()} organizations...')
        
        created_types = 0
        created_policies = 0
        
        for org in organizations:
            for tt_data in transaction_types:
                # Create or get transaction type
                tt, created = TransactionType.objects.get_or_create(
                    organization=org,
                    code=tt_data['code'],
                    defaults={
                        'name': tt_data['name'],
                        'description': tt_data['description'],
                        'is_active': True,
                    }
                )
                
                if created:
                    created_types += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'  Created transaction type: {org.name} / {tt.code}'
                    ))
                
                # Create default policy if it doesn't exist
                policy, policy_created = TransactionVerificationPolicy.objects.get_or_create(
                    organization=org,
                    transaction_type=tt,
                    defaults={
                        'is_controlled': True,
                        'mode': 'SIMPLE',
                        'default_levels': 1,
                        'allow_override': False,
                        'is_active': True,
                    }
                )
                
                if policy_created:
                    created_policies += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'  Created policy for: {org.name} / {tt.code}'
                    ))
        
        self.stdout.write(self.style.SUCCESS(
            f'\nSeeding complete!'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'  Transaction types created: {created_types}'
        ))
        self.stdout.write(self.style.SUCCESS(
            f'  Policies created: {created_policies}'
        ))
