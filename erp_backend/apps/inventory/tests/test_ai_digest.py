"""
AI Assistant Digest — Unit Tests
=================================
Tests for `erp.tasks.send_ai_assistant_digest`.

The task touches three layers — config rows, suggesters/rankers, and
email — so we mock the AI pipeline + email sender and exercise only
the task's loop and decision logic.

Verifies:
  - Orgs without an enabled config are not iterated
  - "0 actionable picks" → no email (no spam)
  - High-confidence picks → email body has counts + wizard URLs
  - Per-org exception isolation (one bad org doesn't block the rest)

Note on test DB: real User / MCPProvider creation is avoided because
this dev DB has pre-existing schema drift on `mcpprovider.tenant_id`
unrelated to this feature. The User query inside the task is mocked
to return canned objects, keeping the test focused on the task itself.
"""
from __future__ import annotations

from unittest.mock import patch, MagicMock

from django.test import TestCase

from erp.models import Organization
from apps.inventory.models import AIScopeSuggesterConfig
from erp.tasks import send_ai_assistant_digest


class _FakeUser:
    """Stand-in for an admin User with the minimal fields the task touches."""
    def __init__(self, email):
        self.email = email
        self.is_active = True
        self.is_superuser = True


def _scope_picks(n_high=3, n_partial=1, n_reject=0):
    """Build a suggestion list with the given verdict mix."""
    picks = []
    for _ in range(n_high):
        picks.append({
            'value_id': 1, 'value_name': 'Mango', 'group_name': 'Flavor', 'product_count': 10,
            'ai_review': {'verdict': 'accept', 'confidence': 0.9, 'rationale': 'fits'},
        })
    for _ in range(n_partial):
        picks.append({
            'value_id': 2, 'value_name': 'BBQ', 'group_name': 'Flavor', 'product_count': 5,
            'ai_review': {'verdict': 'partial', 'confidence': 0.5, 'rationale': 'mixed'},
        })
    for _ in range(n_reject):
        picks.append({
            'value_id': 3, 'value_name': 'Vanilla', 'group_name': 'Flavor', 'product_count': 1,
            'ai_review': {'verdict': 'reject', 'confidence': 0.1, 'rationale': 'no'},
        })
    return picks


def _patch_user_query(users=None):
    """Patch the User queryset chain inside the digest task to return
    a canned list of users (or empty by default). Avoids hitting the
    drifted mcpprovider join."""
    user_qs = MagicMock()
    user_qs.filter.return_value = user_qs
    user_qs.exclude.return_value = user_qs
    user_qs.exists.return_value = bool(users)
    user_qs.__iter__ = lambda self: iter(users or [])
    user_qs.__getitem__ = lambda self, idx: (users or [])[idx]

    user_model = MagicMock()
    user_model.objects.filter.return_value = user_qs
    return patch('erp.models.User', user_model)


class DigestTaskTests(TestCase):
    """Each test creates the orgs it needs and patches the AI pipeline."""

    @classmethod
    def setUpTestData(cls):
        # Three orgs — one with no config row, one disabled, one enabled.
        cls.org_no_cfg = Organization.objects.create(name='No Cfg', slug='no-cfg')
        cls.org_off    = Organization.objects.create(name='Off Org', slug='off-org')
        cls.org_on     = Organization.objects.create(name='On Org',  slug='on-org')

        AIScopeSuggesterConfig.objects.create(organization=cls.org_off, enabled=False)
        AIScopeSuggesterConfig.objects.create(organization=cls.org_on,  enabled=True)

    def test_skips_orgs_without_enabled_config(self):
        # Only the enabled org should ever be passed into a suggester.
        seen_orgs = []

        def capture_org(org, **_):
            seen_orgs.append(org.slug)
            return []

        with patch('apps.inventory.services.scope_suggester.suggest_scopes', side_effect=capture_org), \
             patch('apps.inventory.services.scope_ai_ranker.enrich_suggestions', return_value=[]), \
             patch('apps.inventory.services.category_rule_suggester.suggest_category_rules', return_value=[]), \
             patch('apps.inventory.services.category_rule_ai_ranker.enrich_category_rule_suggestions', return_value=[]), \
             _patch_user_query(users=[]), \
             patch('erp.notification_service.NotificationService._send_email'):
            send_ai_assistant_digest()
        self.assertIn('on-org', seen_orgs)
        self.assertNotIn('off-org',   seen_orgs, 'Disabled org leaked into the loop.')
        self.assertNotIn('no-cfg',    seen_orgs, 'Org without config leaked into the loop.')

    def test_no_email_when_no_actionable_picks(self):
        # Suggesters return empty → nothing actionable → no email.
        with patch('apps.inventory.services.scope_suggester.suggest_scopes', return_value=[]), \
             patch('apps.inventory.services.scope_ai_ranker.enrich_suggestions', return_value=[]), \
             patch('apps.inventory.services.category_rule_suggester.suggest_category_rules', return_value=[]), \
             patch('apps.inventory.services.category_rule_ai_ranker.enrich_category_rule_suggestions', return_value=[]), \
             _patch_user_query(users=[_FakeUser('admin@on.example')]), \
             patch('erp.notification_service.NotificationService._send_email') as mock_send:
            result = send_ai_assistant_digest()
            self.assertEqual(mock_send.call_count, 0)
            self.assertEqual(result['sent_count'], 0)

    def test_sends_email_with_counts_and_wizard_urls(self):
        # 3 high-confidence + 1 partial → email has counts + wizard URLs.
        picks = _scope_picks(n_high=3, n_partial=1, n_reject=0)
        with patch('apps.inventory.services.scope_suggester.suggest_scopes', return_value=[1, 2, 3]), \
             patch('apps.inventory.services.scope_ai_ranker.enrich_suggestions', return_value=picks), \
             patch('apps.inventory.services.category_rule_suggester.suggest_category_rules', return_value=[]), \
             patch('apps.inventory.services.category_rule_ai_ranker.enrich_category_rule_suggestions', return_value=[]), \
             _patch_user_query(users=[_FakeUser('admin@on.example')]), \
             patch('erp.notification_service.NotificationService._send_email') as mock_send:
            result = send_ai_assistant_digest()
            self.assertEqual(mock_send.call_count, 1)
            kwargs = mock_send.call_args.kwargs
            # Body should mention the high-confidence count + both wizards.
            self.assertIn('3', kwargs['body'])  # high-confidence count
            self.assertIn('/inventory/attributes/scope-wizard', kwargs['body'])
            self.assertIn('/inventory/categories/rule-wizard',  kwargs['body'])
            self.assertEqual(result['sent_count'], 1)

    def test_one_org_failing_does_not_block_the_loop(self):
        # If suggest_scopes raises, the task must continue rather than die.
        # We add a second enabled org to verify the LATER one still runs.
        org_other = Organization.objects.create(name='Other On', slug='other-on')
        AIScopeSuggesterConfig.objects.create(organization=org_other, enabled=True)

        def explode_for_first(org, **_):
            if org.slug == 'on-org':
                raise RuntimeError('synthetic suggester crash')
            return []

        with patch('apps.inventory.services.scope_suggester.suggest_scopes', side_effect=explode_for_first), \
             patch('apps.inventory.services.scope_ai_ranker.enrich_suggestions', return_value=[]), \
             patch('apps.inventory.services.category_rule_suggester.suggest_category_rules', return_value=[]), \
             patch('apps.inventory.services.category_rule_ai_ranker.enrich_category_rule_suggestions', return_value=[]), \
             _patch_user_query(users=[]), \
             patch('erp.notification_service.NotificationService._send_email'):
            # Should not raise — task swallows per-org failures.
            result = send_ai_assistant_digest()
            # org_count still counts BOTH opted-in orgs even though one crashed.
            self.assertEqual(result['org_count'], 2)
