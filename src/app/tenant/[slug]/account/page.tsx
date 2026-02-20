'use client'

import { useEffect, useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
    ShoppingBag, Wallet, TicketCheck, ArrowLeft, Package, Clock,
    ChevronRight, Star, TrendingUp, Shield, Heart, Bell,
    User, Settings
} from 'lucide-react'

interface DashboardData {
    total_orders: number
    active_orders: number
    total_spent: string
    wallet_balance: string
    loyalty_points: number
    loyalty_tier: string
    open_tickets: number
    barcode: string
    wallet_enabled: boolean
    ecommerce_enabled: boolean
    tickets_enabled: boolean
    loyalty_enabled: boolean
}

export default function AccountPage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, token, user, contact, wishlistCount } = usePortal()
    const [dashboard, setDashboard] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!isAuthenticated) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/client-portal/dashboard/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) setDashboard(data[0])
                else if (!Array.isArray(data)) setDashboard(data)
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [isAuthenticated, token])

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center justify-center mx-auto text-amber-400">
                        <Shield size={40} />
                    </div>
                    <h1 className="text-3xl font-black text-white">Authentication Required</h1>
                    <p className="text-slate-400">Please log in from the storefront to access your account</p>
                    <Link href={`/tenant/${slug}`}
                        className="inline-flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-500 transition-all">
                        <ArrowLeft size={18} /> Go to Store
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-8 relative">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white">My Account</h1>
                        <p className="text-slate-500 text-sm mt-1">Welcome back, {user?.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {contact?.tier && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                <Star size={14} /> {contact.tier}
                            </div>
                        )}
                        <Link href={`/tenant/${slug}/account/profile`}
                            className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white transition-all">
                            <Settings size={18} />
                        </Link>
                    </div>
                </div>

                {/* Stats Grid */}
                {!loading && dashboard && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-500">
                        <div className="p-5 bg-slate-900/60 border border-white/5 rounded-2xl space-y-1 hover:border-blue-500/30 transition-all">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Orders</p>
                            <p className="text-2xl font-black text-white flex items-center gap-2">
                                <ShoppingBag size={18} className="text-blue-400" /> {dashboard.total_orders}
                            </p>
                        </div>
                        <div className="p-5 bg-slate-900/60 border border-white/5 rounded-2xl space-y-1 hover:border-emerald-500/30 transition-all">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Orders</p>
                            <p className="text-2xl font-black text-white flex items-center gap-2">
                                <Clock size={18} className="text-emerald-400" /> {dashboard.active_orders}
                            </p>
                        </div>
                        <div className="p-5 bg-slate-900/60 border border-white/5 rounded-2xl space-y-1 hover:border-amber-500/30 transition-all">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Wallet</p>
                            <p className="text-2xl font-black text-white flex items-center gap-2">
                                <Wallet size={18} className="text-amber-400" /> ${parseFloat(dashboard.wallet_balance).toFixed(0)}
                            </p>
                        </div>
                        <div className="p-5 bg-slate-900/60 border border-white/5 rounded-2xl space-y-1 hover:border-purple-500/30 transition-all">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Loyalty</p>
                            <p className="text-2xl font-black text-white flex items-center gap-2">
                                <TrendingUp size={18} className="text-purple-400" /> {dashboard.loyalty_points}
                            </p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="p-5 bg-slate-900/60 border border-white/5 rounded-2xl h-24 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Quick Nav — 2x3 grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Link href={`/tenant/${slug}/account/orders`}
                        className="group p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-blue-500/30 transition-all">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                            <Package size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white">Order History</h3>
                            <p className="text-slate-500 text-xs">Track & manage orders</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>

                    <Link href={`/tenant/${slug}/account/wishlist`}
                        className="group p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-rose-500/30 transition-all">
                        <div className="w-12 h-12 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                            <Heart size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white">Wishlist</h3>
                            <p className="text-slate-500 text-xs">{wishlistCount} saved items</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>

                    <Link href={`/tenant/${slug}/account/wallet`}
                        className="group p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-amber-500/30 transition-all">
                        <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                            <Wallet size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white">Wallet & Loyalty</h3>
                            <p className="text-slate-500 text-xs">Balance & points</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>

                    <Link href={`/tenant/${slug}/account/notifications`}
                        className="group p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-cyan-500/30 transition-all">
                        <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                            <Bell size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white">Notifications</h3>
                            <p className="text-slate-500 text-xs">Alerts & updates</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>

                    <Link href={`/tenant/${slug}/account/tickets`}
                        className="group p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-purple-500/30 transition-all">
                        <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                            <TicketCheck size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white">Support</h3>
                            <p className="text-slate-500 text-xs">{dashboard?.open_tickets || 0} open tickets</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>

                    <Link href={`/tenant/${slug}/account/profile`}
                        className="group p-6 bg-slate-900/60 border border-white/5 rounded-2xl flex items-center gap-4 hover:border-slate-500/30 transition-all">
                        <div className="w-12 h-12 bg-slate-500/10 rounded-xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
                            <User size={22} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-white">Profile</h3>
                            <p className="text-slate-500 text-xs">Settings & security</p>
                        </div>
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>
                </div>

                {/* Barcode */}
                {dashboard?.barcode && (
                    <div className="p-5 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center gap-4">
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">POS Barcode</div>
                        <div className="font-mono text-white text-lg tracking-[0.2em]">{dashboard.barcode}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
