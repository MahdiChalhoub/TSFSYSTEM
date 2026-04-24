// @ts-nocheck
'use client'

import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import {
    Plus, ShoppingCart, Layers, Clock, CheckCircle2,
    Truck, Package, FileText, AlertTriangle, BarChart3, DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { PurchaseOrderRow } from './components/PurchaseOrderRow'
import { PurchaseOrderDetailPanel } from './components/PurchaseOrderDetailPanel'

/* ═══════════════════════════════════════════════════════════
 *  PurchasesRegistryClient — thin TreeMasterPage consumer.
 *  Flat list of purchase orders (no parent tree). All shell
 *  behavior (search, KPI filter, split panel, pinned sidebar,
 *  keyboard shortcuts, focus mode) comes from the template.
 * ═══════════════════════════════════════════════════════════ */

type PurchaseOrder = {
    id: number
    po_number: string
    supplier_display?: string
    supplier_name?: string
    status: string
    priority: string
    purchase_sub_type?: string
    total_amount: string | number
    currency?: string
    expected_date?: string
    created_at?: string
    site_name?: string
}

const AWAITING_STATUSES = new Set(['ORDERED', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'])

export function PurchasesRegistryClient({
    orders, currency = 'USD', tradeSubTypesEnabled = false,
}: {
    orders: PurchaseOrder[]
    currency?: string
    tradeSubTypesEnabled?: boolean
}) {
    const router = useRouter()
    const data = orders

    const subtotals = useMemo(() => {
        const drafts  = data.filter(o => o.status === 'DRAFT').length
        const pending = data.filter(o => o.status === 'SUBMITTED').length
        const awaiting = data.filter(o => AWAITING_STATUSES.has(o.status)).length
        const received = data.filter(o => o.status === 'RECEIVED' || o.status === 'COMPLETED').length
        const total    = data.reduce((s, o) => s + Number(o.total_amount || 0), 0)
        return { drafts, pending, awaiting, received, total }
    }, [data])

    return (
        <TreeMasterPage
            config={{
                title: 'Purchase Orders',
                subtitle: (_, all) => `${all.length} orders · ${subtotals.pending} pending · ${subtotals.awaiting} incoming`,
                icon: <ShoppingCart size={20} />,
                iconColor: 'var(--app-primary)',
                searchPlaceholder: 'Search by PO number or supplier...',
                primaryAction: {
                    label: 'New Purchase Order',
                    icon: <Plus size={14} />,
                    onClick: () => router.push('/purchases/new-order'),
                },
                secondaryActions: [
                    {
                        label: 'Sourcing Intelligence',
                        icon: <BarChart3 size={13} />,
                        href: '/purchases/sourcing',
                    },
                    {
                        label: 'Dashboard',
                        icon: <DollarSign size={13} />,
                        href: '/purchases/dashboard',
                    },
                ],

                // Template owns filtering — flat list, no parent key needed.
                data,
                searchFields: ['po_number', 'supplier_display', 'supplier_name'],
                // Use a non-existent parent key so buildTree leaves every row at root.
                treeParentKey: '__no_parent_key__',
                kpiPredicates: {
                    draft:    (o) => o.status === 'DRAFT',
                    pending:  (o) => o.status === 'SUBMITTED',
                    awaiting: (o) => AWAITING_STATUSES.has(o.status),
                    received: (o) => o.status === 'RECEIVED' || o.status === 'COMPLETED',
                    urgent:   (o) => o.priority === 'URGENT',
                },

                kpis: [
                    {
                        label: 'Total', icon: <Layers size={12} />, color: 'var(--app-primary)',
                        filterKey: 'all', hint: 'Show everything',
                        value: (_, all) => all.length,
                    },
                    {
                        label: 'Drafts', icon: <FileText size={12} />, color: 'var(--app-muted-foreground)',
                        filterKey: 'draft', hint: 'Orders awaiting submission',
                        value: (f) => f.filter((o: any) => o.status === 'DRAFT').length,
                    },
                    {
                        label: 'Pending', icon: <Clock size={12} />, color: 'var(--app-warning)',
                        filterKey: 'pending', hint: 'Waiting for manager approval',
                        value: (f) => f.filter((o: any) => o.status === 'SUBMITTED').length,
                    },
                    {
                        label: 'Incoming', icon: <Truck size={12} />, color: 'var(--app-info)',
                        filterKey: 'awaiting', hint: 'Ordered, awaiting delivery',
                        value: (f) => f.filter((o: any) => AWAITING_STATUSES.has(o.status)).length,
                    },
                    {
                        label: 'Received', icon: <Package size={12} />, color: 'var(--app-success)',
                        filterKey: 'received', hint: 'Fully received or completed',
                        value: (f) => f.filter((o: any) => o.status === 'RECEIVED' || o.status === 'COMPLETED').length,
                    },
                    {
                        label: 'Urgent', icon: <AlertTriangle size={12} />, color: 'var(--app-error)',
                        filterKey: 'urgent', hint: 'Only urgent-priority orders',
                        value: (f) => f.filter((o: any) => o.priority === 'URGENT').length,
                    },
                ],
                columnHeaders: [
                    { label: 'Order', width: 'auto' },
                    { label: 'Priority', width: '64px', hideOnMobile: true },
                    { label: 'Expected', width: '96px', hideOnMobile: true },
                    { label: 'Amount', width: '112px', color: 'var(--app-foreground)' },
                ],
                emptyState: {
                    icon: <ShoppingCart size={36} />,
                    title: (has) => has ? 'No matching purchase orders' : 'No purchase orders yet',
                    subtitle: (has) => has
                        ? 'Try a different search term or clear filters.'
                        : 'Create your first purchase order to start tracking procurement.',
                    actionLabel: 'Create First PO',
                },
                footerLeft: (_, all) => (
                    <>
                        <span>{all.length} orders</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>Total procurement: <strong className="text-app-foreground tabular-nums">{subtotals.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currency}</strong></span>
                    </>
                ),
            }}
            detailPanel={(node, { tab, onClose, onPin }) => (
                <PurchaseOrderDetailPanel
                    node={node} initialTab={tab}
                    onClose={onClose} onPin={onPin}
                />
            )}
        >
            {(renderProps) => {
                const { tree, isSelected, openNode } = renderProps
                return tree.map((po: any) => (
                    <PurchaseOrderRow key={po.id} node={po}
                        isSelected={isSelected(po)}
                        onSelect={(n: any) => openNode(n, 'overview')} />
                ))
            }}
        </TreeMasterPage>
    )
}
