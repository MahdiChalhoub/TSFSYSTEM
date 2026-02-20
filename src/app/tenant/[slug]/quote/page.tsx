'use client'

import { useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, FileQuestion, Plus, Loader2, Send, X, AlertCircle,
    CheckCircle2, Trash2, Package, DollarSign
} from 'lucide-react'

interface QuoteLineItem {
    product_name: string
    quantity: number
    notes: string
}

export default function QuotePage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, token, user, contact, cart, removeFromCart, clearCart } = usePortal()
    const [items, setItems] = useState<QuoteLineItem[]>([])
    const [contactName, setContactName] = useState(contact?.name || '')
    const [email, setEmail] = useState(user?.email || '')
    const [phone, setPhone] = useState('')
    const [company, setCompany] = useState(contact?.company || '')
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    // Add a blank row
    const addItem = () => setItems([...items, { product_name: '', quantity: 1, notes: '' }])
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))
    const updateItem = (idx: number, field: keyof QuoteLineItem, value: string | number) => {
        setItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
    }

    // Import cart items as quote lines
    const importFromCart = () => {
        const cartItems: QuoteLineItem[] = cart.map(c => ({
            product_name: c.product_name,
            quantity: c.quantity,
            notes: '',
        }))
        setItems([...items, ...cartItems])
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (items.length === 0) { setError('Add at least one item to your quote request'); return }
        setSubmitting(true)
        setError('')

        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Token ${token}`

        try {
            const res = await fetch(`${djangoUrl}/api/client-portal/quote-request/`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    slug,
                    contact_name: contactName,
                    email,
                    phone,
                    company,
                    message,
                    items,
                }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to submit quote request')
            }
            setSubmitted(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    // ─── Success ─────────────────────────────────────────────────────────

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6 animate-in fade-in duration-500">
                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                        <CheckCircle2 size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-white">Quote Request Sent!</h1>
                    <p className="text-slate-500">We&#39;ll review your request and get back to you with a detailed quotation.</p>
                    <div className="flex items-center justify-center gap-4">
                        <Link href={`/tenant/${slug}`}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition-all">
                            Back to Store
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    // ─── Form ────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-3xl mx-auto relative z-10 space-y-8">
                <div className="space-y-2">
                    <Link href={`/tenant/${slug}`}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Back to Store
                    </Link>
                    <h1 className="text-4xl font-black text-white flex items-center gap-3">
                        <FileQuestion className="text-teal-400" /> Request a Quote
                    </h1>
                    <p className="text-slate-500 text-sm">Tell us what you need and we&#39;ll prepare a detailed quotation for you</p>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3">
                        <AlertCircle size={18} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Contact Info */}
                    <div className="p-8 bg-slate-900/60 border border-white/5 rounded-3xl space-y-5">
                        <h2 className="text-lg font-bold text-white">Contact Information</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input type="text" placeholder="Full Name *" value={contactName} onChange={e => setContactName(e.target.value)} required
                                className="bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-teal-500 transition-all placeholder:text-slate-700" />
                            <input type="email" placeholder="Email *" value={email} onChange={e => setEmail(e.target.value)} required
                                className="bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-teal-500 transition-all placeholder:text-slate-700" />
                            <input type="tel" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)}
                                className="bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-teal-500 transition-all placeholder:text-slate-700" />
                            <input type="text" placeholder="Company" value={company} onChange={e => setCompany(e.target.value)}
                                className="bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-teal-500 transition-all placeholder:text-slate-700" />
                        </div>
                    </div>

                    {/* Line Items */}
                    <div className="p-8 bg-slate-900/60 border border-white/5 rounded-3xl space-y-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-white">Products / Services Needed</h2>
                            <div className="flex gap-2">
                                {cart.length > 0 && (
                                    <button type="button" onClick={importFromCart}
                                        className="text-sm px-4 py-2 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-xl font-medium hover:bg-teal-500/20 transition-all">
                                        Import from Cart ({cart.length})
                                    </button>
                                )}
                                <button type="button" onClick={addItem}
                                    className="text-sm px-4 py-2 bg-white/5 text-white border border-white/10 rounded-xl font-medium hover:bg-white/10 transition-all flex items-center gap-2">
                                    <Plus size={14} /> Add Item
                                </button>
                            </div>
                        </div>

                        {items.length === 0 ? (
                            <div className="py-10 text-center space-y-3 border border-dashed border-white/10 rounded-2xl">
                                <Package size={32} className="mx-auto text-slate-600" />
                                <p className="text-slate-500 text-sm">No items yet — click &quot;Add Item&quot; or import from your cart</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {items.map((item, idx) => (
                                    <div key={idx} className="flex gap-3 items-start p-4 bg-slate-950/50 border border-white/5 rounded-xl">
                                        <div className="flex-1 space-y-3">
                                            <input type="text" placeholder="Product / Service name *" value={item.product_name}
                                                onChange={e => updateItem(idx, 'product_name', e.target.value)} required
                                                className="w-full bg-transparent border-b border-white/10 pb-2 text-white outline-none focus:border-teal-500 transition-all placeholder:text-slate-700" />
                                            <div className="flex gap-3">
                                                <div className="w-28">
                                                    <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Qty</label>
                                                    <input type="number" min="1" value={item.quantity}
                                                        onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                                        className="w-full bg-transparent border border-white/10 p-2 rounded-lg text-white text-center outline-none focus:border-teal-500" />
                                                </div>
                                                <div className="flex-1">
                                                    <label className="text-[10px] text-slate-600 uppercase tracking-wider block mb-1">Notes</label>
                                                    <input type="text" placeholder="Specs, size, color..." value={item.notes}
                                                        onChange={e => updateItem(idx, 'notes', e.target.value)}
                                                        className="w-full bg-transparent border border-white/10 p-2 rounded-lg text-white outline-none focus:border-teal-500 placeholder:text-slate-700" />
                                                </div>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => removeItem(idx)}
                                            className="p-2 text-slate-600 hover:text-red-400 transition-colors mt-1">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Message */}
                    <div className="p-8 bg-slate-900/60 border border-white/5 rounded-3xl space-y-4">
                        <h2 className="text-lg font-bold text-white">Additional Message</h2>
                        <textarea placeholder="Delivery timeline, budget range, special requirements..." value={message}
                            onChange={e => setMessage(e.target.value)} rows={4}
                            className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-teal-500 transition-all placeholder:text-slate-700 resize-none" />
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={submitting}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-teal-900/40 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-60 text-lg">
                        {submitting ? <Loader2 className="animate-spin" size={22} /> : <><Send size={22} /> Submit Quote Request</>}
                    </button>
                </form>
            </div>
        </div>
    )
}
