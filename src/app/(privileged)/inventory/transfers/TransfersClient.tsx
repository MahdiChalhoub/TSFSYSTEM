// @ts-nocheck
'use client'

import { useState, useEffect, useTransition } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getTransferOrders, lockTransferOrder, unlockTransferOrder } from '@/app/actions/inventory/transfer-orders'
import { Badge } from '@/components/ui/badge'
import { Truck, ArrowRightLeft, Package, Clock, RefreshCw, Eye, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'

export function TransfersClient() {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inv_transfers_ui', {
        columns: ['date', 'reference', 'total_qty_transferred', 'from_warehouse_name', 'to_warehouse_name', 'reason', 'driver'],
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
            const res = await getTransferOrders()
            // Execution layer showing active movements
            setData(Array.isArray(res) ? res : res?.results || [])
        } catch {
            toast.error("Failed to load transfers")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [])

    const columns = [
        {
            key: 'date',
            label: 'Date',
            render: (row: any) => <span className="text-app-muted-foreground">{new Date(row.date).toLocaleDateString()}</span>
        },
        {
            key: 'reference',
            label: 'Reference',
            alwaysVisible: true,
            render: (row: any) => <span className="font-mono text-app-muted-foreground">{row.reference || `TRF-${row.id}`}</span>
        },
        {
            key: 'total_qty_transferred',
            label: 'QTY Transferred',
            render: (row: any) => <span className="text-app-muted-foreground font-medium">{row.total_qty_transferred || 0}</span>
        },
        {
            key: 'from_warehouse_name',
            label: 'From Location',
            render: (row: any) => <span className="text-app-muted-foreground">{row.from_warehouse_name || '-'}</span>
        },
        {
            key: 'to_warehouse_name',
            label: 'To Location',
            render: (row: any) => <span className="text-app-muted-foreground">{row.to_warehouse_name || '-'}</span>
        },
        {
            key: 'reason',
            label: 'Reason',
            render: (row: any) => <span className="text-app-muted-foreground">{row.reason || '-'}</span>
        },
        {
            key: 'driver',
            label: 'Driver',
            render: (row: any) => <span className="text-app-muted-foreground">{row.driver || 'Unassigned'}</span>
        }
    ]

    return (
        <TypicalListView
            title="Stock Transfer"
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
            addLabel="New Transfer"
            onAdd={() => toast.info("Execute movements from the Logistics Manifest")}
            onExport={() => toast.info("Exporting records...")}
            expandable={{
                columns: [
                    { key: 'from_warehouse_name', label: 'Location A' },
                    { key: 'to_warehouse_name', label: 'Location B' },
                    {
                        key: 'amount_transferred',
                        label: 'Total Amount',
                        render: () => <span className="font-mono">{fmt(0)}</span>
                    },
                    {
                        key: 'recovered_amount',
                        label: 'Recovered Amt',
                        render: (line) => <span className="font-mono">{fmt(line.recovered_amount || 0)}</span>
                    },
                    { key: 'reason', label: 'Reason' },
                    { key: 'added_by_name', label: 'Added By' }
                ],
                getDetails: (row) => row.lines || [],
                renderActions: (detail, parent) => (
                    <div className="flex gap-3 justify-end items-center mr-2">
                        <button className="text-app-muted-foreground hover:text-app-muted-foreground"><Eye size={14} /></button>
                        <button className="text-app-muted-foreground hover:text-app-muted-foreground"><Pencil size={14} /></button>
                    </div>
                )
            }}
            lifecycle={{
                getStatus: r => {
                    const m: Record<string, any> = {
                        OPEN: { label: 'Draft', variant: 'warning' },
                        LOCKED: { label: 'Approved', variant: 'success' },
                        VERIFIED: { label: 'Completed', variant: 'success' },
                        CANCELED: { label: 'Aborted', variant: 'danger' }
                    }
                    return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status, variant: 'default' }
                },
                getVerified: r => r.current_verification_level > 0,
                getLocked: r => r.lifecycle_status !== 'OPEN',
                onLockToggle: (row) => {
                    if (row.lifecycle_status !== 'OPEN') {
                        toast.error("Locked transit documents require higher authorization to revert")
                        return
                    }
                    startTransition(async () => {
                        try {
                            await lockTransferOrder(row.id)
                            toast.success("Transit manifest approved and initiated")
                            loadData()
                        } catch {
                            toast.error("Failed to initiate transit")
                        }
                    })
                }
            }}
        >
            <TypicalFilter
                search={{
                    placeholder: "Search transfers...",
                    value: "",
                    onChange: () => { }
                }}
                filters={[
                    { key: 'category', label: 'Category', options: [] },
                    { key: 'driver', label: 'Driver', options: [] },
                    { key: 'supplier', label: 'Supplier', options: [] },
                    { key: 'date', label: 'Date', options: [] },
                    { key: 'location_from', label: 'Location From', options: [] },
                    { key: 'location_to', label: 'Location To', options: [] },
                ]}
            />
        </TypicalListView>
    )
}

