'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Package, Truck, CheckCircle2, Clock, XCircle, Star, RotateCcw, ChevronRight } from 'lucide-react'
import { useAuth } from '../../engine/hooks/useAuth'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
interface Order {
    id: string; order_number: string; status: string; payment_status: string
    total_amount: string; currency: string; placed_at: string | null
    estimated_delivery: string | null; delivery_rating: number | null
    line_count: number; created_at: string
}
const STATUS_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    CART: { label: 'Staging', icon: Package, color: 'text-app-muted-foreground', bg: 'bg-slate-500/10' },
    PLACED: { label: 'Placed', icon: Clock, color: 'text-blue-400', bg: 'bg-app-info/10' },
    CONFIRMED: { label: 'Confirmed', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-app-success/10' },
    PROCESSING: { label: 'Allocating', icon: Package, color: 'text-amber-400', bg: 'bg-app-warning/10' },
    SHIPPED: { label: 'In Transit', icon: Truck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    DELIVERED: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-app-success/10' },
    CANCELLED: { label: 'Voided', icon: XCircle, color: 'text-rose-400', bg: 'bg-app-error/10' },
    RETURNED: { label: 'Reversed', icon: RotateCcw, color: 'text-amber-400', bg: 'bg-app-warning/10' },
}
export default function MidnightOrdersPage() {
    const { path } = useStorefrontPath()
    const { isAuthenticated } = useAuth()
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    useEffect(() => {
        if (!isAuthenticated) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        const token = localStorage.getItem('portal_token')
        fetch(`${djangoUrl}/api/client-portal/my-orders/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.json())
            .then(data => { setOrders(Array.isArray(data) ? data : data.results || []); setLoading(false) })
            .catch(() => {
                setOrders([
                    { id: 'd1', order_number: 'ORD-2025-0092', status: 'DELIVERED', payment_status: 'PAID', total_amount: '156.80', currency: 'USD', placed_at: new Date(Date.now() - 86400000 * 2).toISOString(), estimated_delivery: null, delivery_rating: 5, line_count: 3, created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
                    { id: 'd2', order_number: 'ORD-2025-0089', status: 'SHIPPED', payment_status: 'PAID', total_amount: '342.00', currency: 'USD', placed_at: new Date(Date.now() - 86400000 * 3).toISOString(), estimated_delivery: new Date(Date.now() + 86400000 * 2).toISOString(), delivery_rating: null, line_count: 5, created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
                    { id: 'd3', order_number: 'ORD-2025-0085', status: 'PROCESSING', payment_status: 'PAID', total_amount: '89.99', currency: 'USD', placed_at: new Date(Date.now() - 86400000).toISOString(), estimated_delivery: null, delivery_rating: null, line_count: 1, created_at: new Date(Date.now() - 86400000).toISOString() },
                    { id: 'd4', order_number: 'ORD-2025-0082', status: 'PLACED', payment_status: 'PENDING', total_amount: '225.50', currency: 'USD', placed_at: new Date().toISOString(), estimated_delivery: null, delivery_rating: null, line_count: 4, created_at: new Date().toISOString() },
                ])
                setLoading(false)
            })
    }, [isAuthenticated])
    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-app-info/5 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-app-success/5 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="max-w-4xl mx-auto relative z-10 space-y-12">
                <div className="space-y-4">
                    <Link href={path('/account')}
                        className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard Ledger
                    </Link>
                    <h1 className="text-5xl font-black text-white italic tracking-tighter">Order <span className="text-app-success">History</span></h1>
                    <p className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest">Tracking your architectural commerce stream</p>
                </div>
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-900/40 border border-white/5 rounded-[2rem] animate-pulse" />)}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-24 text-center space-y-8 bg-slate-900/20 border border-white/5 rounded-[3.5rem]">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto text-app-muted-foreground">
                            <Package size={48} />
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-black text-white italic">Zero Operations Found</h2>
                            <p className="text-app-muted-foreground text-sm">Your commerce history is currently empty. Initialize a new stream.</p>
                        </div>
                        <Link href={path('/')}
                            className="inline-flex items-center gap-3 px-10 py-4 bg-app-success text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-app-success shadow-xl shadow-emerald-900/40 transition-all">
                            Initialize Storefront <ChevronRight size={16} />
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map(order => {
                            const st = STATUS_MAP[order.status] || STATUS_MAP.PLACED
                            const Icon = st.icon
                            return (
                                <Link key={order.id} href={path(`/account/orders/${order.id}`)}
                                    className="p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] flex items-center gap-8 hover:border-app-success/30 transition-all cursor-pointer group hover:bg-slate-900/60 shadow-2xl shadow-black/20">
                                    <div className={`w-16 h-16 ${st.bg} rounded-2xl flex items-center justify-center ${st.color} group-hover:scale-110 transition-transform`}>
                                        <Icon size={28} />
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center gap-4">
                                            <p className="text-xl font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tighter">{order.order_number}</p>
                                            <div className={`px-3 py-1 ${st.bg} rounded-full text-[9px] font-black uppercase tracking-widest ${st.color} border border-white/5`}>
                                                {st.label}
                                            </div>
                                        </div>
                                        <p className="text-app-muted-foreground text-xs font-medium">
                                            {order.line_count} Unit Assets • {order.placed_at ? new Date(order.placed_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Pending Initialization'}
                                        </p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <p className="text-2xl font-black text-white italic tracking-tighter">${parseFloat(order.total_amount).toFixed(2)}</p>
                                        {order.delivery_rating ? (
                                            <div className="flex items-center justify-end gap-1 text-amber-400 text-xs font-bold">
                                                <Star size={12} fill="currentColor" /> {order.delivery_rating}.0
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest">Awaiting Delivery</div>
                                        )}
                                    </div>
                                    <ChevronRight size={20} className="text-app-foreground group-hover:text-app-success group-hover:translate-x-1 transition-all" />
                                </Link>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
