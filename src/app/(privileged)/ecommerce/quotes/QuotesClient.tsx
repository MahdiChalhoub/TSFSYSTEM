'use client'

import { useState, useTransition } from 'react'
import { QuoteRequest, QuoteStatus, respondToQuote, updateQuoteStatus } from '@/app/actions/ecommerce/quotes'
import { FileText, Clock, CheckCircle, XCircle, MessageSquare, ChevronDown, ChevronUp, Send } from 'lucide-react'

interface Props { initialQuotes: QuoteRequest[] }

const STATUS_OPTS: QuoteStatus[] = ['PENDING', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CANCELLED']

const STATUS_STYLE: Record<QuoteStatus, { bg: string; text: string; icon: React.ElementType }> = {
    PENDING: { bg: '#f59e0b15', text: '#f59e0b', icon: Clock },
    QUOTED: { bg: '#06b6d415', text: '#06b6d4', icon: MessageSquare },
    ACCEPTED: { bg: '#10b98115', text: '#10b981', icon: CheckCircle },
    REJECTED: { bg: '#f4375115', text: '#f43751', icon: XCircle },
    CANCELLED: { bg: '#64748b15', text: '#64748b', icon: XCircle },
}

export default function QuotesClient({ initialQuotes }: Props) {
    const [quotes, setQuotes] = useState(initialQuotes)
    const [filter, setFilter] = useState<QuoteStatus | 'ALL'>('ALL')
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [price, setPrice] = useState<Record<number, string>>({})
    const [notes, setNotes] = useState<Record<number, string>>({})
    const [toast, setToast] = useState('')
    const [isPending, startTransition] = useTransition()

    const visible = filter === 'ALL' ? quotes : quotes.filter(q => q.status === filter)

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

    const handleRespond = (id: number) => {
        startTransition(async () => {
            const res = await respondToQuote(id, price[id] ?? '0', notes[id] ?? '')
            if (!res.ok) { showToast('Error: ' + res.error); return }
            setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: 'QUOTED', quoted_price: price[id] ?? '0', quoted_notes: notes[id] ?? '' } : q))
            setExpandedId(null)
            showToast('Quote sent to client ✓')
        })
    }

    const handleStatus = (id: number, status: QuoteStatus) => {
        startTransition(async () => {
            await updateQuoteStatus(id, status)
            setQuotes(prev => prev.map(q => q.id === id ? { ...q, status } : q))
        })
    }

    const pending = quotes.filter(q => q.status === 'PENDING').length
    const accepted = quotes.filter(q => q.status === 'ACCEPTED').length

    return (
        <div className="app-page">
            {/* Header */}
            <div className="app-page-header">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#06b6d4' }}>
                        <FileText size={18} color="#fff" />
                    </div>
                    <div>
                        <h1 className="app-page-title">Quote Inbox</h1>
                        <p className="app-page-subtitle">B2B quote requests from the storefront</p>
                    </div>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Requests', value: quotes.length, icon: FileText, color: '#06b6d4' },
                    { label: 'Needs Response', value: pending, icon: Clock, color: '#f59e0b' },
                    { label: 'Accepted', value: accepted, icon: CheckCircle, color: '#10b981' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="app-card flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                            <Icon size={18} style={{ color }} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--app-text)]">{value}</p>
                            <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1.5 mb-4 flex-wrap">
                {(['ALL', ...STATUS_OPTS] as const).map(s => (
                    <button key={s} onClick={() => setFilter(s)} id={`filter-${s}`}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === s
                            ? 'bg-[var(--app-accent)] text-white shadow-sm'
                            : 'bg-[var(--app-card)] text-[var(--app-text-muted)] border border-[var(--app-border)] hover:bg-[var(--app-surface-hover)]'}`}>
                        {s}
                        {s !== 'ALL' && (
                            <span className="ml-1.5 opacity-70">{quotes.filter(q => q.status === s).length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* Quote list */}
            <div className="app-card p-0 overflow-hidden">
                {visible.length === 0 ? (
                    <div className="py-16 flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#06b6d418' }}>
                            <FileText size={22} style={{ color: '#06b6d4' }} />
                        </div>
                        <p className="font-semibold text-[var(--app-text)]">No quote requests</p>
                        <p className="text-xs text-[var(--app-text-muted)]">
                            {filter === 'ALL' ? 'Quote requests from the storefront will appear here' : `No ${filter.toLowerCase()} quotes`}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--app-border)]">
                        {visible.map(q => {
                            const style = STATUS_STYLE[q.status]
                            const StatusIcon = style.icon
                            const isExpanded = expandedId === q.id
                            return (
                                <div key={q.id}>
                                    <div className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--app-surface-hover)] transition-colors">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ background: style.bg }}>
                                            <StatusIcon size={14} style={{ color: style.text }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-sm text-[var(--app-text)]">{q.contact_name}</span>
                                                {q.product_name && (
                                                    <span className="text-xs text-[var(--app-text-muted)]">· {q.product_name}</span>
                                                )}
                                                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                                                    style={{ background: style.bg, color: style.text }}>
                                                    {q.status}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--app-text-muted)] mt-0.5 truncate max-w-xl">{q.description}</p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 text-xs text-[var(--app-text-muted)]">
                                            <span className="font-medium">Qty: {q.quantity}</span>
                                            {q.quoted_price && (
                                                <span className="font-bold text-[var(--app-accent)]">
                                                    {parseFloat(q.quoted_price).toLocaleString()}
                                                </span>
                                            )}
                                            <button onClick={() => setExpandedId(isExpanded ? null : q.id)}
                                                className="app-btn app-btn-ghost text-xs py-1 px-2" id={`expand-quote-${q.id}`}>
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                {isExpanded ? 'Close' : 'Respond'}
                                            </button>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="px-5 pb-5 pt-3 bg-[var(--app-surface)] border-t border-[var(--app-border)]">
                                            <div className="grid grid-cols-2 gap-5">
                                                <div className="space-y-2">
                                                    <p className="text-xs font-bold text-[var(--app-text-muted)] uppercase tracking-wider">Request Details</p>
                                                    <div className="app-card p-3 space-y-1">
                                                        <p className="text-sm text-[var(--app-text)]">{q.description}</p>
                                                        <p className="text-xs text-[var(--app-text-muted)]">Qty: {q.quantity}</p>
                                                        {q.contact_email && <p className="text-xs text-[var(--app-text-muted)]">{q.contact_email}</p>}
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <p className="text-xs font-bold text-[var(--app-text-muted)] uppercase tracking-wider">Send Quote</p>
                                                    <div>
                                                        <label className="app-label">Quoted Price</label>
                                                        <input id={`quote-price-${q.id}`} type="number" className="app-input"
                                                            value={price[q.id] ?? q.quoted_price ?? ''}
                                                            onChange={e => setPrice(p => ({ ...p, [q.id]: e.target.value }))} />
                                                    </div>
                                                    <div>
                                                        <label className="app-label">Notes / Terms</label>
                                                        <textarea id={`quote-notes-${q.id}`} className="app-input" rows={2}
                                                            value={notes[q.id] ?? q.quoted_notes ?? ''}
                                                            onChange={e => setNotes(n => ({ ...n, [q.id]: e.target.value }))} />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleRespond(q.id)} disabled={isPending}
                                                            id={`send-quote-${q.id}`} className="app-btn app-btn-primary text-sm flex-1">
                                                            <Send size={13} />
                                                            {isPending ? 'Sending…' : 'Send Quote'}
                                                        </button>
                                                        <select className="app-input text-xs w-36" value={q.status}
                                                            onChange={e => handleStatus(q.id, e.target.value as QuoteStatus)}
                                                            id={`status-quote-${q.id}`}>
                                                            {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 right-6 z-50 app-card px-4 py-3 text-sm text-[var(--app-text)] shadow-xl flex items-center gap-2">
                    <CheckCircle size={14} className="text-emerald-400" /> {toast}
                </div>
            )}
        </div>
    )
}
