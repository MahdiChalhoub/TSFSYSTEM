'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { TransferOrder, Warehouse as WarehouseType, Product, LifecycleHistoryEntry } from '@/types/erp'
import {
    getTransferOrders, createTransferOrder, addTransferLine, removeTransferLine,
    postTransferOrder, lockTransferOrder, unlockTransferOrder, verifyTransferOrder,
    getTransferOrderHistory,
} from '@/app/actions/inventory/transfer-orders'
import { getWarehouses } from '@/app/actions/inventory/valuation'
import { InventoryListView, type ColumnDef, type DetailColumnDef, type FilterOption } from '@/components/inventory/InventoryListView'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Eye, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TransferLine = {
    id: number
    product: number
    product_name?: string
    from_warehouse_name?: string
    to_warehouse_name?: string
    qty_transferred: number
    reason: string
    recovered_amount: number
    added_by_name?: string
    added_by?: { username?: string; first_name?: string }
}

export default function TransferOrdersPage() {
    const { fmt } = useCurrency()
    const [orders, setOrders] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    /* Filters */
    const [filterStatus, setFilterStatus] = useState('')
    const [filterFromWh, setFilterFromWh] = useState('')
    const [filterToWh, setFilterToWh] = useState('')
    const [search, setSearch] = useState('')

    /* Dialogs */
    const [showCreate, setShowCreate] = useState(false)
    const [showAddLine, setShowAddLine] = useState<number | null>(null)
    const [showHistory, setShowHistory] = useState<LifecycleHistoryEntry[] | null>(null)
    const [showUnlock, setShowUnlock] = useState<number | null>(null)
    const [unlockComment, setUnlockComment] = useState('')

    /* Create form */
    const [newFromWh, setNewFromWh] = useState('')
    const [newToWh, setNewToWh] = useState('')
    const [newDriver, setNewDriver] = useState('')
    const [newReason, setNewReason] = useState('')
    const [newNotes, setNewNotes] = useState('')

    /* Add line form */
    const [lineProduct, setLineProduct] = useState('')
    const [lineQty, setLineQty] = useState('')
    const [lineReason, setLineReason] = useState('')

    const loadData = useCallback(async () => {
        try {
            const [ordersData, whData] = await Promise.all([
                getTransferOrders(),
                getWarehouses(),
            ])
            setOrders(Array.isArray(ordersData) ? ordersData : ordersData?.results || [])
            setWarehouses(Array.isArray(whData) ? whData : [])
        } catch (e) {
            toast.error('Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    /* ─── Columns ─────────────────────────────────── */
    const columns: ColumnDef<any>[] = [
        { key: 'date', label: 'Date', render: r => new Date(r.date || r.created_at).toLocaleDateString() },
        { key: 'reference', label: 'Reference' },
        { key: 'total_qty_transferred', label: 'QTY Transferred', align: 'right', render: r => r.total_qty_transferred || r.lines?.length || 0 },
        { key: 'from_warehouse', label: 'From Location', render: r => r.from_warehouse_name || r.from_warehouse?.name || '—' },
        { key: 'to_warehouse', label: 'To Location', render: r => r.to_warehouse_name || r.to_warehouse?.name || '—' },
        { key: 'reason', label: 'Reason', render: r => r.reason || '—' },
        { key: 'driver', label: 'Driver', render: r => r.driver || '—' },
    ]

    const detailColumns: DetailColumnDef<TransferLine>[] = [
        { key: 'from_warehouse_name', label: 'Location A', render: d => d.from_warehouse_name || '—' },
        { key: 'to_warehouse_name', label: 'Location B', render: d => d.to_warehouse_name || '—' },
        { key: 'qty_transferred', label: 'QTY', align: 'right' },
        { key: 'recovered_amount', label: 'Recovered Amt', align: 'right', render: d => fmt(d.recovered_amount || 0) },
        { key: 'reason', label: 'Reason', render: d => d.reason || '—' },
        { key: 'added_by', label: 'Added By', render: d => d.added_by_name || d.added_by?.username || d.added_by?.first_name || '—' },
    ]

    /* ─── Filters ─────────────────────────────────── */
    const filters: FilterOption[] = [
        {
            key: 'status', label: 'Status',
            value: filterStatus,
            options: [
                { value: 'OPEN', label: 'Open' },
                { value: 'LOCKED', label: 'Locked' },
                { value: 'VERIFIED', label: 'Verified' },
                { value: 'CONFIRMED', label: 'Confirmed' },
            ]
        },
        {
            key: 'from_warehouse', label: 'Location From',
            value: filterFromWh,
            options: warehouses.map(w => ({ value: String(w.id), label: w.name }))
        },
        {
            key: 'to_warehouse', label: 'Location To',
            value: filterToWh,
            options: warehouses.map(w => ({ value: String(w.id), label: w.name }))
        },
    ]

    const handleFilterChange = (key: string, value: string) => {
        const v = value === '__all__' ? '' : value
        if (key === 'status') setFilterStatus(v)
        if (key === 'from_warehouse') setFilterFromWh(v)
        if (key === 'to_warehouse') setFilterToWh(v)
    }

    /* ─── Filtered Data ──────────────────────────── */
    const filteredOrders = orders.filter(o => {
        if (filterStatus && o.lifecycle_status !== filterStatus) return false
        if (filterFromWh && String(o.from_warehouse_id || o.from_warehouse?.id) !== filterFromWh) return false
        if (filterToWh && String(o.to_warehouse_id || o.to_warehouse?.id) !== filterToWh) return false
        if (search) {
            const s = search.toLowerCase()
            return (o.reference?.toLowerCase().includes(s) || o.driver?.toLowerCase().includes(s) || o.reason?.toLowerCase().includes(s))
        }
        return true
    })

    /* ─── Actions ─────────────────────────────────── */
    const handleCreate = async () => {
        if (!newFromWh || !newToWh) { toast.error('Select both warehouses'); return }
        startTransition(async () => {
            try {
                await createTransferOrder({
                    date: new Date().toISOString().split('T')[0],
                    from_warehouse: parseInt(newFromWh),
                    to_warehouse: parseInt(newToWh),
                    driver: newDriver,
                    reason: newReason,
                    notes: newNotes,
                })
                toast.success('Transfer order created')
                setShowCreate(false)
                setNewFromWh(''); setNewToWh(''); setNewDriver(''); setNewReason(''); setNewNotes('')
                loadData()
            } catch (e: any) { toast.error(e.message || 'Failed to create') }
        })
    }

    const handleAddLine = async () => {
        if (!lineProduct || !lineQty || !showAddLine) return
        startTransition(async () => {
            try {
                await addTransferLine(showAddLine, {
                    product: parseInt(lineProduct),
                    qty_transferred: parseFloat(lineQty),
                    reason: lineReason,
                })
                toast.success('Line added')
                setShowAddLine(null)
                setLineProduct(''); setLineQty(''); setLineReason('')
                loadData()
            } catch (e: any) { toast.error(e.message || 'Failed to add line') }
        })
    }

    const handleLockToggle = async (row: any) => {
        const id = row.id
        const isLocked = row.lifecycle_status === 'LOCKED' || row.lifecycle_status === 'VERIFIED' || row.lifecycle_status === 'CONFIRMED'
        if (isLocked) {
            setShowUnlock(id)
        } else {
            startTransition(async () => {
                try {
                    await lockTransferOrder(id)
                    toast.success('Order locked')
                    loadData()
                } catch (e: any) { toast.error(e.message || 'Failed to lock') }
            })
        }
    }

    const handleUnlock = async () => {
        if (!showUnlock) return
        startTransition(async () => {
            try {
                await unlockTransferOrder(showUnlock, unlockComment)
                toast.success('Order unlocked')
                setShowUnlock(null)
                setUnlockComment('')
                loadData()
            } catch (e: any) { toast.error(e.message || 'Failed to unlock') }
        })
    }

    const handleDelete = async (row: any) => {
        const lines = row.lines || []
        if (lines.length > 0) {
            toast.error('Remove all lines before deleting')
            return
        }
        // For now just show implementation note
        toast.info('Delete not yet implemented for orders')
    }

    const handleViewHistory = async (row: any) => {
        try {
            const history = await getTransferOrderHistory(row.id)
            setShowHistory(Array.isArray(history) ? history : [])
        } catch { toast.error('Failed to load history') }
    }

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <InventoryListView<any, TransferLine>
                title="Stock Transfer"
                addLabel="Add TRANSFER STOCK"
                onAdd={() => setShowCreate(true)}
                onExport={() => toast.info('Export coming soon')}
                data={filteredOrders}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                filters={filters}
                onFilterChange={handleFilterChange}
                searchPlaceholder="Search by reference, driver..."
                searchValue={search}
                onSearchChange={setSearch}
                detailColumns={detailColumns}
                getDetails={r => r.lines || []}
                detailActions={(d, row) => (
                    <div className="flex items-center gap-1">
                        <button className="p-1 rounded hover:bg-emerald-100"><Eye className="h-3.5 w-3.5 text-emerald-600" /></button>
                        <button className="p-1 rounded hover:bg-emerald-100"><Pencil className="h-3.5 w-3.5 text-emerald-600" /></button>
                    </div>
                )}
                getStatus={r => {
                    const s = r.lifecycle_status || 'OPEN'
                    const map: Record<string, any> = {
                        OPEN: { label: 'Open', variant: 'default' },
                        LOCKED: { label: 'Locked', variant: 'warning' },
                        VERIFIED: { label: 'Verified', variant: 'success' },
                        CONFIRMED: { label: 'Approved', variant: 'success' },
                    }
                    return map[s] || { label: s, variant: 'default' }
                }}
                getVerified={r => r.lifecycle_status === 'VERIFIED' || r.lifecycle_status === 'CONFIRMED'}
                getLocked={r => r.lifecycle_status !== 'OPEN'}
                onLockToggle={handleLockToggle}
                onEdit={r => setShowAddLine(r.id)}
                onDelete={handleDelete}
            />

            {/* ─── Create Dialog ────────────────────────── */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <DialogHeader><DialogTitle>New Transfer Order</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>From Warehouse</Label>
                            <Select value={newFromWh} onValueChange={setNewFromWh}>
                                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>To Warehouse</Label>
                            <Select value={newToWh} onValueChange={setNewToWh}>
                                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Driver</Label><Input value={newDriver} onChange={e => setNewDriver(e.target.value)} /></div>
                        <div><Label>Reason</Label><Input value={newReason} onChange={e => setNewReason(e.target.value)} /></div>
                        <div><Label>Notes</Label><Input value={newNotes} onChange={e => setNewNotes(e.target.value)} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={isPending}
                            className="bg-emerald-500 hover:bg-emerald-600">Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Add Line Dialog ──────────────────────── */}
            <Dialog open={!!showAddLine} onOpenChange={() => setShowAddLine(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add Transfer Line</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Product ID</Label><Input value={lineProduct} onChange={e => setLineProduct(e.target.value)} placeholder="Product ID" /></div>
                        <div><Label>Quantity</Label><Input type="number" value={lineQty} onChange={e => setLineQty(e.target.value)} /></div>
                        <div><Label>Reason</Label><Input value={lineReason} onChange={e => setLineReason(e.target.value)} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddLine(null)}>Cancel</Button>
                        <Button onClick={handleAddLine} disabled={isPending}
                            className="bg-emerald-500 hover:bg-emerald-600">Add Line</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── Unlock Dialog ────────────────────────── */}
            <Dialog open={!!showUnlock} onOpenChange={() => setShowUnlock(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Unlock Order</DialogTitle></DialogHeader>
                    <div><Label>Comment (required)</Label><Input value={unlockComment} onChange={e => setUnlockComment(e.target.value)} /></div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowUnlock(null)}>Cancel</Button>
                        <Button onClick={handleUnlock} disabled={isPending || !unlockComment}>Unlock</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── History Dialog ───────────────────────── */}
            <Dialog open={!!showHistory} onOpenChange={() => setShowHistory(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Order History</DialogTitle></DialogHeader>
                    <div className="space-y-2 max-h-64 overflow-auto">
                        {showHistory?.map((h, i) => (
                            <div key={i} className="flex justify-between text-sm border-b pb-1">
                                <span className="font-medium">{h.action}</span>
                                <span className="text-gray-500">{new Date(h.timestamp).toLocaleString()}</span>
                            </div>
                        ))}
                        {showHistory?.length === 0 && <p className="text-gray-400 text-center">No history</p>}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
