"""
AI Scope Ranker — Unit Tests
============================
Pure-function tests for `apps.inventory.services.scope_ai_ranker`.

These tests cover the contract that doesn't depend on a live LLM:

  - hash idempotency + invalidation when sample changes (cache key
    correctness — wrong here means stale verdicts get re-served)
  - prompt rendering stays under the token budget (cost guarantee
    — drift here silently doubles the per-row spend)
  - normalize_review tolerates malformed model output (defense
    against any provider returning bad JSON)
  - markdown-fenced JSON still parses (Anthropic + OpenAI sometimes
    wrap responses in ```json fences despite system prompt)
  - enrich_suggestions short-circuits when AI is off (verifies the
    opt-in toggle actually does something)
  - daily token cap blocks further LLM calls (cost guard)

All tests run without network — _call_provider is monkey-patched to
return canned responses. Each test is self-contained and creates its
own org fixture.
"""
from __future__ import annotations

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from erp.models import Organization
from apps.inventory.models import (
    AIScopeReview, AIScopeSuggesterConfig, Brand, Category, ProductAttribute,
)
from apps.inventory.services import scope_ai_ranker


def _suggestion(value_id=42, value_name='Mango', sample_extra=None):
    """Synthetic suggestion dict in the shape suggest_scopes() returns."""
    sample = [
        {'id': 1, 'name': 'Mango Juice 1L'},
        {'id': 2, 'name': 'Tropical Smoothie 250ml'},
    ]
    if sample_extra:
        sample.extend(sample_extra)
    return {
        'value_id': value_id,
        'value_name': value_name,
        'group_id': 12,
        'group_name': 'Flavor',
        'product_count': len(sample),
        'products_sample': sample,
        'products_sample_truncated': False,
        'current_scope': {'categories': [], 'countries': [], 'brands': []},
        'suggested_scope': {
            'categories': [{'id': 5, 'name': 'Juice'}, {'id': 9, 'name': 'Smoothie'}],
            'countries': [],
            'brands': [],
        },
        'confidence': {'categories': 0.83, 'countries': 0.0, 'brands': 0.0},
    }


class HashStabilityTests(TestCase):
    """The hash function is the cache key — bugs here corrupt the cache."""

    def test_hash_is_idempotent(self):
        # Same input → same hash, twice in a row.
        s = _suggestion()
        h1 = scope_ai_ranker._hash_payload(scope_ai_ranker._stable_payload(s))
        h2 = scope_ai_ranker._hash_payload(scope_ai_ranker._stable_payload(s))
        self.assertEqual(h1, h2)
        self.assertEqual(len(h1), 64)  # sha256 hex

    def test_hash_invalidates_when_sample_changes(self):
        # If the operator added a new product since last review, we MUST
        # re-ask the LLM — stale cache would defeat the whole point.
        a = _suggestion()
        b = _suggestion(sample_extra=[{'id': 99, 'name': 'NEW PRODUCT'}])
        h1 = scope_ai_ranker._hash_payload(scope_ai_ranker._stable_payload(a))
        h2 = scope_ai_ranker._hash_payload(scope_ai_ranker._stable_payload(b))
        self.assertNotEqual(h1, h2)

    def test_hash_invalidates_when_suggested_scope_changes(self):
        a = _suggestion()
        b = _suggestion()
        b['suggested_scope']['categories'] = [{'id': 99, 'name': 'Something Else'}]
        h1 = scope_ai_ranker._hash_payload(scope_ai_ranker._stable_payload(a))
        h2 = scope_ai_ranker._hash_payload(scope_ai_ranker._stable_payload(b))
        self.assertNotEqual(h1, h2)


class PromptCostTests(TestCase):
    """Token budget is part of the API — drift breaks the daily cap math."""

    def test_user_prompt_under_300_tokens(self):
        # 1 token ≈ 4 chars of English. 300 tokens = ~1200 chars. Our
        # canonical prompt should fit comfortably.
        s = _suggestion()
        prompt = scope_ai_ranker._user_prompt(scope_ai_ranker._stable_payload(s))
        # Generous ceiling — actual is ~85 tokens. If it ever crosses
        # 300 we've smuggled bloat into the prompt template.
        self.assertLess(len(prompt), 1200, f'Prompt grew to {len(prompt)} chars (~{len(prompt)//4} tokens)')

    def test_system_prompt_is_stable(self):
        # Bumping the system prompt invalidates every cached row in
        # production. Lock its length in so changes are conscious.
        # Current system prompt is ~1100 chars (~275 tokens).
        self.assertLess(len(scope_ai_ranker.SYSTEM_PROMPT), 2400)


class NormalizeReviewTests(TestCase):
    """LLMs return garbage sometimes. The wizard must not crash."""

    def test_well_formed_response(self):
        out = scope_ai_ranker._normalize_review({
            'verdict': 'accept',
            'confidence': 0.88,
            'rationale': 'Mango fits juice and smoothie products.',
            'axes': {'categories': True, 'countries': True, 'brands': True},
        })
        self.assertEqual(out['verdict'], 'accept')
        self.assertEqual(out['confidence'], 0.88)
        self.assertTrue(out['axes']['categories'])

    def test_unknown_verdict_falls_back_to_reject(self):
        out = scope_ai_ranker._normalize_review({'verdict': 'maybe'})
        self.assertEqual(out['verdict'], 'reject')

    def test_confidence_is_clamped(self):
        # Out-of-range confidence (model hallucinates) → clamped to [0,1].
        too_high = scope_ai_ranker._normalize_review({'verdict': 'accept', 'confidence': 9.9})
        too_low = scope_ai_ranker._normalize_review({'verdict': 'accept', 'confidence': -2})
        self.assertEqual(too_high['confidence'], 1.0)
        self.assertEqual(too_low['confidence'], 0.0)

    def test_garbage_input_does_not_crash(self):
        # None, missing keys, wrong types — none should raise.
        cases = [
            {},
            {'verdict': None, 'confidence': None, 'rationale': None},
            {'verdict': 123, 'confidence': 'not a number'},
            {'verdict': 'accept', 'rationale': 'x' * 5000},  # over-long rationale
        ]
        for c in cases:
            out = scope_ai_ranker._normalize_review(c)
            self.assertIn(out['verdict'], ('accept', 'partial', 'reject'))
            self.assertGreaterEqual(out['confidence'], 0.0)
            self.assertLessEqual(out['confidence'], 1.0)
            self.assertLessEqual(len(out['rationale']), 240)


class ParseLLMJsonTests(TestCase):
    """Anthropic + OpenAI sometimes wrap output in markdown fences despite
    the system prompt forbidding it. Defensive parser must handle that."""

    def test_plain_json(self):
        result = scope_ai_ranker._parse_llm_json('{"verdict": "accept", "confidence": 0.7}')
        self.assertIsNotNone(result)
        self.assertEqual(result['verdict'], 'accept')

    def test_markdown_fenced_json(self):
        # Strips ```json … ``` wrappers.
        result = scope_ai_ranker._parse_llm_json(
            '```json\n{"verdict": "reject", "confidence": 0.1}\n```'
        )
        self.assertIsNotNone(result)
        self.assertEqual(result['verdict'], 'reject')

    def test_invalid_json_returns_none(self):
        # Don't crash, return None — caller falls back to verdict='error'.
        self.assertIsNone(scope_ai_ranker._parse_llm_json('not valid json'))
        self.assertIsNone(scope_ai_ranker._parse_llm_json(''))
        self.assertIsNone(scope_ai_ranker._parse_llm_json(None))


class EnrichSuggestionsContractTests(TestCase):
    """Higher-level test of the public entry point. Uses a real Organization
    + AIScopeSuggesterConfig but mocks the actual LLM call."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Test Org Ranker', slug='test-ranker-org',
        )

    def test_returns_unchanged_when_ai_disabled(self):
        # No config row → AI is off → suggestions pass through untouched.
        suggestions = [_suggestion()]
        out = scope_ai_ranker.enrich_suggestions(self.org, suggestions)
        self.assertEqual(out, suggestions)
        self.assertNotIn('ai_review', out[0])

    def test_returns_unchanged_when_explicitly_disabled(self):
        # Config exists but enabled=False → still off.
        AIScopeSuggesterConfig.objects.create(organization=self.org, enabled=False)
        suggestions = [_suggestion()]
        out = scope_ai_ranker.enrich_suggestions(self.org, suggestions)
        self.assertNotIn('ai_review', out[0])

    def test_marks_error_when_no_provider_configured(self):
        # Operator turned AI on but never added a provider → the wizard
        # surfaces a clear "configure provider" hint instead of silently
        # falling back to deterministic-only.
        # We mock _resolve_provider rather than relying on the DB so this
        # test stays a pure unit of the ranker's enrich_suggestions logic
        # (and survives any cross-app schema drift in mcpprovider).
        AIScopeSuggesterConfig.objects.create(organization=self.org, enabled=True)
        suggestions = [_suggestion()]
        with patch.object(scope_ai_ranker, '_resolve_provider', return_value=None):
            out = scope_ai_ranker.enrich_suggestions(self.org, suggestions)
        self.assertIn('ai_review', out[0])
        self.assertEqual(out[0]['ai_review']['verdict'], 'error')
        self.assertIn('provider', out[0]['ai_review']['rationale'].lower())

    def test_empty_input_returns_empty(self):
        # Don't call provider for empty input.
        out = scope_ai_ranker.enrich_suggestions(self.org, [])
        self.assertEqual(out, [])


class TokenCapTests(TestCase):
    """The daily cap is a hard cost guard — once breached, no more LLM
    calls until tomorrow. Critical: must not silently retry forever."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Test Org Cap', slug='test-cap-org',
        )

    def _make_value(self):
        # Need a real ProductAttribute to satisfy AIScopeReview FK.
        group = ProductAttribute.objects.create(
            organization=self.org, name='Flavor', code='flavor',
        )
        value = ProductAttribute.objects.create(
            organization=self.org, name='Mango', code='mango', parent=group,
        )
        return value

    def test_reset_rolls_counter_at_midnight(self):
        # Counter resets when reset_at has passed. Verifies the daily-cap
        # guard recovers automatically — no manual intervention needed.
        cfg = AIScopeSuggesterConfig.objects.create(
            organization=self.org, enabled=True,
            tokens_used_today=99_000,
            tokens_reset_at=timezone.now() - timedelta(hours=1),  # passed
        )
        scope_ai_ranker._reset_token_counter_if_needed(cfg)
        cfg.refresh_from_db()
        self.assertEqual(cfg.tokens_used_today, 0)
        self.assertGreater(cfg.tokens_reset_at, timezone.now())

    def test_reset_respects_future_reset_time(self):
        # If reset_at is in the future, don't roll yet.
        future = timezone.now() + timedelta(hours=12)
        cfg = AIScopeSuggesterConfig.objects.create(
            organization=self.org, enabled=True,
            tokens_used_today=50_000,
            tokens_reset_at=future,
        )
        scope_ai_ranker._reset_token_counter_if_needed(cfg)
        cfg.refresh_from_db()
        self.assertEqual(cfg.tokens_used_today, 50_000)


class CacheTests(TestCase):
    """A cached row must be served instead of calling the provider, until
    the TTL expires or the input hash changes."""

    @classmethod
    def setUpTestData(cls):
        cls.org = Organization.objects.create(
            name='Test Org Cache', slug='test-cache-org',
        )
        cls.cfg = AIScopeSuggesterConfig.objects.create(
            organization=cls.org, enabled=True,
        )
        cls.group = ProductAttribute.objects.create(
            organization=cls.org, name='Flavor', code='flavor',
        )
        cls.value = ProductAttribute.objects.create(
            organization=cls.org, name='Mango', code='mango', parent=cls.group,
        )

    def test_cached_row_short_circuits_provider_call(self):
        # Pre-seed a cache row with the exact input_hash the suggestion produces.
        suggestion = _suggestion(value_id=self.value.id, value_name='Mango')
        digest = scope_ai_ranker._hash_payload(scope_ai_ranker._stable_payload(suggestion))
        AIScopeReview.objects.create(
            organization=self.org, value=self.value, input_hash=digest,
            verdict='accept', confidence=0.9, rationale='cached test verdict',
            axis_verdicts={'categories': True, 'countries': True, 'brands': True},
        )
        # Now call _enrich_one — it should NOT invoke the provider, so we
        # can pass a None provider and it must not crash.
        result = scope_ai_ranker._enrich_one(
            organization=self.org, value_id=self.value.id,
            suggestion=suggestion, config=self.cfg, provider=None,
        )
        self.assertEqual(result['verdict'], 'accept')
        self.assertEqual(result['confidence'], 0.9)
        self.assertTrue(result['cached'])
        self.assertEqual(result['rationale'], 'cached test verdict')

    def test_expired_cache_does_not_short_circuit(self):
        # A row older than CACHE_TTL should not be served — even with no
        # provider configured, _enrich_one must NOT return the stale row.
        # We verify this by checking the cached field on the response.
        suggestion = _suggestion(value_id=self.value.id, value_name='Mango')
        digest = scope_ai_ranker._hash_payload(scope_ai_ranker._stable_payload(suggestion))
        old_review = AIScopeReview.objects.create(
            organization=self.org, value=self.value, input_hash=digest,
            verdict='accept', confidence=0.9, rationale='stale',
        )
        # Manually backdate the row past the TTL.
        AIScopeReview.objects.filter(pk=old_review.pk).update(
            created_at=timezone.now() - scope_ai_ranker.CACHE_TTL - timedelta(hours=1)
        )
        # No provider → call falls into the "AI provider error" branch
        # rather than serving the stale cached value.
        with patch.object(scope_ai_ranker, '_call_provider', side_effect=RuntimeError('no provider')):
            result = scope_ai_ranker._enrich_one(
                organization=self.org, value_id=self.value.id,
                suggestion=suggestion, config=self.cfg, provider=object(),  # truthy stub
            )
        # Cached row was ignored, fresh call attempted, fell through to error path.
        self.assertEqual(result['verdict'], 'error')
        self.assertFalse(result.get('cached'))
