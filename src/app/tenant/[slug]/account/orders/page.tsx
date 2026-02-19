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
    CART: { label: 'In Cart', icon: Package, color: 'text-slate-400' },
    PLACED: { label: 'Placed', icon: Clock, color: 'text-blue-400' },
    CONFIRMED: { label: 'Confirmed', icon: CheckCircle2, color: 'text-emerald-400' },
    PROCESSING: { label: 'Processing', icon: Package, color: 'text-amber-400' },
    SHIPPED: { label: 'Shipped', icon: Truck, color: 'text-purple-400' },
    DELIVERED: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-400' },
    CANCELLED: { label: 'Cancelled', icon: XCircle, color: 'text-red-400' },
    RETURNED: { label: 'Returned', icon: RotateCcw, color: 'text-amber-400' },
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
            .catch(() => setLoading(false))
    }, [isAuthenticated, token])

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">Please log in to view orders</h1>
                    <Link href={`/tenant/${slug}`} className="text-emerald-400 font-bold">Go to Store</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                <div className="space-y-2">
                    <Link href={`/tenant/${slug}/account`}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> My Account
                    </Link>
                    <h1 className="text-4xl font-black text-white">Order History</h1>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-900/60 border border-white/5 rounded-2xl animate-pulse" />)}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <Package size={48} className="mx-auto text-slate-600" />
                        <h2 className="text-xl font-bold text-white">No orders yet</h2>
                        <p className="text-slate-500">Start shopping and your orders will appear here</p>
                        <Link href={`/tenant/${slug}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold">
                            Browse Products
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map(order => {
                            const st = STATUS_MAP[order.status] || STATUS_MAP.PLACED
                            const Icon = st.icon
                            return (
                                <div key={order.id}
                                    className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-6 hover:border-white/10 transition-all">
                                    <div className={`w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center ${st.color}`}>
                                        <Icon size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <p className="text-white font-bold">{order.order_number}</p>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${st.color}`}>{st.label}</span>
                                        </div>
                                        <p className="text-slate-500 text-sm mt-1">
                                            {order.line_count} items • {order.placed_at ? new Date(order.placed_at).toLocaleDateString() : 'Draft'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-black text-lg">${parseFloat(order.total_amount).toFixed(2)}</p>
                                        {order.delivery_rating && (
                                            <div className="flex items-center gap-1 text-amber-400 text-sm">
                                                <Star size={14} /> {order.delivery_rating}/5
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
