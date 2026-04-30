'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
    Hash, Loader2, Save, FileText,
    AlertTriangle, Info, ShoppingBag,
    CreditCard, Package,
} from 'lucide-react'
import { toast } from 'sonner'
import { SettingsPageShell } from '@/lib/settings-framework/components/SettingsPageShell'
import { DOCUMENT_TYPES, MASTER_DATA_TYPES } from './_lib/constants'
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

    // ── KPI strip data ───────────────────────────────────────
    const totalDocs = DOCUMENT_TYPES.length
    const totalMaster = MASTER_DATA_TYPES.length
    const totalConfigured = sequences.length
    const kpis = [
        { label: 'Document Types', value: totalDocs, color: 'var(--app-primary)', icon: <FileText size={14} /> },
        { label: 'Master-Data', value: totalMaster, color: 'var(--app-info)', icon: <Package size={14} /> },
        { label: 'Configured', value: totalConfigured, color: 'var(--app-success)', icon: <Hash size={14} /> },
        { label: 'Unsaved', value: dirtyKeys.size, color: dirtyKeys.size > 0 ? 'var(--app-warning)' : 'var(--app-muted-foreground)', icon: <Save size={14} /> },
    ]

    // ── Tab config ───────────────────────────────────────────
    const tabs = [
        { key: 'documents' as TabKey, label: 'Documents', icon: ShoppingBag, count: totalDocs },
        { key: 'master' as TabKey, label: 'Master-Data', icon: Hash, count: totalMaster },
    ]

    return (
        <SettingsPageShell
            title="Numbering & Codes"
            subtitle={`${totalConfigured} Configured · ${totalDocs + totalMaster} Total Sequences`}
            icon={iconMemo}
            configKey="sequences"
            onReload={load}
            onSave={handleSaveAll}
            saving={saving}
            hasChanges={dirtyKeys.size > 0}
        >
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={24} className="animate-spin text-app-primary" />
                </div>
            ) : (
                <div className="flex flex-col gap-4 p-4 md:p-6 animate-in fade-in duration-300">
                    {/* ═══ KPI STRIP ═══ */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        {kpis.map(s => (
                            <div key={s.label}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                    {s.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wider"
                                        style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                    <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ═══ TAB SWITCHER ═══ */}
                    <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}>
                        {tabs.map(t => {
                            const active = activeTab === t.key
                            return (
                                <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                    style={active ? {
                                        background: 'var(--app-primary)',
                                        color: '#fff',
                                        boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                    } : {
                                        color: 'var(--app-muted-foreground)',
                                    }}>
                                    <t.icon size={13} />
                                    {t.label}
                                    <span className="text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded-full"
                                        style={{
                                            background: active ? 'rgba(255,255,255,0.2)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                                            color: active ? '#fff' : 'var(--app-muted-foreground)',
                                        }}>
                                        {t.count}
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {/* ═══ INFO BANNER ═══ */}
                    <div className="flex items-start gap-2.5 px-3 py-2 rounded-xl"
                        style={{
                            background: activeTab === 'documents'
                                ? 'color-mix(in srgb, var(--app-warning) 5%, var(--app-surface))'
                                : 'color-mix(in srgb, var(--app-info) 5%, var(--app-surface))',
                            border: `1px solid color-mix(in srgb, ${activeTab === 'documents' ? 'var(--app-warning)' : 'var(--app-info)'} 15%, transparent)`,
                        }}>
                        {activeTab === 'documents' ? (
                            <>
                                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-warning)' }} />
                                <p className="text-[11px] font-bold text-app-muted-foreground">
                                    3 tiers per document: <strong className="text-app-foreground">Draft</strong> (temporary) ·{' '}
                                    <strong className="text-app-foreground">Internal</strong> (management) ·{' '}
                                    <strong className="text-app-foreground">Official</strong> (fiscal, no gaps)
                                </p>
                            </>
                        ) : (
                            <>
                                <Info size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-info)' }} />
                                <p className="text-[11px] font-bold text-app-muted-foreground">
                                    Auto-increment codes (e.g. <code className="font-mono text-app-foreground">CAT-00001</code>).
                                    Changes apply on next record.
                                </p>
                            </>
                        )}
                    </div>

                    {/* ═══ TABLE ═══ */}
                    <SequenceTable
                        tab={activeTab}
                        sequences={sequences}
                        dirtyKeys={dirtyKeys}
                        onChange={handleChange}
                    />

                    {/* ═══ STICKY SAVE BAR ═══ */}
                    {dirtyKeys.size > 0 && (
                        <div className="sticky bottom-3 z-20 flex items-center justify-between px-4 py-2.5 rounded-xl"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)',
                                boxShadow: '0 -2px 20px color-mix(in srgb, var(--app-background) 60%, transparent)',
                            }}>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--app-warning)' }} />
                                <span className="text-[11px] font-bold text-app-foreground">
                                    {dirtyKeys.size} unsaved change{dirtyKeys.size !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <button type="button" onClick={handleSaveAll} disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-[11px] font-bold text-white bg-app-primary hover:brightness-110 transition-all disabled:opacity-50"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                {saving ? 'Saving…' : 'Save All'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </SettingsPageShell>
    )
}
