'use client';

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { Warehouse as WarehouseType } from '@/types/erp'
import {
    getTransferOrders, createTransferOrder, addTransferLine,
    lockTransferOrder, unlockTransferOrder, approveTransferOrder, cancelTransferOrder
} from '@/app/actions/inventory/transfer-orders'
import { getWarehouses } from '@/app/actions/inventory/valuation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Eye, Truck, Package, MapPin, CheckCircle2, RefreshCw, AlertCircle, ArrowRightLeft, Clock, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type TransferLine = {
    id: number; product: number; product_name?: string
    qty_transferred: number; from_warehouse_name?: string; to_warehouse_name?: string
    reason?: string; added_by_name?: string
}

const ALL_COLUMNS: ColumnDef<any>[] = [
    { key: 'date', label: 'Transit Date', sortable: true, alwaysVisible: true },
    { key: 'reference', label: 'Transit ID', sortable: true, alwaysVisible: true },
    { key: 'route', label: 'Logistics Route' },
    { key: 'units', label: 'Unit Volume', align: 'right' },
    { key: 'driver', label: 'Courier/Driver' },
]

export default function InterTerminalTransitPage() {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inventory_transfers_v3', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 25,
        sortKey: 'date',
        sortDir: 'desc',
    })

    const [orders, setOrders] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<WarehouseType[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())

    const [filterStatus, setFilterStatus] = useState('')
    const [filterSource, setFilterSource] = useState('')
    const [filterDest, setFilterDest] = useState('')
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
        } catch { toast.error('Logistics engine sync failed') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    // KPI Calculations
    const inTransit = orders.filter(o => o.lifecycle_status === 'LOCKED').length
    const pendingDispatch = orders.filter(o => o.lifecycle_status === 'OPEN').length
    const totalVolume = orders.reduce((sum, o) => sum + (o.total_qty_transferred || 0), 0)

    const columns: ColumnDef<any>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: any) => React.ReactNode> = {
            date: r => <span className="text-gray-500 font-medium">{new Date(r.date || r.created_at).toLocaleDateString()}</span>,
            reference: r => <span className="font-mono font-bold text-gray-900">TRF-{r.reference || r.id}</span>,
            route: r => (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-[9px] font-black">{r.from_warehouse_name || r.from_warehouse?.name || 'SRC'}</Badge>
                    <ArrowRightLeft size={10} className="text-gray-300" />
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[9px] font-black">{r.to_warehouse_name || r.to_warehouse?.name || 'DEST'}</Badge>
                </div>
            ),
            units: r => <span className="font-black text-gray-900">{r.total_qty_transferred || r.lines?.length || 0} U</span>,
            driver: r => <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Truck size={12} className="text-gray-300" />{r.driver || 'Unassigned'}</span>,
        }
        return { ...c, render: renderers[c.key] }
    })

    const filtered = orders.filter(o => {
        if (filterStatus && o.lifecycle_status !== filterStatus) return false
        if (filterSource && String(o.from_warehouse_id || o.from_warehouse?.id) !== filterSource) return false
        if (filterDest && String(o.to_warehouse_id || o.to_warehouse?.id) !== filterDest) return false
        if (search) { const s = search.toLowerCase(); return o.reference?.toLowerCase().includes(s) || o.driver?.toLowerCase().includes(s) }
        return true
    })

    const handleLockToggle = (row: any) => {
        if (row.lifecycle_status !== 'OPEN') { setShowUnlock(row.id) }
        else { startTransition(async () => { try { await lockTransferOrder(row.id); toast.success('Transit Initiated'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } }) }
    }
    const handleUnlock = () => {
        if (!showUnlock) return
        startTransition(async () => { try { await unlockTransferOrder(showUnlock, unlockComment); toast.success('Transit Aborted'); setShowUnlock(null); setUnlockComment(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleApprove = (row: any) => {
        startTransition(async () => { try { await approveTransferOrder(row.id); toast.success('Order Approved'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleCancel = (row: any) => {
        startTransition(async () => { try { await cancelTransferOrder(row.id); toast.success('Order Canceled'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleCreate = () => {
        if (!newFromWh || !newToWh) { toast.error('Route configuration incomplete'); return }
        if (newFromWh === newToWh) { toast.error('Source and Destination must differ'); return }
        startTransition(async () => { try { await createTransferOrder({ date: new Date().toISOString().split('T')[0], from_warehouse: parseInt(newFromWh), to_warehouse: parseInt(newToWh), driver: newDriver, reason: newReason, notes: newNotes }); toast.success('Transit Manifest Created'); setShowCreate(false); setNewFromWh(''); setNewToWh(''); setNewDriver(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleAddLine = () => {
        if (!lineProduct || !lineQty || !showAddLine) return
        startTransition(async () => { try { await addTransferLine(showAddLine, { product: parseInt(lineProduct), qty_transferred: parseFloat(lineQty), reason: lineReason }); toast.success('Cargo added to manifest'); setShowAddLine(null); setLineProduct(''); setLineQty(''); setLineReason(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                            <Truck size={28} className="text-white" />
                        </div>
                        Inter-Terminal <span className="text-blue-600">Transit</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Global Logistics & Cargo Movements</p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Logistics Engine Active</span>
                </div>
            </header>

            {/* Logistics Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ArrowRightLeft size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Active In-Transit</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{inTransit}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Clock size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Pending Dispatch</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{pendingDispatch}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-stone-50 text-stone-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Package size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Managed Volume</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{totalVolume} U</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TypicalListView<any, TransferLine>
                title="Logistics Manifests"
                addLabel="NEW TRANSIT"
                onAdd={() => setShowCreate(true)}
                data={filtered}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={k => settings.setSort(k)}
                selection={{
                    selectedIds,
                    onSelectionChange: setSelectedIds
                }}
                bulkActions={
                    <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-100 font-bold px-4" onClick={() => toast.error('Bulk deletion restricted')}>
                        <Trash2 className="h-4 w-4 mr-2" /> DELETE SELECTED
                    </Button>
                }
                headerExtras={
                    <Button onClick={loadData} variant="ghost" className="h-8 w-8 p-0 text-stone-400 hover:text-blue-600">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                }
                expandable={{
                    columns: [
                        { key: 'line_prod', label: 'SKU/ID', render: (d: TransferLine) => <span className="font-mono font-bold">{d.product}</span> },
                        { key: 'item', label: 'Cargo Item', render: (d: TransferLine) => d.product_name || 'Generic Asset' },
                        { key: 'qty', label: 'Volume', align: 'right', render: (d: TransferLine) => <span className="font-black text-blue-600">{d.qty_transferred} U</span> },
                        { key: 'reason', label: 'Justification', render: (d: TransferLine) => <span className="italic text-gray-400">{d.reason || 'Standard redistribution'}</span> },
                        { key: 'by', label: 'Handler', render: (d: TransferLine) => <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-0">{d.added_by_name || 'System'}</Badge> },
                    ],
                    getDetails: r => r.lines || [],
                    renderActions: (d) => (
                        <div className="flex gap-1">
                            <button className="p-1 rounded hover:bg-blue-50"><Eye className="h-3.5 w-3.5 text-blue-600" /></button>
                        </div>
                    ),
                }}
                lifecycle={{
                    getStatus: r => {
                        const m: Record<string, any> = {
                            OPEN: { label: 'Draft / Pending', variant: 'default' },
                            APPROVED: { label: 'Approved / Ready', variant: 'info' },
                            LOCKED: { label: 'In Transit', variant: 'warning' },
                            VERIFIED: { label: 'Docked', variant: 'success' },
                            CONFIRMED: { label: 'Fulfillment Finalized', variant: 'success' },
                            CANCELED: { label: 'Aborted', variant: 'danger' }
                        }
                        return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status, variant: 'default' }
                    },
                    getVerified: r => r.lifecycle_status === 'VERIFIED' || r.lifecycle_status === 'CONFIRMED',
                    getLocked: r => r.lifecycle_status !== 'OPEN' && r.lifecycle_status !== 'APPROVED',
                    getApproved: r => r.lifecycle_status === 'APPROVED' || r.lifecycle_status === 'LOCKED' || r.lifecycle_status === 'VERIFIED' || r.lifecycle_status === 'CONFIRMED',
                    getCanceled: r => r.lifecycle_status === 'CANCELED',
                    onLockToggle: handleLockToggle,
                    onApprove: handleApprove,
                    onCancel: handleCancel,
                }}
                actions={{ onView: r => toast.info(`Viewing TRF-${r.id}`), onEdit: r => setShowAddLine(r.id), onDelete: () => toast.info('Fleet override required for cancellation') }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search Transit ID or Driver...', value: search, onChange: setSearch }}
                    filters={[
                        { key: 'status', label: 'Logistics Status', type: 'select', options: [{ value: 'OPEN', label: 'Open' }, { value: 'APPROVED', label: 'Approved' }, { value: 'LOCKED', label: 'In Transit' }, { value: 'VERIFIED', label: 'Verified' }, { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'CANCELED', label: 'Canceled' }] },
                        { key: 'src', label: 'Origin', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
                        { key: 'dest', label: 'Destination', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
                    ]}
                    values={{ status: filterStatus, src: filterSource, dest: filterDest }}
                    onChange={(k, v) => { const s = v === '' ? '' : String(v); if (k === 'status') setFilterStatus(s); if (k === 'src') setFilterSource(s); if (k === 'dest') setFilterDest(s) }}
                />
            </TypicalListView>

            {/* Logistics Dialogs */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Generate Transit Manifest</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Source Terminal</Label>
                                <Select value={newFromWh} onValueChange={setNewFromWh}>
                                    <SelectTrigger className="rounded-xl border-gray-100 h-12 text-rose-600">
                                        <SelectValue placeholder="Dispatch From" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-gray-100">
                                        {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Destination Terminal</Label>
                                <Select value={newToWh} onValueChange={setNewToWh}>
                                    <SelectTrigger className="rounded-xl border-gray-100 h-12 text-emerald-600">
                                        <SelectValue placeholder="Receive At" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-gray-100">
                                        {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Assigned Driver / Fleet Agent</Label>
                            <Input className="rounded-xl border-gray-100 h-12" placeholder="Full name of personnel" value={newDriver} onChange={e => setNewDriver(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Operational Reason</Label>
                            <Input className="rounded-xl border-gray-100 h-12" placeholder="e.g. Stock replenishment, Re-balancing" value={newReason} onChange={e => setNewReason(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="pt-6">
                        <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl font-bold">Cancel</Button>
                        <Button onClick={handleCreate} disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-bold h-12 shadow-lg shadow-blue-200">Activate Manifest</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!showAddLine} onOpenChange={() => setShowAddLine(null)}>
                <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Register Cargo Entry</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Asset Identifier</Label>
                            <Input className="rounded-xl border-gray-100 h-12 font-mono" placeholder="Product SKU or Internal ID" value={lineProduct} onChange={e => setLineProduct(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Transfer Quantity</Label>
                            <Input type="number" className="rounded-xl border-gray-100 h-12 font-black text-blue-600" placeholder="0" value={lineQty} onChange={e => setLineQty(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="pt-6">
                        <Button variant="ghost" onClick={() => setShowAddLine(null)} className="rounded-xl font-bold">Cancel</Button>
                        <Button onClick={handleAddLine} disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-bold h-12">Load onto Transit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!showUnlock} onOpenChange={() => setShowUnlock(null)}>
                <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-rose-600">Abort Critical Transit</DialogTitle>
                    </DialogHeader>
                    <div className="pt-4 space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Internal Abort Protocol Notes</Label>
                        <Input className="rounded-xl border-gray-100 h-12" placeholder="Why is this transit being reverted?" value={unlockComment} onChange={e => setUnlockComment(e.target.value)} />
                    </div>
                    <DialogFooter className="pt-6">
                        <Button variant="ghost" onClick={() => setShowUnlock(null)} className="rounded-xl font-bold">Cancel</Button>
                        <Button onClick={handleUnlock} disabled={isPending || !unlockComment} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-8 font-bold h-12 shadow-lg shadow-rose-200">Abound Transit</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
