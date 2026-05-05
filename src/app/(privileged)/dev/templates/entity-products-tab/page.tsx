'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Ruler, Search, ExternalLink, Info, Loader2 } from 'lucide-react'
import { EntityProductsTab } from '@/components/templates/EntityProductsTab'
import { erpFetch } from '@/lib/erp-api'

/* ═══════════════════════════════════════════════════════════
 *  EntityProductsTab needs a live entity + explore endpoint,
 *  so the demo picks a real Unit from the backend and mounts
 *  the tab against it. You can switch units from the dropdown
 *  on the left to see the tab re-hydrate.
 * ═══════════════════════════════════════════════════════════ */

export default function EntityProductsTabDemo() {
    const [units, setUnits] = useState<any[] | null>(null)
    const [unitId, setUnitId] = useState<number | null>(null)
    const [err, setErr] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        erpFetch('units/')
            .then((res: any) => {
                if (cancelled) return
                const list = Array.isArray(res) ? res : (res?.results ?? [])
                setUnits(list)
                if (list.length > 0) setUnitId(list[0].id)
            })
            .catch((e: any) => { if (!cancelled) setErr(e?.message || 'Failed to load units') })
        return () => { cancelled = true }
    }, [])

    const currentUnit = units?.find(u => u.id === unitId)

    return (
        <div className="p-4 md:p-6 max-w-6xl mx-auto animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
                <Link href="/dev/templates"
                    className="p-2 rounded-xl transition-all"
                    style={{
                        color: 'var(--app-muted-foreground)',
                        background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    <ArrowLeft size={14} />
                </Link>
                <div>
                    <h1>EntityProductsTab</h1>
                    <p className="text-tp-xs text-app-muted-foreground">
                        Drop-in tab used inside detail panels. Live data from <code className="font-mono">units/:id/explore/</code>.
                    </p>
                </div>
            </div>

            {/* Banner */}
            <div className="mb-4 px-3 py-2 rounded-xl flex items-start gap-2 text-tp-xs"
                style={{
                    background: 'color-mix(in srgb, var(--app-info) 6%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-info) 25%, transparent)',
                    color: 'var(--app-muted-foreground)',
                }}>
                <Info size={14} style={{ color: 'var(--app-info)', flexShrink: 0, marginTop: 1 }} />
                <div>
                    This tab expects an <strong>entityId</strong> and an <strong>exploreEndpoint</strong>. Swap the unit
                    below to mount it against a different entity — the tab re-fetches, resets selection, and loads fresh
                    products. See <Link href="/inventory/units" className="underline" style={{ color: 'var(--app-info)' }}>/inventory/units</Link> for the production mount (inside the Unit detail panel).
                </div>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(220px, 280px) 1fr' }}>
                {/* Left: Unit picker */}
                <aside className="rounded-2xl p-3 h-fit"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                            <Ruler size={13} />
                        </div>
                        <div>
                            <p className="text-tp-xxs font-black uppercase tracking-wider text-app-muted-foreground">Pick a unit</p>
                            <p className="text-tp-xs font-bold text-app-foreground">
                                {units === null ? 'Loading…' : `${units.length} available`}
                            </p>
                        </div>
                    </div>

                    {err && (
                        <p className="text-tp-xs" style={{ color: 'var(--app-error)' }}>{err}</p>
                    )}

                    {units === null ? (
                        <div className="flex items-center gap-2 text-tp-xs text-app-muted-foreground">
                            <Loader2 size={12} className="animate-spin" />Loading units…
                        </div>
                    ) : units.length === 0 ? (
                        <p className="text-tp-xs text-app-muted-foreground">
                            No units defined — create one at <Link href="/inventory/units" className="underline">/inventory/units</Link>.
                        </p>
                    ) : (
                        <div className="space-y-1 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {units.map(u => {
                                const active = u.id === unitId
                                return (
                                    <button key={u.id} onClick={() => setUnitId(u.id)}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all"
                                        style={active ? {
                                            background: 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                                            color: 'var(--app-info)',
                                            border: '1px solid color-mix(in srgb, var(--app-info) 30%, transparent)',
                                        } : {
                                            background: 'transparent',
                                            color: 'var(--app-foreground)',
                                            border: '1px solid transparent',
                                        }}>
                                        <Ruler size={11} className="flex-shrink-0" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-tp-sm font-bold truncate">{u.name}</p>
                                            {u.code && (
                                                <p className="text-tp-xxs font-mono opacity-70 truncate">{u.code}</p>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </aside>

                {/* Right: the tab itself */}
                <main className="rounded-2xl overflow-hidden flex flex-col"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        minHeight: '70vh',
                    }}>
                    {!currentUnit ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <Search size={28} className="text-app-muted-foreground opacity-40 mb-3" />
                            <p className="text-tp-sm font-bold text-app-muted-foreground">
                                {units === null ? 'Loading units…' : 'Select a unit to preview the tab'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-2 px-4 py-3"
                                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: 'var(--app-info)' }}>
                                        <Ruler size={13} className="text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-tp-xxs font-black uppercase tracking-wider" style={{ color: 'var(--app-info)' }}>Demo entity</p>
                                        <p className="text-tp-md font-bold text-app-foreground truncate">{currentUnit.name}</p>
                                    </div>
                                </div>
                                <Link href="/inventory/units" className="flex items-center gap-1 text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground">
                                    <ExternalLink size={11} />Open in app
                                </Link>
                            </div>
                            <div className="flex-1 min-h-0">
                                <EntityProductsTab
                                    key={currentUnit.id}
                                    config={{
                                        entityType: 'unit',
                                        entityId: currentUnit.id,
                                        entityName: currentUnit.name,
                                        exploreEndpoint: `units/${currentUnit.id}/explore/`,
                                        moveEndpoint: 'units/move_products/',
                                        moveTargets: (units ?? []).filter(u => u.id !== currentUnit.id)
                                            .map(u => ({ id: u.id, name: u.name, code: u.code })),
                                        moveLabel: 'Move to Unit',
                                        moveTargetKey: 'target_unit_id',
                                    }}
                                />
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
