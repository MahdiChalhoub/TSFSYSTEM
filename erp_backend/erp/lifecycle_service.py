"""
Transaction Lifecycle Service - V2.0
=====================================
DEPRECATED — This module is kept for backward compatibility.

All new code should use the kernel lifecycle engine:

    from kernel.lifecycle.service import LifecycleService

This service is only used by the old VerifiableModel flow
(JournalEntry). All other models use kernel.lifecycle.service.

Original Features:
- Level Resolution Engine: Evaluates ApprovalRule conditions
- Lock Implementation: Resolves and freezes required_levels
- Verify Logic: Normal increment + Manager Override ("Verify & Complete")
- Atomic Operations: Thread-safe level increments with select_for_update()
"""
from django.utils import timezone
from django.core.exceptions import ValidationError, PermissionDenied
from django.db import transaction
from django.db.models import Q
import json


class TransactionLifecycleService:
    """
    Manages the complete lifecycle of verifiable transactions.
    Supports dynamic multi-level verification based on rules and policies.
    """

    def __init__(self, organization, user, ip_address=None):
        """
        Initialize service with context.

        Args:
            organization: Organization instance
            user: User performing the action
            ip_address: Optional IP address for audit
        """
        self.organization = organization
        self.user = user
        self.ip_address = ip_address

    # ═══════════════════════════════════════════════════════════════════
    # LEVEL RESOLUTION ENGINE
    # ═══════════════════════════════════════════════════════════════════

    def _resolve_required_levels(self, transaction_type_code, transaction_instance):
        """
        Resolve how many verification levels are required for this transaction.

        Logic:
        1. Get TransactionVerificationPolicy for the transaction type
        2. If not controlled → return 0 (no approval needed)
        3. If SIMPLE mode → return default_levels
        4. If RULED mode → evaluate ApprovalRules in priority order
        5. Return first matching rule's required_levels

        Args:
            transaction_type_code: String code (e.g., 'REFUND')
            transaction_instance: The actual model instance being locked

        Returns:
            int: Number of required verification levels
        """
        from erp.models import TransactionType, TransactionVerificationPolicy, ApprovalRule

        # Get TransactionType
        try:
            txn_type = TransactionType.objects.get(
                organization=self.organization,
                code=transaction_type_code
            )
        except TransactionType.DoesNotExist:
            # No policy defined = no control required
            return 0

        # Get Policy
        try:
            policy = TransactionVerificationPolicy.objects.get(
                organization=self.organization,
                transaction_type=txn_type,
                is_active=True
            )
        except TransactionVerificationPolicy.DoesNotExist:
            return 0

        # Not controlled = no approval
        if not policy.is_controlled:
            return 0

        # SIMPLE mode = fixed levels
        if policy.mode == 'SIMPLE':
            return policy.default_levels

        # RULED mode = evaluate rules
        if policy.mode == 'RULED':
            rules = ApprovalRule.objects.filter(
                policy=policy,
                is_active=True
            ).order_by('-priority', 'id')

            for rule in rules:
                if self._evaluate_rule_conditions(rule.conditions, transaction_instance):
                    return rule.required_levels

            # No rule matched → use default
            return policy.default_levels

        return 0

    def _evaluate_rule_conditions(self, conditions, instance):
        """
        Evaluate JSON conditions against the transaction instance.

        Supports Django ORM-style lookups:
        - {"amount__gt": 10000} → instance.amount > 10000
        - {"type": "REFUND"} → instance.type == "REFUND"
        - {"amount__gte": 5000, "amount__lte": 50000} → 5000 <= amount <= 50000

        Args:
            conditions: Dict of field lookups
            instance: Model instance to evaluate

        Returns:
            bool: True if all conditions match
        """
        for field_lookup, expected_value in conditions.items():
            # Parse field__lookup format
            parts = field_lookup.split('__')
            field_name = parts[0]
            lookup = parts[1] if len(parts) > 1 else 'exact'

            # Get field value
            try:
                actual_value = getattr(instance, field_name)
            except AttributeError:
                return False  # Field doesn't exist

            # Evaluate lookup
            if lookup == 'exact':
                if actual_value != expected_value:
                    return False
            elif lookup == 'gt':
                if not (actual_value > expected_value):
                    return False
            elif lookup == 'gte':
                if not (actual_value >= expected_value):
                    return False
            elif lookup == 'lt':
                if not (actual_value < expected_value):
                    return False
            elif lookup == 'lte':
                if not (actual_value <= expected_value):
                    return False
            elif lookup == 'in':
                if actual_value not in expected_value:
                    return False
            elif lookup == 'contains':
                if expected_value not in str(actual_value):
                    return False
            else:
                return False  # Unsupported lookup

        return True  # All conditions matched

    def _create_policy_snapshot(self, transaction_type_code, required_levels):
        """
        Create JSON snapshot of policy for audit trail.

        Args:
            transaction_type_code: Transaction type code
            required_levels: Resolved required levels

        Returns:
            dict: Policy snapshot
        """
        from erp.models import TransactionType, TransactionVerificationPolicy

        try:
            txn_type = TransactionType.objects.get(
                organization=self.organization,
                code=transaction_type_code
            )
            policy = TransactionVerificationPolicy.objects.get(
                organization=self.organization,
                transaction_type=txn_type
            )

            return {
                'transaction_type': transaction_type_code,
                'policy_mode': policy.mode,
                'is_controlled': policy.is_controlled,
                'allow_override': policy.allow_override,
                'required_levels': required_levels,
                'locked_at': timezone.now().isoformat(),
                'locked_by_user_id': self.user.id,
                'locked_by_username': self.user.username,
            }
        except Exception:
            return {
                'transaction_type': transaction_type_code,
                'required_levels': required_levels,
                'error': 'Could not load full policy snapshot'
            }

    # ═══════════════════════════════════════════════════════════════════
    # AUDIT LOGGING
    # ═══════════════════════════════════════════════════════════════════

    def _log(self, transaction_type, transaction_id, action, level, comment=None, meta=None):
        """Create audit log entry"""
        from erp.models import TransactionStatusLog

        TransactionStatusLog.objects.create(
            transaction_type=transaction_type,
            transaction_id=transaction_id,
            action=action,
            level=level,
            performed_by=self.user,
            comment=comment,
            ip_address=self.ip_address,
            meta=meta or {}
        )

    @classmethod
    def get_history(cls, transaction_type, transaction_id):
        """Returns the full lifecycle audit trail for a transaction."""
        from erp.models import TransactionStatusLog

        return TransactionStatusLog.objects.filter(
            transaction_type=transaction_type,
            transaction_id=transaction_id
        ).select_related('performed_by').order_by('-performed_at')

    # ═══════════════════════════════════════════════════════════════════
    # LIFECYCLE ACTIONS
    # ═══════════════════════════════════════════════════════════════════

    @transaction.atomic
    def lock(self, instance, transaction_type, comment=None):
        """
        OPEN → LOCKED

        Freezes the transaction and resolves required verification levels.
        Levels are frozen at this moment and won't change even if policy changes later.

        Args:
            instance: VerifiableModel instance
            transaction_type: String code (e.g., 'REFUND')
            comment: Optional comment

        Returns:
            instance: Updated instance

        Raises:
            ValidationError: If instance is not in OPEN status
        """
        if instance.lifecycle_status != 'OPEN':
            raise ValidationError(
                f"Cannot lock: current status is {instance.lifecycle_status}. "
                f"Only OPEN transactions can be locked."
            )

        # Resolve required levels
        required_levels = self._resolve_required_levels(transaction_type, instance)

        # Create policy snapshot
        policy_snapshot = self._create_policy_snapshot(transaction_type, required_levels)

        # Update instance
        instance.lifecycle_status = 'LOCKED'
        instance.locked_by = self.user
        instance.locked_at = timezone.now()
        instance.required_levels_frozen = required_levels
        instance.policy_snapshot = policy_snapshot
        instance.save(update_fields=[
            'lifecycle_status', 'locked_by', 'locked_at',
            'required_levels_frozen', 'policy_snapshot', 'updated_at'
        ])

        # Log action
        self._log(
            transaction_type,
            instance.pk,
            'LOCK',
            0,
            comment,
            meta={
                'required_levels': required_levels,
                'policy_snapshot': policy_snapshot
            }
        )

        return instance

    @transaction.atomic
    def unlock(self, instance, transaction_type, comment):
        """
        LOCKED → OPEN

        Reopens transaction for editing. Requires mandatory comment.

        Args:
            instance: VerifiableModel instance
            transaction_type: String code
            comment: Mandatory explanation for unlock

        Returns:
            instance: Updated instance

        Raises:
            ValidationError: If not LOCKED or missing comment
        """
        if instance.lifecycle_status != 'LOCKED':
            raise ValidationError(
                f"Cannot unlock: current status is {instance.lifecycle_status}. "
                f"Only LOCKED transactions can be unlocked."
            )

        if not comment or not comment.strip():
            raise ValidationError("Comment is mandatory for UNLOCK action.")

        # Update instance
        instance.lifecycle_status = 'OPEN'
        instance.locked_by = None
        instance.locked_at = None
        instance.required_levels_frozen = 0
        instance.policy_snapshot = {}
        instance.current_verification_level = 0
        instance.save(update_fields=[
            'lifecycle_status', 'locked_by', 'locked_at',
            'required_levels_frozen', 'policy_snapshot',
            'current_verification_level', 'updated_at'
        ])

        # Log action
        self._log(transaction_type, instance.pk, 'UNLOCK', 0, comment)

        return instance

    @transaction.atomic
    def verify(self, instance, transaction_type, comment=None):
        """
        Increment verification level by 1.

        LOCKED → VERIFIED (if level 1 complete)
        VERIFIED → VERIFIED (levels 2+)
        VERIFIED → CONFIRMED (when current_level == required_levels)

        Uses select_for_update() for thread safety.

        Args:
            instance: VerifiableModel instance
            transaction_type: String code
            comment: Optional comment

        Returns:
            instance: Updated instance

        Raises:
            ValidationError: If not in LOCKED/VERIFIED status
            PermissionDenied: If user doesn't have permission for current level
        """
        # Lock row for update
        locked_instance = instance.__class__.objects.select_for_update().get(pk=instance.pk)

        if locked_instance.lifecycle_status not in ('LOCKED', 'VERIFIED'):
            raise ValidationError(
                f"Cannot verify: current status is {locked_instance.lifecycle_status}. "
                f"Only LOCKED or VERIFIED transactions can be verified."
            )

        # Check if already fully verified
        if locked_instance.current_verification_level >= locked_instance.required_levels_frozen:
            raise ValidationError("Transaction is already fully verified.")

        # Check permission for next level
        next_level = locked_instance.current_verification_level + 1
        if not self._user_can_verify_level(transaction_type, next_level):
            raise PermissionDenied(
                f"You do not have permission to verify at level {next_level}. "
                f"Check role assignments in the verification policy."
            )

        # Increment level
        locked_instance.current_verification_level = next_level

        # Update status
        if next_level >= locked_instance.required_levels_frozen:
            locked_instance.lifecycle_status = 'CONFIRMED'
        elif next_level == 1:
            locked_instance.lifecycle_status = 'VERIFIED'

        locked_instance.save(update_fields=[
            'current_verification_level', 'lifecycle_status', 'updated_at'
        ])

        # Log action
        self._log(transaction_type, locked_instance.pk, 'VERIFY', next_level, comment)

        return locked_instance

    @transaction.atomic
    def verify_and_complete(self, instance, transaction_type, comment):
        """
        Manager Override: Set current_level = required_levels in one step.

        This allows managers to skip intermediate verification levels.
        Requires:
        1. Policy has allow_override = True
        2. User has override permission
        3. Mandatory comment explaining bypass

        Args:
            instance: VerifiableModel instance
            transaction_type: String code
            comment: Mandatory explanation for override

        Returns:
            instance: Updated instance

        Raises:
            PermissionDenied: If override not allowed or no permission
            ValidationError: If not in LOCKED/VERIFIED or missing comment
        """
        # Lock row
        locked_instance = instance.__class__.objects.select_for_update().get(pk=instance.pk)

        if locked_instance.lifecycle_status not in ('LOCKED', 'VERIFIED'):
            raise ValidationError(
                f"Cannot override verify: current status is {locked_instance.lifecycle_status}."
            )

        if not comment or not comment.strip():
            raise ValidationError("Comment is mandatory for override verify action.")

        # Check if override is allowed
        if not self._policy_allows_override(transaction_type):
            raise PermissionDenied(
                "Override verification is not allowed for this transaction type. "
                "Update the policy settings to enable 'allow_override'."
            )

        # Check user permission
        if not self._user_can_override(transaction_type):
            raise PermissionDenied(
                "You do not have permission to override verification. "
                "Manager role or specific override permission required."
            )

        # Set to fully verified
        locked_instance.current_verification_level = locked_instance.required_levels_frozen
        locked_instance.lifecycle_status = 'CONFIRMED'
        locked_instance.save(update_fields=[
            'current_verification_level', 'lifecycle_status', 'updated_at'
        ])

        # Log action with meta showing override
        self._log(
            transaction_type,
            locked_instance.pk,
            'VERIFY',  # Still logged as VERIFY
            locked_instance.required_levels_frozen,
            comment,
            meta={
                'override': True,
                'skipped_levels': locked_instance.required_levels_frozen - 1,
                'reason': comment
            }
        )

        return locked_instance

    @transaction.atomic
    def unverify(self, instance, transaction_type, comment):
        """
        Decrement verification level by 1 or reset to LOCKED.

        CONFIRMED → VERIFIED (if more than 1 level)
        VERIFIED → LOCKED (if only 1 level)

        Args:
            instance: VerifiableModel instance
            transaction_type: String code
            comment: Mandatory explanation for unverify

        Returns:
            instance: Updated instance

        Raises:
            ValidationError: If not VERIFIED/CONFIRMED or missing comment
        """
        if instance.lifecycle_status not in ('VERIFIED', 'CONFIRMED'):
            raise ValidationError(
                f"Cannot unverify: current status is {instance.lifecycle_status}."
            )

        if not comment or not comment.strip():
            raise ValidationError("Comment is mandatory for UNVERIFY action.")

        # Decrement level
        if instance.current_verification_level > 0:
            instance.current_verification_level -= 1

        # Update status
        if instance.current_verification_level == 0:
            instance.lifecycle_status = 'LOCKED'
        else:
            instance.lifecycle_status = 'VERIFIED'

        instance.save(update_fields=[
            'current_verification_level', 'lifecycle_status', 'updated_at'
        ])

        # Log action
        self._log(transaction_type, instance.pk, 'UNVERIFY', instance.current_verification_level, comment)

        return instance

    # ═══════════════════════════════════════════════════════════════════
    # PERMISSION CHECKS
    # ═══════════════════════════════════════════════════════════════════

    def _user_can_verify_level(self, transaction_type_code, level):
        """
        Check if user has permission to verify at the given level.

        Args:
            transaction_type_code: String code
            level: Verification level (1, 2, 3, ...)

        Returns:
            bool: True if user can verify
        """
        from erp.models import TransactionType, TransactionVerificationPolicy, LevelRoleMap

        try:
            txn_type = TransactionType.objects.get(
                organization=self.organization,
                code=transaction_type_code
            )
            policy = TransactionVerificationPolicy.objects.get(
                organization=self.organization,
                transaction_type=txn_type
            )

            # Get role required for this level
            role_map = LevelRoleMap.objects.filter(
                policy=policy,
                level=level
            ).first()

            if not role_map:
                # No specific role required = any user can verify
                return True

            # Check if user has the required role
            from kernel.rbac.models import UserRole
            has_role = UserRole.objects.filter(
                user=self.user,
                role=role_map.role
            ).exists()

            return has_role

        except Exception:
            # If policy not found or error, allow by default
            return True

    def _policy_allows_override(self, transaction_type_code):
        """Check if policy allows override verification"""
        from erp.models import TransactionType, TransactionVerificationPolicy

        try:
            txn_type = TransactionType.objects.get(
                organization=self.organization,
                code=transaction_type_code
            )
            policy = TransactionVerificationPolicy.objects.get(
                organization=self.organization,
                transaction_type=txn_type
            )
            return policy.allow_override
        except Exception:
            return False

    def _user_can_override(self, transaction_type_code):
        """
        Check if user can override verification (Manager permission).

        Returns True if:
        1. User is superuser, OR
        2. User has 'Manager' role, OR
        3. User has specific override permission
        """
        if self.user.is_superuser:
            return True

        # Check for Manager role
        from kernel.rbac.models import UserRole, Role
        manager_role = Role.objects.filter(name__icontains='manager').first()
        if manager_role:
            has_manager = UserRole.objects.filter(
                user=self.user,
                role=manager_role
            ).exists()
            if has_manager:
                return True

        # Check for specific override permission
        if self.user.has_perm('erp.override_verification'):
            return True

        return False

    # ═══════════════════════════════════════════════════════════════════
    # UTILITY METHODS
    # ═══════════════════════════════════════════════════════════════════

    @classmethod
    def get_pending_verifications(cls, organization, user):
        """
        Get all transactions pending verification for the user.

        Returns transactions where:
        - lifecycle_status = LOCKED or VERIFIED
        - current_level < required_levels
        - User has permission for next level

        Returns:
            QuerySet: Pending transactions (generic, would need type-specific queries)
        """
        # This would need to be implemented per-model type
        # Example for invoices:
        # from apps.finance.models import Invoice
        # return Invoice.objects.filter(
        #     organization=organization,
        #     lifecycle_status__in=['LOCKED', 'VERIFIED']
        # ).exclude(current_verification_level__gte=F('required_levels_frozen'))
        pass

    @classmethod
    def get_verification_stats(cls, organization):
        """
        Get verification statistics for the organization.

        Returns:
            dict: Stats like pending count, verified count, etc.
        """
        from erp.models import TransactionStatusLog

        total_locks = TransactionStatusLog.objects.filter(
            action='LOCK'
        ).count()

        total_verifications = TransactionStatusLog.objects.filter(
            action='VERIFY'
        ).count()

        return {
            'total_locks': total_locks,
            'total_verifications': total_verifications,
            # Add more stats as needed
        }
