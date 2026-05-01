'use client'

import { useState, useEffect, useTransition } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getAdjustmentOrders, lockAdjustmentOrder } from '@/app/actions/inventory/adjustment-orders'
import { Eye, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'

type AdjustmentLine = {
 warehouse_name?: string
 qty_adjustment?: number
 amount_adjustment?: number
 recovered_amount?: number
 reason?: string
 added_by_name?: string
}

type AdjustmentRow = {
 id: number
 date?: string
 supplier_name?: string
 reference?: string
 total_qty_adjustment?: number
 total_amount_adjustment?: number
 warehouse_name?: string
 reason?: string
 lifecycle_status?: string
 current_verification_level?: number
 lines?: AdjustmentLine[]
}

type StatusBadge = { label: string; variant: 'warning' | 'success' | 'danger' | 'default' }

export function AdjustmentsClient({ warehouses: _warehouses }: { warehouses: Array<Record<string, unknown>> }) {
 const { fmt } = useCurrency()
 const settings = useListViewSettings('inv_adjustments_ui', {
 columns: ['date', 'supplier_name', 'reference', 'total_qty_adjustment', 'total_amount_adjustment', 'warehouse_name', 'reason'],
 pageSize: 25,
 sortKey: 'date',
 sortDir: 'desc',
 })
 const [data, setData] = useState<AdjustmentRow[]>([])
 const [loading, setLoading] = useState(true)
 const [, startTransition] = useTransition()

 const loadData = async () => {
 setLoading(true)
 try {
 const res = await getAdjustmentOrders() as unknown
 const rows = Array.isArray(res)
 ? res
 : (res && typeof res === 'object' && 'results' in res && Array.isArray((res as { results?: unknown[] }).results))
 ? (res as { results: unknown[] }).results
 : []
 setData(rows as AdjustmentRow[])
 } catch {
 toast.error("Failed to sync inventory ledger")
 } finally {
 setLoading(false)
 }
 }

 useEffect(() => { loadData() }, [])

 const columns = [
 {
 key: 'date',
 label: 'Date',
 render: (row: AdjustmentRow) =><span className="text-app-muted-foreground">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</span>
 },
 {
 key: 'supplier_name',
 label: 'Supplier',
 render: (row: AdjustmentRow) =><span className="text-app-muted-foreground">{row.supplier_name || '-'}</span>
 },
 {
 key: 'reference',
 label: 'Reference',
 alwaysVisible: true,
 render: (row: AdjustmentRow) =><span className="text-app-muted-foreground">{row.reference || `ADJ-${row.id}`}</span>
 },
 {
 key: 'total_qty_adjustment',
 label: 'QTY Adj.',
 render: (row: AdjustmentRow) =><span className="text-app-muted-foreground font-medium">{row.total_qty_adjustment || 0}</span>
 },
 {
 key: 'total_amount_adjustment',
 label: 'Amt Adj',
 render: (row: AdjustmentRow) =><span className="font-mono text-app-muted-foreground">{fmt(row.total_amount_adjustment || 0)}</span>
 },
 {
 key: 'warehouse_name',
 label: 'Location',
 render: (row: AdjustmentRow) =><span className="text-app-muted-foreground">{row.warehouse_name || 'Global'}</span>
 },
 {
 key: 'reason',
 label: 'Reason',
 render: (row: AdjustmentRow) =><span className="text-app-muted-foreground">{row.reason || '-'}</span>
 }
 ]

 return (
 <TypicalListView
 title="Stock Adjustment"
 data={data}
 loading={loading}
 getRowId={r => r.id}
 columns={columns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 addLabel="Add STOCK ADJUSMENT"
 onAdd={() => toast.info("Use the adjustment form to create real stock impact")}
 onExport={() => toast.info("Exporting records...")}
 expandable={{
 columns: [
 { key: 'warehouse_name', label: 'Location' },
 {
 key: 'reflect_transfer',
 label: 'Reflect Transfer',
 render: (line: AdjustmentLine) => <span className="text-app-muted-foreground capitalize">{(line.qty_adjustment ?? 0) > 0 ? "Addition" : "Subtraction"}</span>
 },
 {
 key: 'amount_adjustment',
 label: 'Total Amount',
 render: (line: AdjustmentLine) => <span className="font-mono">{fmt(line.amount_adjustment || 0)}</span>
 },
 {
 key: 'recovered_amount',
 label: 'Recovered Amt',
 render: (line: AdjustmentLine) => <span className="font-mono">{fmt(line.recovered_amount || 0)}</span>
 },
 { key: 'reason', label: 'Reason' },
 { key: 'added_by_name', label: 'Added By' }
 ],
 getDetails: (row: AdjustmentRow) => row.lines || [],
 renderActions: () => (
 <div className="flex gap-3 justify-end items-center mr-2">
 <button className="text-app-muted-foreground hover:text-app-muted-foreground"><Eye size={14} /></button>
 <button className="text-app-muted-foreground hover:text-app-muted-foreground"><Pencil size={14} /></button>
 </div>
 )
 }}
 lifecycle={{
 getStatus: (r: AdjustmentRow): StatusBadge => {
 const m: Record<string, StatusBadge> = {
 OPEN: { label: 'Draft', variant: 'warning' },
 LOCKED: { label: 'Approved', variant: 'success' },
 CANCELED: { label: 'Aborted', variant: 'danger' }
 }
 return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status || '', variant: 'default' }
 },
 getVerified: (r: AdjustmentRow) => (r.current_verification_level ?? 0) > 0,
 getLocked: (r: AdjustmentRow) => r.lifecycle_status === 'LOCKED',
 onLockToggle: (row: AdjustmentRow) => {
 startTransition(async () => {
 try {
 if (row.lifecycle_status === 'LOCKED') {
 toast.error("Locked adjustments cannot be modified by standard users")
 } else {
 await lockAdjustmentOrder(row.id)
 toast.success("Adjustment approved and locked")
 loadData()
 }
 } catch {
 toast.error("Process failed")
 }
 })
 }
 }}
 >
 <TypicalFilter
 search={{
 placeholder: "Search adjustments...",
 value: "",
 onChange: () => { }
 }}
 filters={[
 { key: 'category', label: 'Category', type: 'select', options: [] },
 { key: 'stock_adjustment', label: 'Stock Adjustment', type: 'select', options: [] },
 { key: 'supplier', label: 'Supplier', type: 'select', options: [] },
 { key: 'location', label: 'Location', type: 'select', options: [] },
 { key: 'dates', label: 'Dates', type: 'date', options: [] },
 ]}
 />
 </TypicalListView>
 )
}
