"""
Category-Rule AI Ranker — Unit Tests
=====================================
Sister tests of test_scope_ai_ranker. Cover the contract that the
category-rule ranker pipeline must hold without a live LLM:

  - hash key correctness (same input → same hash; sample/rule
    changes → different hash → cache busts)
  - normalize_review survives garbage LLM output
  - enrich_category_rule_suggestions short-circuits when AI is off,
    surfaces the right error when no provider is configured, and
    returns empty for empty input
  - cache hits short-circuit the provider call (verifies the
    AICategoryRuleReview cache table is keyed correctly)

Same pattern as test_scope_ai_ranker.py — network-free, no live
provider, each test creates its own org.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from erp.models import Organization
from apps.inventory.models import (
    AICategoryRuleReview, AIScopeSuggesterConfig, Category,
)
from apps.inventory.services import category_rule_ai_ranker


def _suggestion(category_id=42, name='Soft Drinks', extra_sample=None):
    """Synthetic suggestion in the shape suggest_category_rules() returns."""
    sample = [
        {'id': 1, 'name': 'Coca-Cola 330ml'},
        {'id': 2, 'name': 'Pepsi 500ml'},
        {'id': 3, 'name': 'Fanta 1L'},
    ]
    if extra_sample:
        sample.extend(extra_sample)
    return {
        'category_id': category_id,
        'category_name': name,
        'product_count': len(sample),
        'products_sample': sample,
        'products_sample_truncated': False,
        'suggested_rule': {
            'requires_barcode': True,
            'requires_brand':   True,
            'requires_unit':    True,
            'requires_photo':   False,
            'requires_supplier': False,
        },
        'completeness_score': 0.6,
    }


class HashStabilityTests(TestCase):
    """Cache key correctness — bugs here serve stale verdicts."""

    def test_idempotent(self):
        s = _suggestion()
        h1 = category_rule_ai_ranker._hash_payload(category_rule_ai_ranker._stable_payload(s))
        h2 = category_rule_ai_ranker._hash_payload(category_rule_ai_ranker._stable_payload(s))
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)

    def test_invalidates_when_sample_grows(self):
        # Operator added a new product → must re-ask LLM.
        a = _suggestion()
        b = _suggestion(extra_sample=[{'id': 99, 'name': 'NEW'}])
        h1 = category_rule_ai_ranker._hash_payload(category_rule_ai_ranker._stable_payload(a))
        h2 = category_rule_ai_ranker._hash_payload(category_rule_ai_ranker._stable_payload(b))
        self.assertNotEqual(h1, h2)

    def test_invalidates_when_rule_changes(self):
        # If the deterministic pass changed its mind about which fields
        # to require, the LLM verdict isn't reusable.
        a = _suggestion()
        b = _suggestion()
        b['suggested_rule']['requires_photo'] = True
        h1 = category_rule_ai_ranker._hash_payload(category_rule_ai_ranker._stable_payload(a))
        h2 = category_rule_ai_ranker._hash_payload(category_rule_ai_ranker._stable_payload(b))
        self.assertNotEqual(h1, h2)


class NormalizeReviewTests(TestCase):
    """Defensive parsing — LLMs return garbage, the wizard must not crash."""

    def test_well_formed_response(self):
        out = category_rule_ai_ranker._normalize_review({
            'verdict': 'accept',
            'confidence': 0.92,
            'rationale': 'Soft drinks correctly require barcode + brand + unit.',
            'fields': {
                'requires_barcode':  True,
                'requires_brand':    True,
                'requires_unit':     True,
                'requires_photo':    False,
                'requires_supplier': False,
            },
        })
        self.assertEqual(out['verdict'], 'accept')
        self.assertEqual(out['confidence'], 0.92)
        self.assertTrue(out['fields']['requires_barcode'])
        self.assertFalse(out['fields']['requires_supplier'])

    def test_unknown_verdict_falls_back_to_reject(self):
        out = category_rule_ai_ranker._normalize_review({'verdict': 'maybe'})
        self.assertEqual(out['verdict'], 'reject')

    def test_confidence_is_clamped(self):
        # Out-of-range hallucinations → bounded to [0,1].
        too_high = category_rule_ai_ranker._normalize_review({'verdict': 'accept', 'confidence': 9.9})
        too_low  = category_rule_ai_ranker._normalize_review({'verdict': 'accept', 'confidence': -2})
        self.assertEqual(too_high['confidence'], 1.0)
        self.assertEqual(too_low['confidence'], 0.0)

    def test_missing_fields_default_to_verdict_polarity(self):
        # If the LLM didn't return field-level booleans, default to
        # the verdict polarity (accept → all true; reject → all false).
        # The wizard then uses the deterministic suggestion verbatim.
        accept = category_rule_ai_ranker._normalize_review({'verdict': 'accept'})
        for k in ('requires_barcode', 'requires_brand', 'requires_unit', 'requires_photo', 'requires_supplier'):
            self.assertTrue(accept['fields'][k], f'accept verdict should default {k}=True')

        reject = category_rule_ai_ranker._normalize_review({'verdict': 'reject'})
        for k in ('requires_barcode', 'requires_brand', 'requires_unit', 'requires_photo', 'requires_supplier'):
            self.assertFalse(reject['fields'][k], f'reject verdict should default {k}=False')

    def test_garbage_input_does_not_crash(self):
        cases = [
            {},
            {'verdict': None, 'confidence': None, 'rationale': None, 'fields': None},
            {'verdict': 123, 'confidence': 'nan'},
            {'verdict': 'partial', 'rationale': 'x' * 5000},  # over-long rationale
        ]
        for c in cases:
            out = category_rule_ai_ranker._normalize_review(c)
            self.assertIn(out['verdict'], ('accept', 'partial', 'reject'))
            self.assertGreaterEqual(out['confidence'], 0.0)
            self.assertLessEqual(out['confidence'], 1.0)
            self.assertLessEqual(len(out['rationale']), 240)


class EnrichSuggestionsContractTests(TestCase):
    """Higher-level test of the public entry point. Real DB fixtures,
    mocked LLM call."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Test Org Cat Ranker', slug='test-cat-ranker-org',
        )

    def test_returns_unchanged_when_no_config(self):
        # No AIScopeSuggesterConfig row → AI is off → pass-through.
        suggestions = [_suggestion()]
        out = category_rule_ai_ranker.enrich_category_rule_suggestions(self.org, suggestions)
        self.assertEqual(out, suggestions)
        self.assertNotIn('ai_review', out[0])

    def test_returns_unchanged_when_explicitly_disabled(self):
        AIScopeSuggesterConfig.objects.create(organization=self.org, enabled=False)
        suggestions = [_suggestion()]
        out = category_rule_ai_ranker.enrich_category_rule_suggestions(self.org, suggestions)
        self.assertNotIn('ai_review', out[0])

    def test_marks_error_when_no_provider_configured(self):
        # AI on but no MCP provider → wizard surfaces a clear error
        # rather than silently degrading to deterministic.
        AIScopeSuggesterConfig.objects.create(organization=self.org, enabled=True)
        suggestions = [_suggestion()]
        # Mock _resolve_provider rather than rely on the cross-app schema
        # of mcpprovider — keeps this a unit test of the ranker itself.
        with patch.object(category_rule_ai_ranker, '_resolve_provider', return_value=None):
            out = category_rule_ai_ranker.enrich_category_rule_suggestions(self.org, suggestions)
        self.assertIn('ai_review', out[0])
        self.assertEqual(out[0]['ai_review']['verdict'], 'error')
        self.assertIn('provider', out[0]['ai_review']['rationale'].lower())

    def test_empty_input_returns_empty(self):
        out = category_rule_ai_ranker.enrich_category_rule_suggestions(self.org, [])
        self.assertEqual(out, [])


class CacheTests(TestCase):
    """Verify AICategoryRuleReview cache rows are picked up correctly."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Test Org Cat Cache', slug='test-cat-cache-org',
        )
        cls.cfg = AIScopeSuggesterConfig.objects.create(
            organization=cls.org, enabled=True,
        )
        cls.category = Category.objects.create(
            organization=cls.org, name='Soft Drinks',
        )

    def test_cached_row_short_circuits_provider_call(self):
        # Pre-seed cache row matching the suggestion's input hash.
        suggestion = _suggestion(category_id=self.category.id, name='Soft Drinks')
        digest = category_rule_ai_ranker._hash_payload(category_rule_ai_ranker._stable_payload(suggestion))
        AICategoryRuleReview.objects.create(
            organization=self.org, category=self.category, input_hash=digest,
            verdict='accept', confidence=0.91, rationale='cached rule verdict',
            field_verdicts={'requires_barcode': True, 'requires_brand': True,
                            'requires_unit': True, 'requires_photo': False,
                            'requires_supplier': False},
        )
        # Provider can be None — cached path must not call it.
        result = category_rule_ai_ranker._enrich_one(
            organization=self.org, category_id=self.category.id,
            suggestion=suggestion, config=self.cfg, provider=None,
        )
        self.assertEqual(result['verdict'], 'accept')
        self.assertEqual(result['confidence'], 0.91)
        self.assertTrue(result['cached'])
        self.assertEqual(result['rationale'], 'cached rule verdict')

    def test_token_cap_blocks_fresh_calls(self):
        # When daily token cap is exhausted, _enrich_one must return
        # an error verdict + capped=True flag without calling the
        # provider — preventing a stuck wizard from blowing the budget.
        self.cfg.daily_token_cap = 1000
        self.cfg.tokens_used_today = 1500   # over cap
        self.cfg.save()
        suggestion = _suggestion(category_id=self.category.id, name='Soft Drinks 2')
        result = category_rule_ai_ranker._enrich_one(
            organization=self.org, category_id=self.category.id,
            suggestion=suggestion, config=self.cfg, provider=object(),  # truthy stub
        )
        self.assertEqual(result['verdict'], 'error')
        self.assertTrue(result.get('capped'))
        self.assertIn('cap', result['rationale'].lower())
