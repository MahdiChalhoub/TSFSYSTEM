from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
from .models import SubscriptionPlan, SubscriptionPayment, Organization

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
        
        # In a real scenario, this would create a SubscriptionPayment record
        # and trigger ledger entries.
        return organization

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
