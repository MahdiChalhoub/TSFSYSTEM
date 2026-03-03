'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, UserPlus, Store, Shield } from 'lucide-react'
import { useAuth } from '../../engine/hooks/useAuth'
import { useConfig } from '../../engine/hooks/useConfig'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'

export default function MidnightLoginPage() {
    const { path, slug } = useStorefrontPath()
    const router = useRouter()
    const { login, isAuthenticated } = useAuth()
    const { orgName, orgLogo } = useConfig()

    const [mode, setMode] = useState<'login' | 'register'>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    if (isAuthenticated) {
        router.push(path('/account'))
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const result = await login(email, password)
        if (result.success) {
            router.push(path('/account'))
        } else {
            setError(result.error || 'Login failed')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo & Brand */}
                <div className="text-center mb-10 space-y-4">
                    {orgLogo ? (
                        <img src={orgLogo} alt={orgName} className="w-20 h-20 rounded-[2rem] mx-auto border border-white/10 shadow-2xl scale-110 mb-4" />
                    ) : (
                        <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-[2rem] flex items-center justify-center text-emerald-400 mx-auto shadow-2xl shadow-emerald-500/10 mb-4">
                            <Store size={32} />
                        </div>
                    )}
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">{orgName || slug}</h1>
                    <p className="text-app-text-faint text-xs font-black uppercase tracking-[0.3em]">Accessing Commerce Stream</p>
                </div>

                {/* Form Card */}
                <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 rounded-[3rem] p-10 shadow-2xl space-y-8">
                    {error && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs font-bold text-rose-400 animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="text-[10px] text-app-text-faint font-black uppercase tracking-widest block mb-2 ml-2 flex items-center gap-2">
                                <Mail size={10} className="text-emerald-500" /> Identity Endpoint
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="you@identity.com"
                                    required
                                    className="w-full bg-slate-950/60 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-emerald-500 transition-all placeholder:text-app-text font-medium"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-app-text-faint font-black uppercase tracking-widest block mb-2 ml-2 flex items-center gap-2">
                                <Lock size={10} className="text-emerald-500" /> Security Token
                            </label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-slate-950/60 border border-white/5 rounded-2xl px-6 py-4 text-sm text-white outline-none focus:border-emerald-500 transition-all placeholder:text-app-text font-medium pr-14"
                                />
                                <button type="button" onClick={() => setShowPass(!showPass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-white transition-colors">
                                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3">
                            {loading ? (
                                <><Loader2 size={20} className="animate-spin" /> Authenticating...</>
                            ) : (
                                <><LogIn size={20} /> Authorize Session</>
                            )}
                        </button>
                    </form>

                    <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/5">
                        <Link href={path('/register')} className="text-xs text-emerald-400 font-black uppercase tracking-widest hover:text-emerald-300 transition-colors flex items-center gap-2">
                            <UserPlus size={14} /> Initialize New Identity
                        </Link>
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
                            <Shield size={12} className="text-emerald-500" />
                            <span className="text-[9px] text-app-text-faint font-black uppercase tracking-widest">Protocol Active</span>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-10">
                    <Link href={path('/')} className="text-[10px] font-black uppercase tracking-widest text-app-text-muted hover:text-white transition-colors">
                        ← Terminate & Return to Node
                    </Link>
                </div>
            </div>
        </div>
    )
}
