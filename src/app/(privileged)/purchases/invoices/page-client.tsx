// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchPurchaseOrders } from '@/app/actions/pos/purchases'
import { erpFetch } from '@/lib/erp-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    FileText, RefreshCw, ChevronRight, Clock, CheckCircle, Package, Building2,
    Calendar, Search, Eye, BookOpen, Receipt, DollarSign, Loader2
} from 'lucide-react'
import Link from 'next/link'

type Invoice = {
    id: number
    po_number?: string
    invoice_number?: string
    ref_code?: string
    supplier?: { id: number; name: string }
    supplier_name?: string
    supplier_display?: string
    contact_name?: string
    status: string
    order_date?: string
    created_at?: string
    total_amount: number
    notes?: string
    is_legacy?: boolean
    lines?: any[]
}

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
    RECEIVED: { label: 'Awaiting Invoice', class: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
    INVOICED: { label: 'Invoiced', class: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
    COMPLETED: { label: 'Settled', class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
    FINAL: { label: 'Final', class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

async function getLegacyPurchases() {
    try {
        const data = await erpFetch('orders/?type=PURCHASE')
        const results = Array.isArray(data) ? data : (data.results || [])
        return results.map((o: any) => ({
            ...o,
            po_number: o.ref_code || `LEGACY-${o.id}`,
            supplier_name: o.contact_name || 'Legacy Supplier',
            is_legacy: true,
        }))
    } catch { return [] }
}

export default function PurchaseInvoicesPage() {
    const [orders, setOrders] = useState<Invoice[]>([])
    const [selected, setSelected] = useState<Invoice | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [poData, legacyData] = await Promise.all([fetchPurchaseOrders(), getLegacyPurchases()])
            const rawPO = Array.isArray(poData) ? poData : (poData?.results ?? [])
            const combined = [...rawPO, ...legacyData]
            setOrders(combined.filter((o: Invoice) => ['RECEIVED', 'INVOICED', 'COMPLETED', 'FINAL'].includes(o.status)))
        } catch { setOrders([]) }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const filtered = orders.filter(o => {
        if (!search) return true
        const q = search.toLowerCase()
        const num = (o.po_number || o.invoice_number || `INV-${o.id}`).toLowerCase()
        const sup = (o.supplier?.name || o.supplier_name || o.supplier_display || o.contact_name || '').toLowerCase()
        return num.includes(q) || sup.includes(q)
    })

    const totalValue = filtered.reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const pendingCount = filtered.filter(o => ['RECEIVED'].includes(o.status)).length
    const settledCount = filtered.filter(o => ['COMPLETED', 'FINAL'].includes(o.status)).length

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-[var(--layout-section-spacing)]">

                {/* ── Header ── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shadow-sm">
                            <Receipt size={24} className="text-purple-500" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                                Purchase <span className="text-purple-500">Invoices</span>
                            </h1>
                            <p className="text-xs md:text-sm font-medium theme-text-muted mt-0.5 hidden sm:block">
                                Supplier billing & settlement tracking
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={load} className="min-h-[44px] md:min-h-[36px]">
                            <RefreshCw size={14} className="mr-1.5" /> Refresh
                        </Button>
                        <Link href="/purchases/credit-notes">
                            <Button variant="outline" size="sm" className="min-h-[44px] md:min-h-[36px]">
                                <FileText size={14} className="mr-1.5" /> Credit Notes
                            </Button>
                        </Link>
                    </div>
                </header>

                {/* ── KPI Strip ── */}
                <section className="grid grid-cols-3 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="Invoice statistics">
                    {[
                        { label: 'Total Invoiced', value: totalValue.toLocaleString(), icon: DollarSign, accent: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/30' },
                        { label: 'Pending Invoice', value: pendingCount, icon: Clock, accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
                        { label: 'Settled', value: settledCount, icon: CheckCircle, accent: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
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
                    <Input placeholder="Search invoices, suppliers..." value={search} onChange={e => setSearch(e.target.value)}
                        className="pl-10 min-h-[44px] md:min-h-[40px]" />
                </div>

                {/* ── Content ── */}
                <div className="flex flex-col lg:flex-row gap-4 md:gap-[var(--layout-element-gap)]">
                    {/* List */}
                    <div className="w-full lg:w-1/2 xl:w-5/12 flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
                        {loading ? Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-[72px] rounded-xl animate-pulse theme-surface" style={{ border: '1px solid var(--theme-border)' }} />
                        )) : filtered.length === 0 ? (
                            <Card className="border shadow-sm">
                                <CardContent className="p-12 text-center">
                                    <Receipt size={40} className="mx-auto theme-text-muted mb-3 opacity-30" />
                                    <p className="text-sm font-medium theme-text-muted">No invoices found</p>
                                </CardContent>
                            </Card>
                        ) : filtered.map(inv => (
                            <button key={`${inv.id}-${inv.is_legacy ? 'l' : 'p'}`} onClick={() => setSelected(inv)}
                                className={`w-full text-left flex items-center gap-3 px-3 md:px-4 py-3 rounded-xl border transition-all shadow-sm min-h-[64px] ${selected?.id === inv.id ? 'bg-purple-50 border-purple-300 dark:bg-purple-900/20 dark:border-purple-600' : 'theme-surface'
                                    }`}
                                style={{ borderColor: selected?.id === inv.id ? undefined : 'var(--theme-border)' }}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-bold text-sm theme-text">{inv.invoice_number || inv.po_number || `INV-${inv.id}`}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${STATUS_CONFIG[inv.status]?.class || 'bg-gray-100 text-gray-500'}`}>
                                            {STATUS_CONFIG[inv.status]?.label || inv.status}
                                        </span>
                                        {inv.is_legacy && <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-gray-100 text-gray-400 uppercase">Legacy</span>}
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-xs theme-text-muted truncate">
                                        <span className="flex items-center gap-1"><Building2 size={10} />{inv.supplier?.name || inv.supplier_name || inv.contact_name || '—'}</span>
                                        <span className="flex items-center gap-1"><Calendar size={10} />{inv.order_date || (inv.created_at ? new Date(inv.created_at).toLocaleDateString('fr-FR') : '—')}</span>
                                    </div>
                                </div>
                                <div className="text-sm font-black theme-text shrink-0">{Number(inv.total_amount || 0).toLocaleString()}</div>
                                <ChevronRight size={14} className="theme-text-muted shrink-0 hidden md:block" />
                            </button>
                        ))}
                    </div>

                    {/* Detail */}
                    <div className="w-full lg:w-1/2 xl:w-7/12 lg:sticky lg:top-4 lg:self-start">
                        <Card className="border shadow-sm min-h-[300px]">
                            {!selected ? (
                                <CardContent className="flex flex-col items-center justify-center py-20 theme-text-muted gap-3">
                                    <Receipt size={48} className="opacity-20" />
                                    <p className="text-sm font-medium">Select an invoice to view details</p>
                                </CardContent>
                            ) : (
                                <>
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-start gap-4">
                                            <div>
                                                <CardTitle className="text-xl font-black theme-text">{selected.invoice_number || selected.po_number || `INV-${selected.id}`}</CardTitle>
                                                <div className="flex items-center gap-3 text-sm font-bold theme-text-muted mt-1"><Building2 size={14} /> {selected.supplier?.name || selected.supplier_name || selected.contact_name || '—'}</div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-2xl font-black theme-text">{Number(selected.total_amount || 0).toLocaleString()}</div>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mt-1 inline-block ${STATUS_CONFIG[selected.status]?.class || ''}`}>
                                                    {STATUS_CONFIG[selected.status]?.label || selected.status}
                                                </span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex gap-2 flex-wrap">
                                            <Link href={`/purchases/${selected.id}`}>
                                                <Button size="sm" variant="outline" className="min-h-[44px] md:min-h-[32px]">
                                                    <Eye size={12} className="mr-1" /> View PO
                                                </Button>
                                            </Link>
                                            <Link href={`/finance/ledger?q=${selected.po_number || selected.id}`}>
                                                <Button size="sm" variant="outline" className="min-h-[44px] md:min-h-[32px]">
                                                    <BookOpen size={12} className="mr-1" /> Ledger
                                                </Button>
                                            </Link>
                                        </div>
                                        {selected.notes && (
                                            <div className="p-3 rounded-xl text-sm theme-text-muted theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                                <FileText size={12} className="inline mr-1.5" />{selected.notes}
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
