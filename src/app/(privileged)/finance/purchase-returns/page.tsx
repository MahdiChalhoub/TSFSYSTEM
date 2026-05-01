'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { PurchaseReturn } from '@/types/erp'
import { getPurchaseReturns, completePurchaseReturn } from "@/app/actions/pos/returns"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    RotateCcw, Search, Clock, CheckCircle2, XCircle,
    ArrowUpDown, ArrowUp, ArrowDown, Package, Send
} from "lucide-react"

type SortKey = 'return_date' | 'status'
type SortDir = 'asc' | 'desc'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
    PENDING: { label: 'Pending', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: Clock },
    COMPLETED: { label: 'Completed', color: 'text-app-success', bg: 'bg-app-success-bg border-app-success', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: XCircle },
}

export default function PurchaseReturnsPage() {
    const [returns, setReturns] = useState<PurchaseReturn[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [sortKey, setSortKey] = useState<SortKey>('return_date')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const [confirmId, setConfirmId] = useState<number | null>(null)
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const r = await getPurchaseReturns()
            setReturns(Array.isArray(r) ? r : [])
        } catch {
            setReturns([])
            toast.error("Failed to load purchase returns")
        } finally { setLoading(false) }
    }

    async function handleComplete(id: number) {
        startTransition(async () => {
            try {
                await completePurchaseReturn(id)
                toast.success("Purchase return completed — stock removed & GL posted")
                setConfirmId(null)
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to complete return")
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
            ? <ArrowUp size={12} className="text-app-success ml-1 inline" />
            : <ArrowDown size={12} className="text-app-success ml-1 inline" />
    }

    const filtered = useMemo(() => {
        let list = returns.filter(r =>
            !searchQuery ||
            (r.supplier_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (r.reason || "").toLowerCase().includes(searchQuery.toLowerCase())
        )
        list.sort((a, b) => {
            let cmp = String(a[sortKey] || '').localeCompare(String(b[sortKey] || ''))
            return sortDir === 'asc' ? cmp : -cmp
        })
        return list
    }, [returns, searchQuery, sortKey, sortDir])

    const pending = returns.filter(r => r.status === 'PENDING').length
    const completed = returns.filter(r => r.status === 'COMPLETED').length

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            <div>
                <h1 className="text-4xl font-bold text-app-foreground font-serif tracking-tight">Purchase Returns</h1>
                <p className="text-app-muted-foreground font-medium mt-1">Manage returns to suppliers and reversing entries</p>
            </div>

            {/* Confirm Dialog */}
            <Dialog open={confirmId !== null} onOpenChange={(open) => { if (!open) setConfirmId(null) }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-app-success"><Send size={20} /> Complete Purchase Return</DialogTitle>
                        <DialogDescription>This will remove items from inventory and post a reversing journal entry.</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2 pt-3">
                        <Button variant="outline" onClick={() => setConfirmId(null)} className="rounded-xl">Cancel</Button>
                        <Button onClick={() => confirmId && handleComplete(confirmId)} disabled={isPending} className="rounded-xl gap-2">
                            {isPending ? "Processing..." : <><Send size={14} /> Complete</>}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-stone-50 to-stone-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Total</p>
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
                                <Clock size={22} className="text-app-warning" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Completed</p>
                                <p className="text-3xl font-bold text-emerald-900 mt-1">{completed}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <CheckCircle2 size={22} className="text-app-success" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Table */}
            <Card className="rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center justify-between bg-app-surface/50">
                    <div className="flex items-center gap-2">
                        <Package size={16} className="text-app-muted-foreground" />
                        <span className="font-semibold text-app-foreground text-sm">Purchase Returns</span>
                    </div>
                    <div className="relative w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <Input placeholder="Search supplier..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 rounded-xl text-sm h-9 bg-app-surface" />
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-app-surface/30">
                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground cursor-pointer select-none" onClick={() => toggleSort('return_date')}>
                                Date <SortIcon col="return_date" />
                            </TableHead>
                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Order</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Supplier</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-app-muted-foreground">Reason</TableHead>
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
                                    <TableCell className="text-sm text-app-muted-foreground">{r.original_order_ref || `#${r.original_order}`}</TableCell>
                                    <TableCell className="text-sm font-medium text-app-foreground">{r.supplier_name || `#${r.supplier}`}</TableCell>
                                    <TableCell className="text-sm text-app-muted-foreground max-w-[200px] truncate">{r.reason || "—"}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`gap-1 rounded-lg border ${sc.bg} ${sc.color} font-semibold text-[11px]`}>
                                            <StatusIcon size={12} /> {sc.label}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {r.status === 'PENDING' && (
                                            <Button size="sm" variant="outline" onClick={() => setConfirmId(r.id)} disabled={isPending}
                                                className="rounded-xl gap-1 text-app-success border-app-success hover:bg-app-success-bg h-8 text-xs font-semibold">
                                                <Send size={12} /> Complete
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-app-surface-2 flex items-center justify-center">
                                            <RotateCcw size={28} className="text-app-faint" />
                                        </div>
                                        <p className="font-semibold text-app-muted-foreground">No purchase returns found</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
}
