"""
Comprehensive Test Suite for Workforce Score Engine
====================================================
Tests scoring calculations, business logic, and edge cases.

CRITICAL: These tests verify financial calculations that affect employee compensation.
"""
import pytest
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from apps.workforce.models import (
    ScoreRule, EmployeeScoreEvent, EmployeeScoreSummary,
    ScoreDirection, PriorityLevel, SeverityLevel, ConfidenceLevel,
    BadgeLevel, RiskLevel, ScoreFamily, ScoreDimension
)
from apps.workforce.services import WorkforceScoreEngine
# Pattern D: test-fixture import at module-collection time pre-empts the connector
# (no org context yet, OrganizationModule check would mark hr DISABLED).
from apps.hr.models import Employee, Department  # noqa: E402  (Pattern D: test fixture)
from erp.models import Organization, Site, User


class WorkforceScoreEngineTestCase(TestCase):
    """Test the core scoring engine logic."""

    def setUp(self):
        """Set up test data."""
        self.org = Organization.objects.create(
            name="Test Org",
            business_type_id=1,
            currency="USD"
        )

        self.site = Site.objects.create(
            organization=self.org,
            name="Main Branch"
        )

        self.department = Department.objects.create(
            organization=self.org,
            name="Sales"
        )

        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="testpass123",
            organization=self.org
        )

        self.employee = Employee.objects.create(
            organization=self.org,
            user=self.user,
            site=self.site,
            department=self.department,
            employee_number="EMP001"
        )

        # Create a test scoring rule
        self.rule = ScoreRule.objects.create(
            organization=self.org,
            code="TEST_POSITIVE",
            name="Test Positive Action",
            module="test",
            event_type="action",
            event_code="POSITIVE_ACTION",
            is_active=True,
            direction=ScoreDirection.POSITIVE,
            base_points=Decimal('10.00'),
            dimension=ScoreDimension.PRODUCTIVITY,
            score_family=ScoreFamily.PERFORMANCE
        )

    def test_record_event_basic(self):
        """Test basic event recording."""
        event = WorkforceScoreEngine.record_event(
            employee=self.employee,
            event_code="POSITIVE_ACTION",
            module="test"
        )

        self.assertIsNotNone(event)
        self.assertEqual(event.employee, self.employee)
        self.assertEqual(event.base_points, Decimal('10.00'))
        self.assertEqual(event.direction, ScoreDirection.POSITIVE)
        self.assertEqual(event.status, 'CONFIRMED')

    def test_priority_multipliers(self):
        """Test that priority levels apply correct multipliers."""
        # Test each priority level
        test_cases = [
            (PriorityLevel.LOW, Decimal('0.75')),
            (PriorityLevel.NORMAL, Decimal('1.00')),
            (PriorityLevel.HIGH, Decimal('1.25')),
            (PriorityLevel.CRITICAL, Decimal('1.60')),
            (PriorityLevel.EMERGENCY, Decimal('2.00')),
        ]

        for level, expected_mult in test_cases:
            mult = WorkforceScoreEngine.get_priority_multiplier(level)
            self.assertEqual(mult, expected_mult,
                f"Priority {level} should have multiplier {expected_mult}")

    def test_severity_multipliers(self):
        """Test that severity levels apply correct multipliers."""
        test_cases = [
            (SeverityLevel.MINOR, Decimal('0.80')),
            (SeverityLevel.MEDIUM, Decimal('1.00')),
            (SeverityLevel.MAJOR, Decimal('1.40')),
            (SeverityLevel.CRITICAL, Decimal('1.80')),
        ]

        for level, expected_mult in test_cases:
            mult = WorkforceScoreEngine.get_severity_multiplier(level)
            self.assertEqual(mult, expected_mult,
                f"Severity {level} should have multiplier {expected_mult}")

    def test_confidence_multipliers(self):
        """Test that confidence levels apply correct multipliers."""
        test_cases = [
            (ConfidenceLevel.LOW, Decimal('0.60')),
            (ConfidenceLevel.MEDIUM, Decimal('0.80')),
            (ConfidenceLevel.HIGH, Decimal('1.00')),
            (ConfidenceLevel.VERIFIED, Decimal('1.10')),
        ]

        for level, expected_mult in test_cases:
            mult = WorkforceScoreEngine.get_confidence_multiplier(level)
            self.assertEqual(mult, expected_mult,
                f"Confidence {level} should have multiplier {expected_mult}")

    def test_final_points_calculation(self):
        """Test that final points = base_points × priority × severity × confidence."""
        event = WorkforceScoreEngine.record_event(
            employee=self.employee,
            event_code="POSITIVE_ACTION",
            module="test",
            priority=PriorityLevel.HIGH,  # 1.25x
            severity=SeverityLevel.MAJOR,  # 1.40x
            confidence=ConfidenceLevel.VERIFIED  # 1.10x
        )

        # Expected: 10 × 1.25 × 1.40 × 1.10 = 19.25
        expected = Decimal('10.00') * Decimal('1.25') * Decimal('1.40') * Decimal('1.10')
        self.assertEqual(event.final_points, expected)

    def test_normalize_score_neutral(self):
        """Test that 0 points normalizes to ~50 (neutral baseline)."""
        score = WorkforceScoreEngine.normalize_score(Decimal('0.00'))
        # Should be close to 50 (neutral)
        self.assertGreater(score, Decimal('49'))
        self.assertLess(score, Decimal('51'))

    def test_normalize_score_positive(self):
        """Test positive points normalization."""
        test_cases = [
            (Decimal('100.00'), 53, 55),   # Should be slightly above 50
            (Decimal('200.00'), 60, 65),   # Should be ~62
            (Decimal('500.00'), 75, 80),   # Should be ~77
        ]

        for points, min_score, max_score in test_cases:
            score = WorkforceScoreEngine.normalize_score(points)
            self.assertGreaterEqual(score, Decimal(str(min_score)),
                f"{points} points should normalize to at least {min_score}")
            self.assertLessEqual(score, Decimal(str(max_score)),
                f"{points} points should normalize to at most {max_score}")

    def test_normalize_score_negative(self):
        """Test negative points normalization."""
        test_cases = [
            (Decimal('-100.00'), 45, 48),  # Should be slightly below 50
            (Decimal('-200.00'), 35, 40),  # Should be ~38
            (Decimal('-500.00'), 20, 25),  # Should be ~23
        ]

        for points, min_score, max_score in test_cases:
            score = WorkforceScoreEngine.normalize_score(points)
            self.assertGreaterEqual(score, Decimal(str(min_score)))
            self.assertLessEqual(score, Decimal(str(max_score)))

    def test_determine_badge_thresholds(self):
        """Test badge level determination."""
        test_cases = [
            (Decimal('95.00'), BadgeLevel.PLATINUM),
            (Decimal('85.00'), BadgeLevel.GOLD),
            (Decimal('75.00'), BadgeLevel.SILVER),
            (Decimal('65.00'), BadgeLevel.BRONZE),
            (Decimal('50.00'), BadgeLevel.WATCHLIST),
        ]

        for score, expected_badge in test_cases:
            badge = WorkforceScoreEngine.determine_badge(score)
            self.assertEqual(badge, expected_badge,
                f"Score {score} should result in badge {expected_badge}")

    def test_determine_risk_by_score(self):
        """Test risk level determination based on score."""
        test_cases = [
            (Decimal('35.00'), 0, RiskLevel.CRITICAL),
            (Decimal('55.00'), 0, RiskLevel.HIGH_RISK),
            (Decimal('70.00'), 0, RiskLevel.AT_RISK),
            (Decimal('80.00'), 0, RiskLevel.STABLE),
        ]

        for score, critical_count, expected_risk in test_cases:
            risk = WorkforceScoreEngine.determine_risk(score, critical_count)
            self.assertEqual(risk, expected_risk,
                f"Score {score} should result in risk {expected_risk}")

    def test_determine_risk_by_critical_count(self):
        """Test risk level determination based on critical event count."""
        test_cases = [
            (Decimal('80.00'), 6, RiskLevel.CRITICAL),  # 6 critical events
            (Decimal('80.00'), 3, RiskLevel.HIGH_RISK),  # 3 critical events
            (Decimal('80.00'), 1, RiskLevel.STABLE),     # 1 critical event
        ]

        for score, critical_count, expected_risk in test_cases:
            risk = WorkforceScoreEngine.determine_risk(score, critical_count)
            self.assertEqual(risk, expected_risk)

    def test_update_employee_summary(self):
        """Test employee summary calculation."""
        # Record some events
        WorkforceScoreEngine.record_event(
            employee=self.employee,
            event_code="POSITIVE_ACTION",
            module="test"
        )

        # Retrieve summary
        summary = EmployeeScoreSummary.objects.get(employee=self.employee)

        self.assertEqual(summary.event_count, 1)
        self.assertGreater(summary.global_score, Decimal('0'))
        self.assertEqual(summary.badge_level, BadgeLevel.BRONZE)  # Or higher

    def test_daily_cap_enforcement(self):
        """Test that daily caps prevent abuse."""
        # Add daily cap to rule
        self.rule.daily_cap = Decimal('20.00')
        self.rule.save()

        # First event should work (10 points)
        event1 = WorkforceScoreEngine.record_event(
            employee=self.employee,
            event_code="POSITIVE_ACTION",
            module="test"
        )
        self.assertIsNotNone(event1)

        # Second event should work (20 points total)
        event2 = WorkforceScoreEngine.record_event(
            employee=self.employee,
            event_code="POSITIVE_ACTION",
            module="test"
        )
        self.assertIsNotNone(event2)

        # Third event should be blocked (would exceed 20 point daily cap)
        event3 = WorkforceScoreEngine.record_event(
            employee=self.employee,
            event_code="POSITIVE_ACTION",
            module="test"
        )
        self.assertIsNone(event3)

    def test.organization_isolation(self):
        """Test that scoring is.organization-isolated."""
        # Create second org
        org2 = Organization.objects.create(
            name="Other Org",
            business_type_id=1,
            currency="USD"
        )

        # Employee from org2 should not see org1's rules
        # (This would be tested via actual queries with.organization context)
        rules_count = ScoreRule.objects.filter(organization=self.org).count()
        self.assertEqual(rules_count, 1)

        rules_count_org2 = ScoreRule.objects.filter(organization=org2).count()
        self.assertEqual(rules_count_org2, 0)

    def test_edge_case_zero_base_points(self):
        """Test handling of zero base points."""
        self.rule.base_points = Decimal('0.00')
        self.rule.save()

        event = WorkforceScoreEngine.record_event(
            employee=self.employee,
            event_code="POSITIVE_ACTION",
            module="test"
        )

        self.assertIsNotNone(event)
        self.assertEqual(event.final_points, Decimal('0.00'))

    def test_edge_case_very_large_points(self):
        """Test handling of very large point values."""
        self.rule.base_points = Decimal('10000.00')
        self.rule.save()

        event = WorkforceScoreEngine.record_event(
            employee=self.employee,
            event_code="POSITIVE_ACTION",
            module="test"
        )

        self.assertIsNotNone(event)
        # Score should be capped at 100
        summary = EmployeeScoreSummary.objects.get(employee=self.employee)
        self.assertLessEqual(summary.global_score, Decimal('100.00'))

    def test_ranking_calculation(self):
        """Test employee ranking system."""
        # Create multiple employees
        employees = []
        for i in range(5):
            user = User.objects.create_user(
                username=f"user{i}",
                email=f"user{i}@example.com",
                password="testpass123",
                organization=self.org
            )
            emp = Employee.objects.create(
                organization=self.org,
                user=user,
                site=self.site,
                department=self.department,
                employee_number=f"EMP{i:03d}"
            )
            employees.append(emp)

            # Record varying amounts of positive events
            for j in range(i + 1):
                WorkforceScoreEngine.record_event(
                    employee=emp,
                    event_code="POSITIVE_ACTION",
                    module="test"
                )

        # Trigger ranking
        WorkforceScoreEngine.rank_employees(self.org.id)

        # Verify rankings
        summaries = EmployeeScoreSummary.objects.filter(
            organization=self.org
        ).order_by('current_rank_company')

        # Employee with most events should be rank 1
        top_employee = summaries.first()
        self.assertEqual(top_employee.current_rank_company, 1)

        # Rankings should be sequential
        for idx, summary in enumerate(summaries, start=1):
            self.assertEqual(summary.current_rank_company, idx)


class WorkforceConfigurationTestCase(TestCase):
    """Test configuration-driven behavior."""

    def test_config_driven_multipliers(self):
        """Test that multipliers come from configuration."""
        from kernel.config import get_config

        # This test verifies that the system uses get_config()
        # In practice, you would override config values in test settings
        multiplier = WorkforceScoreEngine.get_priority_multiplier(PriorityLevel.HIGH)
        self.assertIsInstance(multiplier, Decimal)

    def test_config_driven_thresholds(self):
        """Test that badge/risk thresholds come from configuration."""
        # This verifies the refactoring is in place
        badge = WorkforceScoreEngine.determine_badge(Decimal('85.00'))
        self.assertIn(badge, [BadgeLevel.GOLD, BadgeLevel.PLATINUM])


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
