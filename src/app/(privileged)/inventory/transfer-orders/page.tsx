'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { Warehouse as WarehouseType, LifecycleHistoryEntry } from '@/types/erp'
import {
    getTransferOrders, createTransferOrder, addTransferLine,
    lockTransferOrder, unlockTransferOrder,
    getTransferOrderHistory,
} from '@/app/actions/inventory/transfer-orders'
import { getWarehouses } from '@/app/actions/inventory/valuation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Eye, Pencil } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type TransferLine = {
    id: number; product: number; product_name?: string
    from_warehouse_name?: string; to_warehouse_name?: string
    qty_transferred: number; reason: string; recovered_amount: number
    added_by_name?: string; added_by?: { username?: string; first_name?: string }
}

export default function TransferOrdersPage() {
    const { fmt } = useCurrency()
    const [orders, setOrders] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    const [filterStatus, setFilterStatus] = useState('')
    const [filterFromWh, setFilterFromWh] = useState('')
    const [filterToWh, setFilterToWh] = useState('')
    const [search, setSearch] = useState('')

    const [showCreate, setShowCreate] = useState(false)
    const [showAddLine, setShowAddLine] = useState<number | null>(null)
    const [showUnlock, setShowUnlock] = useState<number | null>(null)
    const [unlockComment, setUnlockComment] = useState('')
    const [newFromWh, setNewFromWh] = useState('')
    const [newToWh, setNewToWh] = useState('')
    const [newDriver, setNewDriver] = useState('')
    const [newReason, setNewReason] = useState('')
    const [newNotes, setNewNotes] = useState('')
    const [lineProduct, setLineProduct] = useState('')
    const [lineQty, setLineQty] = useState('')
    const [lineReason, setLineReason] = useState('')

    const loadData = useCallback(async () => {
        try {
            const [o, w] = await Promise.all([getTransferOrders(), getWarehouses()])
            setOrders(Array.isArray(o) ? o : o?.results || [])
            setWarehouses(Array.isArray(w) ? w : [])
        } catch { toast.error('Failed to load data') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const columns: ColumnDef<any>[] = [
        { key: 'date', label: 'Date', render: r => new Date(r.date || r.created_at).toLocaleDateString() },
        { key: 'reference', label: 'Reference' },
        { key: 'qty', label: 'QTY Transferred', align: 'right', render: r => r.total_qty_transferred || r.lines?.length || 0 },
        { key: 'from', label: 'From Location', render: r => r.from_warehouse_name || r.from_warehouse?.name || '—' },
        { key: 'to', label: 'To Location', render: r => r.to_warehouse_name || r.to_warehouse?.name || '—' },
        { key: 'reason', label: 'Reason', render: r => r.reason || '—' },
        { key: 'driver', label: 'Driver', render: r => r.driver || '—' },
    ]

    const filtered = orders.filter(o => {
        if (filterStatus && o.lifecycle_status !== filterStatus) return false
        if (filterFromWh && String(o.from_warehouse_id || o.from_warehouse?.id) !== filterFromWh) return false
        if (filterToWh && String(o.to_warehouse_id || o.to_warehouse?.id) !== filterToWh) return false
        if (search) {
            const s = search.toLowerCase()
            return o.reference?.toLowerCase().includes(s) || o.driver?.toLowerCase().includes(s) || o.reason?.toLowerCase().includes(s)
        }
        return true
    })

    const handleLockToggle = (row: any) => {
        const isLocked = row.lifecycle_status !== 'OPEN'
        if (isLocked) { setShowUnlock(row.id) }
        else { startTransition(async () => { try { await lockTransferOrder(row.id); toast.success('Locked'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } }) }
    }
    const handleUnlock = () => {
        if (!showUnlock) return
        startTransition(async () => { try { await unlockTransferOrder(showUnlock, unlockComment); toast.success('Unlocked'); setShowUnlock(null); setUnlockComment(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleCreate = () => {
        if (!newFromWh || !newToWh) { toast.error('Select both warehouses'); return }
        startTransition(async () => { try { await createTransferOrder({ date: new Date().toISOString().split('T')[0], from_warehouse: parseInt(newFromWh), to_warehouse: parseInt(newToWh), driver: newDriver, reason: newReason, notes: newNotes }); toast.success('Created'); setShowCreate(false); setNewFromWh(''); setNewToWh(''); setNewDriver(''); setNewReason(''); setNewNotes(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleAddLine = () => {
        if (!lineProduct || !lineQty || !showAddLine) return
        startTransition(async () => { try { await addTransferLine(showAddLine, { product: parseInt(lineProduct), qty_transferred: parseFloat(lineQty), reason: lineReason }); toast.success('Line added'); setShowAddLine(null); setLineProduct(''); setLineQty(''); setLineReason(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <TypicalListView<any, TransferLine>
                title="Stock Transfer"
                addLabel="Add TRANSFER STOCK"
                onAdd={() => setShowCreate(true)}
                onExport={() => toast.info('Export coming soon')}
                data={filtered}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                expandable={{
                    columns: [
                        { key: 'from', label: 'Location A', render: (d: TransferLine) => d.from_warehouse_name || '—' },
                        { key: 'to', label: 'Location B', render: (d: TransferLine) => d.to_warehouse_name || '—' },
                        { key: 'qty', label: 'QTY', align: 'right', render: (d: TransferLine) => d.qty_transferred },
                        { key: 'amt', label: 'Recovered Amt', align: 'right', render: (d: TransferLine) => fmt(d.recovered_amount || 0) },
                        { key: 'reason', label: 'Reason', render: (d: TransferLine) => d.reason || '—' },
                        { key: 'by', label: 'Added By', render: (d: TransferLine) => d.added_by_name || d.added_by?.username || '—' },
                    ],
                    getDetails: r => r.lines || [],
                    renderActions: (d, row) => (
                        <div className="flex gap-1">
                            <button className="p-1 rounded hover:bg-emerald-100"><Eye className="h-3.5 w-3.5 text-emerald-600" /></button>
                            <button className="p-1 rounded hover:bg-emerald-100"><Pencil className="h-3.5 w-3.5 text-emerald-600" /></button>
                        </div>
                    ),
                }}
                lifecycle={{
                    getStatus: r => {
                        const m: Record<string, any> = { OPEN: { label: 'Open', variant: 'default' }, LOCKED: { label: 'Locked', variant: 'warning' }, VERIFIED: { label: 'Verified', variant: 'success' }, CONFIRMED: { label: 'Approved', variant: 'success' } }
                        return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status, variant: 'default' }
                    },
                    getVerified: r => r.lifecycle_status === 'VERIFIED' || r.lifecycle_status === 'CONFIRMED',
                    getLocked: r => r.lifecycle_status !== 'OPEN',
                    onLockToggle: handleLockToggle,
                }}
                actions={{ onEdit: r => setShowAddLine(r.id), onDelete: () => toast.info('Delete not implemented') }}
            >
                {/* Filter bar rendered as child */}
                <TypicalFilter
                    search={{ placeholder: 'Search reference, driver...', value: search, onChange: setSearch }}
                    filters={[
                        { key: 'status', label: 'Status', type: 'select', options: [{ value: 'OPEN', label: 'Open' }, { value: 'LOCKED', label: 'Locked' }, { value: 'VERIFIED', label: 'Verified' }, { value: 'CONFIRMED', label: 'Confirmed' }] },
                        { key: 'from_warehouse', label: 'Location From', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
                        { key: 'to_warehouse', label: 'Location To', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
                    ]}
                    values={{ status: filterStatus, from_warehouse: filterFromWh, to_warehouse: filterToWh }}
                    onChange={(k, v) => { const s = v === '' ? '' : String(v); if (k === 'status') setFilterStatus(s); if (k === 'from_warehouse') setFilterFromWh(s); if (k === 'to_warehouse') setFilterToWh(s) }}
                    onReset={() => { setFilterStatus(''); setFilterFromWh(''); setFilterToWh(''); setSearch('') }}
                />
            </TypicalListView>

            {/* Dialogs */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent><DialogHeader><DialogTitle>New Transfer Order</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>From Warehouse</Label><Select value={newFromWh} onValueChange={setNewFromWh}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>To Warehouse</Label><Select value={newToWh} onValueChange={setNewToWh}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Driver</Label><Input value={newDriver} onChange={e => setNewDriver(e.target.value)} /></div>
                        <div><Label>Reason</Label><Input value={newReason} onChange={e => setNewReason(e.target.value)} /></div>
                        <div><Label>Notes</Label><Input value={newNotes} onChange={e => setNewNotes(e.target.value)} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate} disabled={isPending} className="bg-emerald-500 hover:bg-emerald-600">Create</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={!!showAddLine} onOpenChange={() => setShowAddLine(null)}>
                <DialogContent><DialogHeader><DialogTitle>Add Transfer Line</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Product ID</Label><Input value={lineProduct} onChange={e => setLineProduct(e.target.value)} /></div>
                        <div><Label>Quantity</Label><Input type="number" value={lineQty} onChange={e => setLineQty(e.target.value)} /></div>
                        <div><Label>Reason</Label><Input value={lineReason} onChange={e => setLineReason(e.target.value)} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowAddLine(null)}>Cancel</Button><Button onClick={handleAddLine} disabled={isPending} className="bg-emerald-500 hover:bg-emerald-600">Add</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={!!showUnlock} onOpenChange={() => setShowUnlock(null)}>
                <DialogContent><DialogHeader><DialogTitle>Unlock Order</DialogTitle></DialogHeader>
                    <div><Label>Comment (required)</Label><Input value={unlockComment} onChange={e => setUnlockComment(e.target.value)} /></div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowUnlock(null)}>Cancel</Button><Button onClick={handleUnlock} disabled={isPending || !unlockComment}>Unlock</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
