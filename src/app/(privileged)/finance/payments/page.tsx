'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { Payment, FinancialAccount, AgingBucket, ContactBalance } from '@/types/erp'
import { getPayments, recordSupplierPayment, recordCustomerReceipt, getAgedReceivables, getAgedPayables, getCustomerBalances, getSupplierBalances } from "@/app/actions/finance/payments"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { erpFetch } from "@/lib/erp-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Wallet, Plus, Search, ArrowDownLeft, ArrowUpRight, Clock,
    CheckCircle2, XCircle, Send, CreditCard, Banknote, Building2,
    ArrowUpDown, ArrowUp, ArrowDown, Users, TrendingUp, TrendingDown,
    BarChart3, FileText
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from "@/lib/utils/currency"

type ActiveView = 'ALL' | 'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT' | 'AGED_AR' | 'AGED_AP' | 'BALANCES'

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' }> = {
    DRAFT: { label: 'Draft', variant: 'default' },
    POSTED: { label: 'Posted', variant: 'success' },
    CANCELLED: { label: 'Cancelled', variant: 'destructive' },
}

const TYPE_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive'; icon: any }> = {
    SUPPLIER_PAYMENT: { label: 'Supplier Payment', variant: 'destructive', icon: ArrowUpRight },
    CUSTOMER_RECEIPT: { label: 'Customer Receipt', variant: 'success', icon: ArrowDownLeft },
    REFUND: { label: 'Refund', variant: 'warning', icon: CreditCard },
}

const METHOD_ICONS: Record<string, any> = {
    CASH: Banknote,
    BANK_TRANSFER: Building2,
    CHECK: FileText,
    CARD: CreditCard,
}

import { useAdmin } from "@/context/AdminContext"

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
                getPayments(),
                getFinancialAccounts(),
                erpFetch('crm/contacts/?limit=200').catch(() => [])
            ])
            setPayments(Array.isArray(p) ? p : [])
            setAccounts(Array.isArray(accs) ? accs : [])
            if (Array.isArray(ctcs)) {
                setContacts(ctcs.map((c: any) => ({
                    id: c.id,
                    name: c.name || c.company_name || `Contact #${c.id}`,
                    type: c.type || 'unknown'
                })))
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
                setDialogOpen(false)
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to record payment")
            }
        })
    }

    const filteredPayments = useMemo(() => {
        return payments
            .filter(p => activeView === 'ALL' || p.type === activeView)
            .filter(p =>
                !searchQuery ||
                (p.reference || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase())
            )
    }, [payments, activeView, searchQuery])

    // ── Columns Mapping ──────────────────────────────────────────
    const columns: ColumnDef<any>[] = useMemo(() => {
        if (activeView === 'AGED_AR' || activeView === 'AGED_AP') {
            return [
                { key: activeView === 'AGED_AR' ? 'customer_name' : 'supplier_name', label: activeView === 'AGED_AR' ? 'Customer' : 'Supplier', sortable: true },
                { key: 'current', label: 'Current', align: 'right', render: (val) => fmt(val.current) },
                { key: 'days_30', label: '30 Days', align: 'right', render: (val) => fmt(val.days_30) },
                { key: 'days_60', label: '60 Days', align: 'right', render: (val) => fmt(val.days_60) },
                { key: 'days_90_plus', label: '90+ Days', align: 'right', render: (val) => <span className="text-red-600 font-semibold">{fmt(val.days_90_plus)}</span> },
                { key: 'total', label: 'Total', align: 'right', render: (val) => <span className="font-bold">{fmt(val.total)}</span> },
            ]
        }
        if (activeView === 'BALANCES') {
            return [
                { key: 'contact_name', label: 'Contact', sortable: true },
                { key: 'current_balance', label: 'Balance', align: 'right', render: (val) => <span className={`font-semibold ${Number(val.current_balance) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmt(val.current_balance)}</span> },
                { key: 'credit_limit', label: 'Credit Limit', align: 'right', render: (val) => val.credit_limit ? fmt(val.credit_limit) : '—' },
            ]
        }
        return [
            { key: 'payment_date', label: 'Date', sortable: true },
            {
                key: 'type',
                label: 'Type',
                render: (p) => {
                    const cfg = TYPE_CONFIG[p.type] || TYPE_CONFIG.SUPPLIER_PAYMENT
                    const Icon = cfg.icon
                    return (
                        <Badge variant="outline" className={`gap-1 rounded-lg border font-semibold text-[11px] ${cfg.variant === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            <Icon size={12} /> {cfg.label}
                        </Badge>
                    )
                }
            },
            { key: 'contact_name', label: 'Contact', sortable: true },
            {
                key: 'method',
                label: 'Method',
                render: (p) => {
                    const Icon = METHOD_ICONS[p.method] || Banknote
                    return <div className="flex items-center gap-1.5 text-sm text-stone-500"><Icon size={14} /> {(p.method || '').replace(/_/g, ' ')}</div>
                }
            },
            { key: 'reference', label: 'Reference', render: (p) => <span className="font-mono text-xs">{p.reference || "—"}</span> },
            { key: 'amount', label: 'Amount', align: 'right', sortable: true, render: (p) => <span className="font-semibold text-stone-800">{fmt(p.amount)}</span> },
        ]
    }, [activeView, fmt])

    const totalSupplier = payments.filter(p => p.type === 'SUPPLIER_PAYMENT').reduce((s, p) => s + Number(p.amount || 0), 0)
    const totalCustomer = payments.filter(p => p.type === 'CUSTOMER_RECEIPT').reduce((s, p) => s + Number(p.amount || 0), 0)

    const tabs = [
        { key: "ALL" as ActiveView, label: "All Payments", icon: Wallet },
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

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
                    <Skeleton className="h-10 w-36" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <CreditCard size={28} className="text-white" />
                        </div>
                        Payments & <span className="text-emerald-600">Collections</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Supplier & Customer</p>
                    <p className="text-stone-500 font-medium mt-1">Supplier payments, customer receipts, and aged reports</p>
                </div>
                <Button onClick={() => setDialogOpen(true)} className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-all">
                    <Plus size={16} /> Record Payment
                </Button>
            </div>

            {/* ─── Create Dialog ────────────────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Send size={20} /> Record Payment</DialogTitle>
                        <DialogDescription>Record a supplier payment or customer receipt.</DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 pt-2">
                        {(["SUPPLIER_PAYMENT", "CUSTOMER_RECEIPT"] as const).map(t => {
                            const cfg = TYPE_CONFIG[t]
                            const Icon = cfg.icon
                            return (
                                <button key={t} type="button" onClick={() => setPaymentType(t)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${paymentType === t
                                        ? `bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm` : "bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100"}`}>
                                    <Icon size={14} /> {cfg.label}
                                </button>
                            )
                        })}
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Contact *</label>
                            <input
                                type="text"
                                placeholder="Search customer or supplier..."
                                value={contactSearch}
                                onChange={e => setContactSearch(e.target.value)}
                                className="w-full px-3 py-2 border rounded-xl bg-background text-sm mb-1 focus:outline-none focus:border-stone-400"
                            />
                            <select name="contact_id" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm" size={4}>
                                {contacts
                                    .filter(c => !contactSearch ||
                                        c.name.toLowerCase().includes(contactSearch.toLowerCase())
                                    )
                                    .slice(0, 30)
                                    .map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} [{c.type}]
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Amount *</label>
                            <Input name="amount" type="number" step="0.01" min="0.01" required className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Date *</label>
                            <Input name="payment_date" type="date" required className="rounded-xl" defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Method *</label>
                            <select name="method" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                <option value="CASH">Cash</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                <option value="CHECK">Check</option>
                                <option value="CARD">Card</option>
                            </select>
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Reference</label>
                            <Input name="reference" placeholder="Optional reference..." className="rounded-xl" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Payment Account</label>
                            <select name="payment_account_id" className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                <option value="">Select account...</option>
                                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div className="col-span-2 flex justify-end gap-2 pt-3 border-t">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isPending} className="rounded-xl gap-2">
                                {isPending ? "Recording..." : <><Send size={14} /> Record</>}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-stone-50 to-stone-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total</p>
                                <p className="text-3xl font-bold text-stone-900 mt-1">{payments.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-stone-200/60 flex items-center justify-center">
                                <Wallet size={22} className="text-stone-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Paid Out</p>
                                <p className="text-2xl font-bold text-rose-900 mt-1">{fmt(totalSupplier)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-rose-200/60 flex items-center justify-center">
                                <ArrowUpRight size={22} className="text-rose-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Received</p>
                                <p className="text-2xl font-bold text-emerald-900 mt-1">{fmt(totalCustomer)}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <ArrowDownLeft size={22} className="text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Net Flow</p>
                                <p className={`text-2xl font-bold mt-1 ${totalCustomer - totalSupplier >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                                    {fmt(totalCustomer - totalSupplier)}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-200/60 flex items-center justify-center">
                                <BarChart3 size={22} className="text-blue-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* TypicalListView for all view modes */}
            <TypicalListView
                title=""
                data={tableData}
                loading={loading || isPending}
                getRowId={(row) => row.id || `${row.contact_id}-${row.customer_name}-${row.supplier_name}`}
                columns={columns}
                lifecycle={{
                    getStatus: (row) => row.status ? (STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT) : undefined
                }}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="rounded-2xl shadow-sm border overflow-hidden"
            >
                <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-stone-50/50">
                    <div className="flex gap-1 flex-wrap">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            return (
                                <button key={tab.key} onClick={() => setActiveView(tab.key)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl transition-all ${activeView === tab.key
                                        ? "bg-white shadow-sm font-semibold text-stone-900" : "text-stone-400 hover:text-stone-600"}`}>
                                    <Icon size={13} /> {tab.label}
                                </button>
                            )
                        })}
                    </div>
                    {(activeView === 'ALL' || activeView === 'SUPPLIER_PAYMENT' || activeView === 'CUSTOMER_RECEIPT') && (
                        <div className="relative w-full sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            <Input placeholder="Search reference or contact..." value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl text-sm h-9 bg-white" />
                        </div>
                    )}
                </div>
            </TypicalListView>
        </div>
    )
}
