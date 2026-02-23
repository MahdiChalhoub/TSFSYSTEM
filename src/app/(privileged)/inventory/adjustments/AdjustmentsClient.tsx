'use client'

import { useState, useEffect, useTransition } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getAdjustmentOrders, lockAdjustmentOrder, unlockAdjustmentOrder } from '@/app/actions/inventory/adjustment-orders'
import { adjustStock } from '@/app/actions/inventory/movements'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Sliders, Box, AlertTriangle, CheckCircle2, RefreshCw, Eye, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'

export function AdjustmentsClient({ warehouses }: { warehouses: any[] }) {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inv_adjustments_ui', {
        columns: ['date', 'supplier_name', 'reference', 'total_qty_adjustment', 'total_amount_adjustment', 'warehouse_name', 'reason'],
        pageSize: 25,
        sortKey: 'date',
        sortDir: 'desc',
    })
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await getAdjustmentOrders()
            // In the execution layer, we only show documents that HAVE stock impact (Draft or Locked)
            setData(Array.isArray(res) ? res : res?.results || [])
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
            render: (row: any) => <span className="text-gray-500">{new Date(row.date).toLocaleDateString()}</span>
        },
        {
            key: 'supplier_name',
            label: 'Supplier',
            render: (row: any) => <span className="text-gray-500">{row.supplier_name || '-'}</span>
        },
        {
            key: 'reference',
            label: 'Reference',
            alwaysVisible: true,
            render: (row: any) => <span className="text-gray-500">{row.reference || `ADJ-${row.id}`}</span>
        },
        {
            key: 'total_qty_adjustment',
            label: 'QTY Adj.',
            render: (row: any) => <span className="text-gray-700 font-medium">{row.total_qty_adjustment || 0}</span>
        },
        {
            key: 'total_amount_adjustment',
            label: 'Amt Adj',
            render: (row: any) => <span className="font-mono text-gray-700">{fmt.currency(row.total_amount_adjustment || 0)}</span>
        },
        {
            key: 'warehouse_name',
            label: 'Location',
            render: (row: any) => <span className="text-gray-500">{row.warehouse_name || 'Global'}</span>
        },
        {
            key: 'reason',
            label: 'Reason',
            render: (row: any) => <span className="text-gray-500">{row.reason || '-'}</span>
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
                        render: (line) => <span className="text-gray-500 capitalize">{line.qty_adjustment > 0 ? "Addition" : "Subtraction"}</span>
                    },
                    {
                        key: 'amount_adjustment',
                        label: 'Total Amount',
                        render: (line) => <span className="font-mono">{fmt.currency(line.amount_adjustment || 0)}</span>
                    },
                    {
                        key: 'recovered_amount',
                        label: 'Recovered Amt',
                        render: (line) => <span className="font-mono">{fmt.currency(line.recovered_amount || 0)}</span>
                    },
                    { key: 'reason', label: 'Reason' },
                    { key: 'added_by_name', label: 'Added By' }
                ],
                getDetails: (row) => row.lines || [],
                renderActions: (detail, parent) => (
                    <div className="flex gap-3 justify-end items-center mr-2">
                        <button className="text-gray-400 hover:text-gray-600"><Eye size={14} /></button>
                        <button className="text-gray-400 hover:text-gray-600"><Pencil size={14} /></button>
                    </div>
                )
            }}
            lifecycle={{
                getStatus: r => {
                    const m: Record<string, any> = {
                        OPEN: { label: 'Draft', variant: 'warning' },
                        LOCKED: { label: 'Approved', variant: 'success' },
                        CANCELED: { label: 'Aborted', variant: 'danger' }
                    }
                    return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status, variant: 'default' }
                },
                getVerified: r => r.current_verification_level > 0,
                getLocked: r => r.lifecycle_status === 'LOCKED',
                onLockToggle: (row) => {
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
                    { key: 'category', label: 'Category', options: [] },
                    { key: 'stock_adjustment', label: 'Stock Adjustment', options: [] },
                    { key: 'supplier', label: 'Supplier', options: [] },
                    { key: 'location', label: 'Location', options: [] },
                    { key: 'dates', label: 'Dates', options: [] },
                ]}
            />
        </TypicalListView>
    )
}
