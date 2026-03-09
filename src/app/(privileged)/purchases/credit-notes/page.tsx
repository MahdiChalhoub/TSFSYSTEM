// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchCreditNotes } from '@/app/actions/pos/purchases'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    FileText, RefreshCw, Search, Building2, Calendar, DollarSign,
    Clock, CheckCircle, ArrowLeft, Loader2, RotateCcw, ChevronRight, Receipt
} from 'lucide-react'
import Link from 'next/link'

type CreditNote = {
    id: number
    credit_note_number?: string
    ref_code?: string
    supplier?: { id: number; name: string }
    supplier_name?: string
    contact_name?: string
    status: string
    amount?: number
    total_amount?: number
    reason?: string
    created_at?: string
    purchase_order?: { id: number; po_number?: string }
    purchase_return?: { id: number }
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    DRAFT: { label: 'Draft', class: 'bg-app-surface text-gray-600 bg-app-surface dark:text-gray-300' },
    ISSUED: { label: 'Issued', class: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    APPLIED: { label: 'Applied', class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    CANCELLED: { label: 'Cancelled', class: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
}

export default function CreditNotesPage() {
    const [notes, setNotes] = useState<CreditNote[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<CreditNote | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchCreditNotes()
            const raw = Array.isArray(data) ? data : (data?.results ?? [])
            setNotes(raw)
        } catch { setNotes([]) }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const filtered = notes.filter(n => {
        if (!search) return true
        const q = search.toLowerCase()
        const num = (n.credit_note_number || n.ref_code || `CN-${n.id}`).toLowerCase()
        const sup = (n.supplier?.name || n.supplier_name || n.contact_name || '').toLowerCase()
        return num.includes(q) || sup.includes(q)
    })

    const totalAmount = filtered.reduce((s, n) => s + Number(n.amount || n.total_amount || 0), 0)
    const draftCount = filtered.filter(n => n.status === 'DRAFT').length
    const appliedCount = filtered.filter(n => n.status === 'APPLIED').length

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-[var(--layout-section-spacing)]">

                {/* ── Back + Header ── */}
                <Link href="/purchases/invoices" className="inline-flex items-center gap-2 text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px] md:min-h-[auto]">
                    <ArrowLeft size={16} /> Back to Invoices
                </Link>

                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center shadow-sm">
                            <RotateCcw size={24} className="text-rose-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                                Credit <span className="text-rose-500">Notes</span>
                            </h1>
                            <p className="text-xs md:text-sm font-medium theme-text-muted mt-0.5 hidden sm:block">
                                Supplier credit management & adjustments
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={load} className="min-h-[44px] md:min-h-[36px]">
                        <RefreshCw size={14} className="mr-1.5" /> Refresh
                    </Button>
                </header>

                {/* ── KPI Strip ── */}
                <section className="grid grid-cols-3 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="Credit note statistics">
                    {[
                        { label: 'Total Credits', value: totalAmount.toLocaleString(), icon: DollarSign, accent: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30' },
                        { label: 'Drafts', value: draftCount, icon: Clock, accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
                        { label: 'Applied', value: appliedCount, icon: CheckCircle, accent: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
                    ].map(s => (
                        <Card key={s.label} className="border shadow-sm">
                            <CardContent className="p-4 md:p-5 flex items-center gap-3 md:gap-4">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                                    <s.icon size={20} className={s.accent} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] md:text-[10px] font-black theme-text-muted uppercase tracking-wider">{s.label}</p>
                                    <p className={`text-lg md:text-2xl font-black ${s.accent} mt-0.5 truncate`}>{s.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </section>

                {/* ── Search ── */}
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" />
                    <Input placeholder="Search credit notes, suppliers..." value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-10 min-h-[44px] md:min-h-[40px]" />
                </div>

                {/* ── Content ── */}
                <div className="flex flex-col lg:flex-row gap-4 md:gap-[var(--layout-element-gap)]">
                    {/* List */}
                    <div className="w-full lg:w-1/2 xl:w-5/12 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
                        {loading ? Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-[72px] rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
                        )) : filtered.length === 0 ? (
                            <Card className="border shadow-sm">
                                <CardContent className="p-12 text-center">
                                    <RotateCcw size={40} className="mx-auto theme-text-muted mb-3 opacity-30" />
                                    <p className="text-sm font-medium theme-text-muted">No credit notes found</p>
                                    <p className="text-xs theme-text-muted mt-1">Credit notes will appear here when purchase returns are processed</p>
                                </CardContent>
                            </Card>
                        ) : filtered.map(cn => (
                            <button key={cn.id} onClick={() => setSelected(cn)}
                                className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-3 rounded-xl border transition-all shadow-sm min-h-[64px] ${selected?.id === cn.id ? 'bg-rose-50 border-rose-300 dark:bg-rose-900/20 dark:border-rose-600' : 'theme-surface'
                                    }`}
                                style={{ borderColor: selected?.id === cn.id ? undefined : 'var(--theme-border)' }}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-sm theme-text">{cn.credit_note_number || cn.ref_code || `CN-${cn.id}`}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${STATUS_CONFIG[cn.status]?.class || 'bg-app-surface theme-text-muted'}`}>
                                            {STATUS_CONFIG[cn.status]?.label || cn.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs theme-text-muted truncate">
                                        <span className="flex items-center gap-1"><Building2 size={10} />{cn.supplier?.name || cn.supplier_name || cn.contact_name || '—'}</span>
                                        {cn.created_at && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(cn.created_at).toLocaleDateString('fr-FR')}</span>}
                                    </div>
                                </div>
                                <div className="text-sm font-black text-rose-500 shrink-0">{Number(cn.amount || cn.total_amount || 0).toLocaleString()}</div>
                                <ChevronRight size={14} className="theme-text-muted shrink-0 hidden md:block" />
                            </button>
                        ))}
                    </div>

                    {/* Detail */}
                    <div className="w-full lg:w-1/2 xl:w-7/12 lg:sticky lg:top-4 lg:self-start">
                        <Card className="border shadow-sm min-h-[300px]">
                            {!selected ? (
                                <CardContent className="flex flex-col items-center justify-center py-20 theme-text-muted gap-3">
                                    <RotateCcw size={48} className="opacity-20" />
                                    <p className="text-sm font-medium">Select a credit note to view details</p>
                                </CardContent>
                            ) : (
                                <>
                                    <CardHeader>
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <CardTitle className="text-xl font-black theme-text">{selected.credit_note_number || selected.ref_code || `CN-${selected.id}`}</CardTitle>
                                                <div className="flex items-center gap-2 text-sm theme-text-muted mt-1">
                                                    <Building2 size={14} /> {selected.supplier?.name || selected.supplier_name || selected.contact_name || '—'}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-2xl font-black text-rose-500">{Number(selected.amount || selected.total_amount || 0).toLocaleString()}</div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mt-1 inline-block ${STATUS_CONFIG[selected.status]?.class || ''}`}>
                                                    {STATUS_CONFIG[selected.status]?.label || selected.status}
                                                </span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {selected.reason && (
                                            <div className="p-3 rounded-xl theme-surface text-sm theme-text-muted" style={{ border: '1px solid var(--theme-border)' }}>
                                                <FileText size={12} className="inline mr-1.5" />Reason: {selected.reason}
                                            </div>
                                        )}
                                        {selected.purchase_order && (
                                            <Link href={`/purchases/${selected.purchase_order.id}`} className="flex items-center gap-2 text-sm font-bold text-blue-500 hover:underline min-h-[44px]">
                                                <Receipt size={14} /> Related PO: {selected.purchase_order.po_number || `PO-${selected.purchase_order.id}`}
                                            </Link>
                                        )}
                                        {selected.created_at && (
                                            <div className="flex justify-between text-sm">
                                                <span className="theme-text-muted">Created</span>
                                                <span className="font-bold theme-text">{new Date(selected.created_at).toLocaleDateString('fr-FR')}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    )
}
