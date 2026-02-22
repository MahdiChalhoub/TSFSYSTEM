'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { Warehouse as WarehouseType } from '@/types/erp'
import {
    getAdjustmentOrders, createAdjustmentOrder, addAdjustmentLine,
    lockAdjustmentOrder, unlockAdjustmentOrder, approveAdjustmentOrder, cancelAdjustmentOrder
} from '@/app/actions/inventory/adjustment-orders'
import { getWarehouses } from '@/app/actions/inventory/valuation'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { Eye, Pencil, Sparkles, Package, AlertCircle, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type AdjustmentLine = {
    id: number; product: number; product_name?: string; warehouse_name?: string
    qty_adjustment: number; amount_adjustment: number; reason: string
    recovered_amount: number; reflect_transfer_id?: number
    added_by_name?: string; added_by?: { username?: string; first_name?: string }
}

const ALL_COLUMNS: ColumnDef<any>[] = [
    { key: 'date', label: 'Date', sortable: true, alwaysVisible: true },
    { key: 'reference', label: 'Reference', sortable: true, alwaysVisible: true },
    { key: 'qty', label: 'Units Adj.', align: 'right' },
    { key: 'amt', label: 'Financial Impact', align: 'right' },
    { key: 'wh', label: 'Terminal Location' },
    { key: 'reason', label: 'Adjustment Reason' },
]

export default function DiscrepancyResolutionPage() {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inventory_adjustments_v3', {
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
        } catch { toast.error('Failed to resolve sync engine') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    // KPI Calculations
    const activeDiscrepancies = orders.filter(o => o.lifecycle_status === 'OPEN' || o.lifecycle_status === 'LOCKED').length
    const valueAtRisk = orders.filter(o => o.lifecycle_status === 'OPEN').reduce((sum, o) => sum + (o.total_amount_adjustment || 0), 0)
    const resolutionRate = orders.length > 0 ? (orders.filter(o => o.lifecycle_status === 'CONFIRMED' || o.lifecycle_status === 'VERIFIED').length / orders.length * 100).toFixed(1) : '0.0'

    const columns: ColumnDef<any>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: any) => React.ReactNode> = {
            date: r => <span className="text-gray-500 font-medium">{new Date(r.date || r.created_at).toLocaleDateString()}</span>,
            reference: r => <span className="font-mono font-bold text-gray-900">ADJ-{r.reference || r.id}</span>,
            qty: r => <span className={`font-black ${(r.total_qty_adjustment || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{r.total_qty_adjustment ?? r.lines?.length ?? 0}</span>,
            amt: r => <span className="font-bold text-gray-900">{fmt(r.total_amount_adjustment || 0)}</span>,
            wh: r => <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 uppercase text-[10px] font-black">{r.warehouse_name || r.warehouse?.name || 'GLOBAL'}</Badge>,
            reason: r => <span className="text-xs font-medium text-gray-400 italic">{r.reason || 'No justification provided'}</span>,
        }
        return { ...c, render: renderers[c.key] }
    })

    const filtered = orders.filter(o => {
        if (filterStatus && o.lifecycle_status !== filterStatus) return false
        if (filterWh && String(o.warehouse_id || o.warehouse?.id) !== filterWh) return false
        if (search) { const s = search.toLowerCase(); return o.reference?.toLowerCase().includes(s) || o.reason?.toLowerCase().includes(s) }
        return true
    })

    const handleLockToggle = (row: any) => {
        if (row.lifecycle_status !== 'OPEN') { setShowUnlock(row.id) }
        else { startTransition(async () => { try { await lockAdjustmentOrder(row.id); toast.success('Discrepancy Locked'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } }) }
    }
    const handleUnlock = () => {
        if (!showUnlock) return
        startTransition(async () => { try { await unlockAdjustmentOrder(showUnlock, unlockComment); toast.success('Discrepancy Reopened'); setShowUnlock(null); setUnlockComment(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleApprove = (row: any) => {
        startTransition(async () => { try { await approveAdjustmentOrder(row.id); toast.success('Order Approved'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleCancel = (row: any) => {
        startTransition(async () => { try { await cancelAdjustmentOrder(row.id); toast.success('Order Canceled'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleCreate = () => {
        if (!newWh) { toast.error('Terminal selection required'); return }
        startTransition(async () => { try { await createAdjustmentOrder({ date: new Date().toISOString().split('T')[0], warehouse: parseInt(newWh), reason: newReason, notes: newNotes }); toast.success('Resolution Thread Created'); setShowCreate(false); setNewWh(''); setNewReason(''); setNewNotes(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }
    const handleAddLine = () => {
        if (!lineProduct || !lineQty || !showAddLine) return
        startTransition(async () => { try { await addAdjustmentLine(showAddLine, { product: parseInt(lineProduct), qty_adjustment: parseFloat(lineQty), amount_adjustment: parseFloat(lineAmt || '0'), reason: lineReason }); toast.success('Discrepancy logged'); setShowAddLine(null); setLineProduct(''); setLineQty(''); setLineAmt(''); setLineReason(''); loadData() } catch (e: any) { toast.error(e.message || 'Failed') } })
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Sparkles size={28} className="text-white" />
                        </div>
                        Discrepancy <span className="text-emerald-600">Resolution</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Stock Adjustment & Governance Engine</p>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Adjustment Logic Active</span>
                </div>
            </header>

            {/* Analytics Ledger */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <AlertCircle size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Active Discrepancies</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{activeDiscrepancies}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Package size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Value at Risk</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmt(valueAtRisk)}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <CheckCircle2 size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Resolution Rate</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{resolutionRate}%</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TypicalListView<any, AdjustmentLine>
                title="Resolution Logs"
                addLabel="INIT RESOLUTION"
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
                    <Button onClick={loadData} variant="ghost" className="h-8 w-8 p-0 text-stone-400 hover:text-emerald-600">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                }
                expandable={{
                    columns: [
                        { key: 'wh', label: 'Terminal', render: (d: AdjustmentLine) => d.warehouse_name || '—' },
                        { key: 'reflect', label: 'Sync Ref', render: (d: AdjustmentLine) => d.reflect_transfer_id ? `#TRF-${d.reflect_transfer_id}` : '—' },
                        { key: 'amt', label: 'Position Impact', align: 'right', render: (d: AdjustmentLine) => <span className="font-bold">{fmt(d.amount_adjustment || 0)}</span> },
                        { key: 'recovered', label: 'Recovered', align: 'right', render: (d: AdjustmentLine) => <span className="text-emerald-600 font-bold">{fmt(d.recovered_amount || 0)}</span> },
                        { key: 'reason', label: 'Internal Notes', render: (d: AdjustmentLine) => <span className="italic text-gray-400">{d.reason || '—'}</span> },
                        { key: 'by', label: 'Audit Trail', render: (d: AdjustmentLine) => <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-0">{d.added_by_name || d.added_by?.username || 'System'}</Badge> },
                    ],
                    getDetails: r => r.lines || [],
                    renderActions: (d) => (
                        <div className="flex gap-1">
                            <button className="p-1 rounded hover:bg-emerald-50"><Eye className="h-3.5 w-3.5 text-emerald-600" /></button>
                        </div>
                    ),
                }}
                lifecycle={{
                    getStatus: r => {
                        const m: Record<string, any> = {
                            OPEN: { label: 'Draft / Pending', variant: 'default' },
                            APPROVED: { label: 'Approved / Ready', variant: 'info' },
                            LOCKED: { label: 'Under Review', variant: 'warning' },
                            VERIFIED: { label: 'Verified', variant: 'success' },
                            CONFIRMED: { label: 'Resolved', variant: 'success' },
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
                actions={{ onView: r => toast.info(`Viewing ADJ-${r.id}`), onEdit: r => setShowAddLine(r.id), onDelete: () => toast.info('Deletion requires Admin override') }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search by Ref or Reason...', value: search, onChange: setSearch }}
                    filters={[
                        { key: 'status', label: 'Status', type: 'select', options: [{ value: 'OPEN', label: 'Open' }, { value: 'APPROVED', label: 'Approved' }, { value: 'LOCKED', label: 'Locked' }, { value: 'VERIFIED', label: 'Verified' }, { value: 'CONFIRMED', label: 'Confirmed' }, { value: 'CANCELED', label: 'Canceled' }] },
                        { key: 'warehouse', label: 'Terminal', type: 'select', options: warehouses.map(w => ({ value: String(w.id), label: w.name })) },
                    ]}
                    values={{ status: filterStatus, warehouse: filterWh }}
                    onChange={(k, v) => { const s = v === '' ? '' : String(v); if (k === 'status') setFilterStatus(s); if (k === 'warehouse') setFilterWh(s) }}
                />
            </TypicalListView>

            {/* Dialogs scaled for premium look */}
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Initiate Resolution Thread</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Target Terminal</Label>
                            <Select value={newWh} onValueChange={setNewWh}>
                                <SelectTrigger className="rounded-xl border-gray-100 h-12">
                                    <SelectValue placeholder="Select high-fidelity terminal" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-gray-100">
                                    {warehouses.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Primary Reason</Label>
                            <Input className="rounded-xl border-gray-100 h-12" placeholder="e.g. Damage, Theft, Miscount" value={newReason} onChange={e => setNewReason(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Internal Governance Notes</Label>
                            <Input className="rounded-xl border-gray-100 h-12" placeholder="Audit trail context..." value={newNotes} onChange={e => setNewNotes(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="pt-6">
                        <Button variant="ghost" onClick={() => setShowCreate(false)} className="rounded-xl font-bold">Cancel</Button>
                        <Button onClick={handleCreate} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 font-bold h-12 shadow-lg shadow-emerald-200">Create Thread</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!showAddLine} onOpenChange={() => setShowAddLine(null)}>
                <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black">Log Discrepancy Line</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Product Identifier</Label>
                            <Input className="rounded-xl border-gray-100 h-12 font-mono" placeholder="SKU or Product ID" value={lineProduct} onChange={e => setLineProduct(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Qty Delta</Label>
                                <Input type="number" className="rounded-xl border-gray-100 h-12" placeholder="-5 or +5" value={lineQty} onChange={e => setLineQty(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Financial Adj.</Label>
                                <Input type="number" className="rounded-xl border-gray-100 h-12 font-bold text-emerald-600" placeholder="0.00" value={lineAmt} onChange={e => setLineAmt(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Line Specific Reason</Label>
                            <Input className="rounded-xl border-gray-100 h-12" value={lineReason} onChange={e => setLineReason(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter className="pt-6">
                        <Button variant="ghost" onClick={() => setShowAddLine(null)} className="rounded-xl font-bold">Cancel</Button>
                        <Button onClick={handleAddLine} disabled={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-8 font-bold h-12">Add Entry</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!showUnlock} onOpenChange={() => setShowUnlock(null)}>
                <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-rose-600">Reopen Resolution Thread</DialogTitle>
                    </DialogHeader>
                    <div className="pt-4 space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Audit Justification</Label>
                        <Input className="rounded-xl border-gray-100 h-12" placeholder="Why are you reopening this verified thread?" value={unlockComment} onChange={(e) => setUnlockComment(e.target.value)} />
                    </div>
                    <DialogFooter className="pt-6">
                        <Button variant="ghost" onClick={() => setShowUnlock(null)} className="rounded-xl font-bold">Cancel</Button>
                        <Button onClick={handleUnlock} disabled={isPending || !unlockComment} className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-8 font-bold h-12 shadow-lg shadow-rose-200">Confirm Reopen</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
