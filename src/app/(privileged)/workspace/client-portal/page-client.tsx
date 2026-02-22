'use client'

import { useState, useEffect } from 'react'
import { getClientWallets, getClientTickets, getQuoteRequests, getClientAccess, updateClientTicket } from '@/app/actions/portal'
import { Monitor, Wallet, Ticket, FileQuestion, Users, RefreshCw, CheckCircle, XCircle, Clock, ChevronRight, DollarSign, MessageSquare, Globe } from 'lucide-react'

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

            {/* Header: Global Client Intelligence */}
            <header className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Badge className="bg-blue-50 text-blue-600 border-blue-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Client Network: Synchronized
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <Activity size={12} /> Sync: Direct
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-blue-600 flex items-center justify-center shadow-2xl shadow-blue-200">
                            <Monitor size={32} className="text-white fill-white" />
                        </div>
                        Client <span className="text-blue-600">Ops</span>
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={load} className="h-12 px-6 rounded-2xl bg-white border border-gray-100 shadow-sm font-bold text-gray-600 flex items-center gap-2 hover:bg-gray-50 transition-all">
                        <RefreshCw size={18} /> Refresh Hub
                    </button>
                    <button className="h-12 px-6 rounded-2xl bg-blue-600 text-white font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                        Portal Audit <ChevronRight size={18} />
                    </button>
                </div>
            </header>

            {/* Premium KPI Node Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center">
                            <DollarSign size={24} />
                        </div>
                        <Badge variant="outline" className="text-fuchsia-500 bg-fuchsia-50 border-0 font-black text-[10px]">
                            WALLET
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Portfolio Balance</p>
                    <h2 className="text-3xl font-black text-gray-900">${totalBalance.toFixed(2)}</h2>
                </div>

                <div className="bg-blue-600 p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/50 text-blue-100 flex items-center justify-center">
                            <MessageSquare size={24} />
                        </div>
                        <Badge variant="outline" className="text-blue-200 bg-blue-500/30 border-0 font-black text-[10px]">
                            {openTickets.length} ACTIVE
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-blue-100 uppercase tracking-widest leading-none mb-1">Support Tickets</p>
                    <h2 className="text-3xl font-black text-white">{openTickets.length} <span className="text-xs text-blue-200">OPEN</span></h2>
                </div>

                <div className="bg-white p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FileQuestion size={24} />
                        </div>
                        <Badge variant="outline" className="text-blue-500 bg-blue-50 border-0 font-black text-[10px]">
                            QUOTES
                        </Badge>
                    </div>
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Quote Requests</p>
                    <h2 className="text-3xl font-black text-gray-900">{quotes.length}</h2>
                </div>
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
                                <div key={t.id} className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-white shadow-sm border border-slate-50 transition-all hover:shadow-md group text-gray-900">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                        <MessageSquare size={24} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-1">
                                            <span className="font-black text-sm uppercase italic truncate">{t.subject}</span>
                                            <Badge className={`${TICKET_STATUS[t.status] || 'bg-gray-100 text-gray-400'} border-0 text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest`}>{t.status}</Badge>
                                            {t.priority && <span className={`text-[10px] font-black uppercase tracking-widest ${PRIORITY[t.priority] || 'text-gray-400'}`}>{t.priority}</span>}
                                        </div>
                                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest truncate">{t.client?.name || t.client_name || '—'}{t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString()}` : ''}</p>
                                    </div>
                                    {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
                                        <button onClick={() => resolveTicket(t.id)} className="h-10 px-6 rounded-2xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all">
                                            Authorize
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
