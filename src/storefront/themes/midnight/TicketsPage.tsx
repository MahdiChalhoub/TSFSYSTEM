'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '../../engine/hooks/useAuth'
import {
    ArrowLeft, MessageSquare, Plus, AlertCircle, CheckCircle2,
    Clock, Loader2, Send, Star, X, Shield, ChevronRight, Zap
} from 'lucide-react'

interface Ticket {
    id: string; ticket_number: string; ticket_type: string; status: string; priority: string; subject: string; description: string; satisfaction_rating: number | null; created_at: string
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

export default function MidnightTicketsPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated } = useAuth()
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')
    const [type, setType] = useState('GENERAL')
    const [subject, setSubject] = useState('')
    const [description, setDescription] = useState('')

    const fetchTickets = () => {
        const token = localStorage.getItem('portal_token')
        if (!token) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        fetch(`${djangoUrl}/api/client-portal/my-tickets/`, { headers: { 'Authorization': `Token ${token}` } })
            .then(r => r.json())
            .then(data => { setTickets(Array.isArray(data) ? data : data.results || []); setLoading(false) })
            .catch(() => {
                setTickets([
                    { id: 't1', ticket_number: 'TK-2025-001', ticket_type: 'ORDER_ISSUE', status: 'OPEN', priority: 'HIGH', subject: 'Missing item in delivery', description: 'My order was missing 1 item.', satisfaction_rating: null, created_at: new Date(Date.now() - 86400000).toISOString() },
                    { id: 't2', ticket_number: 'TK-2025-002', ticket_type: 'GENERAL', status: 'RESOLVED', priority: 'LOW', subject: 'Great product quality!', description: 'Product exceeded expectations.', satisfaction_rating: 5, created_at: new Date(Date.now() - 604800000).toISOString() },
                ])
                setLoading(false)
            })
    }

    useEffect(() => { if (isAuthenticated) fetchTickets() }, [isAuthenticated])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault(); setCreating(true); setError('')
        const token = localStorage.getItem('portal_token')
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        try {
            const res = await fetch(`${djangoUrl}/api/client-portal/my-tickets/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify({ ticket_type: type, subject, description }),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed') }
            setShowCreate(false); setSubject(''); setDescription(''); fetchTickets()
        } catch (err: any) { setError(err.message) } finally { setCreating(false) }
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center space-y-8">
                    <div className="w-24 h-24 bg-purple-500/10 border border-purple-500/20 rounded-[2rem] flex items-center justify-center mx-auto text-purple-400 rotate-12"><Shield size={48} /></div>
                    <h1 className="text-3xl font-black text-white italic">Session Required</h1>
                    <Link href={`/tenant/${slug}/login`} className="inline-block px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Authorize</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-10">
                <div className="flex items-start justify-between flex-wrap gap-6">
                    <div className="space-y-4">
                        <Link href={`/tenant/${slug}/account`} className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
                        </Link>
                        <h1 className="text-5xl font-black text-white italic tracking-tighter">Support <span className="text-purple-400">Node</span></h1>
                    </div>
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-3 px-8 py-4 bg-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-purple-500 transition-all shadow-xl shadow-purple-900/30">
                        <Plus size={16} /> New Thread
                    </button>
                </div>

                {/* Create Modal */}
                {showCreate && (
                    <div className="p-10 bg-slate-900/60 border border-purple-500/20 rounded-[3rem] space-y-8 animate-in fade-in duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 text-purple-500/5"><Zap size={120} /></div>
                        <div className="flex justify-between items-center relative z-10">
                            <h2 className="text-xl font-black text-white italic flex items-center gap-3"><MessageSquare size={22} className="text-purple-400" /> Initialize Thread</h2>
                            <button onClick={() => setShowCreate(false)} className="text-slate-500 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all"><X size={20} /></button>
                        </div>
                        {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-3"><AlertCircle size={16} />{error}</div>}
                        <form onSubmit={handleCreate} className="space-y-5 relative z-10">
                            <select value={type} onChange={e => setType(e.target.value)}
                                className="w-full bg-slate-950/60 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-purple-500 transition-all font-medium">
                                {TICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <input type="text" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required
                                className="w-full bg-slate-950/60 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-slate-800 font-medium" />
                            <textarea placeholder="Describe your issue..." value={description} onChange={e => setDescription(e.target.value)} required rows={4}
                                className="w-full bg-slate-950/60 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-slate-800 resize-none font-medium" />
                            <button type="submit" disabled={creating}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white p-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-xl shadow-purple-900/30">
                                {creating ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Submit Thread</>}
                            </button>
                        </form>
                    </div>
                )}

                {/* Tickets List */}
                {loading ? (
                    <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-900/40 rounded-[2.5rem] animate-pulse" />)}</div>
                ) : tickets.length === 0 ? (
                    <div className="py-24 text-center space-y-8 bg-slate-900/20 border border-white/5 rounded-[3.5rem]">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto text-slate-700"><MessageSquare size={48} /></div>
                        <h2 className="text-2xl font-black text-white italic">No Active Threads</h2>
                        <p className="text-slate-500 text-sm">Create a support thread above if you need assistance.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {tickets.map(ticket => {
                            const statusClass = STATUS_COLORS[ticket.status] || STATUS_COLORS.OPEN
                            return (
                                <div key={ticket.id} className="p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] hover:border-purple-500/20 transition-all group">
                                    <div className="flex items-start justify-between gap-6">
                                        <div className="flex-1 min-w-0 space-y-3">
                                            <div className="flex items-center gap-4 flex-wrap">
                                                <p className="text-xl font-black text-white italic tracking-tight group-hover:text-purple-400 transition-colors">{ticket.subject}</p>
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${statusClass}`}>
                                                    {ticket.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-slate-500 text-sm line-clamp-2">{ticket.description}</p>
                                            <div className="flex items-center gap-6 text-[10px] text-slate-600 font-black uppercase tracking-widest">
                                                <span>{ticket.ticket_number}</span>
                                                <span>{TICKET_TYPES.find(t => t.value === ticket.ticket_type)?.label}</span>
                                                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {ticket.satisfaction_rating && (
                                            <div className="flex items-center gap-1 text-amber-400 text-sm shrink-0">
                                                <Star size={14} fill="currentColor" /> {ticket.satisfaction_rating}.0
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
