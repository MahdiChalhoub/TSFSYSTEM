'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { usePortal } from '@/context/PortalContext'
import {
    ArrowLeft, Package, Truck, CheckCircle2, Clock, XCircle, RotateCcw,
    Star, CreditCard, MapPin, Loader2, Hash, CalendarDays, FileText
} from 'lucide-react'

interface OrderLine {
    id: string
    product_name: string
    product_sku: string
    quantity: number
    unit_price: string
    total_price: string
    image_url?: string
}

interface OrderDetail {
    id: string
    order_number: string
    status: string
    payment_status: string
    payment_method: string
    total_amount: string
    subtotal: string
    tax_amount: string
    discount_amount: string
    currency: string
    placed_at: string | null
    estimated_delivery: string | null
    delivery_rating: number | null
    delivery_address: string | null
    notes: string | null
    lines: OrderLine[]
    created_at: string
    updated_at: string
}

const STATUS_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    CART: { label: 'In Cart', icon: Package, color: 'text-app-muted-foreground', bg: 'bg-app-surface-2/10' },
    PLACED: { label: 'Placed', icon: Clock, color: 'text-app-info', bg: 'bg-app-info/10' },
    CONFIRMED: { label: 'Confirmed', icon: CheckCircle2, color: 'text-app-success', bg: 'bg-app-success/10' },
    PROCESSING: { label: 'Processing', icon: Package, color: 'text-app-warning', bg: 'bg-app-warning/10' },
    SHIPPED: { label: 'Shipped', icon: Truck, color: 'text-app-accent', bg: 'bg-app-accent/10' },
    DELIVERED: { label: 'Delivered', icon: CheckCircle2, color: 'text-app-success', bg: 'bg-app-success/10' },
    CANCELLED: { label: 'Cancelled', icon: XCircle, color: 'text-app-error', bg: 'bg-app-error/10' },
    RETURNED: { label: 'Returned', icon: RotateCcw, color: 'text-app-warning', bg: 'bg-app-warning/10' },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Pending', color: 'text-app-warning' },
    PAID: { label: 'Paid', color: 'text-app-success' },
    PARTIAL: { label: 'Partial', color: 'text-app-info' },
    REFUNDED: { label: 'Refunded', color: 'text-app-error' },
}

export default function OrderDetailPage() {
    const { slug, id } = useParams<{ slug: string; id: string }>()
    const { isAuthenticated, token } = usePortal()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isAuthenticated || !token) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/client-portal/my-orders/${id}/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => { setOrder(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [isAuthenticated, token, id])

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">Please log in</h1>
                    <Link href={`/tenant/${slug}`} className="text-app-success font-bold">Go to Store</Link>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center">
                <Loader2 className="animate-spin text-app-success" size={40} />
            </div>
        )
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <Package size={48} className="mx-auto text-app-faint" />
                    <h1 className="text-2xl font-bold text-white">Order not found</h1>
                    <Link href={`/tenant/${slug}/account/orders`}
                        className="inline-flex items-center gap-2 text-app-success font-medium">
                        <ArrowLeft size={16} /> Back to Orders
                    </Link>
                </div>
            </div>
        )
    }

    const st = STATUS_MAP[order.status] || STATUS_MAP.PLACED
    const Icon = st.icon
    const ps = PAYMENT_STATUS_MAP[order.payment_status] || PAYMENT_STATUS_MAP.PENDING

    return (
        <div className="min-h-screen bg-app-bg p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-app-info/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <Link href={`/tenant/${slug}/account/orders`}
                        className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> All Orders
                    </Link>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-black text-white flex items-center gap-3">
                                <Hash size={28} className="text-app-faint" />{order.order_number}
                            </h1>
                            <p className="text-app-muted-foreground text-sm mt-1">
                                {order.placed_at ? `Placed ${new Date(order.placed_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : 'Draft Order'}
                            </p>
                        </div>
                        <div className={`flex items-center gap-2 px-5 py-3 ${st.bg} border border-white/5 rounded-2xl ${st.color}`}>
                            <Icon size={20} />
                            <span className="font-black text-sm uppercase tracking-widest">{st.label}</span>
                        </div>
                    </div>
                </div>

                {/* Status + Payment Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-app-surface/60 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-2 text-app-muted-foreground text-[10px] font-black uppercase tracking-widest mb-2">
                            <CreditCard size={14} /> Payment
                        </div>
                        <p className={`text-lg font-bold ${ps.color}`}>{ps.label}</p>
                        {order.payment_method && <p className="text-app-muted-foreground text-xs mt-1">{order.payment_method}</p>}
                    </div>
                    <div className="p-5 bg-app-surface/60 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-2 text-app-muted-foreground text-[10px] font-black uppercase tracking-widest mb-2">
                            <CalendarDays size={14} /> Estimated Delivery
                        </div>
                        <p className="text-lg font-bold text-white">
                            {order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString() : '—'}
                        </p>
                    </div>
                    {order.delivery_rating && (
                        <div className="p-5 bg-app-surface/60 border border-white/5 rounded-2xl">
                            <div className="flex items-center gap-2 text-app-muted-foreground text-[10px] font-black uppercase tracking-widest mb-2">
                                <Star size={14} /> Delivery Rating
                            </div>
                            <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <Star key={i} size={18} fill={i <= order.delivery_rating! ? 'currentColor' : 'none'}
                                        className={i <= order.delivery_rating! ? 'text-app-warning' : 'text-app-faint'} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Delivery Address */}
                {order.delivery_address && (
                    <div className="p-5 bg-app-surface/60 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-2 text-app-muted-foreground text-[10px] font-black uppercase tracking-widest mb-2">
                            <MapPin size={14} /> Delivery Address
                        </div>
                        <p className="text-white text-sm">{order.delivery_address}</p>
                    </div>
                )}

                {/* ─── Order Tracking Timeline ───────────────────────────── */}
                {order.status !== 'CART' && order.status !== 'CANCELLED' && (
                    <div className="p-6 bg-app-surface/60 border border-white/5 rounded-2xl">
                        <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-6">Order Tracking</h3>
                        <div className="flex items-start justify-between relative">
                            {/* Connector line */}
                            <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-app-surface-2" />
                            <div className="absolute top-5 left-[10%] h-0.5 bg-app-primary transition-all duration-500"
                                style={{
                                    width: (() => {
                                        const steps = ['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
                                        const idx = steps.indexOf(order.status)
                                        if (idx <= 0) return '0%'
                                        return `${(idx / (steps.length - 1)) * 80}%`
                                    })()
                                }} />

                            {['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].map((step, i) => {
                                const steps = ['PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']
                                const currentIdx = steps.indexOf(order.status)
                                const isCompleted = i < currentIdx
                                const isCurrent = i === currentIdx
                                const stepIcons = [Clock, CheckCircle2, Package, Truck, CheckCircle2]
                                const StepIcon = stepIcons[i]

                                return (
                                    <div key={step} className="flex flex-col items-center relative z-10" style={{ width: '20%' }}>
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                                            ${isCurrent
                                                ? 'bg-app-success/20 border-app-primary text-app-success scale-110'
                                                : isCompleted
                                                    ? 'bg-app-primary border-app-primary text-white'
                                                    : 'bg-app-surface border-app-border-strong text-app-faint'
                                            }`}>
                                            <StepIcon size={18} />
                                        </div>
                                        <span className={`mt-2 text-[10px] font-bold uppercase tracking-widest text-center
                                            ${isCurrent ? 'text-app-success' : isCompleted ? 'text-app-muted-foreground' : 'text-app-faint'}`}>
                                            {step.charAt(0) + step.slice(1).toLowerCase()}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Order Lines */}
                <div className="space-y-4">
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                        <FileText size={18} className="text-app-faint" /> Items ({order.lines?.length || 0})
                    </h2>

                    {order.lines && order.lines.length > 0 ? (
                        <div className="space-y-3">
                            {order.lines.map(line => (
                                <div key={line.id}
                                    className="flex items-center gap-5 p-4 bg-app-surface/60 border border-white/5 rounded-2xl">
                                    <div className="w-16 h-16 bg-app-surface-2 rounded-xl overflow-hidden flex-shrink-0">
                                        {line.image_url ? (
                                            <img src={line.image_url} alt={line.product_name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package size={20} className="text-app-faint" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-white font-bold truncate">{line.product_name}</p>
                                        <p className="text-app-muted-foreground text-xs font-mono">{line.product_sku}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-white font-bold">${parseFloat(line.total_price).toFixed(2)}</p>
                                        <p className="text-app-muted-foreground text-xs">{line.quantity} × ${parseFloat(line.unit_price).toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-app-muted-foreground text-sm py-8 text-center">No line items available</p>
                    )}
                </div>

                {/* Order Notes */}
                {order.notes && (
                    <div className="p-5 bg-app-surface/60 border border-white/5 rounded-2xl">
                        <div className="flex items-center gap-2 text-app-muted-foreground text-[10px] font-black uppercase tracking-widest mb-2">
                            <FileText size={14} /> Notes
                        </div>
                        <p className="text-app-foreground text-sm whitespace-pre-wrap">{order.notes}</p>
                    </div>
                )}

                {/* Totals */}
                <div className="p-6 bg-app-surface/40 border border-white/5 rounded-2xl space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-app-muted-foreground">Subtotal</span>
                        <span className="text-white font-medium">${parseFloat(order.subtotal || '0').toFixed(2)}</span>
                    </div>
                    {parseFloat(order.tax_amount || '0') > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-app-muted-foreground">Tax</span>
                            <span className="text-white font-medium">${parseFloat(order.tax_amount).toFixed(2)}</span>
                        </div>
                    )}
                    {parseFloat(order.discount_amount || '0') > 0 && (
                        <div className="flex justify-between text-sm">
                            <span className="text-app-muted-foreground">Discount</span>
                            <span className="text-app-success font-medium">-${parseFloat(order.discount_amount).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="border-t border-white/5 pt-3 flex justify-between">
                        <span className="text-white font-bold">Total</span>
                        <span className="text-2xl font-black text-white">${parseFloat(order.total_amount).toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
