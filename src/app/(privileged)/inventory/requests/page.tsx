'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { OperationalRequest, Warehouse, Product } from '@/types/erp'
import {
    getOperationalRequests, createOperationalRequest, addRequestLine,
    approveRequest, rejectRequest, convertRequest, OperationalRequestInput
} from "@/app/actions/inventory/operational-requests"
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
    Inbox, Plus, Search, CheckCircle2, XCircle, ArrowRightCircle,
    ChevronDown, ChevronUp, Package, Clock, AlertTriangle,
    FileQuestion, ArrowDownUp, ArrowLeftRight, ShoppingCart
} from "lucide-react"

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    STOCK_ADJUSTMENT: { label: 'Stock Adjustment', icon: ArrowDownUp, color: 'bg-blue-100 text-blue-700' },
    STOCK_TRANSFER: { label: 'Stock Transfer', icon: ArrowLeftRight, color: 'bg-indigo-100 text-indigo-700' },
    PURCHASE_ORDER: { label: 'Purchase Order', icon: ShoppingCart, color: 'bg-amber-100 text-amber-700' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
    APPROVED: { label: 'Approved', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
    CONVERTED: { label: 'Converted', color: 'bg-purple-100 text-purple-700', icon: ArrowRightCircle },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Low', color: 'text-slate-500' },
    NORMAL: { label: 'Normal', color: 'text-blue-600' },
    HIGH: { label: 'High', color: 'text-orange-600' },
    URGENT: { label: 'Urgent', color: 'text-red-600' },
}

export default function OperationalRequestsPage() {
    const [requests, setRequests] = useState<OperationalRequest[]>([])
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [lineDialogOpen, setLineDialogOpen] = useState(false)
    const [activeRequest, setActiveRequest] = useState<number | null>(null)
    const [expandedRequest, setExpandedRequest] = useState<number | null>(null)
    const [activeTab, setActiveTab] = useState("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [isPending, startTransition] = useTransition()
    const [rejectDialog, setRejectDialog] = useState<number | null>(null)
    const [convertDialog, setConvertDialog] = useState<OperationalRequest | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [reqRes, whRes, prodRes] = await Promise.all([
                getOperationalRequests(),
                erpFetch('inventory/warehouses/'),
                erpFetch('inventory/products/')
            ])
            setRequests(Array.isArray(reqRes) ? reqRes : reqRes?.results || [])
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
                const data: OperationalRequestInput = {
                    request_type: fd.get("request_type") as string,
                    date: fd.get("date") as string,
                    priority: fd.get("priority") as string || 'NORMAL',
                    description: fd.get("description") as string || undefined,
                    notes: fd.get("notes") as string || undefined,
                }
                await createOperationalRequest(data)
                toast.success("Request submitted")
                setDialogOpen(false)
                loadData()
            } catch (err: any) {
                toast.error(err.message || "Failed to create request")
            }
        })
    }

    async function handleAddLine(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!activeRequest) return
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                await addRequestLine(activeRequest, {
                    product: Number(fd.get("product")),
                    quantity: Number(fd.get("quantity")),
                    warehouse: fd.get("warehouse") ? Number(fd.get("warehouse")) : undefined,
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

    async function handleApprove(id: number) {
        startTransition(async () => {
            try { await approveRequest(id); toast.success("Request approved"); loadData() }
            catch (err: any) { toast.error(err.message || "Failed to approve") }
        })
    }

    async function handleReject(id: number, reason: string) {
        startTransition(async () => {
            try { await rejectRequest(id, reason); toast.success("Request rejected"); loadData(); setRejectDialog(null) }
            catch (err: any) { toast.error(err.message || "Failed to reject") }
        })
    }

    async function handleConvert(id: number, e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                const data: any = {}
                const wh = fd.get("warehouse")
                const fwh = fd.get("from_warehouse")
                const twh = fd.get("to_warehouse")
                if (wh) data.warehouse = Number(wh)
                if (fwh) data.from_warehouse = Number(fwh)
                if (twh) data.to_warehouse = Number(twh)
                await convertRequest(id, data)
                toast.success("Request converted to order")
                setConvertDialog(null)
                loadData()
            } catch (err: any) {
                toast.error(err.message || "Failed to convert")
            }
        })
    }

    const filtered = useMemo(() => {
        let list = requests
        if (activeTab !== "ALL") list = list.filter(r => r.status === activeTab)
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            list = list.filter(r =>
                r.reference?.toLowerCase().includes(q) ||
                r.description?.toLowerCase().includes(q) ||
                r.request_type?.toLowerCase().includes(q)
            )
        }
        return list
    }, [requests, activeTab, searchQuery])

    const totalRequests = requests.length
    const pendingCount = requests.filter(r => r.status === 'PENDING').length
    const approvedCount = requests.filter(r => r.status === 'APPROVED').length
    const convertedCount = requests.filter(r => r.status === 'CONVERTED').length

    const tabs = [
        { key: "ALL", label: "All", count: requests.length },
        { key: "PENDING", label: "Pending", count: pendingCount },
        { key: "APPROVED", label: "Approved", count: approvedCount },
        { key: "CONVERTED", label: "Converted", count: convertedCount },
        { key: "REJECTED", label: "Rejected", count: requests.filter(r => r.status === 'REJECTED').length },
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
                        <Inbox className="h-6 w-6 text-amber-600" /> Operational Requests
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Submit, approve, reject, and convert stock requests into orders</p>
                </div>
                <Button className="gap-2" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" /> New Request
                </Button>
            </div>

            {/* ─── Summary Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-slate-600/80 uppercase tracking-wider">Total Requests</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{totalRequests}</p>
                            </div>
                            <div className="bg-slate-200/60 rounded-lg p-2.5"><Inbox className="h-5 w-5 text-slate-700" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-amber-600/80 uppercase tracking-wider">Pending Review</p>
                                <p className="text-2xl font-bold text-amber-900 mt-1">{pendingCount}</p>
                            </div>
                            <div className="bg-amber-200/60 rounded-lg p-2.5"><Clock className="h-5 w-5 text-amber-700" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-emerald-600/80 uppercase tracking-wider">Approved</p>
                                <p className="text-2xl font-bold text-emerald-900 mt-1">{approvedCount}</p>
                            </div>
                            <div className="bg-emerald-200/60 rounded-lg p-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-700" /></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-purple-600/80 uppercase tracking-wider">Converted</p>
                                <p className="text-2xl font-bold text-purple-900 mt-1">{convertedCount}</p>
                            </div>
                            <div className="bg-purple-200/60 rounded-lg p-2.5"><ArrowRightCircle className="h-5 w-5 text-purple-700" /></div>
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
                    <Input placeholder="Search requests..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 w-64" />
                </div>
            </div>

            {/* ─── Table ──────────────────────────────────────────── */}
            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-muted rounded-full p-4 mb-4"><FileQuestion className="h-8 w-8 text-muted-foreground" /></div>
                            <h3 className="font-semibold text-lg">No requests found</h3>
                            <p className="text-sm text-muted-foreground mt-1">Submit your first operational request</p>
                            <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> New Request</Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8"></TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Lines</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map(req => {
                                    const isExpanded = expandedRequest === req.id
                                    const typeCfg = TYPE_CONFIG[req.request_type] || { label: req.request_type, icon: FileQuestion, color: 'bg-gray-100 text-gray-700' }
                                    const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING
                                    const StatusIcon = statusCfg.icon
                                    const TypeIcon = typeCfg.icon
                                    const priCfg = PRIORITY_CONFIG[req.priority ?? 'NORMAL'] || PRIORITY_CONFIG.NORMAL
                                    return (
                                        <>
                                            <TableRow key={req.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setExpandedRequest(isExpanded ? null : req.id)}>
                                                <TableCell>{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</TableCell>
                                                <TableCell className="font-mono text-sm font-medium">{req.reference || `REQ-${req.id}`}</TableCell>
                                                <TableCell className="text-sm">{req.date}</TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${typeCfg.color}`}>
                                                        <TypeIcon className="h-3 w-3" /> {typeCfg.label}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`text-xs font-semibold ${priCfg.color}`}>{priCfg.label}</span>
                                                </TableCell>
                                                <TableCell><Badge variant="secondary" className="text-xs">{req.lines?.length || 0} items</Badge></TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                                                        <StatusIcon className="h-3 w-3" /> {statusCfg.label}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-1">
                                                        {req.status === 'PENDING' && (
                                                            <>
                                                                <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => { setActiveRequest(req.id); setLineDialogOpen(true) }}>
                                                                    <Plus className="h-3 w-3" /> Line
                                                                </Button>
                                                                <Button size="sm" className="h-7 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(req.id)} disabled={isPending}>
                                                                    <CheckCircle2 className="h-3 w-3" /> Approve
                                                                </Button>
                                                                <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" onClick={() => setRejectDialog(req.id)} disabled={isPending}>
                                                                    <XCircle className="h-3 w-3" /> Reject
                                                                </Button>
                                                            </>
                                                        )}
                                                        {req.status === 'APPROVED' && (
                                                            <Button size="sm" className="h-7 gap-1 text-xs bg-purple-600 hover:bg-purple-700" onClick={() => setConvertDialog(req)} disabled={isPending}>
                                                                <ArrowRightCircle className="h-3 w-3" /> Convert
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {isExpanded && (
                                                <TableRow key={`${req.id}-lines`}>
                                                    <TableCell colSpan={8} className="bg-muted/20 p-4">
                                                        <div className="space-y-3">
                                                            {req.description && (
                                                                <div className="bg-muted/40 rounded-lg p-3">
                                                                    <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                                                                    <p className="text-sm">{req.description}</p>
                                                                </div>
                                                            )}
                                                            {(req.lines?.length ?? 0) > 0 ? (
                                                                <div className="rounded-lg border overflow-hidden">
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow className="bg-muted/50">
                                                                                <TableHead className="text-xs">Product</TableHead>
                                                                                <TableHead className="text-xs text-right">Quantity</TableHead>
                                                                                <TableHead className="text-xs">Warehouse</TableHead>
                                                                                <TableHead className="text-xs">Reason</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {(req.lines ?? []).map((line: any) => (
                                                                                <TableRow key={line.id}>
                                                                                    <TableCell className="text-sm font-medium">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <Package className="h-4 w-4 text-muted-foreground" />
                                                                                            {line.product_name || `Product #${line.product}`}
                                                                                        </div>
                                                                                    </TableCell>
                                                                                    <TableCell className="text-sm text-right font-semibold">{line.quantity}</TableCell>
                                                                                    <TableCell className="text-sm text-muted-foreground">{line.warehouse_name || '—'}</TableCell>
                                                                                    <TableCell className="text-sm text-muted-foreground">{line.reason || '—'}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-6 text-sm text-muted-foreground">
                                                                    <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-amber-500" /> No items in this request
                                                                </div>
                                                            )}
                                                        </div>
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

            {/* ─── Create Request Dialog ──────────────────────────── */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>New Operational Request</DialogTitle>
                        <DialogDescription>Submit a request for stock adjustment, transfer, or purchase.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Type *</label>
                                <select name="request_type" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Date *</label>
                                <Input name="date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Priority</label>
                                <select name="priority" defaultValue="NORMAL" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                                        <option key={k} value={k}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium">Description</label>
                                <Input name="description" placeholder="Describe the request..." />
                            </div>
                            <div className="col-span-2">
                                <label className="text-sm font-medium">Notes</label>
                                <Input name="notes" placeholder="Additional notes..." />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? "Submitting..." : "Submit Request"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Add Line Dialog ────────────────────────────────── */}
            <Dialog open={lineDialogOpen} onOpenChange={setLineDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Request Item</DialogTitle>
                        <DialogDescription>Add a product to this request.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddLine} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Product *</label>
                            <select name="product" required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="">Select product</option>
                                {products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium">Quantity *</label>
                                <Input name="quantity" type="number" step="0.01" min="0.01" required />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Warehouse</label>
                                <select name="warehouse" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Any</option>
                                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Reason</label>
                            <Input name="reason" placeholder="Why is this needed?" />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setLineDialogOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? "Adding..." : "Add Item"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Reject Dialog ──────────────────────────────────── */}
            <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Reject Request</DialogTitle>
                        <DialogDescription>Please provide a reason for rejection.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault()
                        const reason = new FormData(e.currentTarget).get("reason") as string
                        if (rejectDialog) handleReject(rejectDialog, reason)
                    }} className="space-y-4">
                        <Input name="reason" required placeholder="Rejection reason..." />
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
                            <Button type="submit" variant="destructive" disabled={isPending}>{isPending ? "Rejecting..." : "Reject"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── Convert Dialog ─────────────────────────────────── */}
            <Dialog open={!!convertDialog} onOpenChange={() => setConvertDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Convert to Order</DialogTitle>
                        <DialogDescription>This will create a stock order from the approved request.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        if (convertDialog) handleConvert(convertDialog.id, e)
                        else e.preventDefault()
                    }} className="space-y-4">
                        {convertDialog?.request_type === 'STOCK_TRANSFER' ? (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm font-medium">From Warehouse</label>
                                    <select name="from_warehouse" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                        <option value="">Select</option>
                                        {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">To Warehouse</label>
                                    <select name="to_warehouse" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                        <option value="">Select</option>
                                        {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-sm font-medium">Target Warehouse</label>
                                <select name="warehouse" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select warehouse</option>
                                    {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setConvertDialog(null)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? "Converting..." : "Convert to Order"}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
