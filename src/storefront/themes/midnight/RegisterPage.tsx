'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    UserPlus, Loader2, AlertCircle, CheckCircle2, Mail, Lock,
    User, Building2, ArrowLeft, Shield, Eye, EyeOff
} from 'lucide-react'
import { useConfig } from '../../engine/hooks/useConfig'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'

export default function MidnightRegisterPage() {
    const { path, slug } = useStorefrontPath()
    const router = useRouter()
    const { orgName } = useConfig()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [company, setCompany] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (password.length < 8) { setError('Password must have minimum 8 characters'); return }
        if (password !== confirm) { setError('Passwords do not match'); return }
        setLoading(true)

        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        try {
            const res = await fetch(`${djangoUrl}/api/client-portal/register/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': slug },
                body: JSON.stringify({ name, email, password, company_name: company }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || data.detail || 'Registration failed')
            setSuccess(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
                <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-app-success/5 blur-[150px] rounded-full pointer-events-none" />
                <div className="max-w-md w-full text-center space-y-10 relative z-10">
                    <div className="w-24 h-24 bg-app-success/10 border border-app-success/20 rounded-[2rem] flex items-center justify-center mx-auto text-emerald-400 shadow-2xl shadow-emerald-500/20">
                        <CheckCircle2 size={48} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black text-white italic tracking-tighter">Identity <span className="text-app-success">Created</span></h1>
                        <p className="text-app-muted-foreground text-sm leading-relaxed">Your account has been provisioned. Proceed to authentication.</p>
                    </div>
                    <Link href={path('/login')}
                        className="inline-flex items-center gap-3 px-10 py-5 bg-app-success text-white rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-app-success shadow-xl shadow-emerald-900/30 transition-all">
                        Authorize Session
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500/5 blur-[150px] rounded-full pointer-events-none" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-app-success/5 blur-[150px] rounded-full pointer-events-none" />

            <div className="max-w-md w-full relative z-10">
                <div className="text-center mb-12 space-y-4">
                    <div className="w-20 h-20 bg-purple-500/10 border border-purple-500/20 rounded-[2rem] flex items-center justify-center mx-auto text-purple-400 shadow-2xl shadow-purple-500/10 rotate-6">
                        <UserPlus size={36} />
                    </div>
                    <h1 className="text-4xl font-black text-white italic tracking-tighter">Initialize <span className="text-purple-400">Identity</span></h1>
                    <p className="text-app-muted-foreground text-xs font-bold uppercase tracking-widest">{orgName || slug}</p>
                </div>

                <div className="p-10 bg-slate-900/60 border border-white/5 rounded-[3rem] space-y-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 text-purple-500/5"><Shield size={120} /></div>

                    {error && (
                        <div className="p-4 bg-app-error/10 border border-app-error/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-3 relative z-10">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                        <div className="relative">
                            <User size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required
                                className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-5 py-4 rounded-2xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-app-foreground font-medium" />
                        </div>
                        <div className="relative">
                            <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
                                className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-5 py-4 rounded-2xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-app-foreground font-medium" />
                        </div>
                        <div className="relative">
                            <Building2 size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input type="text" placeholder="Company (optional)" value={company} onChange={e => setCompany(e.target.value)}
                                className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-5 py-4 rounded-2xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-app-foreground font-medium" />
                        </div>
                        <div className="relative">
                            <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input type={showPass ? 'text' : 'password'} placeholder="Password (min 8 chars)" value={password} onChange={e => setPassword(e.target.value)} required
                                className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-14 py-4 rounded-2xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-app-foreground font-medium" />
                            <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-5 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-white transition-colors">
                                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <div className="relative">
                            <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input type={showPass ? 'text' : 'password'} placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                                className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-5 py-4 rounded-2xl text-white outline-none focus:border-purple-500 transition-all placeholder:text-app-foreground font-medium" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-xl shadow-purple-900/30">
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <><UserPlus size={20} /> Create Identity</>}
                        </button>
                    </form>

                    <div className="text-center pt-4 border-t border-white/5 relative z-10">
                        <span className="text-app-muted-foreground text-xs">Already have an account?</span>
                        <Link href={path('/login')} className="text-emerald-400 font-black uppercase tracking-widest hover:text-emerald-300 transition-colors ml-1 text-xs">
                            Sign In
                        </Link>
                    </div>
                </div>

                <div className="text-center mt-10">
                    <Link href={path('/')} className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground hover:text-white transition-colors flex items-center justify-center gap-2">
                        <ArrowLeft size={12} /> Return to Storefront
                    </Link>
                </div>
            </div>
        </div>
    )
}
