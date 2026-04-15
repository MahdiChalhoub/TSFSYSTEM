import logging
from django.utils import timezone
from apps.pos.models.audit_models import SalesAuditLog, POSAuditEvent, POSAuditRule

logger = logging.getLogger(__name__)

class ForensicAuditService:
    """
    Primary security and audit service for the POS module.
    Orchestrates SalesAuditLog (immutable diffs) and POSAuditEvent (rule-based alerts).
    """

    @classmethod
    def log_sales_mutation(cls, order, action_type, summary, actor=None, diff=None, extra=None, ip_address=None):
        """
        Record an immutable entry in the SalesAuditLog (GAP 8).
        """
        try:
            return SalesAuditLog.log(
                order=order,
                action_type=action_type,
                summary=summary,
                actor=actor,
                diff=diff,
                extra=extra,
                ip_address=ip_address
            )
        except Exception as e:
            logger.error(f"[ForensicAudit] Failed to log sales mutation: {str(e)}")
            return None

    @classmethod
    def fire_security_event(cls, organization, user, event_type, event_name, details, reference_id=None):
        """
        Fires a security event (POSAuditEvent) and evaluates POSAuditRule for actions.
        This is a refactored version of pos_service.fire_audit_event.
        """
        # POS event type -> AutoTaskRule trigger_event mapping
        EVENT_TO_TRIGGER = {
            'PRICE_OVERRIDE':         'PRICE_CHANGE',
            'GLOBAL_DISCOUNT':        'CASHIER_DISCOUNT',
            'DISCOUNT_POLICY_VIOLATION': 'CASHIER_DISCOUNT',
            'NEGATIVE_STOCK_OVERRIDE': 'NEGATIVE_STOCK',
            'CREDIT_SALE':            'CREDIT_SALE',
            'CLEAR_CART':             'CUSTOM',
            'REMOVE_ITEM':            'CUSTOM',
            'DECREASE_QTY':           'CUSTOM',
        }

        try:
            event = POSAuditEvent.objects.create(
                organization=organization,
                user=user,
                event_type=event_type,
                event_name=event_name,
                details=details or {},
                reference_id=reference_id,
            )

            # 1. Evaluate POSAuditRule for immediate Tasks/Notifications
            try:
                rule = POSAuditRule.objects.filter(
                    organization=organization,
                    event_type=event_type,
                    is_active=True
                ).first()

                if rule:
                    if rule.create_task:
                        cls._create_urgent_task(organization, event, user)
                    
                    if rule.send_notification:
                        # Logic for real-time notification (e.g. WebSocket or Push)
                        # For now, we flag the event for the Audit Center
                        pass
            except Exception as rule_exc:
                logger.debug(f"[ForensicAudit] Rule evaluation failed: {str(rule_exc)}")

            # 2. Fire AutoTaskRule engine (Workspace integration)
            try:
                trigger = EVENT_TO_TRIGGER.get(event_type)
                if trigger:
                    from erp.connector_registry import connector
                    fire_auto_tasks = connector.require('workspace.auto_tasks.fire', org_id=organization.id)
                    if fire_auto_tasks:
                        fire_auto_tasks(
                            organization=organization,
                            event=trigger,
                            context={
                                'user': user,
                                'amount': details.get('total') or details.get('discount_amount') or 0,
                                'reference': reference_id,
                                'cashier_id': user.id if user else None,
                                'extra': details,
                            }
                        )
            except Exception as task_exc:
                logger.debug(f"[ForensicAudit] AutoTask trigger failed: {str(task_exc)}")

            return event
        except Exception as e:
            logger.error(f"[ForensicAudit] Failed to fire security event: {str(e)}")
            return None

    @classmethod
    def _create_urgent_task(cls, organization, event, user):
        """Internal helper to create a Workspace task for a security alert."""
        try:
            from erp.connector_registry import connector
            from erp.models import Role
            
            Task = connector.require('workspace.tasks.get_model', org_id=organization.id)
            if not Task:
                return

            # Resolve manager role for assignment
            manager_role = Role.objects.filter(
                organization=organization,
                name__icontains='manager'
            ).first()

            Task.objects.create(
                organization=organization,
                title=f'⚠️ POS Alert: {event.event_name}',
                description=(
                    f"Event Type: {event.event_type}\n"
                    f"Reference: {event.reference_id or 'N/A'}\n"
                    f"Cashier: {user.get_full_name() or user.username if user else 'Unknown'}\n\n"
                    f"Details: {event.details}"
                ),
                priority='URGENT',
                status='PENDING',
                source='SYSTEM',
                assigned_to_group=manager_role,
                related_object_type='POSAuditEvent',
                related_object_id=event.id,
                related_object_label=event.event_name,
            )
        except Exception as e:
            logger.debug(f"[ForensicAudit] Task creation failed: {str(e)}")

    @staticmethod
    def log_mutation(*args, **kwargs):
        """
        Compatibility bridge to Finance ForensicAuditService.
        Redirects to apps.finance.services.audit_service if available.
        """
        try:
            from erp.connector_registry import connector
            FinanceAudit = connector.require('finance.services.get_forensic_audit_service', org_id=0)
            if FinanceAudit:
                return FinanceAudit.log_mutation(*args, **kwargs)
        except Exception:
            pass
        return None
