'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff, UserPlus, Store } from 'lucide-react'
import { useAuth, useConfig } from '../../engine/hooks'

export default function MidnightLoginPage() {
    const { slug } = useParams<{ slug: string }>()
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
        router.push(`/tenant/${slug}/dashboard`)
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        const result = await login(email, password)
        if (result.success) {
            router.push(`/tenant/${slug}/dashboard`)
        } else {
            setError(result.error || 'Login failed')
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    {orgLogo ? (
                        <img src={orgLogo} alt={orgName} className="w-16 h-16 rounded-2xl mx-auto mb-4 border border-white/10" />
                    ) : (
                        <div className="w-16 h-16 bg-app-success/20 border border-app-success/30 rounded-2xl flex items-center justify-center text-emerald-400 mx-auto mb-4">
                            <Store size={28} />
                        </div>
                    )}
                    <h1 className="text-2xl font-black text-white">{orgName}</h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Sign in to your account</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="bg-slate-900/40 border border-white/5 rounded-2xl p-8 space-y-5">
                    <div>
                        <label className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-wider block mb-1">Email</label>
                        <div className="relative">
                            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full bg-slate-950/60 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white outline-none focus:border-app-success/30 placeholder:text-app-foreground"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-wider block mb-1">Password</label>
                        <div className="relative">
                            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                type={showPass ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-slate-950/60 border border-white/5 rounded-xl pl-11 pr-11 py-3 text-sm text-white outline-none focus:border-app-success/30 placeholder:text-app-foreground"
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-muted-foreground">
                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-app-error/10 border border-app-error/20 rounded-xl p-3 text-xs text-red-400">{error}</div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 bg-app-success text-white rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-app-success transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Signing in...</>
                        ) : (
                            <><LogIn size={16} /> Sign In</>
                        )}
                    </button>

                    <div className="text-center pt-2">
                        <Link href={`/tenant/${slug}/register`} className="text-xs text-emerald-400 hover:underline flex items-center justify-center gap-1">
                            <UserPlus size={12} /> Create an account
                        </Link>
                    </div>
                </form>

                <div className="text-center mt-6">
                    <Link href={`/tenant/${slug}`} className="text-xs text-app-muted-foreground hover:text-app-muted-foreground transition-colors">
                        ← Back to store
                    </Link>
                </div>
            </div>
        </div>
    )
}
