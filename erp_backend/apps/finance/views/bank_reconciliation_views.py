"""
Bank Reconciliation Views
==========================
API endpoints for bank statement import and reconciliation.

Endpoints:
- POST /api/finance/bank-statements/import/ - Import bank statement from file
- GET /api/finance/bank-statements/ - List statements
- GET /api/finance/bank-statements/{id}/ - Get statement detail
- POST /api/finance/bank-statements/{id}/auto-match/ - Run auto-matching
- POST /api/finance/bank-statements/{id}/manual-match/ - Manually match a line
- POST /api/finance/bank-statements/{id}/unmatch/ - Unmatch a line
- POST /api/finance/bank-statements/{id}/start-session/ - Start reconciliation session
- POST /api/finance/bank-statements/{id}/complete-session/ - Complete session
- GET /api/finance/bank-statements/{id}/report/ - Get reconciliation report
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from erp.views_base import TenantModelViewSet
from kernel.performance import profile_view
from apps.finance.models.bank_reconciliation_models import (
    BankStatement, BankStatementLine, ReconciliationSession
)
from apps.finance.serializers.bank_reconciliation_serializers import (
    BankStatementSerializer,
    BankStatementLineSerializer,
    BankStatementImportSerializer,
    ReconciliationSessionSerializer,
    AutoMatchRequestSerializer,
    ManualMatchSerializer,
    ReconciliationReportSerializer,
)
from apps.finance.services.bank_statement_import_service import BankStatementImportService
from apps.finance.services.bank_reconciliation_service import BankReconciliationService


class BankStatementViewSet(TenantModelViewSet):
    """ViewSet for bank statements."""

    serializer_class = BankStatementSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['account', 'status', 'statement_date']
    search_fields = ['statement_number', 'notes']
    ordering_fields = ['statement_date', 'created_at', 'status']
    ordering = ['-statement_date', '-id']

    @profile_view
    def get_queryset(self):
        """Get statements for current organization."""
        return BankStatement.objects.filter(
            organization=self.request.tenant
        ).select_related('account', 'reconciled_by').prefetch_related('lines')

    @action(detail=False, methods=['post'], serializer_class=BankStatementImportSerializer)
    def import_statement(self, request):
        """
        Import bank statement from CSV/Excel file.

        Request:
            POST /api/finance/bank-statements/import/
            Content-Type: multipart/form-data

            {
                "account": 123,
                "statement_date": "2024-03-12",
                "statement_number": "ST-2024-03",
                "file": <uploaded file>,
                "file_format": "AUTO"
            }

        Response:
            {
                "id": 456,
                "status": "IMPORTED",
                "total_lines": 45,
                "errors": [],
                "warnings": ["Line 5: Could not parse date"]
            }
        """
        serializer = BankStatementImportSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        account = serializer.validated_data['account']
        statement_date = serializer.validated_data['statement_date']
        statement_number = serializer.validated_data.get('statement_number')
        uploaded_file = serializer.validated_data['file']
        file_format = serializer.validated_data['file_format']

        # Import statement
        import_service = BankStatementImportService(
            organization=request.tenant,
            account=account,
            uploaded_file=uploaded_file
        )

        try:
            statement = import_service.import_statement(
                statement_date=statement_date,
                statement_number=statement_number,
                file_format=file_format
            )

            return Response({
                'id': statement.id,
                'status': statement.status,
                'total_lines': statement.total_lines,
                'matched_count': statement.matched_count,
                'unmatched_count': statement.unmatched_count,
                'errors': import_service.get_errors(),
                'warnings': import_service.get_warnings(),
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'error': str(e),
                'errors': import_service.get_errors(),
                'warnings': import_service.get_warnings(),
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], serializer_class=AutoMatchRequestSerializer)
    def auto_match(self, request, pk=None):
        """
        Run auto-matching algorithm on statement.

        Request:
            POST /api/finance/bank-statements/{id}/auto-match/
            {
                "min_confidence": 0.8
            }

        Response:
            {
                "matches_found": 25,
                "matches_applied": 25,
                "errors": 0,
                "statement_status": "PARTIAL"
            }
        """
        statement = self.get_object()

        serializer = AutoMatchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        min_confidence = serializer.validated_data['min_confidence']

        # Run auto-matching
        recon_service = BankReconciliationService(statement)
        matches = recon_service.auto_match_all(min_confidence=min_confidence)

        # Apply matches
        stats = recon_service.apply_matches(matches, user=request.user)

        # Refresh statement
        statement.refresh_from_db()

        return Response({
            'matches_found': len(matches),
            'matches_applied': stats['matched'],
            'errors': stats['errors'],
            'statement_status': statement.status,
            'matched_count': statement.matched_count,
            'unmatched_count': statement.unmatched_count,
        })

    @action(detail=True, methods=['post'], serializer_class=ManualMatchSerializer)
    def manual_match(self, request, pk=None):
        """
        Manually match a statement line to journal entry line.

        Request:
            POST /api/finance/bank-statements/{id}/manual-match/
            {
                "statement_line_id": 789,
                "journal_entry_line_id": 456
            }

        Response:
            {
                "success": true,
                "statement_status": "PARTIAL"
            }
        """
        statement = self.get_object()

        serializer = ManualMatchSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        statement_line = serializer.validated_data['statement_line']
        journal_line = serializer.validated_data['journal_line']

        # Validate line belongs to this statement
        if statement_line.statement != statement:
            return Response({
                'error': 'Statement line does not belong to this statement'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Apply manual match
        recon_service = BankReconciliationService(statement)
        success = recon_service.manual_match(statement_line, journal_line, request.user)

        if not success:
            return Response({
                'error': 'Match validation failed. Amounts or dates may be too different.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Refresh statement
        statement.refresh_from_db()

        return Response({
            'success': True,
            'statement_status': statement.status,
            'matched_count': statement.matched_count,
            'unmatched_count': statement.unmatched_count,
        })

    @action(detail=True, methods=['post'])
    def unmatch(self, request, pk=None):
        """
        Remove match from a statement line.

        Request:
            POST /api/finance/bank-statements/{id}/unmatch/
            {
                "statement_line_id": 789
            }

        Response:
            {
                "success": true
            }
        """
        statement = self.get_object()

        statement_line_id = request.data.get('statement_line_id')
        if not statement_line_id:
            return Response({
                'error': 'statement_line_id is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            statement_line = BankStatementLine.objects.get(
                id=statement_line_id,
                statement=statement,
                organization=request.tenant
            )
        except BankStatementLine.DoesNotExist:
            return Response({
                'error': 'Statement line not found'
            }, status=status.HTTP_404_NOT_FOUND)

        # Unmatch
        recon_service = BankReconciliationService(statement)
        success = recon_service.unmatch_line(statement_line)

        # Refresh statement
        statement.refresh_from_db()

        return Response({
            'success': success,
            'statement_status': statement.status,
            'matched_count': statement.matched_count,
            'unmatched_count': statement.unmatched_count,
        })

    @action(detail=True, methods=['post'])
    def start_session(self, request, pk=None):
        """
        Start a reconciliation session.

        Request:
            POST /api/finance/bank-statements/{id}/start-session/

        Response:
            {
                "session_id": 123,
                "started_at": "2024-03-12T10:30:00Z"
            }
        """
        statement = self.get_object()

        # Check if there's already an active session
        active_session = ReconciliationSession.objects.filter(
            statement=statement,
            status='IN_PROGRESS'
        ).first()

        if active_session:
            return Response({
                'error': 'Active session already exists',
                'session_id': active_session.id
            }, status=status.HTTP_400_BAD_REQUEST)

        # Start new session
        recon_service = BankReconciliationService(statement)
        session = recon_service.start_session(user=request.user)

        return Response({
            'session_id': session.id,
            'started_at': session.started_at,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def complete_session(self, request, pk=None):
        """
        Complete a reconciliation session.

        Request:
            POST /api/finance/bank-statements/{id}/complete-session/
            {
                "session_id": 123,
                "notes": "Reconciliation complete"
            }

        Response:
            {
                "success": true,
                "duration_seconds": 1200,
                "auto_matched_count": 20,
                "manual_matched_count": 5,
                "unmatched_count": 0
            }
        """
        statement = self.get_object()

        session_id = request.data.get('session_id')
        notes = request.data.get('notes', '')

        try:
            session = ReconciliationSession.objects.get(
                id=session_id,
                statement=statement,
                organization=request.tenant
            )
        except ReconciliationSession.DoesNotExist:
            return Response({
                'error': 'Session not found'
            }, status=status.HTTP_404_NOT_FOUND)

        if session.status != 'IN_PROGRESS':
            return Response({
                'error': f'Session is already {session.status}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update notes if provided
        if notes:
            session.notes = notes

        # Complete session
        recon_service = BankReconciliationService(statement)
        recon_service.complete_session(session)

        return Response({
            'success': True,
            'duration_seconds': session.duration_seconds,
            'auto_matched_count': session.auto_matched_count,
            'manual_matched_count': session.manual_matched_count,
            'unmatched_count': session.unmatched_count,
        })

    @action(detail=True, methods=['get'])
    def report(self, request, pk=None):
        """
        Get reconciliation report for statement.

        Request:
            GET /api/finance/bank-statements/{id}/report/

        Response:
            {
                "statement_date": "2024-03-12",
                "opening_balance": "10000.00",
                "closing_balance": "12500.00",
                "variance": "0.00",
                "matched_count": 45,
                "unmatched_count": 0,
                "reconciliation_percentage": 100.0
            }
        """
        statement = self.get_object()

        recon_service = BankReconciliationService(statement)
        report_data = recon_service.get_reconciliation_report()

        serializer = ReconciliationReportSerializer(report_data)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def unmatched_lines(self, request, pk=None):
        """
        Get unmatched statement lines.

        Request:
            GET /api/finance/bank-statements/{id}/unmatched-lines/

        Response:
            [
                {
                    "id": 123,
                    "transaction_date": "2024-03-12",
                    "description": "Payment from customer",
                    "debit_amount": "500.00",
                    "suggested_entry_id": 456,
                    "match_confidence": 0.85
                },
                ...
            ]
        """
        statement = self.get_object()

        unmatched_lines = statement.lines.filter(is_matched=False)
        serializer = BankStatementLineSerializer(unmatched_lines, many=True)

        return Response(serializer.data)


class ReconciliationSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for reconciliation sessions (read-only)."""

    serializer_class = ReconciliationSessionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['statement', 'status', 'started_by']
    ordering = ['-started_at']

    def get_queryset(self):
        """Get sessions for current organization."""
        return ReconciliationSession.objects.filter(
            organization=self.request.tenant
        ).select_related('statement', 'started_by')
