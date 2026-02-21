"""
HR Module Event Handlers
=========================
Receives inter-module events routed by the ConnectorEngine.

The ConnectorEngine discovers this module via:
    importlib.import_module('apps.hr.events')
"""

import logging

logger = logging.getLogger(__name__)


def handle_event(event_name: str, payload: dict, organization_id: int):
    """
    Main event handler for the HR module.
    """
    handlers = {
        'org:provisioned': _on_org_provisioned,
        'payroll:processed': _on_payroll_processed,
    }
    
    handler = handlers.get(event_name)
    if handler:
        return handler(payload, organization_id)
    else:
        logger.debug(f"HR module: unhandled event '{event_name}'")
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
