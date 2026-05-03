'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Check, X, Sparkles, Loader2, Tag, Globe, FolderTree, Award } from 'lucide-react'
import {
    applyScopeSuggestion,
    type ScopeSuggestion,
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

export function ScopeWizardClient({ initialSuggestions }: { initialSuggestions: ScopeSuggestion[] }) {
    const router = useRouter()
    const [pending, startTransition] = useTransition()
    const [suggestions, setSuggestions] = useState(initialSuggestions)
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

    const applyOne = (s: ScopeSuggestion) => {
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
        })
    }

    const skipOne = (s: ScopeSuggestion) => {
        setSuggestions(prev => prev.filter(x => x.value_id !== s.value_id))
    }

    const applyAll = () => {
        startTransition(async () => {
            let ok = 0; let fail = 0
            for (const s of suggestions) {
                const a = accepted[s.value_id]
                const r = await applyScopeSuggestion(s.value_id, {
                    categories: Array.from(a.categories),
                    countries:  Array.from(a.countries),
                    brands:     Array.from(a.brands),
                })
                if (r.success) ok++; else fail++
            }
            toast.success(`Applied ${ok} suggestion${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}`)
            router.refresh()
            setSuggestions([])
        })
    }

    return (
        <div className="min-h-screen p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
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
    return (
        <div className="rounded-xl p-3 transition-all"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <div className="text-tp-md font-bold text-app-foreground">{s.value_name}</div>
                    <div className="text-tp-xs text-app-muted-foreground">
                        Used by {s.product_count} product{s.product_count === 1 ? '' : 's'}
                    </div>

                    {/* Per-axis suggested chips */}
                    <div className="mt-2 space-y-1.5">
                        {(['categories', 'countries', 'brands'] as AxisKey[]).map(axis => {
                            const items = s.suggested_scope[axis]
                            if (items.length === 0) return null
                            const meta = AXIS_META[axis]
                            const Icon = meta.icon
                            const conf = s.confidence[axis]
                            return (
                                <div key={axis} className="flex items-start gap-2">
                                    <div className="w-20 flex items-center gap-1 flex-shrink-0 text-tp-xxs font-bold uppercase tracking-wider"
                                        style={{ color: meta.color }}>
                                        <Icon size={10} />
                                        {meta.label}
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
