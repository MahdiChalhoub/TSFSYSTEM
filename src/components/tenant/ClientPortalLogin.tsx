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
 <div className="p-8 bg-app-surface/60 backdrop-blur-3xl border border-app-text/5 rounded-[2.5rem] space-y-5 relative overflow-hidden">
 <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent" />
 <div className="relative space-y-5">
 <div className="flex items-center gap-4">
 <div className="w-14 h-14 bg-app-primary/20 border border-app-primary/30 rounded-2xl flex items-center justify-center text-app-primary">
 <User size={24} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-app-text font-bold text-lg truncate">{user.name}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase tracking-widest">
 {contact?.tier || 'Customer'} {contact?.loyalty_points ? `• ${contact.loyalty_points} pts` : ''}
 </p>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-2">
 <a href={`/tenant/${slug}/account`}
 className="flex items-center gap-2 px-4 py-3 bg-app-text/5 border border-app-text/5 rounded-xl text-sm text-app-text font-semibold hover:bg-app-text/10 transition-all">
 <ShoppingBag size={16} className="text-app-info" /> My Orders
 </a>
 <a href={`/tenant/${slug}/account/wallet`}
 className="flex items-center gap-2 px-4 py-3 bg-app-text/5 border border-app-text/5 rounded-xl text-sm text-app-text font-semibold hover:bg-app-text/10 transition-all">
 <Wallet size={16} className="text-app-warning" /> Wallet
 </a>
 <a href={`/tenant/${slug}/account/tickets`}
 className="flex items-center gap-2 px-4 py-3 bg-app-text/5 border border-app-text/5 rounded-xl text-sm text-app-text font-semibold hover:bg-app-text/10 transition-all">
 <TicketCheck size={16} className="text-purple-400" /> Tickets
 </a>
 <a href={`/tenant/${slug}/cart`}
 className="flex items-center gap-2 px-4 py-3 bg-app-text/5 border border-app-text/5 rounded-xl text-sm text-app-text font-semibold hover:bg-app-text/10 transition-all relative">
 <ShoppingBag size={16} className="text-app-primary" /> Cart
 {cart.length > 0 && (
 <span className="absolute -top-1 -right-1 w-5 h-5 bg-app-primary rounded-full text-[10px] flex items-center justify-center font-black text-app-text">
 {cart.length}
 </span>
 )}
 </a>
 </div>

 <button onClick={logout}
 className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-app-error-bg border border-app-error/20 rounded-xl text-sm text-app-error font-semibold hover:bg-app-error-bg transition-all">
 <LogOut size={16} /> Sign Out
 </button>
 </div>
 </div>
 )
 }

 // Login form
 if (showForm) {
 return (
 <div className="p-8 bg-app-surface/60 backdrop-blur-3xl border border-app-text/5 rounded-[2.5rem] space-y-6 relative overflow-hidden animate-in fade-in duration-300">
 <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
 <div className="relative space-y-5">
 <div className="flex justify-between items-start">
 <div>
 <h2 className="text-xl font-bold text-app-text">Client Login</h2>
 <p className="text-[10px] text-app-text-muted font-medium tracking-wide uppercase mt-1">Access your orders, wallet & support</p>
 </div>
 <button onClick={() => setShowForm(false)} className="text-app-text-muted hover:text-app-text transition-colors">
 <X size={20} />
 </button>
 </div>

 {error && (
 <div className="p-4 bg-app-error-bg border border-app-error/20 rounded-2xl text-app-error text-sm font-medium flex items-center gap-3">
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
 className="w-full bg-app-bg/50 border border-app-text/5 p-5 rounded-2xl text-app-text outline-none focus:border-app-info transition-all focus:ring-4 focus:ring-blue-500/5 placeholder:text-app-text-muted"
 />
 <input
 type="password"
 placeholder="Password"
 value={password}
 onChange={e => setPassword(e.target.value)}
 required
 className="w-full bg-app-bg/50 border border-app-text/5 p-5 rounded-2xl text-app-text outline-none focus:border-app-info transition-all focus:ring-4 focus:ring-blue-500/5 placeholder:text-app-text-muted"
 />
 <button
 type="submit"
 disabled={loading}
 className="w-full bg-blue-600 hover:bg-blue-500 text-app-text p-5 rounded-2xl font-black transition-all shadow-xl shadow-blue-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60"
 >
 {loading ? <Loader2 className="animate-spin" size={20} /> : <><LogIn size={20} /> Sign In</>}
 </button>
 <p className="text-center">
 <button type="button" className="text-sm text-app-text-muted hover:text-app-info transition-colors font-medium">
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
 className="w-full p-5 bg-blue-600/20 border border-app-info/30 rounded-2xl text-app-info font-bold flex items-center justify-center gap-3 hover:bg-blue-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
 >
 <LogIn size={20} /> Client Portal Login
 </button>
 <a href={`/tenant/${slug}/register`}
 className="block text-center text-sm text-app-text-muted hover:text-app-primary transition-colors font-medium">
 New here? <span className="underline">Create an account</span>
 </a>
 </div>
 )
}
