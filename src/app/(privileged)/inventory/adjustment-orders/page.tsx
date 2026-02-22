'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { Warehouse as WarehouseType } from '@/types/erp'
import {
    getAdjustmentOrders, createAdjustmentOrder, addAdjustmentLine,
    lockAdjustmentOrder, unlockAdjustmentOrder,
} from '@/app/actions/inventory/adjustment-orders'
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

type AdjustmentLine = {
    id: number; product: number; product_name?: string; warehouse_name?: string
    qty_adjustment: number; amount_adjustment: number; reason: string
    recovered_amount: number; reflect_transfer_id?: number
    added_by_name?: string; added_by?: { username?: string; first_name?: string }
}

export default function AdjustmentOrdersPage() {
    const { fmt } = useCurrency()
    const [orders, setOrders] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    const [filterStatus, setFilterStatus] = useState('')
    const [filterWh, setFilterWh] = useState('')
    const [search, setSearch] = useState('')

    const [showCreate, setShowCreate] = useState(false)
    const [showAddLine, setShowAddLine] = useState<number | null>(null)
    const [showUnlock, setShowUnlock] = useState<number | null>(null)
    const [unlockComment, setUnlockComment] = useState('')
    const [newWh, setNewWh] = useState('')
    const [newReason, setNewReason] = useState('')
    const [newNotes, setNewNotes] = useState('')
    const [lineProduct, setLineProduct] = useState('')
    const [lineQty, setLineQty] = useState('')
    const [lineAmt, setLineAmt] = useState('')
    const [lineReason, setLineReason] = useState('')

    const loadData = useCallback(async () => {
        try {
            const [o, w] = await Promise.all([getAdjustmentOrders(), getWarehouses()])
            setOrders(Array.isArray(o) ? o : o?.results || [])
            setWarehouses(Array.isArray(w) ? w : [])
        } catch { toast.error('Failed to load data') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const columns: ColumnDef<any>[] = [
        { key: 'date', label: 'Date', render: r => new Date(r.date || r.created_at).toLocaleDateString() },
        { key: 'supplier', label: 'Supplier', render: r => r.supplier_name || r.supplier?.name || '—' },
        { key: 'reference', label: 'Reference' },
        { key: 'qty', label: 'QTY Adj.', align: 'right', render: r => r.total_qty_adjustment ?? r.lines?.length ?? 0 },
        { key: 'amt', label: 'Amt Adj', align: 'right', render: r => fmt(r.total_amount_adjustment || 0) },
        { key: 'wh', label: 'Location', render: r => r.warehouse_name || r.warehouse?.name || '—' },
        { key: 'reason', label: 'Reason', render: r => r.reason || '—' },
    ]

    const filtered = orders.filter(o => {
        if (filterStatus && o.lifecycle_status !== filterStatus) return false
        if (filterWh && String(o.warehouse_id || o.warehouse?.id) !== filterWh) return false
        if (search) { const s = search.toLowerCase(); return o.reference?.toLowerCase().includes(s) || o.reason?.toLowerCase().includes(s) }
        return true
    })

    const handleLockToggle = (row: any) => {
        if (row.lifecycle_status !== 'OPEN') { setShowUnlock(row.id) }
        else { startTransition(async () => { try { await lockAdjustmentOrder(row.id); toast.success('Locked'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } }) }
    }
    const handleUnlock = () => {
        if (!showUnlock) return
        startTransition(async () => { try { await unlockAdjustmentOrder(showUnlock, unlockComment); toast.success('Unlocked'); setShowUnlock(null); setUnlockComment(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleCreate = () => {
        if (!newWh) { toast.error('Select a warehouse'); return }
        startTransition(async () => { try { await createAdjustmentOrder({ date: new Date().toISOString().split('T')[0], warehouse: parseInt(newWh), reason: newReason, notes: newNotes }); toast.success('Created'); setShowCreate(false); setNewWh(''); setNewReason(''); setNewNotes(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleAddLine = () => {
        if (!lineProduct || !lineQty || !showAddLine) return
        startTransition(async () => { try { await addAdjustmentLine(showAddLine, { product: parseInt(lineProduct), qty_adjustment: parseFloat(lineQty), amount_adjustment: parseFloat(lineAmt || '0'), reason: lineReason }); toast.success('Line added'); setShowAddLine(null); setLineProduct(''); setLineQty(''); setLineAmt(''); setLineReason(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <TypicalListView<any, AdjustmentLine>
                title="Stock Adjustment"
                addLabel="Add STOCK ADJUSTMENT"
                onAdd={() => setShowCreate(true)}
                onExport={() => toast.info('Export coming soon')}
                data={filtered}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                expandable={{
                    columns: [
                        { key: 'wh', label: 'Location', render: (d: AdjustmentLine) => d.warehouse_name || '—' },
                        { key: 'reflect', label: 'Reflect Transfer', render: (d: AdjustmentLine) => d.reflect_transfer_id ? `#${d.reflect_transfer_id}` : '—' },
                        { key: 'amt', label: 'Total Amount', align: 'right', render: (d: AdjustmentLine) => fmt(d.amount_adjustment || 0) },
                        { key: 'recovered', label: 'Recovered Amt', align: 'right', render: (d: AdjustmentLine) => fmt(d.recovered_amount || 0) },
                        { key: 'reason', label: 'Reason', render: (d: AdjustmentLine) => d.reason || '—' },
                        { key: 'by', label: 'Added By', render: (d: AdjustmentLine) => d.added_by_name || d.added_by?.username || '—' },
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
                <TypicalFilter
                    search={{ placeholder: 'Search reference...', value: search, onChange: setSearch }}
                    filters={[
                        { key: 'status', label: 'Stock Adjustment', type: 'select', options: [{ value: 'OPEN', label: 'Open' }, { value: 'LOCKED', label: 'Locked' }, { value: 'VERIFIED', label: 'Verified' }, { value: 'CONFIRMED', label: 'Confirmed' }] },
                        { key: 'warehouse', label: 'Location', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
                    ]}
                    values={{ status: filterStatus, warehouse: filterWh }}
                    onChange={(k, v) => { const s = v === '' ? '' : String(v); if (k === 'status') setFilterStatus(s); if (k === 'warehouse') setFilterWh(s) }}
                    onReset={() => { setFilterStatus(''); setFilterWh(''); setSearch('') }}
                />
            </TypicalListView>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent><DialogHeader><DialogTitle>New Adjustment Order</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Warehouse</Label><Select value={newWh} onValueChange={setNewWh}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent></Select></div>
                        <div><Label>Reason</Label><Input value={newReason} onChange={e => setNewReason(e.target.value)} /></div>
                        <div><Label>Notes</Label><Input value={newNotes} onChange={e => setNewNotes(e.target.value)} /></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={handleCreate} disabled={isPending} className="bg-emerald-500 hover:bg-emerald-600">Create</Button></DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={!!showAddLine} onOpenChange={() => setShowAddLine(null)}>
                <DialogContent><DialogHeader><DialogTitle>Add Adjustment Line</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div><Label>Product ID</Label><Input value={lineProduct} onChange={e => setLineProduct(e.target.value)} /></div>
                        <div><Label>Qty Adjustment</Label><Input type="number" value={lineQty} onChange={e => setLineQty(e.target.value)} /></div>
                        <div><Label>Amount Adjustment</Label><Input type="number" value={lineAmt} onChange={e => setLineAmt(e.target.value)} /></div>
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
