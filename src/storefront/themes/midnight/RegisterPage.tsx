'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    UserPlus, Loader2, AlertCircle, CheckCircle2, Mail, Lock,
    User, Building2, ArrowLeft, Shield, Eye, EyeOff
} from 'lucide-react'
import { useConfig } from '../../engine/hooks/useConfig'

export default function MidnightRegisterPage() {
    const { slug } = useParams<{ slug: string }>()
    const router = useRouter()
    const { orgName } = useConfig()

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
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
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

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative">
                <div className="fixed top-[-15%] left-[20%] w-[60%] h-[50%] bg-emerald-500/10 blur-[200px] rounded-full pointer-events-none z-0" />

                <div className="w-full max-w-md relative z-10 space-y-8 text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40 rotate-12">
                        <CheckCircle2 size={48} className="text-white" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl font-black text-white tracking-tighter italic">Welcome to the Node!</h1>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            Account <span className="text-white font-bold">{name}</span> has been established.
                            You can now access the commerce stream.
                        </p>
                    </div>
                    <Link href={`/tenant/${slug}/login`}
                        className="inline-flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-xs">
                        Proceed to Login <ArrowLeft size={16} className="rotate-180" />
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-lg relative z-10">
                <div className="text-center space-y-4 mb-8">
                    <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-500/30 rounded-3xl flex items-center justify-center mx-auto text-emerald-400 shadow-2xl shadow-emerald-500/10">
                        <UserPlus size={36} />
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">Secure <span className="text-emerald-500">Registration</span></h1>
                    <p className="text-slate-500 text-xs font-black uppercase tracking-[0.2em]">
                        Joining Identity Node: {orgName || slug}
                    </p>
                </div>

                <div className="bg-slate-900/40 backdrop-blur-3xl border border-white/5 p-10 rounded-[3rem] shadow-2xl space-y-8">
                    {error && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle size={18} className="shrink-0" /> {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ml-2">
                                <User size={10} className="text-emerald-500" /> Full Name
                            </label>
                            <input
                                type="text"
                                placeholder="John Doe"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                required
                                className="w-full bg-slate-950/60 border border-white/5 px-6 py-4 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-800 text-sm font-medium"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ml-2">
                                <Mail size={10} className="text-emerald-500" /> Communication Endpoint
                            </label>
                            <input
                                type="email"
                                placeholder="john@company.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full bg-slate-950/60 border border-white/5 px-6 py-4 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-800 text-sm font-medium"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ml-2">
                                <Building2 size={10} className="text-emerald-500" /> Organization Asset
                            </label>
                            <input
                                type="text"
                                placeholder="Your Company Name"
                                value={company}
                                onChange={e => setCompany(e.target.value)}
                                className="w-full bg-slate-950/60 border border-white/5 px-6 py-4 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-800 text-sm font-medium"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-1.5 ml-2">
                                <Lock size={10} className="text-emerald-500" /> Access Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    className="w-full bg-slate-950/60 border border-white/5 px-6 py-4 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-800 text-sm font-medium pr-14"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-2 block ml-2">
                                Verify Access Key
                            </label>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                className="w-full bg-slate-950/60 border border-white/5 px-6 py-4 rounded-2xl text-white outline-none focus:border-emerald-500 transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-800 text-sm font-medium"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="md:col-span-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-5 rounded-2xl font-black transition-all shadow-xl shadow-emerald-900/40 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-60 uppercase tracking-widest text-xs mt-4"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={20} /> Initialize Account</>}
                        </button>
                    </form>

                    <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/5">
                        <p className="text-slate-500 text-xs">
                            Established entity?{' '}
                            <Link href={`/tenant/${slug}/login`} className="text-emerald-400 font-black uppercase tracking-widest hover:text-emerald-300 transition-colors ml-1">
                                Sign In
                            </Link>
                        </p>
                        <div className="flex items-center gap-2 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
                            <Shield size={12} className="text-emerald-500" />
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">AES-256 Protocol Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
