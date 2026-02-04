from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from .models import SubscriptionPlan, SubscriptionPayment, Organization
from .services import ConfigurationService

class SubscriptionService:
    @staticmethod
    def activate_plan(organization, plan, billing_cycle='MONTHLY'):
        """
        Activates a subscription plan for an organization.
        """
        organization.current_plan = plan
        
        days = 30 if billing_cycle == 'MONTHLY' else 365
        organization.plan_expiry_at = timezone.now() + timedelta(days=days)
        organization.is_read_only = False
        organization.save()
        
        return organization

    @staticmethod
    def record_payment(organization, plan, amount, billing_cycle='MONTHLY', payment_method='CREDIT_CARD'):
        """
        Records a subscription payment and generates the financial ledger entry in the SaaS Provider's books.
        """
        from .models import SubscriptionPayment, Contact
        from apps.finance.services import LedgerService
        
        # 1. Create Payment Record (in Client's context? Or SaaS context? Usually Client's or System Global)
        # We store SubscriptionPayment linked to the organization, so it is in the organization's or global schema.
        # Given models.py, SubscriptionPayment is a global model? Checks: No, it has FK to Organization.
        # But for financial tracking, the MONEY goes to 'saas'.
        
        payment = SubscriptionPayment.objects.create(
            organization=organization,
            plan=plan,
            amount=amount,
            billing_cycle=billing_cycle,
            status='COMPLETED',
            paid_at=timezone.now()
        )
        
        # 2. Financial Ledger Entry (SaaS Provider Context)
        # We must switch context to 'saas' org to book revenue
        saas_org = Organization.objects.filter(slug='saas').first()
        if not saas_org:
            return payment # Skip if no master org
            
        # Find the linked "Customer" contact for this organization
        billing_contact_id = organization.billing_contact_id
        
        if not billing_contact_id:
            # Fallback or error?
            pass
            
        rules = ConfigurationService.get_posting_rules(saas_org)
        
        # Accounts (SaaS chart of accounts)
        bank_account_id = rules.get('sales', {}).get('bank') or rules.get('sales', {}).get('receivable') # Simplification
        revenue_account_id = rules.get('sales', {}).get('revenue')
        
        # If we can't find accounts, we can't post.
        if bank_account_id and revenue_account_id:
             LedgerService.create_journal_entry(
                organization=saas_org,
                transaction_date=timezone.now(),
                description=f"Subscription Payment: {organization.name} - {plan.name}",
                reference=f"SUB-{payment.id}",
                status='POSTED',
                scope='OFFICIAL',
                lines=[
                    {"account_id": bank_account_id, "debit": amount, "credit": 0, "description": "Payment Received"},
                    {"account_id": revenue_account_id, "debit": 0, "credit": amount, "description": "Subscription Revenue"}
                ]
             )
             # Note: If we use 'receivable' instead of bank, we might want to tag the Contact.
             # Current LedgerService.create_journal_entry doesn't support tagging Contact on line directly 
             # unless we enhance JournalEntryLine model or use Sub-Accounts.
             # For now, Description contains context.
             
        # 3. Update Payment record with reference?
        # payment.journal_entry_id = ... (if we returned it)
        
        return payment

    @staticmethod
    def check_feature_access(organization, feature_code):
        """
        Checks if an organization has access to a specific feature based on their plan.
        """
        if organization.is_read_only:
            # Maybe allow read-only features? 
            return False
            
        if not organization.current_plan:
            return False
            
        # Check plan features
        features = organization.current_plan.features or {}
        return features.get(feature_code, False)

    @staticmethod
    def record_data_usage(organization, bytes_used):
        """
        Increments the recorded data usage for an organization.
        """
        organization.data_usage_bytes += bytes_used
        organization.save()
        
        # Check against limits
        if organization.current_plan:
            limits = organization.current_plan.limits or {}
            max_bytes = limits.get('storage_bytes')
            if max_bytes and organization.data_usage_bytes > max_bytes:
                # Trigger warning or restriction
                pass

    @staticmethod
    def process_expiries():
        """
        Scans all organizations and restricts those with expired plans.
        To be called by a management command or task scheduler.
        """
        now = timezone.now()
        expired_orgs = Organization.objects.filter(
            plan_expiry_at__lt=now,
            is_read_only=False
        )
        
        count = expired_orgs.update(is_read_only=True)
        return count

    @staticmethod
    def calculate_refund(payment):
        """
        Calculates a pro-rated refund for a cancelled plan.
        """
        if payment.status != 'COMPLETED':
            return Decimal('0.00')
            
        now = timezone.now()
        # Simplistic pro-rating: (Expiry - Now) / (Expiry - PaidAt) * Amount
        # Actual implementation should use precise date math.
        # This is a placeholder for the logic.
        return payment.amount * Decimal('0.5') # Placeholder
