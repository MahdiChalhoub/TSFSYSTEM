'use client'

/**
 * PackagingSuggestions — Reusable suggestion chip bar
 * ═══════════════════════════════════════════════════════════════
 * Given a product context (category / brand / attribute), fetch
 * ranked packaging suggestions from the smart engine and render
 * them as clickable chips.
 *
 * Click → calls onAccept(packaging) and bumps server usage_count.
 *
 * Usage:
 *   <PackagingSuggestions
 *     categoryId={form.category}
 *     brandId={form.brand}
 *     attributeId={form.attributeId}
 *     attributeValue={form.sizeValue}
 *     onAccept={(pkg) => setPackaging(pkg)}
 *   />
 */

import { useEffect, useState, useMemo } from 'react'
import { Sparkles, Zap, Check, Loader2, TrendingUp, Info } from 'lucide-react'
import {
    getPackagingSuggestions, acceptPackagingSuggestion,
    type PackagingSuggestionRule,
} from '@/app/actions/inventory/packaging-suggestions'

interface Props {
    categoryId?: number | string | null
    brandId?: number | string | null
    attributeId?: number | string | null
    attributeValue?: string | null
    /** Called when user clicks a suggestion. Receives the rule (contains packaging details). */
    onAccept?: (rule: PackagingSuggestionRule) => void
    /** Max chips to show (default 5) */
    maxShown?: number
    /** Compact variant (smaller) */
    compact?: boolean
    /** Hide the header strip */
    headerless?: boolean
}

export function PackagingSuggestions({
    categoryId, brandId, attributeId, attributeValue,
    onAccept, maxShown = 5, compact = false, headerless = false,
}: Props) {
    const [suggestions, setSuggestions] = useState<PackagingSuggestionRule[]>([])
    const [loading, setLoading] = useState(false)
    const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set())

    // Refetch whenever the context changes. Skip if no context at all.
    useEffect(() => {
        const hasAnyContext = categoryId || brandId || attributeId
        if (!hasAnyContext) { setSuggestions([]); return }

        let cancelled = false
        setLoading(true)

        getPackagingSuggestions({
            category: categoryId ?? undefined,
            brand: brandId ?? undefined,
            attribute: attributeId ?? undefined,
            attribute_value: attributeValue ?? undefined,
        })
            .then(res => { if (!cancelled) setSuggestions(res.suggestions || []) })
            .catch(() => { if (!cancelled) setSuggestions([]) })
            .finally(() => { if (!cancelled) setLoading(false) })

        return () => { cancelled = true }
    }, [categoryId, brandId, attributeId, attributeValue])

    const shown = useMemo(() => suggestions.slice(0, maxShown), [suggestions, maxShown])

    const handleAccept = async (rule: PackagingSuggestionRule) => {
        if (!rule.id) return
        setAcceptedIds(prev => new Set(prev).add(rule.id!))
        onAccept?.(rule)
        // Bump usage_count server-side (non-blocking — the UI responds immediately)
        acceptPackagingSuggestion(rule.id).catch(() => { /* silent */ })
    }

    // Nothing to show — render nothing (no awkward empty box)
    if (!loading && suggestions.length === 0) return null

    const padY = compact ? 'py-1.5' : 'py-2'
    const chipPad = compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
    const chipText = compact ? 'text-[10px]' : 'text-[11px]'

    return (
        <div className="rounded-xl overflow-hidden"
            style={{
                background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
            }}>
            {!headerless && (
                <div className={`flex items-center gap-1.5 px-3 ${padY}`}
                    style={{
                        borderBottom: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        color: 'var(--app-primary)',
                    }}>
                    <Sparkles size={compact ? 11 : 12} />
                    <span className="text-[9px] font-black uppercase tracking-widest">
                        Smart Suggestions
                    </span>
                    {loading && <Loader2 size={10} className="animate-spin" />}
                    <span className="text-[9px] font-bold ml-auto"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Based on category, brand, attributes
                    </span>
                </div>
            )}

            <div className={`flex flex-wrap gap-1.5 px-3 ${padY}`}>
                {loading && suggestions.length === 0 && (
                    <span className={`${chipText} flex items-center gap-1.5`}
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <Loader2 size={10} className="animate-spin" /> Finding suggestions…
                    </span>
                )}

                {shown.map((rule, idx) => {
                    const accepted = acceptedIds.has(rule.id!)
                    const isTop = idx === 0
                    return (
                        <button key={rule.id} type="button"
                            onClick={() => handleAccept(rule)}
                            title={`Priority ${rule.effective_priority} · used ${rule.usage_count || 0} times`}
                            className={`inline-flex items-center gap-1.5 ${chipPad} rounded-lg ${chipText} font-black uppercase tracking-widest transition-all hover:scale-[1.03]`}
                            style={accepted ? {
                                background: 'color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)',
                                border: '1.5px solid var(--app-success, #22c55e)',
                                color: 'var(--app-success, #22c55e)',
                            } : isTop ? {
                                background: 'var(--app-primary)',
                                color: 'white',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            } : {
                                background: 'var(--app-surface)',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                color: 'var(--app-primary)',
                            }}>
                            {accepted ? <Check size={10} /> : isTop ? <Zap size={10} /> : <Sparkles size={10} />}
                            <span>{rule.packaging_name}</span>
                            <span className="font-mono opacity-80 font-normal">
                                ×{Number(rule.packaging_ratio).toLocaleString(undefined, { maximumFractionDigits: 2 })} {rule.packaging_unit_code}
                            </span>
                            {(rule.usage_count ?? 0) > 0 && !accepted && (
                                <span className="inline-flex items-center gap-0.5 opacity-75 font-normal">
                                    <TrendingUp size={9} /> {rule.usage_count}
                                </span>
                            )}
                        </button>
                    )
                })}

                {suggestions.length > maxShown && (
                    <span className={`${chipText} px-2 self-center`}
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        +{suggestions.length - maxShown} more
                    </span>
                )}
            </div>

            {!loading && suggestions.length > 0 && !headerless && (
                <div className="px-3 pb-1.5 text-[9px] flex items-center gap-1"
                    style={{ color: 'var(--app-muted-foreground)' }}>
                    <Info size={9} />
                    <span>
                        Top match wins by specificity · click a chip to apply
                    </span>
                </div>
            )}
        </div>
    )
}
