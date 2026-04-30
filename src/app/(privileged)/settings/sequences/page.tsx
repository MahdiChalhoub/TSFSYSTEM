'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Hash, Loader2, Save, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { SettingsPageShell } from '@/lib/settings-framework/components/SettingsPageShell'
import { DOCUMENT_TYPES, MASTER_DATA_TYPES, TIERS } from './_lib/constants'
import type { Sequence, TabKey } from './_lib/types'
import { SequenceTable } from './_components/SequenceTable'

export default function DocumentNumberingPage() {
    const [sequences, setSequences] = useState<Sequence[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<TabKey>('documents')
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
                    {/* ═══ KPI strip — single inline row, hairline dividers ═══ */}
                    <div
                        className="flex items-stretch rounded-xl overflow-hidden"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}
                    >
                        <KpiCell label="Document types" value={totalDocs} hint={`× ${TIERS.length} tiers each`} />
                        <KpiCell label="Master-data" value={totalMaster} hint={`${MASTER_DATA_TYPES.length} entities`} />
                        <KpiCell
                            label="Configured"
                            value={`${totalConfigured}/${totalSlots}`}
                            hint={totalConfigured >= totalSlots ? 'fully configured' : `${totalSlots - totalConfigured} on defaults`}
                        />
                        <KpiCell
                            label="Unsaved"
                            value={dirtyKeys.size}
                            hint={dirtyKeys.size > 0 ? 'pending sync' : 'all flushed'}
                            warn={dirtyKeys.size > 0}
                        />
                    </div>

                    {/* ═══ Tabs + tier legend in one row ═══ */}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div
                            className="flex items-center gap-1 p-1 rounded-xl"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}
                        >
                            {tabs.map(t => {
                                const active = activeTab === t.key
                                return (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => setActiveTab(t.key)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
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
                                        <t.icon size={13} />
                                        {t.label}
                                        <span
                                            className="text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded-full"
                                            style={{
                                                background: active
                                                    ? 'rgba(255,255,255,0.2)'
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

                        {/* Tier legend — only relevant on Documents tab */}
                        {activeTab === 'documents' && (
                            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                                {TIERS.map(t => (
                                    <div key={t.key} className="inline-flex items-center gap-1.5 min-w-0">
                                        <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ background: t.color, boxShadow: `0 0 6px ${t.color}` }}
                                        />
                                        <span
                                            className="text-[10px] font-black uppercase tracking-[0.16em]"
                                            style={{ color: t.color }}
                                        >
                                            {t.label}
                                        </span>
                                        <span className="text-[10px] text-app-muted-foreground truncate">
                                            {t.desc}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ═══ Table ═══ */}
                    <SequenceTable
                        tab={activeTab}
                        sequences={sequences}
                        dirtyKeys={dirtyKeys}
                        onChange={handleChange}
                    />

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

function KpiCell({
    label, value, hint, warn = false,
}: { label: string; value: number | string; hint?: string; warn?: boolean }) {
    const accent = warn ? 'var(--app-warning)' : 'var(--app-foreground)'
    return (
        <div className="flex-1 min-w-0 px-4 py-3 border-r last:border-r-0"
            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-app-muted-foreground">
                {label}
            </div>
            <div className="text-[24px] font-black tabular-nums leading-none mt-1.5" style={{ color: accent }}>
                {value}
            </div>
            {hint && (
                <div className="text-[10px] font-mono text-app-muted-foreground mt-1 truncate">
                    {hint}
                </div>
            )}
        </div>
    )
}

function SkeletonView() {
    return (
        <div className="flex flex-col gap-4 p-4 md:p-6">
            <div
                className="h-[78px] rounded-xl animate-pulse"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}
            />
            <div
                className="h-9 w-72 rounded-xl animate-pulse"
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
