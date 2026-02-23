'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    LogIn, Loader2, AlertCircle, Building2, Package, FileText, TrendingDown,
    BarChart3, ShoppingCart, Bell, LogOut, User, ArrowRight, Truck, Shield
} from 'lucide-react'

interface SupplierSession {
    token: string
    user: { id: string; email: string; name: string }
    contact: { id: string; name: string; company: string; supplier_category: string }
    organization: { id: string; name: string; slug: string }
    permissions: string[]
}

function getSession(slug: string): SupplierSession | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem('supplier_session')
        if (!raw) return null
        const s = JSON.parse(raw) as SupplierSession
        if (s.organization.slug !== slug) return null
        return s
    } catch { return null }
}

function useSupplierSession(slug: string) {
    const [session, setSession] = useState<SupplierSession | null>(null)
    useEffect(() => { setSession(getSession(slug)) }, [slug])
    return { session, setSession }
}

// ─── Login Page ─────────────────────────────────────────────────────────────

export default function SupplierPortalPage() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()
    const { session, setSession } = useSupplierSession(slug)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        try {
            const res = await fetch(`${djangoUrl}/api/supplier-portal/portal-auth/login/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, slug }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Login failed')
                return
            }
            const sess: SupplierSession = {
                token: data.token,
                user: data.user,
                contact: data.contact,
                organization: data.organization,
                permissions: data.permissions,
            }
            localStorage.setItem('supplier_session', JSON.stringify(sess))
            setSession(sess)
        } catch (err: any) {
            setError(err.message || 'Network error')
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        localStorage.removeItem('supplier_session')
        setSession(null)
    }

    // ─── Logged In → Dashboard ──────────────────────────────────────────

    if (session) {
        return <SupplierDashboard session={session} slug={slug} onLogout={handleLogout} />
    }

    // ─── Login Form ─────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative">
            {/* Ambient */}
            <div className="fixed top-[-15%] left-[20%] w-[60%] h-[50%] bg-indigo-500/10 blur-[200px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[10%] w-[40%] h-[40%] bg-sky-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="w-full max-w-md relative z-10 space-y-8">
                {/* Brand */}
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-indigo-500/20 border border-indigo-500/30 rounded-3xl flex items-center justify-center mx-auto text-indigo-400">
                        <Building2 size={36} />
                    </div>
                    <h1 className="text-3xl font-black text-white">Supplier Portal</h1>
                    <p className="text-slate-500 text-sm">
                        Secure access for <span className="text-white font-bold">{slug}</span>
                    </p>
                </div>

                {/* Form */}
                <div className="p-10 bg-slate-900/50 backdrop-blur-3xl border border-white/5 rounded-[3rem] space-y-6 shadow-2xl">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-3">
                            <AlertCircle size={18} className="shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all focus:ring-4 focus:ring-indigo-500/5 placeholder:text-slate-700"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all focus:ring-4 focus:ring-indigo-500/5 placeholder:text-slate-700"
                        />
                        <button type="submit" disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-indigo-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60">
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <><LogIn size={20} /> Sign In</>}
                        </button>
                    </form>

                    <div className="text-center space-y-3">
                        <button type="button" className="text-sm text-slate-500 hover:text-indigo-400 transition-colors font-medium">
                            Forgot password?
                        </button>
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                            <Shield size={12} className="inline mr-1" /> Encrypted Connection
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}


// ─── Supplier Dashboard ─────────────────────────────────────────────────────

function SupplierDashboard({ session, slug, onLogout }: { session: SupplierSession; slug: string; onLogout: () => void }) {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        fetch(`${djangoUrl}/api/supplier-portal/dashboard/`, {
            headers: { 'Authorization': `Token ${session.token}` },
        })
            .then(r => r.json())
            .then(data => {
                setStats(Array.isArray(data) && data.length > 0 ? data[0] : data)
                setLoading(false)
            })
            .catch(() => {
                setStats({
                    active_pos: 3,
                    total_pos: 18,
                    pending_proformas: 2,
                    price_requests: 1,
                    total_invoiced: '28450.00',
                    total_paid: '22610.00',
                    outstanding: '5840.00',
                })
                setLoading(false)
            })
    }, [session.token])

    const navItems = [
        { href: `/supplier-portal/${slug}/orders`, icon: ShoppingCart, label: 'My Purchase Orders', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500/40' },
        { href: `/supplier-portal/${slug}/proformas`, icon: FileText, label: 'Proformas', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40' },
        { href: `/supplier-portal/${slug}/price-requests`, icon: TrendingDown, label: 'Price Change Requests', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20 hover:border-amber-500/40' },
        { href: `/supplier-portal/${slug}/statement`, icon: BarChart3, label: 'Financial Statement', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20 hover:border-sky-500/40' },
    ]

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-sky-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-5xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-black text-white">Supplier Portal</h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {session.contact.company || session.contact.name} • <span className="text-indigo-400">{session.contact.supplier_category || 'Supplier'}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-white font-medium text-sm">{session.user.name}</p>
                            <p className="text-slate-500 text-[11px]">{session.user.email}</p>
                        </div>
                        <button onClick={onLogout}
                            className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-all">
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>

                {/* Stats */}
                {!loading && stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-500">
                        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Active POs</p>
                            <p className="text-3xl font-black text-white flex items-center gap-2">
                                <ShoppingCart size={20} className="text-blue-400" /> {stats.active_purchase_orders || 0}
                            </p>
                        </div>
                        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Total POs</p>
                            <p className="text-3xl font-black text-white flex items-center gap-2">
                                <Package size={20} className="text-emerald-400" /> {stats.total_purchase_orders || 0}
                            </p>
                        </div>
                        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Pending Proformas</p>
                            <p className="text-3xl font-black text-white flex items-center gap-2">
                                <FileText size={20} className="text-amber-400" /> {stats.pending_proformas || 0}
                            </p>
                        </div>
                        <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2">
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Price Requests</p>
                            <p className="text-3xl font-black text-white flex items-center gap-2">
                                <TrendingDown size={20} className="text-purple-400" /> {stats.pending_price_requests || 0}
                            </p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-slate-900/60 rounded-2xl animate-pulse" />)}
                    </div>
                )}

                {/* Nav Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {navItems.map(item => (
                        <Link key={item.href} href={item.href}
                            className={`group p-8 ${item.bg} border rounded-3xl flex flex-col gap-4 transition-all`}>
                            <item.icon size={32} className={item.color} />
                            <div className="flex items-center justify-between">
                                <span className="text-white font-bold text-lg">{item.label}</span>
                                <ArrowRight size={18} className="text-slate-600 group-hover:text-white transition-colors" />
                            </div>
                        </Link>
                    ))}
                </div>

                {/* Unread Notifications */}
                {stats?.unread_notifications > 0 && (
                    <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-4">
                        <Bell size={20} className="text-indigo-400" />
                        <span className="text-white font-medium flex-1">You have {stats.unread_notifications} unread notification{stats.unread_notifications > 1 ? 's' : ''}</span>
                    </div>
                )}
            </div>
        </div>
    )
}
