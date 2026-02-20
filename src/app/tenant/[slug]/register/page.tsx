'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    UserPlus, Loader2, AlertCircle, CheckCircle2, Mail, Lock,
    User, Building2, ArrowLeft, Shield, Eye, EyeOff
} from 'lucide-react'

export default function RegisterPage() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [company, setCompany] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password.length < 8) {
            setError('Password must be at least 8 characters')
            return
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setLoading(true)
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        try {
            const res = await fetch(`${djangoUrl}/api/client-portal/register/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    company,
                    password,
                    organization_slug: slug,
                }),
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || data.detail || 'Registration failed')
            }
            setSuccess(true)
        } catch (err: any) {
            setError(err.message || 'Network error')
        } finally {
            setLoading(false)
        }
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative">
                <div className="fixed top-[-15%] left-[20%] w-[60%] h-[50%] bg-emerald-500/10 blur-[200px] rounded-full pointer-events-none z-0" />

                <div className="w-full max-w-md relative z-10 space-y-8 text-center">
                    <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto">
                        <CheckCircle2 size={36} className="text-emerald-400" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-3xl font-black text-white">Account Created!</h1>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Welcome, <span className="text-white font-bold">{name}</span>! Your account has been created.
                            You can now sign in to access your dashboard, browse products, and place orders.
                        </p>
                    </div>
                    <Link href={`/tenant/${slug}`}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98]">
                        <ArrowLeft size={20} /> Go to Store & Sign In
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6 relative">
            {/* Ambient */}
            <div className="fixed top-[-15%] left-[20%] w-[60%] h-[50%] bg-emerald-500/10 blur-[200px] rounded-full pointer-events-none z-0" />
            <div className="fixed bottom-[-10%] right-[10%] w-[40%] h-[40%] bg-blue-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="w-full max-w-md relative z-10 space-y-8">
                {/* Brand */}
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto text-emerald-400">
                        <UserPlus size={36} />
                    </div>
                    <h1 className="text-3xl font-black text-white">Create Account</h1>
                    <p className="text-slate-500 text-sm">
                        Join <span className="text-white font-bold">{slug}</span> as a client
                    </p>
                </div>

                {/* Form */}
                <div className="p-10 bg-slate-900/50 backdrop-blur-3xl border border-white/5 rounded-[3rem] space-y-6 shadow-2xl">
                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-medium flex items-center gap-3">
                            <AlertCircle size={18} className="shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <User size={10} /> Full Name
                            </label>
                            <input
                                type="text"
                                placeholder="John Doe"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Mail size={10} /> Email Address
                            </label>
                            <input
                                type="email"
                                placeholder="john@company.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Building2 size={10} /> Company <span className="text-slate-700 font-normal normal-case">(optional)</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Acme Corp"
                                value={company}
                                onChange={e => setCompany(e.target.value)}
                                className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Lock size={10} /> Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Min 8 characters"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-700 pr-14"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 block">
                                Confirm Password
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Repeat password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                className="w-full bg-slate-950/50 border border-white/5 p-5 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-700"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={20} /> Create Account</>}
                        </button>
                    </form>

                    <div className="text-center space-y-3">
                        <p className="text-slate-500 text-sm">
                            Already have an account?{' '}
                            <Link href={`/tenant/${slug}`} className="text-emerald-400 font-bold hover:text-emerald-300 transition-colors">
                                Sign In
                            </Link>
                        </p>
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                            <Shield size={12} className="inline mr-1" /> Encrypted Connection
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
