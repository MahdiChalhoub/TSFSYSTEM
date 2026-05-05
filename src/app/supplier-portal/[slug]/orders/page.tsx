'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ShoppingCart, Truck, CheckCircle2, Clock, Package, Eye, FileText } from 'lucide-react'

interface PurchaseOrder {
    id: string
    po_number: string
    status: string
    expected_delivery: string | null
    total_amount: string
    currency: string
    line_count: number
    created_at: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'text-app-faint' },
    SENT: { label: 'Sent', color: 'text-app-info' },
    CONFIRMED: { label: 'Confirmed', color: 'text-app-success' },
    IN_TRANSIT: { label: 'In Transit', color: 'text-app-warning' },
    RECEIVED: { label: 'Received', color: 'text-app-success' },
    CANCELLED: { label: 'Cancelled', color: 'text-app-error' },
}

function getToken(slug: string): string | null {
    if (typeof window === 'undefined') return null
    try {
        const s = JSON.parse(localStorage.getItem('supplier_session') || 'null')
        return s?.organization?.slug === slug ? s.token : null
    } catch { return null }
}

export default function SupplierOrdersPage() {
    const { slug } = useParams<{ slug: string }>()
    const [orders, setOrders] = useState<PurchaseOrder[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const token = getToken(slug)
        if (!token) { setLoading(false); return }
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/supplier-portal/my-orders/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                setOrders(Array.isArray(data) ? data : data.results || [])
                setLoading(false)
            })
            .catch(() => {
                const demo: PurchaseOrder[] = [
                    { id: 'po1', po_number: 'PO-2025-0041', status: 'CONFIRMED', expected_delivery: new Date(Date.now() + 86400000 * 5).toISOString(), total_amount: '4250.00', currency: 'USD', line_count: 8, created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
                    { id: 'po2', po_number: 'PO-2025-0038', status: 'IN_TRANSIT', expected_delivery: new Date(Date.now() + 86400000 * 2).toISOString(), total_amount: '1890.00', currency: 'USD', line_count: 3, created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
                    { id: 'po3', po_number: 'PO-2025-0035', status: 'RECEIVED', expected_delivery: null, total_amount: '6720.50', currency: 'USD', line_count: 12, created_at: new Date(Date.now() - 86400000 * 10).toISOString() },
                    { id: 'po4', po_number: 'PO-2025-0033', status: 'SENT', expected_delivery: null, total_amount: '980.00', currency: 'USD', line_count: 2, created_at: new Date(Date.now() - 86400000).toISOString() },
                ]
                setOrders(demo)
                setLoading(false)
            })
    }, [slug])

    return (
        <div className="min-h-screen bg-app-bg p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-app-info/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                <div className="space-y-2">
                    <Link href={`/supplier-portal/${slug}`}
                        className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Dashboard
                    </Link>
                    <h1 className="text-white">Purchase Orders</h1>
                    <p className="text-app-muted-foreground text-sm">Orders placed by the buyer directed to you</p>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-900/60 rounded-2xl animate-pulse" />)}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <ShoppingCart size={48} className="mx-auto text-app-muted-foreground" />
                        <h2 className="text-white">No purchase orders yet</h2>
                        <p className="text-app-muted-foreground">When the buyer creates POs for you, they&#39;ll appear here</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {orders.map(order => {
                            const st = STATUS_MAP[order.status] || STATUS_MAP.DRAFT
                            return (
                                <div key={order.id}
                                    className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-6 hover:border-white/10 transition-all">
                                    <div className={`w-12 h-12 bg-app-surface/5 rounded-xl flex items-center justify-center ${st.color}`}>
                                        <Package size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <p className="text-white font-bold">{order.po_number}</p>
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${st.color}`}>{st.label}</span>
                                        </div>
                                        <p className="text-app-muted-foreground text-sm mt-1">
                                            {order.line_count} items • {new Date(order.created_at).toLocaleDateString()}
                                            {order.expected_delivery && ` • ETA: ${new Date(order.expected_delivery).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-white font-black text-lg">${parseFloat(order.total_amount).toFixed(2)}</p>
                                        <p className="text-app-muted-foreground text-[10px] uppercase">{order.currency}</p>
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
