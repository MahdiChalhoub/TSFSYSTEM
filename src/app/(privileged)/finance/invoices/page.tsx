"use client"

import React, { useState, useEffect, useMemo, useTransition } from "react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from "@/lib/utils/currency"
import {
    FileText, Plus, DollarSign, AlertTriangle,
    TrendingUp, Receipt, Send, CreditCard, Search,
    Ban, ClipboardList
} from "lucide-react"
import AttachmentManager from "@/components/common/AttachmentManager"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogDescription
} from "@/components/ui/dialog"

// Actions
import {
    getInvoices,
    getInvoiceDashboard,
    sendInvoice,
    recordInvoicePayment,
    cancelInvoice,
    createInvoice
} from "@/app/actions/finance/invoices"
import { getTradeSubTypeSettings } from "@/app/actions/settings/trade-settings"

type ActiveTab = 'ALL' | 'DRAFT' | 'SENT' | 'OVERDUE' | 'PAID'

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }> = {
    DRAFT: { label: 'Draft', variant: 'default' },
    SENT: { label: 'Sent', variant: 'default' },
    PARTIAL_PAID: { label: 'Partial', variant: 'warning' },
    PAID: { label: 'Paid', variant: 'success' },
    OVERDUE: { label: 'Overdue', variant: 'danger' },
    CANCELLED: { label: 'Cancelled', variant: 'default' },
    WRITTEN_OFF: { label: 'Written Off', variant: 'default' },
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
    const { fmt } = useCurrency()
    const [invoices, setInvoices] = useState<any[]>([])
    const [contacts, setContacts] = useState<any[]>([])
    const [contactSearch, setContactSearch] = useState('')
    const [dashboard, setDashboard] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [createOpen, setCreateOpen] = useState(false)
    const [paymentOpen, setPaymentOpen] = useState(false)
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
    const [activeTab, setActiveTab] = useState<ActiveTab>('ALL')
    const [subTypeFilter, setSubTypeFilter] = useState('')
    const [tradeSubTypesEnabled, setTradeSubTypesEnabled] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [isPending, startTransition] = useTransition()
    const settings = useListViewSettings('fin_invoices', {
        columns: ['invoice_number', 'type', 'sub_type', 'contact_name', 'issue_date', 'due_date', 'total_amount', 'balance_due'],
        pageSize: 25, sortKey: 'issue_date', sortDir: 'desc'
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const { erpFetch } = await import('@/lib/erp-api')
            const [inv, dash, settings, contactList] = await Promise.all([
                getInvoices(), getInvoiceDashboard(), getTradeSubTypeSettings(),
                erpFetch('contacts/').catch(() => [])
            ])
            setInvoices(Array.isArray(inv) ? inv : [])
            setDashboard(dash)
            setTradeSubTypesEnabled(settings?.enabled ?? false)
            setContacts(Array.isArray(contactList) ? contactList : contactList?.results || [])
        } catch {
            setInvoices([])
            toast.error("Failed to load invoices")
        } finally { setLoading(false) }
    }

    const filtered = useMemo(() => {
        return invoices
            .filter(i => activeTab === 'ALL' || i.status === activeTab)
            .filter(i => !subTypeFilter || i.sub_type === subTypeFilter)
            .filter(i =>
                !searchQuery ||
                (i.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (i.contact_display || i.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase())
            )
    }, [invoices, activeTab, subTypeFilter, searchQuery])

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

    const columns: ColumnDef<any>[] = [
        {
            key: 'invoice_number',
            label: 'Invoice #',
            sortable: true,
            render: (inv) => <span className="font-mono font-semibold text-stone-700">{inv.invoice_number || `DRAFT-${inv.id}`}</span>
        },
        {
            key: 'type',
            label: 'Type',
            render: (inv) => <span className="text-xs font-medium text-stone-500">{TYPE_LABELS[inv.type] || inv.type}</span>
        },
    ]

    if (tradeSubTypesEnabled) {
        columns.push({
            key: 'sub_type',
            label: 'Sub-Type',
            render: (inv) => inv.sub_type && SUB_TYPE_CONFIG[inv.sub_type] ? (
                <Badge variant="outline" className={`rounded-md text-[10px] font-semibold border ${SUB_TYPE_CONFIG[inv.sub_type].bg} ${SUB_TYPE_CONFIG[inv.sub_type].color}`}>
                    {SUB_TYPE_CONFIG[inv.sub_type].label}
                </Badge>
            ) : <span className="text-xs text-stone-300">—</span>
        })
    }

    columns.push(
        {
            key: 'contact_name',
            label: 'Contact',
            sortable: true,
            render: (inv) => inv.contact_display || inv.contact_name || `#${inv.contact}`
        },
        {
            key: 'issue_date',
            label: 'Issue Date',
            sortable: true,
        },
        {
            key: 'due_date',
            label: 'Due Date',
            sortable: true,
            render: (inv) => <span className={inv.is_overdue ? 'text-red-600 font-semibold' : ''}>{inv.due_date || '—'}</span>
        },
        {
            key: 'total_amount',
            label: 'Total',
            align: 'right',
            sortable: true,
            render: (inv) => <span className="font-semibold text-stone-800">{fmt(inv.total_amount)}</span>
        },
        {
            key: 'balance_due',
            label: 'Balance',
            align: 'right',
            render: (inv) => <span className={`font-semibold ${Number(inv.balance_due) > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmt(inv.balance_due)}</span>
        }
    )

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
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Node: Billing Active
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <TrendingUp size={12} /> Revenue Velocity
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-stone-900 flex items-center justify-center shadow-2xl shadow-stone-200">
                            <FileText size={32} className="text-white" />
                        </div>
                        Invoice <span className="text-indigo-600">Suite</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <Button onClick={() => setCreateOpen(true)} className="h-12 px-6 rounded-2xl bg-indigo-600 text-white font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                        <Plus size={18} /> New Invoice
                    </Button>
                </div>
            </header>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Outstanding</p>
                                <p className="text-2xl font-bold text-blue-900 mt-1">
                                    {fmt(dashboard?.total_outstanding || 0)}
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
                                    {fmt(dashboard?.total_overdue || 0)}
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
                                    {fmt(dashboard?.total_received || 0)}
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
                            <label className="text-xs font-bold text-stone-500 uppercase">Contact *</label>
                            <input
                                type="text"
                                placeholder="Search customer or supplier..."
                                value={contactSearch}
                                onChange={e => setContactSearch(e.target.value)}
                                className="w-full px-3 py-2 border rounded-xl bg-background text-sm mb-1 focus:outline-none focus:border-stone-400"
                            />
                            <select name="contact" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm" size={4}>
                                {contacts
                                    .filter(c => !contactSearch ||
                                        (c.name || c.company_name || '').toLowerCase().includes(contactSearch.toLowerCase())
                                    )
                                    .slice(0, 30)
                                    .map((c: any) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name || c.company_name || `Contact #${c.id}`} [{c.type}]
                                        </option>
                                    ))
                                }
                                {contacts.length === 0 && (
                                    <option disabled>No contacts loaded</option>
                                )}
                            </select>
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
                                <>Invoice {selectedInvoice.invoice_number || `#${selectedInvoice.id}`} — Balance: <strong>{fmt(selectedInvoice.balance_due)}</strong></>
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

            {/* ─── Tabs + Table (TypicalListView) ──────────────── */}
            <TypicalListView
                title="Commercial Invoices"
                data={filtered}
                loading={loading}
                getRowId={(i) => i.id}
                columns={columns}
                actions={{
                    extra: (inv) => (
                        <>
                            {inv.status === 'DRAFT' && (
                                <>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600 hover:bg-blue-50"
                                        onClick={() => handleSend(inv)} disabled={isPending}>
                                        <Send size={13} />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-stone-400 hover:bg-stone-50"
                                        onClick={() => handleCancel(inv)} disabled={isPending}>
                                        <Ban size={13} />
                                    </Button>
                                </>
                            )}
                            {['SENT', 'PARTIAL_PAID', 'OVERDUE'].includes(inv.status) && (
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-600 hover:bg-emerald-50"
                                    onClick={() => { setSelectedInvoice(inv); setPaymentOpen(true) }} disabled={isPending}>
                                    <CreditCard size={13} />
                                </Button>
                            )}
                        </>
                    )
                }}
                lifecycle={{
                    getStatus: (i) => ({
                        label: STATUS_CONFIG[i.status]?.label || i.status,
                        variant: (STATUS_CONFIG[i.status]?.variant as any) || 'default'
                    })
                }}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="rounded-[2.5rem] border-0 shadow-sm overflow-hidden bg-white"
                headerExtra={
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl w-full md:w-auto">
                            {(['ALL', 'DRAFT', 'SENT', 'OVERDUE', 'PAID'] as ActiveTab[]).map(tab => {
                                const isActive = activeTab === tab
                                return (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs rounded-lg transition-all ${isActive
                                            ? "bg-white shadow-sm font-bold text-indigo-600"
                                            : "text-stone-400 hover:text-stone-600"
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                )
                            })}
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 h-11 rounded-xl text-sm border-0 bg-stone-100 focus-visible:ring-indigo-500/30"
                            />
                        </div>
                    </div>
                }
            />
        </div>
    )
}
