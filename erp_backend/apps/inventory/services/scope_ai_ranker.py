"""
Phase 6 of the scoped-attribute-values feature.

Wraps the deterministic scope_suggester output with an LLM-based
sanity check. Each suggestion carrying observed-usage signal is sent
to the org's MCP provider with a tightly-scoped prompt:

    "Given this attribute VALUE in GROUP, used by these N products
     (sample below), and a deterministic suggestion to scope it to
     these categories / countries / brands — does that make
     commonsense business sense?"

The model returns:
    verdict   : accept | partial | reject
    confidence: 0.0 .. 1.0
    rationale : one short sentence shown inline in the wizard
    axes      : per-axis booleans for partial verdicts

Why this matters
────────────────
The deterministic suggester only sees observed usage frequency. It
can't tell that "BBQ flavor" makes sense for chips but not for juice,
or that "Vanilla" makes sense for ice cream but probably shouldn't be
scoped to "industrial cleaners". The LLM pass adds that layer of
domain commonsense without writing an exhaustive rules table.

Cost & safety guards
────────────────────
1. Opt-in per organization (AIScopeSuggesterConfig.enabled).
2. Cached by (value, input_hash) — same suggestion = no second call.
3. Daily token cap per org — never call provider after cap exhausted.
4. Top-N limit — by default only enrich the top 30 suggestions per
   request, sorted by deterministic confidence. Operators can request
   more by paginating the wizard.
5. Minimal payload — names + counts only. No PII, no IDs.
6. Cross-tenant data NEVER leaves the tenant. Each call only carries
   that org's own product names.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from datetime import timedelta
from typing import Any

from django.utils import timezone


logger = logging.getLogger(__name__)


# ── Configuration knobs ──────────────────────────────────────────────
# How many top deterministic suggestions to enrich per call. Bounds
# tokens-per-request even if the deterministic pass returns hundreds.
DEFAULT_TOP_N = 30

# How long a cached review stays valid. After this we re-ask the LLM
# even if the input hash is unchanged — useful when the operator
# updates the prompt or upgrades the model.
CACHE_TTL = timedelta(days=7)

# Conservative ceiling per single call — prevents a runaway prompt
# from spending the daily budget in one shot. The prompt template +
# product sample fits comfortably under this for any realistic value.
MAX_OUTPUT_TOKENS = 400


SYSTEM_PROMPT = """You are an inventory-data quality reviewer for a retail ERP.

Each user message describes ONE attribute value (like a flavor, color,
or size) and the categories / countries / brands the system has
auto-detected as its appropriate scope, based on which products
already use it.

Your job: judge whether scoping the value to those categories /
countries / brands makes commonsense business sense.

Rules:
- If the suggested categories align with the value's natural use
  (e.g. "Mango flavor" → Juices, Smoothies; "BBQ flavor" → Chips,
  Pretzels), accept with high confidence (0.8-1.0).
- If only some axes make sense, return "partial" and mark which
  axes are wrong.
- If the suggestion contradicts common sense (e.g. "Vanilla flavor"
  scoped to "Industrial Cleaners"), reject with low confidence.
- The product sample is your only ground truth. If the sample
  doesn't visibly support the suggested scope, lower confidence.
- Don't invent categories the operator didn't suggest.
- Keep rationale to one short sentence (≤ 20 words).

Respond ONLY with a JSON object — no preamble, no markdown fence.
Schema:
{
  "verdict": "accept" | "partial" | "reject",
  "confidence": 0.0-1.0,
  "rationale": "<one sentence>",
  "axes": {
    "categories": true | false,
    "countries":  true | false,
    "brands":     true | false
  }
}

For "axes": true means the deterministic suggestion on that axis is
correct; false means the LLM thinks it's wrong (the wizard will then
de-emphasise that axis). Use true for an axis with no suggestion.
"""


def _stable_payload(suggestion: dict) -> dict:
    """The minimum subset of a suggestion that is sent to the LLM and
    used to compute its cache key. Stable ordering so the same input
    always hashes identically."""
    return {
        'value':   suggestion.get('value_name', ''),
        'group':   suggestion.get('group_name', ''),
        'product_count': suggestion.get('product_count', 0),
        'sample':  sorted([p['name'] for p in suggestion.get('products_sample', [])]),
        'current': {
            'categories': sorted([c['name'] for c in suggestion.get('current_scope', {}).get('categories', [])]),
            'countries':  sorted([c['name'] for c in suggestion.get('current_scope', {}).get('countries',  [])]),
            'brands':     sorted([c['name'] for c in suggestion.get('current_scope', {}).get('brands',     [])]),
        },
        'suggested': {
            'categories': sorted([c['name'] for c in suggestion.get('suggested_scope', {}).get('categories', [])]),
            'countries':  sorted([c['name'] for c in suggestion.get('suggested_scope', {}).get('countries',  [])]),
            'brands':     sorted([c['name'] for c in suggestion.get('suggested_scope', {}).get('brands',     [])]),
        },
    }


def _hash_payload(payload: dict) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(serialized).hexdigest()


def _user_prompt(payload: dict) -> str:
    """Render the per-suggestion prompt. Compact JSON keeps tokens low."""
    return (
        "Review this scope suggestion:\n\n"
        f"Attribute group: {payload['group']}\n"
        f"Attribute value: {payload['value']}\n"
        f"Used by {payload['product_count']} product(s). Sample:\n"
        + ''.join(f'  - {n}\n' for n in payload['sample'])
        + f"\nCurrent scope: {json.dumps(payload['current'])}\n"
        f"Suggested addition: {json.dumps(payload['suggested'])}\n"
    )


def _parse_llm_json(content: str) -> dict | None:
    """Best-effort JSON parse. The system prompt forbids markdown
    fences, but we strip them defensively in case the model slips."""
    if not content:
        return None
    txt = content.strip()
    if txt.startswith('```'):
        # Strip one fenced block.
        lines = [l for l in txt.splitlines() if not l.startswith('```')]
        txt = '\n'.join(lines).strip()
    try:
        obj = json.loads(txt)
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict):
        return None
    return obj


def _normalize_review(raw: dict) -> dict:
    """Coerce the LLM's JSON into the shape the cache and frontend expect.
    Any out-of-range / missing values fall back to safe defaults."""
    verdict = raw.get('verdict', 'reject')
    if verdict not in ('accept', 'partial', 'reject'):
        verdict = 'reject'
    try:
        confidence = float(raw.get('confidence', 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))
    rationale = str(raw.get('rationale', '') or '').strip()[:240]
    axes_raw = raw.get('axes', {}) or {}
    axes = {
        'categories': bool(axes_raw.get('categories', verdict == 'accept')),
        'countries':  bool(axes_raw.get('countries',  verdict == 'accept')),
        'brands':     bool(axes_raw.get('brands',     verdict == 'accept')),
    }
    return {
        'verdict': verdict,
        'confidence': confidence,
        'rationale': rationale,
        'axes': axes,
    }


def _resolve_provider(config):
    """Use the explicit provider on the config, else the org's default
    MCP provider. Returns None when nothing is configured — caller
    short-circuits to deterministic-only output."""
    from apps.mcp.models import MCPProvider
    if config.provider_id:
        return MCPProvider.objects.filter(id=config.provider_id, is_active=True).first()
    return MCPProvider.objects.filter(
        organization_id=config.organization_id,
        is_active=True,
        is_default=True,
    ).first()


def _reset_token_counter_if_needed(config):
    """Roll the daily counter at UTC midnight. Cheap to call — only
    persists when an actual reset happens."""
    now = timezone.now()
    if config.tokens_reset_at and now < config.tokens_reset_at:
        return
    next_midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    config.tokens_used_today = 0
    config.tokens_reset_at = next_midnight
    config.save(update_fields=['tokens_used_today', 'tokens_reset_at'])


async def _call_provider(provider, system_prompt: str, user_prompt: str) -> dict:
    """Single LLM call. Caps output tokens per call. Returns a dict
    with content + usage in the shape AnthropicAdapter / OpenAIAdapter
    already produce."""
    from apps.mcp.services import AIProviderAdapter

    adapter = AIProviderAdapter.get_adapter(provider)
    # Temporarily clamp max_tokens for ranking — cheaper than letting
    # the provider's verbose default stretch each response.
    original_max = provider.max_tokens
    provider.max_tokens = min(original_max or MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS)
    try:
        return await adapter.chat(
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user',   'content': user_prompt},
            ],
            tools=[],
        )
    finally:
        provider.max_tokens = original_max


def _enrich_one(organization, value_id, suggestion, config, provider) -> dict:
    """Get a single AI review, using the cache when possible. Returns
    the review dict to merge into the suggestion. Errors degrade
    silently to verdict=error, confidence=0 — never block the wizard."""
    from apps.inventory.models import AIScopeReview

    payload = _stable_payload(suggestion)
    digest = _hash_payload(payload)

    # Cache hit?
    cached = (
        AIScopeReview.objects
        .filter(value_id=value_id, input_hash=digest)
        .order_by('-created_at')
        .first()
    )
    if cached and (timezone.now() - cached.created_at) < CACHE_TTL:
        return {
            'verdict':    cached.verdict,
            'confidence': cached.confidence,
            'rationale':  cached.rationale,
            'axes':       cached.axis_verdicts or {'categories': True, 'countries': True, 'brands': True},
            'cached':     True,
        }

    # Token-budget guard — abort before spending if the daily cap is exhausted.
    if config.tokens_used_today >= config.daily_token_cap:
        return {
            'verdict': 'error',
            'confidence': 0.0,
            'rationale': 'Daily AI token cap reached — try again tomorrow or raise the limit in Settings.',
            'axes': {'categories': True, 'countries': True, 'brands': True},
            'cached': False,
            'capped': True,
        }

    user_prompt = _user_prompt(payload)
    try:
        # AnthropicAdapter / OpenAIAdapter are async; bridge via asyncio.run.
        # Each suggestion is a one-shot call so we don't hold a loop open.
        response = asyncio.run(_call_provider(provider, SYSTEM_PROMPT, user_prompt))
    except Exception as e:  # noqa: BLE001
        logger.warning('AI scope ranker call failed for value=%s: %s', value_id, e)
        return {
            'verdict': 'error',
            'confidence': 0.0,
            'rationale': f'AI provider error: {e}'[:240],
            'axes': {'categories': True, 'countries': True, 'brands': True},
            'cached': False,
        }

    parsed = _parse_llm_json(response.get('content', ''))
    if parsed is None:
        review = {
            'verdict': 'error',
            'confidence': 0.0,
            'rationale': 'LLM returned non-JSON output.',
            'axes': {'categories': True, 'countries': True, 'brands': True},
        }
    else:
        review = _normalize_review(parsed)

    usage = response.get('usage', {}) or {}
    in_tok  = int(usage.get('input_tokens',  usage.get('prompt_tokens', 0)) or 0)
    out_tok = int(usage.get('output_tokens', usage.get('completion_tokens', 0)) or 0)

    # Persist the cache row + bump the token counter atomically-ish.
    AIScopeReview.objects.update_or_create(
        value_id=value_id, input_hash=digest,
        defaults={
            'organization_id': organization.id,
            'verdict':    review['verdict'],
            'confidence': review['confidence'],
            'rationale':  review['rationale'],
            'axis_verdicts': review['axes'],
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


def enrich_suggestions(organization, suggestions: list[dict], *, top_n: int = DEFAULT_TOP_N) -> list[dict]:
    """
    Public entry point used by the API view. Takes the list returned by
    suggest_scopes() and returns the SAME shape with `ai_review` glued
    onto each enriched suggestion.

    Ordering is preserved. If AI is disabled, no provider is configured,
    or the daily cap is blown, returns the suggestions untouched (the
    frontend tolerates a missing ai_review field).
    """
    from apps.inventory.models import AIScopeSuggesterConfig

    if not suggestions:
        return suggestions

    config = AIScopeSuggesterConfig.objects.filter(organization=organization).first()
    if not config or not config.enabled:
        return suggestions

    provider = _resolve_provider(config)
    if not provider:
        # AI is enabled but no provider exists. Surface that on each row
        # so the wizard can show a clear "configure AI provider" hint
        # rather than silently fall back to deterministic-only.
        for s in suggestions[:top_n]:
            s['ai_review'] = {
                'verdict': 'error',
                'confidence': 0.0,
                'rationale': 'AI ranker is enabled but no MCP provider is configured for this organization.',
                'axes': {'categories': True, 'countries': True, 'brands': True},
                'cached': False,
            }
        return suggestions

    _reset_token_counter_if_needed(config)

    for s in suggestions[:top_n]:
        s['ai_review'] = _enrich_one(
            organization=organization,
            value_id=s['value_id'],
            suggestion=s,
            config=config,
            provider=provider,
        )

    return suggestions
