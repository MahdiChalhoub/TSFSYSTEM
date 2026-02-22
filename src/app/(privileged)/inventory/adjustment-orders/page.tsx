'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { AdjustmentOrder, Warehouse as WarehouseType, LifecycleHistoryEntry } from '@/types/erp'
import {
    getAdjustmentOrders, createAdjustmentOrder, addAdjustmentLine, removeAdjustmentLine,
    postAdjustmentOrder, lockAdjustmentOrder, unlockAdjustmentOrder, verifyAdjustmentOrder,
    getAdjustmentOrderHistory,
} from '@/app/actions/inventory/adjustment-orders'
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

type AdjustmentLine = {
    id: number
    product: number
    product_name?: string
    warehouse_name?: string
    qty_adjustment: number
    amount_adjustment: number
    reason: string
    recovered_amount: number
    reflect_transfer_id?: number
    added_by_name?: string
    added_by?: { username?: string; first_name?: string }
}

export default function AdjustmentOrdersPage() {
    const { fmt } = useCurrency()
    const [orders, setOrders] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    /* Filters */
    const [filterStatus, setFilterStatus] = useState('')
    const [filterWh, setFilterWh] = useState('')
    const [search, setSearch] = useState('')

    /* Dialogs */
    const [showCreate, setShowCreate] = useState(false)
    const [showAddLine, setShowAddLine] = useState<number | null>(null)
    const [showHistory, setShowHistory] = useState<LifecycleHistoryEntry[] | null>(null)
    const [showUnlock, setShowUnlock] = useState<number | null>(null)
    const [unlockComment, setUnlockComment] = useState('')

    /* Create form */
    const [newWh, setNewWh] = useState('')
    const [newReason, setNewReason] = useState('')
    const [newNotes, setNewNotes] = useState('')

    /* Add line form */
    const [lineProduct, setLineProduct] = useState('')
    const [lineQty, setLineQty] = useState('')
    const [lineAmt, setLineAmt] = useState('')
    const [lineReason, setLineReason] = useState('')

    const loadData = useCallback(async () => {
        try {
            const [ordersData, whData] = await Promise.all([
                getAdjustmentOrders(),
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
        { key: 'supplier', label: 'Supplier', render: r => r.supplier_name || r.supplier?.name || '—' },
        { key: 'reference', label: 'Reference' },
        { key: 'total_qty_adjustment', label: 'QTY Adj.', align: 'right', render: r => r.total_qty_adjustment ?? r.lines?.length ?? 0 },
        { key: 'total_amount_adjustment', label: 'Amt Adj', align: 'right', render: r => fmt(r.total_amount_adjustment || 0) },
        { key: 'warehouse', label: 'Location', render: r => r.warehouse_name || r.warehouse?.name || '—' },
        { key: 'reason', label: 'Reason', render: r => r.reason || '—' },
    ]

    const detailColumns: DetailColumnDef<AdjustmentLine>[] = [
        { key: 'warehouse_name', label: 'Location', render: d => d.warehouse_name || '—' },
        { key: 'reflect_transfer_id', label: 'Reflect Transfer', render: d => d.reflect_transfer_id ? `#${d.reflect_transfer_id}` : '—' },
        { key: 'amount_adjustment', label: 'Total Amount', align: 'right', render: d => fmt(d.amount_adjustment || 0) },
        { key: 'recovered_amount', label: 'Recovered Amt', align: 'right', render: d => fmt(d.recovered_amount || 0) },
        { key: 'reason', label: 'Reason', render: d => d.reason || '—' },
        { key: 'added_by', label: 'Added By', render: d => d.added_by_name || d.added_by?.username || d.added_by?.first_name || '—' },
    ]

    /* ─── Filters ─────────────────────────────────── */
    const filters: FilterOption[] = [
        {
            key: 'status', label: 'Stock Adjustment',
            value: filterStatus,
            options: [
                { value: 'OPEN', label: 'Open' },
                { value: 'LOCKED', label: 'Locked' },
                { value: 'VERIFIED', label: 'Verified' },
                { value: 'CONFIRMED', label: 'Confirmed' },
            ]
        },
        {
            key: 'warehouse', label: 'Location',
            value: filterWh,
            options: warehouses.map(w => ({ value: String(w.id), label: w.name }))
        },
    ]

    const handleFilterChange = (key: string, value: string) => {
        const v = value === '__all__' ? '' : value
        if (key === 'status') setFilterStatus(v)
        if (key === 'warehouse') setFilterWh(v)
    }

    const filteredOrders = orders.filter(o => {
        if (filterStatus && o.lifecycle_status !== filterStatus) return false
        if (filterWh && String(o.warehouse_id || o.warehouse?.id) !== filterWh) return false
        if (search) {
            const s = search.toLowerCase()
            return (o.reference?.toLowerCase().includes(s) || o.reason?.toLowerCase().includes(s))
        }
        return true
    })

    /* ─── Actions ─────────────────────────────────── */
    const handleCreate = async () => {
        if (!newWh) { toast.error('Select a warehouse'); return }
        startTransition(async () => {
            try {
                await createAdjustmentOrder({
                    date: new Date().toISOString().split('T')[0],
                    warehouse: parseInt(newWh),
                    reason: newReason,
                    notes: newNotes,
                })
                toast.success('Adjustment order created')
                setShowCreate(false)
                setNewWh(''); setNewReason(''); setNewNotes('')
                loadData()
            } catch (e: any) { toast.error(e.message || 'Failed to create') }
        })
    }

    const handleAddLine = async () => {
        if (!lineProduct || !lineQty || !showAddLine) return
        startTransition(async () => {
            try {
                await addAdjustmentLine(showAddLine, {
                    product: parseInt(lineProduct),
                    qty_adjustment: parseFloat(lineQty),
                    amount_adjustment: parseFloat(lineAmt || '0'),
                    reason: lineReason,
                })
                toast.success('Line added')
                setShowAddLine(null)
                setLineProduct(''); setLineQty(''); setLineAmt(''); setLineReason('')
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
                    await lockAdjustmentOrder(id)
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
                await unlockAdjustmentOrder(showUnlock, unlockComment)
                toast.success('Order unlocked')
                setShowUnlock(null); setUnlockComment('')
                loadData()
            } catch (e: any) { toast.error(e.message || 'Failed to unlock') }
        })
    }

    const handleDelete = async (row: any) => {
        toast.info('Delete not yet implemented for orders')
    }

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <InventoryListView<any, AdjustmentLine>
                title="Stock Adjustment"
                addLabel="Add STOCK ADJUSTMENT"
                onAdd={() => setShowCreate(true)}
                onExport={() => toast.info('Export coming soon')}
                data={filteredOrders}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                filters={filters}
                onFilterChange={handleFilterChange}
                searchPlaceholder="Search by reference..."
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
                    <DialogHeader><DialogTitle>New Adjustment Order</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Warehouse</Label>
                            <Select value={newWh} onValueChange={setNewWh}>
                                <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
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
                    <DialogHeader><DialogTitle>Add Adjustment Line</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Product ID</Label><Input value={lineProduct} onChange={e => setLineProduct(e.target.value)} placeholder="Product ID" /></div>
                        <div><Label>Qty Adjustment</Label><Input type="number" value={lineQty} onChange={e => setLineQty(e.target.value)} /></div>
                        <div><Label>Amount Adjustment</Label><Input type="number" value={lineAmt} onChange={e => setLineAmt(e.target.value)} /></div>
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
