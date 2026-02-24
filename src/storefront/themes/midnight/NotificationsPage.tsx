'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../../engine/hooks/useAuth'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
import Link from 'next/link'
import {
    Bell, Package, CheckCircle2, AlertTriangle, Info, Gift, Clock,
    Check, ArrowLeft, Shield, ChevronRight, Radio
} from 'lucide-react'

interface Notification {
    id: string; type: string; title: string; message: string; is_read: boolean; created_at: string; link?: string
}

const TYPE_MAP: Record<string, { icon: any; color: string; bg: string }> = {
    ORDER_UPDATE: { icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    ORDER_SHIPPED: { icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    ORDER_DELIVERED: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    PROMO: { icon: Gift, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    ALERT: { icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    WALLET: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    INFO: { icon: Info, color: 'text-slate-400', bg: 'bg-slate-500/10' },
}

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString()
}

export default function MidnightNotificationsPage() {
    const { path, slug } = useStorefrontPath()
    const { isAuthenticated } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    useEffect(() => {
        if (!isAuthenticated) { setLoading(false); return }
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        const token = localStorage.getItem('portal_token')
        fetch(`${djangoUrl}/api/client-portal/my-notifications/`, { headers: { 'Authorization': `Token ${token}` } })
            .then(r => r.ok ? r.json() : [])
            .then(data => { setNotifications(Array.isArray(data) ? data : data.results || []); setLoading(false) })
            .catch(() => {
                setNotifications([
                    { id: 'n1', type: 'ORDER_SHIPPED', title: 'Order Shipped!', message: 'Your order #ORD-2025-0089 has been shipped.', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
                    { id: 'n2', type: 'PROMO', title: 'Weekend Sale — 20% Off!', message: 'Use code WEEKEND20 at checkout.', is_read: false, created_at: new Date(Date.now() - 86400000).toISOString() },
                    { id: 'n3', type: 'WALLET', title: 'Wallet Top-Up Approved', message: 'Your $100.00 top-up has been approved.', is_read: true, created_at: new Date(Date.now() - 172800000).toISOString() },
                    { id: 'n4', type: 'ORDER_DELIVERED', title: 'Order Delivered', message: 'Order #ORD-2025-0092 has been delivered.', is_read: true, created_at: new Date(Date.now() - 259200000).toISOString() },
                ])
                setLoading(false)
            })
    }, [isAuthenticated])

    const markRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
        const token = localStorage.getItem('portal_token')
        if (token) {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
            fetch(`${djangoUrl}/api/client-portal/my-notifications/${id}/read/`, {
                method: 'POST', headers: { 'Authorization': `Token ${token}` },
            }).catch(() => { })
        }
    }

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        const token = localStorage.getItem('portal_token')
        if (token) {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
            fetch(`${djangoUrl}/api/client-portal/my-notifications/read-all/`, {
                method: 'POST', headers: { 'Authorization': `Token ${token}` },
            }).catch(() => { })
        }
    }

    const filtered = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications
    const unreadCount = notifications.filter(n => !n.is_read).length

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-500/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-10">
                <div className="space-y-4">
                    <Link href={path('/account')} className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
                    </Link>
                    <div className="flex items-start justify-between flex-wrap gap-6">
                        <div>
                            <h1 className="text-5xl font-black text-white italic tracking-tighter">Signal <span className="text-blue-400">Feed</span></h1>
                            {unreadCount > 0 && <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-2">{unreadCount} unread signals</p>}
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
                                <button onClick={() => setFilter('all')} className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'all' ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-white'}`}>All</button>
                                <button onClick={() => setFilter('unread')} className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${filter === 'unread' ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-white'}`}>Unread</button>
                            </div>
                            {unreadCount > 0 && (
                                <button onClick={markAllRead} className="px-5 py-3 bg-white/5 border border-white/10 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-white transition-all flex items-center gap-2">
                                    <Check size={14} /> Clear All
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-24 text-center space-y-8 bg-slate-900/20 border border-white/5 rounded-[3.5rem]">
                        <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto text-slate-700"><Bell size={48} /></div>
                        <h2 className="text-2xl font-black text-white italic">{filter === 'unread' ? 'All Signals Cleared' : 'Zero Active Signals'}</h2>
                        <p className="text-slate-500 text-sm">{filter === 'unread' ? 'All signal feeds have been acknowledged' : 'Signal notifications will appear here'}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filtered.map(notif => {
                            const t = TYPE_MAP[notif.type] || TYPE_MAP.INFO
                            const Icon = t.icon
                            return (
                                <div key={notif.id} onClick={() => !notif.is_read && markRead(notif.id)}
                                    className={`p-7 rounded-[2.5rem] flex items-start gap-6 transition-all cursor-pointer border group
                                        ${notif.is_read ? 'bg-slate-900/30 border-white/5' : 'bg-slate-900/60 border-white/10 hover:border-blue-500/30 shadow-xl shadow-black/20'}`}>
                                    <div className={`w-14 h-14 ${t.bg} rounded-2xl flex items-center justify-center ${t.color} flex-shrink-0 group-hover:scale-110 transition-transform`}>
                                        <Icon size={22} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <p className={`font-black italic text-sm ${notif.is_read ? 'text-slate-500' : 'text-white'}`}>{notif.title}</p>
                                            {!notif.is_read && (
                                                <div className="relative flex-shrink-0">
                                                    <span className="w-3 h-3 bg-blue-500 rounded-full block" />
                                                    <span className="absolute inset-0 w-3 h-3 bg-blue-500 rounded-full animate-ping opacity-75" />
                                                </div>
                                            )}
                                        </div>
                                        <p className={`text-sm mt-2 ${notif.is_read ? 'text-slate-700' : 'text-slate-400'}`}>{notif.message}</p>
                                        <p className="text-slate-700 text-[10px] mt-3 flex items-center gap-2 font-black uppercase tracking-widest">
                                            <Clock size={10} /> {timeAgo(notif.created_at)}
                                        </p>
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
