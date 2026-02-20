'use client'

import { useState } from 'react'
import { usePortal } from '@/context/PortalContext'
import { LogIn, Loader2, AlertCircle, User, LogOut, ShoppingBag, Wallet, TicketCheck, X } from 'lucide-react'

export function ClientPortalLogin({ slug }: { slug: string }) {
    const { isAuthenticated, user, contact, login, logout, cart } = usePortal()
    const [showForm, setShowForm] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)
        const result = await login(email, password, slug, 'client')
        setLoading(false)
        if (!result.success) {
            setError(result.error || 'Login failed')
        } else {
            setShowForm(false)
        }
    }

    // Authenticated state — show user card
    if (isAuthenticated && user) {
        return (
            <div className="p-8 bg-slate-900/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] space-y-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
                <div className="relative space-y-5">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400">
                            <User size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-lg truncate">{user.name}</p>
                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                                {contact?.tier || 'Customer'} {contact?.loyalty_points ? `• ${contact.loyalty_points} pts` : ''}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <a href={`/tenant/${slug}/account`}
                            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-sm text-white font-semibold hover:bg-white/10 transition-all">
                            <ShoppingBag size={16} className="text-blue-400" /> My Orders
                        </a>
                        <a href={`/tenant/${slug}/account/wallet`}
                            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-sm text-white font-semibold hover:bg-white/10 transition-all">
                            <Wallet size={16} className="text-amber-400" /> Wallet
                        </a>
                        <a href={`/tenant/${slug}/account/tickets`}
                            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-sm text-white font-semibold hover:bg-white/10 transition-all">
                            <TicketCheck size={16} className="text-purple-400" /> Tickets
                        </a>
                        <a href={`/tenant/${slug}/cart`}
                            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/5 rounded-xl text-sm text-white font-semibold hover:bg-white/10 transition-all relative">
                            <ShoppingBag size={16} className="text-emerald-400" /> Cart
                            {cart.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full text-[10px] flex items-center justify-center font-black text-white">
                                    {cart.length}
                                </span>
                            )}
                        </a>
                    </div>

                    <button onClick={logout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 font-semibold hover:bg-red-500/20 transition-all">
                        <LogOut size={16} /> Sign Out
                    </button>
                </div>
            </div>
        )
    }

    // Login form
    if (showForm) {
        return (
            <div className="p-8 bg-slate-900/60 backdrop-blur-3xl border border-white/5 rounded-[2.5rem] space-y-6 relative overflow-hidden animate-in fade-in duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
                <div className="relative space-y-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-xl font-bold text-white">Client Login</h2>
                            <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase mt-1">Access your orders, wallet & support</p>
                        </div>
                        <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-3">
                            <AlertCircle size={18} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-blue-500 transition-all focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-700"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-blue-500 transition-all focus:ring-4 focus:ring-blue-500/5 placeholder:text-slate-700"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <><LogIn size={20} /> Sign In</>}
                        </button>
                        <p className="text-center">
                            <button type="button" className="text-sm text-slate-500 hover:text-blue-400 transition-colors font-medium">
                                Forgot password?
                            </button>
                        </p>
                    </form>
                </div>
            </div>
        )
    }

    // Default: show login CTA
    return (
        <div className="space-y-3">
            <button
                onClick={() => setShowForm(true)}
                className="w-full p-5 bg-blue-600/20 border border-blue-500/30 rounded-2xl text-blue-400 font-bold flex items-center justify-center gap-3 hover:bg-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
                <LogIn size={20} /> Client Portal Login
            </button>
            <a href={`/tenant/${slug}/register`}
                className="block text-center text-sm text-slate-500 hover:text-emerald-400 transition-colors font-medium">
                New here? <span className="underline">Create an account</span>
            </a>
        </div>
    )
}
