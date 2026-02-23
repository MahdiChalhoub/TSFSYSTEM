'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '../../engine/hooks/useAuth'
import Link from 'next/link'
import {
    User, Mail, Building2, Lock, Eye, EyeOff, Save, CheckCircle2,
    AlertCircle, Shield, ArrowLeft, Fingerprint, KeyRound
} from 'lucide-react'

export default function MidnightProfilePage() {
    const { slug } = useParams<{ slug: string }>()
    const { user, isAuthenticated } = useAuth()

    const [name, setName] = useState(user?.name || '')
    const [email] = useState(user?.email || '')
    const [company, setCompany] = useState('')

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPasswords, setShowPasswords] = useState(false)

    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')

    const [pwSaving, setPwSaving] = useState(false)
    const [pwSaved, setPwSaved] = useState(false)
    const [pwError, setPwError] = useState('')

    const handleSaveProfile = async () => {
        setSaving(true); setError('')
        try {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
            const token = localStorage.getItem('portal_token')
            const res = await fetch(`${djangoUrl}/api/client-portal/profile/update/`, {
                method: 'PATCH',
                headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, company }),
            })
            if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
            else { const data = await res.json().catch(() => null); setError(data?.error || 'Failed to update profile') }
        } catch { setError('Network error') }
        setSaving(false)
    }

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
        if (newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return }
        setPwSaving(true); setPwError('')
        try {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
            const token = localStorage.getItem('portal_token')
            const res = await fetch(`${djangoUrl}/api/client-portal/profile/change-password/`, {
                method: 'POST',
                headers: { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
            })
            if (res.ok) { setPwSaved(true); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setTimeout(() => setPwSaved(false), 3000) }
            else { const data = await res.json().catch(() => null); setPwError(data?.error || 'Failed to change password') }
        } catch { setPwError('Network error') }
        setPwSaving(false)
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center space-y-8">
                    <div className="w-24 h-24 bg-cyan-500/10 border border-cyan-500/20 rounded-[2rem] flex items-center justify-center mx-auto text-cyan-400 rotate-12"><Shield size={48} /></div>
                    <h1 className="text-3xl font-black text-white italic tracking-tighter">Identity Verification Required</h1>
                    <Link href={`/tenant/${slug}/login`} className="inline-block px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Authorize</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 p-6 lg:p-12 relative overflow-hidden">
            <div className="fixed top-[-10%] right-[-10%] w-[60%] h-[60%] bg-cyan-500/5 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-3xl mx-auto relative z-10 space-y-10">
                <div className="space-y-4">
                    <Link href={`/tenant/${slug}/account`} className="inline-flex items-center gap-2 text-slate-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-all group">
                        <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Dashboard
                    </Link>
                    <h1 className="text-5xl font-black text-white italic tracking-tighter">Identity <span className="text-cyan-400">Control</span></h1>
                </div>

                {/* Profile Card */}
                <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 text-white/5"><Fingerprint size={120} /></div>
                    <h2 className="text-white font-black italic text-lg flex items-center gap-3 relative z-10">
                        <User size={20} className="text-emerald-400" /> Personal Data
                    </h2>

                    <div className="space-y-5 relative z-10">
                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] block mb-2">Display Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                className="w-full bg-slate-950/60 border border-white/5 text-white px-6 py-4 rounded-2xl outline-none focus:border-emerald-500 transition-all font-medium" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] block mb-2">Identity Endpoint</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700" />
                                <input type="email" value={email} readOnly
                                    className="w-full bg-slate-950/40 border border-white/5 text-slate-600 pl-14 pr-6 py-4 rounded-2xl outline-none cursor-not-allowed" />
                            </div>
                            <p className="text-slate-700 text-[9px] mt-2 font-bold uppercase tracking-widest">Immutable — contact admin for modification</p>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] block mb-2">Organization</label>
                            <div className="relative">
                                <Building2 size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-700" />
                                <input type="text" value={company} onChange={e => setCompany(e.target.value)} placeholder="Entity name"
                                    className="w-full bg-slate-950/60 border border-white/5 text-white pl-14 pr-6 py-4 rounded-2xl outline-none focus:border-emerald-500 transition-all placeholder:text-slate-800 font-medium" />
                            </div>
                        </div>
                    </div>

                    {error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-3"><AlertCircle size={16} />{error}</div>}

                    <button onClick={handleSaveProfile} disabled={saving}
                        className="w-full flex items-center justify-center gap-3 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-40 shadow-xl shadow-emerald-900/30">
                        {saved ? <><CheckCircle2 size={18} /> Committed!</> : saving ? 'Synchronizing...' : <><Save size={18} /> Commit Changes</>}
                    </button>
                </div>

                {/* Security Card */}
                <div className="p-10 bg-slate-900/40 border border-white/5 rounded-[3rem] space-y-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-6 text-white/5"><KeyRound size={120} /></div>
                    <div className="flex items-center justify-between relative z-10">
                        <h2 className="text-white font-black italic text-lg flex items-center gap-3">
                            <Lock size={20} className="text-amber-400" /> Security Token Update
                        </h2>
                        <button onClick={() => setShowPasswords(!showPasswords)} className="text-slate-600 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/5">
                            {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <div className="space-y-5 relative z-10">
                        <div>
                            <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] block mb-2">Current Token</label>
                            <input type={showPasswords ? 'text' : 'password'} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password"
                                className="w-full bg-slate-950/60 border border-white/5 text-white px-6 py-4 rounded-2xl outline-none focus:border-amber-500 transition-all placeholder:text-slate-800 font-medium" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] block mb-2">New Token</label>
                                <input type={showPasswords ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 chars"
                                    className="w-full bg-slate-950/60 border border-white/5 text-white px-6 py-4 rounded-2xl outline-none focus:border-amber-500 transition-all placeholder:text-slate-800 font-medium" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] block mb-2">Confirm Token</label>
                                <input type={showPasswords ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter"
                                    className="w-full bg-slate-950/60 border border-white/5 text-white px-6 py-4 rounded-2xl outline-none focus:border-amber-500 transition-all placeholder:text-slate-800 font-medium" />
                            </div>
                        </div>
                    </div>

                    {pwError && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-3"><AlertCircle size={16} />{pwError}</div>}

                    <button onClick={handleChangePassword} disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
                        className="w-full flex items-center justify-center gap-3 py-5 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all disabled:opacity-40 shadow-xl shadow-amber-900/30">
                        {pwSaved ? <><CheckCircle2 size={18} /> Token Updated!</> : pwSaving ? 'Processing...' : <><Lock size={18} /> Rotate Security Token</>}
                    </button>
                </div>
            </div>
        </div>
    )
}
