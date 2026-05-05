'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
    ShoppingBag, Wallet, TicketCheck, ArrowLeft, Package, Clock,
    ChevronRight, Star, TrendingUp, Shield, Heart, Bell,
    User, Settings, ExternalLink, QrCode
} from 'lucide-react'
import { useAuth } from '../../engine/hooks/useAuth'
import { useWishlist } from '../../engine/hooks/useWishlist'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
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
export default function MidnightDashboardPage() {
    const { path, slug } = useStorefrontPath()
    const { user, isAuthenticated } = useAuth()
    const { wishlistCount } = useWishlist()
    const [dashboard, setDashboard] = useState<DashboardData | null>(null)
    const [loading, setLoading] = useState(true)
    useEffect(() => {
        if (!isAuthenticated) return
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        // In a real scenario, useAuth or a dedicated hook would provide the token
        // For now, mirroring the extraction logic from the original page
        const token = localStorage.getItem('portal_token')
        fetch(`${djangoUrl}/api/client-portal/dashboard/`, {
            headers: { 'Authorization': `Token ${token}` },
        })
            .then(r => r.json())
            .then(data => {
                const result = Array.isArray(data) ? data[0] : data
                setDashboard(result)
                setLoading(false)
            })
            .catch(() => {
                // Mock data for display if API fails (matching original behavior)
                setDashboard({
                    total_orders: 12,
                    active_orders: 2,
                    total_spent: '1845.60',
                    wallet_balance: '245.50',
                    loyalty_points: 1280,
                    loyalty_tier: 'Platinum',
                    open_tickets: 1,
                    barcode: 'M-2026-993-NX',
                    wallet_enabled: true,
                    ecommerce_enabled: true,
                    tickets_enabled: true,
                    loyalty_enabled: true,
                })
                setLoading(false)
            })
    }, [isAuthenticated])
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="max-w-md w-full text-center space-y-8">
                    <div className="w-24 h-24 bg-app-error/10 border border-app-error/20 rounded-[2rem] flex items-center justify-center mx-auto text-app-error shadow-2xl shadow-rose-500/10 rotate-12">
                        <Shield size={48} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black text-white italic tracking-tighter">Access Denied</h1>
                        <p className="text-app-muted-foreground text-sm leading-relaxed">
                            Your current identity session is not authorized to access the account stream.
                            Please authenticate to proceed.
                        </p>
                    </div>
                    <Link href={path('/login')}
                        className="inline-flex items-center gap-3 px-10 py-4 bg-app-success text-white rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-105 uppercase tracking-widest text-xs">
                        Authorize Now <ExternalLink size={16} />
                    </Link>
                </div>
            </div>
        )
    }
    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-app-success/5 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-app-info/5 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="max-w-6xl mx-auto relative z-10 space-y-10">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 text-app-success">
                            <TrendingUp size={20} />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Personal Dashboard</span>
                        </div>
                        <h1 className="text-5xl font-black text-white italic tracking-tighter">Welcome, <span className="text-app-success">{user?.name}</span></h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {dashboard?.loyalty_tier && (
                            <div className="px-6 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-black text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-orange-500/20">
                                <Star size={14} fill="currentColor" /> {dashboard.loyalty_tier} Status
                            </div>
                        )}
                        <Link href={path('/account/profile')} className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-app-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                            <Settings size={20} />
                        </Link>
                    </div>
                </div>
                {/* Performance HUD */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    <HudItem
                        label="Order Total"
                        value={loading ? '...' : dashboard?.total_orders}
                        icon={<ShoppingBag size={24} className="text-blue-400" />}
                        meta="Total operations"
                    />
                    <HudItem
                        label="In Transit"
                        value={loading ? '...' : dashboard?.active_orders}
                        icon={<Clock size={24} className="text-emerald-400" />}
                        meta="Active streams"
                        color="emerald"
                    />
                    <HudItem
                        label="Liquid Credit"
                        value={loading ? '...' : `$${Number(dashboard?.wallet_balance).toFixed(0)}`}
                        icon={<Wallet size={24} className="text-amber-400" />}
                        meta="Wallet balance"
                        color="amber"
                    />
                    <HudItem
                        label="Loyalty Index"
                        value={loading ? '...' : dashboard?.loyalty_points}
                        icon={<TrendingUp size={24} className="text-purple-400" />}
                        meta="Reward credits"
                        color="purple"
                    />
                </div>
                {/* Operations Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <OperationCard
                        title="Order History"
                        description="Track and manage your commerce ledger"
                        path={path('/account/orders')}
                        icon={<Package size={24} />}
                        color="blue"
                    />
                    <OperationCard
                        title="Wishlist"
                        description={`${wishlistCount} saved items in collection`}
                        path={path('/account/wishlist')}
                        icon={<Heart size={24} />}
                        color="rose"
                    />
                    <OperationCard
                        title="Wallet & Loyalty"
                        description="Manage credits and redemption rules"
                        path={path('/account/wallet')}
                        icon={<Wallet size={24} />}
                        color="amber"
                    />
                    <OperationCard
                        title="Communication"
                        description="View alerts and system messages"
                        path={path('/account/notifications')}
                        icon={<Bell size={24} />}
                        color="cyan"
                    />
                    <OperationCard
                        title="Support Node"
                        description={`${dashboard?.open_tickets || 0} active support threads`}
                        path={path('/account/tickets')}
                        icon={<TicketCheck size={24} />}
                        color="purple"
                    />
                    <OperationCard
                        title="Profile Control"
                        description="Update identity and security parameters"
                        path={path('/account/profile')}
                        icon={<User size={24} />}
                        color="slate"
                    />
                </div>
                {/* Identity Tag */}
                {dashboard?.barcode && (
                    <div className="p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-app-success/30 transition-all duration-500">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                                <QrCode size={32} />
                            </div>
                            <div>
                                <p className="text-[10px] text-app-muted-foreground font-black uppercase tracking-[0.3em]">Identity Reference Tag</p>
                                <h2 className="text-2xl font-mono font-black text-white tracking-widest">{dashboard.barcode}</h2>
                            </div>
                        </div>
                        <div className="px-6 py-2 bg-app-success/10 border border-app-success/20 rounded-full text-[10px] font-black text-app-success uppercase tracking-widest group-hover:bg-app-success group-hover:text-white transition-all">
                            Active Session
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
function HudItem({ label, value, icon, meta, color = 'blue' }: any) {
    const colors: any = {
        blue: 'hover:border-app-info/30',
        emerald: 'hover:border-app-success/30',
        amber: 'hover:border-app-warning/30',
        purple: 'hover:border-purple-500/30'
    }
    return (
        <div className={`p-8 bg-slate-900/60 border border-white/5 rounded-[2rem] space-y-4 transition-all duration-300 ${colors[color]} group`}>
            <div className="flex justify-between items-start">
                <div className="p-3 bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
                <div className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest">{label}</div>
            </div>
            <div>
                <p className="text-3xl font-black text-white italic">{value}</p>
                <p className="text-[10px] text-app-muted-foreground mt-1 uppercase font-bold tracking-wider">{meta}</p>
            </div>
        </div>
    )
}
function OperationCard({ title, description, path, icon, color }: any) {
    const colors: any = {
        blue: 'text-blue-400 bg-app-info/10 border-app-info/30',
        rose: 'text-rose-400 bg-app-error/10 border-app-error/30',
        amber: 'text-amber-400 bg-app-warning/10 border-app-warning/30',
        cyan: 'text-cyan-400 bg-app-info/10 border-app-info/30',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
        slate: 'text-app-muted-foreground bg-slate-500/10 border-slate-500/30',
    }
    return (
        <Link href={path} className="group p-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] flex items-center gap-6 hover:border-white/10 transition-all duration-300">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 ${colors[color].split(' ').filter((s: string) => !s.startsWith('border')).join(' ')}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="text-lg font-black text-white italic tracking-tight">{title}</h3>
                <p className="text-app-muted-foreground text-xs mt-1">{description}</p>
            </div>
            <ChevronRight size={20} className="text-app-muted-foreground group-hover:text-app-success group-hover:translate-x-1 transition-all" />
        </Link>
    )
}
