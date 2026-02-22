'use client'

import React from 'react'
import { TypicalListView, ColumnDef, LifecycleConfig } from '@/components/common/TypicalListView'
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
    PARTIALLY_RECEIVED: { label: 'Partial Receipt', variant: 'info' },
    RECEIVED: { label: 'Fully Received', variant: 'success' },
    INVOICED: { label: 'Invoiced', variant: 'info' },
    COMPLETED: { label: 'Completed', variant: 'success' },
    CANCELLED: { label: 'Cancelled', variant: 'default' },
}

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Low', color: 'text-gray-400' },
    NORMAL: { label: 'Normal', color: 'text-blue-500' },
    HIGH: { label: 'High', color: 'text-orange-500' },
    URGENT: { label: 'Urgent', color: 'text-red-600 font-black' },
}

const PO_SUB_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    STANDARD: { label: 'Standard', color: 'bg-slate-100 text-slate-600' },
    WHOLESALE: { label: 'Wholesale', color: 'bg-amber-100 text-amber-700' },
    CONSIGNEE: { label: 'Consignee', color: 'bg-purple-100 text-purple-700' },
}

export function PurchasesRegistryClient({ orders, currency, tradeSubTypesEnabled }: PurchasesRegistryClientProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const columns: ColumnDef<PurchaseOrder>[] = [
        {
            key: 'po_number',
            label: 'PO Number',
            sortable: true,
            render: (po) => (
                <Link href={`/purchases/${po.id}`} className="flex flex-col group">
                    <span className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                        {po.po_number || `PO-${po.id}`}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
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
                <span className="text-sm font-bold text-gray-700">
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
                    <span className="text-xs text-gray-300">—</span>
                )
            )
        }] as ColumnDef<PurchaseOrder>[] : []),
        {
            key: 'priority',
            label: 'Priority',
            sortable: true,
            render: (po) => {
                const priorityInfo = PRIORITY_MAP[po.priority] || { label: po.priority, color: 'text-gray-500' }
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
                <span className="font-black text-gray-900">
                    {parseFloat(String(po.total_amount || 0)).toLocaleString()} {currency}
                </span>
            )
        },
        {
            key: 'expected_date',
            label: 'Expected',
            sortable: true,
            render: (po) => (
                <span className="text-sm text-gray-500">
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
                onView: (po) => router.push(`/purchases/${po.id}`),
                extra: (po) => (
                    <Link href={`/purchases/${po.id}`} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all">
                        <Clock size={16} />
                    </Link>
                )
            }}
            className="rounded-2xl shadow-sm bg-white overflow-hidden border-0"
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
