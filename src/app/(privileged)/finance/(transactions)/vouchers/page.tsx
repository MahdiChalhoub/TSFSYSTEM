'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { Voucher, FinancialAccount, FinancialEvent, LifecycleHistoryEntry } from '@/types/erp'
import {
    getVouchers, createVoucher, updateVoucher, postVoucher, deleteVoucher,
    lockVoucher, unlockVoucher, verifyVoucher, confirmVoucher, getVoucherHistory,
    VoucherInput, VoucherUpdateInput
} from "@/app/actions/finance/vouchers"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { getFinancialEvents } from "@/app/actions/finance/financial-events"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    FileText, Plus, Search, ArrowRightLeft, ArrowDownLeft, ArrowUpRight,
    CheckCircle2, Clock, Send, Receipt, Pencil, Trash2,
    ArrowUpDown, ArrowUp, ArrowDown, Lock, Unlock, ShieldCheck, History
} from "lucide-react"

type SortKey = 'date' | 'voucher_type' | 'reference' | 'amount' | 'lifecycle_status'
type SortDir = 'asc' | 'desc'

const LIFECYCLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentType<any> }> = {
    OPEN: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock },
    LOCKED: { label: 'Locked', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Lock },
    VERIFIED: { label: 'Verified', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: ShieldCheck },
    CONFIRMED: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
}

export default function VouchersPage() {
    const [vouchers, setVouchers] = useState<Voucher[]>([])
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [events, setEvents] = useState<FinancialEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editVoucher, setEditVoucher] = useState<Voucher | null>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
    const [commentDialog, setCommentDialog] = useState<{ id: number; action: string } | null>(null)
    const [historyDialog, setHistoryDialog] = useState<LifecycleHistoryEntry[] | null>(null)
    const [voucherType, setVoucherType] = useState<'TRANSFER' | 'RECEIPT' | 'PAYMENT'>('TRANSFER')
    const [activeTab, setActiveTab] = useState<string>("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [sortKey, setSortKey] = useState<SortKey>('date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [v, accs, evts] = await Promise.all([
                getVouchers(),
                getFinancialAccounts(),
                getFinancialEvents()
            ])
            setVouchers(Array.isArray(v) ? v : [])
            setAccounts(Array.isArray(accs) ? accs : [])
            setEvents(Array.isArray(evts) ? evts : [])
        } catch {
            setVouchers([]); setAccounts([]); setEvents([])
            toast.error("Failed to load vouchers")
        } finally {
            setLoading(false)
        }
    }

    // ─── Create / Edit Handler ────────────────────────────────────
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)

        startTransition(async () => {
            try {
                if (editVoucher) {
                    const updateData: VoucherUpdateInput = {
                        amount: Number(fd.get("amount")),
                        date: fd.get("date") as string,
                        description: fd.get("description") as string || undefined,
                        source_account_id: fd.get("source_account_id") ? Number(fd.get("source_account_id")) : undefined,
                        destination_account_id: fd.get("destination_account_id") ? Number(fd.get("destination_account_id")) : undefined,
                        financial_event_id: fd.get("financial_event_id") ? Number(fd.get("financial_event_id")) : undefined,
                    }
                    await updateVoucher(editVoucher.id, updateData)
                    toast.success("Voucher updated successfully")
                } else {
                    const data: VoucherInput = {
                        voucher_type: voucherType,
                        amount: Number(fd.get("amount")),
                        date: fd.get("date") as string,
                        description: fd.get("description") as string || undefined,
                        source_account_id: fd.get("source_account_id") ? Number(fd.get("source_account_id")) : undefined,
                        destination_account_id: fd.get("destination_account_id") ? Number(fd.get("destination_account_id")) : undefined,
                        financial_event_id: fd.get("financial_event_id") ? Number(fd.get("financial_event_id")) : undefined,
                    }
                    await createVoucher(data)
                    toast.success("Voucher created successfully")
                }
                closeDialog()
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || `Failed to ${editVoucher ? 'update' : 'create'} voucher`)
            }
        })
    }

    // ─── Lifecycle Handlers ───────────────────────────────────────
    async function handleLock(id: number) {
        startTransition(async () => {
            try { await lockVoucher(id); toast.success("Voucher locked"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to lock") }
        })
    }
    async function handleUnlock(id: number, comment: string) {
        startTransition(async () => {
            try { await unlockVoucher(id, comment); toast.success("Voucher unlocked"); loadData(); setCommentDialog(null) }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to unlock") }
        })
    }
    async function handleVerify(id: number) {
        startTransition(async () => {
            try { await verifyVoucher(id); toast.success("Voucher verified"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to verify") }
        })
    }
    async function handleConfirm(id: number) {
        startTransition(async () => {
            try { await confirmVoucher(id); toast.success("Voucher confirmed"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to confirm") }
        })
    }
    async function handlePost(id: number) {
        startTransition(async () => {
            try { await postVoucher(id); toast.success("Voucher posted to ledger"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to post voucher") }
        })
    }
    async function handleDelete(id: number) {
        startTransition(async () => {
            try { await deleteVoucher(id); toast.success("Voucher deleted"); setDeleteConfirm(null); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to delete voucher") }
        })
    }
    async function showHistory(id: number) {
        try {
            const history = await getVoucherHistory(id)
            setHistoryDialog(Array.isArray(history) ? history : [])
        } catch { toast.error("Failed to load history") }
    }

    function openEdit(v: Record<string, any>) { setEditVoucher(v as any); setVoucherType(v.voucher_type); setDialogOpen(true) }
    function openCreate() { setEditVoucher(null); setVoucherType('TRANSFER'); setDialogOpen(true) }
    function closeDialog() { setDialogOpen(false); setEditVoucher(null) }

    // ─── Sorting ──────────────────────────────────────────────────
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

    // ─── Filtering + Sorting ──────────────────────
    const filteredVouchers = useMemo(() => {
        let list = vouchers
            .filter(v => activeTab === "ALL" || v.voucher_type === activeTab)
            .filter(v =>
                !searchQuery ||
                (v.reference || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (v.description || "").toLowerCase().includes(searchQuery.toLowerCase())
            )

        list.sort((a, b) => {
            let cmp = 0
            const av = a[sortKey], bv = b[sortKey]
            if (sortKey === 'amount') {
                cmp = Number(av || 0) - Number(bv || 0)
            } else {
                cmp = String(av || '').localeCompare(String(bv || ''))
            }
            return sortDir === 'asc' ? cmp : -cmp
        })
        return list
    }, [vouchers, activeTab, searchQuery, sortKey, sortDir])

    const tabs = [
        { key: "ALL", label: "All", icon: FileText },
        { key: "TRANSFER", label: "Transfers", icon: ArrowRightLeft },
        { key: "RECEIPT", label: "Receipts", icon: ArrowDownLeft },
        { key: "PAYMENT", label: "Payments", icon: ArrowUpRight },
    ]

    const typeConfig: Record<string, { icon: React.ComponentType<any>; color: string; bg: string }> = {
        TRANSFER: { icon: ArrowRightLeft, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
        RECEIPT: { icon: ArrowDownLeft, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
        PAYMENT: { icon: ArrowUpRight, color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
    }

    const activeType = editVoucher ? editVoucher.voucher_type : voucherType

    // ─── Loading Skeleton ─────────────────────────────────────────
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
                    <h1 className="text-4xl font-bold text-stone-900 font-serif tracking-tight">Vouchers</h1>
                    <p className="text-stone-500 font-medium mt-1">Manage transfers, receipts, and payment vouchers</p>
                </div>
                <Button onClick={openCreate} className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-all">
                    <Plus size={16} /> New Voucher
                </Button>
            </div>

            {/* ─── Create / Edit Dialog ────────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={(open: boolean) => { if (!open) closeDialog(); else setDialogOpen(true) }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editVoucher ? <><Pencil size={20} /> Edit Voucher <span className="text-xs font-mono text-stone-400 ml-2">{editVoucher.reference}</span></> : <><Receipt size={20} /> Create Voucher</>}
                        </DialogTitle>
                        <DialogDescription>
                            {editVoucher ? "Modify the voucher details below. Only OPEN vouchers can be edited." : "Select the voucher type and fill in the details below."}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Type Selector — only for new vouchers */}
                    {!editVoucher && (
                        <div className="flex gap-2 pt-2">
                            {(["TRANSFER", "RECEIPT", "PAYMENT"] as const).map(t => {
                                const cfg = typeConfig[t]
                                const Icon = cfg.icon
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => setVoucherType(t)}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-all ${voucherType === t
                                            ? `${cfg.bg} ${cfg.color} shadow-sm`
                                            : "bg-stone-50 text-stone-400 border-stone-100 hover:bg-stone-100"
                                            }`}
                                    >
                                        <Icon size={14} />
                                        {t === "TRANSFER" ? "Transfer" : t === "RECEIPT" ? "Receipt" : "Payment"}
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {/* Locked type badge for editing */}
                    {editVoucher && (
                        <div className="pt-2">
                            <Badge variant="outline" className={`gap-1 rounded-lg border ${typeConfig[editVoucher.voucher_type || '']?.bg} ${typeConfig[editVoucher.voucher_type || '']?.color} font-semibold`}>
                                {editVoucher.voucher_type}
                            </Badge>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Amount *</label>
                            <Input name="amount" type="number" step="0.01" min="0.01" required placeholder="1,000.00" className="rounded-xl" defaultValue={editVoucher?.amount || ""} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Date *</label>
                            <Input name="date" type="date" required className="rounded-xl" defaultValue={editVoucher?.date || ""} />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-xs font-bold text-stone-500 uppercase">Description</label>
                            <Input name="description" placeholder="Optional description..." className="rounded-xl" defaultValue={editVoucher?.description || ""} />
                        </div>

                        {(activeType === "TRANSFER" || activeType === "PAYMENT") && (
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Source Account *</label>
                                <select name="source_account_id" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm" defaultValue={editVoucher?.source_account_id || editVoucher?.source_account || ""}>
                                    <option value="">Select source...</option>
                                    {accounts.map((a: Record<string, any>) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}
                        {(activeType === "TRANSFER" || activeType === "RECEIPT") && (
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Destination Account *</label>
                                <select name="destination_account_id" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm" defaultValue={editVoucher?.destination_account_id || editVoucher?.destination_account || ""}>
                                    <option value="">Select destination...</option>
                                    {accounts.map((a: Record<string, any>) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}
                        {(activeType === "RECEIPT" || activeType === "PAYMENT") && (
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Financial Event</label>
                                <select name="financial_event_id" className="w-full px-3 py-2 border rounded-xl bg-background text-sm" defaultValue={editVoucher?.financial_event_id || editVoucher?.financial_event || ""}>
                                    <option value="">Select event...</option>
                                    {events.map((e: Record<string, any>) => (
                                        <option key={e.id} value={e.id}>
                                            {(e.event_type || e.eventType || "").replace(/_/g, " ")} — {Number(e.amount).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="col-span-2 flex justify-end gap-2 pt-3 border-t">
                            <Button type="button" variant="outline" onClick={closeDialog} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isPending} className="rounded-xl gap-2">
                                {isPending ? (editVoucher ? "Saving..." : "Creating...") : <><Send size={14} /> {editVoucher ? "Save Changes" : "Create Voucher"}</>}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Delete Confirmation Dialog ───────────────────────── */}
            <Dialog open={deleteConfirm !== null} onOpenChange={(open: boolean) => { if (!open) setDeleteConfirm(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-700"><Trash2 size={20} /> Delete Voucher</DialogTitle>
                        <DialogDescription>This action is permanent and cannot be undone. Are you sure you want to delete this voucher?</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 pt-3">
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="rounded-xl">Cancel</Button>
                        <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} disabled={isPending} className="rounded-xl gap-2">
                            {isPending ? "Deleting..." : <><Trash2 size={14} /> Delete</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ─── Unlock Comment Dialog ────────────────────────────── */}
            <Dialog open={commentDialog !== null} onOpenChange={(open: boolean) => { if (!open) setCommentDialog(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Unlock size={20} /> Unlock Voucher</DialogTitle>
                        <DialogDescription>Provide a reason for unlocking this voucher.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); commentDialog && handleUnlock(commentDialog.id, fd.get('comment') as string) }} className="space-y-4">
                        <Input name="comment" required placeholder="Reason for unlocking..." className="rounded-xl" />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setCommentDialog(null)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isPending} className="rounded-xl gap-2">
                                {isPending ? "Unlocking..." : <><Unlock size={14} /> Unlock</>}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── History Dialog ───────────────────────────────────── */}
            <Dialog open={historyDialog !== null} onOpenChange={(open: boolean) => { if (!open) setHistoryDialog(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><History size={20} /> Lifecycle History</DialogTitle>
                        <DialogDescription>Complete audit trail for this voucher.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-80 overflow-y-auto space-y-3">
                        {historyDialog?.length === 0 && <p className="text-center text-stone-400 py-6">No history yet</p>}
                        {historyDialog?.map((h: Record<string, any>, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-stone-50 border">
                                <div className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center shrink-0">
                                    <Clock size={14} className="text-stone-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm text-stone-800">{h.action}</p>
                                    {h.comment && <p className="text-xs text-stone-500 mt-0.5">{h.comment}</p>}
                                    <p className="text-xs text-stone-400 mt-1">
                                        by {h.performed_by || 'System'} · {new Date(h.performed_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-stone-50 to-stone-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total</p>
                                <p className="text-3xl font-bold text-stone-900 mt-1">{vouchers.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-stone-200/60 flex items-center justify-center">
                                <FileText size={22} className="text-stone-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Open</p>
                                <p className="text-3xl font-bold text-blue-900 mt-1">{vouchers.filter(v => v.lifecycle_status === "OPEN").length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-200/60 flex items-center justify-center">
                                <Clock size={22} className="text-blue-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Locked</p>
                                <p className="text-3xl font-bold text-amber-900 mt-1">{vouchers.filter(v => v.lifecycle_status === "LOCKED").length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-200/60 flex items-center justify-center">
                                <Lock size={22} className="text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Posted</p>
                                <p className="text-3xl font-bold text-emerald-900 mt-1">{vouchers.filter(v => v.is_posted).length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <CheckCircle2 size={22} className="text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs + Search + Table */}
            <Card className="rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-stone-50/50">
                    <div className="flex gap-1">
                        {tabs.map(tab => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl transition-all ${activeTab === tab.key
                                        ? "bg-white shadow-sm font-semibold text-stone-900"
                                        : "text-stone-400 hover:text-stone-600"
                                        }`}
                                >
                                    <Icon size={13} />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <Input
                            placeholder="Search reference or description..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 rounded-xl text-sm h-9 bg-white"
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-stone-50/30">
                            <TableHead className="text-xs font-bold uppercase text-stone-400 cursor-pointer select-none" onClick={() => toggleSort('date')}>
                                Date <SortIcon col="date" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 cursor-pointer select-none" onClick={() => toggleSort('voucher_type')}>
                                Type <SortIcon col="voucher_type" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 cursor-pointer select-none" onClick={() => toggleSort('reference')}>
                                Reference <SortIcon col="reference" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400">Description</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right cursor-pointer select-none" onClick={() => toggleSort('amount')}>
                                Amount <SortIcon col="amount" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-center cursor-pointer select-none" onClick={() => toggleSort('lifecycle_status')}>
                                Status <SortIcon col="lifecycle_status" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredVouchers.map((v: Record<string, any>) => {
                            const tc = typeConfig[v.voucher_type] || typeConfig.TRANSFER
                            const lc = LIFECYCLE_CONFIG[v.lifecycle_status] || LIFECYCLE_CONFIG.OPEN
                            const TypeIcon = tc.icon
                            const LcIcon = lc.icon
                            const isOpen = v.lifecycle_status === 'OPEN'
                            const isLocked = v.lifecycle_status === 'LOCKED'
                            const isVerified = v.lifecycle_status === 'VERIFIED'
                            const isConfirmed = v.lifecycle_status === 'CONFIRMED'
                            return (
                                <TableRow key={v.id} className="hover:bg-stone-50/50 transition-colors group">
                                    <TableCell className="text-sm text-stone-600">{v.date}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`gap-1 rounded-lg border ${tc.bg} ${tc.color} font-semibold text-[11px]`}>
                                            <TypeIcon size={12} /> {v.voucher_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm text-stone-500">{v.reference || "—"}</TableCell>
                                    <TableCell className="text-sm text-stone-600 max-w-[200px] truncate">{v.description || "—"}</TableCell>
                                    <TableCell className="text-right font-semibold text-stone-800">{Number(v.amount).toLocaleString()}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Badge variant="outline" className={`gap-1 rounded-lg border ${lc.bg} ${lc.color} font-semibold text-[11px]`}>
                                                <LcIcon size={12} /> {lc.label}
                                            </Badge>
                                            {v.is_posted && (
                                                <Badge variant="outline" className="gap-1 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-700 font-semibold text-[11px]">
                                                    <Send size={10} /> Posted
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {/* OPEN: Edit, Lock, Delete */}
                                            {isOpen && !v.is_posted && (
                                                <>
                                                    <Button size="sm" variant="ghost" onClick={() => openEdit(v)}
                                                        className="h-8 w-8 p-0 text-stone-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Edit">
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleLock(v.id)} disabled={isPending}
                                                        className="rounded-xl gap-1 text-amber-700 border-amber-200 hover:bg-amber-50 h-8 text-xs font-semibold">
                                                        <Lock size={12} /> Lock
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm(v.id)}
                                                        className="h-8 w-8 p-0 text-stone-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </>
                                            )}
                                            {/* LOCKED: Unlock, Verify */}
                                            {isLocked && (
                                                <>
                                                    <Button size="sm" variant="outline" onClick={() => setCommentDialog({ id: v.id, action: 'unlock' })} disabled={isPending}
                                                        className="rounded-xl gap-1 text-stone-600 border-stone-200 hover:bg-stone-50 h-8 text-xs font-semibold">
                                                        <Unlock size={12} /> Unlock
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleVerify(v.id)} disabled={isPending}
                                                        className="rounded-xl gap-1 text-purple-700 border-purple-200 hover:bg-purple-50 h-8 text-xs font-semibold">
                                                        <ShieldCheck size={12} /> Verify
                                                    </Button>
                                                </>
                                            )}
                                            {/* VERIFIED: Confirm */}
                                            {isVerified && (
                                                <Button size="sm" variant="outline" onClick={() => handleConfirm(v.id)} disabled={isPending}
                                                    className="rounded-xl gap-1 text-purple-700 border-purple-200 hover:bg-purple-50 h-8 text-xs font-semibold">
                                                    <CheckCircle2 size={12} /> Confirm
                                                </Button>
                                            )}
                                            {/* CONFIRMED: Post */}
                                            {isConfirmed && !v.is_posted && (
                                                <Button size="sm" variant="outline" onClick={() => handlePost(v.id)} disabled={isPending}
                                                    className="rounded-xl gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8 text-xs font-semibold">
                                                    <Send size={12} /> Post
                                                </Button>
                                            )}
                                            {v.is_posted && (
                                                <span className="text-xs text-emerald-600 font-medium italic">✓ Posted</span>
                                            )}
                                            {/* History — always visible */}
                                            <Button size="sm" variant="ghost" onClick={() => showHistory(v.id)}
                                                className="h-8 w-8 p-0 text-stone-400 hover:text-stone-600 opacity-0 group-hover:opacity-100 transition-opacity" title="History">
                                                <History size={14} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {filteredVouchers.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                                            <FileText size={28} className="text-stone-300" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-stone-600">No vouchers found</p>
                                            <p className="text-sm text-stone-400 mt-1">Create your first voucher to get started</p>
                                        </div>
                                        <Button variant="outline" onClick={openCreate} className="rounded-xl gap-2 mt-2">
                                            <Plus size={14} /> New Voucher
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Table Footer */}
                {filteredVouchers.length > 0 && (
                    <div className="px-5 py-3 border-t bg-stone-50/30 flex items-center justify-between text-sm text-stone-500">
                        <span>{filteredVouchers.length} voucher{filteredVouchers.length !== 1 ? 's' : ''} shown</span>
                        <span className="font-semibold text-stone-700">
                            Total: {filteredVouchers.reduce((s, v) => s + Number(v.amount || 0), 0).toLocaleString()}
                        </span>
                    </div>
                )}
            </Card>
        </div>
    )
}
