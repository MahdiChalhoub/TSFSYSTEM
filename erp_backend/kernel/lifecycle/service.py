"""
Kernel Lifecycle Service — Universal Transaction Workflow Engine
================================================================

Single source of truth for all transaction lifecycle operations.
Modules register handlers; the kernel owns the control flow.

Usage:
    from kernel.lifecycle.service import LifecycleService

    # Module registers its posting logic at app startup (apps.py ready())
    LifecycleService.register_handler(
        'SALES_INVOICE',
        on_post=InvoicePostingService.post_invoice,
        on_reverse=InvoicePostingService.reverse_invoice,
    )

    # Any viewset / service triggers lifecycle transitions:
    LifecycleService.submit(invoice, user)
    LifecycleService.verify(invoice, user, level=1)
    LifecycleService.approve(invoice, user)
    LifecycleService.post(invoice, user)       # calls on_post handler
    LifecycleService.lock(invoice, user)
    LifecycleService.reverse(invoice, user)    # calls on_reverse handler
"""
import logging
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import ValidationError, PermissionDenied
from kernel.events import emit_event
from .models import TxnApproval, ApprovalPolicy, ApprovalPolicyStep
from .constants import LifecycleStatus, LifecycleAction, TRANSITION_RULES

logger = logging.getLogger('kernel.lifecycle')


class LifecycleService:
    """
    Universal transaction lifecycle engine.

    Responsibilities:
    - State machine enforcement (DRAFT→SUBMITTED→…→LOCKED)
    - Multi-level approval with policy-based role checks
    - Handler dispatch (modules register on_post / on_reverse callbacks)
    - Audit trail via TxnApproval records
    - Event emission for downstream subscribers
    """

    # ═══════════════════════════════════════════════════════════════════════
    # HANDLER REGISTRY — modules register business-effect callbacks
    # ═══════════════════════════════════════════════════════════════════════

    _handlers = {}

    @classmethod
    def register_handler(cls, txn_type, on_post=None, on_reverse=None):
        """
        Register module-specific handlers for a transaction type.

        Args:
            txn_type: TransactionTypeCode value (e.g. 'SALES_INVOICE')
            on_post: callable(instance, user) — create GL entries, inventory moves, etc.
            on_reverse: callable(instance, user) — create offsetting entries
        """
        cls._handlers[txn_type] = {
            'on_post': on_post,
            'on_reverse': on_reverse,
        }
        logger.info(f"[Lifecycle] Registered handler for {txn_type}")

    @classmethod
    def get_handler(cls, txn_type, action):
        """Get registered handler for a txn_type and action."""
        entry = cls._handlers.get(txn_type, {})
        return entry.get(action)

    # ═══════════════════════════════════════════════════════════════════════
    # UTILITIES
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def get_txn_type(instance):
        """
        Derive canonical transaction type code from a model instance.
        Uses the model's `lifecycle_txn_type` attribute if set,
        otherwise falls back to app_label.model_name.
        """
        return getattr(instance, 'lifecycle_txn_type', None) or \
            f"{instance._meta.app_label}.{instance._meta.model_name}"

    @classmethod
    def can_transition_to(cls, instance, target_status):
        """Check if the target status is reachable from current status."""
        current = instance.status
        allowed = TRANSITION_RULES.get(current, [])
        return target_status in allowed

    @classmethod
    def get_policy(cls, txn_type, tenant):
        """Get the ApprovalPolicy for a given txn_type + tenant."""
        return ApprovalPolicy.objects.filter(
            tenant=tenant, txn_type=txn_type
        ).first()

    @classmethod
    def get_required_approvals(cls, txn_type, tenant):
        """
        How many approval levels are required for this transaction type?
        Returns 0 if no policy exists (auto-approve).
        """
        policy = cls.get_policy(txn_type, tenant)
        if not policy:
            return 0
        return policy.min_level_required

    # ═══════════════════════════════════════════════════════════════════════
    # LIFECYCLE ACTIONS
    # ═══════════════════════════════════════════════════════════════════════

    @classmethod
    @transaction.atomic
    def submit(cls, instance, user, note=None):
        """DRAFT → SUBMITTED"""
        if not cls.can_transition_to(instance, LifecycleStatus.SUBMITTED):
            raise ValidationError(
                f"Cannot submit: current status is '{instance.status}'. "
                f"Only DRAFT documents can be submitted."
            )

        txn_type = cls.get_txn_type(instance)
        policy = cls.get_policy(txn_type, instance.tenant)

        instance.status = LifecycleStatus.SUBMITTED
        instance.submitted_at = timezone.now()
        instance.submitted_by = user
        instance.save()

        cls._record(instance, user, level=0, action=LifecycleAction.SUBMIT, note=note)

        # Auto-skip verification/approval if no policy exists
        if not policy or policy.min_level_required == 0:
            logger.info(f"[Lifecycle] No policy for {txn_type} — auto-approving")
            instance.status = LifecycleStatus.APPROVED
            instance.save(update_fields=['status'])
            cls._record(instance, user, level=0, action=LifecycleAction.APPROVE, note="AUTO_APPROVED: No policy")

        emit_event(f"{txn_type}.submitted", {
            'id': instance.id, 'tenant_id': instance.tenant_id, 'user_id': user.id
        })
        return instance

    @classmethod
    @transaction.atomic
    def verify(cls, instance, user, level=1, note=None):
        """SUBMITTED → VERIFIED (or stays SUBMITTED if more levels needed)"""
        if instance.status not in (LifecycleStatus.SUBMITTED, LifecycleStatus.VERIFIED):
            raise ValidationError(
                f"Cannot verify: current status is '{instance.status}'. "
                f"Only SUBMITTED or partially-VERIFIED documents can be verified."
            )

        txn_type = cls.get_txn_type(instance)

        # Check permission for this level
        cls._check_level_permission(txn_type, instance.tenant, user, level)

        # Check if this level was already verified
        existing = TxnApproval.objects.filter(
            txn_type=txn_type, txn_id=instance.id,
            action=LifecycleAction.VERIFY, level=level
        ).exists()
        if existing:
            raise ValidationError(f"Level {level} has already been verified.")

        # Record verification
        cls._record(instance, user, level=level, action=LifecycleAction.VERIFY, note=note)

        # Check if all verification levels are complete
        policy = cls.get_policy(txn_type, instance.tenant)
        if policy:
            verify_steps = ApprovalPolicyStep.objects.filter(
                policy=policy, required=True
            ).count()
            completed = TxnApproval.objects.filter(
                txn_type=txn_type, txn_id=instance.id,
                action=LifecycleAction.VERIFY
            ).count()
            if completed >= verify_steps:
                instance.status = LifecycleStatus.VERIFIED
                instance.save(update_fields=['status'])
        else:
            instance.status = LifecycleStatus.VERIFIED
            instance.save(update_fields=['status'])

        return instance

    @classmethod
    @transaction.atomic
    def approve(cls, instance, user, level=None, note=None):
        """VERIFIED → APPROVED (or SUBMITTED → APPROVED if policy allows skip)"""
        if not cls.can_transition_to(instance, LifecycleStatus.APPROVED):
            raise ValidationError(
                f"Cannot approve: current status is '{instance.status}'."
            )

        txn_type = cls.get_txn_type(instance)
        policy = cls.get_policy(txn_type, instance.tenant)

        if level is None:
            level = policy.min_level_required if policy else 1

        # Manager bypass: fill in missing approval levels
        if policy and policy.allow_bypass:
            if user.is_superuser or user.has_perm(f"{instance._meta.app_label}.bypass_approvals"):
                existing = set(TxnApproval.objects.filter(
                    txn_type=txn_type, txn_id=instance.id,
                    action=LifecycleAction.APPROVE
                ).values_list('level', flat=True))
                for i in range(1, level):
                    if i not in existing:
                        TxnApproval.objects.create(
                            tenant=instance.tenant, txn_type=txn_type,
                            txn_id=instance.id, level=i,
                            action=LifecycleAction.APPROVE, actor=user,
                            note="BYPASSED_BY_MANAGER"
                        )

        # Check permission
        cls._check_level_permission(txn_type, instance.tenant, user, level)

        instance.status = LifecycleStatus.APPROVED
        instance.save(update_fields=['status'])

        cls._record(instance, user, level=level, action=LifecycleAction.APPROVE, note=note)

        emit_event(f"{txn_type}.approved", {
            'id': instance.id, 'tenant_id': instance.tenant_id, 'user_id': user.id
        })
        return instance

    @classmethod
    @transaction.atomic
    def reject(cls, instance, user, note=None):
        """SUBMITTED / VERIFIED → REJECTED"""
        if not cls.can_transition_to(instance, LifecycleStatus.REJECTED):
            raise ValidationError(
                f"Cannot reject: current status is '{instance.status}'."
            )

        instance.status = LifecycleStatus.REJECTED
        instance.save(update_fields=['status'])

        cls._record(instance, user, level=0, action=LifecycleAction.REJECT, note=note)

        txn_type = cls.get_txn_type(instance)
        emit_event(f"{txn_type}.rejected", {
            'id': instance.id, 'tenant_id': instance.tenant_id, 'user_id': user.id,
            'reason': note
        })
        return instance

    @classmethod
    @transaction.atomic
    def post(cls, instance, user, note=None):
        """
        APPROVED → POSTED
        
        This is the critical step: after posting, the kernel dispatches to
        the module-registered handler to create business effects (GL entries,
        inventory movements, etc.).
        """
        if not cls.can_transition_to(instance, LifecycleStatus.POSTED):
            raise ValidationError(
                f"Cannot post: current status is '{instance.status}'. "
                f"Only APPROVED documents can be posted."
            )

        txn_type = cls.get_txn_type(instance)

        # Verify minimum approval level is met
        policy = cls.get_policy(txn_type, instance.tenant)
        if policy:
            approved_levels = TxnApproval.objects.filter(
                txn_type=txn_type, txn_id=instance.id,
                action=LifecycleAction.APPROVE
            ).values_list('level', flat=True)
            if policy.min_level_required not in approved_levels:
                raise ValidationError(
                    f"Minimum approval level {policy.min_level_required} not reached."
                )

        # Dispatch to module handler BEFORE status update (so handler can validate)
        handler = cls.get_handler(txn_type, 'on_post')
        if handler:
            logger.info(f"[Lifecycle] Dispatching on_post for {txn_type}#{instance.id}")
            handler(instance, user)

        # Update status
        instance.status = LifecycleStatus.POSTED
        instance.posted_at = timezone.now()
        instance.posted_by = user
        instance.save()

        cls._record(instance, user, level=99, action=LifecycleAction.POST, note=note)

        emit_event(f"{txn_type}.posted", {
            'id': instance.id, 'tenant_id': instance.tenant_id, 'posted_by_id': user.id
        })
        return instance

    @classmethod
    @transaction.atomic
    def lock(cls, instance, user, note=None):
        """POSTED → LOCKED (period close / immutability guard)"""
        if not cls.can_transition_to(instance, LifecycleStatus.LOCKED):
            raise ValidationError(
                f"Cannot lock: current status is '{instance.status}'. "
                f"Only POSTED documents can be locked."
            )

        instance.status = LifecycleStatus.LOCKED
        instance.is_locked = True
        instance.locked_at = timezone.now()
        instance.locked_by = user
        instance.save()

        cls._record(instance, user, level=100, action=LifecycleAction.LOCK, note=note)

        txn_type = cls.get_txn_type(instance)
        emit_event(f"{txn_type}.locked", {
            'id': instance.id, 'tenant_id': instance.tenant_id
        })
        return instance

    @classmethod
    @transaction.atomic
    def reverse(cls, instance, user, reason=None):
        """
        POSTED → REVERSED
        
        Dispatches to the module-registered on_reverse handler to create
        offsetting entries (GL reversals, inventory adjustments, etc.).
        """
        if instance.status != LifecycleStatus.POSTED:
            raise ValidationError(
                f"Cannot reverse: current status is '{instance.status}'. "
                f"Only POSTED documents can be reversed."
            )

        txn_type = cls.get_txn_type(instance)

        # Dispatch to module handler
        handler = cls.get_handler(txn_type, 'on_reverse')
        if handler:
            logger.info(f"[Lifecycle] Dispatching on_reverse for {txn_type}#{instance.id}")
            handler(instance, user, reason=reason)

        instance.status = LifecycleStatus.REVERSED
        instance.save(update_fields=['status'])

        cls._record(instance, user, level=101, action=LifecycleAction.REVERSE, note=reason)

        emit_event(f"{txn_type}.reversed", {
            'original_id': instance.id,
            'tenant_id': instance.tenant_id,
            'actor_id': user.id,
            'reason': reason
        })
        return instance

    @classmethod
    @transaction.atomic
    def cancel(cls, instance, user, reason=None):
        """Any pre-posted status → CANCELLED"""
        if not cls.can_transition_to(instance, LifecycleStatus.CANCELLED):
            raise ValidationError(
                f"Cannot cancel: current status is '{instance.status}'."
            )

        instance.status = LifecycleStatus.CANCELLED
        instance.save(update_fields=['status'])

        cls._record(instance, user, level=0, action=LifecycleAction.CANCEL, note=reason)

        txn_type = cls.get_txn_type(instance)
        emit_event(f"{txn_type}.cancelled", {
            'id': instance.id, 'tenant_id': instance.tenant_id, 'reason': reason
        })
        return instance

    @classmethod
    @transaction.atomic
    def reopen(cls, instance, user, note=None):
        """REJECTED / CANCELLED → DRAFT"""
        if not cls.can_transition_to(instance, LifecycleStatus.DRAFT):
            raise ValidationError(
                f"Cannot reopen: current status is '{instance.status}'. "
                f"Only REJECTED or CANCELLED documents can be reopened."
            )

        instance.status = LifecycleStatus.DRAFT
        instance.save(update_fields=['status'])

        # Clear old approvals so the document starts fresh
        txn_type = cls.get_txn_type(instance)
        TxnApproval.objects.filter(txn_type=txn_type, txn_id=instance.id).delete()

        cls._record(instance, user, level=0, action=LifecycleAction.REOPEN, note=note)
        return instance

    # ═══════════════════════════════════════════════════════════════════════
    # QUERY HELPERS
    # ═══════════════════════════════════════════════════════════════════════

    @classmethod
    def get_timeline(cls, instance):
        """Get the full audit trail for a transaction."""
        txn_type = cls.get_txn_type(instance)
        return TxnApproval.objects.filter(
            txn_type=txn_type, txn_id=instance.id
        ).select_related('actor').order_by('created_at')

    @classmethod
    def get_available_actions(cls, instance):
        """Return list of valid next actions for the current status."""
        current = instance.status
        allowed_statuses = TRANSITION_RULES.get(current, [])
        action_map = {
            LifecycleStatus.SUBMITTED: 'submit',
            LifecycleStatus.VERIFIED:  'verify',
            LifecycleStatus.APPROVED:  'approve',
            LifecycleStatus.POSTED:    'post',
            LifecycleStatus.LOCKED:    'lock',
            LifecycleStatus.REVERSED:  'reverse',
            LifecycleStatus.REJECTED:  'reject',
            LifecycleStatus.CANCELLED: 'cancel',
            LifecycleStatus.DRAFT:     'reopen',
        }
        return [action_map[s] for s in allowed_statuses if s in action_map]

    # ═══════════════════════════════════════════════════════════════════════
    # INTERNAL
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def _record(instance, user, level, action, note=None):
        """Create an immutable audit record."""
        txn_type = LifecycleService.get_txn_type(instance)
        TxnApproval.objects.create(
            tenant=instance.tenant,
            txn_type=txn_type,
            txn_id=instance.id,
            level=level,
            action=action,
            actor=user,
            note=note,
        )

    @staticmethod
    def _check_level_permission(txn_type, tenant, user, level):
        """Check if user has the required role for a given approval level."""
        policy = ApprovalPolicy.objects.filter(
            tenant=tenant, txn_type=txn_type
        ).first()
        if not policy:
            return  # No policy = anyone can act

        step = ApprovalPolicyStep.objects.filter(
            policy=policy, level=level
        ).first()
        if not step or not step.role_id:
            return  # No specific role required

        if not user.has_perm(step.role_id):
            raise PermissionDenied(
                f"You lack permission '{step.role_id}' required for level {level}."
            )
