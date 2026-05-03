'use client';

/**
 * Client-side sequence peek — resolves the next auto-number the tenant's
 * TransactionSequence will assign for a given entity type. Used to pre-fill
 * "Code (Unique)" inputs on New forms so master data carries a
 * sequence-driven code out of the box.
 *
 * This is a PEEK — it reads `next_number` without incrementing. The actual
 * increment happens server-side when the record is saved (the backend's
 * reference_code pipeline owns the counter). So overriding or abandoning
 * a form does not waste a number.
 *
 * Known keys (mirrors backend `TransactionSequence.type` values):
 *
 *   CATEGORY · BRAND · UNIT · UNIT_PACKAGE ·
 *   PACKAGING_SUGGESTION_RULE · PRODUCT_GROUP ·
 *   PRODUCT_ATTRIBUTE · WAREHOUSE · PARFUM ·
 *   PURCHASE_ORDER
 */

import { erpFetch } from '@/lib/erp-api';

/**
 * Document-type sequences come in three tiers (mirrors backend
 * `TransactionSequence.DOCUMENT_PREFIXES`):
 *   - OFFICIAL → `<DOC>`              (e.g. PURCHASE_ORDER          → PO-)
 *   - INTERNAL → `<DOC>_INTERNAL`     (e.g. PURCHASE_ORDER_INTERNAL → IPO-)
 *   - DRAFT    → `<DOC>_DRAFT`        (e.g. PURCHASE_ORDER_DRAFT    → DFT-)
 *
 * Use `resolveDocSeqKey('PURCHASE_ORDER', scope)` to pick the right key
 * when the user toggles the scope on a draft form.
 */
export type SequenceKey =
    | 'CATEGORY' | 'BRAND' | 'UNIT' | 'UNIT_PACKAGE'
    | 'PACKAGING_SUGGESTION_RULE' | 'PRODUCT_GROUP'
    | 'PRODUCT_ATTRIBUTE' | 'WAREHOUSE' | 'PARFUM'
    | 'PURCHASE_ORDER' | 'PURCHASE_ORDER_INTERNAL' | 'PURCHASE_ORDER_DRAFT';

export type DocScope = 'OFFICIAL' | 'INTERNAL' | 'DRAFT';

const DEFAULT_PREFIXES: Record<SequenceKey, string> = {
    CATEGORY: 'CAT-',
    BRAND: 'BRA-',
    UNIT: 'UOM-',
    UNIT_PACKAGE: 'PKG-',
    PACKAGING_SUGGESTION_RULE: 'PKR-',
    PRODUCT_GROUP: 'GRP-',
    PRODUCT_ATTRIBUTE: 'ATT-',
    WAREHOUSE: 'WH-',
    PARFUM: 'PAR-',
    PURCHASE_ORDER: 'PO-',
    PURCHASE_ORDER_INTERNAL: 'IPO-',
    PURCHASE_ORDER_DRAFT: 'DFT-',
};

/** Mirror of backend `TransactionSequence.resolve_seq_key`. Returns the
 *  sequence key for a given document type + scope. OFFICIAL is the bare
 *  doc type (no suffix); INTERNAL/DRAFT add a tier suffix. */
export function resolveDocSeqKey(
    doc: 'PURCHASE_ORDER',
    scope: DocScope = 'OFFICIAL',
): SequenceKey {
    if (scope === 'OFFICIAL') return doc
    return `${doc}_${scope}` as SequenceKey
}

/** In-memory cache so opening the New dialog multiple times doesn't round-trip
 *  every click. Entries live 30s — plenty of time to draft the form, short
 *  enough that a completed save on another tab won't show a stale peek for
 *  long. Keyed by sequence type. */
const CACHE_TTL_MS = 30_000;
const cache = new Map<SequenceKey, { value: string; at: number }>();

/** Returns the next code, e.g. "CAT-00012". Uses an in-memory 30s cache so
 *  consecutive opens of the New dialog are instant. Falls back to default
 *  prefix + "00001" when the endpoint is unreachable. */
export async function peekNextCode(type: SequenceKey): Promise<string> {
    const hit = cache.get(type);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
    try {
        const res: any = await erpFetch(`sequences/?type=${encodeURIComponent(type)}`);
        const rows: any[] = Array.isArray(res) ? res : (res?.results ?? []);
        // EXACT match only. The endpoint sometimes returns the full list
        // even when ?type= is passed (back-end ignores it on some installs);
        // falling back to `rows[0]` would silently return another entity's
        // sequence (e.g. JOU- prefix when asking for PURCHASE_ORDER), which
        // looks correct but is dangerously wrong. If no exact match, use the
        // default prefix and a fresh counter — much safer than a random hit.
        const seq = rows.find(r => r.type === type);
        let value: string;
        if (!seq) {
            value = `${DEFAULT_PREFIXES[type]}${String(1).padStart(5, '0')}`;
        } else {
            const prefix = seq.prefix ?? DEFAULT_PREFIXES[type] ?? '';
            const suffix = seq.suffix ?? '';
            const padding = Number(seq.padding) || 5;
            const next = Number(seq.next_number) || 1;
            value = `${prefix}${String(next).padStart(padding, '0')}${suffix}`;
        }
        cache.set(type, { value, at: Date.now() });
        return value;
    } catch {
        return `${DEFAULT_PREFIXES[type]}${String(1).padStart(5, '0')}`;
    }
}

/** Optional warm-up — call this on page mount (e.g. CategoriesClient's
 *  useEffect) so the first New-dialog open has an instant pre-filled code. */
export function prefetchNextCode(type: SequenceKey): void {
    peekNextCode(type).catch(() => { /* ignore */ });
}

/** Sync read of the in-memory cache. Returns `null` if no fetch has
 *  resolved yet for this type (or the entry has expired). Use this to
 *  seed `useState` so a freshly-mounted form renders with the right
 *  suggested code on its first paint — avoids the empty → filled
 *  flicker on the LockableCodeInput placeholder. */
export function peekCachedNextCode(type: SequenceKey): string | null {
    const hit = cache.get(type);
    if (!hit) return null;
    if (Date.now() - hit.at >= CACHE_TTL_MS) return null;
    return hit.value;
}
