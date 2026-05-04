'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Check, X, Sparkles, Loader2, Tag, Globe, FolderTree, Award, Bot, AlertTriangle, CircleSlash, Settings as SettingsIcon } from 'lucide-react'
import {
    applyScopeSuggestion, previewScopeImpact, listScopeSuggestions, updateAIScopeConfig,
    type ScopeSuggestion, type ScopeImpact, type AIScopeConfig, type AIScopeReview,
} from '@/app/actions/inventory/scope-suggestions'

/**
 * Phase 3 review wizard. Each suggestion row shows:
 *
 *   [Group · Value]  [used by N products]
 *     Current scope:    [chips per axis, faded]
 *     Suggested scope:  [chips per axis, primary] · confidence bar
 *   [Skip] [Accept all] [Customize ▾]
 *
 * Customize lets the operator deselect specific suggested ids per axis
 * before applying — so an operator can accept "Juice" but reject the
 * "Smoothie" suggestion if it was a one-off wrong assignment.
 */
type AxisKey = 'categories' | 'countries' | 'brands'

const AXIS_META: Record<AxisKey, { label: string; icon: any; color: string }> = {
    categories: { label: 'Categories', icon: FolderTree, color: 'var(--app-info, #3b82f6)' },
    countries:  { label: 'Countries',  icon: Globe,      color: 'var(--app-warning, #f59e0b)' },
    brands:     { label: 'Brands',     icon: Award,      color: 'var(--app-primary)' },
}

export function ScopeWizardClient({
    initialSuggestions,
    initialAIConfig,
}: {
    initialSuggestions: ScopeSuggestion[]
    initialAIConfig: AIScopeConfig | null
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [suggestions, setSuggestions] = useState(initialSuggestions)
    // Phase 6: AI toggle state. Tracks the operator's UI choice; the
    // actual server fetch happens via listScopeSuggestions({ ai }).
    // Starts in sync with the SSR config so the toggle and the data
    // agree on first paint.
    const [aiConfig, setAIConfig] = useState(initialAIConfig)
    const [aiOn, setAIOn] = useState(!!initialAIConfig?.enabled && !!initialAIConfig?.has_provider)
    const [aiLoading, setAILoading] = useState(false)
    // Threshold operators use to bulk-accept-by-AI-confidence. Starts at
    // the org-configured min (default 0.6) so the obvious wins are
    // pre-selected; operator can drag it up for stricter, down for more.
    const [bulkAIThreshold, setBulkAIThreshold] = useState<number>(initialAIConfig?.min_ai_confidence ?? 0.6)
    // Per-suggestion accepted-id maps. {value_id: {categories: [ids], countries: [ids], brands: [ids]}}
    // Default: every suggested id is accepted. Operator can deselect.
    const [accepted, setAccepted] = useState<Record<number, Record<AxisKey, Set<number>>>>(() => {
        const map: Record<number, Record<AxisKey, Set<number>>> = {}
        for (const s of initialSuggestions) {
            map[s.value_id] = {
                categories: new Set(s.suggested_scope.categories.map(c => c.id)),
                countries:  new Set(s.suggested_scope.countries.map(c => c.id)),
                brands:     new Set(s.suggested_scope.brands.map(c => c.id)),
            }
        }
        return map
    })
    const [customizingId, setCustomizingId] = useState<number | null>(null)
    // Phase 5: pending confirm-with-impact dialog. When non-null, shows
    // a modal asking the operator to confirm a scope edit that would
    // remove products from the value's scope.
    const [pendingConfirm, setPendingConfirm] = useState<{
        suggestion: ScopeSuggestion
        impact: ScopeImpact
    } | null>(null)
    // Phase 5 (close-out task 3): bulk-confirm dialog for Accept-All.
    // Holds the list of risky suggestions (impact > 0) along with the
    // safe ones already applied silently. Operator can apply, skip, or
    // cancel the risky group as a batch.
    const [bulkConfirm, setBulkConfirm] = useState<{
        risky: { suggestion: ScopeSuggestion; impact: ScopeImpact }[]
        safeAppliedCount: number
    } | null>(null)

    // Group suggestions by attribute group for visual structure.
    const grouped = useMemo(() => {
        const map = new Map<string, { groupName: string; items: ScopeSuggestion[] }>()
        for (const s of suggestions) {
            const key = `${s.group_id}`
            if (!map.has(key)) map.set(key, { groupName: s.group_name, items: [] })
            map.get(key)!.items.push(s)
        }
        return Array.from(map.values())
    }, [suggestions])

    const toggleId = (valueId: number, axis: AxisKey, id: number) => {
        setAccepted(prev => {
            const next = { ...prev }
            const set = new Set(next[valueId][axis])
            if (set.has(id)) set.delete(id); else set.add(id)
            next[valueId] = { ...next[valueId], [axis]: set }
            return next
        })
    }

    const reallyApply = (s: ScopeSuggestion) => {
        const a = accepted[s.value_id]
        startTransition(async () => {
            const r = await applyScopeSuggestion(s.value_id, {
                categories: Array.from(a.categories),
                countries:  Array.from(a.countries),
                brands:     Array.from(a.brands),
            })
            if (r.success) {
                toast.success(`Applied scope to "${s.value_name}"`)
                setSuggestions(prev => prev.filter(x => x.value_id !== s.value_id))
            } else {
                toast.error(r.message || 'Apply failed')
            }
            setPendingConfirm(null)
        })
    }

    const applyOne = (s: ScopeSuggestion) => {
        // Phase 5: preview impact first. Adding scope ids NARROWS the
        // available products; if any product currently using this value
        // would lose access, surface a confirm dialog before applying.
        const a = accepted[s.value_id]
        startTransition(async () => {
            const impact = await previewScopeImpact(s.value_id, {
                add_categories: Array.from(a.categories),
                add_countries:  Array.from(a.countries),
                add_brands:     Array.from(a.brands),
            })
            if (impact && impact.products_that_would_lose_access > 0) {
                setPendingConfirm({ suggestion: s, impact })
                return
            }
            // No-impact apply runs immediately.
            reallyApply(s)
        })
    }

    const skipOne = (s: ScopeSuggestion) => {
        setSuggestions(prev => prev.filter(x => x.value_id !== s.value_id))
    }

    // Internal: actually apply the given list of suggestions and refresh.
    // Used by both the safe-batch path inside applyAll and the bulkConfirm
    // "Apply Risky" button.
    const applyMany = (toApply: ScopeSuggestion[], suffix?: string) => {
        startTransition(async () => {
            let ok = 0; let fail = 0
            for (const s of toApply) {
                const a = accepted[s.value_id]
                const r = await applyScopeSuggestion(s.value_id, {
                    categories: Array.from(a.categories),
                    countries:  Array.from(a.countries),
                    brands:     Array.from(a.brands),
                })
                if (r.success) ok++; else fail++
            }
            const msg = `Applied ${ok} suggestion${ok === 1 ? '' : 's'}`
                + (fail ? ` · ${fail} failed` : '')
                + (suffix ? ` ${suffix}` : '')
            toast.success(msg)
            router.refresh()
            setSuggestions(prev => prev.filter(s => !toApply.some(a => a.value_id === s.value_id)))
            setBulkConfirm(null)
        })
    }

    const applyAll = () => {
        startTransition(async () => {
            // Preview impact for every suggestion in parallel — don't
            // serialize the network calls. Each result tells us whether
            // the apply would orphan products (risky) or not (safe).
            const previews = await Promise.all(
                suggestions.map(async s => {
                    const a = accepted[s.value_id]
                    const impact = await previewScopeImpact(s.value_id, {
                        add_categories: Array.from(a.categories),
                        add_countries:  Array.from(a.countries),
                        add_brands:     Array.from(a.brands),
                    })
                    return { suggestion: s, impact }
                })
            )

            const safe   = previews.filter(p => !p.impact || p.impact.products_that_would_lose_access === 0)
            const risky  = previews.filter(p => p.impact && p.impact.products_that_would_lose_access > 0)

            // Apply every safe suggestion immediately. If there are any
            // risky ones, surface a single bulk-confirm dialog after the
            // safe batch finishes so the operator decides on them
            // together rather than seeing N modals.
            if (safe.length > 0) {
                let ok = 0; let fail = 0
                for (const { suggestion: s } of safe) {
                    const a = accepted[s.value_id]
                    const r = await applyScopeSuggestion(s.value_id, {
                        categories: Array.from(a.categories),
                        countries:  Array.from(a.countries),
                        brands:     Array.from(a.brands),
                    })
                    if (r.success) ok++; else fail++
                }
                if (risky.length === 0) {
                    toast.success(`Applied ${ok} suggestion${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}`)
                    router.refresh()
                    setSuggestions([])
                    return
                }
                // Hand the risky batch to the bulk-confirm dialog.
                toast.success(`Applied ${ok} safe suggestion${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}`)
                setSuggestions(prev => prev.filter(s => !safe.some(p => p.suggestion.value_id === s.value_id)))
                setBulkConfirm({ risky: risky as { suggestion: ScopeSuggestion; impact: ScopeImpact }[], safeAppliedCount: ok })
            } else if (risky.length > 0) {
                // All suggestions are risky — go straight to bulk confirm.
                setBulkConfirm({ risky: risky as { suggestion: ScopeSuggestion; impact: ScopeImpact }[], safeAppliedCount: 0 })
            }
        })
    }

    // Phase 6: re-fetch suggestions with the new AI flag. Keeps the
    // operator's customization state intact (accepted ids per axis are
    // re-seeded only for newly-arriving suggestion ids).
    const reloadWithAI = (next: boolean) => {
        setAIOn(next)
        setAILoading(true)
        startTransition(async () => {
            const fresh = await listScopeSuggestions(undefined, { ai: next })
            setSuggestions(fresh)
            setAccepted(prev => {
                const map = { ...prev }
                for (const s of fresh) {
                    if (!map[s.value_id]) {
                        map[s.value_id] = {
                            categories: new Set(s.suggested_scope.categories.map(c => c.id)),
                            countries:  new Set(s.suggested_scope.countries.map(c => c.id)),
                            brands:     new Set(s.suggested_scope.brands.map(c => c.id)),
                        }
                    }
                }
                return map
            })
            setAILoading(false)
        })
    }

    // Phase 6: persist the toggle to backend so it sticks across sessions
    // and the SSR loader picks the right path on the next page open.
    const persistAIToggle = (next: boolean) => {
        startTransition(async () => {
            const r = await updateAIScopeConfig({ enabled: next })
            if (r.success && r.config) {
                setAIConfig(r.config)
                if ((r.config.enabled && r.config.has_provider) !== aiOn) {
                    reloadWithAI(r.config.enabled && r.config.has_provider)
                }
            } else {
                toast.error(r.message || 'Could not save AI setting')
            }
        })
    }

    // Phase 6: accept every suggestion whose AI confidence ≥ threshold
    // and whose verdict is "accept". Skips uncertain / partial / rejected
    // rows so the operator only batch-applies the obvious wins.
    const applyAllAIAccepted = () => {
        const winners = suggestions.filter(s =>
            s.ai_review
            && s.ai_review.verdict === 'accept'
            && s.ai_review.confidence >= bulkAIThreshold,
        )
        if (winners.length === 0) {
            toast.info('No suggestions meet the AI threshold yet — try lowering it or using Accept All.')
            return
        }
        applyMany(winners, `(AI ≥ ${Math.round(bulkAIThreshold * 100)}%)`)
    }

    const aiAcceptedCount = useMemo(
        () => suggestions.filter(s => s.ai_review?.verdict === 'accept' && s.ai_review.confidence >= bulkAIThreshold).length,
        [suggestions, bulkAIThreshold],
    )

    return (
        <div className="min-h-screen p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                <Link href="/inventory/attributes" className="p-2 rounded-xl hover:bg-app-surface transition-all">
                    <ArrowLeft size={16} />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-2">
                        <Sparkles size={20} className="text-app-primary" />
                        Scope Review Wizard
                    </h1>
                    <p className="text-tp-sm text-app-muted-foreground mt-0.5">
                        Auto-derived scope suggestions for attribute values, based on how products
                        currently use them. Accept the ones that match your intent — values stay
                        universal until you do.
                    </p>
                </div>
                {suggestions.length > 0 && (
                    <button onClick={applyAll} disabled={pending}
                        className="px-4 py-2 rounded-xl bg-app-primary text-white text-tp-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50">
                        {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                        Accept All ({suggestions.length})
                    </button>
                )}
            </div>

            {/* Phase 6: AI ranker control bar. Renders when an AI provider
                is available (whether enabled or not) so the operator can
                turn it on inline without leaving the wizard. When the org
                has no provider configured, points to Settings instead. */}
            {aiConfig && (
                <div className="mb-4 rounded-xl px-3 py-2.5 flex items-center gap-3 flex-wrap"
                    style={{
                        background: aiOn
                            ? 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))'
                            : 'var(--app-surface)',
                        border: `1px solid ${aiOn ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'var(--app-border)'}`,
                    }}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                                background: aiOn
                                    ? 'color-mix(in srgb, var(--app-primary) 15%, transparent)'
                                    : 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',
                                color: aiOn ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                            }}>
                            <Bot size={14} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-tp-sm font-bold text-app-foreground flex items-center gap-2">
                                AI ranking
                                {aiLoading && <Loader2 size={11} className="animate-spin text-app-muted-foreground" />}
                                {aiOn && aiConfig.tokens_used_today > 0 && (
                                    <span className="text-tp-xxs font-normal text-app-muted-foreground">
                                        · {aiConfig.tokens_used_today.toLocaleString()} / {aiConfig.daily_token_cap.toLocaleString()} tokens today
                                    </span>
                                )}
                            </div>
                            <div className="text-tp-xs text-app-muted-foreground truncate">
                                {aiOn
                                    ? 'Each suggestion is scored by your AI provider for commonsense plausibility. Cached for 7 days per row.'
                                    : aiConfig.has_provider
                                        ? 'Add a confidence + rationale to each row using your configured AI provider.'
                                        : 'No AI provider configured. Add one under /agents to enable ranking.'}
                            </div>
                        </div>
                    </div>

                    {aiConfig.has_provider ? (
                        <button onClick={() => persistAIToggle(!aiOn)}
                            disabled={pending}
                            className="relative inline-flex items-center h-6 w-11 rounded-full transition-all disabled:opacity-50"
                            style={{ background: aiOn ? 'var(--app-primary)' : 'var(--app-border)' }}>
                            <span className="inline-block w-4 h-4 rounded-full bg-white transition-all"
                                style={{ transform: `translateX(${aiOn ? '24px' : '4px'})` }} />
                        </button>
                    ) : (
                        <Link href="/agents"
                            className="px-3 py-1.5 rounded-lg text-tp-xs font-bold border flex items-center gap-1.5"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}>
                            <SettingsIcon size={11} /> Configure
                        </Link>
                    )}

                    {aiOn && aiAcceptedCount > 0 && (
                        <div className="flex items-center gap-2 ml-auto basis-full sm:basis-auto pt-2 sm:pt-0 border-t sm:border-t-0 sm:border-l sm:pl-3"
                            style={{ borderColor: 'color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <label className="text-tp-xxs uppercase tracking-wider font-bold text-app-muted-foreground whitespace-nowrap">
                                Bulk threshold
                            </label>
                            <input type="range" min={0} max={100} step={5}
                                value={Math.round(bulkAIThreshold * 100)}
                                onChange={e => setBulkAIThreshold(Number(e.target.value) / 100)}
                                className="w-24 accent-current" style={{ color: 'var(--app-primary)' }} />
                            <span className="text-tp-xs font-mono font-bold text-app-foreground w-9 text-right">
                                {Math.round(bulkAIThreshold * 100)}%
                            </span>
                            <button onClick={applyAllAIAccepted} disabled={pending || aiAcceptedCount === 0}
                                className="px-3 py-1.5 rounded-lg text-tp-xs font-bold bg-app-primary text-white flex items-center gap-1.5 hover:brightness-110 transition-all disabled:opacity-50">
                                {pending ? <Loader2 size={11} className="animate-spin" /> : <Bot size={11} />}
                                Accept AI picks ({aiAcceptedCount})
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Phase 5: confirm dialog when an apply would orphan
                products. Lists the count + first 10 affected so the
                operator sees the blast radius before clicking confirm. */}
            {/* Phase 5 (close-out task 3): bulk-confirm dialog when
                Accept-All splits into safe + risky batches. Shows a
                summary list of risky suggestions with per-row impact
                count so operator decides on the whole group at once. */}
            {bulkConfirm && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center animate-in fade-in duration-150"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setBulkConfirm(null) }}>
                    <div className="w-full max-w-lg mx-4 rounded-2xl p-5 animate-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div className="flex items-start gap-2 mb-3 flex-shrink-0">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-warning)' }}>
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h3 className="text-tp-md font-bold text-app-foreground">
                                    {bulkConfirm.risky.length} risky suggestion{bulkConfirm.risky.length === 1 ? '' : 's'} need confirmation
                                </h3>
                                <p className="text-tp-xs text-app-muted-foreground">
                                    {bulkConfirm.safeAppliedCount > 0
                                        ? <>Already applied <strong>{bulkConfirm.safeAppliedCount}</strong> safe one{bulkConfirm.safeAppliedCount === 1 ? '' : 's'}. The remaining would orphan products from their values.</>
                                        : <>These would each orphan products from their values. Review the impact below.</>}
                                </p>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-1 px-1 mb-3">
                            <ul className="space-y-1.5">
                                {bulkConfirm.risky.map(({ suggestion: s, impact }) => (
                                    <li key={s.value_id} className="rounded-lg p-2.5 flex items-start gap-2"
                                        style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-tp-sm font-bold text-app-foreground truncate">
                                                {s.group_name} · {s.value_name}
                                            </div>
                                            <div className="text-tp-xs text-app-muted-foreground mt-0.5">
                                                <span className="font-bold" style={{ color: 'var(--app-warning)' }}>
                                                    −{impact.products_that_would_lose_access}
                                                </span>
                                                {' '}of {impact.products_currently_using_value} product
                                                {impact.products_currently_using_value === 1 ? '' : 's'} would lose this value
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="flex gap-2 justify-end flex-shrink-0">
                            <button onClick={() => setBulkConfirm(null)}
                                className="px-4 py-2 rounded-xl text-tp-xs font-bold border"
                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                Cancel All
                            </button>
                            <button onClick={() => applyMany(bulkConfirm.risky.map(r => r.suggestion), '(risky batch)')}
                                disabled={pending}
                                className="px-4 py-2 rounded-xl text-tp-xs font-bold bg-app-warning text-white flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50">
                                {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Apply All Anyway ({bulkConfirm.risky.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingConfirm && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center animate-in fade-in duration-150"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setPendingConfirm(null) }}>
                    <div className="w-full max-w-md mx-4 rounded-2xl p-5 animate-in zoom-in-95 duration-150"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div className="flex items-start gap-2 mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-warning)' }}>
                                <Sparkles size={16} />
                            </div>
                            <div>
                                <h3 className="text-tp-md font-bold text-app-foreground">Confirm scope narrowing</h3>
                                <p className="text-tp-xs text-app-muted-foreground">
                                    Applying this scope to <strong>{pendingConfirm.suggestion.value_name}</strong> would
                                    remove <strong>{pendingConfirm.impact.products_that_would_lose_access}</strong> of
                                    the <strong>{pendingConfirm.impact.products_currently_using_value}</strong> product
                                    {pendingConfirm.impact.products_currently_using_value === 1 ? '' : 's'} currently using it.
                                </p>
                            </div>
                        </div>
                        {pendingConfirm.impact.losers_sample.length > 0 && (
                            <div className="rounded-xl p-3 mb-3 max-h-48 overflow-y-auto custom-scrollbar"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <p className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground mb-1.5">
                                    Affected products (first {pendingConfirm.impact.losers_sample.length})
                                </p>
                                <ul className="text-tp-xs text-app-foreground space-y-0.5">
                                    {pendingConfirm.impact.losers_sample.map(p => (
                                        <li key={p.id}>· {p.name}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setPendingConfirm(null)}
                                className="px-4 py-2 rounded-xl text-tp-xs font-bold border"
                                style={{ color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                Cancel
                            </button>
                            <button onClick={() => reallyApply(pendingConfirm.suggestion)} disabled={pending}
                                className="px-4 py-2 rounded-xl text-tp-xs font-bold bg-app-warning text-white flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50">
                                {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Apply Anyway
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {suggestions.length === 0 ? (
                <div className="text-center py-20">
                    <Check size={36} className="text-app-success mx-auto mb-3 opacity-50" />
                    <p className="text-tp-md font-bold text-app-foreground">All caught up</p>
                    <p className="text-tp-sm text-app-muted-foreground mt-1">
                        No new scope suggestions. Existing values are either already scoped or
                        used too rarely to derive a meaningful pattern.
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {grouped.map(({ groupName, items }) => (
                        <section key={groupName}>
                            <h2 className="text-tp-xs font-black uppercase tracking-widest text-app-muted-foreground mb-2 flex items-center gap-2">
                                <Tag size={11} /> {groupName}
                                <span className="text-app-muted-foreground/60">·</span>
                                <span>{items.length}</span>
                            </h2>
                            <div className="space-y-2">
                                {items.map(s => (
                                    <SuggestionRow
                                        key={s.value_id}
                                        suggestion={s}
                                        accepted={accepted[s.value_id]}
                                        customizing={customizingId === s.value_id}
                                        onToggleId={(axis, id) => toggleId(s.value_id, axis, id)}
                                        onAccept={() => applyOne(s)}
                                        onSkip={() => skipOne(s)}
                                        onCustomize={() => setCustomizingId(prev => prev === s.value_id ? null : s.value_id)}
                                        pending={pending}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    )
}

function SuggestionRow({
    suggestion: s,
    accepted,
    customizing,
    onToggleId,
    onAccept,
    onSkip,
    onCustomize,
    pending,
}: {
    suggestion: ScopeSuggestion
    accepted: Record<AxisKey, Set<number>>
    customizing: boolean
    onToggleId: (axis: AxisKey, id: number) => void
    onAccept: () => void
    onSkip: () => void
    onCustomize: () => void
    pending: boolean
}) {
    // Phase 6: subtle border tint when an AI verdict is present, so the
    // operator can scan the list and immediately spot which rows have
    // been AI-vetted and which are deterministic-only.
    const ai = s.ai_review
    const aiBorder = ai
        ? ai.verdict === 'accept'  ? 'color-mix(in srgb, var(--app-success) 35%, transparent)'
        : ai.verdict === 'reject'  ? 'color-mix(in srgb, var(--app-danger) 35%, transparent)'
        : ai.verdict === 'partial' ? 'color-mix(in srgb, var(--app-warning) 40%, transparent)'
        :                            'var(--app-border)'
        : 'var(--app-border)'

    return (
        <div className="rounded-xl p-3 transition-all"
            style={{ background: 'var(--app-surface)', border: `1px solid ${aiBorder}` }}>
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="text-tp-md font-bold text-app-foreground flex items-center gap-2 flex-wrap">
                        <span>{s.value_name}</span>
                        {ai && <AIVerdictBadge review={ai} />}
                    </div>
                    {/* Phase 6: AI rationale inline. One short sentence
                        in italic muted text directly under the title so
                        the operator reads it before scanning the chips. */}
                    {ai && ai.rationale && (
                        <div className="text-tp-xs italic text-app-muted-foreground mt-0.5 flex items-start gap-1">
                            <Bot size={10} className="mt-0.5 flex-shrink-0 opacity-60" />
                            <span>{ai.rationale}</span>
                        </div>
                    )}
                    {/* Used-by line is now an expandable details element
                        so the operator can verify exactly which products
                        the suggestion is derived from before clicking
                        Accept. Closed by default to keep the row compact. */}
                    <details className="text-tp-xs text-app-muted-foreground group/used">
                        <summary className="cursor-pointer hover:text-app-foreground transition-colors list-none flex items-center gap-1">
                            <span className="text-[9px] inline-block transition-transform group-open/used:rotate-90">▶</span>
                            <span>Used by {s.product_count} product{s.product_count === 1 ? '' : 's'}</span>
                            {s.products_sample.length > 0 && (
                                <span className="text-app-muted-foreground/60">· click to inspect</span>
                            )}
                        </summary>
                        {s.products_sample.length > 0 && (
                            <ul className="mt-1 ml-4 space-y-0.5 text-tp-xs text-app-foreground">
                                {s.products_sample.map(p => (
                                    <li key={p.id}>· {p.name}</li>
                                ))}
                                {s.products_sample_truncated && (
                                    <li className="text-app-muted-foreground italic">
                                        … +{s.product_count - s.products_sample.length} more
                                    </li>
                                )}
                            </ul>
                        )}
                    </details>

                    {/* Per-axis suggested chips */}
                    <div className="mt-2 space-y-1.5">
                        {(['categories', 'countries', 'brands'] as AxisKey[]).map(axis => {
                            const items = s.suggested_scope[axis]
                            if (items.length === 0) return null
                            const meta = AXIS_META[axis]
                            const Icon = meta.icon
                            const conf = s.confidence[axis]
                            // Phase 6: axis-level AI disagreement. When the
                            // LLM marked this axis as wrong, dim the row
                            // and surface a small warning so the operator
                            // sees AT-CHIP-LEVEL where the heuristic and
                            // AI disagree, not just at the row level.
                            const axisAIDisagrees = ai && ai.verdict !== 'error' && ai.axes && ai.axes[axis] === false
                            return (
                                <div key={axis} className="flex items-start gap-2"
                                    style={{ opacity: axisAIDisagrees ? 0.5 : 1 }}>
                                    <div className="w-20 flex items-center gap-1 flex-shrink-0 text-tp-xxs font-bold uppercase tracking-wider"
                                        style={{ color: meta.color }}>
                                        <Icon size={10} />
                                        {meta.label}
                                        {axisAIDisagrees && (
                                            <span title="AI thinks this axis is wrong"
                                                className="text-app-warning ml-0.5">
                                                <AlertTriangle size={9} />
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex-1 flex flex-wrap gap-1">
                                        {items.map(it => {
                                            const isOn = accepted[axis].has(it.id)
                                            return (
                                                <button key={it.id} type="button"
                                                    onClick={() => customizing && onToggleId(axis, it.id)}
                                                    disabled={!customizing}
                                                    className="text-tp-xs font-bold px-2 py-0.5 rounded-md border transition-all"
                                                    style={{
                                                        background: isOn ? `color-mix(in srgb, ${meta.color} 12%, transparent)` : 'var(--app-background)',
                                                        color: isOn ? meta.color : 'var(--app-muted-foreground)',
                                                        borderColor: isOn
                                                            ? `color-mix(in srgb, ${meta.color} 40%, transparent)`
                                                            : 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                                                        textDecoration: !isOn ? 'line-through' : undefined,
                                                        cursor: customizing ? 'pointer' : 'default',
                                                    }}>
                                                    {it.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                    {/* Confidence bar */}
                                    <div className="w-12 flex-shrink-0 text-right">
                                        <div className="text-tp-xxs font-mono font-bold" style={{ color: meta.color }}>
                                            {Math.round(conf * 100)}%
                                        </div>
                                        <div className="h-1 rounded-full mt-0.5"
                                            style={{ background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                            <div className="h-full rounded-full" style={{ width: `${conf * 100}%`, background: meta.color }} />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Current scope (faded, for context) */}
                    {(s.current_scope.categories.length + s.current_scope.countries.length + s.current_scope.brands.length) > 0 && (
                        <details className="mt-2">
                            <summary className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground cursor-pointer">
                                Current scope
                            </summary>
                            <div className="mt-1 text-tp-xs text-app-muted-foreground space-y-0.5">
                                {s.current_scope.categories.length > 0 && <div>Categories: {s.current_scope.categories.map(x => x.name).join(', ')}</div>}
                                {s.current_scope.countries.length  > 0 && <div>Countries: {s.current_scope.countries.map(x => x.name).join(', ')}</div>}
                                {s.current_scope.brands.length     > 0 && <div>Brands: {s.current_scope.brands.map(x => x.name).join(', ')}</div>}
                            </div>
                        </details>
                    )}
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={onAccept} disabled={pending}
                        className="px-3 py-1.5 rounded-lg text-tp-xs font-bold bg-app-primary text-white flex items-center gap-1 hover:brightness-110 transition-all disabled:opacity-50">
                        <Check size={12} /> Accept
                    </button>
                    <button onClick={onCustomize}
                        className="px-3 py-1.5 rounded-lg text-tp-xs font-bold border transition-all"
                        style={{
                            color: customizing ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                            borderColor: customizing ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)' : 'var(--app-border)',
                            background: customizing ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)' : undefined,
                        }}>
                        {customizing ? 'Done' : 'Customize'}
                    </button>
                    <button onClick={onSkip}
                        className="px-3 py-1.5 rounded-lg text-tp-xs font-bold text-app-muted-foreground hover:bg-app-border/30 flex items-center gap-1 transition-all">
                        <X size={12} /> Skip
                    </button>
                </div>
            </div>
        </div>
    )
}

/**
 * Phase 6: AI verdict pill rendered next to the value name. Color-coded
 * by verdict, percentage shown for accept/partial. Hover reveals the
 * full review meta (cached vs fresh, capped, error reason).
 */
function AIVerdictBadge({ review }: { review: AIScopeReview }) {
    const isCached = !!review.cached
    const map = {
        accept:  { bg: 'var(--app-success)', label: 'AI accepts',  Icon: Bot },
        partial: { bg: 'var(--app-warning)', label: 'AI partial',  Icon: AlertTriangle },
        reject:  { bg: 'var(--app-danger)',  label: 'AI rejects',  Icon: CircleSlash },
        error:   { bg: 'var(--app-muted-foreground)', label: 'AI error', Icon: AlertTriangle },
    } as const
    const m = map[review.verdict] ?? map.error
    const Icon = m.Icon
    const pct = review.verdict === 'error' ? null : Math.round(review.confidence * 100)
    const tooltip = [
        `Verdict: ${review.verdict}`,
        pct !== null ? `Confidence: ${pct}%` : null,
        isCached ? 'Source: cache' : 'Source: fresh AI call',
        review.capped ? 'Daily token cap reached' : null,
        review.rationale,
    ].filter(Boolean).join('\n')
    return (
        <span title={tooltip}
            className="inline-flex items-center gap-1 text-tp-xxs font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider"
            style={{
                background: `color-mix(in srgb, ${m.bg} 15%, transparent)`,
                color: m.bg,
                border: `1px solid color-mix(in srgb, ${m.bg} 35%, transparent)`,
            }}>
            <Icon size={9} />
            {m.label}
            {pct !== null && <span className="font-mono">{pct}%</span>}
            {isCached && <span className="opacity-60 normal-case">·cached</span>}
        </span>
    )
}
