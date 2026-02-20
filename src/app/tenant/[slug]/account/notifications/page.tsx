'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { usePortal } from '@/context/PortalContext'
import {
    Bell, Package, CheckCircle2, AlertTriangle, Info, Gift, Clock,
    Check, Loader2
} from 'lucide-react'

interface Notification {
    id: string
    type: string
    title: string
    message: string
    is_read: boolean
    created_at: string
    link?: string
}

const TYPE_MAP: Record<string, { icon: any; color: string; bg: string }> = {
    ORDER_UPDATE: { icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    ORDER_SHIPPED: { icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    ORDER_DELIVERED: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    PROMO: { icon: Gift, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    ALERT: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
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

export default function NotificationsPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, token } = usePortal()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')

    useEffect(() => {
        if (!isAuthenticated || !token) { setLoading(false); return }
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/client-portal/my-notifications/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                setNotifications(Array.isArray(data) ? data : data.results || [])
                setLoading(false)
            })
            .catch(() => {
                const demo: Notification[] = [
                    { id: 'n1', type: 'ORDER_SHIPPED', title: 'Order Shipped!', message: 'Your order #ORD-2025-0089 has been shipped and is on its way.', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
                    { id: 'n2', type: 'PROMO', title: 'Weekend Sale — 20% Off!', message: 'Use code WEEKEND20 at checkout. Valid this weekend only.', is_read: false, created_at: new Date(Date.now() - 86400000).toISOString() },
                    { id: 'n3', type: 'WALLET', title: 'Wallet Top-Up Approved', message: 'Your $100.00 wallet top-up has been approved. New balance: $245.50', is_read: true, created_at: new Date(Date.now() - 172800000).toISOString() },
                    { id: 'n4', type: 'ORDER_DELIVERED', title: 'Order Delivered', message: 'Order #ORD-2025-0092 has been delivered. Please rate your experience!', is_read: true, created_at: new Date(Date.now() - 259200000).toISOString() },
                    { id: 'n5', type: 'INFO', title: 'Welcome to the Store!', message: 'Your account has been set up. Start browsing our catalog and place your first order.', is_read: true, created_at: new Date(Date.now() - 604800000).toISOString() },
                ]
                setNotifications(demo)
                setLoading(false)
            })
    }, [isAuthenticated, token])

    const markRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, is_read: true } : n)
        )
        // In real implementation, call API
        if (token) {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
            fetch(`${djangoUrl}/api/client-portal/my-notifications/${id}/read/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` },
            }).catch(() => { })
        }
    }

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        if (token) {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
            fetch(`${djangoUrl}/api/client-portal/my-notifications/read-all/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}` },
            }).catch(() => { })
        }
    }

    const filtered = filter === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications
    const unreadCount = notifications.filter(n => !n.is_read).length

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-8 relative">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-3xl mx-auto relative z-10 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white flex items-center gap-3">
                            <Bell size={28} className="text-blue-400" /> Notifications
                        </h1>
                        {unreadCount > 0 && (
                            <p className="text-slate-500 text-sm mt-1">{unreadCount} unread</p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Filter pills */}
                        <div className="flex bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden">
                            <button onClick={() => setFilter('all')}
                                className={`px-4 py-2 text-xs font-bold transition-all ${filter === 'all' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}>
                                All
                            </button>
                            <button onClick={() => setFilter('unread')}
                                className={`px-4 py-2 text-xs font-bold transition-all ${filter === 'unread' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}>
                                Unread
                            </button>
                        </div>
                        {unreadCount > 0 && (
                            <button onClick={markAllRead}
                                className="px-4 py-2 bg-white/5 border border-white/10 text-slate-400 rounded-xl text-xs font-bold hover:text-white transition-all flex items-center gap-1.5">
                                <Check size={14} /> Mark all read
                            </button>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="animate-spin text-blue-500" size={40} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="py-24 text-center space-y-4">
                        <Bell size={48} className="mx-auto text-slate-600" />
                        <h2 className="text-xl font-bold text-white">
                            {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
                        </h2>
                        <p className="text-slate-500">
                            {filter === 'unread' ? 'You\'ve read all your notifications' : 'Notifications about orders, promos, and updates will appear here'}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(notif => {
                            const t = TYPE_MAP[notif.type] || TYPE_MAP.INFO
                            const Icon = t.icon
                            return (
                                <div key={notif.id}
                                    onClick={() => !notif.is_read && markRead(notif.id)}
                                    className={`p-5 rounded-2xl flex items-start gap-4 transition-all cursor-pointer border
                                        ${notif.is_read
                                            ? 'bg-slate-900/40 border-white/5'
                                            : 'bg-slate-900/80 border-white/10 hover:border-blue-500/20'
                                        }`}>
                                    <div className={`w-10 h-10 ${t.bg} rounded-xl flex items-center justify-center ${t.color} flex-shrink-0 mt-0.5`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`font-bold text-sm ${notif.is_read ? 'text-slate-400' : 'text-white'}`}>
                                                {notif.title}
                                            </p>
                                            {!notif.is_read && (
                                                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                                            )}
                                        </div>
                                        <p className={`text-sm mt-1 ${notif.is_read ? 'text-slate-600' : 'text-slate-400'}`}>
                                            {notif.message}
                                        </p>
                                        <p className="text-slate-600 text-[10px] mt-2 flex items-center gap-1">
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
