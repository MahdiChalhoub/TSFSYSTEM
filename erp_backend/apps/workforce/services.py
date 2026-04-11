import logging
from decimal import Decimal
from django.utils import timezone
from django.db import transaction, models
from django.contrib.contenttypes.models import ContentType
from .models import (
    ScoreRule, EmployeeScoreEvent, EmployeeScoreSummary, 
    EmployeeScoreAdjustment, ScoreDirection, PriorityLevel, 
    SeverityLevel, ConfidenceLevel, BadgeLevel, RiskLevel
)

logger = logging.getLogger(__name__)

# Connector Governance Layer — all cross-module access goes through here
from erp.connector_registry import connector

# Module-level Employee resolution (used by events.py, admin.py, views.py)
Employee = connector.require('hr.employees.get_model', org_id=0, source='workforce')

class WorkforceScoreEngine:
    """
    Central engine for workforce performance and trust scoring.
    Handles event ingestion, point calculation, and summary aggregation.
    """

    @staticmethod
    def record_event(employee, event_code, module, reference_obj=None, **kwargs):
        """
        Main entry point for recording an action.
        """
        try:
            rule = ScoreRule.objects.filter(
                organization_id=employee.organization_id,
                event_code=event_code,
                module=module,
                is_active=True
            ).first()

            if not rule:
                logger.debug(f"WISE: No active rule found for {module}.{event_code}")
                return None

            # 1. Base values from rule
            base_points = rule.base_points
            priority = kwargs.get('priority', rule.default_priority)
            severity = kwargs.get('severity', rule.default_severity)
            confidence = kwargs.get('confidence', rule.default_confidence)

            # 2. Multipliers
            p_mult = WorkforceScoreEngine.get_priority_multiplier(priority)
            s_mult = WorkforceScoreEngine.get_severity_multiplier(severity)
            c_mult = WorkforceScoreEngine.get_confidence_multiplier(confidence)
            
            # Recency (always 1.0 for new events)
            recency = Decimal('1.00')

            # 3. Final Points Calculation
            final_points = base_points * p_mult * s_mult * c_mult
            
            # 4. Anti-abuse Check (Caps)
            if rule.daily_cap or rule.monthly_cap:
                now = timezone.now()
                # Aggregate points for this specific rule and employee in the current periods
                caps_stats = EmployeeScoreEvent.objects.filter(
                    employee=employee,
                    event_code=event_code,
                    status='CONFIRMED'
                ).aggregate(
                    daily=models.Sum('final_points', filter=models.Q(event_at__date=now.date())),
                    monthly=models.Sum('final_points', filter=models.Q(event_at__year=now.year, event_at__month=now.month))
                )
                
                if rule.daily_cap and (caps_stats['daily'] or 0) >= rule.daily_cap:
                    logger.warning(f"WISE: Daily cap reached for {employee} on {event_code}")
                    return None
                if rule.monthly_cap and (caps_stats['monthly'] or 0) >= rule.monthly_cap:
                    logger.warning(f"WISE: Monthly cap reached for {employee} on {event_code}")
                    return None

            with transaction.atomic():
                # 5. Create Event
                event = EmployeeScoreEvent.objects.create(
                    organization_id=employee.organization_id,
                    employee=employee,
                    branch=employee.site,
                    department=employee.department,
                    module=module,
                    event_type=rule.event_type,
                    event_code=event_code,
                    direction=rule.direction,
                    base_points=base_points,
                    final_points=final_points,
                    priority_level=priority,
                    priority_multiplier=p_mult,
                    severity_level=severity,
                    severity_multiplier=s_mult,
                    confidence_level=confidence,
                    confidence_multiplier=c_mult,
                    dimension=rule.dimension,
                    score_family=rule.score_family,
                    reference_object=reference_obj,
                    reference_number=getattr(reference_obj, 'reference_number', None) or getattr(reference_obj, 'code', None),
                    created_by=kwargs.get('executor'),
                    metadata_json=kwargs.get('metadata', {})
                )

                # 6. Update Summary & Rankings
                WorkforceScoreEngine.update_employee_summary(employee)
                WorkforceScoreEngine.rank_employees(employee.organization_id)
                
                return event

        except Exception as e:
            logger.error(f"WISE: Failed to record event {event_code}: {str(e)}")
            return None

    @staticmethod
    def update_employee_summary(employee):
        """
        Recomputes or incrementally updates the summary for an employee.
        """
        from kernel.events import emit_event

        summary, created = EmployeeScoreSummary.objects.get_or_create(
            employee=employee,
            defaults={
                'organization_id': employee.organization_id,
                'branch': employee.site,
                'department': employee.department
            }
        )

        old_risk_level = summary.risk_level

        # ── Single-pass aggregation: global metrics + per-family subtotals ────
        stats = EmployeeScoreEvent.objects.filter(
            employee=employee,
            status='CONFIRMED'
        ).aggregate(
            pos_sum   = models.Sum('final_points', filter=models.Q(direction=ScoreDirection.POSITIVE)),
            neg_sum   = models.Sum('final_points', filter=models.Q(direction=ScoreDirection.NEGATIVE)),
            crit_count= models.Count('id', filter=models.Q(severity_level=SeverityLevel.CRITICAL,
                                                           direction=ScoreDirection.NEGATIVE)),
            warn_count= models.Count('id', filter=models.Q(direction=ScoreDirection.NEGATIVE,
                                                           severity_level__in=[SeverityLevel.MEDIUM, SeverityLevel.MAJOR])),
            reward_count= models.Count('id', filter=models.Q(direction=ScoreDirection.POSITIVE)),
            total_count = models.Count('id'),
            family_perf = models.Sum('final_points', filter=models.Q(score_family='PERFORMANCE')),
            family_trust= models.Sum('final_points', filter=models.Q(score_family='TRUST')),
            family_comp = models.Sum('final_points', filter=models.Q(score_family='COMPLIANCE')),
            family_rel  = models.Sum('final_points', filter=models.Q(score_family='RELIABILITY')),
            family_lead = models.Sum('final_points', filter=models.Q(score_family='LEADERSHIP')),
        )

        pos_sum  = stats['pos_sum']   or Decimal('0.00')
        neg_sum  = stats['neg_sum']   or Decimal('0.00')
        net      = pos_sum - neg_sum

        summary.total_positive_points  = pos_sum
        summary.total_negative_points  = neg_sum
        summary.net_points             = net
        summary.event_count            = stats['total_count']   or 0
        summary.critical_negative_count= stats['crit_count']    or 0
        summary.warning_count          = stats['warn_count']    or 0
        summary.reward_count           = stats['reward_count']  or 0

        # ── Score family scores ───────────────────────────────────────────────
        summary.performance_score  = WorkforceScoreEngine.normalize_score(stats['family_perf']  or 0)
        summary.trust_score        = WorkforceScoreEngine.normalize_score(stats['family_trust'] or 0)
        summary.compliance_score   = WorkforceScoreEngine.normalize_score(stats['family_comp']  or 0)
        summary.reliability_score  = WorkforceScoreEngine.normalize_score(stats['family_rel']   or 0)
        summary.leadership_score   = WorkforceScoreEngine.normalize_score(stats['family_lead']  or 0)

        # ── Dimension scores (net per dimension, caps via normalize) ──────────
        dimension_stats = EmployeeScoreEvent.objects.filter(
            employee=employee,
            status='CONFIRMED'
        ).values('dimension').annotate(
            pos=models.Sum('final_points', filter=models.Q(direction=ScoreDirection.POSITIVE)),
            neg=models.Sum('final_points', filter=models.Q(direction=ScoreDirection.NEGATIVE)),
        )

        dim_field_map = {
            'PRODUCTIVITY':          'productivity_score',
            'ACCURACY':              'accuracy_score',
            'TIMELINESS':            'timeliness_score',
            'CUSTOMER_IMPACT':       'customer_score',
            'ATTENDANCE':            'attendance_score',
            'FINANCIAL_DISCIPLINE':  'financial_discipline_score',
            'INVENTORY_DISCIPLINE':  'inventory_discipline_score',
            'TEAMWORK':              'teamwork_score',
            'COMPLIANCE':            'compliance_score',
            'LEADERSHIP':            'leadership_score',
        }

        for ds in dimension_stats:
            field = dim_field_map.get(ds['dimension'])
            if field:
                dim_net = (ds['pos'] or Decimal('0')) - (ds['neg'] or Decimal('0'))
                setattr(summary, field, WorkforceScoreEngine.normalize_score(dim_net))

        # ── Global intelligence score ─────────────────────────────────────────
        # Weighted average of family scores for a holistic view
        family_weights = {
            'performance_score': Decimal('0.30'),
            'trust_score':       Decimal('0.25'),
            'compliance_score':  Decimal('0.20'),
            'reliability_score': Decimal('0.15'),
            'leadership_score':  Decimal('0.10'),
        }
        weighted = sum(
            getattr(summary, field) * w
            for field, w in family_weights.items()
        )
        # Also factor in raw net score direction so severe negatives drag the global
        raw_component = WorkforceScoreEngine.normalize_score(net)
        summary.global_score = max(
            Decimal('0.00'),
            min(
                (weighted * Decimal('0.70')) + (raw_component * Decimal('0.30')),
                Decimal('100.00')
            )
        )

        summary.badge_level = WorkforceScoreEngine.determine_badge(summary.global_score)
        summary.risk_level  = WorkforceScoreEngine.determine_risk(summary.global_score, summary.critical_negative_count)

        # ── Risk escalation event ─────────────────────────────────────────────
        risk_priorities = {
            RiskLevel.STABLE: 0, RiskLevel.AT_RISK: 1,
            RiskLevel.HIGH_RISK: 2, RiskLevel.CRITICAL: 3
        }
        if risk_priorities.get(summary.risk_level, 0) > risk_priorities.get(old_risk_level, 0):
            if summary.risk_level in (RiskLevel.HIGH_RISK, RiskLevel.CRITICAL):
                emit_event('workforce.risk_increased', {
                    'employee_id':   employee.id,
                    'employee_name': str(employee),
                    'old_risk':      old_risk_level,
                    'new_risk':      summary.risk_level,
                    'global_score':  float(summary.global_score),
                    'critical_count':summary.critical_negative_count,
                    'organization_id':     employee.organization_id
                })

        summary.last_event_at = timezone.now()
        summary.save()

    @staticmethod
    def get_priority_multiplier(level):
        mappings = {
            PriorityLevel.LOW: Decimal('0.75'),
            PriorityLevel.NORMAL: Decimal('1.00'),
            PriorityLevel.HIGH: Decimal('1.25'),
            PriorityLevel.CRITICAL: Decimal('1.60'),
            PriorityLevel.EMERGENCY: Decimal('2.00'),
        }
        return mappings.get(level, Decimal('1.00'))

    @staticmethod
    def get_severity_multiplier(level):
        mappings = {
            SeverityLevel.MINOR: Decimal('0.80'),
            SeverityLevel.MEDIUM: Decimal('1.00'),
            SeverityLevel.MAJOR: Decimal('1.40'),
            SeverityLevel.CRITICAL: Decimal('1.80'),
        }
        return mappings.get(level, Decimal('1.00'))

    @staticmethod
    def get_confidence_multiplier(level):
        mappings = {
            ConfidenceLevel.LOW: Decimal('0.60'),
            ConfidenceLevel.MEDIUM: Decimal('0.80'),
            ConfidenceLevel.HIGH: Decimal('1.00'),
            ConfidenceLevel.VERIFIED: Decimal('1.10'),
        }
        return mappings.get(level, Decimal('1.00'))

    @staticmethod
    def normalize_score(raw_points):
        """
        Converts raw net_points into a 0-100 score using an S-curve (logistic)
        so that:
          - 0 points  → 50 (neutral baseline)
          - +200 pts  → ~73 (solid performer)
          - +500 pts  → ~88 (strong)
          - -200 pts  → ~27 (at-risk territory)
          - -500 pts  → ~12 (critical)

        This avoids the dead-zone of linear scaling where
        a new employee with 0 events looks like a 0-scorer.
        The steepness (k) controls how quickly the curve accelerates.
        """
        import math
        try:
            x = float(raw_points)
        except (TypeError, ValueError):
            x = 0.0
        k = 0.008  # steepness — 1 point = very small nudge, 500 pts = solid movement
        score = 100.0 / (1.0 + math.exp(-k * x))
        return max(Decimal('0.00'), min(Decimal(str(round(score, 2))), Decimal('100.00')))

    @staticmethod
    def determine_badge(score):
        if score >= 90: return BadgeLevel.PLATINUM
        if score >= 80: return BadgeLevel.GOLD
        if score >= 70: return BadgeLevel.SILVER
        if score >= 60: return BadgeLevel.BRONZE
        return BadgeLevel.WATCHLIST

    @staticmethod
    def determine_risk(score, critical_count):
        if critical_count > 5 or score < 40: return RiskLevel.CRITICAL
        if critical_count > 2 or score < 60: return RiskLevel.HIGH_RISK
        if score < 75: return RiskLevel.AT_RISK
        return RiskLevel.STABLE

    @staticmethod
    def rank_employees(organization_id):
        """
        Recalculates current rankings for all employees in an organization
        using a single bulk_update call — no N+1.

        Company rank: dense rank by global_score DESC across org.
        Branch rank:  dense rank by global_score DESC scoped to each branch.
        """
        with transaction.atomic():
            # ── Company-wide rankings ─────────────────────────────────────
            summaries = list(
                EmployeeScoreSummary.objects.filter(
                    organization_id=organization_id
                ).order_by('-global_score').only(
                    'id', 'global_score', 'branch_id', 'current_rank_company', 'current_rank_branch'
                )
            )

            for idx, s in enumerate(summaries):
                s.current_rank_company = idx + 1

            EmployeeScoreSummary.objects.bulk_update(
                summaries, ['current_rank_company'], batch_size=500
            )

            # ── Branch-scoped rankings ────────────────────────────────────
            branch_ids = {s.branch_id for s in summaries if s.branch_id}
            branch_map: dict[int, list] = {}
            for s in summaries:
                if s.branch_id:
                    branch_map.setdefault(s.branch_id, []).append(s)

            for branch_id in branch_ids:
                # Already ordered by global_score DESC from the outer sort
                branch_summaries = sorted(
                    branch_map[branch_id],
                    key=lambda x: x.global_score,
                    reverse=True
                )
                for idx, s in enumerate(branch_summaries):
                    s.current_rank_branch = idx + 1

            EmployeeScoreSummary.objects.bulk_update(
                summaries, ['current_rank_branch'], batch_size=500
            )
