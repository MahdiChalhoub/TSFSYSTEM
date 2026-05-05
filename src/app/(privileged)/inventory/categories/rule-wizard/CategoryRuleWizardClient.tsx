'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    ArrowLeft, Check, X, Sparkles, Loader2, Bot, AlertTriangle, CircleSlash,
    Settings as SettingsIcon, Barcode, Tag, Ruler, Image as ImageIcon, Truck,
} from 'lucide-react'
import {
    listCategoryRuleSuggestions, applyCategoryRuleSuggestion,
    type CategoryRuleSuggestion, type CategoryRuleAIReview, type RuleField,
} from '@/app/actions/inventory/category-rule-suggestions'
import { updateAIScopeConfig, type AIScopeConfig } from '@/app/actions/inventory/scope-suggestions'

/**
 * Phase 7 review wizard. Each suggestion row shows:
 *
 *   [Category name]  [used by N products]  [AI badge]
 *     [icon] requires_barcode   [✓ chip — toggleable]
 *     [icon] requires_brand     [✓ chip]
 *     [icon] requires_unit      [✓ chip]
 *     [icon] requires_photo     [✗ chip — off]
 *     [icon] requires_supplier  [✗ chip — off]
 *   [Skip] [Accept]
 *
 * Click any chip to toggle the field on/off before accepting. Apply
 * creates a CategoryCreationRule with exactly the chips left ON.
 */

const RULE_META: Record<RuleField, { label: string; icon: any; color: string }> = {
    requires_barcode:  { label: 'Barcode',  icon: Barcode,   color: 'var(--app-info, #3b82f6)' },
    requires_brand:    { label: 'Brand',    icon: Tag,       color: 'var(--app-warning, #f59e0b)' },
    requires_unit:     { label: 'Unit',     icon: Ruler,     color: 'var(--app-primary)' },
    requires_photo:    { label: 'Photo',    icon: ImageIcon, color: 'var(--app-success, #22c55e)' },
    requires_supplier: { label: 'Supplier', icon: Truck,     color: 'var(--app-danger, #ef4444)' },
}

const RULE_FIELDS: RuleField[] = [
    'requires_barcode', 'requires_brand', 'requires_unit', 'requires_photo', 'requires_supplier',
]

export function CategoryRuleWizardClient({
    initialSuggestions,
    initialAIConfig,
}: {
    initialSuggestions: CategoryRuleSuggestion[]
    initialAIConfig: AIScopeConfig | null
}) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [suggestions, setSuggestions] = useState(initialSuggestions)
    // Per-row chip state — defaults to the deterministic suggestion
    // (every flag the heuristic flipped on starts checked). Operator
    // can toggle individual fields off before applying.
    const [chips, setChips] = useState<Record<number, Partial<Record<RuleField, boolean>>>>(() => {
        const map: Record<number, Partial<Record<RuleField, boolean>>> = {}
        for (const s of initialSuggestions) map[s.category_id] = { ...s.suggested_rule }
        return map
    })

    const [aiConfig, setAIConfig] = useState(initialAIConfig)
    const [aiOn, setAIOn] = useState(!!initialAIConfig?.enabled && !!initialAIConfig?.has_provider)
    const [aiLoading, setAILoading] = useState(false)
    const [bulkAIThreshold, setBulkAIThreshold] = useState<number>(initialAIConfig?.min_ai_confidence ?? 0.6)

    const reloadWithAI = (next: boolean) => {
        setAIOn(next)
        setAILoading(true)
        startTransition(async () => {
            const fresh = await listCategoryRuleSuggestions(undefined, { ai: next })
            setSuggestions(fresh)
            setChips(prev => {
                const map = { ...prev }
                for (const s of fresh) {
                    if (!map[s.category_id]) map[s.category_id] = { ...s.suggested_rule }
                }
                return map
            })
            setAILoading(false)
        })
    }

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

    const toggleChip = (catId: number, field: RuleField) => {
        setChips(prev => ({
            ...prev,
            [catId]: { ...(prev[catId] || {}), [field]: !(prev[catId]?.[field] ?? false) },
        }))
    }

    const applyOne = (s: CategoryRuleSuggestion) => {
        const rule = chips[s.category_id] || {}
        startTransition(async () => {
            const r = await applyCategoryRuleSuggestion(s.category_id, rule)
            if (r.success) {
                toast.success(`Created rule for "${s.category_name}"`)
                setSuggestions(prev => prev.filter(x => x.category_id !== s.category_id))
            } else {
                toast.error(r.message || 'Apply failed')
            }
        })
    }

    const skipOne = (s: CategoryRuleSuggestion) => {
        setSuggestions(prev => prev.filter(x => x.category_id !== s.category_id))
    }

    const applyMany = (toApply: CategoryRuleSuggestion[], suffix?: string) => {
        startTransition(async () => {
            let ok = 0; let fail = 0
            for (const s of toApply) {
                const r = await applyCategoryRuleSuggestion(s.category_id, chips[s.category_id] || {})
                if (r.success) ok++; else fail++
            }
            toast.success(`Created ${ok} rule${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}${suffix ? ` ${suffix}` : ''}`)
            router.refresh()
            setSuggestions(prev => prev.filter(s => !toApply.some(a => a.category_id === s.category_id)))
        })
    }

    const applyAll = () => applyMany(suggestions)
    const applyAllAIAccepted = () => {
        const winners = suggestions.filter(s =>
            s.ai_review && s.ai_review.verdict === 'accept' && s.ai_review.confidence >= bulkAIThreshold,
        )
        if (winners.length === 0) {
            toast.info('No suggestions meet the AI threshold yet.')
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
                <Link href="/inventory/categories" className="p-2 rounded-xl hover:bg-app-surface transition-all">
                    <ArrowLeft size={16} />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-2">
                        <Sparkles size={20} className="text-app-primary" />
                        Category Rule Wizard
                    </h1>
                    <p className="text-tp-sm text-app-muted-foreground mt-0.5">
                        Auto-derived creation-rule suggestions for categories that don't have one yet.
                        Based on what existing products in each category already have. Accept the ones
                        that match your governance intent — categories stay rule-less until you do.
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

            {/* AI control bar — same shape as the scope wizard so users
                build muscle memory across both wizards. */}
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
                                    ? 'Each suggestion is scored by your AI provider for governance plausibility. Cached for 7 days per row.'
                                    : aiConfig.has_provider
                                        ? 'Add a confidence + per-field endorsement to each row using your configured AI provider.'
                                        : 'No AI provider configured. Add one under MCP → Providers to enable ranking.'}
                            </div>
                        </div>
                    </div>

                    {aiConfig.has_provider ? (
                        <button onClick={() => persistAIToggle(!aiOn)} disabled={pending}
                            className="relative inline-flex items-center h-6 w-11 rounded-full transition-all disabled:opacity-50"
                            style={{ background: aiOn ? 'var(--app-primary)' : 'var(--app-border)' }}>
                            <span className="inline-block w-4 h-4 rounded-full bg-white transition-all"
                                style={{ transform: `translateX(${aiOn ? '24px' : '4px'})` }} />
                        </button>
                    ) : (
                        <Link href="/mcp/providers"
                            className="px-3 py-1.5 rounded-lg text-tp-xs font-bold border flex items-center gap-1.5"
                            style={{ borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}>
                            <SettingsIcon size={11} /> Configure provider
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

            {suggestions.length === 0 ? (
                <div className="text-center py-20">
                    <Check size={36} className="text-app-success mx-auto mb-3 opacity-50" />
                    <p className="text-tp-md font-bold text-app-foreground">All caught up</p>
                    <p className="text-tp-sm text-app-muted-foreground mt-1">
                        Every category with enough products either has a rule already, or doesn't
                        share a clear pattern across its products.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {suggestions.map(s => (
                        <RuleSuggestionRow
                            key={s.category_id}
                            suggestion={s}
                            chips={chips[s.category_id] || {}}
                            onToggleChip={(field) => toggleChip(s.category_id, field)}
                            onAccept={() => applyOne(s)}
                            onSkip={() => skipOne(s)}
                            pending={pending}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function RuleSuggestionRow({
    suggestion: s,
    chips,
    onToggleChip,
    onAccept,
    onSkip,
    pending,
}: {
    suggestion: CategoryRuleSuggestion
    chips: Partial<Record<RuleField, boolean>>
    onToggleChip: (field: RuleField) => void
    onAccept: () => void
    onSkip: () => void
    pending: boolean
}) {
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
                        <span>{s.category_name}</span>
                        {ai && <AIVerdictBadge review={ai} />}
                    </div>
                    {ai && ai.rationale && (
                        <div className="text-tp-xs italic text-app-muted-foreground mt-0.5 flex items-start gap-1">
                            <Bot size={10} className="mt-0.5 flex-shrink-0 opacity-60" />
                            <span>{ai.rationale}</span>
                        </div>
                    )}
                    <details className="text-tp-xs text-app-muted-foreground group/used mt-1">
                        <summary className="cursor-pointer hover:text-app-foreground transition-colors list-none flex items-center gap-1">
                            <span className="text-[9px] inline-block transition-transform group-open/used:rotate-90">▶</span>
                            <span>Used by {s.product_count} product{s.product_count === 1 ? '' : 's'}</span>
                            <span className="text-app-muted-foreground/60">· click to inspect</span>
                        </summary>
                        {s.products_sample.length > 0 && (
                            <ul className="mt-1 ml-4 space-y-0.5 text-tp-xs text-app-foreground">
                                {s.products_sample.map(p => <li key={p.id}>· {p.name}</li>)}
                                {s.products_sample_truncated && (
                                    <li className="text-app-muted-foreground italic">
                                        … +{s.product_count - s.products_sample.length} more
                                    </li>
                                )}
                            </ul>
                        )}
                    </details>

                    {/* Field chips — click to toggle ON/OFF before accepting */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {RULE_FIELDS.map(field => {
                            const meta = RULE_META[field]
                            const Icon = meta.icon
                            const isOn = !!chips[field]
                            const aiDisagrees = ai && ai.verdict !== 'error' && ai.fields && (ai.fields[field] ?? isOn) !== isOn
                            return (
                                <button key={field} type="button"
                                    onClick={() => onToggleChip(field)}
                                    title={aiDisagrees ? 'AI disagrees with this field' : meta.label}
                                    className="text-tp-xs font-bold px-2 py-1 rounded-md border transition-all flex items-center gap-1.5"
                                    style={{
                                        background: isOn ? `color-mix(in srgb, ${meta.color} 12%, transparent)` : 'var(--app-background)',
                                        color: isOn ? meta.color : 'var(--app-muted-foreground)',
                                        borderColor: isOn
                                            ? `color-mix(in srgb, ${meta.color} 40%, transparent)`
                                            : 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                                        opacity: aiDisagrees ? 0.55 : 1,
                                        cursor: 'pointer',
                                    }}>
                                    <Icon size={11} />
                                    {meta.label}
                                    {aiDisagrees && <AlertTriangle size={9} className="text-app-warning" />}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={onAccept} disabled={pending}
                        className="px-3 py-1.5 rounded-lg text-tp-xs font-bold bg-app-primary text-white flex items-center gap-1 hover:brightness-110 transition-all disabled:opacity-50">
                        <Check size={12} /> Accept
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

function AIVerdictBadge({ review }: { review: CategoryRuleAIReview }) {
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
    return (
        <span title={[m.label, pct !== null ? `${pct}%` : null, isCached ? 'cached' : 'fresh', review.rationale].filter(Boolean).join(' · ')}
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
