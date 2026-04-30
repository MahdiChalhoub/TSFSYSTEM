'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
    Hash, Loader2, Save, FileText,
    AlertTriangle, Info,
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

    // ── Data ─────────────────────────────────────────────────
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

    // ── Handlers ─────────────────────────────────────────────
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
        else toast.success(`${saved} sequence(s) saved successfully`)
        setSaving(false)
        load()
    }, [dirtyKeys, sequences, load])

    const iconMemo = useMemo(() => <Hash size={20} className="text-white" />, [])

    // ── Tab data ─────────────────────────────────────────────
    const tabs = [
        {
            key: 'documents' as TabKey,
            label: 'Documents',
            sub: '3-tier · Draft · Internal · Official',
            icon: FileText,
            count: DOCUMENT_TYPES.length,
        },
        {
            key: 'master' as TabKey,
            label: 'Master-Data',
            sub: 'Single-tier · auto-increment codes',
            icon: Hash,
            count: MASTER_DATA_TYPES.length,
        },
    ]

    // ── Render ───────────────────────────────────────────────
    return (
        <SettingsPageShell
            title="Numbering & Codes"
            subtitle="Configure document numbering and master-data reference codes"
            icon={iconMemo}
            configKey="sequences"
            onReload={load}
            onSave={handleSaveAll}
            saving={saving}
            hasChanges={dirtyKeys.size > 0}
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-app-primary" />
                    <p className="text-[13px] font-bold text-app-muted-foreground">
                        Loading sequences…
                    </p>
                </div>
            ) : (
                <div className="layout-container-padding max-w-[1400px] mx-auto space-y-5">
                    {/* ── Tab Switcher ── */}
                    <div
                        className="flex items-center gap-1 p-1 rounded-xl border border-app-border w-fit"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}
                    >
                        {tabs.map(t => {
                            const active = activeTab === t.key
                            return (
                                <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => setActiveTab(t.key)}
                                    className="flex items-center gap-2.5 px-4 py-2 rounded-lg transition-all"
                                    style={active ? {
                                        background: 'var(--app-primary)',
                                        color: '#fff',
                                        boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                    } : {
                                        background: 'transparent',
                                        color: 'var(--app-muted-foreground)',
                                    }}
                                >
                                    <t.icon size={14} />
                                    <div className="text-left">
                                        <div className="text-[11px] font-black uppercase tracking-wider">{t.label}</div>
                                        <div className="text-[9px] opacity-70">{t.sub}</div>
                                    </div>
                                    <span
                                        className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full"
                                        style={{
                                            background: active
                                                ? 'color-mix(in srgb, #fff 20%, transparent)'
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

                    {/* ── Info Banner ── */}
                    <div
                        className="flex items-start gap-3 px-4 py-3 rounded-xl border border-app-border"
                        style={{
                            background: activeTab === 'documents'
                                ? 'color-mix(in srgb, var(--app-warning) 5%, transparent)'
                                : 'color-mix(in srgb, var(--app-info) 5%, transparent)',
                        }}
                    >
                        {activeTab === 'documents' ? (
                            <>
                                <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-warning)' }} />
                                <p className="text-[12px] text-app-muted-foreground leading-relaxed">
                                    Each document type uses <strong>3 independent tiers</strong>:
                                    <strong> Draft</strong> (temporary, gaps ok) ·
                                    <strong> Internal</strong> (management scope) ·
                                    <strong> Official</strong> (fiscal — no gaps).
                                </p>
                            </>
                        ) : (
                            <>
                                <Info size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-info)' }} />
                                <p className="text-[12px] text-app-muted-foreground leading-relaxed">
                                    Each entity gets an auto-increment code (e.g.{' '}
                                    <code className="font-mono font-bold text-app-foreground">CAT-00001</code>).
                                    Changes apply on the next record created.
                                </p>
                            </>
                        )}
                    </div>

                    {/* ── Table ── */}
                    <SequenceTable
                        tab={activeTab}
                        sequences={sequences}
                        dirtyKeys={dirtyKeys}
                        onChange={handleChange}
                    />

                    {/* ── Sticky save footer ── */}
                    {dirtyKeys.size > 0 && (
                        <div
                            className="sticky bottom-4 z-20 flex items-center justify-between px-5 py-3 rounded-xl border"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 95%, transparent)',
                                backdropFilter: 'blur(12px)',
                                borderColor: 'color-mix(in srgb, var(--app-warning) 30%, transparent)',
                                boxShadow: '0 -4px 20px color-mix(in srgb, var(--app-background) 80%, transparent)',
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-2 h-2 rounded-full animate-pulse"
                                    style={{ background: 'var(--app-warning)' }}
                                />
                                <span className="text-[12px] font-bold text-app-foreground">
                                    {dirtyKeys.size} unsaved change{dirtyKeys.size !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={handleSaveAll}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                                style={{
                                    background: 'var(--app-primary)',
                                    boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                }}
                            >
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                {saving ? 'Saving…' : 'Save All Changes'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </SettingsPageShell>
    )
}
