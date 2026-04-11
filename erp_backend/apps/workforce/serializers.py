from rest_framework import serializers
from .models import ScoreRule, EmployeeScoreEvent, EmployeeScoreSummary, EmployeeBadge, EmployeeScorePeriod


class ScoreRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScoreRule
        fields = '__all__'


class EmployeeScoreEventSerializer(serializers.ModelSerializer):
    employee_name = serializers.ReadOnlyField(source='employee.__str__')
    direction_display = serializers.ReadOnlyField(source='get_direction_display')
    signed_points = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeScoreEvent
        fields = '__all__'

    def get_signed_points(self, obj):
        if obj.direction == 'NEGATIVE':
            return -abs(float(obj.final_points))
        return float(obj.final_points)


class EmployeeScoreSummarySerializer(serializers.ModelSerializer):
    employee_name  = serializers.ReadOnlyField(source='employee.__str__')
    employee_id_pk = serializers.ReadOnlyField(source='employee.id')
    trend_indicator = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeScoreSummary
        fields = '__all__'

    def get_trend_indicator(self, obj):
        """
        Compares current global_score to score from the previous period snapshot.

        IMPORTANT: To avoid N+1 queries, attach `_last_period_score` in the
        ViewSet queryset using Prefetch or annotation. Falls back to a lazy DB
        lookup if the attribute is absent (e.g. per-employee detail views).
        """
        from django.utils import timezone

        # 1. Fast path — pre-attached by the ViewSet (no extra query)
        if hasattr(obj, '_last_period_score'):
            prev_score = obj._last_period_score
        else:
            # 2. Fallback: single DB lookup
            from django.utils import timezone
            last_month = (timezone.now().replace(day=1) - timezone.timedelta(days=1))
            period_key = last_month.strftime('%Y-%m')
            prev = EmployeeScorePeriod.objects.filter(
                employee=obj.employee,
                period_type='MONTHLY',
                period_key=period_key
            ).values('global_score').first()
            prev_score = float(prev['global_score']) if prev else None

        if prev_score is None:
            return 'NEUTRAL'
        current = float(obj.global_score)
        if current > prev_score + 1:   # 1-point hysteresis to avoid noise
            return 'UP'
        elif current < prev_score - 1:
            return 'DOWN'
        return 'STABLE'


class EmployeeBadgeSerializer(serializers.ModelSerializer):
    employee_name = serializers.ReadOnlyField(source='employee.__str__')

    class Meta:
        model = EmployeeBadge
        fields = '__all__'


class EmployeeScorePeriodSerializer(serializers.ModelSerializer):
    employee_name = serializers.ReadOnlyField(source='employee.__str__')
    score_delta   = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeScorePeriod
        fields = '__all__'

    def get_score_delta(self, obj):
        """Net points earned/lost during this period."""
        return float(obj.net_points)
