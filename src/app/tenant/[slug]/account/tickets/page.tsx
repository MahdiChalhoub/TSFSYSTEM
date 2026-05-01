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
    OPEN: 'text-app-info bg-app-info/10 border-app-info/20',
    IN_PROGRESS: 'text-app-warning bg-app-warning/10 border-app-warning/20',
    WAITING_CLIENT: 'text-app-accent bg-app-accent/10 border-app-accent/20',
    RESOLVED: 'text-app-success bg-app-success/10 border-app-success/20',
    CLOSED: 'text-app-muted-foreground bg-app-surface-2/10 border-app-border-strong/20',
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
            .catch(() => {
                const demo: Ticket[] = [
                    { id: 't1', ticket_number: 'TK-2025-001', ticket_type: 'ORDER_ISSUE', status: 'OPEN', priority: 'HIGH', subject: 'Missing item in delivery', description: 'My order #ORD-2025-0085 was missing 1 of the 3 items I ordered. Please advise on next steps.', satisfaction_rating: null, created_at: new Date(Date.now() - 86400000).toISOString() },
                    { id: 't2', ticket_number: 'TK-2025-002', ticket_type: 'GENERAL', status: 'IN_PROGRESS', priority: 'MEDIUM', subject: 'How to update billing address?', description: 'I need to update my billing address for future orders. Where can I find this setting?', satisfaction_rating: null, created_at: new Date(Date.now() - 259200000).toISOString() },
                    { id: 't3', ticket_number: 'TK-2025-003', ticket_type: 'PRODUCT_FEEDBACK', status: 'RESOLVED', priority: 'LOW', subject: 'Great product quality!', description: 'Just wanted to say the packaging and product quality exceeded my expectations. Keep it up!', satisfaction_rating: 5, created_at: new Date(Date.now() - 604800000).toISOString() },
                ]
                setTickets(demo)
                setLoading(false)
            })
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
            <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">Please log in</h1>
                    <Link href={`/tenant/${slug}`} className="text-app-success font-bold">Go to Store</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-app-bg p-4 lg:p-12 relative">
            <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-app-accent/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-8">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <Link href={`/tenant/${slug}/account`}
                            className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-white text-sm font-medium transition-colors">
                            <ArrowLeft size={16} /> My Account
                        </Link>
                        <h1 className="text-4xl font-black text-white">Support Tickets</h1>
                    </div>
                    <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-app-accent-strong text-white rounded-xl font-bold hover:bg-app-accent transition-all">
                        <Plus size={18} /> New Ticket
                    </button>
                </div>

                {/* Create Modal */}
                {showCreate && (
                    <div className="p-8 bg-app-surface/80 border border-app-accent/20 rounded-3xl space-y-5 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                <MessageSquare size={22} className="text-app-accent" /> New Ticket
                            </h2>
                            <button onClick={() => setShowCreate(false)} className="text-app-muted-foreground hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        {error && (
                            <div className="p-3 bg-app-error/10 border border-app-error/20 rounded-xl text-app-error text-sm flex items-center gap-2">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}
                        <form onSubmit={handleCreate} className="space-y-4">
                            <select value={type} onChange={e => setType(e.target.value)}
                                className="w-full bg-app-bg/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-app-accent transition-all">
                                {TICKET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                            <input type="text" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required
                                className="w-full bg-app-bg/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-app-accent transition-all placeholder:text-app-faint" />
                            <textarea placeholder="Describe your issue..." value={description} onChange={e => setDescription(e.target.value)} required rows={4}
                                className="w-full bg-app-bg/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-app-accent transition-all placeholder:text-app-faint resize-none" />
                            <button type="submit" disabled={creating}
                                className="w-full bg-app-accent-strong hover:bg-app-accent text-white p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-60">
                                {creating ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> Submit Ticket</>}
                            </button>
                        </form>
                    </div>
                )}

                {/* Tickets List */}
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-app-surface/60 rounded-xl animate-pulse" />)}
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <MessageSquare size={48} className="mx-auto text-app-faint" />
                        <h2 className="text-xl font-bold text-white">No tickets yet</h2>
                        <p className="text-app-muted-foreground">Need help? Create a support ticket above</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tickets.map(ticket => {
                            const statusClass = STATUS_COLORS[ticket.status] || STATUS_COLORS.OPEN
                            return (
                                <div key={ticket.id}
                                    className="p-6 bg-app-surface/60 border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <p className="text-white font-bold">{ticket.subject}</p>
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${statusClass}`}>
                                                    {ticket.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-app-muted-foreground text-sm mt-2 line-clamp-2">{ticket.description}</p>
                                            <div className="flex items-center gap-4 mt-3 text-[11px] text-app-faint">
                                                <span>{ticket.ticket_number}</span>
                                                <span>{TICKET_TYPES.find(t => t.value === ticket.ticket_type)?.label}</span>
                                                <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {ticket.satisfaction_rating && (
                                            <div className="flex items-center gap-1 text-app-warning text-sm shrink-0">
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
