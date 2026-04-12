// @ts-nocheck
'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { SalesReturn } from '@/types/erp'
import { getSalesReturns, approveSalesReturn, cancelSalesReturn, getCreditNotes } from "@/app/actions/pos/returns"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    RotateCcw, Search, Clock, CheckCircle2, XCircle, Ban,
    ArrowUpDown, ArrowUp, ArrowDown, FileText, CreditCard,
    ShieldCheck, Package
} from "lucide-react"

type ActiveTab = 'RETURNS' | 'CREDIT_NOTES'
type SortKey = 'return_date' | 'status' | 'reason'
type SortDir = 'asc' | 'desc'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: Record<string, any> }> = {
    PENDING: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
    APPROVED: { label: 'Approved', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
    COMPLETED: { label: 'Completed', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: ShieldCheck },
    CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
}

export default function SalesReturnsPage() {
    const [returns, setReturns] = useState<SalesReturn[]>([])
    const [creditNotes, setCreditNotes] = useState<Record<string, unknown>[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<ActiveTab>('RETURNS')
    const [searchQuery, setSearchQuery] = useState("")
    const [sortKey, setSortKey] = useState<SortKey>('return_date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [confirmDialog, setConfirmDialog] = useState<{ id: number; action: 'approve' | 'cancel' } | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [r, cn] = await Promise.all([getSalesReturns(), getCreditNotes()])
            setReturns(Array.isArray(r) ? r : [])
            setCreditNotes(Array.isArray(cn) ? cn : [])
        } catch {
            setReturns([]); setCreditNotes([])
            toast.error("Failed to load returns")
        } finally { setLoading(false) }
    }

    async function handleAction(id: number, action: 'approve' | 'cancel') {
        startTransition(async () => {
            try {
                if (action === 'approve') {
                    await approveSalesReturn(id)
                    toast.success("Return approved — stock restocked & credit note created")
                } else {
                    await cancelSalesReturn(id)
                    toast.success("Return cancelled")
                }
                setConfirmDialog(null)
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || `Failed to ${action} return`)
            }
        })
    }

    function toggleSort(key: SortKey) {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        else { setSortKey(key); setSortDir('asc') }
    }
    function SortIcon({ col }: { col: SortKey }) {
        if (sortKey !== col) return <ArrowUpDown size={12} className="text-app-faint ml-1 inline" />
        return sortDir === 'asc'
            ? <ArrowUp size={12} className="text-emerald-600 ml-1 inline" />
            : <ArrowDown size={12} className="text-emerald-600 ml-1 inline" />
    }

    const filtered = useMemo(() => {
        let list = returns.filter(r =>
            !searchQuery ||
            (r.reference || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.reason || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.customer_name || "").toLowerCase().includes(searchQuery.toLowerCase())
        )
        list.sort((a, b) => {
            let cmp = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''))
            return sortDir === 'asc' ? cmp : -cmp
        })
        return list
    }, [returns, searchQuery, sortKey, sortDir])

    const pending = returns.filter(r => r.status === 'PENDING').length
    const approved = returns.filter(r => r.status === 'APPROVED').length

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
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
            <div>
                <h1 className="text-4xl font-bold text-app-foreground font-serif tracking-tight">Sales Returns</h1>
                <p className="text-app-muted-foreground font-medium mt-1">Manage customer returns, approvals, and credit notes</p>
            </div>

            {/* Confirm Dialog */}
            <Dialog open={confirmDialog !== null} onOpenChange={(open) => { if (!open) setConfirmDialog(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className={`flex items-center gap-2 ${confirmDialog?.action === 'approve' ? 'text-emerald-700' : 'text-red-700'}`}>
                            {confirmDialog?.action === 'approve' ? <><CheckCircle2 size={20} /> Approve Return</> : <><Ban size={20} /> Cancel Return</>}
                        </DialogTitle>
                        <DialogDescription>
                            {confirmDialog?.action === 'approve'
                                ? "This will restock items, create a credit note, and post a reversing journal entry."
                                : "This will permanently cancel the return request."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 pt-3">
                        <Button variant="outline" onClick={() => setConfirmDialog(null)} className="rounded-xl">Cancel</Button>
                        <Button variant={confirmDialog?.action === 'approve' ? 'default' : 'destructive'}
                            onClick={() => confirmDialog && handleAction(confirmDialog.id, confirmDialog.action)}
                            disabled={isPending} className="rounded-xl gap-2">
                            {isPending ? "Processing..." : confirmDialog?.action === 'approve' ? <><CheckCircle2 size={14} /> Approve</> : <><Ban size={14} /> Cancel Return</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-stone-50 to-stone-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Total Returns</p>
                                <p className="text-3xl font-bold text-app-foreground mt-1">{returns.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-app-surface-2/60 flex items-center justify-center">
                                <RotateCcw size={22} className="text-app-muted-foreground" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending</p>
                                <p className="text-3xl font-bold text-amber-900 mt-1">{pending}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-200/60 flex items-center justify-center">
                                <Clock size={22} className="text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Approved</p>
                                <p className="text-3xl font-bold text-emerald-900 mt-1">{approved}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <CheckCircle2 size={22} className="text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Credit Notes</p>
                                <p className="text-3xl font-bold text-blue-900 mt-1">{creditNotes.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-200/60 flex items-center justify-center">
                                <CreditCard size={22} className="text-blue-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs + Content */}
            <Card className="rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-app-surface/50">
                    <div className="flex gap-1">
                        <button onClick={() => setActiveTab('RETURNS')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl transition-all ${activeTab === 'RETURNS' ? "bg-app-surface shadow-sm font-semibold text-app-foreground" : "text-app-muted-foreground hover:text-app-muted-foreground"}`}>
                            <Package size={13} /> Returns
                        </button>
                        <button onClick={() => setActiveTab('CREDIT_NOTES')}
                            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-xl transition-all ${activeTab === 'CREDIT_NOTES' ? "bg-app-surface shadow-sm font-semibold text-app-foreground" : "text-app-muted-foreground hover:text-app-muted-foreground"}`}>
                            <CreditCard size={13} /> Credit Notes
                        </button>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl text-sm h-9 bg-app-surface" />
                    </div>
                </div>

                {activeTab === 'RETURNS' && (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-app-surface/30">
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('return_date')}>
                                    Date <SortIcon col="return_date" />
                                </TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Reference</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Order</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Customer</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('reason')}>
                                    Reason <SortIcon col="reason" />
                                </TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-center cursor-pointer select-none" onClick={() => toggleSort('status')}>
                                    Status <SortIcon col="status" />
                                </TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((r: Record<string, any>) => {
                                const sc = STATUS_CONFIG[r.status] || STATUS_CONFIG.PENDING
                                const StatusIcon = sc.icon
                                return (
                                    <TableRow key={r.id} className="hover:bg-app-surface/50 transition-colors group">
                                        <TableCell className="text-sm text-app-muted-foreground">{r.return_date}</TableCell>
                                        <TableCell className="font-mono text-sm text-app-muted-foreground">{r.reference || "—"}</TableCell>
                                        <TableCell className="text-sm text-app-muted-foreground">{r.original_order_ref || `#${r.original_order}`}</TableCell>
                                        <TableCell className="text-sm font-medium text-app-foreground">{r.customer_name || "—"}</TableCell>
                                        <TableCell className="text-sm text-app-muted-foreground max-w-[200px] truncate">{r.reason || "—"}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`gap-1 rounded-lg border ${sc.bg} ${sc.color} font-semibold text-[11px]`}>
                                                <StatusIcon size={12} /> {sc.label}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {r.status === 'PENDING' && (
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button size="sm" variant="outline" onClick={() => setConfirmDialog({ id: r.id, action: 'approve' })} disabled={isPending}
                                                        className="rounded-xl gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-8 text-xs font-semibold">
                                                        <CheckCircle2 size={12} /> Approve
                                                    </Button>
                                                    <Button size="sm" variant="outline" onClick={() => setConfirmDialog({ id: r.id, action: 'cancel' })} disabled={isPending}
                                                        className="rounded-xl gap-1 text-red-700 border-red-200 hover:bg-red-50 h-8 text-xs font-semibold">
                                                        <Ban size={12} /> Cancel
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                            {filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-full bg-app-surface-2 flex items-center justify-center">
                                                <RotateCcw size={28} className="text-app-faint" />
                                            </div>
                                            <p className="font-semibold text-app-muted-foreground">No sales returns found</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}

                {activeTab === 'CREDIT_NOTES' && (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-app-surface/30">
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Credit #</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Date</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Customer</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-right">Amount</TableHead>
                                <TableHead className="text-xs font-bold uppercase text-app-muted-foreground text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {creditNotes.filter(cn => !searchQuery || (cn.credit_number || "").toLowerCase().includes(searchQuery.toLowerCase())).map((cn: Record<string, any>) => (
                                <TableRow key={cn.id} className="hover:bg-app-surface/50 transition-colors">
                                    <TableCell className="font-mono text-sm font-semibold text-app-foreground">{cn.credit_number}</TableCell>
                                    <TableCell className="text-sm text-app-muted-foreground">{cn.date}</TableCell>
                                    <TableCell className="text-sm font-medium text-app-foreground">{cn.customer_name || `#${cn.customer}`}</TableCell>
                                    <TableCell className="text-right font-semibold text-app-foreground">{Number(cn.amount).toLocaleString()}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className="gap-1 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 font-semibold text-[11px]">
                                            <FileText size={12} /> {cn.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {creditNotes.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-16 h-16 rounded-full bg-app-surface-2 flex items-center justify-center">
                                                <CreditCard size={28} className="text-app-faint" />
                                            </div>
                                            <p className="font-semibold text-app-muted-foreground">No credit notes yet</p>
                                            <p className="text-sm text-app-muted-foreground">Credit notes are auto-created when returns are approved</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </Card>
        </div>
    )
}
