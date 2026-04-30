"""
ChartOfAccountViewSet mixin — Migration Execution Engine session endpoints
(Phase-6: create-session, dry-run, session detail, approve, execute,
blockers). Inherited by `ChartOfAccountViewSet`.
"""
from .base import (
    status, Response, action,
)


class COAMigrationSessionMixin:
    """@action methods for the migration session lifecycle."""

    @action(detail=False, methods=['post'], url_path='coa-migration/create-session')
    def migration_session_create(self, request):
        """Create a new DRAFT migration session for the current org."""
        from apps.finance.models.coa_template import COATemplate, COAMigrationSession

        source_key = request.data.get('source_template_key')
        target_key = request.data.get('target_template_key')
        migration_date = request.data.get('migration_date')

        source = COATemplate.objects.filter(key=source_key).first()
        target = COATemplate.objects.filter(key=target_key).first()
        if not source or not target:
            return Response({'error': 'Source or target template not found'}, status=status.HTTP_404_NOT_FOUND)

        # Check for existing active session
        existing = COAMigrationSession.objects.filter(
            organization=request.organization,
            status__in=['DRAFT', 'DRY_RUN', 'APPROVED', 'EXECUTING'],
        ).first()
        if existing:
            return Response({
                'error': f'Active migration session already exists (id={existing.id}, status={existing.status})',
                'session_id': existing.id,
            }, status=status.HTTP_409_CONFLICT)

        session = COAMigrationSession.objects.create(
            organization=request.organization,
            source_template=source,
            target_template=target,
            migration_date=migration_date,
            status='DRAFT',
        )
        return Response({
            'session_id': session.id,
            'status': session.status,
            'source_key': source.key,
            'target_key': target.key,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='coa-migration/dry-run')
    def migration_session_dry_run(self, request):
        """Run dry-run analysis on an existing session — populates account plans."""
        from apps.finance.models.coa_template import COAMigrationSession
        from apps.finance.services.coa_migration_engine import run_dry_run

        session_id = request.data.get('session_id')
        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            report = run_dry_run(session)
            return Response({
                'session_id': session.id,
                'status': session.status,
                'report': report,
            })
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='coa-migration/session/(?P<session_id>[0-9]+)')
    def migration_session_detail(self, request, session_id=None):
        """Get session details with all account plans."""
        from apps.finance.models.coa_template import COAMigrationSession

        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        plans = session.account_plans.select_related('source_account').order_by(
            'migration_mode', 'source_account__code'
        )

        plans_data = []
        for p in plans:
            plans_data.append({
                'id': p.id,
                'source_code': p.source_account.code if p.source_account else '',
                'source_name': p.source_account.name if p.source_account else '',
                'source_type': p.source_account.type if p.source_account else '',
                'target_code': p.target_account_code,
                'target_name': p.target_account_name,
                'migration_mode': p.migration_mode,
                'is_mode_overridden': p.is_mode_overridden,
                'balance': float(p.balance_at_migration) if p.balance_at_migration else 0,
                'journal_lines': p.journal_line_count,
                'posting_rules': p.posting_rule_count,
                'financial_accounts': p.financial_account_count,
                'children': p.children_count,
                'historically_locked': p.historically_locked,
                'allocation_percent': float(p.allocation_percent) if p.allocation_percent else None,
                'group_key': p.group_key,
                'is_executed': p.is_executed,
            })

        return Response({
            'session': {
                'id': session.id,
                'source_key': session.source_template.key,
                'source_name': session.source_template.name,
                'target_key': session.target_template.key,
                'target_name': session.target_template.name,
                'migration_date': session.migration_date.isoformat() if session.migration_date else None,
                'status': session.status,
                'version': session.version,
                'is_locked': session.is_locked,
                'dry_run_report': session.dry_run_report,
                'created_at': session.created_at.isoformat(),
            },
            'plans': plans_data,
            'total': len(plans_data),
        })

    @action(detail=False, methods=['post'], url_path='coa-migration/approve')
    def migration_session_approve(self, request):
        """Approve a DRY_RUN session for execution."""
        from apps.finance.models.coa_template import COAMigrationSession
        from apps.finance.services.coa_migration_engine import approve_session

        session_id = request.data.get('session_id')
        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            result = approve_session(session, user=request.user)
            return Response({'session_id': session.id, **result})
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='coa-migration/execute')
    def migration_session_execute(self, request):
        """Execute an approved migration session."""
        from apps.finance.models.coa_template import COAMigrationSession
        from apps.finance.services.coa_migration_engine import execute_migration

        session_id = request.data.get('session_id')
        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            report = execute_migration(session, user=request.user)
            return Response({'session_id': session.id, 'status': session.status, 'report': report})
        except ValueError as e:
            return Response({'error': str(e), 'session_id': session.id}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': str(e), 'session_id': session.id}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'], url_path='coa-migration/blockers/(?P<session_id>[0-9]+)')
    def migration_session_blockers(self, request, session_id=None):
        """Check pre-execution blockers for a session."""
        from apps.finance.models.coa_template import COAMigrationSession
        from apps.finance.services.coa_migration_engine import run_blocker_checks

        session = COAMigrationSession.objects.filter(
            id=session_id, organization=request.organization,
        ).first()
        if not session:
            return Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)

        blockers = run_blocker_checks(session)
        return Response({
            'session_id': session.id,
            'blocker_count': len([b for b in blockers if b['severity'] == 'BLOCKER']),
            'warning_count': len([b for b in blockers if b['severity'] == 'WARNING']),
            'blockers': blockers,
            'can_proceed': all(b['severity'] != 'BLOCKER' for b in blockers),
        })
