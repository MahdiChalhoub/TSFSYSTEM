'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import { getInvoices, getInvoiceDashboard, createInvoice, sendInvoice, cancelInvoice, recordInvoicePayment, deleteInvoice } from "@/app/actions/finance/invoices"
import { getTradeSubTypeSettings } from "@/app/actions/settings/trade-settings"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    FileText, Plus, Search, Send, CheckCircle2, Clock, XCircle,
    AlertTriangle, DollarSign, ArrowUpDown, ArrowUp, ArrowDown,
    Eye, Ban, CreditCard, MoreHorizontal, Receipt, TrendingUp, Percent
} from "lucide-react"

type ActiveTab = 'ALL' | 'DRAFT' | 'SENT' | 'OVERDUE' | 'PAID'
type SortKey = 'issue_date' | 'due_date' | 'total_amount' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    DRAFT: { label: 'Draft', color: 'text-stone-600', bg: 'bg-stone-50 border-stone-200', icon: Clock },
    SENT: { label: 'Sent', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Send },
    PARTIAL_PAID: { label: 'Partial', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Percent },
    PAID: { label: 'Paid', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    OVERDUE: { label: 'Overdue', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: AlertTriangle },
    CANCELLED: { label: 'Cancelled', color: 'text-stone-400', bg: 'bg-stone-50 border-stone-200', icon: XCircle },
    WRITTEN_OFF: { label: 'Written Off', color: 'text-stone-400', bg: 'bg-stone-50 border-stone-200', icon: Ban },
}

const TYPE_LABELS: Record<string, string> = {
    SALES: 'Sales', PURCHASE: 'Purchase', CREDIT_NOTE: 'Credit Note',
    DEBIT_NOTE: 'Debit Note', PROFORMA: 'Pro Forma',
}

const SUB_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    RETAIL: { label: 'Retail', color: 'text-stone-600', bg: 'bg-stone-50 border-stone-200' },
    WHOLESALE: { label: 'Wholesale', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    CONSIGNEE: { label: 'Consignee', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
    STANDARD: { label: 'Standard', color: 'text-stone-600', bg: 'bg-stone-50 border-stone-200' },
}

export default function InvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([])
    const [dashboard, setDashboard] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [paymentOpen, setPaymentOpen] = useState(false)
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
    const [activeTab, setActiveTab] = useState<ActiveTab>('ALL')
    const [subTypeFilter, setSubTypeFilter] = useState('')
    const [tradeSubTypesEnabled, setTradeSubTypesEnabled] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [sortKey, setSortKey] = useState<SortKey>('issue_date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [inv, dash, settings] = await Promise.all([getInvoices(), getInvoiceDashboard(), getTradeSubTypeSettings()])
            setInvoices(Array.isArray(inv) ? inv : [])
            setDashboard(dash)
            setTradeSubTypesEnabled(settings?.enabled ?? false)
        } catch {
            setInvoices([])
            toast.error("Failed to load invoices")
        } finally { setLoading(false) }
    }

    // ── Sorting ──────────────────────────────────────────────────
    function toggleSort(key: SortKey) {
        if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc') }
        else { setSortKey(key); setSortDir('asc') }
    }
    function SortIcon({ col }: { col: SortKey }) {
        if (sortKey !== col) return <ArrowUpDown size={12} className="text-stone-300 ml-1 inline" />
        return sortDir === 'asc'
            ? <ArrowUp size={12} className="text-emerald-600 ml-1 inline" />
            : <ArrowDown size={12} className="text-emerald-600 ml-1 inline" />
    }

    const filtered = useMemo(() => {
        let list = invoices
            .filter(i => activeTab === 'ALL' || i.status === activeTab)
            .filter(i => !subTypeFilter || i.sub_type === subTypeFilter)
            .filter(i =>
                !searchQuery ||
                (i.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (i.contact_display || i.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase())
            )
        list.sort((a, b) => {
            let cmp = 0
            if (sortKey === 'total_amount') cmp = Number(a.total_amount || 0) - Number(b.total_amount || 0)
            else cmp = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''))
            return sortDir === 'asc' ? cmp : -cmp
        })
        return list
    }, [invoices, activeTab, subTypeFilter, searchQuery, sortKey, sortDir])

    // ── Actions ──────────────────────────────────────────────────
    async function handleSend(inv: any) {
        startTransition(async () => {
            try {
                await sendInvoice(inv.id)
                toast.success("Invoice sent")
                loadData()
            } catch (err: any) { toast.error(err.message || "Failed to send") }
        })
    }

    async function handleCancel(inv: any) {
        startTransition(async () => {
            try {
                await cancelInvoice(inv.id)
                toast.success("Invoice cancelled")
                loadData()
            } catch (err: any) { toast.error(err.message || "Failed to cancel") }
        })
    }

    async function handleRecordPayment(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!selectedInvoice) return
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                await recordInvoicePayment(selectedInvoice.id, { amount: Number(fd.get('amount')) })
                toast.success("Payment recorded")
                setPaymentOpen(false)
                setSelectedInvoice(null)
                loadData()
            } catch (err: any) { toast.error(err.message || "Failed to record payment") }
        })
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                await createInvoice({
                    type: fd.get('type') as string,
                    sub_type: fd.get('sub_type') as string || undefined,
                    contact: Number(fd.get('contact')),
                    issue_date: fd.get('issue_date') as string,
                    payment_terms: fd.get('payment_terms') as string,
                    display_mode: fd.get('display_mode') as string || 'TTC',
                    notes: fd.get('notes') as string || undefined,
                })
                toast.success("Invoice created")
                setCreateOpen(false)
                loadData()
            } catch (err: any) { toast.error(err.message || "Failed to create invoice") }
        })
    }

    const tabs = [
        { key: "ALL" as ActiveTab, label: "All Invoices", count: invoices.length },
        { key: "DRAFT" as ActiveTab, label: "Draft", count: dashboard?.draft || 0 },
        { key: "SENT" as ActiveTab, label: "Sent", count: dashboard?.sent || 0 },
        { key: "OVERDUE" as ActiveTab, label: "Overdue", count: dashboard?.overdue || 0 },
        { key: "PAID" as ActiveTab, label: "Paid", count: dashboard?.paid || 0 },
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
                    <h1 className="text-4xl font-bold text-stone-900 font-serif tracking-tight">Invoices</h1>
                    <p className="text-stone-500 font-medium mt-1">Create, manage, and track sales &amp; purchase invoices</p>
                </div>
                <Button onClick={() => setCreateOpen(true)} className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-all">
                    <Plus size={16} /> New Invoice
                </Button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Outstanding</p>
                                <p className="text-2xl font-bold text-blue-900 mt-1">
                                    {(dashboard?.total_outstanding || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-200/60 flex items-center justify-center">
                                <DollarSign size={22} className="text-blue-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Overdue</p>
                                <p className="text-2xl font-bold text-red-900 mt-1">
                                    {(dashboard?.total_overdue || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-red-200/60 flex items-center justify-center">
                                <AlertTriangle size={22} className="text-red-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Collected</p>
                                <p className="text-2xl font-bold text-emerald-900 mt-1">
                                    {(dashboard?.total_received || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <TrendingUp size={22} className="text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-stone-50 to-stone-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total</p>
                                <p className="text-3xl font-bold text-stone-900 mt-1">{dashboard?.total_invoices || 0}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-stone-200/60 flex items-center justify-center">
                                <Receipt size={22} className="text-stone-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Create Invoice Dialog ────────────────────────── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><FileText size={20} /> New Invoice</DialogTitle>
                        <DialogDescription>Create a new sales or purchase invoice.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Type *</label>
                            <select name="type" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                <option value="SALES">Sales Invoice</option>
                                <option value="PURCHASE">Purchase Invoice</option>
                                <option value="CREDIT_NOTE">Credit Note</option>
                                <option value="DEBIT_NOTE">Debit Note</option>
                                <option value="PROFORMA">Pro Forma</option>
                            </select>
                        </div>
                        {tradeSubTypesEnabled && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Sub-Type</label>
                                <select name="sub_type" className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                    <option value="RETAIL">Retail</option>
                                    <option value="WHOLESALE">Wholesale</option>
                                    <option value="CONSIGNEE">Consignee</option>
                                    <option value="STANDARD">Standard (Purchase)</option>
                                </select>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Contact ID *</label>
                            <Input name="contact" type="number" required placeholder="Customer/Supplier ID" className="rounded-xl" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Issue Date *</label>
                            <Input name="issue_date" type="date" required className="rounded-xl" defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Payment Terms *</label>
                            <select name="payment_terms" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                <option value="NET_30">Net 30 Days</option>
                                <option value="NET_15">Net 15 Days</option>
                                <option value="NET_7">Net 7 Days</option>
                                <option value="IMMEDIATE">Immediate</option>
                                <option value="NET_45">Net 45 Days</option>
                                <option value="NET_60">Net 60 Days</option>
                                <option value="NET_90">Net 90 Days</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Display Mode</label>
                            <select name="display_mode" className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                <option value="TTC">TTC (Incl. Tax)</option>
                                <option value="HT">HT (Excl. Tax)</option>
                            </select>
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Notes</label>
                            <Input name="notes" placeholder="Optional notes..." className="rounded-xl" />
                        </div>
                        <div className="col-span-2 flex justify-end gap-2 pt-3 border-t">
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isPending} className="rounded-xl gap-2">
                                {isPending ? "Creating..." : <><Plus size={14} /> Create</>}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Record Payment Dialog ────────────────────────── */}
            <Dialog open={paymentOpen} onOpenChange={(v) => { setPaymentOpen(v); if (!v) setSelectedInvoice(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><CreditCard size={20} /> Record Payment</DialogTitle>
                        <DialogDescription>
                            {selectedInvoice && (
                                <>Invoice {selectedInvoice.invoice_number || `#${selectedInvoice.id}`} — Balance: <strong>{Number(selectedInvoice.balance_due).toLocaleString()}</strong></>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Amount *</label>
                            <Input name="amount" type="number" step="0.01" min="0.01"
                                max={selectedInvoice?.balance_due}
                                defaultValue={selectedInvoice?.balance_due}
                                required className="rounded-xl" />
                        </div>
                        <div className="flex justify-end gap-2 pt-3 border-t">
                            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isPending} className="rounded-xl gap-2">
                                {isPending ? "Recording..." : <><CreditCard size={14} /> Record</>}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Tabs + Table ────────────────────────────────── */}
            <Card className="rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-stone-50/50">
                    <div className="flex gap-1 flex-wrap">
                        {tabs.map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl transition-all ${activeTab === tab.key
                                    ? "bg-white shadow-sm font-semibold text-stone-900" : "text-stone-400 hover:text-stone-600"}`}>
                                {tab.label}
                                {tab.count > 0 && (
                                    <span className={`ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-500'}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                    {tradeSubTypesEnabled && (
                        <div className="flex gap-1 flex-wrap">
                            {[{ key: '', label: 'All Types' }, { key: 'RETAIL', label: 'Retail' }, { key: 'WHOLESALE', label: 'Wholesale' }, { key: 'CONSIGNEE', label: 'Consignee' }, { key: 'STANDARD', label: 'Standard' }].map(st => (
                                <button key={st.key} onClick={() => setSubTypeFilter(st.key)}
                                    className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${subTypeFilter === st.key
                                        ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}>
                                    {st.label}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <Input placeholder="Search invoices..." value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl text-sm h-9 bg-white" />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow className="bg-stone-50/30">
                            <TableHead className="text-xs font-bold uppercase text-stone-400">Invoice #</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400">Type</TableHead>
                            {tradeSubTypesEnabled && <TableHead className="text-xs font-bold uppercase text-stone-400">Sub-Type</TableHead>}
                            <TableHead className="text-xs font-bold uppercase text-stone-400">Contact</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 cursor-pointer select-none" onClick={() => toggleSort('issue_date')}>
                                Issue Date <SortIcon col="issue_date" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 cursor-pointer select-none" onClick={() => toggleSort('due_date')}>
                                Due Date <SortIcon col="due_date" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right cursor-pointer select-none" onClick={() => toggleSort('total_amount')}>
                                Total <SortIcon col="total_amount" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Balance</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-center cursor-pointer select-none" onClick={() => toggleSort('status')}>
                                Status <SortIcon col="status" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-center">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((inv: any) => {
                            const sc = STATUS_CONFIG[inv.status] || STATUS_CONFIG.DRAFT
                            const StatusIcon = sc.icon
                            return (
                                <TableRow key={inv.id} className="hover:bg-stone-50/50 transition-colors">
                                    <TableCell className="font-mono text-sm font-semibold text-stone-700">
                                        {inv.invoice_number || `DRAFT-${inv.id}`}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs font-medium text-stone-500">{TYPE_LABELS[inv.type] || inv.type}</span>
                                    </TableCell>
                                    {tradeSubTypesEnabled && (
                                        <TableCell>
                                            {inv.sub_type && SUB_TYPE_CONFIG[inv.sub_type] ? (
                                                <Badge variant="outline" className={`rounded-md text-[10px] font-semibold border ${SUB_TYPE_CONFIG[inv.sub_type].bg} ${SUB_TYPE_CONFIG[inv.sub_type].color}`}>
                                                    {SUB_TYPE_CONFIG[inv.sub_type].label}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-stone-300">—</span>
                                            )}
                                        </TableCell>
                                    )}
                                    <TableCell className="text-sm font-medium text-stone-700">
                                        {inv.contact_display || inv.contact_name || `#${inv.contact}`}
                                    </TableCell>
                                    <TableCell className="text-sm text-stone-600">{inv.issue_date || '—'}</TableCell>
                                    <TableCell className={`text-sm ${inv.is_overdue ? 'text-red-600 font-semibold' : 'text-stone-600'}`}>
                                        {inv.due_date || '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-stone-800">
                                        {Number(inv.total_amount || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className={`text-right font-semibold ${Number(inv.balance_due) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        {Number(inv.balance_due || 0).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`gap-1 rounded-lg border ${sc.bg} ${sc.color} font-semibold text-[11px]`}>
                                            <StatusIcon size={12} /> {sc.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {inv.status === 'DRAFT' && (
                                                <>
                                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600 hover:bg-blue-50"
                                                        onClick={() => handleSend(inv)} disabled={isPending}>
                                                        <Send size={13} />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-stone-400 hover:bg-stone-50"
                                                        onClick={() => handleCancel(inv)} disabled={isPending}>
                                                        <XCircle size={13} />
                                                    </Button>
                                                </>
                                            )}
                                            {['SENT', 'PARTIAL_PAID', 'OVERDUE'].includes(inv.status) && (
                                                <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                                                    onClick={() => { setSelectedInvoice(inv); setPaymentOpen(true) }} disabled={isPending}>
                                                    <CreditCard size={13} />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={9} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                                            <FileText size={28} className="text-stone-300" />
                                        </div>
                                        <p className="font-semibold text-stone-600">No invoices found</p>
                                        <p className="text-sm text-stone-400 mt-1">Create your first invoice to get started</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
                {filtered.length > 0 && (
                    <div className="px-5 py-3 border-t bg-stone-50/30 flex items-center justify-between text-sm text-stone-500">
                        <span>{filtered.length} invoice{filtered.length !== 1 ? 's' : ''} shown</span>
                        <span className="font-semibold text-stone-700">
                            Total: {filtered.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0).toLocaleString()}
                        </span>
                    </div>
                )}
            </Card>
        </div>
    )
}
