'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
 ArrowLeft, Bell, CheckCircle2, AlertCircle, Info,
 ShoppingCart, FileText, TrendingDown, Package, Clock
} from 'lucide-react'

interface Notification {
 id: string
 title: string
 message: string
 type: 'ORDER' | 'PROFORMA' | 'PRICE_REQUEST' | 'SYSTEM' | 'PAYMENT'
 is_read: boolean
 created_at: string
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
 ORDER: { icon: ShoppingCart, color: 'text-app-info', bg: 'bg-app-info-bg border-app-info/20' },
 PROFORMA: { icon: FileText, color: 'text-emerald-400', bg: 'bg-app-success-bg border-emerald-500/20' },
 PRICE_REQUEST: { icon: TrendingDown, color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning/20' },
 PAYMENT: { icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
 SYSTEM: { icon: Info, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20' },
}

function getToken(slug: string): string | null {
 if (typeof window === 'undefined') return null
 try {
 const s = JSON.parse(localStorage.getItem('supplier_session') || 'null')
 return s?.organization?.slug === slug ? s.token : null
 } catch { return null }
}

function timeAgo(date: string): string {
 const diff = Date.now() - new Date(date).getTime()
 const mins = Math.floor(diff / 60000)
 if (mins < 1) return 'Just now'
 if (mins < 60) return `${mins}m ago`
 const hours = Math.floor(mins / 60)
 if (hours < 24) return `${hours}h ago`
 const days = Math.floor(hours / 24)
 if (days < 7) return `${days}d ago`
 return new Date(date).toLocaleDateString()
}

export default function SupplierNotificationsPage() {
 const { slug } = useParams<{ slug: string }>()
 const [notifications, setNotifications] = useState<Notification[]>([])
 const [loading, setLoading] = useState(true)
 const [filter, setFilter] = useState<'all' | 'unread'>('all')

 useEffect(() => {
 const token = getToken(slug)
 if (!token) { setLoading(false); return }
 const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
 fetch(`${djangoUrl}/api/supplier-portal/notifications/`, {
 headers: { 'Authorization': `Token ${token}` },
 })
 .then(r => r.json())
 .then(data => {
 setNotifications(Array.isArray(data) ? data : data.results || [])
 setLoading(false)
 })
 .catch(() => {
 // Demo data for preview
 setNotifications([
 { id: '1', title: 'New Purchase Order', message: 'PO-2025-0042 has been created and assigned to you. Review and confirm delivery timeline.', type: 'ORDER', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
 { id: '2', title: 'Proforma Approved', message: 'Your proforma PRF-2025-018 has been approved by the buyer.', type: 'PROFORMA', is_read: false, created_at: new Date(Date.now() - 86400000).toISOString() },
 { id: '3', title: 'Price Request Update', message: 'Your price change request for "Industrial Valve A-200" has been reviewed.', type: 'PRICE_REQUEST', is_read: true, created_at: new Date(Date.now() - 172800000).toISOString() },
 { id: '4', title: 'Payment Received', message: 'Payment of $12,500.00 has been credited to your account for Invoice INV-2025-007.', type: 'PAYMENT', is_read: true, created_at: new Date(Date.now() - 259200000).toISOString() },
 { id: '5', title: 'System Maintenance', message: 'Scheduled maintenance on Feb 25, 2026 from 02:00 - 04:00 UTC.', type: 'SYSTEM', is_read: true, created_at: new Date(Date.now() - 432000000).toISOString() },
 ])
 setLoading(false)
 })
 }, [slug])

 const markAsRead = (id: string) => {
 setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
 const token = getToken(slug)
 if (!token) return
 const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
 fetch(`${djangoUrl}/api/supplier-portal/notifications/${id}/read/`, {
 method: 'POST',
 headers: { 'Authorization': `Token ${token}` },
 }).catch(() => { })
 }

 const markAllRead = () => {
 setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
 const token = getToken(slug)
 if (!token) return
 const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
 fetch(`${djangoUrl}/api/supplier-portal/notifications/mark-all-read/`, {
 method: 'POST',
 headers: { 'Authorization': `Token ${token}` },
 }).catch(() => { })
 }

 const displayed = filter === 'unread'
 ? notifications.filter(n => !n.is_read)
 : notifications
 const unreadCount = notifications.filter(n => !n.is_read).length

 return (
 <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative bg-app-bg">
 <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

 <div className="max-w-3xl mx-auto relative z-10 space-y-8">
 <div className="flex items-start justify-between">
 <div className="space-y-2">
 <Link href={`/supplier-portal/${slug}`}
 className="inline-flex items-center gap-2 text-app-text-muted hover:text-app-text text-sm font-medium transition-colors">
 <ArrowLeft size={16} /> Dashboard
 </Link>
 <h1 className="text-4xl font-black text-app-text">Notifications</h1>
 <p className="text-app-text-muted text-sm">
 {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
 </p>
 </div>
 {unreadCount > 0 && (
 <button onClick={markAllRead}
 className="px-5 py-2.5 bg-indigo-600 text-app-text rounded-xl text-sm font-bold hover:bg-indigo-500 transition-all flex items-center gap-2">
 <CheckCircle2 size={16} /> Mark All Read
 </button>
 )}
 </div>

 {/* Filters */}
 <div className="flex gap-2">
 {(['all', 'unread'] as const).map(f => (
 <button key={f} onClick={() => setFilter(f)}
 className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all
 ${filter === f
 ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
 : 'bg-app-text/5 text-app-text-faint border border-transparent hover:text-app-text'
 }`}>
 {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
 </button>
 ))}
 </div>

 {/* List */}
 {loading ? (
 <div className="space-y-3">
 {[1, 2, 3].map(i => <div key={i} className="h-24 bg-app-surface/60 rounded-2xl animate-pulse" />)}
 </div>
 ) : displayed.length === 0 ? (
 <div className="py-24 text-center space-y-4">
 <Bell size={48} className="mx-auto text-app-text-muted" />
 <h2 className="text-xl font-bold text-app-text">
 {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
 </h2>
 <p className="text-app-text-muted text-sm">
 {filter === 'unread' ? 'You\'re all caught up!' : 'Notifications will appear here'}
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {displayed.map(n => {
 const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.SYSTEM
 const Icon = cfg.icon
 return (
 <div key={n.id}
 onClick={() => !n.is_read && markAsRead(n.id)}
 className={`p-5 rounded-2xl border transition-all cursor-pointer
 ${n.is_read
 ? 'bg-app-surface/40 border-app-text/5'
 : 'bg-app-surface/70 border-indigo-500/20 hover:border-indigo-500/40'
 }`}>
 <div className="flex items-start gap-4">
 <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bg} ${cfg.color}`}>
 <Icon size={18} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3">
 <p className={`font-bold text-sm ${n.is_read ? 'text-app-text-faint' : 'text-app-text'}`}>
 {n.title}
 </p>
 {!n.is_read && (
 <div className="w-2 h-2 bg-indigo-500 rounded-full shrink-0" />
 )}
 </div>
 <p className={`text-sm mt-1 ${n.is_read ? 'text-app-text-muted' : 'text-app-text-faint'}`}>
 {n.message}
 </p>
 <div className="flex items-center gap-3 mt-2">
 <span className="text-[10px] text-app-text-muted font-medium flex items-center gap-1">
 <Clock size={10} /> {timeAgo(n.created_at)}
 </span>
 <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>
 {n.type.replace('_', ' ')}
 </span>
 </div>
 </div>
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
