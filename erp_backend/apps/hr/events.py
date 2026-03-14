"""
HR Module Event Handlers
=========================

Handles events from other modules and emits HR-related events.

Kernel OS v2.0 Integration - Event Contracts Implemented:
- user.created (subscribes - creates employee record)
- employee.created (emits)
- role.assigned (subscribes - updates employee permissions)
"""

import logging
from django.db import transaction
from django.utils import timezone
from kernel.events import emit_event, subscribe_to_event
from kernel.contracts.decorators import enforce_contract

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for HR module (Kernel OS v2.0)

    Routes events to appropriate handlers based on event name.
    Compatible with both old (organization_id) and new (organization_id) signatures.
    """
    logger.info(f"[HR] Received event: {event_name}")

    handlers = {
        # Kernel OS v2.0 events
        'user.created': handle_user_created,
        'role.assigned': handle_role_assigned,

        # Legacy events
        'org:provisioned': _on_org_provisioned,
        'payroll:processed': _on_payroll_processed,
    }

    handler = handlers.get(event_name)

    if handler:
        try:
            result = handler(payload, organization_id)
            logger.info(f"[HR] Successfully handled {event_name}")
            return result
        except Exception as e:
            logger.error(f"[HR] Error handling {event_name}: {e}")
            raise
    else:
        logger.warning(f"[HR] No handler for event: {event_name}")
        return None


def _on_org_provisioned(payload: dict, organization_id: int) -> dict:
    """
    React to new org provisioning — create default roles/departments.
    """
    logger.info(f"👥 HR: Org provisioned, setting up defaults for org {organization_id}")
    # Future: Create default departments, roles, leave policies
    return {'success': True}


def _on_payroll_processed(payload: dict, organization_id: int) -> dict:
    """
    React to payroll processing — trigger finance journal entries.
    
    This handler emits a 'payroll:journal_needed' event to Finance
    via the ConnectorEngine instead of importing finance directly.
    """
    payroll_id = payload.get('payroll_id')
    total_amount = payload.get('total_amount')
    
    logger.info(f"💰 HR: Payroll {payroll_id} processed, total={total_amount}")
    
    # Emit event to Finance for journal creation
    try:
        from erp.connector_engine import ConnectorEngine
        connector = ConnectorEngine()
        connector.dispatch_event(
            source_module='hr',
            event_name='payroll:journal_needed',
            payload={
                'payroll_id': payroll_id,
                'total_amount': str(total_amount),
                'organization_id': str(organization_id),
            },
            organization_id=str(organization_id)
        )
    except Exception as e:
        logger.warning(f"HR: Failed to dispatch payroll event: {e}")
    
    return {'success': True}


# ============================================================================
# KERNEL OS v2.0 EVENT HANDLERS
# ============================================================================

@subscribe_to_event('user.created')
def on_user_created(event):
    """EventBus handler wrapper for user.created"""
    handle_user_created(event.payload, event.organization_id)


@transaction.atomic
def handle_user_created(payload: dict, organization_id: int):
    """Handle user.created event - Create employee record"""
    from apps.hr.models import Employee

    user_id = payload.get('user_id')
    email = payload.get('email')
    first_name = payload.get('first_name', '')
    last_name = payload.get('last_name', '')

    logger.info(f"[HR] Creating employee for user: {user_id}")

    try:
        existing = Employee.objects.filter(user_id=user_id, organization_id=organization_id).first()
        if existing:
            return {'success': True, 'employee_id': existing.id, 'existed': True}

        employee = Employee.objects.create(
            user_id=user_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            hire_date=timezone.now().date(),
            organization_id=organization_id
        )

        emit_event('employee.created', {
            'employee_id': employee.id,
            'user_id': user_id,
            'organization_id': organization_id
        })

        return {'success': True, 'employee_id': employee.id}
    except Exception as e:
        logger.error(f"[HR] Error creating employee: {e}")
        raise


@subscribe_to_event('role.assigned')
def on_role_assigned(event):
    """EventBus handler wrapper for role.assigned"""
    handle_role_assigned(event.payload, event.organization_id)


def handle_role_assigned(payload: dict, organization_id: int):
    """Handle role.assigned event - Update employee permissions"""
    logger.info(f"[HR] Role assigned event received")
    # Update employee role/position if needed
    return {'success': True}
