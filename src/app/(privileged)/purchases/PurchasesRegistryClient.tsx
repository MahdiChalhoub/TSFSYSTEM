'use client'

import React from 'react'
import { TypicalListView, ColumnDef, LifecycleConfig } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Calendar, AlertTriangle, Clock } from 'lucide-react'
import Link from 'next/link'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useRouter, useSearchParams } from 'next/navigation'

interface PurchaseOrder {
    id: number
    po_number: string
    supplier_display: string
    supplier_name: string
    status: string
    priority: string
    purchase_sub_type: string
    total_amount: string | number
    expected_date: string
    created_at: string
    is_legacy?: boolean
}

interface PurchasesRegistryClientProps {
    orders: PurchaseOrder[]
    currency: string
    tradeSubTypesEnabled: boolean
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' }> = {
    DRAFT: { label: 'Draft', variant: 'default' },
    SUBMITTED: { label: 'Pending Approval', variant: 'warning' },
    APPROVED: { label: 'Approved', variant: 'info' },
    REJECTED: { label: 'Rejected', variant: 'danger' },
    ORDERED: { label: 'Ordered', variant: 'info' },
    CONFIRMED: { label: 'Confirmed by Supp.', variant: 'info' },
    IN_TRANSIT: { label: '🚚 In Transit', variant: 'warning' },
    PARTIALLY_RECEIVED: { label: 'Partial Receipt', variant: 'warning' },
    RECEIVED: { label: 'Fully Received', variant: 'success' },
    INVOICED: { label: 'Invoiced', variant: 'info' },
    COMPLETED: { label: 'Completed', variant: 'success' },
    CANCELLED: { label: 'Cancelled', variant: 'danger' },
}

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Low', color: 'text-app-muted-foreground' },
    NORMAL: { label: 'Normal', color: 'text-app-info' },
    HIGH: { label: 'High', color: 'text-app-warning' },
    URGENT: { label: 'Urgent', color: 'text-app-error font-black' },
}

const PO_SUB_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    STANDARD: { label: 'Standard', color: 'bg-app-surface border border-app-border text-app-muted-foreground' },
    WHOLESALE: { label: 'Wholesale', color: 'bg-app-warning/10 text-app-warning border border-app-warning/20' },
    CONSIGNEE: { label: 'Consignee', color: 'bg-app-primary/10 text-app-primary border border-app-primary/20' },
}

export function PurchasesRegistryClient({ orders, currency, tradeSubTypesEnabled }: PurchasesRegistryClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const settings = useListViewSettings('purch_registry', {
        columns: ['po_number', 'supplier_display', 'purchase_sub_type', 'priority', 'total_amount', 'expected_date'],
        pageSize: 25, sortKey: 'created_at', sortDir: 'desc'
    })

    const columns: ColumnDef<PurchaseOrder>[] = [
        {
            key: 'po_number',
            label: 'PO Number',
            sortable: true,
            render: (po) => (
                <Link href={`/purchases/${po.id}${po.is_legacy ? '?type=legacy' : ''}`} className="flex flex-col group">
                    <span className="font-bold text-app-foreground group-hover:text-app-primary transition-colors uppercase tracking-tight">
                        {po.po_number || `PO-${po.id}`}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-app-muted-foreground mt-0.5">
                        <Calendar size={10} />
                        {po.created_at ? new Date(po.created_at).toLocaleDateString('fr-FR') : '—'}
                    </div>
                </Link>
            )
        },
        {
            key: 'supplier_display',
            label: 'Supplier',
            sortable: true,
            render: (po) => (
                <span className="text-sm font-bold text-app-muted-foreground">
                    {po.supplier_display || po.supplier_name || 'N/A'}
                </span>
            )
        },
        ...(tradeSubTypesEnabled ? [{
            key: 'purchase_sub_type',
            label: 'Type',
            sortable: true,
            render: (po: PurchaseOrder) => (
                po.purchase_sub_type && PO_SUB_TYPE_CONFIG[po.purchase_sub_type] ? (
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${PO_SUB_TYPE_CONFIG[po.purchase_sub_type].color}`}>
                        {PO_SUB_TYPE_CONFIG[po.purchase_sub_type].label}
                    </span>
                ) : (
                    <span className="text-xs text-app-muted-foreground">—</span>
                )
            )
        }] as ColumnDef<PurchaseOrder>[] : []),
        {
            key: 'priority',
            label: 'Priority',
            sortable: true,
            render: (po) => {
                const priorityInfo = PRIORITY_MAP[po.priority] || { label: po.priority, color: 'text-app-muted-foreground' }
                return (
                    <span className={`text-xs font-bold ${priorityInfo.color}`}>
                        {po.priority === 'URGENT' && <AlertTriangle size={12} className="inline mr-1" />}
                        {priorityInfo.label}
                    </span>
                )
            }
        },
        {
            key: 'total_amount',
            label: 'Amount',
            sortable: true,
            align: 'right',
            render: (po) => (
                <span className="font-black text-app-foreground">
                    {parseFloat(String(po.total_amount || 0)).toLocaleString()} {currency}
                </span>
            )
        },
        {
            key: 'expected_date',
            label: 'Expected',
            sortable: true,
            render: (po) => (
                <span className="text-sm text-app-muted-foreground">
                    {po.expected_date ? new Date(po.expected_date).toLocaleDateString('fr-FR') : '—'}
                </span>
            )
        }
    ]

    const lifecycle: LifecycleConfig<PurchaseOrder> = {
        getStatus: (po) => STATUS_MAP[po.status] || { label: po.status, variant: 'default' },
    }

    const handleSearch = (query: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (query) params.set('query', query)
        else params.delete('query')
        router.push(`/purchases?${params.toString()}`)
    }

    const handleFilterChange = (key: string, value: string | boolean) => {
        const params = new URLSearchParams(searchParams.toString())
        if (value && value !== 'ALL') params.set(key, String(value))
        else params.delete(key)
        router.push(`/purchases?${params.toString()}`)
    }

    return (
        <TypicalListView
            title="Registry"
            data={orders}
            getRowId={(po) => po.id}
            columns={columns}
            lifecycle={lifecycle}
            actions={{
                onView: (po) => router.push(`/purchases/${po.id}${po.is_legacy ? '?type=legacy' : ''}`),
                extra: (po) => (
                    <Link href={`/purchases/${po.id}${po.is_legacy ? '?type=legacy' : ''}`} className="p-1.5 text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/10 rounded-lg transition-all">
                        <Clock size={16} />
                    </Link>
                )
            }}
            className="overflow-hidden"
            visibleColumns={settings.visibleColumns}
            onToggleColumn={settings.toggleColumn}
            pageSize={settings.pageSize}
            onPageSizeChange={settings.setPageSize}
            sortKey={settings.sortKey}
            sortDir={settings.sortDir}
            onSort={settings.setSort}
        >
            <TypicalFilter
                search={{
                    value: searchParams.get('query') || '',
                    onChange: handleSearch,
                    placeholder: "Search POs or Suppliers..."
                }}
                filters={[
                    {
                        key: 'status',
                        label: 'Status',
                        type: 'select',
                        options: [
                            { label: 'Draft', value: 'DRAFT' },
                            { label: 'Pending Approval', value: 'SUBMITTED' },
                            { label: 'Approved', value: 'APPROVED' },
                            { label: 'Invoiced', value: 'INVOICED' },
                            { label: 'Completed', value: 'COMPLETED' },
                            { label: 'Cancelled', value: 'CANCELLED' },
                        ]
                    }
                ]}
                values={{
                    status: searchParams.get('status') || ''
                }}
                onChange={handleFilterChange}
            />
        </TypicalListView>
    )
}
