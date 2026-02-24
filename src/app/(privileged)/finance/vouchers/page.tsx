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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    FileText, Plus, Search, ArrowRightLeft, ArrowDownLeft, ArrowUpRight,
    CheckCircle2, Clock, Send, Receipt, Pencil, Trash2,
    Lock, Unlock, ShieldCheck, History
} from "lucide-react"
import { TypicalListView, ColumnDef, LifecycleConfig } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from "@/lib/utils/currency"
// Sort logic handled by TypicalListView
const LIFECYCLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    OPEN: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock },
    LOCKED: { label: 'Locked', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Lock },
    VERIFIED: { label: 'Verified', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: ShieldCheck },
    CONFIRMED: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
}
export default function VouchersPage() {
    const { fmt } = useCurrency()
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
    const [sortKey, setSortKey] = useState<string>('date')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const settings = useListViewSettings('fin_vouchers', {
        columns: ['id', 'date', 'reference', 'description', 'amount', 'postedDate', 'status', 'actions'],
        pageSize: 25, sortKey: 'date', sortDir: 'desc'
    })
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
    function openEdit(v: Voucher) { setEditVoucher(v); setVoucherType(v.voucher_type); setDialogOpen(true) }
    function openCreate() { setEditVoucher(null); setVoucherType('TRANSFER'); setDialogOpen(true) }
    function closeDialog() { setDialogOpen(false); setEditVoucher(null) }
    // ─── TypicalListView Configuration ──────────────────────────
    const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
        TRANSFER: { icon: ArrowRightLeft, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
        RECEIPT: { icon: ArrowDownLeft, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
        PAYMENT: { icon: ArrowUpRight, color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
    }
    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'date',
            label: 'Date',
            sortable: true,
            render: (v: Voucher) => <span className="text-sm text-stone-600">{v.date}</span>
        },
        {
            key: 'voucher_type',
            label: 'Type',
            sortable: true,
            render: (v: Voucher) => {
                const tc = typeConfig[v.voucher_type] || typeConfig.TRANSFER
                const TypeIcon = tc.icon
                return (
                    <Badge variant="outline" className={`gap-1 rounded-lg border ${tc.bg} ${tc.color} font-semibold text-[11px]`}>
                        <TypeIcon size={12} /> {v.voucher_type}
                    </Badge>
                )
            }
        },
        {
            key: 'reference',
            label: 'Reference',
            sortable: true,
            render: (v: Voucher) => <span className="font-mono text-sm text-stone-500">{v.reference || "—"}</span>
        },
        {
            key: 'description',
            label: 'Description',
            render: (v: Voucher) => <span className="text-sm text-stone-600 max-w-[200px] truncate block">{v.description || "—"}</span>
        },
        {
            key: 'amount',
            label: 'Amount',
            align: 'right',
            sortable: true,
            render: (v: Voucher) => (
                <div className="text-right">
                    <div className="font-bold text-stone-900">{fmt(v.amount)}</div>
                    <div className="text-[10px] text-stone-400 font-bold">{v.credit_account?.name || v.debit_account?.name}</div>
                </div>
            )
        }
    ], [fmt])
    const lifecycle: LifecycleConfig<Voucher> = {
        getStatus: (v: Voucher) => {
            const cfg = LIFECYCLE_CONFIG[v.lifecycle_status] || LIFECYCLE_CONFIG.OPEN
            const StatusIcon = cfg.icon
            return (
                <Badge className={`gap-1.5 px-3 py-1 rounded-lg border shadow-sm ${cfg.bg} ${cfg.color} font-black text-[10px] uppercase tracking-widest`}>
                    <StatusIcon size={12} /> {cfg.label}
                </Badge>
            )
        }
    }
    // ─── Filtering ──────────────────────
    const filteredVouchers = useMemo(() => {
        return vouchers
            .filter(v => activeTab === "ALL" || v.voucher_type === activeTab)
            .filter(v =>
                !searchQuery ||
                (v.reference || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (v.description || "").toLowerCase().includes(searchQuery.toLowerCase())
            )
    }, [vouchers, activeTab, searchQuery])
    const activeType = editVoucher ? editVoucher.voucher_type : voucherType
    const actions: ActionsConfig<Voucher> = {
        onEdit: (v) => v.lifecycle_status === 'OPEN' ? openEdit(v) : undefined,
        onDelete: (v) => v.lifecycle_status === 'OPEN' ? setDeleteConfirm(v.id) : undefined,
        extra: (v) => {
            const isOpen = v.lifecycle_status === 'OPEN'
            const isLocked = v.lifecycle_status === 'LOCKED'
            const isVerified = v.lifecycle_status === 'VERIFIED'
            const isConfirmed = v.lifecycle_status === 'CONFIRMED'
            return (
                <div className="flex items-center gap-1">
                    {isOpen && !v.is_posted && (
                        <Button size="sm" variant="outline" onClick={() => handleLock(v.id)} disabled={isPending}
                            className="rounded-xl gap-1 text-amber-700 border-amber-200 hover:bg-amber-50 h-8 text-xs font-semibold">
                            <Lock size={12} /> Lock
                        </Button>
                    )}
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
                    {isVerified && (
                        <Button size="sm" variant="outline" onClick={() => handleConfirm(v.id)} disabled={isPending}
                            className="rounded-xl gap-1 text-purple-700 border-purple-200 hover:bg-purple-50 h-8 text-xs font-semibold">
                            <CheckCircle2 size={12} /> Confirm
                        </Button>
                    )}
                    {isConfirmed && !v.is_posted && (
                        <Button size="sm" variant="outline" onClick={() => handlePost(v.id)} disabled={isPending}
                            className="rounded-xl gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8 text-xs font-semibold">
                            <Send size={12} /> Post
                        </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => showHistory(v.id)}
                        className="h-8 w-8 p-0 text-stone-400 hover:text-stone-600" title="History">
                        <History size={14} />
                    </Button>
                </div>
            )
        }
    }
    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-6">
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
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-amber-50 text-amber-600 border-amber-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Node: Active
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <Receipt size={12} /> Lifecycle Hub
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-amber-600 flex items-center justify-center shadow-2xl shadow-amber-200">
                            <Receipt size={32} className="text-white" />
                        </div>
                        Financial <span className="text-amber-600">Vouchers</span>
                    </h1>
                </div>
                <Button onClick={openCreate} className="h-12 px-6 rounded-2xl bg-amber-600 text-white font-bold flex items-center gap-2 hover:bg-amber-700 transition-all shadow-lg shadow-amber-200">
                    <Plus size={18} /> New Voucher
                </Button>
            </header>
            {/* ─── Create / Edit Dialog ────────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); else setDialogOpen(true) }}>
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
                            <Badge variant="outline" className={`gap-1 rounded-lg border ${typeConfig[editVoucher.voucher_type]?.bg} ${typeConfig[editVoucher.voucher_type]?.color} font-semibold`}>
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
                            <Button type="submit" disabled={isPending} className="rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white border-0">
                                {isPending ? (editVoucher ? "Saving..." : "Creating...") : <><Send size={14} /> {editVoucher ? "Save Changes" : "Create Voucher"}</>}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            {/* ─── Delete Confirmation Dialog ───────────────────────── */}
            <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
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
            <Dialog open={commentDialog !== null} onOpenChange={(open) => { if (!open) setCommentDialog(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Unlock size={20} /> Unlock Voucher</DialogTitle>
                        <DialogDescription>Provide a reason for unlocking this voucher.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); commentDialog && handleUnlock(commentDialog.id, fd.get('comment') as string) }} className="space-y-4">
                        <Input name="comment" required placeholder="Reason for unlocking..." className="rounded-xl" />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setCommentDialog(null)} className="rounded-xl">Cancel</Button>
                            <Button type="submit" disabled={isPending} className="rounded-xl gap-2 bg-amber-600 hover:bg-amber-700 text-white border-0">
                                {isPending ? "Unlocking..." : <><Unlock size={14} /> Unlock</>}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
            {/* ─── History Dialog ───────────────────────────────────── */}
            <Dialog open={historyDialog !== null} onOpenChange={(open) => { if (!open) setHistoryDialog(null) }}>
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
                                        by {h.performed_by || 'System'} · {h.performed_at ? new Date(h.performed_at).toLocaleString() : '—'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
            {/* Dashboard Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center">
                                <FileText size={24} />
                            </div>
                            <Badge variant="outline" className="bg-slate-50 border-0 font-black text-[10px]">
                                TOTAL
                            </Badge>
                        </div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">TOTAL VOUCHERS</p>
                        <h2 className="text-3xl font-black text-gray-900 mt-1">{vouchers.length}</h2>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-blue-600 overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-white">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/50 text-blue-100 flex items-center justify-center">
                                <Clock size={24} />
                            </div>
                            <Badge variant="outline" className="bg-blue-500/30 text-blue-100 border-0 font-black text-[10px]">
                                OPEN
                            </Badge>
                        </div>
                        <p className="text-[11px] font-black text-blue-200 uppercase tracking-widest">PENDING ACTION</p>
                        <h2 className="text-3xl font-black text-white mt-1">{vouchers.filter(v => v.lifecycle_status === "OPEN").length}</h2>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Lock size={24} />
                            </div>
                            <Badge variant="outline" className="bg-amber-50 border-0 font-black text-[10px]">
                                LOCKED
                            </Badge>
                        </div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">LOCKED ENTRIES</p>
                        <h2 className="text-3xl font-black text-amber-600 mt-1">{vouchers.filter(v => v.lifecycle_status === "LOCKED").length}</h2>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <CheckCircle2 size={24} />
                            </div>
                            <Badge variant="outline" className="bg-emerald-50 border-0 font-black text-[10px]">
                                POSTED
                            </Badge>
                        </div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">POSTED TO LEDGER</p>
                        <h2 className="text-3xl font-black text-emerald-600 mt-1">{vouchers.filter(v => v.is_posted).length}</h2>
                    </CardContent>
                </Card>
            </div>
            <TypicalListView
                title="Voucher Entries"
                data={filteredVouchers}
                loading={loading}
                getRowId={(v) => v.id}
                columns={columns}
                lifecycle={lifecycle}
                actions={actions}
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
                            {[
                                { key: "ALL", label: "All", icon: FileText },
                                { key: "TRANSFER", label: "Transfers", icon: ArrowRightLeft },
                                { key: "RECEIPT", label: "Receipts", icon: ArrowDownLeft },
                                { key: "PAYMENT", label: "Payments", icon: ArrowUpRight },
                            ].map(tab => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.key
                                return (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 text-xs rounded-lg transition-all ${isActive
                                            ? "bg-white shadow-sm font-bold text-amber-600"
                                            : "text-stone-400 hover:text-stone-600"
                                            }`}
                                    >
                                        <Icon size={12} />
                                        {tab.label}
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
                                className="pl-9 h-11 rounded-xl text-sm border-0 bg-stone-100 focus-visible:ring-amber-500/30"
                            />
                        </div>
                    </div>
                }
            />
        </div>
    )
}
