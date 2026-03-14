"""
Audit & Workflow Services
==========================
Provides WorkflowService for approval workflows and AuditService for 
programmatic audit log creation.

WorkflowService.check_workflow() is called by PriceChangeWorkflowMixin
to determine if an action should be held for approval.
"""

import uuid
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class WorkflowCheckResult:
    """Result of a workflow check."""
    requires_hold: bool = False
    request_id: Optional[uuid.UUID] = None
    workflow_name: Optional[str] = None
    message: str = ''


class WorkflowService:
    """
    Checks whether an action triggers a workflow (approval gate).
    
    Usage:
        result = WorkflowService.check_workflow(
            event_type='product.price_change',
            actor=request.user,
            payload={'changes': {...}},
            organization=org,
            target_table='Product',
            target_id=str(product.id)
        )
        if result.requires_hold:
            # Action blocked — pending approval
            raise PriceChangeApprovalRequired(result.request_id)
    """

    @staticmethod
    def check_workflow(
        event_type: str,
        actor,
        payload: dict,
        organization=None,
        target_table: str = '',
        target_id: str = '',
    ) -> WorkflowCheckResult:
        """
        Check if the given event_type triggers an active workflow.
        
        If a matching WorkflowDefinition is found and requires approval:
          1. Creates an ApprovalRequest (status=PENDING)
          2. Creates an AuditLog entry
          3. Returns WorkflowCheckResult with requires_hold=True
        
        If no matching workflow or not requiring approval:
          Returns WorkflowCheckResult with requires_hold=False
        """
        from .models_audit import WorkflowDefinition, ApprovalRequest, AuditLog

        try:
            workflow = WorkflowDefinition.objects.get(
                event_type=event_type,
                is_active=True,
            )
        except WorkflowDefinition.DoesNotExist:
            # No active workflow for this event — allow action
            return WorkflowCheckResult(requires_hold=False)

        # Check if user's role bypasses this workflow
        if actor and hasattr(actor, 'role') and actor.role:
            if workflow.bypass_roles.filter(id=actor.role_id).exists():
                logger.info(
                    f"[WORKFLOW] {actor.username} bypasses '{workflow.name}' via role '{actor.role}'"
                )
                return WorkflowCheckResult(requires_hold=False, message='Bypassed via role')

        # Log the event
        org_id = organization.id if organization else None
        audit_entry = AuditLog.objects.create(
            organization_id=org_id,
            actor=actor if actor and actor.is_authenticated else None,
            action=f'WORKFLOW:{event_type}',
            table_name=target_table,
            record_id=target_id,
            new_value=payload,
            description=f"Workflow triggered: {workflow.name}",
        )

        # If workflow requires pre-approval, create an approval request
        if workflow.requires_approval and workflow.approval_mode == 'PRE':
            approval = ApprovalRequest.objects.create(
                workflow=workflow,
                audit_log=audit_entry,
                status='PENDING',
                requested_by=actor if actor and actor.is_authenticated else None,
                payload=payload,
                target_table=target_table,
                target_id=target_id,
                organization_id=org_id,
            )

            logger.info(
                f"[WORKFLOW] PRE-approval required for '{workflow.name}' — "
                f"ApprovalRequest {approval.id}"
            )
            return WorkflowCheckResult(
                requires_hold=True,
                request_id=approval.id,
                workflow_name=workflow.name,
                message=f'Requires approval: {workflow.name}',
            )

        # POST mode — just log, don't block
        logger.info(f"[WORKFLOW] POST-audit logged for '{workflow.name}'")
        return WorkflowCheckResult(
            requires_hold=False,
            workflow_name=workflow.name,
            message=f'Audit logged: {workflow.name}',
        )


class AuditService:
    """
    Programmatic interface for creating audit log entries.
    
    Usage:
        AuditService.log_event(
            action='PRICE_OVERRIDE',
            table_name='Product',
            record_id=str(product.id),
            actor=request.user,
            organization=org,
            old_data={'price': 100},
            new_data={'price': 150},
        )
    """

    @staticmethod
    def log_event(
        action: str,
        table_name: str = '',
        record_id: str = '',
        actor=None,
        organization=None,
        old_data: dict = None,
        new_data: dict = None,
        description: str = '',
        ip_address: str = None,
        user_agent: str = '',
        metadata: dict = None,
    ):
        """Create an audit log entry."""
        from .models_audit import AuditLog

        try:
            return AuditLog.objects.create(
                organization_id=organization.id if organization else None,
                actor=actor if actor and hasattr(actor, 'is_authenticated') and actor.is_authenticated else None,
                action=action,
                table_name=table_name,
                record_id=record_id,
                old_value=old_data,
                new_value=new_data,
                description=description,
                ip_address=ip_address,
                user_agent=(user_agent or '')[:500],
                metadata=metadata,
            )
        except Exception as e:
            logger.warning(f"[AUDIT] Failed to log event: {e}")
            return None
