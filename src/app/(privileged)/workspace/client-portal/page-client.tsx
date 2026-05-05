'use client'
import { Badge } from '@/components/ui/badge'
import { useState, useEffect } from 'react'
import { getClientWallets, getClientTickets, getQuoteRequests, getClientAccess, updateClientTicket } from '@/app/actions/portal'
import { Monitor, Wallet, Ticket, FileQuestion, Users, RefreshCw, CheckCircle, XCircle, Clock, ChevronRight, DollarSign, MessageSquare, Globe, Activity} from 'lucide-react'
type ClientWallet = { id: number; client?: { name: string }; client_name?: string; balance: number; currency?: string }
type Ticket = { id: number; subject: string; status: string; priority?: string; client?: { name: string }; client_name?: string; created_at?: string }
type QuoteRequest = { id: number; client?: { name: string }; client_name?: string; status: string; total_items?: number; created_at?: string; notes?: string }
const TICKET_STATUS: Record<string, string> = {
 OPEN: 'bg-app-info/40 text-app-info border-app-info/30',
 IN_PROGRESS: 'bg-app-warning/40 text-app-warning border-app-warning/30',
 RESOLVED: 'bg-app-success/40 text-app-primary border-app-success/30',
 CLOSED: 'bg-app-surface-2 text-app-muted-foreground border-app-border',
}
const PRIORITY: Record<string, string> = {
 HIGH: 'text-app-error',
 MEDIUM: 'text-app-warning',
 LOW: 'text-app-muted-foreground',
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
 <div className="min-h-screen bg-[#070D1B] text-app-foreground p-6 flex flex-col gap-6 bg-app-background">
 {toast && (
 <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-app-success/80 border-app-success/30 text-app-success' : 'bg-app-error/80 border-app-error/30 text-app-error'}`}>
 {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
 {toast.msg}
 </div>
 )}
 {/* Header: Global Client Intelligence */}
 <header className="flex justify-between items-end">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge className="bg-app-info-bg text-app-info border-app-info/30 font-black text-[10px] uppercase tracking-widest px-3 py-1">
 Client Network: Synchronized
 </Badge>
 <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest flex items-center gap-1">
 <Activity size={12} /> Sync: Direct
 </span>
 </div>
 <h1 className="flex items-center gap-4">
 <div className="w-16 h-16 rounded-[1.8rem] bg-app-info flex items-center justify-center shadow-2xl shadow-blue-200">
 <Monitor size={32} className="text-app-foreground fill-white" />
 </div>
 Client <span className="text-app-info">Ops</span>
 </h1>
 </div>
 <div className="flex gap-3">
 <button onClick={load} className="h-12 px-6 rounded-2xl bg-app-surface border border-app-border shadow-sm font-bold text-app-muted-foreground flex items-center gap-2 hover:bg-app-background transition-all">
 <RefreshCw size={18} /> Refresh Hub
 </button>
 <button className="h-12 px-6 rounded-2xl bg-app-info text-app-foreground font-bold flex items-center gap-2 hover:bg-app-info transition-all shadow-lg shadow-blue-200">
 Portal Audit <ChevronRight size={18} />
 </button>
 </div>
 </header>
 {/* Premium KPI Node Grid */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="bg-app-surface p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
 <div className="flex justify-between items-start mb-4">
 <div className="w-12 h-12 rounded-2xl bg-app-error-soft text-app-error flex items-center justify-center">
 <DollarSign size={24} />
 </div>
 <Badge variant="outline" className="text-app-error bg-app-error-soft border-0 font-black text-[10px]">
 WALLET
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Portfolio Balance</p>
 <h2>${totalBalance.toFixed(2)}</h2>
 </div>
 <div className="bg-app-info p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-app-foreground">
 <div className="flex justify-between items-start mb-4">
 <div className="w-12 h-12 rounded-2xl bg-app-info/50 text-app-info flex items-center justify-center">
 <MessageSquare size={24} />
 </div>
 <Badge variant="outline" className="text-app-info bg-app-info/30 border-0 font-black text-[10px]">
 {openTickets.length} ACTIVE
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-info uppercase tracking-widest leading-none mb-1">Support Tickets</p>
 <h2>{openTickets.length} <span className="text-xs text-app-info">OPEN</span></h2>
 </div>
 <div className="bg-app-surface p-7 rounded-[2.5rem] shadow-sm border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
 <div className="flex justify-between items-start mb-4">
 <div className="w-12 h-12 rounded-2xl bg-app-info-bg text-app-info flex items-center justify-center">
 <FileQuestion size={24} />
 </div>
 <Badge variant="outline" className="text-app-info bg-app-info-bg border-0 font-black text-[10px]">
 QUOTES
 </Badge>
 </div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Quote Requests</p>
 <h2>{quotes.length}</h2>
 </div>
 </div>
 {/* Tabs */}
 <div className="flex gap-1 bg-[#0F1729] rounded-2xl border border-app-border p-1.5 w-fit">
 {([['wallets', 'Client Wallets', Wallet], ['tickets', 'Support Tickets', MessageSquare], ['quotes', 'Quote Requests', FileQuestion]] as const).map(([key, label, Icon]) => (
 <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === key ? 'bg-app-error text-app-foreground shadow-lg shadow-fuchsia-900/40' : 'text-app-muted-foreground hover:text-app-foreground'}`}>
 <Icon size={14} />
 {label}
 {key === 'tickets' && openTickets.length > 0 && <span className="bg-app-warning text-app-foreground text-[10px] font-bold px-1.5 rounded-full">{openTickets.length}</span>}
 </button>
 ))}
 </div>
 {/* Tab content */}
 <div className="flex flex-col gap-2">
 {loading ? Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-app-surface-2/50 rounded-xl animate-pulse" />) :
 tab === 'wallets' ? (
 wallets.length === 0 ? <div className="text-sm text-app-muted-foreground py-8 text-center">No client wallets yet.</div> :
 wallets.map(w => (
 <div key={w.id} className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-[#0F1729] border border-app-border">
 <Wallet size={16} className="text-fuchsia-400 shrink-0" />
 <div className="flex-1">
 <div className="font-medium text-sm text-app-foreground">{w.client?.name || w.client_name || '—'}</div>
 </div>
 <div className={`font-mono font-bold text-sm ${Number(w.balance) > 0 ? 'text-app-primary' : Number(w.balance) < 0 ? 'text-app-error' : 'text-app-muted-foreground'}`}>
 {w.currency || '$'}{Number(w.balance || 0).toFixed(2)}
 </div>
 </div>
 ))
 ) : tab === 'tickets' ? (
 tickets.length === 0 ? <div className="text-sm text-app-muted-foreground py-8 text-center">No tickets.</div> :
 tickets.map(t => (
 <div key={t.id} className="flex items-center gap-6 p-6 rounded-[2.5rem] bg-app-surface shadow-sm border border-app-border transition-all hover:shadow-md group text-app-foreground">
 <div className="w-12 h-12 rounded-2xl bg-app-info-bg text-app-info flex items-center justify-center shrink-0">
 <MessageSquare size={24} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-1">
 <span className="font-black text-sm uppercase italic truncate">{t.subject}</span>
 <Badge className={`${TICKET_STATUS[t.status] || 'bg-app-surface-2 text-app-muted-foreground'} border-0 text-[8px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest`}>{t.status}</Badge>
 {t.priority && <span className={`text-[10px] font-black uppercase tracking-widest ${PRIORITY[t.priority] || 'text-app-muted-foreground'}`}>{t.priority}</span>}
 </div>
 <p className="text-[10px] font-black text-app-primary uppercase tracking-widest truncate">{t.client?.name || t.client_name || '—'}{t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString()}` : ''}</p>
 </div>
 {(t.status === 'OPEN' || t.status === 'IN_PROGRESS') && (
 <button onClick={() => resolveTicket(t.id)} className="h-10 px-6 rounded-2xl bg-app-primary text-app-foreground font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-app-success transition-all">
 Authorize
 </button>
 )}
 </div>
 ))
 ) : (
 quotes.length === 0 ? <div className="text-sm text-app-muted-foreground py-8 text-center">No quote requests.</div> :
 quotes.map(q => (
 <div key={q.id} className="flex items-center gap-4 px-5 py-3.5 rounded-xl bg-[#0F1729] border border-app-border">
 <FileQuestion size={16} className="text-app-info shrink-0" />
 <div className="flex-1">
 <div className="font-medium text-sm text-app-foreground">{q.client?.name || q.client_name || '—'}</div>
 <p className="text-xs text-app-muted-foreground mt-0.5">{q.total_items != null ? `${q.total_items} items` : ''}{q.created_at ? ` · ${new Date(q.created_at).toLocaleDateString()}` : ''}{q.notes ? ` · ${q.notes}` : ''}</p>
 </div>
 <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TICKET_STATUS[q.status] || 'bg-app-surface-2 text-app-muted-foreground border-app-border'}`}>{q.status}</span>
 </div>
 ))
 )
 }
 </div>
 </div>
 )
}
