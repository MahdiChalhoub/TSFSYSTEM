// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchQuotations } from '@/app/actions/pos/purchases'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    FileText, RefreshCw, Search, Building2, Calendar, DollarSign,
    Clock, CheckCircle, ArrowLeft, ChevronRight, Send, XCircle,
    Loader2, Plus, Eye, ClipboardList
} from 'lucide-react'
import Link from 'next/link'

type Quotation = {
    id: number
    quotation_number?: string
    ref_code?: string
    supplier?: { id: number; name: string }
    supplier_name?: string
    contact_name?: string
    status: string
    total_amount?: number
    valid_until?: string
    created_at?: string
    notes?: string
    lines?: any[]
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    DRAFT: { label: 'Draft', class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
    SENT: { label: 'Sent to Supplier', class: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    RECEIVED: { label: 'Received', class: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400' },
    ACCEPTED: { label: 'Accepted', class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    REJECTED: { label: 'Rejected', class: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' },
    EXPIRED: { label: 'Expired', class: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
    CONVERTED: { label: 'Converted to PO', class: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
}

export default function QuotationsPage() {
    const [quotations, setQuotations] = useState<Quotation[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Quotation | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchQuotations()
            const raw = Array.isArray(data) ? data : (data?.results ?? [])
            setQuotations(raw)
        } catch { setQuotations([]) }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const filtered = quotations.filter(q => {
        if (!search) return true
        const s = search.toLowerCase()
        const num = (q.quotation_number || q.ref_code || `QTN-${q.id}`).toLowerCase()
        const sup = (q.supplier?.name || q.supplier_name || q.contact_name || '').toLowerCase()
        return num.includes(s) || sup.includes(s)
    })

    const totalValue = filtered.reduce((s, q) => s + Number(q.total_amount || 0), 0)
    const draftCount = filtered.filter(q => q.status === 'DRAFT').length
    const activeCount = filtered.filter(q => ['SENT', 'RECEIVED'].includes(q.status)).length

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-[var(--layout-section-spacing)]">

                <Link href="/purchases" className="inline-flex items-center gap-2 text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px] md:min-h-[auto]">
                    <ArrowLeft size={16} /> Back to Procurement Center
                </Link>

                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shadow-sm">
                            <ClipboardList size={24} className="text-teal-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                                Quotations <span className="text-teal-500">& RFQs</span>
                            </h1>
                            <p className="text-xs md:text-sm font-medium theme-text-muted mt-0.5 hidden sm:block">
                                Request for quotations & supplier price comparisons
                            </p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={load} className="min-h-[44px] md:min-h-[36px]">
                        <RefreshCw size={14} className="mr-1.5" /> Refresh
                    </Button>
                </header>

                {/* ── KPI Strip ── */}
                <section className="grid grid-cols-3 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="Quotation statistics">
                    {[
                        { label: 'Total Value', value: totalValue.toLocaleString(), icon: DollarSign, accent: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-900/30' },
                        { label: 'Drafts', value: draftCount, icon: FileText, accent: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
                        { label: 'Active', value: activeCount, icon: Send, accent: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
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

                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 theme-text-muted" />
                    <Input placeholder="Search quotations, suppliers..." value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-10 min-h-[44px] md:min-h-[40px]" />
                </div>

                <div className="flex flex-col lg:flex-row gap-4 md:gap-[var(--layout-element-gap)]">
                    <div className="w-full lg:w-1/2 xl:w-5/12 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
                        {loading ? Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-[72px] rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
                        )) : filtered.length === 0 ? (
                            <Card className="border shadow-sm">
                                <CardContent className="p-12 text-center">
                                    <ClipboardList size={40} className="mx-auto theme-text-muted mb-3 opacity-30" />
                                    <p className="text-sm font-medium theme-text-muted">No quotations found</p>
                                    <p className="text-xs theme-text-muted mt-1">Create a request for quotation to get started</p>
                                </CardContent>
                            </Card>
                        ) : filtered.map(q => (
                            <button key={q.id} onClick={() => setSelected(q)}
                                className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-3 rounded-xl border transition-all shadow-sm min-h-[64px] ${selected?.id === q.id ? 'bg-teal-50 border-teal-300 dark:bg-teal-900/20 dark:border-teal-600' : 'theme-surface'
                                    }`}
                                style={{ borderColor: selected?.id === q.id ? undefined : 'var(--theme-border)' }}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-sm theme-text">{q.quotation_number || q.ref_code || `QTN-${q.id}`}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${STATUS_CONFIG[q.status]?.class || 'bg-gray-100 text-gray-500'}`}>
                                            {STATUS_CONFIG[q.status]?.label || q.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs theme-text-muted truncate">
                                        <span className="flex items-center gap-1"><Building2 size={10} />{q.supplier?.name || q.supplier_name || '—'}</span>
                                        {q.valid_until && <span className="flex items-center gap-1"><Calendar size={10} />Valid: {q.valid_until}</span>}
                                    </div>
                                </div>
                                <div className="text-sm font-black text-teal-500 shrink-0">{Number(q.total_amount || 0).toLocaleString()}</div>
                                <ChevronRight size={14} className="theme-text-muted shrink-0 hidden md:block" />
                            </button>
                        ))}
                    </div>

                    <div className="w-full lg:w-1/2 xl:w-7/12 lg:sticky lg:top-4 lg:self-start">
                        <Card className="border shadow-sm min-h-[300px]">
                            {!selected ? (
                                <CardContent className="flex flex-col items-center justify-center py-20 theme-text-muted gap-3">
                                    <ClipboardList size={48} className="opacity-20" />
                                    <p className="text-sm font-medium">Select a quotation to view details</p>
                                </CardContent>
                            ) : (
                                <>
                                    <CardHeader>
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <CardTitle className="text-xl font-black theme-text">{selected.quotation_number || selected.ref_code || `QTN-${selected.id}`}</CardTitle>
                                                <div className="flex items-center gap-2 text-sm theme-text-muted mt-1"><Building2 size={14} /> {selected.supplier?.name || selected.supplier_name || '—'}</div>
                                                {selected.valid_until && <div className="text-xs theme-text-muted mt-1 flex items-center gap-1"><Calendar size={10} /> Valid until: {selected.valid_until}</div>}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-2xl font-black text-teal-500">{Number(selected.total_amount || 0).toLocaleString()}</div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mt-1 inline-block ${STATUS_CONFIG[selected.status]?.class || ''}`}>
                                                    {STATUS_CONFIG[selected.status]?.label || selected.status}
                                                </span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {selected.notes && (
                                            <div className="p-3 rounded-xl theme-surface text-sm theme-text-muted" style={{ border: '1px solid var(--theme-border)' }}>
                                                <FileText size={12} className="inline mr-1.5" />{selected.notes}
                                            </div>
                                        )}
                                        {selected.lines && selected.lines.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-black theme-text-muted uppercase tracking-wider mb-2">Quoted Items ({selected.lines.length})</h4>
                                                <div className="space-y-1">
                                                    {selected.lines.map((l: any, i: number) => (
                                                        <div key={i} className="flex justify-between text-sm p-2 rounded-lg theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                                            <span className="theme-text font-medium truncate">{l.product_name || l.product?.name || '—'}</span>
                                                            <span className="theme-text-muted shrink-0 ml-2">{l.quantity} × {Number(l.unit_price || 0).toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {selected.created_at && (
                                            <div className="flex justify-between text-sm pt-2">
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
