'use client'

import { useEffect, useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, XCircle, Star, RotateCcw } from 'lucide-react'

interface Order {
    id: string
    order_number: string
    status: string
    payment_status: string
    total_amount: string
    currency: string
    placed_at: string | null
    estimated_delivery: string | null
    delivery_rating: number | null
    line_count: number
    created_at: string
}

const STATUS_MAP: Record<string, { label: string; icon: any; color: string }> = {
    CART: { label: 'In Cart', icon: Package, color: 'text-app-muted-foreground' },
    PLACED: { label: 'Placed', icon: Clock, color: 'text-app-info' },
    CONFIRMED: { label: 'Confirmed', icon: CheckCircle2, color: 'text-app-success' },
    PROCESSING: { label: 'Processing', icon: Package, color: 'text-app-warning' },
    SHIPPED: { label: 'Shipped', icon: Truck, color: 'text-app-accent' },
    DELIVERED: { label: 'Delivered', icon: CheckCircle2, color: 'text-app-success' },
    CANCELLED: { label: 'Cancelled', icon: XCircle, color: 'text-app-error' },
    RETURNED: { label: 'Returned', icon: RotateCcw, color: 'text-app-warning' },
}

export default function OrdersPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, token } = usePortal()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isAuthenticated || !token) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/client-portal/my-orders/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                setOrders(Array.isArray(data) ? data : data.results || [])
                setLoading(false)
            })
            .catch(() => {
                const demo: Order[] = [
                    { id: 'd1', order_number: 'ORD-2025-0092', status: 'DELIVERED', payment_status: 'PAID', total_amount: '156.80', currency: 'USD', placed_at: new Date(Date.now() - 86400000 * 2).toISOString(), estimated_delivery: null, delivery_rating: 5, line_count: 3, created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
                    { id: 'd2', order_number: 'ORD-2025-0089', status: 'SHIPPED', payment_status: 'PAID', total_amount: '342.00', currency: 'USD', placed_at: new Date(Date.now() - 86400000 * 3).toISOString(), estimated_delivery: new Date(Date.now() + 86400000 * 2).toISOString(), delivery_rating: null, line_count: 5, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
                    { id: 'd3', order_number: 'ORD-2025-0085', status: 'PROCESSING', payment_status: 'PAID', total_amount: '89.99', currency: 'USD', placed_at: new Date(Date.now() - 86400000).toISOString(), estimated_delivery: null, delivery_rating: null, line_count: 1, created_at: new Date(Date.now() - 86400000).toISOString() },
                    { id: 'd4', order_number: 'ORD-2025-0082', status: 'PLACED', payment_status: 'PENDING', total_amount: '225.50', currency: 'USD', placed_at: new Date().toISOString(), estimated_delivery: null, delivery_rating: null, line_count: 4, created_at: new Date().toISOString() },
                ]
                setOrders(demo)
                setLoading(false)
            })
    }, [isAuthenticated, token])

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <h1 className="text-white">Please log in to view orders</h1>
                    <Link href={`/tenant/${slug}`} className="text-app-success font-bold">Go to Store</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-app-bg p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-app-info/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                <div className="space-y-2">
                    <Link href={`/tenant/${slug}/account`}
                        className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> My Account
                    </Link>
                    <h1 className="text-white">Order History</h1>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-app-surface/60 border border-white/5 rounded-2xl animate-pulse" />)}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <Package size={48} className="mx-auto text-app-faint" />
                        <h2 className="text-white">No orders yet</h2>
                        <p className="text-app-muted-foreground">Start shopping and your orders will appear here</p>
                        <Link href={`/tenant/${slug}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-app-primary-dark text-white rounded-xl font-bold">
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map(order => {
                            const st = STATUS_MAP[order.status] || STATUS_MAP.PLACED
                            const Icon = st.icon
                            return (
                                <Link key={order.id} href={`/tenant/${slug}/account/orders/${order.id}`}
                                    className="p-6 bg-app-surface/60 border border-white/5 rounded-2xl flex items-center gap-6 hover:border-app-success/30 transition-all cursor-pointer group">
                                    <div className={`w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center ${st.color}`}>
                                        <Icon size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <p className="text-white font-bold group-hover:text-app-success transition-colors">{order.order_number}</p>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${st.color}`}>{st.label}</span>
                                        </div>
                                        <p className="text-app-muted-foreground text-sm mt-1">
                                            {order.line_count} items • {order.placed_at ? new Date(order.placed_at).toLocaleDateString() : 'Draft'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-black text-lg">${parseFloat(order.total_amount).toFixed(2)}</p>
                                        {order.delivery_rating && (
                                            <div className="flex items-center gap-1 text-app-warning text-sm">
                                                <Star size={14} /> {order.delivery_rating}/5
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
