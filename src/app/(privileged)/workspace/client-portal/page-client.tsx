'use client'

import { useState, useEffect } from 'react'
import { getClientWallets, getClientTickets, getQuoteRequests, getClientAccess, updateClientTicket } from '@/app/actions/portal'
import { Monitor, Wallet, Ticket, FileQuestion, Users, RefreshCw, CheckCircle, XCircle, Clock, ChevronRight, DollarSign, MessageSquare } from 'lucide-react'

type ClientWallet = { id: number; client?: { name: string }; client_name?: string; balance: number; currency?: string }
type Ticket = { id: number; subject: string; status: string; priority?: string; client?: { name: string }; client_name?: string; created_at?: string }
type QuoteRequest = { id: number; client?: { name: string }; client_name?: string; status: string; total_items?: number; created_at?: string; notes?: string }

const TICKET_STATUS: Record<string, string> = {
    OPEN: 'bg-blue-900/40 text-blue-400 border-blue-700',
    IN_PROGRESS: 'bg-amber-900/40 text-amber-400 border-amber-700',
    RESOLVED: 'bg-emerald-900/40 text-emerald-400 border-emerald-700',
    CLOSED: 'bg-gray-800 text-gray-500 border-gray-700',
}
const PRIORITY: Record<string, string> = {
    HIGH: 'text-red-400',
    MEDIUM: 'text-amber-400',
    LOW: 'text-gray-400',
}

export default function ClientPortalAdminPage() {
    const [tab, setTab] = useState<'wallets' | 'tickets' | 'quotes'>('wallets')
    const [wallets, setWallets] = useState<ClientWallet[]>([])
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [quotes, setQuotes] = useState<QuoteRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    useEffect(() => { load() }, [])

    async function load() {
        setLoading(true)
        const [w, t, q] = await Promise.all([getClientWallets(), getClientTickets(), getQuoteRequests()])
        setWallets(w)
        setTickets(t)
        setQuotes(q)
        setLoading(false)
    }

    async function resolveTicket(id: number) {
        try {
            await updateClientTicket(id, { status: 'RESOLVED' })
            showToast('Ticket resolved', 'ok')
            load()
        } catch { showToast('Failed', 'err') }
    }

    function showToast(msg: string, type: 'ok' | 'err') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const totalBalance = wallets.reduce((s, w) => s + Number(w.balance || 0), 0)
    const openTickets = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS')

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-emerald-900/80 border-emerald-700 text-emerald-300' : 'bg-red-900/80 border-red-700 text-red-300'}`}>
                    {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-900/40">
                        <Monitor size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Client Portal Admin</h1>
                        <p className="text-sm text-gray-400 mt-0.5">Manage wallets, support tickets, and quote requests</p>
                    </div>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm">
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Wallet Balance', value: `$${totalBalance.toFixed(2)}`, icon: DollarSign, color: 'fuchsia' },
                    { label: 'Open Tickets', value: openTickets.length, icon: Ticket, color: openTickets.length > 0 ? 'amber' : 'emerald' },
                    { label: 'Quote Requests', value: quotes.length, icon: FileQuestion, color: 'blue' },
                ].map(s => (
                    <div key={s.label} className="bg-[#0F1729] rounded-2xl border border-gray-800 p-5">
                        <div className="flex items-center gap-2 text-gray-400 text-xs mb-2"><s.icon size={14} />{s.label}</div>
                        <div className={`text-2xl font-bold text-${s.color}-400`}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#0F1729] rounded-2xl border border-gray-800 p-1.5 w-fit">
                {([['wallets', 'Client Wallets', Wallet], ['tickets', 'Support Tickets', MessageSquare], ['quotes', 'Quote Requests', FileQuestion]] as const).map(([key, label, Icon]) => (
                    <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-900/40' : 'text-gray-400 hover:text-gray-200'}`}>
                        <Icon size={14} />
                        {label}
                        {key === 'tickets' && openTickets.length > 0 && <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 rounded-full">{openTickets.length}</span>}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="flex flex-col gap-2">
                {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-800/50 rounded-xl animate-pulse" />) :

                    tab === 'wallets' ? (
                        wallets.length === 0 ? <div className="text-sm text-gray-500 py-8 text-center">No client wallets yet.</div> :
                            wallets.map(w => (
                                <div key={w.id} className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-[#0F1729] border border-gray-800">
                                    <Wallet size={16} className="text-fuchsia-400 shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm text-white">{w.client?.name || w.client_name || '—'}</div>
                                    </div>
                                    <div className={`font-mono font-bold text-sm ${Number(w.balance) > 0 ? 'text-emerald-400' : Number(w.balance) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                        {w.currency || '$'}{Number(w.balance || 0).toFixed(2)}
                                    </div>
                                </div>
                            ))
                    ) : tab === 'tickets' ? (
                        tickets.length === 0 ? <div className="text-sm text-gray-500 py-8 text-center">No tickets.</div> :
                            tickets.map(t => (
                                <div key={t.id} className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-[#0F1729] border border-gray-800">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-sm text-white">{t.subject}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TICKET_STATUS[t.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{t.status}</span>
                                            {t.priority && <span className={`text-xs font-semibold ${PRIORITY[t.priority] || 'text-gray-400'}`}>{t.priority}</span>}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{t.client?.name || t.client_name || '—'}{t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString()}` : ''}</p>
                                    </div>
                                    {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                                        <button onClick={() => resolveTicket(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold">
                                            <CheckCircle size={11} />Resolve
                                        </button>
                                    )}
                                </div>
                            ))
                    ) : (
                        quotes.length === 0 ? <div className="text-sm text-gray-500 py-8 text-center">No quote requests.</div> :
                            quotes.map(q => (
                                <div key={q.id} className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-[#0F1729] border border-gray-800">
                                    <FileQuestion size={16} className="text-blue-400 shrink-0" />
                                    <div className="flex-1">
                                        <div className="font-medium text-sm text-white">{q.client?.name || q.client_name || '—'}</div>
                                        <p className="text-xs text-gray-500 mt-0.5">{q.total_items != null ? `${q.total_items} items` : ''}{q.created_at ? ` · ${new Date(q.created_at).toLocaleDateString()}` : ''}{q.notes ? ` · ${q.notes}` : ''}</p>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TICKET_STATUS[q.status] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{q.status}</span>
                                </div>
                            ))
                    )
                }
            </div>
        </div>
    )
}
