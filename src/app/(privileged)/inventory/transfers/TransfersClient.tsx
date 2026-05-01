'use client'

import { useState, useEffect, useTransition } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getTransferOrders, lockTransferOrder } from '@/app/actions/inventory/transfer-orders'
import { Eye, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'

type TransferRow = {
    id: number
    date?: string
    reference?: string
    total_qty_transferred?: number
    from_warehouse_name?: string
    to_warehouse_name?: string
    reason?: string
    driver?: string
    lifecycle_status?: string
    current_verification_level?: number
    lines?: TransferLine[]
}

type TransferLine = {
    from_warehouse_name?: string
    to_warehouse_name?: string
    amount_transferred?: number
    recovered_amount?: number
    reason?: string
    added_by_name?: string
}

type StatusBadge = { label: string; variant: 'warning' | 'success' | 'danger' | 'default' }

export function TransfersClient() {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inv_transfers_ui', {
        columns: ['date', 'reference', 'total_qty_transferred', 'from_warehouse_name', 'to_warehouse_name', 'reason', 'driver'],
        pageSize: 25,
        sortKey: 'date',
        sortDir: 'desc',
    })
    const [data, setData] = useState<TransferRow[]>([])
    const [loading, setLoading] = useState(true)
    const [, startTransition] = useTransition()

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await getTransferOrders() as unknown
            const rows = Array.isArray(res)
                ? res
                : (res && typeof res === 'object' && 'results' in res && Array.isArray((res as { results?: unknown[] }).results))
                    ? (res as { results: unknown[] }).results
                    : []
            setData(rows as TransferRow[])
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
            render: (row: TransferRow) => <span className="text-app-muted-foreground">{row.date ? new Date(row.date).toLocaleDateString() : '-'}</span>
        },
        {
            key: 'reference',
            label: 'Reference',
            alwaysVisible: true,
            render: (row: TransferRow) => <span className="font-mono text-app-muted-foreground">{row.reference || `TRF-${row.id}`}</span>
        },
        {
            key: 'total_qty_transferred',
            label: 'QTY Transferred',
            render: (row: TransferRow) => <span className="text-app-muted-foreground font-medium">{row.total_qty_transferred || 0}</span>
        },
        {
            key: 'from_warehouse_name',
            label: 'From Location',
            render: (row: TransferRow) => <span className="text-app-muted-foreground">{row.from_warehouse_name || '-'}</span>
        },
        {
            key: 'to_warehouse_name',
            label: 'To Location',
            render: (row: TransferRow) => <span className="text-app-muted-foreground">{row.to_warehouse_name || '-'}</span>
        },
        {
            key: 'reason',
            label: 'Reason',
            render: (row: TransferRow) => <span className="text-app-muted-foreground">{row.reason || '-'}</span>
        },
        {
            key: 'driver',
            label: 'Driver',
            render: (row: TransferRow) => <span className="text-app-muted-foreground">{row.driver || 'Unassigned'}</span>
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
                        render: (line: TransferLine) => <span className="font-mono">{fmt(line.recovered_amount || 0)}</span>
                    },
                    { key: 'reason', label: 'Reason' },
                    { key: 'added_by_name', label: 'Added By' }
                ],
                getDetails: (row: TransferRow) => row.lines || [],
                renderActions: () => (
                    <div className="flex gap-3 justify-end items-center mr-2">
                        <button className="text-app-muted-foreground hover:text-app-muted-foreground"><Eye size={14} /></button>
                        <button className="text-app-muted-foreground hover:text-app-muted-foreground"><Pencil size={14} /></button>
                    </div>
                )
            }}
            lifecycle={{
                getStatus: (r: TransferRow): StatusBadge => {
                    const m: Record<string, StatusBadge> = {
                        OPEN: { label: 'Draft', variant: 'warning' },
                        LOCKED: { label: 'Approved', variant: 'success' },
                        VERIFIED: { label: 'Completed', variant: 'success' },
                        CANCELED: { label: 'Aborted', variant: 'danger' }
                    }
                    return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status || '', variant: 'default' }
                },
                getVerified: (r: TransferRow) => (r.current_verification_level ?? 0) > 0,
                getLocked: (r: TransferRow) => r.lifecycle_status !== 'OPEN',
                onLockToggle: (row: TransferRow) => {
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
                    { key: 'category', label: 'Category', type: 'select', options: [] },
                    { key: 'driver', label: 'Driver', type: 'select', options: [] },
                    { key: 'supplier', label: 'Supplier', type: 'select', options: [] },
                    { key: 'date', label: 'Date', type: 'date', options: [] },
                    { key: 'location_from', label: 'Location From', type: 'select', options: [] },
                    { key: 'location_to', label: 'Location To', type: 'select', options: [] },
                ]}
            />
        </TypicalListView>
    )
}

