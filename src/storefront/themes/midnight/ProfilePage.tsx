'use client'

import { useState } from 'react'
import { useAuth } from '../../engine/hooks/useAuth'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
import Link from 'next/link'
import {
    User, Mail, Building2, Lock, Eye, EyeOff, Save, CheckCircle2,
    AlertCircle, Shield, ArrowLeft, Fingerprint, KeyRound
} from 'lucide-react'

export default function MidnightProfilePage() {
    const { path, slug } = useStorefrontPath()
    const { user, isAuthenticated } = useAuth()
    const [name, setName] = useState(user?.name || '')
    const [email, setEmail] = useState(user?.email || '')
    const [company, setCompany] = useState('')
    const [currentPass, setCurrentPass] = useState('')
    const [newPass, setNewPass] = useState('')
    const [confirmPass, setConfirmPass] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center space-y-8">
                    <div className="w-24 h-24 bg-app-info/10 border border-app-info/20 rounded-[2rem] flex items-center justify-center mx-auto text-blue-400 rotate-12">
                        <Shield size={48} />
                    </div>
                    <h1 className="text-3xl font-black text-white italic">Session Required</h1>
                    <Link href={path('/login')} className="inline-block px-10 py-4 bg-app-success text-white rounded-2xl font-black text-xs uppercase tracking-widest">Authorize</Link>
                </div>
            </div>
        )
    }

    const handleSave = async () => {
        setSaving(true); setError(''); setMessage('')
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
        const token = localStorage.getItem('portal_token')
        try {
            const body: any = { name, email, company_name: company }
            if (newPass) {
                if (newPass.length < 8) throw new Error('Password must be at least 8 characters')
                if (newPass !== confirmPass) throw new Error('Passwords do not match')
                body.current_password = currentPass
                body.new_password = newPass
            }
            const res = await fetch(`${djangoUrl}/api/client-portal/profile/`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
                body: JSON.stringify(body),
            })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed') }
            setMessage('Profile updated successfully')
            setCurrentPass(''); setNewPass(''); setConfirmPass('')
        } catch (err: any) { setError(err.message) } finally { setSaving(false) }
    }

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] left-[-10%] w-[60%] h-[60%] bg-app-info/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-4xl mx-auto relative z-10 space-y-10">
                <div className="space-y-4">
                    <Link href={path('/account')} className="inline-flex items-center gap-2 text-app-muted-foreground hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
                    </Link>
                    <h1 className="text-5xl font-black text-white italic tracking-tighter">Identity <span className="text-blue-400">Control</span></h1>
                </div>

                {message && <div className="p-4 bg-app-success/10 border border-app-success/20 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-3"><CheckCircle2 size={16} />{message}</div>}
                {error && <div className="p-4 bg-app-error/10 border border-app-error/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-3"><AlertCircle size={16} />{error}</div>}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 text-white/5"><Fingerprint size={120} /></div>
                        <h2 className="text-lg font-black text-white italic relative z-10">Personal Data</h2>
                        <div className="space-y-4 relative z-10">
                            <div className="relative">
                                <User size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input type="text" value={name} onChange={e => setName(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-5 py-4 rounded-2xl text-white outline-none focus:border-app-info transition-all font-medium" placeholder="Full Name" />
                            </div>
                            <div className="relative">
                                <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-5 py-4 rounded-2xl text-white outline-none focus:border-app-info transition-all font-medium" placeholder="Email" />
                            </div>
                            <div className="relative">
                                <Building2 size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-5 py-4 rounded-2xl text-white outline-none focus:border-app-info transition-all font-medium" placeholder="Company (optional)" />
                            </div>
                        </div>
                    </div>

                    <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 text-white/5"><KeyRound size={120} /></div>
                        <h2 className="text-lg font-black text-white italic relative z-10">Security Credentials</h2>
                        <div className="space-y-4 relative z-10">
                            <div className="relative">
                                <Lock size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input type={showPass ? 'text' : 'password'} value={currentPass} onChange={e => setCurrentPass(e.target.value)}
                                    className="w-full bg-slate-950/60 border border-white/5 pl-12 pr-14 py-4 rounded-2xl text-white outline-none focus:border-app-info transition-all font-medium" placeholder="Current Password" />
                                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-5 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-white transition-colors">
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <input type={showPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
                                className="w-full bg-slate-950/60 border border-white/5 px-5 py-4 rounded-2xl text-white outline-none focus:border-app-info transition-all font-medium" placeholder="New Password (min 8 chars)" />
                            <input type={showPass ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                                className="w-full bg-slate-950/60 border border-white/5 px-5 py-4 rounded-2xl text-white outline-none focus:border-app-info transition-all font-medium" placeholder="Confirm New Password" />
                        </div>
                    </div>
                </div>

                <button onClick={handleSave} disabled={saving}
                    className="w-full bg-app-info hover:bg-app-info text-white p-5 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 disabled:opacity-60 shadow-xl shadow-blue-900/30">
                    {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save size={18} /> Update Identity</>}
                </button>
            </div>
        </div>
    )
}
