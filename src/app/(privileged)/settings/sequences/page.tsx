'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Hash, Save, RotateCcw, Shield, Globe, FileText,
    ShoppingBag, Receipt, Truck, ArrowRightLeft, CreditCard,
    Loader2, AlertTriangle, PenLine
} from 'lucide-react'
import { toast } from 'sonner'
import { SettingsPageShell } from '@/lib/settings-framework/components/SettingsPageShell'

type Sequence = {
    id?: number
    type: string
    prefix: string
    suffix: string
    next_number: number
    padding: number
}

// ── 3-Tier Document Types ────────────────────────────────────
const DOCUMENT_TYPES = [
    { id: 'PURCHASE_ORDER', label: 'Purchase Order', icon: ShoppingBag, color: 'var(--app-info)' },
    { id: 'QUOTATION',      label: 'Quotation',       icon: FileText,    color: 'var(--app-primary)' },
    { id: 'SALES_ORDER',    label: 'Sales Order',     icon: ShoppingBag, color: 'var(--app-success)' },
    { id: 'INVOICE',        label: 'Invoice',         icon: Receipt,     color: 'var(--app-warning)' },
    { id: 'RECEIPT',        label: 'Receipt',         icon: Truck,       color: 'var(--app-success)' },
    { id: 'CREDIT_NOTE',    label: 'Credit Note',     icon: RotateCcw,   color: 'var(--app-error)' },
    { id: 'DELIVERY_NOTE',  label: 'Delivery Note',   icon: Truck,       color: 'var(--app-info)' },
    { id: 'PAYMENT',        label: 'Payment',         icon: CreditCard,  color: 'var(--app-primary)' },
]

const TIERS = [
    { key: 'DRAFT',    label: 'Draft',    desc: 'Temporary — gaps allowed',        icon: PenLine, color: 'var(--app-muted-foreground)' },
    { key: 'INTERNAL', label: 'Internal', desc: 'Non-fiscal management scope',     icon: Shield,  color: 'var(--app-warning)' },
    { key: 'OFFICIAL', label: 'Official', desc: 'Fiscal — strict sequential',      icon: Globe,   color: 'var(--app-success)' },
]

// Default prefixes (match TransactionSequence.DOCUMENT_PREFIXES)
const DEFAULT_PREFIXES: Record<string, Record<string, string>> = {
    PURCHASE_ORDER: { DRAFT: 'DFT-', INTERNAL: 'IPO-', OFFICIAL: 'PO-' },
    QUOTATION:      { DRAFT: 'DQT-', INTERNAL: 'IQT-', OFFICIAL: 'QT-' },
    SALES_ORDER:    { DRAFT: 'DSO-', INTERNAL: 'ISO-', OFFICIAL: 'SO-' },
    INVOICE:        { DRAFT: 'DINV-', INTERNAL: 'IINV-', OFFICIAL: 'INV-' },
    RECEIPT:        { DRAFT: 'DREC-', INTERNAL: 'IREC-', OFFICIAL: 'REC-' },
    CREDIT_NOTE:    { DRAFT: 'DCN-', INTERNAL: 'ICN-', OFFICIAL: 'CN-' },
    DELIVERY_NOTE:  { DRAFT: 'DDN-', INTERNAL: 'IDN-', OFFICIAL: 'DN-' },
    PAYMENT:        { DRAFT: 'DPAY-', INTERNAL: 'IPAY-', OFFICIAL: 'PAY-' },
}

function resolveSeqKey(docType: string, tier: string) {
    return tier === 'OFFICIAL' ? docType : `${docType}_${tier}`
}

export default function DocumentNumberingPage() {
    const [sequences, setSequences] = useState<Sequence[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await erpFetch('finance/sequences/')
            setSequences(Array.isArray(data) ? data : (data?.results ?? []))
        } catch {
            toast.error('Failed to load sequences')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const getSequence = (docType: string, tier: string): Sequence => {
        const key = resolveSeqKey(docType, tier)
        const existing = sequences.find(s => s.type === key)
        if (existing) return existing
        const defaultPrefix = DEFAULT_PREFIXES[docType]?.[tier] || `${docType.slice(0, 3)}-`
        return { type: key, prefix: defaultPrefix, suffix: '', next_number: 1, padding: 6 }
    }

    const handleChange = (seqKey: string, field: keyof Sequence, value: any) => {
        setSequences(prev => {
            const idx = prev.findIndex(s => s.type === seqKey)
            if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = { ...updated[idx], [field]: value }
                return updated
            } else {
                const defaultPrefix = ''
                return [...prev, { type: seqKey, prefix: defaultPrefix, suffix: '', next_number: 1, padding: 6, [field]: value }]
            }
        })
    }

    const handleSave = async (seq: Sequence) => {
        const key = seq.type
        setSaving(key)
        try {
            const method = seq.id ? 'PUT' : 'POST'
            const url = seq.id ? `finance/sequences/${seq.id}/` : 'finance/sequences/'
            await erpFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(seq)
            })
            toast.success(`Sequence ${seq.type} saved`)
            load()
        } catch (e: any) {
            toast.error(e?.message || 'Save failed')
        } finally {
            setSaving(null)
        }
    }

    const iconMemo = useMemo(() => <Hash size={20} className="text-white" />, [])

    return (
        <SettingsPageShell
            title="Document Numbering"
            subtitle="3-tier numbering: Draft → Internal → Official per document type"
            icon={iconMemo}
            configKey="sequences"
            onReload={load}
        >
            {loading ? (
                <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-app-primary" />
                    <p className="text-sm font-black uppercase tracking-widest text-app-muted-foreground">Loading Numbering Strategies...</p>
                </div>
            ) : (
            <div className="layout-container-padding max-w-[1400px] mx-auto space-y-4">

                {/* Warning */}
                <div className="px-4 py-3 rounded-lg border border-app-border flex items-start gap-3" style={{ background: 'color-mix(in srgb, var(--app-warning) 6%, transparent)' }}>
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-warning)' }} />
                    <div>
                        <span className="text-[10px] font-black uppercase" style={{ color: 'var(--app-warning)' }}>Critical Configuration</span>
                        <p className="text-[10px] text-app-muted-foreground mt-0.5">
                            Each document type has 3 independent number sequences. <strong>Draft</strong> numbers are temporary.
                            <strong> Internal</strong> is for management scope. <strong>Official</strong> is for fiscal compliance — no gaps allowed.
                        </p>
                    </div>
                </div>

                {/* Document Type Cards */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {DOCUMENT_TYPES.map((docType) => (
                        <Card key={docType.id} className="rounded-lg border border-app-border overflow-hidden" style={{ background: 'var(--app-surface)' }}>
                            {/* Card Header */}
                            <CardHeader className="px-3 py-2 border-b border-app-border/40">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${docType.color} 12%, transparent)`, color: docType.color }}>
                                        <docType.icon size={12} />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-wider text-app-foreground">{docType.label}</span>
                                    <span className="text-[8px] font-mono text-app-muted-foreground ml-auto">{docType.id}</span>
                                </div>
                            </CardHeader>

                            {/* 3 Tiers */}
                            <CardContent className="p-0 divide-y divide-app-border/30">
                                {TIERS.map((tier) => {
                                    const seq = getSequence(docType.id, tier.key)
                                    const seqKey = resolveSeqKey(docType.id, tier.key)
                                    const isSaving = saving === seqKey
                                    const preview = `${seq.prefix}${String(seq.next_number).padStart(seq.padding, '0')}${seq.suffix}`

                                    return (
                                        <div key={tier.key} className="px-3 py-2 hover:bg-app-background/30 transition-colors">
                                            <div className="flex items-center gap-6">
                                                {/* Tier label */}
                                                <div className="flex items-center gap-1.5 w-[80px] flex-shrink-0">
                                                    <tier.icon size={10} style={{ color: tier.color }} />
                                                    <div>
                                                        <div className="text-[9px] font-black uppercase" style={{ color: tier.color }}>{tier.label}</div>
                                                        <div className="text-[7px] text-app-muted-foreground">{tier.desc}</div>
                                                    </div>
                                                </div>

                                                {/* Fields */}
                                                <div className="flex items-center gap-2 flex-1">
                                                    <Input
                                                        value={seq.prefix || ''}
                                                        onChange={e => handleChange(seqKey, 'prefix', e.target.value)}
                                                        className="h-7 w-16 rounded text-[10px] font-bold bg-app-background border-app-border/50 px-1.5"
                                                        placeholder="PFX-"
                                                    />
                                                    <Input
                                                        type="number"
                                                        value={seq.next_number}
                                                        onChange={e => handleChange(seqKey, 'next_number', parseInt(e.target.value) || 1)}
                                                        className="h-7 w-16 rounded text-[10px] font-bold bg-app-background border-app-border/50 px-1.5"
                                                    />
                                                    <Input
                                                        type="number"
                                                        value={seq.padding}
                                                        onChange={e => handleChange(seqKey, 'padding', parseInt(e.target.value) || 1)}
                                                        className="h-7 w-12 rounded text-[10px] font-bold bg-app-background border-app-border/50 px-1.5"
                                                        placeholder="6"
                                                    />
                                                    <Input
                                                        value={seq.suffix || ''}
                                                        onChange={e => handleChange(seqKey, 'suffix', e.target.value)}
                                                        className="h-7 w-14 rounded text-[10px] font-bold bg-app-background border-app-border/50 px-1.5"
                                                        placeholder="-SFX"
                                                    />
                                                </div>

                                                {/* Preview + Save */}
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-[10px] font-black font-mono" style={{ color: tier.color }}>{preview}</span>
                                                    <button
                                                        onClick={() => handleSave(seq)}
                                                        disabled={isSaving}
                                                        className="w-6 h-6 rounded flex items-center justify-center border border-app-border hover:bg-app-background transition-colors"
                                                        title="Save"
                                                    >
                                                        {isSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} className="text-app-muted-foreground" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 px-3 py-2 rounded-lg border border-app-border/30 text-[9px] text-app-muted-foreground" style={{ background: 'var(--app-background)' }}>
                    <span className="font-bold">Fields:</span>
                    <span>Prefix · Next No. · Padding · Suffix</span>
                    <span className="text-app-muted-foreground/50">|</span>
                    <span>All values are customizable per organization. Changes take effect on next document creation.</span>
                </div>
            </div>
            )}
        </SettingsPageShell>
    )
}
