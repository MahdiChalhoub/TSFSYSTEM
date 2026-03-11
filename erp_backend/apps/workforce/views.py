from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import ScoreRule, EmployeeScoreEvent, EmployeeScoreSummary, EmployeeBadge, EmployeeScorePeriod
from .serializers import (
    ScoreRuleSerializer, EmployeeScoreEventSerializer,
    EmployeeScoreSummarySerializer, EmployeeBadgeSerializer, EmployeeScorePeriodSerializer
)
from .services import WorkforceScoreEngine


class ScoreRuleViewSet(viewsets.ModelViewSet):
    """
    CRUD for dynamic scoring rules.
    GET  /api/workforce/rules/            → list all active rules
    POST /api/workforce/rules/            → create rule
    """
    queryset = ScoreRule.objects.all()
    serializer_class = ScoreRuleSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'module', 'event_code']
    ordering_fields = ['module', 'base_points', 'is_active']

    def get_queryset(self):
        return self.queryset.filter(organization=self.request.user.organization)

    @action(detail=False, methods=['GET'])
    def by_module(self, request):
        """Returns rules grouped by module."""
        module = request.query_params.get('module')
        qs = self.get_queryset().filter(is_active=True)
        if module:
            qs = qs.filter(module=module)
        serializer = self.get_serializer(qs.order_by('module', 'dimension'), many=True)
        return Response(serializer.data)


class EmployeeScoreEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ledger of all score events.
    GET  /api/workforce/events/?employee=1
    POST /api/workforce/events/{id}/reverse/  → reverses a single event
    """
    queryset = EmployeeScoreEvent.objects.all()
    serializer_class = EmployeeScoreEventSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['employee__user__first_name', 'employee__user__last_name', 'event_code', 'reference_number']
    ordering_fields = ['event_at', 'final_points', 'severity_level']

    def get_queryset(self):
        qs = self.queryset.filter(organization=self.request.user.organization)
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        module = self.request.query_params.get('module')
        if module:
            qs = qs.filter(module=module)
        direction = self.request.query_params.get('direction')
        if direction:
            qs = qs.filter(direction=direction)
        return qs.order_by('-event_at')

    @action(detail=True, methods=['POST'])
    def reverse(self, request, pk=None):
        """Reverse a confirmed event and recompute the employee's summary."""
        event = self.get_object()
        if event.status == 'REVERSED':
            return Response({'error': 'Event is already reversed.'}, status=400)
        if not event.can_be_reversed if hasattr(event, 'can_be_reversed') else False:
            return Response({'error': 'This event type cannot be reversed.'}, status=403)

        event.status = 'REVERSED'
        event.save(update_fields=['status'])

        # Recompute summary for the affected employee
        WorkforceScoreEngine.update_employee_summary(event.employee)
        WorkforceScoreEngine.rank_employees(event.employee.organization_id)

        return Response({'success': True, 'message': f'Event #{event.id} reversed and summary recomputed.'})


class EmployeeScoreSummaryViewSet(viewsets.ModelViewSet):
    """
    Live performance summaries.
    GET /api/workforce/summaries/leaderboard/   → top 10 by global score
    GET /api/workforce/summaries/my_summary/    → authenticated user's summary
    POST /api/workforce/summaries/adjust/       → manual adjustment
    """
    queryset = EmployeeScoreSummary.objects.all()
    serializer_class = EmployeeScoreSummarySerializer
    filter_backends = [filters.OrderingFilter, filters.SearchFilter]
    ordering_fields = ['global_score', 'net_points', 'last_event_at', 'current_rank_company']
    search_fields = ['employee__user__first_name', 'employee__user__last_name']

    def get_queryset(self):
        qs = self.queryset.filter(organization=self.request.user.organization)
        risk = self.request.query_params.get('risk_level')
        if risk:
            qs = qs.filter(risk_level=risk)
        badge = self.request.query_params.get('badge_level')
        if badge:
            qs = qs.filter(badge_level=badge)
        # Per-employee lookup (used by profile page)
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs.select_related('employee', 'employee__user')

    @staticmethod
    def _attach_trend_data(summaries):
        """
        Pre-fetches previous period scores and attaches them as `_last_period_score`
        to avoid N+1 queries during serialization.
        """
        from django.utils import timezone
        last_month = (timezone.now().replace(day=1) - timezone.timedelta(days=1))
        period_key = last_month.strftime('%Y-%m')

        emp_ids = [s.employee_id for s in summaries]
        periods = EmployeeScorePeriod.objects.filter(
            employee_id__in=emp_ids,
            period_type='MONTHLY',
            period_key=period_key
        ).values('employee_id', 'global_score')

        period_map = {p['employee_id']: float(p['global_score']) for p in periods}
        for summary in summaries:
            summary._last_period_score = period_map.get(summary.employee_id)  # None = no prior period
        return summaries

    @action(detail=False, methods=['GET'])
    def leaderboard(self, request):
        """Top performers by global intelligence score, sorted by rank."""
        limit = int(request.query_params.get('limit', 10))
        qs = list(self.get_queryset().order_by('current_rank_company')[:limit])
        qs = self._attach_trend_data(qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['GET'])
    def my_summary(self, request):
        """Returns the authenticated user's own WISE summary."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response({'error': 'No employee record linked to this user.'}, status=404)

        summary = EmployeeScoreSummary.objects.filter(employee=employee).first()
        if not summary:
            return Response({'error': 'No WISE summary found. Trigger a scoring event first.'}, status=404)

        serializer = self.get_serializer(summary)
        return Response(serializer.data)

    @action(detail=False, methods=['POST'])
    def adjust(self, request):
        """
        Manual score adjustment by a manager.
        Payload: { employee_id, points, dimension, score_family, reason, adjustment_type }
        """
        from apps.hr.models import Employee
        from .models import EmployeeScoreAdjustment, ScoreDimension, ScoreFamily

        data = request.data
        employee_id = data.get('employee_id')
        points_raw = float(data.get('points', 0))
        dimension = data.get('dimension', ScoreDimension.PRODUCTIVITY)
        score_family = data.get('score_family', ScoreFamily.PERFORMANCE)
        reason = data.get('reason', 'Manual adjustment')
        adjustment_type = data.get('adjustment_type', 'CORRECTION')

        try:
            employee = Employee.objects.get(id=employee_id, organization=request.user.organization)
        except Employee.DoesNotExist:
            return Response({'error': 'Employee not found.'}, status=404)

        if points_raw <= 0:
            return Response({'error': 'Points must be a positive number.'}, status=400)
        if not reason.strip():
            return Response({'error': 'A reason is required for all manual adjustments.'}, status=400)

        # Record the audit trail
        EmployeeScoreAdjustment.objects.create(
            organization=request.user.organization,
            employee=employee,
            adjustment_type=adjustment_type,
            points=points_raw,
            dimension=dimension,
            score_family=score_family,
            reason=reason,
            requested_by=request.user
        )

        # Directly insert a score event with the correct direction + magnitude
        from .models import (
            ScoreDirection, PriorityLevel, SeverityLevel, ConfidenceLevel
        )
        direction = ScoreDirection.NEGATIVE if adjustment_type == 'PENALTY' else ScoreDirection.POSITIVE
        from decimal import Decimal
        event = EmployeeScoreEvent.objects.create(
            organization=request.user.organization,
            employee=employee,
            branch=employee.site,
            department=employee.department,
            module='manual',
            event_type='manual_adjustment',
            event_code='manual_bonus' if direction == ScoreDirection.POSITIVE else 'manual_penalty',
            direction=direction,
            base_points=Decimal(str(points_raw)),
            final_points=Decimal(str(points_raw)),
            dimension=dimension,
            score_family=score_family,
            priority_level=PriorityLevel.NORMAL,
            severity_level=SeverityLevel.MEDIUM,
            confidence_level=ConfidenceLevel.VERIFIED,
            status='CONFIRMED',
            is_manual=True,
            is_system_generated=False,
            notes=reason,
            created_by=request.user,
            approved_by=request.user,
        )

        # Recompute summary
        WorkforceScoreEngine.update_employee_summary(employee)
        WorkforceScoreEngine.rank_employees(employee.organization_id)

        return Response({
            'success': True,
            'message': f'{adjustment_type.title()} of {points_raw} pts applied to {employee}.',
            'event_id': event.id
        })

    @action(detail=False, methods=['GET'])
    def risk_heatmap(self, request):
        """Returns all employees with risk level != STABLE for the manager heatmap."""
        qs = list(self.get_queryset().exclude(risk_level='STABLE').order_by('risk_level', '-global_score'))
        qs = self._attach_trend_data(qs)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['GET'])
    def statistics(self, request):
        """
        Returns org-level WISE aggregate analytics in a single DB round-trip.

        GET /api/workforce/summaries/statistics/

        Response:
          {
            "total_employees": 42,
            "avg_global_score": 61.4,
            "median_global_score": 63.2,
            "min_global_score": 22.1,
            "max_global_score": 91.5,
            "at_risk_count": 5,
            "critical_count": 1,
            "stable_count": 37,
            "badge_distribution": { "PLATINUM": 2, "GOLD": 5, ... },
            "risk_distribution": { "STABLE": 37, "AT_RISK": 3, ... },
            "avg_event_count": 8.7,
            "avg_performance_score": 60.1,
            "avg_compliance_score": 58.9,
            "avg_attendance_score": 65.2,
          }
        """
        from django.db.models import Avg, Min, Max, Count, Q
        qs = self.get_queryset()

        agg = qs.aggregate(
            total=Count('id'),
            avg_global=Avg('global_score'),
            min_global=Min('global_score'),
            max_global=Max('global_score'),
            avg_performance=Avg('performance_score'),
            avg_trust=Avg('trust_score'),
            avg_compliance=Avg('compliance_score'),
            avg_reliability=Avg('reliability_score'),
            avg_leadership=Avg('leadership_score'),
            avg_attendance=Avg('attendance_score'),
            avg_events=Avg('event_count'),
            at_risk=Count('id', filter=Q(risk_level='AT_RISK')),
            high_risk=Count('id', filter=Q(risk_level='HIGH_RISK')),
            critical=Count('id', filter=Q(risk_level='CRITICAL')),
            stable=Count('id', filter=Q(risk_level='STABLE')),
        )

        # Badge distribution
        badge_dist = {
            row['badge_level']: row['cnt']
            for row in qs.values('badge_level').annotate(cnt=Count('id'))
        }

        def rnd(val):
            return round(float(val), 1) if val is not None else None

        return Response({
            'total_employees':       agg['total'] or 0,
            'avg_global_score':      rnd(agg['avg_global']),
            'min_global_score':      rnd(agg['min_global']),
            'max_global_score':      rnd(agg['max_global']),
            'avg_performance_score': rnd(agg['avg_performance']),
            'avg_trust_score':       rnd(agg['avg_trust']),
            'avg_compliance_score':  rnd(agg['avg_compliance']),
            'avg_reliability_score': rnd(agg['avg_reliability']),
            'avg_leadership_score':  rnd(agg['avg_leadership']),
            'avg_attendance_score':  rnd(agg['avg_attendance']),
            'avg_event_count':       rnd(agg['avg_events']),
            'risk_distribution': {
                'STABLE':    agg['stable']    or 0,
                'AT_RISK':   agg['at_risk']   or 0,
                'HIGH_RISK': agg['high_risk'] or 0,
                'CRITICAL':  agg['critical']  or 0,
            },
            'badge_distribution': badge_dist,
            'at_risk_count':      (agg['at_risk'] or 0) + (agg['high_risk'] or 0) + (agg['critical'] or 0),
        })

    @action(detail=False, methods=['GET'])
    def my_performance(self, request):
        """
        Alias of my_summary — returns the authenticated user's own WISE summary.
        Referenced by the frontend page at /workspace/performance.
        """
        return self.my_summary(request)


class EmployeeBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only badge ledger.
    GET /api/workforce/badges/?employee=1
    """
    queryset = EmployeeBadge.objects.all()
    serializer_class = EmployeeBadgeSerializer

    def get_queryset(self):
        qs = self.queryset.filter(organization=self.request.user.organization)
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs.order_by('-awarded_at')


class EmployeeScorePeriodViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Historical period snapshots for trend analysis.
    GET /api/workforce/periods/?employee=1&type=MONTHLY
    """
    queryset = EmployeeScorePeriod.objects.all()
    serializer_class = EmployeeScorePeriodSerializer

    def get_queryset(self):
        qs = self.queryset.filter(organization=self.request.user.organization)
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        # Support both ?type= (legacy) and ?period_type= (new)
        period_type = self.request.query_params.get('period_type') \
                   or self.request.query_params.get('type', 'MONTHLY')
        return qs.filter(period_type=period_type).order_by('period_key')
