'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { Payment, FinancialAccount, AgingBucket, ContactBalance } from '@/types/erp'
import { getPayments, recordSupplierPayment, recordCustomerReceipt, getAgedReceivables, getAgedPayables, getCustomerBalances, getSupplierBalances } from "@/app/actions/finance/payments"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

type ActiveView = 'ALL' | 'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT' | 'AGED_AR' | 'AGED_AP' | 'BALANCES'
type SortKey = 'payment_date' | 'type' | 'amount' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    DRAFT: { label: 'Draft', color: 'text-app-muted-foreground', bg: 'bg-app-surface border-app-border', icon: Clock },
    POSTED: { label: 'Posted', color: 'text-app-success', bg: 'bg-app-success-bg border-app-success', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: XCircle },
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    SUPPLIER_PAYMENT: { label: 'Supplier Payment', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: ArrowUpRight },
    CUSTOMER_RECEIPT: { label: 'Customer Receipt', color: 'text-app-success', bg: 'bg-app-success-bg border-app-success', icon: ArrowDownLeft },
    REFUND: { label: 'Refund', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: CreditCard },
}

const METHOD_ICONS: Record<string, any> = {
    CASH: Banknote,
    BANK_TRANSFER: Building2,
    CHECK: FileText,
    CARD: CreditCard,
}

export default function PaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([])
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [agedAR, setAgedAR] = useState<AgingBucket[]>([])
    const [agedAP, setAgedAP] = useState<AgingBucket[]>([])
    const [customerBalances, setCustomerBalances] = useState<ContactBalance[]>([])
    const [supplierBalances, setSupplierBalances] = useState<ContactBalance[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [paymentType, setPaymentType] = useState<'SUPPLIER_PAYMENT' | 'CUSTOMER_RECEIPT'>('SUPPLIER_PAYMENT')
    const [activeView, setActiveView] = useState<ActiveView>('ALL')
    const [searchQuery, setSearchQuery] = useState("")
    const [sortKey, setSortKey] = useState<SortKey>('payment_date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [p, accs] = await Promise.all([
                getPayments(),
                getFinancialAccounts()
            ])
            setPayments(Array.isArray(p) ? p : [])
            setAccounts(Array.isArray(accs) ? accs : [])
        } catch {
            setPayments([]); setAccounts([])
            toast.error("Failed to load payments")
        } finally {
            setLoading(false)
        }
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
    }, [activeView])

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

    // ── Sorting ──────────────────────────────────────────────────
    function toggleSort(key: SortKey) {
        if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
        else { setSortKey(key); setSortDir('asc') }
    }
    function SortIcon({ col }: { col: SortKey }) {
        if (sortKey !== col) return <ArrowUpDown size={12} className="text-app-faint ml-1 inline" />
        return sortDir === 'asc'
            ? <ArrowUp size={12} className="text-app-success ml-1 inline" />
            : <ArrowDown size={12} className="text-app-success ml-1 inline" />
    }

    const filteredPayments = useMemo(() => {
        let list = payments
            .filter(p => activeView === 'ALL' || p.type === activeView)
            .filter(p =>
                !searchQuery ||
                (p.reference || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase())
            )
        list.sort((a, b) => {
            let cmp = 0
            if (sortKey === 'amount') cmp = Number(a.amount || 0) - Number(b.amount || 0)
            else cmp = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''))
            return sortDir === 'asc' ? cmp : -cmp
        })
        return list
    }, [payments, activeView, searchQuery, sortKey, sortDir])

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
                    <h1 className="text-4xl font-bold text-app-foreground font-serif tracking-tight">Payments & Collections</h1>
                    <p className="text-app-muted-foreground font-medium mt-1">Supplier payments, customer receipts, and aged reports</p>
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
                                        ? `${cfg.bg} ${cfg.color} shadow-sm` : "bg-app-surface text-app-muted-foreground border-app-border hover:bg-app-surface-2"}`}>
                                    <Icon size={14} /> {cfg.label}
                                </button>
                            )
                        })}
                    </div>
                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-app-muted-foreground uppercase">Contact ID *</label>
                            <Input name="contact_id" type="number" required placeholder="Contact ID" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-app-muted-foreground uppercase">Amount *</label>
                            <Input name="amount" type="number" step="0.01" min="0.01" required placeholder="1,000.00" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-app-muted-foreground uppercase">Date *</label>
                            <Input name="payment_date" type="date" required className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-app-muted-foreground uppercase">Method *</label>
                            <select name="method" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                <option value="CASH">Cash</option>
                                <option value="BANK_TRANSFER">Bank Transfer</option>
                                <option value="CHECK">Check</option>
                                <option value="CARD">Card</option>
                            </select>
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-app-muted-foreground uppercase">Reference</label>
                            <Input name="reference" placeholder="Optional reference..." className="rounded-xl" />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-app-muted-foreground uppercase">Payment Account</label>
                            <select name="payment_account_id" className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                <option value="">Select account...</option>
                                {accounts.map((a: Record<string, any>) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
                                <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Total</p>
                                <p className="text-3xl font-bold text-app-foreground mt-1">{payments.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-app-surface-2/60 flex items-center justify-center">
                                <Wallet size={22} className="text-app-muted-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-rose-50 to-rose-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-app-error uppercase tracking-wider">Paid Out</p>
                                <p className="text-2xl font-bold text-rose-900 mt-1">{totalSupplier.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-rose-200/60 flex items-center justify-center">
                                <ArrowUpRight size={22} className="text-app-error" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Received</p>
                                <p className="text-2xl font-bold text-emerald-900 mt-1">{totalCustomer.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <ArrowDownLeft size={22} className="text-app-success" />
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
                                    {(totalCustomer - totalSupplier).toLocaleString()}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-200/60 flex items-center justify-center">
                                <BarChart3 size={22} className="text-app-info" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs + Content */}
            <Card className="rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-app-surface/50">
                    <div className="flex gap-1 flex-wrap">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            return (
                                <button key={tab.key} onClick={() => setActiveView(tab.key)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl transition-all ${activeView === tab.key
                                        ? "bg-app-surface shadow-sm font-semibold text-app-foreground" : "text-app-muted-foreground hover:text-app-muted-foreground"}`}>
                                    <Icon size={13} /> {tab.label}
                                </button>
                            )
                        })}
                    </div>
                    {(activeView === 'ALL' || activeView === 'SUPPLIER_PAYMENT' || activeView === 'CUSTOMER_RECEIPT') && (
                        <div className="relative w-full sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <Input placeholder="Search reference or contact..." value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl text-sm h-9 bg-app-surface" />
                        </div>
                    )}
                </div>

                {/* ─── Payments Table ──────────────────────────────── */}
                {(activeView === 'ALL' || activeView === 'SUPPLIER_PAYMENT' || activeView === 'CUSTOMER_RECEIPT') && (
                    <>
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/30">
                                    <TableHead className="text-xs font-bold uppercase text-app-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('payment_date')}>
                                        Date <SortIcon col="payment_date" />
                                    </TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-app-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('type')}>
                                        Type <SortIcon col="type" />
                                    </TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Contact</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Method</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Reference</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                                        Amount <SortIcon col="amount" />
                                    </TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-center cursor-pointer select-none" onClick={() => toggleSort('status')}>
                                        Status <SortIcon col="status" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayments.map((p: Record<string, any>) => {
                                    const tc = TYPE_CONFIG[p.type] || TYPE_CONFIG.SUPPLIER_PAYMENT
                                    const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.DRAFT
                                    const TypeIcon = tc.icon
                                    const StatusIcon = sc.icon
                                    const MethodIcon = METHOD_ICONS[p.method] || Banknote
                                    return (
                                        <TableRow key={p.id} className="hover:bg-app-surface/50 transition-colors">
                                            <TableCell className="text-sm text-app-muted-foreground">{p.payment_date}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`gap-1 rounded-lg border ${tc.bg} ${tc.color} font-semibold text-[11px]`}>
                                                    <TypeIcon size={12} /> {tc.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium text-app-foreground">{p.contact_name || `#${p.contact}`}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 text-sm text-app-muted-foreground">
                                                    <MethodIcon size={14} /> {(p.method || '').replace(/_/g, ' ')}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm text-app-muted-foreground">{p.reference || "—"}</TableCell>
                                            <TableCell className="text-right font-semibold text-app-foreground">{Number(p.amount).toLocaleString()}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className={`gap-1 rounded-lg border ${sc.bg} ${sc.color} font-semibold text-[11px]`}>
                                                    <StatusIcon size={12} /> {sc.label}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {filteredPayments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-16 h-16 rounded-full bg-app-surface-2 flex items-center justify-center">
                                                    <Wallet size={28} className="text-app-faint" />
                                                </div>
                                                <p className="font-semibold text-app-muted-foreground">No payments found</p>
                                                <p className="text-sm text-app-muted-foreground mt-1">Record your first payment to get started</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        {filteredPayments.length > 0 && (
                            <div className="px-5 py-3 border-t bg-app-surface/30 flex items-center justify-between text-sm text-app-muted-foreground">
                                <span>{filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} shown</span>
                                <span className="font-semibold text-app-foreground">
                                    Total: {filteredPayments.reduce((s: number, p: Record<string, any>) => s + Number(p.amount || 0), 0).toLocaleString()}
                                </span>
                            </div>
                        )}
                    </>
                )}

                {/* ─── Aged Receivables ────────────────────────────── */}
                {activeView === 'AGED_AR' && (
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-app-foreground mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-app-success" /> Aged Receivables</h3>
                        {agedAR.length === 0 ? (
                            <p className="text-center text-app-muted-foreground py-12">No outstanding receivables</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Customer</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Current</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">30 Days</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">60 Days</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">90+ Days</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {agedAR.map((r: Record<string, any>, i: number) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium text-app-foreground">{r.customer_name || r.customer}</TableCell>
                                            <TableCell className="text-right">{Number(r.current || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{Number(r.days_30 || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{Number(r.days_60 || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-app-error font-semibold">{Number(r.days_90_plus || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold">{Number(r.total || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                )}

                {/* ─── Aged Payables ───────────────────────────────── */}
                {activeView === 'AGED_AP' && (
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-app-foreground mb-4 flex items-center gap-2"><TrendingDown size={20} className="text-app-error" /> Aged Payables</h3>
                        {agedAP.length === 0 ? (
                            <p className="text-center text-app-muted-foreground py-12">No outstanding payables</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Supplier</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Current</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">30 Days</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">60 Days</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">90+ Days</TableHead>
                                        <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {agedAP.map((r: Record<string, any>, i: number) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium text-app-foreground">{r.supplier_name || r.supplier}</TableCell>
                                            <TableCell className="text-right">{Number(r.current || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{Number(r.days_30 || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right">{Number(r.days_60 || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right text-app-error font-semibold">{Number(r.days_90_plus || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-bold">{Number(r.total || 0).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                )}

                {/* ─── Balances ────────────────────────────────────── */}
                {activeView === 'BALANCES' && (
                    <div className="p-6 space-y-8">
                        <div>
                            <h3 className="text-lg font-bold text-app-foreground mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-app-success" /> Customer Balances (AR)</h3>
                            {customerBalances.length === 0 ? (
                                <p className="text-center text-app-muted-foreground py-6">No customer balances</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Customer</TableHead>
                                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Balance</TableHead>
                                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Credit Limit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customerBalances.map((cb: Record<string, any>) => (
                                            <TableRow key={cb.id}>
                                                <TableCell className="font-medium text-app-foreground">{cb.contact_name || `#${cb.contact}`}</TableCell>
                                                <TableCell className={`text-right font-semibold ${Number(cb.current_balance) > 0 ? 'text-app-success' : 'text-app-muted-foreground'}`}>
                                                    {Number(cb.current_balance).toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right text-app-muted-foreground">{cb.credit_limit ? Number(cb.credit_limit).toLocaleString() : '—'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-app-foreground mb-4 flex items-center gap-2"><TrendingDown size={20} className="text-app-error" /> Supplier Balances (AP)</h3>
                            {supplierBalances.length === 0 ? (
                                <p className="text-center text-app-muted-foreground py-6">No supplier balances</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Supplier</TableHead>
                                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {supplierBalances.map((sb: Record<string, any>) => (
                                            <TableRow key={sb.id}>
                                                <TableCell className="font-medium text-app-foreground">{sb.contact_name || `#${sb.contact}`}</TableCell>
                                                <TableCell className={`text-right font-semibold ${Number(sb.current_balance) > 0 ? 'text-app-error' : 'text-app-muted-foreground'}`}>
                                                    {Number(sb.current_balance).toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </div>
                )}
            </Card>
        </div>
    )
}
