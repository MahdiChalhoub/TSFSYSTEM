'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Hash, Loader2, Save, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { SettingsPageShell } from '@/lib/settings-framework/components/SettingsPageShell'
import {
    DOCUMENT_TYPES, DOCUMENT_GROUPS,
    MASTER_DATA_TYPES, MASTER_DATA_GROUPS,
    TIERS, resolveSeqKey,
} from './_lib/constants'
import type { Sequence, TabKey } from './_lib/types'
import { SequenceTable } from './_components/SequenceTable'
import { ModuleNavigator, type ModuleNavItem } from './_components/ModuleNavigator'

export default function DocumentNumberingPage() {
    const [sequences, setSequences] = useState<Sequence[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<TabKey>('documents')
    const [selectedModuleByTab, setSelectedModuleByTab] = useState<Record<TabKey, string>>({
        documents: DOCUMENT_GROUPS[0]?.module ?? '',
        master: MASTER_DATA_GROUPS[0]?.module ?? '',
    })
    const selectedModule = selectedModuleByTab[activeTab]
    const setSelectedModule = useCallback((m: string) => {
        setSelectedModuleByTab(prev => ({ ...prev, [activeTab]: m }))
    }, [activeTab])
    const serverSnapshot = useRef<Map<string, Sequence>>(new Map())
    const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set())

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await erpFetch('finance/sequences/')
            const arr: Sequence[] = Array.isArray(data) ? data : (data?.results ?? [])
            setSequences(arr)
            const snap = new Map<string, Sequence>()
            arr.forEach(s => snap.set(s.type, { ...s }))
            serverSnapshot.current = snap
            setDirtyKeys(new Set())
        } catch {
            toast.error('Failed to load sequences')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const handleChange = useCallback((seqKey: string, field: keyof Sequence, value: string | number) => {
        setSequences(prev => {
            const idx = prev.findIndex(s => s.type === seqKey)
            if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = { ...updated[idx], [field]: value }
                return updated
            }
            return [...prev, {
                type: seqKey, prefix: '', suffix: '',
                next_number: 1, padding: 6, [field]: value,
            }]
        })
        setDirtyKeys(prev => new Set(prev).add(seqKey))
    }, [])

    const handleDiscard = useCallback(() => {
        setSequences(prev => prev.map(s => {
            const orig = serverSnapshot.current.get(s.type)
            return orig ? { ...orig } : s
        }))
        setDirtyKeys(new Set())
    }, [])

    const handleSaveAll = useCallback(async () => {
        if (dirtyKeys.size === 0) return
        setSaving(true)
        let saved = 0, failed = 0
        for (const key of dirtyKeys) {
            const seq = sequences.find(s => s.type === key)
            if (!seq) continue
            try {
                const method = seq.id ? 'PUT' : 'POST'
                const url = seq.id ? `finance/sequences/${seq.id}/` : 'finance/sequences/'
                await erpFetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(seq),
                })
                saved++
            } catch { failed++ }
        }
        if (failed > 0) toast.error(`${failed} sequence(s) failed to save`)
        else toast.success(`${saved} sequence(s) saved`)
        setSaving(false)
        load()
    }, [dirtyKeys, sequences, load])

    const iconMemo = useMemo(() => <Hash size={20} className="text-white" />, [])

    const totalDocs = DOCUMENT_TYPES.length
    const totalMaster = MASTER_DATA_TYPES.length
    const totalConfigured = sequences.length
    const totalSlots = totalDocs * TIERS.length + totalMaster

    const tabs = [
        { key: 'documents' as TabKey, label: 'Documents', icon: ShoppingBag, count: totalDocs },
        { key: 'master' as TabKey, label: 'Master-Data', icon: Hash, count: totalMaster },
    ]

    // Per-module nav items with dirty counts (recomputed when dirty/tab changes)
    const navItems: ModuleNavItem[] = useMemo(() => {
        if (activeTab === 'documents') {
            return DOCUMENT_GROUPS.map(g => {
                const keys = g.items.flatMap(item =>
                    TIERS.map(t => resolveSeqKey(item.id, t.key))
                )
                return {
                    key: g.module,
                    label: g.module,
                    color: g.color,
                    count: g.items.length * TIERS.length,
                    dirty: keys.filter(k => dirtyKeys.has(k)).length,
                }
            })
        }
        return MASTER_DATA_GROUPS.map(g => {
            const keys = g.items.map(item => item.id)
            return {
                key: g.module,
                label: g.module,
                color: g.color,
                count: g.items.length,
                dirty: keys.filter(k => dirtyKeys.has(k)).length,
            }
        })
    }, [activeTab, dirtyKeys])

    return (
        <SettingsPageShell
            title="Numbering & Codes"
            subtitle={`${totalConfigured} configured · ${totalSlots} total sequences`}
            icon={iconMemo}
            configKey="sequences"
            onReload={load}
            onSave={handleSaveAll}
            saving={saving}
            hasChanges={dirtyKeys.size > 0}
        >
            {loading ? (
                <SkeletonView />
            ) : (
                <div className="flex flex-col gap-4 p-4 md:p-6 animate-in fade-in duration-300">
                    {/* ═══ Single command band — tabs · progress · legend ═══ */}
                    <CommandBand
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        configured={totalConfigured}
                        total={totalSlots}
                        showLegend={activeTab === 'documents'}
                    />

                    {/* ═══ Module navigator (left) + filtered table (right) ═══ */}
                    <div className="grid gap-4 grid-cols-1 md:[grid-template-columns:minmax(200px,240px)_1fr]">
                        <ModuleNavigator
                            items={navItems}
                            selected={selectedModule}
                            onSelect={setSelectedModule}
                            sectionLabel={activeTab === 'documents' ? 'Document modules' : 'Master-data groups'}
                        />
                        <SequenceTable
                            tab={activeTab}
                            moduleKey={selectedModule}
                            sequences={sequences}
                            dirtyKeys={dirtyKeys}
                            onChange={handleChange}
                        />
                    </div>

                    {/* ═══ Floating save pill ═══ */}
                    {dirtyKeys.size > 0 && (
                        <div
                            className="fixed left-1/2 -translate-x-1/2 bottom-6 z-30 flex items-center gap-3 px-4 py-2 rounded-full animate-in fade-in slide-in-from-bottom-3"
                            style={{
                                background: 'color-mix(in srgb, var(--app-warning) 6%, var(--app-surface))',
                                backdropFilter: 'blur(14px)',
                                border: '1px solid color-mix(in srgb, var(--app-warning) 35%, transparent)',
                                boxShadow:
                                    '0 12px 40px -8px color-mix(in srgb, var(--app-background) 80%, transparent), 0 0 0 1px rgba(0,0,0,0.04)',
                            }}
                        >
                            <span
                                className="w-2 h-2 rounded-full animate-pulse"
                                style={{ background: 'var(--app-warning)' }}
                            />
                            <span
                                className="text-[11px] font-mono uppercase tracking-widest"
                                style={{ color: 'var(--app-warning)' }}
                            >
                                <span className="font-black text-app-foreground">{dirtyKeys.size}</span> unsaved
                            </span>
                            <button
                                type="button"
                                onClick={handleDiscard}
                                disabled={saving}
                                className="px-2.5 py-1 rounded-md text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground hover:bg-app-background/40 transition-all disabled:opacity-50"
                            >
                                Discard
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAll}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-black text-white bg-app-primary hover:brightness-110 transition-all disabled:opacity-50"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                            >
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                {saving ? 'Saving…' : 'Save all'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </SettingsPageShell>
    )
}

// ── Subcomponents ────────────────────────────────────────────

interface TabSpec {
    key: TabKey
    label: string
    icon: React.ComponentType<{ size?: number }>
    count: number
}

function CommandBand({
    tabs, activeTab, onTabChange,
    configured, total,
    showLegend,
}: {
    tabs: TabSpec[]
    activeTab: TabKey
    onTabChange: (k: TabKey) => void
    configured: number
    total: number
    showLegend: boolean
}) {
    const pct = total > 0 ? Math.round((configured / total) * 100) : 0
    const onDefaults = Math.max(0, total - configured)

    return (
        <div
            className="flex items-center gap-3 md:gap-5 px-3 py-2 rounded-xl flex-wrap"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}
        >
            {/* Tabs */}
            <div className="inline-flex items-center gap-0.5">
                {tabs.map(t => {
                    const active = activeTab === t.key
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => onTabChange(t.key)}
                            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] font-bold transition-all"
                            style={
                                active
                                    ? {
                                        background: 'var(--app-primary)',
                                        color: '#fff',
                                        boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                    }
                                    : { color: 'var(--app-muted-foreground)' }
                            }
                        >
                            <t.icon size={12} />
                            {t.label}
                            <span
                                className="text-[9px] font-mono tabular-nums px-1.5 rounded-full"
                                style={{
                                    background: active
                                        ? 'rgba(255,255,255,0.22)'
                                        : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                    color: active ? '#fff' : 'var(--app-muted-foreground)',
                                }}
                            >
                                {t.count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Progress meter — flex-1, the centerpiece */}
            <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
                {/* Numeric label */}
                <span className="text-[11px] font-mono tabular-nums whitespace-nowrap">
                    <span className="font-black text-app-foreground">{configured}</span>
                    <span className="text-app-muted-foreground/70">/{total}</span>
                    <span className="ml-1.5 text-app-muted-foreground uppercase tracking-wide font-bold text-[9px]">
                        configured
                    </span>
                </span>

                {/* Bar */}
                <div
                    className="relative flex-1 h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                    title={`${pct}% configured`}
                >
                    <div
                        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
                        style={{
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 60%, var(--app-success)))',
                            boxShadow: '0 0 8px color-mix(in srgb, var(--app-primary) 35%, transparent)',
                        }}
                    />
                </div>

                {/* Percent + defaults hint */}
                <span className="text-[10px] font-mono tabular-nums text-app-muted-foreground whitespace-nowrap">
                    {pct}%
                    {onDefaults > 0 && (
                        <>
                            {' · '}
                            <span className="text-app-warning font-bold">{onDefaults}</span>
                            <span className="opacity-70"> default</span>
                        </>
                    )}
                </span>
            </div>

            {/* Legend — only on Documents tab */}
            {showLegend && (
                <div className="inline-flex items-center gap-3">
                    {TIERS.map(t => (
                        <span key={t.key} className="inline-flex items-center gap-1">
                            <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: t.color, boxShadow: `0 0 5px ${t.color}` }}
                            />
                            <span
                                className="text-[9.5px] font-black uppercase tracking-[0.14em]"
                                style={{ color: t.color }}
                                title={t.desc}
                            >
                                {t.label}
                            </span>
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}

function SkeletonView() {
    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <div
                className="h-11 rounded-xl animate-pulse"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}
            />
            {[1, 2, 3].map(i => (
                <div
                    key={i}
                    className="h-[160px] rounded-2xl animate-pulse"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)' }}
                />
            ))}
        </div>
    )
}
