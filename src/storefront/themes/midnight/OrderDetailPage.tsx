'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, Package, Truck, CheckCircle2, Clock, XCircle, RotateCcw,
    Star, CreditCard, MapPin, Loader2, Hash, CalendarDays, FileText, ChevronRight
} from 'lucide-react'
import { useAuth } from '../../engine/hooks/useAuth'

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
}

const STATUS_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
    CART: { label: 'Draft', icon: Package, color: 'text-slate-400', bg: 'bg-slate-500/10' },
    PLACED: { label: 'Placed', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    CONFIRMED: { label: 'Confirmed', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    PROCESSING: { label: 'In Flow', icon: Package, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    SHIPPED: { label: 'In Transit', icon: Truck, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    DELIVERED: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    CANCELLED: { label: 'Voided', icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    RETURNED: { label: 'Reversed', icon: RotateCcw, color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

const PAYMENT_STATUS_MAP: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Pending Settlement', color: 'text-amber-400' },
    PAID: { label: 'Settled', color: 'text-emerald-400' },
    PARTIAL: { label: 'Partial Settlement', color: 'text-blue-400' },
    REFUNDED: { label: 'Reversed', color: 'text-rose-400' },
}

export default function MidnightOrderDetailPage() {
    const { slug, id } = useParams<{ slug: string; id: string }>()
    const { isAuthenticated } = useAuth()
    const [order, setOrder] = useState<OrderDetail | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isAuthenticated) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        const token = localStorage.getItem('portal_token')

        fetch(`${djangoUrl}/api/client-portal/my-orders/${id}/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => { setOrder(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [isAuthenticated, id])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-2xl shadow-emerald-500/20" />
            </div>
        )
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
                <div className="space-y-6">
                    <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-[2rem] flex items-center justify-center mx-auto text-rose-500">
                        <XCircle size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter">Null Data Stream</h1>
                    <p className="text-slate-500 text-sm">The requested order object does not exist in the active ledger.</p>
                    <Link href={`/tenant/${slug}/account/orders`}
                        className="inline-flex items-center gap-2 text-emerald-400 font-black uppercase tracking-widest text-[10px] hover:text-emerald-300 transition-colors">
                        <ArrowLeft size={16} /> Return to History
                    </Link>
                </div>
            </div>
        )
    }

    const st = STATUS_MAP[order.status] || STATUS_MAP.PLACED
    const Icon = st.icon
    const ps = PAYMENT_STATUS_MAP[order.payment_status] || PAYMENT_STATUS_MAP.PENDING

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-10">
                {/* Header */}
                <div className="space-y-4">
                    <Link href={`/tenant/${slug}/account/orders`}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Transaction History
                    </Link>
                    <div className="flex items-center justify-between flex-wrap gap-6">
                        <div className="space-y-1">
                            <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase">
                                {order.order_number}
                            </h1>
                            <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em]">
                                {order.placed_at ? `Initialized ${new Date(order.placed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'Draft Instance'}
                            </p>
                        </div>
                        <div className={`flex items-center gap-3 px-8 py-4 ${st.bg} border border-white/5 rounded-[2rem] ${st.color} shadow-2xl`}>
                            <Icon size={24} />
                            <span className="font-black text-xs uppercase tracking-[0.4em]">{st.label}</span>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <SummaryCard label="Settlement Status" value={ps.label} meta={order.payment_method || 'Internal Credit'} icon={<CreditCard size={18} />} color={ps.color} />
                    <SummaryCard label="ETA Forecast" value={order.estimated_delivery ? new Date(order.estimated_delivery).toLocaleDateString() : 'N/A'} meta="Estimated Arrival" icon={<CalendarDays size={18} />} />
                    <SummaryCard label="Review Score" value={order.delivery_rating ? `${order.delivery_rating}.0` : 'Pending'} meta="Delivery Rating" icon={<Star size={18} />} color={order.delivery_rating ? 'text-amber-400' : 'text-slate-600'} />
                </div>

                {/* Tracking Progress */}
                {order.status !== 'CART' && order.status !== 'CANCELLED' && (
                    <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3.5rem] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 text-white/5 group-hover:text-emerald-500/10 transition-colors">
                            <TrendingUp size={120} />
                        </div>
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-12">Deployment Lifecycle</h3>
                        <div className="flex items-start justify-between relative">
                            <div className="absolute top-6 left-[10%] right-[10%] h-[1px] bg-slate-800" />
                            <div className="absolute top-6 left-[10%] h-[1px] bg-emerald-500 transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
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
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500
                                            ${isCurrent
                                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.2)] scale-110 rotate-12'
                                                : isCompleted
                                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                                    : 'bg-slate-950 border-white/5 text-slate-700'
                                            }`}>
                                            <StepIcon size={20} />
                                        </div>
                                        <span className={`mt-4 text-[9px] font-black uppercase tracking-widest text-center transition-colors
                                            ${isCurrent ? 'text-emerald-400' : isCompleted ? 'text-slate-400' : 'text-slate-800'}`}>
                                            {step}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Content Split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Left: Items */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">Segment Assets</h2>
                            <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest">{order.lines?.length || 0} Entities</div>
                        </div>

                        <div className="space-y-4">
                            {order.lines?.map(line => (
                                <div key={line.id} className="p-6 bg-slate-900/40 border border-white/5 rounded-[2.5rem] flex items-center gap-6 group hover:border-white/10 transition-all">
                                    <div className="w-20 h-20 bg-slate-950 rounded-[1.5rem] overflow-hidden flex-shrink-0 border border-white/5">
                                        {line.image_url ? (
                                            <img src={line.image_url} alt={line.product_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-800">
                                                <Package size={28} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-lg font-black text-white italic truncate">{line.product_name}</h4>
                                        <p className="text-slate-500 text-xs font-mono tracking-widest uppercase mt-1">REF: {line.product_sku}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0 space-y-1">
                                        <p className="text-xl font-black text-white">${parseFloat(line.total_price).toFixed(2)}</p>
                                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{line.quantity} Unit @ ${parseFloat(line.unit_price).toFixed(0)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Summary */}
                    <div className="space-y-6">
                        <div className="p-8 bg-slate-900/60 border border-emerald-500/10 rounded-[3rem] space-y-8 shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 text-emerald-500/5">
                                <CreditCard size={80} />
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Financial Summary</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Net Value</span>
                                        <span className="text-white font-black italic tracking-tight">${parseFloat(order.subtotal || '0').toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Tax Provision</span>
                                        <span className="text-white font-black italic tracking-tight">${parseFloat(order.tax_amount || '0').toFixed(2)}</span>
                                    </div>
                                    {parseFloat(order.discount_amount || '0') > 0 && (
                                        <div className="flex justify-between items-center text-emerald-400">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Efficiency Rebate</span>
                                            <span className="font-black italic tracking-tight">-${parseFloat(order.discount_amount).toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="pt-6 border-t border-white/5 flex justify-between items-end">
                                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em]">Total Ledger</span>
                                        <span className="text-4xl font-black text-white italic tracking-tighter">${parseFloat(order.total_amount).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {order.delivery_address && (
                                <div className="space-y-3 pt-6 border-t border-white/5">
                                    <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                        <MapPin size={12} className="text-emerald-500" /> Dispatch Endpoint
                                    </div>
                                    <p className="text-slate-400 text-xs leading-relaxed font-bold uppercase tracking-tight italic">{order.delivery_address}</p>
                                </div>
                            )}

                            {order.notes && (
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                                    <div className="flex items-center gap-2 text-slate-600 text-[9px] font-black uppercase tracking-widest">
                                        <FileText size={10} /> Internal Memo
                                    </div>
                                    <p className="text-slate-400 text-[10px] font-medium leading-relaxed italic line-clamp-3">{order.notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-8 bg-blue-600 hover:bg-emerald-600 rounded-[2.5rem] text-center transition-all cursor-pointer group shadow-xl">
                            <p className="text-white font-black uppercase tracking-[0.4em] text-[10px] flex items-center justify-center gap-2">
                                Download Artifact <FileText size={14} className="group-hover:rotate-12 transition-transform" />
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SummaryCard({ label, value, meta, icon, color = 'text-white' }: any) {
    return (
        <div className="p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] space-y-4 hover:bg-slate-900/60 transition-all group">
            <div className="flex justify-between items-start">
                <div className="p-3 bg-white/5 rounded-2xl scale-90 group-hover:scale-100 transition-all text-slate-500 group-hover:text-emerald-500">{icon}</div>
                <div className="text-[10px] text-slate-600 font-black uppercase tracking-widest">{label}</div>
            </div>
            <div>
                <h4 className={`text-xl font-black italic tracking-tight ${color}`}>{value}</h4>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">{meta}</p>
            </div>
        </div>
    )
}
