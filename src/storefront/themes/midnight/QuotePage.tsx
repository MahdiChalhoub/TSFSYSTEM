'use client'

import { useState } from 'react'
import { useAuth } from '../../engine/hooks/useAuth'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
import { useCart } from '../../engine/hooks/useCart'
import Link from 'next/link'
import {
    ArrowLeft, FileQuestion, Plus, Loader2, Send, X, AlertCircle,
    CheckCircle2, Trash2, Package, ChevronRight, Zap
} from 'lucide-react'

interface QuoteLineItem { product_name: string; quantity: number; notes: string }

export default function MidnightQuotePage() {
    const { path, slug } = useStorefrontPath()
    const { isAuthenticated, user } = useAuth()
    const { cart } = useCart()

    const [lineItems, setLineItems] = useState<QuoteLineItem[]>(
        cart.length > 0
            ? cart.map(item => ({ product_name: item.product_name, quantity: item.quantity, notes: '' }))
            : [{ product_name: '', quantity: 1, notes: '' }]
    )
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    const addLine = () => setLineItems([...lineItems, { product_name: '', quantity: 1, notes: '' }])
    const removeLine = (idx: number) => setLineItems(lineItems.filter((_, i) => i !== idx))
    const updateLine = (idx: number, field: keyof QuoteLineItem, value: any) => {
        const updated = [...lineItems]
        updated[idx] = { ...updated[idx], [field]: value }
        setLineItems(updated)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true); setError('')
        const validLines = lineItems.filter(l => l.product_name.trim())
        if (validLines.length === 0) { setError('Please add at least one product.'); setSubmitting(false); return }
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        const token = localStorage.getItem('portal_token')
        try {
            const res = await fetch(`${djangoUrl}/api/client-portal/quote-request/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}`, 'X-Tenant-Id': slug },
                body: JSON.stringify({ items: validLines, message }),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed') }
            setSuccess(true)
        } catch (err: any) { setError(err.message) } finally { setSubmitting(false) }
    }

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
                <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-app-success/5 blur-[150px] rounded-full pointer-events-none" />
                <div className="max-w-md w-full text-center space-y-10 relative z-10">
                    <div className="w-24 h-24 bg-app-success/10 border border-app-success/20 rounded-[2rem] flex items-center justify-center mx-auto text-emerald-400 shadow-2xl shadow-emerald-500/20 rotate-12">
                        <CheckCircle2 size={48} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black text-white italic tracking-tighter">Quote <span className="text-app-success">Submitted</span></h1>
                        <p className="text-app-muted-foreground text-sm leading-relaxed">Our team will review your request and respond shortly.</p>
                    </div>
                    <Link href={path('/')}
                        className="inline-flex items-center gap-3 px-10 py-5 bg-app-success text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-app-success shadow-xl shadow-emerald-900/30 transition-all">
                        Return to Storefront <ChevronRight size={16} />
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-app-info/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-10">
                <div className="space-y-4">
                    <Link href={path('/')} className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Storefront
                    </Link>
                    <h1 className="text-5xl font-black text-white italic tracking-tighter">Request a <span className="text-blue-400">Quote</span></h1>
                    <p className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest">Build your quote request below</p>
                </div>

                {error && <div className="p-4 bg-app-error/10 border border-app-error/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-3"><AlertCircle size={16} />{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 text-white/5"><Zap size={120} /></div>
                        <div className="flex justify-between items-center relative z-10">
                            <h2 className="text-lg font-black text-white italic flex items-center gap-3"><Package size={20} className="text-blue-400" /> Line Items</h2>
                            <button type="button" onClick={addLine} className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                                <Plus size={14} /> Add Line
                            </button>
                        </div>
                        <div className="space-y-4 relative z-10">
                            {lineItems.map((line, i) => (
                                <div key={i} className="flex gap-3 items-start">
                                    <div className="flex-1 space-y-3">
                                        <input type="text" placeholder="Product name or description" value={line.product_name} onChange={e => updateLine(i, 'product_name', e.target.value)}
                                            className="w-full bg-slate-950/60 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-app-info transition-all placeholder:text-app-foreground font-medium" />
                                        <div className="flex gap-3">
                                            <input type="number" min={1} value={line.quantity} onChange={e => updateLine(i, 'quantity', parseInt(e.target.value) || 1)}
                                                className="w-32 bg-slate-950/60 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-app-info transition-all font-medium" />
                                            <input type="text" placeholder="Notes (optional)" value={line.notes} onChange={e => updateLine(i, 'notes', e.target.value)}
                                                className="flex-1 bg-slate-950/60 border border-white/5 p-4 rounded-2xl text-white outline-none focus:border-app-info transition-all placeholder:text-app-foreground font-medium" />
                                        </div>
                                    </div>
                                    {lineItems.length > 1 && (
                                        <button type="button" onClick={() => removeLine(i)} className="p-4 text-app-muted-foreground hover:text-rose-400 transition-colors"><Trash2 size={18} /></button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-6">
                        <h2 className="text-lg font-black text-white italic flex items-center gap-3"><FileQuestion size={20} className="text-blue-400" /> Additional Info</h2>
                        <textarea placeholder="Any additional requirements or notes..." value={message} onChange={e => setMessage(e.target.value)} rows={4}
                            className="w-full bg-slate-950/60 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-app-info transition-all placeholder:text-app-foreground resize-none font-medium" />
                    </div>

                    <button type="submit" disabled={submitting}
                        className="w-full bg-app-info hover:bg-app-info text-white p-5 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-xl shadow-blue-900/30">
                        {submitting ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Submit Quote Request</>}
                    </button>
                </form>
            </div>
        </div>
    )
}
