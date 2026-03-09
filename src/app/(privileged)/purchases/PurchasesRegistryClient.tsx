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
    LOW: { label: 'Low', color: 'theme-text-muted' },
    NORMAL: { label: 'Normal', color: 'text-blue-500' },
    HIGH: { label: 'High', color: 'text-amber-500' },
    URGENT: { label: 'Urgent', color: 'text-rose-500 font-black' },
}

const PO_SUB_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    STANDARD: { label: 'Standard', color: 'bg-gray-100 border border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400' },
    WHOLESALE: { label: 'Wholesale', color: 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400' },
    CONSIGNEE: { label: 'Consignee', color: 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-400' },
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
                    <span className="font-bold theme-text group-hover:text-emerald-500 transition-colors uppercase tracking-tight">
                        {po.po_number || `PO-${po.id}`}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] theme-text-muted mt-0.5">
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
                <span className="text-sm font-bold theme-text-muted">
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
                    <span className="text-xs theme-text-muted">—</span>
                )
            )
        }] as ColumnDef<PurchaseOrder>[] : []),
        {
            key: 'priority',
            label: 'Priority',
            sortable: true,
            render: (po) => {
                const priorityInfo = PRIORITY_MAP[po.priority] || { label: po.priority, color: 'theme-text-muted' }
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
                <span className="font-black theme-text">
                    {parseFloat(String(po.total_amount || 0)).toLocaleString()} {currency}
                </span>
            )
        },
        {
            key: 'expected_date',
            label: 'Expected',
            sortable: true,
            render: (po) => (
                <span className="text-sm theme-text-muted">
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
                    <Link href={`/purchases/${po.id}${po.is_legacy ? '?type=legacy' : ''}`} className="p-1.5 theme-text-muted hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all min-h-[44px] min-w-[44px] md:min-h-[28px] md:min-w-[28px] flex items-center justify-center">
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
                            { label: 'Ordered', value: 'ORDERED' },
                            { label: 'Partially Received', value: 'PARTIALLY_RECEIVED' },
                            { label: 'Received', value: 'RECEIVED' },
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
