'use client'

import { useEffect, useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, MessageSquare, Plus, AlertCircle, CheckCircle2,
    Clock, Loader2, Send, ChevronDown, Star, X
} from 'lucide-react'

interface Ticket {
    id: string
    ticket_number: string
    ticket_type: string
    status: string
    priority: string
    subject: string
    description: string
    satisfaction_rating: number | null
    created_at: string
}

const STATUS_COLORS: Record<string, string> = {
    OPEN: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    IN_PROGRESS: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    WAITING_CLIENT: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    RESOLVED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    CLOSED: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

const TICKET_TYPES = [
    { value: 'GENERAL', label: 'General Inquiry' },
    { value: 'ORDER_ISSUE', label: 'Order Issue' },
    { value: 'DELIVERY_PROBLEM', label: 'Delivery Problem' },
    { value: 'RETURN_REQUEST', label: 'Return Request' },
    { value: 'PRODUCT_FEEDBACK', label: 'Product Feedback' },
    { value: 'COMPLAINT', label: 'Complaint' },
    { value: 'SUGGESTION', label: 'Suggestion' },
]

export default function TicketsPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, token } = usePortal()
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')

    // Create form
    const [type, setType] = useState('GENERAL')
    const [subject, setSubject] = useState('')
    const [description, setDescription] = useState('')

    const fetchTickets = () => {
        if (!token) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/client-portal/my-tickets/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                setTickets(Array.isArray(data) ? data : data.results || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }

    useEffect(() => { if (isAuthenticated) fetchTickets() }, [isAuthenticated, token])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setCreating(true)
        setError('')
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        try {
            const res = await fetch(`${djangoUrl}/api/client-portal/my-tickets/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`,
                },
                body: JSON.stringify({ ticket_type: type, subject, description }),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to create ticket')
            }
            setShowCreate(false)
            setSubject('')
            setDescription('')
            fetchTickets()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setCreating(false)
        }
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">Please log in</h1>
                    <Link href={`/tenant/${slug}`} className="text-emerald-400 font-bold">Go to Store</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <Link href={`/tenant/${slug}/account`}
                            className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                            <ArrowLeft size={16} /> My Account
                        </Link>
                        <h1 className="text-4xl font-black text-white">Support Tickets</h1>
                    </div>
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-500 transition-all">
                        <Plus size={18} /> New Ticket
                    </button>
                </div>

                {/* Create Modal */}
                {showCreate && (
                    <div className="p-8 bg-slate-900/80 border border-purple-500/20 rounded-3xl space-y-5 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <MessageSquare size={22} className="text-purple-400" /> New Ticket
                            </h2>
                            <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}
                        <form onSubmit={handleCreate} className="space-y-4">
                            <select value={type} onChange={e => setType(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-purple-500 transition-all">
                                {TICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <input type="text" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required
                                className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-slate-700" />
                            <textarea placeholder="Describe your issue..." value={description} onChange={e => setDescription(e.target.value)} required rows={4}
                                className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-slate-700 resize-none" />
                            <button type="submit" disabled={creating}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                                {creating ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Submit Ticket</>}
                            </button>
                        </form>
                    </div>
                )}

                {/* Tickets List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-900/60 rounded-xl animate-pulse" />)}
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <MessageSquare size={48} className="mx-auto text-slate-600" />
                        <h2 className="text-xl font-bold text-white">No tickets yet</h2>
                        <p className="text-slate-500">Need help? Create a support ticket above</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tickets.map(ticket => {
                            const statusClass = STATUS_COLORS[ticket.status] || STATUS_COLORS.OPEN
                            return (
                                <div key={ticket.id}
                                    className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <p className="text-white font-bold">{ticket.subject}</p>
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${statusClass}`}>
                                                    {ticket.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-sm mt-2 line-clamp-2">{ticket.description}</p>
                                            <div className="flex items-center gap-4 mt-3 text-[11px] text-slate-600">
                                                <span>{ticket.ticket_number}</span>
                                                <span>{TICKET_TYPES.find(t => t.value === ticket.ticket_type)?.label}</span>
                                                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {ticket.satisfaction_rating && (
                                            <div className="flex items-center gap-1 text-amber-400 text-sm shrink-0">
                                                <Star size={14} /> {ticket.satisfaction_rating}/5
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
