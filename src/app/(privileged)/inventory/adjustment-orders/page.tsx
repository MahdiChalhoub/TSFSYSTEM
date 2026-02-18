'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { AdjustmentOrder, Warehouse, Product, LifecycleHistoryEntry } from '@/types/erp'
import {
    getAdjustmentOrders, createAdjustmentOrder, addAdjustmentLine, removeAdjustmentLine,
    postAdjustmentOrder, lockAdjustmentOrder, unlockAdjustmentOrder, verifyAdjustmentOrder,
    getAdjustmentOrderHistory, AdjustmentOrderInput
} from "@/app/actions/inventory/adjustment-orders"
import { erpFetch } from "@/lib/erp-api"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    ClipboardList, Plus, Search, Lock, Unlock, ShieldCheck, CheckCircle2,
    Send, ChevronDown, ChevronUp, Trash2, Package, Clock, AlertTriangle,
    ArrowDownUp, History
} from "lucide-react"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: Record<string, any> }> = {
    OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: Clock },
    LOCKED: { label: 'Locked', color: 'bg-amber-100 text-amber-700', icon: Lock },
    VERIFIED: { label: 'Verified', color: 'bg-purple-100 text-purple-700', icon: ShieldCheck },
    CONFIRMED: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
}

export default function AdjustmentOrdersPage() {
    const [orders, setOrders] = useState<AdjustmentOrder[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [lineDialogOpen, setLineDialogOpen] = useState(false)
    const [activeOrder, setActiveOrder] = useState<number | null>(null)
    const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
    const [historyDialog, setHistoryDialog] = useState<LifecycleHistoryEntry[] | null>(null)
    const [activeTab, setActiveTab] = useState("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [isPending, startTransition] = useTransition()
    const [commentDialog, setCommentDialog] = useState<{ action: string; orderId: number } | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [ordersRes, whRes, prodRes] = await Promise.all([
                getAdjustmentOrders(),
                erpFetch('inventory/warehouses/'),
                erpFetch('inventory/products/')
            ])
            setOrders(Array.isArray(ordersRes) ? ordersRes : ordersRes?.results || [])
            setWarehouses(Array.isArray(whRes) ? whRes : whRes?.results || [])
            setProducts(Array.isArray(prodRes) ? prodRes : prodRes?.results || [])
        } catch {
            toast.error("Failed to load data")
        } finally {
            setLoading(false)
        }
    }

    // ─── Create Order ───────────────────────────────────────────
    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                const data: AdjustmentOrderInput = {
                    date: fd.get("date") as string,
                    warehouse: Number(fd.get("warehouse")),
                    reason: fd.get("reason") as string || undefined,
                    notes: fd.get("notes") as string || undefined,
                }
                await createAdjustmentOrder(data)
                toast.success("Adjustment order created")
                setDialogOpen(false)
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to create order")
            }
        })
    }

    // ─── Add Line ───────────────────────────────────────────────
    async function handleAddLine(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!activeOrder) return
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                await addAdjustmentLine(activeOrder, {
                    product: Number(fd.get("product")),
                    qty_adjustment: Number(fd.get("qty_adjustment")),
                    amount_adjustment: fd.get("amount_adjustment") ? Number(fd.get("amount_adjustment")) : undefined,
                    reason: fd.get("reason") as string || undefined,
                })
                toast.success("Line added")
                setLineDialogOpen(false)
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to add line")
            }
        })
    }

    // ─── Lifecycle Actions ──────────────────────────────────────
    async function handleLock(id: number) {
        startTransition(async () => {
            try { await lockAdjustmentOrder(id); toast.success("Order locked"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to lock") }
        })
    }

    async function handleUnlock(id: number, comment: string) {
        startTransition(async () => {
            try { await unlockAdjustmentOrder(id, comment); toast.success("Order unlocked"); loadData(); setCommentDialog(null) }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to unlock") }
        })
    }

    async function handleVerify(id: number) {
        startTransition(async () => {
            try { await verifyAdjustmentOrder(id); toast.success("Verification advanced"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to verify") }
        })
    }

    async function handlePost(id: number) {
        startTransition(async () => {
            try { await postAdjustmentOrder(id); toast.success("Order posted — stock adjusted"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to post") }
        })
    }

    async function handleRemoveLine(orderId: number, lineId: number) {
        startTransition(async () => {
            try { await removeAdjustmentLine(orderId, lineId); toast.success("Line removed"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to remove line") }
        })
    }

    async function showHistory(id: number) {
        try {
            const history = await getAdjustmentOrderHistory(id)
            setHistoryDialog(Array.isArray(history) ? history : [])
        } catch { toast.error("Failed to load history") }
    }

    // ─── Filtering ──────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = orders
        if (activeTab !== "ALL") list = list.filter(o => o.lifecycle_status === activeTab)
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            list = list.filter(o =>
                o.reference?.toLowerCase().includes(q) ||
                o.reason?.toLowerCase().includes(q) ||
                o.warehouse_name?.toLowerCase().includes(q)
            )
        }
        return list
    }, [orders, activeTab, searchQuery])

    // ─── Summary Stats ─────────────────────────────────────────
    const totalOrders = orders.length
    const openCount = orders.filter(o => o.lifecycle_status === 'OPEN').length
    const lockedCount = orders.filter(o => o.lifecycle_status === 'LOCKED').length
    const postedCount = orders.filter(o => o.is_posted).length

    const tabs = [
        { key: "ALL", label: "All", count: orders.length },
        { key: "OPEN", label: "Open", count: openCount },
        { key: "LOCKED", label: "Locked", count: lockedCount },
        { key: "CONFIRMED", label: "Confirmed", count: orders.filter(o => o.lifecycle_status === 'CONFIRMED').length },
    ]

    if (loading) return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-72 mt-2" /></div>
                <Skeleton className="h-10 w-40" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-96 rounded-xl" />
        </div>
    )

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* ─── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-serif font-bold tracking-tight flex items-center gap-2">
                        <ArrowDownUp className="h-6 w-6 text-blue-600" /> Stock Adjustment Orders
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Create and manage stock adjustment orders with verification pipeline</p>
                </div>
                <Button className="gap-2" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" /> New Adjustment
                </Button>
            </div>

            {/* ─── Summary Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-blue-600/80 uppercase tracking-wider">Total Orders</p>
                                <p className="text-2xl font-bold text-blue-900 mt-1">{totalOrders}</p>
                            </div>
                            <div className="bg-blue-200/60 rounded-lg p-2.5"><ClipboardList className="h-5 w-5 text-blue-700" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-amber-600/80 uppercase tracking-wider">Open</p>
                                <p className="text-2xl font-bold text-amber-900 mt-1">{openCount}</p>
                            </div>
                            <div className="bg-amber-200/60 rounded-lg p-2.5"><Clock className="h-5 w-5 text-amber-700" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-orange-600/80 uppercase tracking-wider">Locked</p>
                                <p className="text-2xl font-bold text-orange-900 mt-1">{lockedCount}</p>
                            </div>
                            <div className="bg-orange-200/60 rounded-lg p-2.5"><Lock className="h-5 w-5 text-orange-700" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-emerald-600/80 uppercase tracking-wider">Posted</p>
                                <p className="text-2xl font-bold text-emerald-900 mt-1">{postedCount}</p>
                            </div>
                            <div className="bg-emerald-200/60 rounded-lg p-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-700" /></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Tabs + Search ──────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {tabs.map(t => (
                        <button key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t.label} <span className="ml-1 text-xs opacity-60">({t.count})</span>
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-64" />
                </div>
            </div>

            {/* ─── Table ──────────────────────────────────────────── */}
            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-muted rounded-full p-4 mb-4"><ClipboardList className="h-8 w-8 text-muted-foreground" /></div>
                            <h3 className="font-semibold text-lg">No adjustment orders</h3>
                            <p className="text-sm text-muted-foreground mt-1">Create your first stock adjustment order to get started</p>
                            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Adjustment</Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Lines</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(order => {
                                    const isExpanded = expandedOrder === order.id
                                    const statusCfg = STATUS_CONFIG[order.lifecycle_status ?? 'OPEN'] || STATUS_CONFIG.OPEN
                                    const StatusIcon = statusCfg.icon
                                    return (
                                        <>
                                            <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                                                <TableCell>
                                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                </TableCell>
                                                <TableCell className="font-mono text-sm font-medium">{order.reference || `ADJ-${order.id}`}</TableCell>
                                                <TableCell className="text-sm">{order.date}</TableCell>
                                                <TableCell className="text-sm">{order.warehouse_name || `WH #${order.warehouse}`}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{order.reason || '—'}</TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="text-xs">{order.lines?.length || 0} items</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                                                        <StatusIcon className="h-3 w-3" /> {statusCfg.label}
                                                    </span>
                                                    {order.is_posted && <Badge className="ml-1 bg-emerald-600 text-[10px]">Posted</Badge>}
                                                </TableCell>
                                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {order.lifecycle_status === 'OPEN' && (
                                                            <>
                                                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setActiveOrder(order.id); setLineDialogOpen(true) }}>
                                                                    <Plus className="h-3 w-3" /> Line
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleLock(order.id)} disabled={isPending}>
                                                                    <Lock className="h-3 w-3" /> Lock
                                                                </Button>
                                                            </>
                                                        )}
                                                        {order.lifecycle_status === 'LOCKED' && (
                                                            <>
                                                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setCommentDialog({ action: 'unlock', orderId: order.id })} disabled={isPending}>
                                                                    <Unlock className="h-3 w-3" /> Unlock
                                                                </Button>
                                                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-purple-700" onClick={() => handleVerify(order.id)} disabled={isPending}>
                                                                    <ShieldCheck className="h-3 w-3" /> Verify
                                                                </Button>
                                                            </>
                                                        )}
                                                        {order.lifecycle_status === 'CONFIRMED' && !order.is_posted && (
                                                            <Button size="sm" className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handlePost(order.id)} disabled={isPending}>
                                                                <Send className="h-3 w-3" /> Post
                                                            </Button>
                                                        )}
                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => showHistory(order.id)} title="History">
                                                            <History className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow key={`${order.id}-lines`}>
                                                    <TableCell colSpan={8} className="bg-muted/20 p-4">
                                                        {(order.lines?.length ?? 0) > 0 ? (
                                                            <div className="rounded-lg border overflow-hidden">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="bg-muted/50">
                                                                            <TableHead className="text-xs">Product</TableHead>
                                                                            <TableHead className="text-xs text-right">Qty Adjustment</TableHead>
                                                                            <TableHead className="text-xs text-right">Amount</TableHead>
                                                                            <TableHead className="text-xs">Reason</TableHead>
                                                                            {order.lifecycle_status === 'OPEN' && <TableHead className="text-xs w-10"></TableHead>}
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {(order.lines ?? []).map((line: Record<string, any>) => (
                                                                            <TableRow key={line.id}>
                                                                                <TableCell className="text-sm font-medium">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Package className="h-4 w-4 text-muted-foreground" />
                                                                                        {line.product_name || `Product #${line.product}`}
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className={`text-sm text-right font-semibold ${line.qty_adjustment >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                                    {line.qty_adjustment > 0 ? '+' : ''}{line.qty_adjustment}
                                                                                </TableCell>
                                                                                <TableCell className="text-sm text-right">
                                                                                    {line.amount_adjustment ? `$${parseFloat(line.amount_adjustment).toLocaleString('en', { minimumFractionDigits: 2 })}` : '—'}
                                                                                </TableCell>
                                                                                <TableCell className="text-sm text-muted-foreground">{line.reason || '—'}</TableCell>
                                                                                {order.lifecycle_status === 'OPEN' && (
                                                                                    <TableCell>
                                                                                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => handleRemoveLine(order.id, line.id)} disabled={isPending}>
                                                                                            <Trash2 className="h-3 w-3" />
                                                                                        </Button>
                                                                                    </TableCell>
                                                                                )}
                                                                            </TableRow>
                                                                        ))}
                                                                    </TableBody>
                                                                </Table>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-6 text-sm text-muted-foreground">
                                                                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-amber-500" />
                                                                No lines added yet. Add products to adjust.
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* ─── Create Order Dialog ────────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Stock Adjustment Order</DialogTitle>
                        <DialogDescription>Create a new adjustment order. Add lines after creation.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Date *</label>
                                <Input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Warehouse *</label>
                                <select name="warehouse" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select warehouse</option>
                                    {warehouses.map((w: Record<string, any>) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium">Reason</label>
                                <Input name="reason" placeholder="e.g. Inventory count correction" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium">Notes</label>
                                <Input name="notes" placeholder="Optional notes..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create Order"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Add Line Dialog ────────────────────────────────── */}
            <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Adjustment Line</DialogTitle>
                        <DialogDescription>Add a product to this adjustment order.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddLine} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Product *</label>
                            <select name="product" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="">Select product</option>
                                {products.map((p: Record<string, any>) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Qty Adjustment *</label>
                                <Input name="qty_adjustment" type="number" step="0.01" required placeholder="+5 or -3" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Amount</label>
                                <Input name="amount_adjustment" type="number" step="0.01" placeholder="0.00" />
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Reason</label>
                            <Input name="reason" placeholder="Line-level reason" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setLineDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add Line"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Comment Dialog (for unlock/unverify) ──────────── */}
            <Dialog open={!!commentDialog} onOpenChange={() => setCommentDialog(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{commentDialog?.action === 'unlock' ? 'Unlock Order' : 'Unverify Order'}</DialogTitle>
                        <DialogDescription>A comment is required to {commentDialog?.action}.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault()
                        const comment = new FormData(e.currentTarget).get("comment") as string
                        if (commentDialog?.action === 'unlock') handleUnlock(commentDialog.orderId, comment)
                    }} className="space-y-4">
                        <Input name="comment" required placeholder="Reason for this action..." />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setCommentDialog(null)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? "Submitting..." : "Submit"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── History Dialog ─────────────────────────────────── */}
            <Dialog open={!!historyDialog} onOpenChange={() => setHistoryDialog(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Lifecycle History</DialogTitle>
                        <DialogDescription>Audit trail of all lifecycle actions on this order.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {historyDialog?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>}
                        {historyDialog?.map((entry: Record<string, any>, i: number) => (
                            <div key={i} className="flex items-start gap-3 border-l-2 border-muted pl-4 py-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                                        {entry.level && <span className="text-xs text-muted-foreground">Level {entry.level}</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {entry.performed_by_name || 'System'} · {new Date(entry.performed_at).toLocaleString()}
                                    </p>
                                    {entry.comment && <p className="text-sm mt-1 bg-muted rounded px-2 py-1">{entry.comment}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
