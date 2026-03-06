from django.core.management.base import BaseCommand
from kernel.tenancy.models import Organization
from kernel.lifecycle.models import ApprovalPolicy, ApprovalPolicyStep
from django.db import transaction

class Command(BaseCommand):
    help = 'Seeds default approval policy for Sales Invoices'

    def add_arguments(self, parser):
        parser.add_argument('--tenant_id', type=int, help='Specific tenant ID to seed')

    def handle(self, *args, **options):
        tenant_id = options.get('tenant_id')
        if tenant_id:
            orgs = Organization.objects.filter(id=tenant_id)
        else:
            orgs = Organization.objects.all()

        for org in orgs:
            self.stdout.write(f"Seeding Invoice Policy for Org: {org.name}...")
            with transaction.atomic():
                policy, created = ApprovalPolicy.objects.get_or_create(
                    tenant=org,
                    txn_type='finance.invoice',
                    defaults={
                        'min_level_required': 2,
                        'allow_bypass': False
                    }
                )
                
                # Level 1: Verification
                ApprovalPolicyStep.objects.update_or_create(
                    policy=policy,
                    level=1,
                    defaults={
                        'role_id': 'finance.verify_invoice',
                        'required': True
                    }
                )
                
                # Level 2: Approval
                ApprovalPolicyStep.objects.update_or_create(
                    policy=policy,
                    level=2,
                    defaults={
                        'role_id': 'finance.approve_invoice',
                        'required': True
                    }
                )
            
            self.stdout.write(self.style.SUCCESS(f"Successfully seeded policy for {org.name}"))
