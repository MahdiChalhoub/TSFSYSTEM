"""
Phase 7 — AI ranker for category creation-rule suggestions.

Wraps `category_rule_suggester.suggest_category_rules()` output with an
LLM verdict. The deterministic pass observes "every product in this
category has a barcode → suggest requires_barcode=True"; the LLM pass
adds business sense — "yes that makes sense for grocery, no it doesn't
for stationery". Per-field booleans let the wizard endorse the
suggestion holistically OR cherry-pick the fields the LLM endorsed.

This module mirrors `scope_ai_ranker.py` deliberately: same opt-in
config, same daily token cap, same cache/TTL behaviour, same defensive
parsing. The two pipelines share `AIScopeSuggesterConfig` so an
operator who turns AI ON gets enrichment everywhere it's wired.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import timedelta

from django.utils import timezone

# Re-use everything that doesn't depend on the suggestion shape.
from apps.inventory.services.scope_ai_ranker import (
    CACHE_TTL,
    DEFAULT_TOP_N,
    MAX_OUTPUT_TOKENS,
    _call_provider,
    _parse_llm_json,
    _resolve_provider,
    _reset_token_counter_if_needed,
)


logger = logging.getLogger(__name__)


# A fresh system prompt — the rules are different from scope ranking.
SYSTEM_PROMPT = """You are an inventory governance reviewer for a retail ERP.

Each user message describes ONE product CATEGORY and a candidate
"creation rule" the system has derived by observing the products
already in it. The rule is a set of boolean requirements
(`requires_barcode`, `requires_brand`, `requires_unit`,
`requires_photo`, `requires_supplier`) that future products in this
category will be required to satisfy at creation time.

Your job: judge whether each proposed `requires_*` flag makes
commonsense business sense for THIS category.

Rules:
- Grocery / FMCG categories typically require: barcode, brand, unit
- Fresh produce / weighed: requires_unit yes, barcode often no
- Services: usually need none of these
- Cleaning / hygiene: barcode, brand, unit yes; photo nice-to-have
- High-value / electronics: photo + supplier yes
- The product sample is your only ground truth. If the sample
  doesn't visibly support a flag, mark it false and explain.
- Don't propose flags the deterministic pass didn't suggest.
- Keep rationale to one short sentence (≤ 25 words).

Respond ONLY with a JSON object — no preamble, no markdown fence.
Schema:
{
  "verdict": "accept" | "partial" | "reject",
  "confidence": 0.0-1.0,
  "rationale": "<one sentence>",
  "fields": {
    "requires_barcode":  true | false,
    "requires_brand":    true | false,
    "requires_unit":     true | false,
    "requires_photo":    true | false,
    "requires_supplier": true | false
  }
}

For "fields": true means the LLM endorses the flag; false means it
disagrees with the heuristic. Use the heuristic value as your fallback
when you have no opinion. The wizard will visually de-emphasise any
field where the LLM disagrees.
"""


def _stable_payload(suggestion: dict) -> dict:
    return {
        'category': suggestion.get('category_name', ''),
        'product_count': suggestion.get('product_count', 0),
        'sample': sorted([p['name'] for p in suggestion.get('products_sample', [])]),
        'rule': dict(sorted((suggestion.get('suggested_rule') or {}).items())),
    }


def _hash_payload(payload: dict) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(serialized).hexdigest()


def _user_prompt(payload: dict) -> str:
    return (
        "Review this category creation-rule suggestion:\n\n"
        f"Category: {payload['category']}\n"
        f"Used by {payload['product_count']} active product(s). Sample:\n"
        + ''.join(f'  - {n}\n' for n in payload['sample'])
        + f"\nProposed requirements: {json.dumps(payload['rule'])}\n"
    )


def _normalize_review(raw: dict) -> dict:
    """Coerce the LLM response into a defensive shape — same approach as
    scope_ai_ranker._normalize_review but with rule fields instead of
    scope axes."""
    verdict = raw.get('verdict', 'reject')
    if verdict not in ('accept', 'partial', 'reject'):
        verdict = 'reject'
    try:
        confidence = float(raw.get('confidence', 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))
    rationale = str(raw.get('rationale', '') or '').strip()[:240]
    fields_raw = raw.get('fields', {}) or {}
    accept_default = verdict == 'accept'
    fields = {
        k: bool(fields_raw.get(k, accept_default))
        for k in ('requires_barcode', 'requires_brand', 'requires_unit',
                  'requires_photo', 'requires_supplier')
    }
    return {'verdict': verdict, 'confidence': confidence, 'rationale': rationale, 'fields': fields}


def _enrich_one(organization, category_id, suggestion, config, provider) -> dict:
    """Get one cached-or-fresh AI review. Mirrors scope_ai_ranker._enrich_one
    but with the AICategoryRuleReview cache table."""
    from apps.inventory.models import AICategoryRuleReview

    payload = _stable_payload(suggestion)
    digest = _hash_payload(payload)

    cached = (
        AICategoryRuleReview.objects
        .filter(category_id=category_id, input_hash=digest)
        .order_by('-created_at')
        .first()
    )
    if cached and (timezone.now() - cached.created_at) < CACHE_TTL:
        return {
            'verdict':    cached.verdict,
            'confidence': cached.confidence,
            'rationale':  cached.rationale,
            'fields':     cached.field_verdicts or {},
            'cached':     True,
        }

    if config.tokens_used_today >= config.daily_token_cap:
        return {
            'verdict': 'error',
            'confidence': 0.0,
            'rationale': 'Daily AI token cap reached — try again tomorrow or raise the limit in Settings.',
            'fields': {},
            'cached': False,
            'capped': True,
        }

    user_prompt = _user_prompt(payload)
    try:
        response = asyncio.run(_call_provider(provider, SYSTEM_PROMPT, user_prompt))
    except Exception as e:  # noqa: BLE001
        logger.warning('AI category-rule ranker call failed for category=%s: %s', category_id, e)
        return {
            'verdict': 'error',
            'confidence': 0.0,
            'rationale': f'AI provider error: {e}'[:240],
            'fields': {},
            'cached': False,
        }

    parsed = _parse_llm_json(response.get('content', ''))
    if parsed is None:
        review = {
            'verdict': 'error',
            'confidence': 0.0,
            'rationale': 'LLM returned non-JSON output.',
            'fields': {},
        }
    else:
        review = _normalize_review(parsed)

    usage = response.get('usage', {}) or {}
    in_tok  = int(usage.get('input_tokens',  usage.get('prompt_tokens', 0)) or 0)
    out_tok = int(usage.get('output_tokens', usage.get('completion_tokens', 0)) or 0)

    AICategoryRuleReview.objects.update_or_create(
        category_id=category_id, input_hash=digest,
        defaults={
            'organization_id': organization.id,
            'verdict':    review['verdict'],
            'confidence': review['confidence'],
            'rationale':  review['rationale'],
            'field_verdicts': review['fields'],
            'provider_name': provider.provider_type,
            'model_name':    provider.model_name,
            'input_tokens':  in_tok,
            'output_tokens': out_tok,
        },
    )
    config.tokens_used_today = (config.tokens_used_today or 0) + in_tok + out_tok
    config.save(update_fields=['tokens_used_today'])

    review['cached'] = False
    return review


def enrich_category_rule_suggestions(organization, suggestions: list[dict], *, top_n: int = DEFAULT_TOP_N) -> list[dict]:
    """Public entry point used by the API view. Same shape contract as
    scope_ai_ranker.enrich_suggestions: returns the suggestions list
    untouched if AI is off / no provider / cap blown."""
    from apps.inventory.models import AIScopeSuggesterConfig

    if not suggestions:
        return suggestions

    config = AIScopeSuggesterConfig.objects.filter(organization=organization).first()
    if not config or not config.enabled:
        return suggestions

    provider = _resolve_provider(config)
    if not provider:
        for s in suggestions[:top_n]:
            s['ai_review'] = {
                'verdict': 'error',
                'confidence': 0.0,
                'rationale': 'AI ranker is enabled but no MCP provider is configured.',
                'fields': {},
                'cached': False,
            }
        return suggestions

    _reset_token_counter_if_needed(config)

    for s in suggestions[:top_n]:
        s['ai_review'] = _enrich_one(
            organization=organization,
            category_id=s['category_id'],
            suggestion=s,
            config=config,
            provider=provider,
        )

    return suggestions
