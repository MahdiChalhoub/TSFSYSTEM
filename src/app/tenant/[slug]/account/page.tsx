'use client'

import { useEffect, useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ShoppingBag, Wallet, TicketCheck, ArrowLeft, Package, Clock,
    ChevronRight, Star, TrendingUp, Shield, AlertCircle
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
    const router = useRouter()
    const { isAuthenticated, token, user, contact } = usePortal()
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
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="space-y-2">
                    <Link href={`/tenant/${slug}`}
                        className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-sm font-medium transition-colors">
                        <ArrowLeft size={16} /> Back to Store
                    </Link>
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-4xl font-black text-white">My Account</h1>
                            <p className="text-slate-500 text-sm mt-1">Welcome back, {user?.name}</p>
                        </div>
                        {contact?.tier && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-[10px] font-black uppercase tracking-widest">
                                <Star size={14} /> {contact.tier}
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                {!loading && dashboard && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
                        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 group hover:border-blue-500/30 transition-all">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total Orders</p>
                            <p className="text-3xl font-black text-white flex items-center gap-2">
                                <ShoppingBag size={20} className="text-blue-400" /> {dashboard.total_orders}
                            </p>
                        </div>
                        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 group hover:border-emerald-500/30 transition-all">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active Orders</p>
                            <p className="text-3xl font-black text-white flex items-center gap-2">
                                <Clock size={20} className="text-emerald-400" /> {dashboard.active_orders}
                            </p>
                        </div>
                        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 group hover:border-amber-500/30 transition-all">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Wallet Balance</p>
                            <p className="text-3xl font-black text-white flex items-center gap-2">
                                <Wallet size={20} className="text-amber-400" /> ${parseFloat(dashboard.wallet_balance).toFixed(2)}
                            </p>
                        </div>
                        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 group hover:border-purple-500/30 transition-all">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Loyalty Points</p>
                            <p className="text-3xl font-black text-white flex items-center gap-2">
                                <TrendingUp size={20} className="text-purple-400" /> {dashboard.loyalty_points}
                            </p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl h-28 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Quick Nav */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href={`/tenant/${slug}/account/orders`}
                        className="group p-8 bg-slate-900/60 border border-white/5 rounded-3xl flex items-center gap-6 hover:border-blue-500/30 transition-all">
                        <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                            <Package size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white">Order History</h3>
                            <p className="text-slate-500 text-sm">Track and manage your orders</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>

                    <Link href={`/tenant/${slug}/account/wallet`}
                        className="group p-8 bg-slate-900/60 border border-white/5 rounded-3xl flex items-center gap-6 hover:border-amber-500/30 transition-all">
                        <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                            <Wallet size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white">Wallet & Loyalty</h3>
                            <p className="text-slate-500 text-sm">Balance, transactions & points</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>

                    <Link href={`/tenant/${slug}/account/tickets`}
                        className="group p-8 bg-slate-900/60 border border-white/5 rounded-3xl flex items-center gap-6 hover:border-purple-500/30 transition-all">
                        <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                            <TicketCheck size={28} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white">Support Tickets</h3>
                            <p className="text-slate-500 text-sm">Get help & submit requests</p>
                        </div>
                        <ChevronRight size={20} className="text-slate-600 group-hover:text-white transition-colors" />
                    </Link>
                </div>

                {/* Barcode */}
                {dashboard?.barcode && (
                    <div className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center gap-4">
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">POS Barcode</div>
                        <div className="font-mono text-white text-lg tracking-[0.2em]">{dashboard.barcode}</div>
                    </div>
                )}
            </div>
        </div>
    )
}
