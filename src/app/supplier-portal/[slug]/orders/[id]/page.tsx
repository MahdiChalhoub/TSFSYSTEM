'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Truck, Package, Clock, FileText } from 'lucide-react'

interface OrderLine {
    id: string
    product_name: string
    description: string
    quantity: string
    unit_price: string
    line_total: string
}

interface PurchaseOrder {
    id: string
    po_number: string
    status: string
    order_date: string
    expected_date: string | null
    total_amount: string
    currency: string
    notes: string
    lines: OrderLine[]
    created_at: string
    tracking_number: string | null
    tracking_url: string | null
    acknowledged_at: string | null
    dispatched_at: string | null
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Draft', color: 'text-slate-400', bg: 'bg-slate-500/10' },
    SUBMITTED: { label: 'Pending Approval', color: 'text-slate-400', bg: 'bg-slate-500/10' },
    APPROVED: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ORDERED: { label: 'Requires Acknowledgment', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    CONFIRMED: { label: 'Preparing for Dispatch', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    IN_TRANSIT: { label: 'In Transit', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    RECEIVED: { label: 'Received', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    CANCELLED: { label: 'Cancelled', color: 'text-red-400', bg: 'bg-red-500/10' },
}

function getToken(slug: string): string | null {
    if (typeof window === 'undefined') return null
    try {
        const s = JSON.parse(localStorage.getItem('supplier_session') || 'null')
        return s?.organization?.slug === slug ? s.token : null
    } catch { return null }
}

export default function SupplierOrderDetail() {
    const { slug, id } = useParams<{ slug: string; id: string }>()
    const router = useRouter()
    const [order, setOrder] = useState<PurchaseOrder | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState(false)
    const [trackingNo, setTrackingNo] = useState('')
    const [trackingUrl, setTrackingUrl] = useState('')

    useEffect(() => {
        const token = getToken(slug)
        if (!token) return

        const fetchOrder = async () => {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
            try {
                const res = await fetch(`${djangoUrl}/api/supplier-portal/my-orders/${id}/`, {
                    headers: { 'Authorization': `Token ${token}` },
                })
                if (res.ok) {
                    setOrder(await res.json())
                }
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchOrder()
    }, [slug, id])

    const handleAction = async (endpoint: string, payload: any = {}) => {
        const token = getToken(slug)
        if (!token) return
        setActionLoading(true)
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        try {
            const res = await fetch(`${djangoUrl}/api/supplier-portal/my-orders/${id}/${endpoint}/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            })
            if (res.ok) {
                // Refresh order
                const freshRes = await fetch(`${djangoUrl}/api/supplier-portal/my-orders/${id}/`, {
                    headers: { 'Authorization': `Token ${token}` },
                })
                if (freshRes.ok) setOrder(await freshRes.json())
            }
        } catch (err) {
            console.error(err)
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-[#020617] p-4 lg:p-12 text-center flex flex-col items-center justify-center">
                <FileText size={48} className="text-slate-600 mb-4" />
                <h1 className="text-2xl font-black text-white mb-2">Order Not Found</h1>
                <Link href={`/supplier-portal/${slug}/orders`} className="text-emerald-400 hover:underline">Return to Orders</Link>
            </div>
        )
    }

    const st = STATUS_MAP[order.status] || STATUS_MAP.DRAFT

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="space-y-4">
                    <Link href={`/supplier-portal/${slug}/orders`}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Back to Orders
                    </Link>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{order.po_number}</h1>
                            <p className="text-slate-400 mt-1">Issued on {new Date(order.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl flex items-center gap-2 ${st.bg} border border-white/5`}>
                            <div className={`w-2 h-2 rounded-full ${st.color.replace('text-', 'bg-')}`} />
                            <span className={`text-sm font-bold tracking-widest uppercase ${st.color}`}>{st.label}</span>
                        </div>
                    </div>
                </div>

                {/* Actions Panel */}
                {(order.status === 'ORDERED' || order.status === 'CONFIRMED') && (
                    <div className="bg-slate-900/80 border border-white/5 rounded-3xl p-6 lg:p-8 backdrop-blur-xl">
                        <h2 className="text-xl font-black text-white mb-4">Action Required</h2>

                        {order.status === 'ORDERED' && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                <p className="text-slate-400 flex-1">
                                    The buyer has issued this Purchase Order. Please review the line items carefully.
                                    Acknowledging this order confirms you can fulfill it.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            if (confirm('Are you sure you want to acknowledge this order? This confirms your ability to fulfill the request.')) {
                                                handleAction('acknowledge')
                                            }
                                        }}
                                        disabled={actionLoading}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-2 transition-all">
                                        <CheckCircle2 size={18} />
                                        {actionLoading ? 'Processing...' : 'Acknowledge Order'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {order.status === 'CONFIRMED' && (
                            <div className="flex flex-col gap-6">
                                <p className="text-slate-400">
                                    This order has been acknowledged and is awaiting dispatch. Submit tracking details once the goods have been shipped.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tracking Number</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. DHL-12345678"
                                            value={trackingNo}
                                            onChange={e => setTrackingNo(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tracking URL (Optional)</label>
                                        <input
                                            type="url"
                                            placeholder="https://carrier.com/track/..."
                                            value={trackingUrl}
                                            onChange={e => setTrackingUrl(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500/50"
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleAction('dispatch_order', { tracking_number: trackingNo, tracking_url: trackingUrl })}
                                    disabled={actionLoading || !trackingNo}
                                    className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all hover:shadow-2xl hover:shadow-emerald-900/40">
                                    <Truck size={22} />
                                    {actionLoading ? 'Processing...' : 'Confirm Dispatch'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Line Items */}
                <div className="bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl">
                    <div className="p-6 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <Package size={18} className="text-emerald-400" />
                            Requested Items
                        </h3>
                        {order.expected_date && (
                            <span className="text-sm text-slate-400 flex items-center gap-1.5">
                                <Clock size={14} /> ETA: {new Date(order.expected_date).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                    <th className="p-4 pl-6">Product</th>
                                    <th className="p-4">Qty</th>
                                    <th className="p-4">Unit Price</th>
                                    <th className="p-4 pr-6 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {order.lines?.map(line => (
                                    <tr key={line.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 pl-6">
                                            <p className="text-white font-medium">{line.product_name}</p>
                                            {line.description && <p className="text-slate-500 text-xs mt-1">{line.description}</p>}
                                        </td>
                                        <td className="p-4 text-slate-300 font-mono text-sm">{parseFloat(line.quantity)}</td>
                                        <td className="p-4 text-slate-300 font-mono text-sm">${parseFloat(line.unit_price).toFixed(2)}</td>
                                        <td className="p-4 pr-6 text-right text-white font-bold font-mono text-sm">${parseFloat(line.line_total).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t border-white/10 bg-white/5">
                                <tr>
                                    <td colSpan={3} className="p-4 pl-6 text-right text-slate-400 text-sm font-medium">Grand Total</td>
                                    <td className="p-4 pr-6 text-right text-emerald-400 font-black text-xl font-mono">
                                        ${parseFloat(order.total_amount).toFixed(2)} <span className="text-[10px] text-emerald-600 ml-1">{order.currency}</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Deployment Integrity Notes */}
                {(order.tracking_number || order.notes) && (
                    <div className="bg-slate-900/60 border border-white/5 rounded-3xl p-6 backdrop-blur-xl space-y-4">
                        {order.tracking_number && (
                            <div>
                                <h3 className="text-white font-bold mb-2 text-sm flex items-center gap-2">
                                    <Truck size={16} className="text-emerald-500" /> Dispatch Info
                                </h3>
                                <div className="bg-white/5 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/5">
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tracking Number</p>
                                        <p className="text-white font-mono text-lg">{order.tracking_number}</p>
                                    </div>
                                    {order.tracking_url && (
                                        <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
                                            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-sm font-bold transition-colors border border-emerald-500/20">
                                            Track Package
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                        {order.notes && (
                            <div>
                                <h3 className="text-white font-bold mb-2 text-sm flex items-center gap-2">
                                    <FileText size={16} className="text-slate-500" /> Internal Notes
                                </h3>
                                <p className="text-slate-400 text-sm whitespace-pre-wrap">{order.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
