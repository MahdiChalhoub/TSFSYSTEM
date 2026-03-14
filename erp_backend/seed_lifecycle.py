import django
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'erp_backend.settings')
django.setup()

from kernel.lifecycle.models import ApprovalPolicy, ApprovalPolicyStep
from django.apps import apps

Organization = apps.get_model('erp', 'Organization')

def seed_invoice_policy():
    for organization in Organization.objects.all():
        print(f"Seeding policy for organization: {organization.name}")
        policy, created = ApprovalPolicy.objects.get_or_create(
            organization=organization,
            txn_type='finance.invoice',
            defaults={
                'min_level_required': 2,
                'allow_bypass': True
            }
        )
        if not created:
            policy.min_level_required = 2
            policy.allow_bypass = True
            policy.save()

        # Step 1: Supervisor
        ApprovalPolicyStep.objects.update_or_create(
            policy=policy,
            level=1,
            defaults={'role_id': 'sales_invoice.approve.l1', 'required': True}
        )
        # Step 2: Accountant/Manager
        ApprovalPolicyStep.objects.update_or_create(
            policy=policy,
            level=2,
            defaults={'role_id': 'sales_invoice.approve.l2', 'required': True}
        )
    print("Done seeding lifecycle policies.")

if __name__ == "__main__":
    seed_invoice_policy()
