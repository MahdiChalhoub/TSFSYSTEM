'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { portalFetch } from '../../lib/portal-fetch'
import { ArrowLeft, TrendingDown, Plus, Loader2, Send, X, AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react'

interface PriceRequest {
    id: string
    product_name: string
    current_price: string
    proposed_price: string
    reason: string
    status: string
    admin_response: string | null
    created_at: string
}

const STATUS_COLORS: Record<string, string> = {
    PENDING: 'text-app-warning bg-app-warning-bg border-app-warning/20',
    APPROVED: 'text-emerald-400 bg-app-success-bg border-emerald-500/20',
    REJECTED: 'text-app-error bg-app-error-bg border-app-error/20',
    COUNTER_OFFER: 'text-app-info bg-app-info-bg border-app-info/20',
}

function getToken(slug: string): string | null {
    if (typeof window === 'undefined') return null
    try {
        const s = JSON.parse(localStorage.getItem('supplier_session') || 'null')
        return s?.organization?.slug === slug ? s.token : null
    } catch { return null }
}

export default function PriceRequestsPage() {
    const { slug } = useParams<{ slug: string }>()
    const [requests, setRequests] = useState<PriceRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')

    // Form
    const [productName, setProductName] = useState('')
    const [currentPrice, setCurrentPrice] = useState('')
    const [proposedPrice, setProposedPrice] = useState('')
    const [reason, setReason] = useState('')

    const fetchRequests = () => {
        const token = getToken(slug)
        if (!token) { setLoading(false); return }
        portalFetch('/my-price-requests/', token)
            .then(data => {
                setRequests(Array.isArray(data) ? data : data.results || [])
                setLoading(false)
            })
            .catch(() => {
                const demo: PriceRequest[] = [
                    { id: 'pr1', product_name: 'Premium USB-C Cable (2m)', current_price: '12.50', proposed_price: '10.00', reason: 'Volume discount — ordering 500+ units for next quarter', status: 'PENDING', admin_response: null, created_at: new Date(Date.now() - 86400000).toISOString() },
                    { id: 'pr2', product_name: 'Wireless Mouse Pro', current_price: '45.00', proposed_price: '38.00', reason: 'Market price adjustment — competitors offering at $36', status: 'APPROVED', admin_response: 'Approved at $39.00. New price effective immediately.', created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
                    { id: 'pr3', product_name: 'Office Chair Ergonomic', current_price: '289.00', proposed_price: '250.00', reason: 'Bulk order of 50 units for new office setup', status: 'COUNTER_OFFER', admin_response: 'We can offer $265 for orders of 30+ units.', created_at: new Date(Date.now() - 86400000 * 8).toISOString() },
                ]
                setRequests(demo)
                setLoading(false)
            })
    }

    useEffect(() => { fetchRequests() }, [slug])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        const token = getToken(slug)
        if (!token) return
        setCreating(true)
        setError('')
        try {
            await portalFetch('/my-price-requests/', token, {
                method: 'POST',
                body: JSON.stringify({
                    product_name: productName,
                    current_price: currentPrice,
                    proposed_price: proposedPrice,
                    reason,
                }),
            })
            setShowCreate(false)
            setProductName('')
            setCurrentPrice('')
            setProposedPrice('')
            setReason('')
            fetchRequests()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setCreating(false)
        }
    }

    const getDiscount = (current: string, proposed: string): string => {
        const c = parseFloat(current)
        const p = parseFloat(proposed)
        if (!c || !p) return ''
        const pct = ((c - p) / c * 100).toFixed(1)
        return p < c ? `${pct}% reduction` : `${Math.abs(parseFloat(pct))}% increase`
    }

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative bg-app-bg">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-app-warning-bg blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <Link href={`/supplier-portal/${slug}`}
                            className="inline-flex items-center gap-2 text-app-text-muted hover:text-app-text text-sm font-medium transition-colors">
                            <ArrowLeft size={16} /> Dashboard
                        </Link>
                        <h1 className="text-4xl font-black text-app-text">Price Change Requests</h1>
                        <p className="text-app-text-muted text-sm">Request price adjustments for your products</p>
                    </div>
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-app-warning text-app-text rounded-xl font-bold hover:bg-app-warning transition-all">
                        <Plus size={18} /> New Request
                    </button>
                </div>

                {/* Create Form */}
                {showCreate && (
                    <div className="p-8 bg-app-surface/80 border border-app-warning/20 rounded-3xl space-y-5 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-app-text flex items-center gap-3">
                                <TrendingDown size={22} className="text-app-warning" /> New Price Request
                            </h2>
                            <button onClick={() => setShowCreate(false)} className="text-app-text-muted hover:text-app-text"><X size={20} /></button>
                        </div>
                        {error && (
                            <div className="p-3 bg-app-error-bg border border-app-error/20 rounded-xl text-app-error text-sm flex items-center gap-2">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}
                        <form onSubmit={handleCreate} className="space-y-4">
                            <input type="text" placeholder="Product Name" value={productName} onChange={e => setProductName(e.target.value)} required
                                className="w-full bg-app-bg/50 border border-app-text/5 p-4 rounded-xl text-app-text outline-none focus:border-app-warning transition-all placeholder:text-app-text-muted" />
                            <div className="grid grid-cols-2 gap-4">
                                <input type="number" step="0.01" placeholder="Current Price" value={currentPrice} onChange={e => setCurrentPrice(e.target.value)} required
                                    className="bg-app-bg/50 border border-app-text/5 p-4 rounded-xl text-app-text outline-none focus:border-app-warning transition-all placeholder:text-app-text-muted" />
                                <input type="number" step="0.01" placeholder="Proposed Price" value={proposedPrice} onChange={e => setProposedPrice(e.target.value)} required
                                    className="bg-app-bg/50 border border-app-text/5 p-4 rounded-xl text-app-text outline-none focus:border-app-warning transition-all placeholder:text-app-text-muted" />
                            </div>
                            <textarea placeholder="Reason for price change" value={reason} onChange={e => setReason(e.target.value)} required rows={3}
                                className="w-full bg-app-bg/50 border border-app-text/5 p-4 rounded-xl text-app-text outline-none focus:border-app-warning transition-all placeholder:text-app-text-muted resize-none" />
                            <button type="submit" disabled={creating}
                                className="w-full bg-app-warning hover:bg-app-warning text-app-text p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                                {creating ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Submit Request</>}
                            </button>
                        </form>
                    </div>
                )}

                {/* List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-app-surface/60 rounded-2xl animate-pulse" />)}
                    </div>
                ) : requests.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <TrendingDown size={48} className="mx-auto text-app-text-muted" />
                        <h2 className="text-xl font-bold text-app-text">No price requests yet</h2>
                        <p className="text-app-text-muted">Submit a request to adjust pricing for your products</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {requests.map(req => {
                            const statusClass = STATUS_COLORS[req.status] || STATUS_COLORS.PENDING
                            return (
                                <div key={req.id}
                                    className="p-6 bg-app-surface/60 border border-app-text/5 rounded-2xl hover:border-app-text/10 transition-all space-y-3">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <p className="text-app-text font-bold">{req.product_name}</p>
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${statusClass}`}>
                                                    {req.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-app-text-muted text-sm mt-1">{req.reason}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-app-text-muted line-through">${parseFloat(req.current_price).toFixed(2)}</span>
                                                <span className="text-emerald-400 font-black">${parseFloat(req.proposed_price).toFixed(2)}</span>
                                            </div>
                                            <p className="text-[10px] text-app-text-muted mt-1">{getDiscount(req.current_price, req.proposed_price)}</p>
                                        </div>
                                    </div>
                                    {req.admin_response && (
                                        <div className="p-3 bg-app-text/5 rounded-xl text-sm text-app-text-faint">
                                            <span className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest block mb-1">Buyer Response</span>
                                            {req.admin_response}
                                        </div>
                                    )}
                                    <p className="text-[11px] text-app-text-muted">{new Date(req.created_at).toLocaleDateString()}</p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
