'use client'

import { useState, useEffect, useTransition } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getAdjustmentOrders, lockAdjustmentOrder, unlockAdjustmentOrder } from '@/app/actions/inventory/adjustment-orders'
import { adjustStock } from '@/app/actions/inventory/movements'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Sliders, Box, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'

export function AdjustmentsClient({ warehouses }: { warehouses: any[] }) {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inv_adjustments', {
        columns: ['reference', 'date', 'warehouse_name', 'total_qty', 'reason'],
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
            key: 'reference',
            label: 'Adjustment ID',
            alwaysVisible: true,
            render: (row: any) => <span className="font-mono font-bold text-gray-900">ADJ-{row.reference || row.id}</span>
        },
        {
            key: 'date',
            label: 'Effective Date',
            render: (row: any) => <span className="text-gray-500">{new Date(row.date).toLocaleDateString()}</span>
        },
        {
            key: 'warehouse_name',
            label: 'Terminal',
            render: (row: any) => <Badge variant="outline" className="bg-gray-50 border-gray-100 font-black uppercase text-[10px]">{row.warehouse_name || 'Global'}</Badge>
        },
        {
            key: 'total_qty',
            label: 'Delta',
            align: 'right' as const,
            render: (row: any) => (
                <span className={`font-black ${(row.total_qty_adjustment || 0) < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {(row.total_qty_adjustment || 0) > 0 ? '+' : ''}{row.total_qty_adjustment || 0}
                </span>
            )
        },
        {
            key: 'reason',
            label: 'Operational Reason',
            render: (row: any) => <span className="text-xs italic text-gray-400">{row.reason || 'Manual Correction'}</span>
        }
    ]

    return (
        <TypicalListView
            title="Stock Adjustments (Execution)"
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
            addLabel="CREATE DRAFT ADJUSTMENT"
            onAdd={() => toast.info("Use the adjustment form to create real stock impact")}
            headerExtras={
                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">Live Inventory Impact</span>
                </div>
            }
            lifecycle={{
                getStatus: r => {
                    const m: Record<string, any> = {
                        OPEN: { label: 'Operational Draft', variant: 'warning' },
                        LOCKED: { label: 'Finalized Record', variant: 'success' },
                        CANCELED: { label: 'Aborted', variant: 'danger' }
                    }
                    return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status, variant: 'default' }
                },
                getLocked: r => r.lifecycle_status === 'LOCKED',
                onLockToggle: (row) => {
                    startTransition(async () => {
                        try {
                            if (row.lifecycle_status === 'LOCKED') {
                                toast.error("Locked adjustments cannot be modified by standard users")
                            } else {
                                await lockAdjustmentOrder(row.id)
                                toast.success("Adjustment finalized and locked")
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
                    placeholder: "Search by ID or reason...",
                    value: "",
                    onChange: () => { }
                }}
            />
        </TypicalListView>
    )
}
