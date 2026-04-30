"""
FiscalYearViewSet mixin — Pre-close checklist endpoints.

`close_checklist` (read), `close_checklist_toggle`,
`close_checklist_add_item`, `close_checklist_delete_item`.
Inherited by `FiscalYearViewSet`.
"""
from .base import (
    status, Response, action,
    get_current_tenant_id,
)


class FiscalYearChecklistMixin:
    """@action methods for the close-checklist lifecycle."""

    @action(detail=True, methods=['get'], url_path='close-checklist')
    def close_checklist(self, request, pk=None):
        """Return the pre-close checklist run for this fiscal year.
        Creates one from the default template if none exists. Applies
        auto-checks on every call so the progress reflects current state.
        """
        from apps.finance.services.close_checklist_service import (
            CloseChecklistService,
        )
        from apps.finance.models import CloseChecklistRun, CloseChecklistTemplate

        fy = self.get_object()
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)

        run = CloseChecklistRun.objects.filter(
            organization_id=organization_id, fiscal_year=fy,
            status__in=('OPEN', 'READY'),
        ).order_by('-created_at').first()

        if run is None:
            tmpl = CloseChecklistTemplate.objects.filter(
                organization_id=organization_id,
                scope='FISCAL_YEAR', is_default=True,
            ).first()
            if tmpl is None:
                tmpl = CloseChecklistService.ensure_default_template(fy.organization)
            run = CloseChecklistService.start_run(
                fy.organization, template=tmpl, fiscal_year=fy,
            )

        CloseChecklistService.apply_auto_checks(run)
        run.refresh_from_db()

        items = [
            {
                'state_id': state.id,
                'item_id': state.item.id,
                'order': state.item.order,
                'name': state.item.name,
                'category': state.item.category,
                'is_required': state.item.is_required,
                'is_complete': state.is_complete,
                'auto_checked': state.auto_checked,
                'completed_at': state.completed_at.isoformat() if state.completed_at else None,
                'completed_by': state.completed_by.username if state.completed_by_id else None,
                'notes': state.notes,
                'auto_check_signal': state.item.auto_check_signal,
            }
            for state in run.item_states.select_related('item', 'completed_by').order_by('item__order')
        ]
        required_missing = sum(
            1 for s in items if s['is_required'] and not s['is_complete']
        )
        return Response({
            'run_id': run.id,
            'status': run.status,
            'template_name': run.template.name,
            'ready_to_close': run.is_ready_to_close(),
            'total_items': len(items),
            'completed_items': sum(1 for s in items if s['is_complete']),
            'required_missing': required_missing,
            'items': items,
        })

    @action(detail=True, methods=['post'], url_path='close-checklist/toggle')
    def close_checklist_toggle(self, request, pk=None):
        """Tick or untick a single checklist item.

        Body: { state_id: int, complete: bool, notes?: str }
        """
        from apps.finance.models import CloseChecklistItemState
        from django.utils import timezone as tz

        fy = self.get_object()
        state_id = request.data.get('state_id')
        if not state_id:
            return Response({'error': 'state_id required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            state = CloseChecklistItemState.objects.select_related('run', 'item').get(
                id=state_id, run__fiscal_year=fy,
            )
        except CloseChecklistItemState.DoesNotExist:
            return Response({'error': 'item state not found'}, status=status.HTTP_404_NOT_FOUND)

        complete = bool(request.data.get('complete', True))
        notes = request.data.get('notes') or ''
        state.is_complete = complete
        state.completed_at = tz.now() if complete else None
        state.completed_by = request.user if complete else None
        state.auto_checked = False  # manual override
        if notes:
            state.notes = notes
        state.save()

        run = state.run
        if run.is_ready_to_close() and run.status == 'OPEN':
            run.status = 'READY'
            run.save(update_fields=['status'])
        elif not run.is_ready_to_close() and run.status == 'READY':
            run.status = 'OPEN'
            run.save(update_fields=['status'])

        return Response({
            'state_id': state.id,
            'is_complete': state.is_complete,
            'run_status': run.status,
            'ready_to_close': run.is_ready_to_close(),
        })

    @action(detail=True, methods=['post'], url_path='close-checklist/add-item')
    def close_checklist_add_item(self, request, pk=None):
        """Add a custom checklist item to the running close checklist.

        Body: { name: str, category?: str, is_required?: bool }
        Creates the item on the template and adds a state to the active run.
        """
        from apps.finance.models import (
            CloseChecklistItem, CloseChecklistItemState, CloseChecklistRun,
        )
        from django.db import models as db_models

        fy = self.get_object()
        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response({'error': 'No organization context'}, status=status.HTTP_400_BAD_REQUEST)

        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'name is required'}, status=status.HTTP_400_BAD_REQUEST)

        category = request.data.get('category', 'OTHER')
        is_required = bool(request.data.get('is_required', False))

        run = CloseChecklistRun.objects.filter(
            organization_id=organization_id, fiscal_year=fy,
            status__in=('OPEN', 'READY'),
        ).select_related('template').order_by('-created_at').first()

        if run is None:
            return Response({'error': 'No active checklist run for this year'}, status=status.HTTP_404_NOT_FOUND)

        max_order = CloseChecklistItem.objects.filter(
            organization_id=organization_id, template=run.template,
        ).aggregate(mx=db_models.Max('order'))['mx'] or 0

        item = CloseChecklistItem.objects.create(
            organization_id=organization_id,
            template=run.template,
            order=max_order + 1,
            name=name,
            category=category,
            is_required=is_required,
        )

        state = CloseChecklistItemState.objects.create(
            organization_id=organization_id,
            run=run,
            item=item,
            is_complete=False,
        )

        # Re-check run status
        if is_required and run.status == 'READY':
            run.status = 'OPEN'
            run.save(update_fields=['status'])

        return Response({
            'state_id': state.id,
            'item_id': item.id,
            'name': item.name,
            'category': item.category,
            'is_required': item.is_required,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='close-checklist/delete-item')
    def close_checklist_delete_item(self, request, pk=None):
        """Delete a checklist item from the running close checklist.

        Body: { state_id: int }
        Removes the item state and the underlying template item.
        """
        from apps.finance.models import CloseChecklistItemState

        fy = self.get_object()
        state_id = request.data.get('state_id')
        if not state_id:
            return Response({'error': 'state_id required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            state = CloseChecklistItemState.objects.select_related('run', 'item').get(
                id=state_id, run__fiscal_year=fy,
            )
        except CloseChecklistItemState.DoesNotExist:
            return Response({'error': 'item state not found'}, status=status.HTTP_404_NOT_FOUND)

        run = state.run
        item = state.item

        state.delete()
        item.delete()

        if run.is_ready_to_close() and run.status == 'OPEN':
            run.status = 'READY'
            run.save(update_fields=['status'])
        elif not run.is_ready_to_close() and run.status == 'READY':
            run.status = 'OPEN'
            run.save(update_fields=['status'])

        return Response({'deleted': True, 'run_status': run.status})

    @action(detail=False, methods=['get'], url_path='integrity-canary')
    def integrity_canary(self, request):
        """Run the close-chain canary synchronously for the current org.

        Returns the same 5 signals the daily scheduled task reports:
          1. OB↔JE drift per fiscal year
          2. Parent-balance purity
          3. Sub-ledger (control-account partner linkage) integrity
          4. FiscalYearCloseSnapshot hash-chain
          5. Denormalized balance vs recomputed JE-line aggregation
        """
        from apps.finance.tasks import run_close_chain_canary

        organization_id = get_current_tenant_id()
        if not organization_id:
            return Response(
                {'error': 'No organization context'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = run_close_chain_canary(org_id=organization_id)
        return Response(result)
