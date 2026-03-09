'use client'

import { useState, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Hash, Settings2, Save, RotateCcw, Shield, Globe,
    FileText, ShoppingBag, Receipt, Truck, ArrowRightLeft,
    ChevronRight, Loader2, Info, AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'

type Sequence = {
    id?: number
    type: string
    scope: 'OFFICIAL' | 'INTERNAL'
    prefix: string
    suffix: string
    next_number: number
    padding: number
}

const DOCUMENT_TYPES = [
    { id: 'PURCHASE_ORDER', label: 'Purchase Order', icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'PURCHASE_RECEIPT', label: 'Goods Receipt', icon: Truck, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'PURCHASE_INVOICE', label: 'Purchase Invoice', icon: Receipt, color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'PURCHASE_RETURN', label: 'Purchase Return', icon: RotateCcw, color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'SALES_ORDER', label: 'Sales Order', icon: ShoppingBag, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'SALES_INVOICE', label: 'Sales Invoice', icon: Receipt, color: 'text-amber-500', bg: 'bg-amber-50' },
    { id: 'STOCK_MOVE', label: 'Stock Movement', icon: ArrowRightLeft, color: 'text-cyan-500', bg: 'bg-cyan-50' },
    { id: 'VOUCHER', label: 'Voucher', icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50' },
]

export default function DocumentNumberingPage() {
    const [sequences, setSequences] = useState<Sequence[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<number | string | null>(null)

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

    const handleUpdate = async (seq: Sequence) => {
        setSaving(seq.id || `${seq.type}-${seq.scope}`)
        try {
            const method = seq.id ? 'PUT' : 'POST'
            const url = seq.id ? `finance/sequences/${seq.id}/` : 'finance/sequences/'

            const result = await erpFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(seq)
            })

            toast.success(`${seq.type} ${seq.scope} sequence updated`)
            load()
        } catch (e: any) {
            toast.error(e?.message || 'Update failed')
        } finally {
            setSaving(null)
        }
    }

    const getSequence = (type: string, scope: 'OFFICIAL' | 'INTERNAL') => {
        const existing = sequences.find(s => s.type === type && s.scope === scope)
        if (existing) return existing
        return { type, scope, prefix: '', suffix: '', next_number: 1, padding: 6 }
    }

    const handleChange = (type: string, scope: 'OFFICIAL' | 'INTERNAL', field: keyof Sequence, value: any) => {
        setSequences(prev => {
            const idx = prev.findIndex(s => s.type === type && s.scope === scope)
            if (idx >= 0) {
                const updated = [...prev]
                updated[idx] = { ...updated[idx], [field]: value }
                return updated
            } else {
                return [...prev, { type, scope, prefix: '', suffix: '', next_number: 1, padding: 6, [field]: value }]
            }
        })
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-app-primary" />
            <p className="text-sm font-black uppercase tracking-widest theme-text-muted">Loading Numbering Strategies...</p>
        </div>
    )

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="layout-container-padding max-w-[1400px] mx-auto space-y-[var(--layout-section-spacing)]">

                {/* ── Header ────────────────────────────── */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[24px] bg-app-primary/10 flex items-center justify-center border border-app-primary/20 shadow-inner">
                            <Hash size={32} className="text-app-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest theme-text-muted">System Configuration</p>
                            <h1 className="text-3xl md:text-5xl font-black tracking-tight theme-text">
                                Document <span className="text-app-primary">Numbering</span>
                            </h1>
                            <p className="text-sm font-medium theme-text-muted mt-1">
                                Prefix, range and counting strategy management for all transactions
                            </p>
                        </div>
                    </div>
                </header>

                <div className="p-6 rounded-[32px] bg-amber-50/50 border border-amber-200 flex items-start gap-4">
                    <AlertTriangle className="text-amber-600 shrink-0 mt-1" size={20} />
                    <div className="space-y-1">
                        <h4 className="text-sm font-black text-amber-900 uppercase tracking-tight">Critical Configuration Area</h4>
                        <p className="text-xs font-bold text-amber-700/80 leading-relaxed">
                            Modifying sequences affects how future documents are numbered.
                            <span className="text-amber-900 underline ml-1">Official</span> sequences are typically for statutory compliance,
                            while <span className="text-amber-900 underline ml-1">Internal</span> are for management reporting.
                        </p>
                    </div>
                </div>

                {/* ── Sequence Grid ──────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    {DOCUMENT_TYPES.map((docType) => (
                        <Card key={docType.id} className="rounded-[40px] border border-app-border overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 bg-white">
                            <CardHeader className="border-b border-app-border/50 pb-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl ${docType.bg} flex items-center justify-center`}>
                                            <docType.icon size={22} className={docType.color} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black theme-text tracking-tight uppercase">{docType.label}</h3>
                                            <p className="text-[10px] font-bold theme-text-muted uppercase tracking-widest">{docType.id}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="rounded-full px-4 h-7 text-[10px] font-black border-app-border uppercase tracking-widest">Active Sequence</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10">

                                {/* ── OFFICIAL SCOPE ── */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <Globe size={16} className="text-blue-500" />
                                        <h4 className="text-xs font-black uppercase tracking-widest text-app-foreground">Official Strategy (Statutory)</h4>
                                    </div>
                                    {renderSequenceFields(docType.id, 'OFFICIAL')}
                                </div>

                                <div className="h-px bg-app-border/50" />

                                {/* ── INTERNAL SCOPE ── */}
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <Shield size={16} className="text-app-primary" />
                                        <h4 className="text-xs font-black uppercase tracking-widest text-app-foreground">Internal Strategy (Management)</h4>
                                    </div>
                                    {renderSequenceFields(docType.id, 'INTERNAL')}
                                </div>

                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </main>
    )

    function renderSequenceFields(type: string, scope: 'OFFICIAL' | 'INTERNAL') {
        const seq = getSequence(type, scope)
        const isSaving = saving === (seq.id || `${type}-${scope}`)

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Prefix</label>
                        <Input
                            value={seq.prefix || ''}
                            onChange={e => handleChange(type, scope, 'prefix', e.target.value)}
                            className="h-11 rounded-xl font-bold bg-app-surface border-app-border focus:ring-0 focus:border-app-primary"
                            placeholder="e.g. PO-"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Next No.</label>
                        <Input
                            type="number"
                            value={seq.next_number}
                            onChange={e => handleChange(type, scope, 'next_number', parseInt(e.target.value))}
                            className="h-11 rounded-xl font-bold bg-app-surface border-app-border"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Padding</label>
                        <Input
                            type="number"
                            value={seq.padding}
                            onChange={e => handleChange(type, scope, 'padding', parseInt(e.target.value))}
                            className="h-11 rounded-xl font-bold bg-app-surface border-app-border"
                            placeholder="6"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Suffix</label>
                        <Input
                            value={seq.suffix || ''}
                            onChange={e => handleChange(type, scope, 'suffix', e.target.value)}
                            className="h-11 rounded-xl font-bold bg-app-surface border-app-border"
                            placeholder="e.g. -2026"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-app-background border border-app-border/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-app-border flex items-center justify-center text-[10px] font-black text-app-muted-foreground">PRE</div>
                        <p className="text-sm font-black theme-text tracking-tighter">
                            Preview: <span className="text-app-primary ml-1">{seq.prefix}{String(seq.next_number).padStart(seq.padding, '0')}{seq.suffix}</span>
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => handleUpdate(seq)}
                        disabled={isSaving}
                        className="h-10 px-5 rounded-xl bg-app-primary text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-app-primary/20"
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {seq.id ? 'Update' : 'Initialize'}
                    </Button>
                </div>
            </div>
        )
    }
}
