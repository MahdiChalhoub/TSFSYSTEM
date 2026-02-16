'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import {
    getTransferOrders, createTransferOrder, addTransferLine, removeTransferLine,
    postTransferOrder, lockTransferOrder, unlockTransferOrder, verifyTransferOrder,
    getTransferOrderHistory, TransferOrderInput
} from "@/app/actions/inventory/transfer-orders"
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
    Truck, Plus, Search, Lock, Unlock, ShieldCheck, CheckCircle2,
    Send, ChevronDown, ChevronUp, Trash2, Package, Clock, AlertTriangle,
    ArrowLeftRight, History, Warehouse
} from "lucide-react"

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    OPEN: { label: 'Open', color: 'bg-blue-100 text-blue-700', icon: Clock },
    LOCKED: { label: 'Locked', color: 'bg-amber-100 text-amber-700', icon: Lock },
    VERIFIED: { label: 'Verified', color: 'bg-purple-100 text-purple-700', icon: ShieldCheck },
    CONFIRMED: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
}

export default function TransferOrdersPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [lineDialogOpen, setLineDialogOpen] = useState(false)
    const [activeOrder, setActiveOrder] = useState<number | null>(null)
    const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
    const [historyDialog, setHistoryDialog] = useState<any[] | null>(null)
    const [activeTab, setActiveTab] = useState("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [isPending, startTransition] = useTransition()
    const [commentDialog, setCommentDialog] = useState<{ action: string; orderId: number } | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [ordersRes, whRes, prodRes] = await Promise.all([
                getTransferOrders(),
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

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                const data: TransferOrderInput = {
                    date: fd.get("date") as string,
                    from_warehouse: Number(fd.get("from_warehouse")),
                    to_warehouse: Number(fd.get("to_warehouse")),
                    driver: fd.get("driver") as string || undefined,
                    reason: fd.get("reason") as string || undefined,
                    notes: fd.get("notes") as string || undefined,
                }
                if (data.from_warehouse === data.to_warehouse) {
                    toast.error("Source and destination cannot be the same warehouse")
                    return
                }
                await createTransferOrder(data)
                toast.success("Transfer order created")
                setDialogOpen(false)
                loadData()
            } catch (err: any) {
                toast.error(err.message || "Failed to create order")
            }
        })
    }

    async function handleAddLine(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!activeOrder) return
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                await addTransferLine(activeOrder, {
                    product: Number(fd.get("product")),
                    qty_transferred: Number(fd.get("qty_transferred")),
                    reason: fd.get("reason") as string || undefined,
                })
                toast.success("Line added")
                setLineDialogOpen(false)
                loadData()
            } catch (err: any) {
                toast.error(err.message || "Failed to add line")
            }
        })
    }

    async function handleLock(id: number) {
        startTransition(async () => {
            try { await lockTransferOrder(id); toast.success("Order locked"); loadData() }
            catch (err: any) { toast.error(err.message || "Failed to lock") }
        })
    }

    async function handleUnlock(id: number, comment: string) {
        startTransition(async () => {
            try { await unlockTransferOrder(id, comment); toast.success("Order unlocked"); loadData(); setCommentDialog(null) }
            catch (err: any) { toast.error(err.message || "Failed to unlock") }
        })
    }

    async function handleVerify(id: number) {
        startTransition(async () => {
            try { await verifyTransferOrder(id); toast.success("Verification advanced"); loadData() }
            catch (err: any) { toast.error(err.message || "Failed to verify") }
        })
    }

    async function handlePost(id: number) {
        startTransition(async () => {
            try { await postTransferOrder(id); toast.success("Transfer posted — stock moved"); loadData() }
            catch (err: any) { toast.error(err.message || "Failed to post") }
        })
    }

    async function handleRemoveLine(orderId: number, lineId: number) {
        startTransition(async () => {
            try { await removeTransferLine(orderId, lineId); toast.success("Line removed"); loadData() }
            catch (err: any) { toast.error(err.message || "Failed to remove line") }
        })
    }

    async function showHistory(id: number) {
        try {
            const history = await getTransferOrderHistory(id)
            setHistoryDialog(Array.isArray(history) ? history : [])
        } catch { toast.error("Failed to load history") }
    }

    const filtered = useMemo(() => {
        let list = orders
        if (activeTab !== "ALL") list = list.filter(o => o.lifecycle_status === activeTab)
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            list = list.filter(o =>
                o.reference?.toLowerCase().includes(q) ||
                o.driver?.toLowerCase().includes(q) ||
                o.from_warehouse_name?.toLowerCase().includes(q) ||
                o.to_warehouse_name?.toLowerCase().includes(q)
            )
        }
        return list
    }, [orders, activeTab, searchQuery])

    const totalOrders = orders.length
    const openCount = orders.filter(o => o.lifecycle_status === 'OPEN').length
    const postedCount = orders.filter(o => o.is_posted).length
    const totalQty = orders.reduce((s, o) => s + parseFloat(o.total_qty_transferred || 0), 0)

    const tabs = [
        { key: "ALL", label: "All", count: orders.length },
        { key: "OPEN", label: "Open", count: openCount },
        { key: "LOCKED", label: "Locked", count: orders.filter(o => o.lifecycle_status === 'LOCKED').length },
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-serif font-bold tracking-tight flex items-center gap-2">
                        <ArrowLeftRight className="h-6 w-6 text-indigo-600" /> Stock Transfer Orders
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Move stock between warehouses with verification pipeline</p>
                </div>
                <Button className="gap-2" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" /> New Transfer
                </Button>
            </div>

            {/* ─── Summary Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-indigo-600/80 uppercase tracking-wider">Total Transfers</p>
                                <p className="text-2xl font-bold text-indigo-900 mt-1">{totalOrders}</p>
                            </div>
                            <div className="bg-indigo-200/60 rounded-lg p-2.5"><Truck className="h-5 w-5 text-indigo-700" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-blue-600/80 uppercase tracking-wider">Open</p>
                                <p className="text-2xl font-bold text-blue-900 mt-1">{openCount}</p>
                            </div>
                            <div className="bg-blue-200/60 rounded-lg p-2.5"><Clock className="h-5 w-5 text-blue-700" /></div>
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
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-purple-600/80 uppercase tracking-wider">Units Moved</p>
                                <p className="text-2xl font-bold text-purple-900 mt-1">{totalQty.toLocaleString()}</p>
                            </div>
                            <div className="bg-purple-200/60 rounded-lg p-2.5"><Package className="h-5 w-5 text-purple-700" /></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Tabs + Search ──────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {tabs.map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t.label} <span className="ml-1 text-xs opacity-60">({t.count})</span>
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search transfers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-64" />
                </div>
            </div>

            {/* ─── Table ──────────────────────────────────────────── */}
            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-muted rounded-full p-4 mb-4"><Truck className="h-8 w-8 text-muted-foreground" /></div>
                            <h3 className="font-semibold text-lg">No transfer orders</h3>
                            <p className="text-sm text-muted-foreground mt-1">Create your first stock transfer to get started</p>
                            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Transfer</Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>From → To</TableHead>
                                    <TableHead>Driver</TableHead>
                                    <TableHead>Lines</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(order => {
                                    const isExpanded = expandedOrder === order.id
                                    const statusCfg = STATUS_CONFIG[order.lifecycle_status] || STATUS_CONFIG.OPEN
                                    const StatusIcon = statusCfg.icon
                                    return (
                                        <>
                                            <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedOrder(isExpanded ? null : order.id)}>
                                                <TableCell>{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                                                <TableCell className="font-mono text-sm font-medium">{order.reference || `TRF-${order.id}`}</TableCell>
                                                <TableCell className="text-sm">{order.date}</TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="flex items-center gap-1.5">
                                                        <Warehouse className="h-3.5 w-3.5 text-orange-500" />
                                                        <span>{order.from_warehouse_name || `WH #${order.from_warehouse}`}</span>
                                                        <span className="text-muted-foreground">→</span>
                                                        <Warehouse className="h-3.5 w-3.5 text-emerald-500" />
                                                        <span>{order.to_warehouse_name || `WH #${order.to_warehouse}`}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{order.driver || '—'}</TableCell>
                                                <TableCell><Badge variant="secondary" className="text-xs">{order.lines?.length || 0} items</Badge></TableCell>
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
                                                        {order.lines?.length > 0 ? (
                                                            <div className="rounded-lg border overflow-hidden">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow className="bg-muted/50">
                                                                            <TableHead className="text-xs">Product</TableHead>
                                                                            <TableHead className="text-xs text-right">Qty Transferred</TableHead>
                                                                            <TableHead className="text-xs">Reason</TableHead>
                                                                            {order.lifecycle_status === 'OPEN' && <TableHead className="text-xs w-10"></TableHead>}
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {order.lines.map((line: any) => (
                                                                            <TableRow key={line.id}>
                                                                                <TableCell className="text-sm font-medium">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <Package className="h-4 w-4 text-muted-foreground" />
                                                                                        {line.product_name || `Product #${line.product}`}
                                                                                    </div>
                                                                                </TableCell>
                                                                                <TableCell className="text-sm text-right font-semibold text-indigo-600">{line.qty_transferred}</TableCell>
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
                                                                <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-amber-500" /> No lines added yet
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

            {/* ─── Create Transfer Dialog ─────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Stock Transfer Order</DialogTitle>
                        <DialogDescription>Transfer stock between warehouses. Add product lines after creating.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="text-sm font-medium">Date *</label>
                                <Input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">From Warehouse *</label>
                                <select name="from_warehouse" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select source</option>
                                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">To Warehouse *</label>
                                <select name="to_warehouse" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select destination</option>
                                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Driver</label>
                                <Input name="driver" placeholder="Driver name" />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Reason</label>
                                <Input name="reason" placeholder="Transfer reason" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium">Notes</label>
                                <Input name="notes" placeholder="Optional notes..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? "Creating..." : "Create Transfer"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Add Line Dialog ────────────────────────────────── */}
            <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Transfer Line</DialogTitle>
                        <DialogDescription>Select product and quantity to transfer.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddLine} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Product *</label>
                            <select name="product" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="">Select product</option>
                                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Quantity *</label>
                            <Input name="qty_transferred" type="number" step="0.01" min="0.01" required placeholder="Units to transfer" />
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

            {/* ─── Comment Dialog ─────────────────────────────────── */}
            <Dialog open={!!commentDialog} onOpenChange={() => setCommentDialog(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Unlock Order</DialogTitle>
                        <DialogDescription>A comment is required to unlock this order.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault()
                        const comment = new FormData(e.currentTarget).get("comment") as string
                        if (commentDialog) handleUnlock(commentDialog.orderId, comment)
                    }} className="space-y-4">
                        <Input name="comment" required placeholder="Reason for unlocking..." />
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
                        <DialogDescription>Audit trail of all lifecycle actions.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {historyDialog?.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>}
                        {historyDialog?.map((entry: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 border-l-2 border-muted pl-4 py-2">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                                        {entry.level && <span className="text-xs text-muted-foreground">Level {entry.level}</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{entry.performed_by_name || 'System'} · {new Date(entry.performed_at).toLocaleString()}</p>
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
