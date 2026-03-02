'use client';

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { Warehouse as WarehouseType } from '@/types/erp'
import {
    getTransferOrders, createTransferOrder, addTransferLine,
    lockTransferOrder, unlockTransferOrder, approveTransferOrder, cancelTransferOrder,
    promoteToExecution
} from '@/app/actions/inventory/transfer-orders'
import { getWarehouses } from '@/app/actions/inventory/valuation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Eye, MessageSquare, Package, AlertCircle, CheckCircle2, RefreshCw, Play, ArrowRightLeft } from 'lucide-react'
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
    { key: 'date', label: 'Strategy Date', sortable: true, alwaysVisible: true },
    { key: 'reference', label: 'Manifest ID', sortable: true, alwaysVisible: true },
    { key: 'route', label: 'Planned Route' },
    { key: 'units', label: 'Est. Volume', align: 'right' },
    { key: 'status_label', label: 'Strategy Status' },
]

export default function LogisticsStrategyPage() {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inventory_transfers_strategy_v1', {
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
        } catch { toast.error('Failed to load') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const columns: ColumnDef<any>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: any) => React.ReactNode> = {
            date: r => <span className="text-gray-500 font-medium">{new Date(r.date || r.created_at).toLocaleDateString()}</span>,
            reference: r => <span className="font-mono font-bold text-gray-900">MANIFEST-{r.reference || r.id}</span>,
            route: r => (
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-100 text-[9px] font-black">{r.from_warehouse_name || r.from_warehouse?.name || 'SRC'}</Badge>
                    <ArrowRightLeft size={10} className="text-gray-300" />
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-100 text-[9px] font-black">{r.to_warehouse_name || r.to_warehouse?.name || 'DEST'}</Badge>
                </div>
            ),
            units: r => <span className="font-black text-gray-900">{r.total_qty_transferred || r.lines?.length || 0} U</span>,
            status_label: r => {
                const status = r.lifecycle_status || r.status || 'OPEN'
                const variants: Record<string, string> = {
                    OPEN: 'bg-blue-50 text-blue-700 border-blue-100',
                    EXECUTED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                    APPROVED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
                    CANCELED: 'bg-rose-50 text-rose-700 border-rose-100'
                }
                return <Badge variant="outline" className={`${variants[status] || 'bg-gray-50'} text-[10px] uppercase font-black`}>{status}</Badge>
            }
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

    const handlePromote = (id: number) => {
        startTransition(async () => {
            try {
                await promoteToExecution(id)
                toast.success('Strategy promoted to Execution Draft')
                loadData()
            } catch (e: any) {
                toast.error(e.message || 'Promotion failed')
            }
        })
    }

    const handleCreate = () => {
        if (!newFromWh || !newToWh) { toast.error('Check route'); return }
        startTransition(async () => {
            try {
                await createTransferOrder({ date: new Date().toISOString().split('T')[0], from_warehouse: parseInt(newFromWh), to_warehouse: parseInt(newToWh), driver: newDriver, reason: newReason, notes: newNotes })
                toast.success('Strategy Draft Created')
                setShowCreate(false)
                loadData()
            } catch (e: any) { toast.error('Failed') }
        })
    }

    const handleAddLine = () => {
        if (!lineProduct || !lineQty || !showAddLine) return
        startTransition(async () => {
            try {
                await addTransferLine(showAddLine, { product: parseInt(lineProduct), qty_transferred: parseFloat(lineQty), reason: lineReason })
                toast.success('Items added to strategy')
                setShowAddLine(null)
                loadData()
            } catch (e: any) { toast.error('Failed') }
        })
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center border-b pb-6">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <ArrowRightLeft size={20} className="text-indigo-600" />
                        <h1 className="page-header-title  tracking-tighter uppercase">
                            Logistics <span className="text-indigo-600">Strategy</span>
                        </h1>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase text-indigo-700 tracking-widest">Internal Strategy</span>
                    </div>
                </div>
            </header>

            <TypicalListView<any, TransferLine>
                title="Planning Manifests"
                addLabel="NEW STRATEGY"
                onAdd={() => setShowCreate(true)}
                data={filtered}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                headerExtras={
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-gray-400">
                        <Package size={14} /> Total Planned: {orders.length}
                    </div>
                }
                expandable={{
                    columns: [
                        { key: 'line_prod', label: 'SKU/ID', render: (d: TransferLine) => <span className="font-mono font-bold">{d.product}</span> },
                        { key: 'item', label: 'Proposed Item', render: (d: TransferLine) => d.product_name || 'Generic Asset' },
                        { key: 'qty', label: 'Target Qty', align: 'right', render: (d: TransferLine) => <span className="font-black text-indigo-600">{d.qty_transferred} U</span> },
                        { key: 'reason', label: 'Strategy Notes', render: (d: TransferLine) => <span className="italic text-gray-400">{d.reason || 'Standard redistribution'}</span> },
                    ],
                    getDetails: r => r.lines || [],
                    renderActions: (row, parent) => (
                        <div className="flex gap-2">
                            {(parent.lifecycle_status === 'OPEN' || parent.lifecycle_status === 'APPROVED') && (
                                <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] h-7 px-3 rounded-lg flex items-center gap-2 shadow-sm"
                                    onClick={() => handlePromote(parent.id)}
                                >
                                    <Play size={10} fill="currentColor" /> EXECUTE NOW
                                </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] font-bold text-gray-400">VIEW FULL HISTORY</Button>
                        </div>
                    ),
                }}
                lifecycle={{
                    getStatus: r => {
                        const m: Record<string, any> = {
                            OPEN: { label: 'Draft / Discussion', variant: 'default' },
                            APPROVED: { label: 'Approved Strategy', variant: 'info' },
                            EXECUTED: { label: 'Converted to Action', variant: 'success' },
                            CANCELED: { label: 'Strategy Aborted', variant: 'danger' }
                        }
                        return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status, variant: 'default' }
                    },
                    getLocked: r => r.lifecycle_status === 'EXECUTED' || r.lifecycle_status === 'CANCELED',
                    onApprove: (row) => startTransition(async () => { try { await approveTransferOrder(row.id); toast.success('Strategy Approved'); loadData() } catch { toast.error('Failed') } }),
                    onCancel: (row) => startTransition(async () => { try { await cancelTransferOrder(row.id); toast.success('Strategy Canceled'); loadData() } catch { toast.error('Failed') } }),
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search Strategy ID...', value: search, onChange: setSearch }}
                    filters={[
                        { key: 'status', label: 'Strategy Status', type: 'select', options: [{ value: 'OPEN', label: 'Draft' }, { value: 'APPROVED', label: 'Approved' }, { value: 'EXECUTED', label: 'Executed' }, { value: 'CANCELED', label: 'Canceled' }] },
                        { key: 'src', label: 'Origin', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
                        { key: 'dest', label: 'Destination', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
                    ]}
                    values={{ status: filterStatus, src: filterSource, dest: filterDest }}
                    onChange={(k, v) => { const s = v === '' ? '' : String(v); if (k === 'status') setFilterStatus(s); if (k === 'src') setFilterSource(s); if (k === 'dest') setFilterDest(s) }}
                />
            </TypicalListView>

            {/* Dialogs */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-indigo-900">New Strategy Document</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proposed Origin</Label>
                                <Select value={newFromWh} onValueChange={setNewFromWh}>
                                    <SelectTrigger className="rounded-xl border-gray-100 h-12 fon-bold">
                                        <SelectValue placeholder="Dispatch From" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-gray-100">
                                        {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Proposed Destination</Label>
                                <Select value={newToWh} onValueChange={setNewToWh}>
                                    <SelectTrigger className="rounded-xl border-gray-100 h-12 font-bold">
                                        <SelectValue placeholder="Receive At" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-gray-100">
                                        {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Strategic Motivation</Label>
                            <Input className="rounded-xl border-gray-100 h-12" placeholder="Why are we proposing this movement?" value={newReason} onChange={e => setNewReason(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="pt-6">
                        <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl font-bold">Cancel</Button>
                        <Button onClick={handleCreate} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 font-bold h-12 shadow-lg shadow-indigo-200">Start Discussion</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
