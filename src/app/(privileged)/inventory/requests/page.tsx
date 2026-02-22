'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import type { OperationalRequest, Warehouse, Product } from '@/types/erp'
import {
    getOperationalRequests, createOperationalRequest, addRequestLine,
    approveRequest, rejectRequest, convertRequest, OperationalRequestInput
} from "@/app/actions/inventory/operational-requests"
import { erpFetch } from "@/lib/erp-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Inbox, Plus, Search, CheckCircle2, XCircle, ArrowRightCircle,
    ChevronDown, ChevronUp, Package, Clock, AlertTriangle,
    FileQuestion, ArrowDownUp, ArrowLeftRight, ShoppingCart, RefreshCw
} from "lucide-react"
import { TypicalListView, ColumnDef, DetailColumnDef } from "@/components/common/TypicalListView"
import { TypicalFilter } from "@/components/common/TypicalFilter"

const TYPE_CONFIG: Record<string, { label: string; icon: Record<string, any>; color: string }> = {
    STOCK_ADJUSTMENT: { label: 'Stock Adjustment', icon: ArrowDownUp, color: 'bg-blue-100 text-blue-700' },
    STOCK_TRANSFER: { label: 'Stock Transfer', icon: ArrowLeftRight, color: 'bg-indigo-100 text-indigo-700' },
    PURCHASE_ORDER: { label: 'Purchase Order', icon: ShoppingCart, color: 'bg-amber-100 text-amber-700' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: Record<string, any> }> = {
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
    const [searchQuery, setSearchQuery] = useState("")
    const [activeTab, setActiveTab] = useState("ALL")
    const [isPending, startTransition] = useTransition()
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
    const [rejectDialog, setRejectDialog] = useState<number | null>(null)
    const [convertDialog, setConvertDialog] = useState<OperationalRequest | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
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
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to create request")
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
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to add line")
            }
        })
    }

    async function handleApprove(id: number) {
        startTransition(async () => {
            try { await approveRequest(id); toast.success("Request approved"); loadData() }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to approve") }
        })
    }

    async function handleReject(id: number, reason: string) {
        startTransition(async () => {
            try { await rejectRequest(id, reason); toast.success("Request rejected"); loadData(); setRejectDialog(null) }
            catch (err: unknown) { toast.error((err instanceof Error ? err.message : String(err)) || "Failed to reject") }
        })
    }

    async function handleConvert(id: number, e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                const data: Record<string, any> = {}
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
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to convert")
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

    const columns: ColumnDef<OperationalRequest>[] = [
        { key: 'reference', label: 'Reference', sortable: true, render: r => <span className="font-mono font-bold text-gray-900">{r.reference || `REQ-${r.id}`}</span> },
        { key: 'date', label: 'Date', render: r => <span className="text-gray-500 font-medium">{r.date}</span> },
        {
            key: 'request_type', label: 'Type', render: r => {
                const cfg = TYPE_CONFIG[r.request_type] || { label: r.request_type, icon: FileQuestion, color: 'bg-gray-100 text-gray-700' }
                const Icon = cfg.icon
                return (
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>
                        <Icon className="h-3 w-3" /> {cfg.label}
                    </span>
                )
            }
        },
        {
            key: 'priority', label: 'Priority', render: r => {
                const cfg = PRIORITY_CONFIG[r.priority ?? 'NORMAL'] || PRIORITY_CONFIG.NORMAL
                return <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
            }
        },
        { key: 'line_count', label: 'Items', align: 'center', render: r => <Badge variant="outline" className="text-[10px] font-black px-2 py-0 bg-gray-50 text-gray-500 border-gray-100">{r.lines?.length || 0} SKU</Badge> },
    ]

    const detailColumns: DetailColumnDef<any>[] = [
        { key: 'product_name', label: 'Product', render: d => <div className="flex items-center gap-2 font-bold text-gray-700"><Package size={14} className="text-indigo-400" /> {d.product_name || `SKU #${d.product}`}</div> },
        { key: 'quantity', label: 'Qty', align: 'right', render: d => <span className="font-mono font-black text-indigo-600">{d.quantity}</span> },
        { key: 'warehouse_name', label: 'Terminal', render: d => <Badge variant="outline" className="bg-white text-gray-400 border-gray-100 text-[9px] font-black uppercase">{d.warehouse_name || 'Generic'}</Badge> },
        { key: 'reason', label: 'Reason', render: d => <span className="text-xs text-gray-400 italic">{d.reason || '—'}</span> },
    ]

    const handleBulkApprove = () => {
        if (!confirm(`Approve ${selectedIds.size} requests?`)) return
        toast.info("Bulk approval simulation")
        setSelectedIds(new Set())
    }

    if (loading && requests.length === 0) return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-[2.5rem]" />)}
            </div>
            <Skeleton className="h-[600px] w-full rounded-3xl" />
        </div>
    )

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-200">
                            <Inbox size={28} className="text-white" />
                        </div>
                        Operational <span className="text-amber-500">Requests</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Inventory Logistics & Procurement Pipeline</p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 italic font-medium text-amber-700 text-[10px] text-right">
                    Requests require audit approval <br /> before conversion to orders.
                </div>
            </header>

            {/* Analysis Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Clock size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Flow</p>
                            <h2 className="text-2xl font-black text-gray-900">{totalRequests}</h2>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ShoppingCart size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none mb-1">Queue Depth</p>
                            <h2 className="text-2xl font-black text-gray-900">{pendingCount}</h2>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <CheckCircle2 size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Approved Pool</p>
                            <h2 className="text-2xl font-black text-gray-900">{approvedCount}</h2>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ArrowRightCircle size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest leading-none mb-1">Converted</p>
                            <h2 className="text-2xl font-black text-gray-900">{convertedCount}</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TypicalListView<OperationalRequest, any>
                title="Request Stream"
                addLabel="SUBMIT REQUEST"
                onAdd={() => setDialogOpen(true)}
                data={filtered}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                detailColumns={detailColumns}
                getDetails={r => r.lines || []}
                selection={{
                    selectedIds,
                    onSelectionChange: setSelectedIds
                }}
                bulkActions={
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" className="text-emerald-600 hover:bg-emerald-50 font-bold px-4 uppercase" onClick={handleBulkApprove}>
                            <CheckCircle2 className="h-4 w-4 mr-2" /> Approve Selected
                        </Button>
                        <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 font-bold px-4 uppercase" onClick={() => setSelectedIds(new Set())}>
                            <XCircle className="h-4 w-4 mr-2" /> Reject Selected
                        </Button>
                    </div>
                }
                headerExtra={
                    <Button onClick={loadData} variant="ghost" className="h-8 w-8 p-0 text-stone-400 hover:text-amber-600">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                }
                lifecycle={{
                    getStatus: r => {
                        const cfg = STATUS_CONFIG[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' }
                        const variantMap: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
                            PENDING: 'warning',
                            APPROVED: 'success',
                            REJECTED: 'danger',
                            CONVERTED: 'info'
                        }
                        return { label: cfg.label, variant: variantMap[r.status] || 'default' }
                    },
                    getApproved: r => r.status === 'APPROVED' || r.status === 'CONVERTED',
                    getCanceled: r => r.status === 'REJECTED'
                }}
                actions={{
                    renderCustom: (req) => (
                        <div className="flex items-center gap-1">
                            {req.status === 'PENDING' && (
                                <>
                                    <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-amber-100 text-amber-600 hover:bg-amber-50 font-bold text-[10px]" onClick={() => { setActiveRequest(req.id); setLineDialogOpen(true) }}>
                                        <Plus className="h-4 w-4 mr-1" /> LINE
                                    </Button>
                                    <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-emerald-100 text-emerald-600 hover:bg-emerald-50 font-bold text-[10px]" onClick={() => handleApprove(req.id)} disabled={isPending}>
                                        <CheckCircle2 className="h-4 w-4 mr-1" /> APPROVE
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" onClick={() => setRejectDialog(req.id)} disabled={isPending}>
                                        <XCircle size={16} />
                                    </Button>
                                </>
                            )}
                            {req.status === 'APPROVED' && (
                                <Button size="sm" variant="outline" className="h-8 px-3 rounded-xl border-purple-100 text-purple-600 hover:bg-purple-50 font-bold text-[10px]" onClick={() => setConvertDialog(req)} disabled={isPending}>
                                    <ArrowRightCircle className="h-4 w-4 mr-1" /> CONVERT
                                </Button>
                            )}
                        </div>
                    )
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search by Ref or Description...', value: searchQuery, onChange: setSearchQuery }}
                    filters={[
                        {
                            key: 'status', label: 'Protocol Status', type: 'select', options: [
                                { value: 'ALL', label: 'All Protocols' },
                                { value: 'PENDING', label: 'Pending Review' },
                                { value: 'APPROVED', label: 'Approved' },
                                { value: 'CONVERTED', label: 'Converted' },
                                { value: 'REJECTED', label: 'Rejected' },
                            ]
                        }
                    ]}
                    values={{ status: activeTab }}
                    onChange={(k, v) => setActiveTab(String(v))}
                />
            </TypicalListView>

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
                                {products.map((p: Record<string, any>) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
                                    {warehouses.map((w: Record<string, any>) => <option key={w.id} value={w.id}>{w.name}</option>)}
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
                                        {warehouses.map((w: Record<string, any>) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">To Warehouse</label>
                                    <select name="to_warehouse" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                        <option value="">Select</option>
                                        {warehouses.map((w: Record<string, any>) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="text-sm font-medium">Target Warehouse</label>
                                <select name="warehouse" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="">Select warehouse</option>
                                    {warehouses.map((w: Record<string, any>) => <option key={w.id} value={w.id}>{w.name}</option>)}
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
