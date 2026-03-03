// @ts-nocheck
'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { ShoppingCart, Clock, CheckCircle, Truck, Package, RefreshCw, XCircle, DollarSign, Zap, Globe, ChevronDown, CreditCard, ShoppingBag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { transitionOrderStatus, confirmManualPayment } from '@/app/actions/ecommerce/orders'
import { ALLOWED_TRANSITIONS, STATUS_LABELS } from '@/app/actions/ecommerce/orders-types'

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
    // track which orders are currently being transitioned or paying
    const [transitioning, setTransitioning] = useState<Record<number, boolean>>({})

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

    const handleTransition = async (order: Order, newStatus: string) => {
        setTransitioning(prev => ({ ...prev, [order.id]: true }))
        const result = await transitionOrderStatus(order.id, newStatus)
        setTransitioning(prev => ({ ...prev, [order.id]: false }))
        if (result.success) {
            toast.success(`Order ${order.order_number}: ${result.previous_status} → ${result.new_status}`)
            loadOrders()
        } else {
            toast.error(result.error || 'Transition failed')
        }
    }

    const handleConfirmPayment = async (order: Order) => {
        setTransitioning(prev => ({ ...prev, [order.id]: true }))
        const result = await confirmManualPayment(order.id)
        setTransitioning(prev => ({ ...prev, [order.id]: false }))
        if (result.success) {
            toast.success(`Payment confirmed for ${order.order_number}`)
            loadOrders()
        } else {
            toast.error(result.error || 'Failed to confirm payment')
        }
    }

    // KPI Calculations
    const throughput = orders.length
    const pendingFulfillment = orders.filter(o => o.status === 'PLACED' || o.status === 'CONFIRMED' || o.status === 'PROCESSING').length
    const revenueVelocity = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)

    const columns: ColumnDef<Order>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: Order) => React.ReactNode> = {
            date: r => <span className="text-app-muted-foreground font-medium">{new Date(r.created_at).toLocaleDateString()}</span>,
            reference: r => <span className="font-mono font-bold text-app-foreground">{r.order_number || `#${r.id}`}</span>,
            client: r => (
                <div className="app-page flex flex-col">
                    <span className="font-bold text-app-foreground">{r.client?.name || r.client_name || 'Anonymous Guest'}</span>
                    <span className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest leading-none">External Link Node</span>
                </div>
            ),
            items: r => <Badge variant="secondary" className="bg-app-surface-2 text-app-muted-foreground border-0 font-black text-[10px]">{r.items_count || 0} ITEMS</Badge>,
            amount: r => <span className="font-black text-app-foreground">{fmt(r.total_amount)}</span>,
        }
        return { ...c, render: renderers[c.key] }
    })

    const expandable = {
        getDetails: (r: any) => r.lines || [],
        columns: [
            {
                key: 'product',
                label: 'SKU / Asset',
                render: (l: any) => <span className="font-bold text-app-muted-foreground">{l.product_name}</span>
            },
            {
                key: 'qty',
                label: 'Quantity',
                align: 'center',
                render: (l: any) => <span className="font-mono text-app-muted-foreground font-black">×{l.quantity}</span>
            },
            {
                key: 'price',
                label: 'Unit Value',
                align: 'right',
                render: (l: any) => <span className="font-bold text-app-muted-foreground">{fmt(Number(l.unit_price))}</span>
            },
            {
                key: 'total',
                label: 'Line Settlement',
                align: 'right',
                render: (l: any) => <span className="font-black text-app-primary">{fmt(Number(l.unit_price) * Number(l.quantity))}</span>
            }
        ],
        headerColor: 'bg-violet-50/30',
        headerTextColor: 'text-app-primary',
    }

    const filtered = orders.filter(o => {
        const q = search.toLowerCase()
        return !q || o.order_number?.toLowerCase().includes(q) || o.client?.name?.toLowerCase().includes(q) || o.client_name?.toLowerCase().includes(q)
    })

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
                        <ShoppingBag size={32} className="text-app-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">eCommerce</p>
                        <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
                            Online <span className="text-app-primary">Orders</span>
                        </h1>
                    </div>
                </div>
            </header>

            {/* Commerce Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-violet-50 text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Globe size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Total Orders</p>
                            <h2 className="text-3xl font-black text-app-foreground mt-0.5">{throughput} <span className="text-sm text-app-muted-foreground">orders</span></h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Package size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Pending Fulfillment</p>
                            <h2 className="text-3xl font-black text-app-foreground mt-0.5">{pendingFulfillment}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">Revenue Velocity</p>
                            <h2 className="text-3xl font-black text-app-foreground mt-0.5">{fmt(revenueVelocity)}</h2>
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
                    <Button onClick={loadOrders} variant="ghost" className="h-8 w-8 p-0 text-app-muted-foreground hover:text-app-primary">
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
                rowActions={(r: Order) => {
                    const allowed = ALLOWED_TRANSITIONS[r.status] ?? []
                    const busy = transitioning[r.id] ?? false
                    return (
                        <div className="flex items-center gap-2">
                            {allowed.length > 0 && (
                                <div className="relative group">
                                    <Button size="sm" variant="outline" disabled={busy}
                                        className="h-7 px-2 text-xs font-bold border-app-border text-app-muted-foreground hover:border-violet-400 hover:text-app-primary flex items-center gap-1">
                                        Move <ChevronDown size={10} />
                                    </Button>
                                    <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:flex flex-col bg-app-surface border border-app-border rounded-xl shadow-xl overflow-hidden min-w-[130px]">
                                        {allowed.map(s => (
                                            <button key={s} onClick={() => handleTransition(r, s)}
                                                className="px-3 py-2 text-xs font-bold text-left hover:bg-violet-50 hover:text-app-primary transition-colors">
                                                → {STATUS_LABELS[s] ?? s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {(r as any).payment_status === 'UNPAID' && ['PLACED', 'CONFIRMED', 'DELIVERED'].includes(r.status) && (
                                <Button size="sm" variant="outline" disabled={busy}
                                    onClick={() => handleConfirmPayment(r)}
                                    className="h-7 px-2 text-xs font-bold border-app-success/30 text-app-success hover:bg-app-success/5 flex items-center gap-1">
                                    <CreditCard size={10} /> Pay
                                </Button>
                            )}
                        </div>
                    )
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
