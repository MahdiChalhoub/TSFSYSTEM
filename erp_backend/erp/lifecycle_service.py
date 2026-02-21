"""
Transaction Lifecycle Service
Provides lock / unlock / verify / unverify / confirm actions for any VerifiableModel.
"""
from django.utils import timezone
from django.core.exceptions import ValidationError
from erp.models import (
    TransactionVerificationConfig, TransactionStatusLog, VerifiableModel
)


class TransactionLifecycleService:
    """
    Usage:
        TransactionLifecycleService.lock(instance, transaction_type, user)
        TransactionLifecycleService.verify(instance, transaction_type, user)
    """

    # ─── Seeding defaults ──────────────────────────────────────────
    DEFAULT_CONFIG = {
        'JOURNAL_ENTRY':    {'required_levels': 1, 'amount_threshold': 10000, 'threshold_levels': 2},
        'VOUCHER':          {'required_levels': 1, 'amount_threshold': 50000, 'threshold_levels': 3},
        'INVOICE':          {'required_levels': 1, 'amount_threshold': 25000, 'threshold_levels': 2},
        'SALES_INVOICE':    {'required_levels': 1, 'amount_threshold': None, 'threshold_levels': None},
        'PURCHASE_INVOICE': {'required_levels': 1, 'amount_threshold': None, 'threshold_levels': None},
        'PAYMENT':          {'required_levels': 1, 'amount_threshold': 10000, 'threshold_levels': 2},
        'PAYMENT_IN':       {'required_levels': 1, 'amount_threshold': None, 'threshold_levels': None},
        'PAYMENT_OUT':      {'required_levels': 1, 'amount_threshold': None, 'threshold_levels': None},
        'REFUND':           {'required_levels': 1, 'amount_threshold': None, 'threshold_levels': None},
        'STOCK_ADJUSTMENT': {'required_levels': 2, 'amount_threshold': None, 'threshold_levels': None},
        'STOCK_TRANSFER':   {'required_levels': 1, 'amount_threshold': None, 'threshold_levels': None},
        'POS_ORDER':        {'required_levels': 1, 'amount_threshold': None, 'threshold_levels': None},
        'REGISTER_SESSION': {'required_levels': 1, 'amount_threshold': None, 'threshold_levels': None},
    }

    @classmethod
    def seed_defaults(cls, organization):
        """Create default verification config for an organization if missing."""
        for txn_type, defaults in cls.DEFAULT_CONFIG.items():
            TransactionVerificationConfig.objects.get_or_create(
                organization=organization,
                transaction_type=txn_type,
                defaults=defaults
            )

    # ─── Helpers ───────────────────────────────────────────────────
    @classmethod
    def _get_config(cls, organization, transaction_type):
        try:
            return TransactionVerificationConfig.objects.get(
                organization=organization,
                transaction_type=transaction_type
            )
        except TransactionVerificationConfig.DoesNotExist:
            return None

    @classmethod
    def _log(cls, transaction_type, transaction_id, action, level, user, comment=None, ip_address=None):
        TransactionStatusLog.objects.create(
            transaction_type=transaction_type,
            transaction_id=transaction_id,
            action=action,
            level=level,
            performed_by=user,
            comment=comment,
            ip_address=ip_address,
        )

    @classmethod
    def get_history(cls, transaction_type, transaction_id):
        """Returns the full lifecycle audit trail for a transaction."""
        return TransactionStatusLog.objects.filter(
            transaction_type=transaction_type,
            transaction_id=transaction_id
        ).select_related('performed_by').order_by('-performed_at')

    # ─── Actions ───────────────────────────────────────────────────

    @classmethod
    def lock(cls, instance, transaction_type, user, comment=None, ip_address=None):
        """
        OPEN → LOCKED
        Freezes the transaction for review.
        """
        if instance.lifecycle_status != 'OPEN':
            raise ValidationError(f"Cannot lock: current status is {instance.lifecycle_status}")

        instance.lifecycle_status = 'LOCKED'
        instance.locked_by = user
        instance.locked_at = timezone.now()
        instance.save(update_fields=['lifecycle_status', 'locked_by', 'locked_at'])

        cls._log(transaction_type, instance.pk, 'LOCK', 0, user, comment, ip_address)
        return instance

    @classmethod
    def unlock(cls, instance, transaction_type, user, comment, ip_address=None):
        """
        LOCKED → OPEN
        Reopens for editing. Requires mandatory comment explaining why.
        """
        if instance.lifecycle_status != 'LOCKED':
            raise ValidationError(f"Cannot unlock: current status is {instance.lifecycle_status}")
        if not comment:
            raise ValidationError("Comment is mandatory when unlocking a transaction.")

        instance.lifecycle_status = 'OPEN'
        instance.locked_by = None
        instance.locked_at = None
        instance.current_verification_level = 0
        instance.save(update_fields=[
            'lifecycle_status', 'locked_by', 'locked_at', 'current_verification_level'
        ])

        cls._log(transaction_type, instance.pk, 'UNLOCK', 0, user, comment, ip_address)
        return instance

    @classmethod
    def verify(cls, instance, transaction_type, user, comment=None, ip_address=None):
        """
        LOCKED/VERIFIED → VERIFIED (next level) or CONFIRMED (final level)
        Advances the verification chain by one level.
        If all required levels are reached, auto-confirms.
        """
        if instance.lifecycle_status not in ('LOCKED', 'VERIFIED'):
            raise ValidationError(
                f"Cannot verify: current status is {instance.lifecycle_status}. "
                f"Transaction must be LOCKED or already VERIFIED."
            )

        # Get required levels from config
        config = cls._get_config(instance.organization, transaction_type)
        amount = getattr(instance, 'amount', None)
        required = config.get_required_levels(amount) if config else 1

        next_level = instance.current_verification_level + 1

        if next_level >= required:
            # Final verification → CONFIRMED
            instance.lifecycle_status = 'CONFIRMED'
            instance.current_verification_level = next_level
            instance.save(update_fields=['lifecycle_status', 'current_verification_level'])
            cls._log(transaction_type, instance.pk, 'CONFIRM', next_level, user, comment, ip_address)
        else:
            # Intermediate verification
            instance.lifecycle_status = 'VERIFIED'
            instance.current_verification_level = next_level
            instance.save(update_fields=['lifecycle_status', 'current_verification_level'])
            cls._log(transaction_type, instance.pk, 'VERIFY', next_level, user, comment, ip_address)

        return instance

    @classmethod
    def unverify(cls, instance, transaction_type, user, comment, ip_address=None):
        """
        VERIFIED/CONFIRMED → LOCKED
        Reverts to locked state. Mandatory comment explaining why.
        Resets verification level to 0.
        """
        if instance.lifecycle_status not in ('VERIFIED', 'CONFIRMED'):
            raise ValidationError(
                f"Cannot unverify: current status is {instance.lifecycle_status}"
            )
        if not comment:
            raise ValidationError("Comment is mandatory when unverifying a transaction.")

        old_level = instance.current_verification_level
        instance.lifecycle_status = 'LOCKED'
        instance.current_verification_level = 0
        instance.save(update_fields=['lifecycle_status', 'current_verification_level'])

        cls._log(transaction_type, instance.pk, 'UNVERIFY', old_level, user, comment, ip_address)
        return instance
