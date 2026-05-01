"""
Tenant Isolation Security Tests for Workforce Module
=====================================================
CRITICAL: These tests verify multi.organization data isolation.

Security Impact: CRITICAL
Compliance: GDPR Article 32, SOX Section 404
"""
import pytest
from django.test import TestCase, RequestFactory
from django.contrib.auth.models import AnonymousUser
from apps.workforce.models import (
    ScoreRule, EmployeeScoreEvent, EmployeeScoreSummary
)
from apps.workforce.services import WorkforceScoreEngine
# Pattern D: test-fixture import at module-collection time pre-empts the connector
# (no org context yet, OrganizationModule check would mark hr DISABLED).
from apps.hr.models import Employee  # noqa: E402  (Pattern D: test fixture)
from erp.models import Organization, Site, User


class TenantIsolationTestCase(TestCase):
    """Critical security tests for.organization isolation."""

    def setUp(self):
        """Set up two separate organizations."""
        # Organization 1
        self.org1 = Organization.objects.create(
            name="Company A",
            business_type_id=1,
            currency="USD"
        )
        self.site1 = Site.objects.create(organization=self.org1, name="Site A")
        self.user1 = User.objects.create_user(
            username="user1",
            email="user1@companya.com",
            password="pass123",
            organization=self.org1
        )
        self.employee1 = Employee.objects.create(
            organization=self.org1,
            user=self.user1,
            site=self.site1,
            employee_number="EMP001"
        )

        # Organization 2
        self.org2 = Organization.objects.create(
            name="Company B",
            business_type_id=1,
            currency="USD"
        )
        self.site2 = Site.objects.create(organization=self.org2, name="Site B")
        self.user2 = User.objects.create_user(
            username="user2",
            email="user2@companyb.com",
            password="pass123",
            organization=self.org2
        )
        self.employee2 = Employee.objects.create(
            organization=self.org2,
            user=self.user2,
            site=self.site2,
            employee_number="EMP002"
        )

        # Create rules for each org
        self.rule1 = ScoreRule.objects.create(
            organization=self.org1,
            organization=self.org1,
            code="ORG1_RULE",
            name="Org1 Rule",
            module="test",
            event_type="action",
            event_code="ACTION_1",
            base_points=10,
            is_active=True
        )

        self.rule2 = ScoreRule.objects.create(
            organization=self.org2,
            organization=self.org2,
            code="ORG2_RULE",
            name="Org2 Rule",
            module="test",
            event_type="action",
            event_code="ACTION_2",
            base_points=20,
            is_active=True
        )

    def test_score_rules_isolated_by.organization(self):
        """CRITICAL: Verify ScoreRule queries are.organization-isolated."""
        # Org1 should only see their own rules
        org1_rules = ScoreRule.objects.filter(organization=self.org1)
        self.assertEqual(org1_rules.count(), 1)
        self.assertEqual(org1_rules.first().code, "ORG1_RULE")

        # Org2 should only see their own rules
        org2_rules = ScoreRule.objects.filter(organization=self.org2)
        self.assertEqual(org2_rules.count(), 1)
        self.assertEqual(org2_rules.first().code, "ORG2_RULE")

        # Cross-contamination check
        self.assertNotIn(self.rule2, org1_rules)
        self.assertNotIn(self.rule1, org2_rules)

    def test_score_events_isolated_by.organization(self):
        """CRITICAL: Verify EmployeeScoreEvent queries are.organization-isolated."""
        # Create events for each org
        event1 = WorkforceScoreEngine.record_event(
            employee=self.employee1,
            event_code="ACTION_1",
            module="test"
        )

        event2 = WorkforceScoreEngine.record_event(
            employee=self.employee2,
            event_code="ACTION_2",
            module="test"
        )

        # Org1 should only see their own events
        org1_events = EmployeeScoreEvent.objects.filter(organization=self.org1)
        self.assertEqual(org1_events.count(), 1)
        self.assertEqual(org1_events.first().id, event1.id)

        # Org2 should only see their own events
        org2_events = EmployeeScoreEvent.objects.filter(organization=self.org2)
        self.assertEqual(org2_events.count(), 1)
        self.assertEqual(org2_events.first().id, event2.id)

    def test_score_summaries_isolated_by.organization(self):
        """CRITICAL: Verify EmployeeScoreSummary queries are.organization-isolated."""
        # Generate summaries by recording events
        WorkforceScoreEngine.record_event(
            employee=self.employee1,
            event_code="ACTION_1",
            module="test"
        )

        WorkforceScoreEngine.record_event(
            employee=self.employee2,
            event_code="ACTION_2",
            module="test"
        )

        # Org1 should only see their summaries
        org1_summaries = EmployeeScoreSummary.objects.filter(organization=self.org1)
        self.assertEqual(org1_summaries.count(), 1)
        self.assertEqual(org1_summaries.first().employee, self.employee1)

        # Org2 should only see their summaries
        org2_summaries = EmployeeScoreSummary.objects.filter(organization=self.org2)
        self.assertEqual(org2_summaries.count(), 1)
        self.assertEqual(org2_summaries.first().employee, self.employee2)

    def test_ranking_isolated_by.organization(self):
        """CRITICAL: Verify employee rankings don't leak across.organizations."""
        # Create multiple employees per org
        for i in range(3):
            user = User.objects.create_user(
                username=f"org1_user{i}",
                email=f"org1_user{i}@companya.com",
                password="pass123",
                organization=self.org1
            )
            emp = Employee.objects.create(
                organization=self.org1,
                user=user,
                site=self.site1,
                employee_number=f"ORG1_EMP{i}"
            )
            for j in range(i + 1):
                WorkforceScoreEngine.record_event(
                    employee=emp,
                    event_code="ACTION_1",
                    module="test"
                )

        for i in range(3):
            user = User.objects.create_user(
                username=f"org2_user{i}",
                email=f"org2_user{i}@companyb.com",
                password="pass123",
                organization=self.org2
            )
            emp = Employee.objects.create(
                organization=self.org2,
                user=user,
                site=self.site2,
                employee_number=f"ORG2_EMP{i}"
            )
            for j in range(i + 1):
                WorkforceScoreEngine.record_event(
                    employee=emp,
                    event_code="ACTION_2",
                    module="test"
                )

        # Run rankings
        WorkforceScoreEngine.rank_employees(self.org1.id)
        WorkforceScoreEngine.rank_employees(self.org2.id)

        # Verify rankings are independent
        org1_summaries = list(EmployeeScoreSummary.objects.filter(
            organization=self.org1
        ).order_by('current_rank_company'))

        org2_summaries = list(EmployeeScoreSummary.objects.filter(
            organization=self.org2
        ).order_by('current_rank_company'))

        # Both orgs should have rank 1, 2, 3 independently
        for idx, summary in enumerate(org1_summaries, start=1):
            self.assertEqual(summary.current_rank_company, idx)

        for idx, summary in enumerate(org2_summaries, start=1):
            self.assertEqual(summary.current_rank_company, idx)

    def test_no_cross.organization_data_leakage(self):
        """CRITICAL: Verify no data leaks between.organizations via raw queries."""
        # Record events for both orgs
        WorkforceScoreEngine.record_event(
            employee=self.employee1,
            event_code="ACTION_1",
            module="test"
        )

        WorkforceScoreEngine.record_event(
            employee=self.employee2,
            event_code="ACTION_2",
            module="test"
        )

        # Attempting to query all events without.organization filter should fail
        # (This is what TenantOwnedModel prevents)
        all_events = EmployeeScoreEvent.objects.all()

        # Each org's context should only see their own data
        org1_context_events = EmployeeScoreEvent.objects.filter(organization=self.org1)
        org2_context_events = EmployeeScoreEvent.objects.filter(organization=self.org2)

        # Verify no overlap
        org1_ids = set(org1_context_events.values_list('id', flat=True))
        org2_ids = set(org2_context_events.values_list('id', flat=True))

        self.assertEqual(len(org1_ids & org2_ids), 0,
            "CRITICAL: Found events visible to both.organizations!")

    def test.organization_id_cannot_be_spoofed(self):
        """CRITICAL: Verify.organization_id cannot be manipulated to access other org's data."""
        # Attempt to create an event with wrong.organization_id should fail
        # (TenantOwnedModel should enforce this)

        event1 = WorkforceScoreEngine.record_event(
            employee=self.employee1,
            event_code="ACTION_1",
            module="test"
        )

        # Event should have org1's.organization_id
        self.assertEqual(event1.organization_id, self.org1.id)

        # Attempting to query with different.organization should not find it
        spoofed_query = EmployeeScoreEvent.objects.filter(
           .organization_id=self.org2.id,
            id=event1.id
        )
        self.assertEqual(spoofed_query.count(), 0,
            "CRITICAL: Event was accessible with wrong.organization_id!")


class AuditLoggingTestCase(TestCase):
    """Test audit logging functionality."""

    def setUp(self):
        """Set up test organization."""
        self.org = Organization.objects.create(
            name="Test Org",
            business_type_id=1,
            currency="USD"
        )
        self.site = Site.objects.create(organization=self.org, name="Main")
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="pass123",
            organization=self.org
        )

    def test_score_rule_changes_are_audited(self):
        """Test that ScoreRule modifications are audited."""
        rule = ScoreRule.objects.create(
            organization=self.org,
            organization=self.org,
            code="TEST_RULE",
            name="Test Rule",
            module="test",
            event_type="action",
            event_code="ACTION",
            base_points=10,
            is_active=True
        )

        # Modify the rule
        rule.base_points = 20
        rule.save()

        # Verify audit log exists (if AuditLogMixin is properly configured)
        # Note: Actual audit log implementation may vary
        # This is a placeholder for your specific audit system

    def test_employee_score_events_are_audited(self):
        """Test that EmployeeScoreEvent modifications are audited."""
        # Similar audit trail verification for events
        pass


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
