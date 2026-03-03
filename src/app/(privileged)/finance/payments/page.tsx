// @ts-nocheck
'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { Payment, FinancialAccount, AgingBucket, ContactBalance } from '@/types/erp'
import { getPayments, recordSupplierPayment, recordCustomerReceipt, getAgedReceivables, getAgedPayables, getCustomerBalances, getSupplierBalances } from "@/app/actions/finance/payments"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { erpFetch } from "@/lib/erp-api"
import { toast } from "sonner"
import {
    Wallet, Plus, Search, ArrowDownLeft, ArrowUpRight,
    CheckCircle2, XCircle, Send, CreditCard, Banknote, Building2,
    Users, TrendingUp, TrendingDown, BarChart3, FileText, X
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from "@/lib/utils/currency"
import { useAdmin } from "@/context/AdminContext"

type ActiveView = 'ALL' | 'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT' | 'AGED_AR' | 'AGED_AP' | 'BALANCES'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    DRAFT: { label: 'Draft', color: 'var(--app-muted-foreground)', bg: 'var(--app-surface-2)', border: 'var(--app-border)' },
    POSTED: { label: 'Posted', color: 'var(--app-success)', bg: 'var(--app-success-bg)', border: 'var(--app-success)' },
    CANCELLED: { label: 'Cancelled', color: 'var(--app-error)', bg: 'var(--app-error-bg)', border: 'color-mix(in srgb, var(--app-error) 20%, transparent)' },
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    SUPPLIER_PAYMENT: { label: 'Supplier Payment', color: 'var(--app-error)', bg: 'var(--app-error-bg)', border: 'color-mix(in srgb, var(--app-error) 20%, transparent)', icon: ArrowUpRight },
    CUSTOMER_RECEIPT: { label: 'Customer Receipt', color: 'var(--app-success)', bg: 'var(--app-success-bg)', border: 'var(--app-success)', icon: ArrowDownLeft },
    REFUND: { label: 'Refund', color: 'var(--app-warning)', bg: 'var(--app-warning-bg)', border: 'var(--app-warning)', icon: CreditCard },
}

const METHOD_ICONS: Record<string, any> = {
    CASH: Banknote, BANK_TRANSFER: Building2, CHECK: FileText, CARD: CreditCard,
}

export default function PaymentsPage() {
    const { viewScope } = useAdmin()
    const { fmt } = useCurrency()
    const [payments, setPayments] = useState<Payment[]>([])
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [contacts, setContacts] = useState<Array<{ id: number; name: string; type: string }>>([])
    const [contactSearch, setContactSearch] = useState('')
    const [agedAR, setAgedAR] = useState<AgingBucket[]>([])
    const [agedAP, setAgedAP] = useState<AgingBucket[]>([])
    const [customerBalances, setCustomerBalances] = useState<ContactBalance[]>([])
    const [supplierBalances, setSupplierBalances] = useState<ContactBalance[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [paymentType, setPaymentType] = useState<'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT'>('SUPPLIER_PAYMENT')
    const [activeView, setActiveView] = useState<ActiveView>('ALL')
    const [searchQuery, setSearchQuery] = useState("")
    const [isPending, startTransition] = useTransition()
    const settings = useListViewSettings('fin_payments', {
        columns: ['payment_date', 'type', 'contact_name', 'method', 'reference', 'amount'],
        pageSize: 25, sortKey: 'payment_date', sortDir: 'desc'
    })

    useEffect(() => { loadData() }, [viewScope])

    async function loadData() {
        try {
            const [p, accs, ctcs] = await Promise.all([
                getPayments(), getFinancialAccounts(),
                erpFetch('crm/contacts/?limit=200').catch(() => [])
            ])
            setPayments(Array.isArray(p) ? p : [])
            setAccounts(Array.isArray(accs) ? accs : [])
            if (Array.isArray(ctcs)) {
                setContacts(ctcs.map((c: any) => ({ id: c.id, name: c.name || c.company_name || `Contact #${c.id}`, type: c.type || 'unknown' })))
            }
        } catch {
            setPayments([]); setAccounts([])
            toast.error("Failed to load payments")
        } finally { setLoading(false) }
    }

    async function loadAgedReports() {
        try {
            const [ar, ap] = await Promise.all([getAgedReceivables(), getAgedPayables()])
            setAgedAR(Array.isArray(ar) ? ar : [])
            setAgedAP(Array.isArray(ap) ? ap : [])
        } catch { toast.error("Failed to load aged reports") }
    }

    async function loadBalances() {
        try {
            const [cb, sb] = await Promise.all([getCustomerBalances(), getSupplierBalances()])
            setCustomerBalances(Array.isArray(cb) ? cb : [])
            setSupplierBalances(Array.isArray(sb) ? sb : [])
        } catch { toast.error("Failed to load balances") }
    }

    useEffect(() => {
        if (activeView === 'AGED_AR' || activeView === 'AGED_AP') loadAgedReports()
        if (activeView === 'BALANCES') loadBalances()
    }, [activeView, viewScope])

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                const base = {
                    contact_id: Number(fd.get("contact_id")),
                    amount: Number(fd.get("amount")),
                    payment_date: fd.get("payment_date") as string,
                    method: fd.get("method") as string,
                    reference: fd.get("reference") as string || undefined,
                    payment_account_id: fd.get("payment_account_id") ? Number(fd.get("payment_account_id")) : undefined,
                }
                if (paymentType === 'SUPPLIER_PAYMENT') {
                    await recordSupplierPayment({ ...base, supplier_invoice_id: fd.get("invoice_id") ? Number(fd.get("invoice_id")) : undefined })
                    toast.success("Supplier payment recorded")
                } else {
                    await recordCustomerReceipt({ ...base, sales_order_id: fd.get("order_id") ? Number(fd.get("order_id")) : undefined })
                    toast.success("Customer receipt recorded")
                }
                setDialogOpen(false); loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to record payment")
            }
        })
    }

    const filteredPayments = useMemo(() => {
        return payments
            .filter(p => activeView === 'ALL' || p.type === activeView)
            .filter(p => !searchQuery ||
                (p.reference || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase()))
    }, [payments, activeView, searchQuery])

    const columns: ColumnDef<any>[] = useMemo(() => {
        if (activeView === 'AGED_AR' || activeView === 'AGED_AP') {
            return [
                { key: activeView === 'AGED_AR' ? 'customer_name' : 'supplier_name', label: activeView === 'AGED_AR' ? 'Customer' : 'Supplier', sortable: true },
                { key: 'current', label: 'Current', align: 'right', render: (val) => fmt(val.current) },
                { key: 'days_30', label: '30 Days', align: 'right', render: (val) => fmt(val.days_30) },
                { key: 'days_60', label: '60 Days', align: 'right', render: (val) => fmt(val.days_60) },
                { key: 'days_90_plus', label: '90+ Days', align: 'right', render: (val) => <span style={{ color: 'var(--app-error)', fontWeight: 600 }}>{fmt(val.days_90_plus)}</span> },
                { key: 'total', label: 'Total', align: 'right', render: (val) => <span style={{ fontWeight: 700 }}>{fmt(val.total)}</span> },
            ]
        }
        if (activeView === 'BALANCES') {
            return [
                { key: 'contact_name', label: 'Contact', sortable: true },
                { key: 'current_balance', label: 'Balance', align: 'right', render: (val) => <span style={{ fontWeight: 600, color: Number(val.current_balance) > 0 ? 'var(--app-warning)' : 'var(--app-success)' }}>{fmt(val.current_balance)}</span> },
                { key: 'credit_limit', label: 'Credit Limit', align: 'right', render: (val) => val.credit_limit ? fmt(val.credit_limit) : '—' },
            ]
        }
        return [
            { key: 'payment_date', label: 'Date', sortable: true },
            {
                key: 'type', label: 'Type',
                render: (p) => {
                    const cfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.SUPPLIER_PAYMENT
                    const Icon = cfg.icon
                    return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border"
                            style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                            <Icon size={10} /> {cfg.label}
                        </span>
                    )
                }
            },
            { key: 'contact_name', label: 'Contact', sortable: true },
            {
                key: 'method', label: 'Method',
                render: (p) => {
                    const Icon = METHOD_ICONS[p.method] || Banknote
                    return <div className="app-page flex items-center gap-1.5 text-sm" style={{ color: 'var(--app-muted-foreground)' }}><Icon size={14} /> {(p.method || '').replace(/_/g, ' ')}</div>
                }
            },
            { key: 'reference', label: 'Reference', render: (p) => <span className="font-mono text-xs" style={{ color: 'var(--app-muted-foreground)' }}>{p.reference || "—"}</span> },
            { key: 'amount', label: 'Amount', align: 'right', sortable: true, render: (p) => <span className="font-semibold" style={{ color: 'var(--app-foreground)' }}>{fmt(p.amount)}</span> },
        ]
    }, [activeView, fmt])

    const totalSupplier = payments.filter(p => p.type === 'SUPPLIER_PAYMENT').reduce((s, p) => s + Number(p.amount || 0), 0)
    const totalCustomer = payments.filter(p => p.type === 'CUSTOMER_RECEIPT').reduce((s, p) => s + Number(p.amount || 0), 0)
    const netFlow = totalCustomer - totalSupplier

    const kpis = [
        { label: 'Total Transactions', value: String(payments.length), sub: 'All time', icon: Wallet, color: 'var(--app-muted-foreground)', bg: 'var(--app-surface-2)' },
        { label: 'Paid Out', value: fmt(totalSupplier), sub: 'Supplier payments', icon: ArrowUpRight, color: 'var(--app-error)', bg: 'var(--app-error-bg)' },
        { label: 'Received', value: fmt(totalCustomer), sub: 'Customer receipts', icon: ArrowDownLeft, color: 'var(--app-success)', bg: 'var(--app-success-bg)' },
        { label: 'Net Flow', value: fmt(netFlow), sub: netFlow >= 0 ? 'Net positive' : 'Net negative', icon: BarChart3, color: netFlow >= 0 ? 'var(--app-success)' : 'var(--app-error)', bg: netFlow >= 0 ? 'var(--app-success-bg)' : 'var(--app-error-bg)' },
    ]

    const tabs = [
        { key: "ALL" as ActiveView, label: "All", icon: Wallet },
        { key: "SUPPLIER_PAYMENT" as ActiveView, label: "Supplier", icon: ArrowUpRight },
        { key: "CUSTOMER_RECEIPT" as ActiveView, label: "Customer", icon: ArrowDownLeft },
        { key: "AGED_AR" as ActiveView, label: "Aged AR", icon: TrendingUp },
        { key: "AGED_AP" as ActiveView, label: "Aged AP", icon: TrendingDown },
        { key: "BALANCES" as ActiveView, label: "Balances", icon: Users },
    ]

    const tableData = useMemo(() => {
        if (activeView === 'AGED_AR') return agedAR
        if (activeView === 'AGED_AP') return agedAP
        if (activeView === 'BALANCES') return [...customerBalances, ...supplierBalances]
        return filteredPayments
    }, [activeView, agedAR, agedAP, customerBalances, supplierBalances, filteredPayments])

    return (
        <div className="app-page min-h-screen p-5 md:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex justify-between items-center gap-4 fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                        style={{ background: 'var(--app-success)', boxShadow: '0 8px 24px var(--app-primary-glow)' }}>
                        <CreditCard size={26} color="#fff" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter" style={{ color: 'var(--app-foreground)' }}>
                            Payments &amp; <span style={{ color: 'var(--app-success)' }}>Collections</span>
                        </h1>
                        <p className="text-sm font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            Supplier &amp; Customer
                        </p>
                    </div>
                </div>
                <button onClick={() => setDialogOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-md"
                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 16px var(--app-primary-glow)' }}>
                    <Plus size={16} /> Record Payment
                </button>
            </header>

            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((kpi, i) => (
                    <div key={i} className="app-kpi-card">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{kpi.label}</p>
                                <p className="text-2xl font-black mt-1 tracking-tighter" style={{ color: 'var(--app-foreground)' }}>{kpi.value}</p>
                                <p className="text-[10px] font-bold mt-0.5 uppercase" style={{ color: kpi.color }}>{kpi.sub}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                                style={{ background: kpi.bg }}>
                                <kpi.icon size={22} style={{ color: kpi.color }} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table with tab switcher */}
            <TypicalListView
                title=""
                data={tableData}
                loading={loading || isPending}
                getRowId={(row) => row.id || `${row.contact_id}-${row.customer_name}-${row.supplier_name}`}
                columns={columns}
                lifecycle={{ getStatus: (row) => row.status ? (STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT) : undefined }}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="rounded-2xl overflow-hidden"
            >
                <div className="px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b"
                    style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface-2)' }}>
                    <div className="flex gap-1 flex-wrap">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            const isActive = activeView === tab.key
                            return (
                                <button key={tab.key} onClick={() => setActiveView(tab.key)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl transition-all font-semibold"
                                    style={isActive
                                        ? { background: 'var(--app-surface)', color: 'var(--app-foreground)', boxShadow: 'var(--app-shadow-sm)' }
                                        : { color: 'var(--app-muted-foreground)' }}>
                                    <Icon size={12} /> {tab.label}
                                </button>
                            )
                        })}
                    </div>
                    {(activeView === 'ALL' || activeView === 'SUPPLIER_PAYMENT' || activeView === 'CUSTOMER_RECEIPT') && (
                        <div className="relative w-full sm:w-64">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                            <input placeholder="Search reference or contact..." value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none transition-all"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    )}
                </div>
            </TypicalListView>

            {/* Record Payment Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'var(--app-border)', backdropFilter: 'blur(8px)' }}
                    onClick={(e) => e.target === e.currentTarget && setDialogOpen(false)}>
                    <div className="w-full max-w-lg rounded-3xl p-6 shadow-2xl"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <Send size={20} style={{ color: 'var(--app-primary)' }} />
                                <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>Record Payment</h2>
                            </div>
                            <button onClick={() => setDialogOpen(false)} style={{ color: 'var(--app-muted-foreground)' }} className="hover:opacity-70">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Type Selector */}
                        <div className="flex gap-2 mb-5">
                            {(['SUPPLIER_PAYMENT', 'CUSTOMER_RECEIPT'] as const).map(t => {
                                const cfg = TYPE_CONFIG[t]
                                const Icon = cfg.icon
                                const isActive = paymentType === t
                                return (
                                    <button key={t} type="button" onClick={() => setPaymentType(t)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                                        style={isActive
                                            ? { background: cfg.bg, color: cfg.color, borderColor: cfg.border }
                                            : { background: 'var(--app-background)', color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                                        <Icon size={14} /> {cfg.label}
                                    </button>
                                )
                            })}
                        </div>

                        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Search Contact</label>
                                <input type="text" placeholder="Filter contacts..." value={contactSearch}
                                    onChange={e => setContactSearch(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-1"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                <select name="contact_id" required size={4} className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    {contacts.filter(c => !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase())).slice(0, 30).map(c => (
                                        <option key={c.id} value={c.id}>{c.name} [{c.type}]</option>
                                    ))}
                                </select>
                            </div>
                            {[
                                { label: 'Amount *', name: 'amount', type: 'number', step: '0.01', min: '0.01', required: true },
                                { label: 'Date *', name: 'payment_date', type: 'date', required: true, defaultValue: new Date().toISOString().split('T')[0] },
                            ].map(f => (
                                <div key={f.name} className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{f.label}</label>
                                    <input {...f} className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                </div>
                            ))}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Method *</label>
                                <select name="method" required className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="CASH">Cash</option>
                                    <option value="BANK_TRANSFER">Bank Transfer</option>
                                    <option value="CHECK">Check</option>
                                    <option value="CARD">Card</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Reference</label>
                                <input name="reference" placeholder="Optional reference..." className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Payment Account</label>
                                <select name="payment_account_id" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="">Select account...</option>
                                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
                                <button type="button" onClick={() => setDialogOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                                    style={{ color: 'var(--app-muted-foreground)', background: 'var(--app-surface-2)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={isPending}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all"
                                    style={{ background: 'var(--app-primary)', opacity: isPending ? 0.7 : 1 }}>
                                    <Send size={14} /> {isPending ? "Recording..." : "Record"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
