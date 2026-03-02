'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { ShoppingCart, Clock, CheckCircle, Truck, Package, Search, RefreshCw, ChevronRight, Circle, XCircle, DollarSign, Zap, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Order = {
    id: number
    order_number?: string
    client?: { name: string }
    client_name?: string
    status: string
    total_amount: number
    created_at: string
    items_count?: number
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
    PLACED: { label: 'Pending', color: 'orange', icon: Clock },
    CONFIRMED: { label: 'Confirmed', color: 'blue', icon: CheckCircle },
    PROCESSING: { label: 'Processing', color: 'violet', icon: Zap },
    SHIPPED: { label: 'In Transit', color: 'indigo', icon: Truck },
    DELIVERED: { label: 'Delivered', color: 'emerald', icon: CheckCircle },
    CANCELLED: { label: 'Cancelled', color: 'rose', icon: XCircle },
}

const ALL_COLUMNS: ColumnDef<Order>[] = [
    { key: 'date', label: 'Date', sortable: true, alwaysVisible: true },
    { key: 'reference', label: 'Order #', sortable: true, alwaysVisible: true },
    { key: 'client', label: 'Customer' },
    { key: 'items', label: 'Items', align: 'center' as const },
    { key: 'amount', label: 'Amount', align: 'right' as const, sortable: true },
]

export default function DigitalCommerceStreamPage() {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('ecommerce_orders_v3', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 25,
        sortKey: 'date',
        sortDir: 'desc',
    })

    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('ALL')

    const loadOrders = useCallback(async () => {
        setLoading(true)
        try {
            const params = statusFilter !== 'ALL' ? `?status=${statusFilter}` : ''
            const data = await erpFetch(`client-portal/admin-orders/${params}`)
            setOrders(Array.isArray(data) ? data : (data?.results ?? []))
        } catch {
            setOrders([])
            toast.error("Failed to load orders")
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => { loadOrders() }, [loadOrders])

    // KPI Calculations
    const throughput = orders.length
    const pendingFulfillment = orders.filter(o => o.status === 'PLACED' || o.status === 'CONFIRMED' || o.status === 'PROCESSING').length
    const revenueVelocity = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

    const columns: ColumnDef<Order>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: Order) => React.ReactNode> = {
            date: r => <span className="text-gray-500 font-medium">{new Date(r.created_at).toLocaleDateString()}</span>,
            reference: r => <span className="font-mono font-bold text-gray-900">{r.order_number || `#${r.id}`}</span>,
            client: r => (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-900">{r.client?.name || r.client_name || 'Anonymous Guest'}</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">External Link Node</span>
                </div>
            ),
            items: r => <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-0 font-black text-[10px]">{r.items_count || 0} ITEMS</Badge>,
            amount: r => <span className="font-black text-gray-900">{fmt(r.total_amount)}</span>,
        }
        return { ...c, render: renderers[c.key] }
    })

    const expandable = {
        getDetails: (r: any) => r.lines || [],
        columns: [
            {
                key: 'product',
                label: 'SKU / Asset',
                render: (l: any) => <span className="font-bold text-gray-700">{l.product_name}</span>
            },
            {
                key: 'qty',
                label: 'Quantity',
                align: 'center',
                render: (l: any) => <span className="font-mono text-gray-400 font-black">×{l.quantity}</span>
            },
            {
                key: 'price',
                label: 'Unit Value',
                align: 'right',
                render: (l: any) => <span className="font-bold text-gray-600">{fmt(Number(l.unit_price))}</span>
            },
            {
                key: 'total',
                label: 'Line Settlement',
                align: 'right',
                render: (l: any) => <span className="font-black text-violet-600">{fmt(Number(l.unit_price) * Number(l.quantity))}</span>
            }
        ],
        headerColor: 'bg-violet-50/30',
        headerTextColor: 'text-violet-400',
    }

    const filtered = orders.filter(o => {
        const q = search.toLowerCase()
        return !q || o.order_number?.toLowerCase().includes(q) || o.client?.name?.toLowerCase().includes(q) || o.client_name?.toLowerCase().includes(q)
    })

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="page-header-title  tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                            <ShoppingCart size={28} className="text-white" />
                        </div>
                        Digital Commerce <span className="text-violet-600">Stream</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">E-Commerce Lifecycle & Transaction Engine</p>
                </div>
                <div className="flex items-center gap-2 bg-violet-50 px-4 py-2 rounded-2xl border border-violet-100">
                    <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-violet-700 tracking-widest">Global Stream Online</span>
                </div>
            </header>

            {/* Commerce Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Globe size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Total Orders</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{throughput} <span className="text-sm text-gray-300">orders</span></h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Package size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Pending Fulfillment</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{pendingFulfillment}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Revenue Velocity</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmt(revenueVelocity)}</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TypicalListView<Order>
                title="Commerce Ledger"
                data={filtered}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                expandable={expandable}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={k => settings.setSort(k)}
                headerExtra={
                    <Button onClick={loadOrders} variant="ghost" className="h-8 w-8 p-0 text-stone-400 hover:text-violet-600">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </Button>
                }
                lifecycle={{
                    getStatus: r => {
                        const s = STATUS_MAP[r.status] || { label: r.status, color: 'gray' }
                        const variantMap: Record<string, any> = {
                            orange: 'warning',
                            blue: 'default',
                            violet: 'default',
                            indigo: 'default',
                            emerald: 'success',
                            rose: 'destructive'
                        }
                        return { label: s.label, variant: variantMap[s.color] || 'default' }
                    }
                }}
                actions={{
                    onEdit: (r) => toast.info(`Opening order ${r.order_number}`),
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search Stream ID or Consignee...', value: search, onChange: setSearch }}
                    filters={[
                        {
                            key: 'status', label: 'Status', type: 'select', options: [
                                { value: 'ALL', label: 'All' },
                                ...Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))
                            ]
                        }
                    ]}
                    values={{ status: statusFilter }}
                    onChange={(k, v) => setStatusFilter(String(v))}
                />
            </TypicalListView>
        </div>
    )
}
