'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { usePortal } from '@/context/PortalContext'
import {
    User, Mail, Building2, Lock, Eye, EyeOff, Save, CheckCircle2,
    AlertCircle, Shield
} from 'lucide-react'

export default function ProfilePage() {
    const { slug } = useParams<{ slug: string }>()
    const { isAuthenticated, user, contact, token } = usePortal()

    const [name, setName] = useState(user?.name || '')
    const [email, setEmail] = useState(user?.email || '')
    const [company, setCompany] = useState(contact?.company || '')

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
        setSaving(true)
        setError('')
        try {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
            const res = await fetch(`${djangoUrl}/api/client-portal/profile/update/`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, company }),
            })
            if (res.ok) {
                setSaved(true)
                setTimeout(() => setSaved(false), 3000)
            } else {
                const data = await res.json().catch(() => null)
                setError(data?.error || 'Failed to update profile')
            }
        } catch {
            setError('Network error')
        }
        setSaving(false)
    }

    const handleChangePassword = async () => {
        if (newPassword !== confirmPassword) {
            setPwError('Passwords do not match')
            return
        }
        if (newPassword.length < 8) {
            setPwError('Password must be at least 8 characters')
            return
        }
        setPwSaving(true)
        setPwError('')
        try {
            const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
            const res = await fetch(`${djangoUrl}/api/client-portal/profile/change-password/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                }),
            })
            if (res.ok) {
                setPwSaved(true)
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
                setTimeout(() => setPwSaved(false), 3000)
            } else {
                const data = await res.json().catch(() => null)
                setPwError(data?.error || 'Failed to change password')
            }
        } catch {
            setPwError('Network error')
        }
        setPwSaving(false)
    }

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <Shield size={48} className="mx-auto text-slate-600" />
                    <h1 className="text-2xl font-bold text-white">Please log in</h1>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#020617] p-4 lg:p-8 relative">
            <div className="fixed top-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

            <div className="max-w-2xl mx-auto relative z-10 space-y-6">
                <h1 className="text-3xl font-black text-white flex items-center gap-3">
                    <User size={28} className="text-slate-400" /> Profile & Settings
                </h1>

                {/* Profile Info */}
                <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-5">
                    <h2 className="text-white font-bold text-sm flex items-center gap-2">
                        <User size={16} className="text-emerald-400" /> Personal Information
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Full Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)}
                                className="w-full bg-slate-800/60 border border-white/5 text-white px-4 py-3 rounded-xl outline-none focus:border-emerald-500/30 placeholder:text-slate-700" />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Email Address</label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                <input type="email" value={email} readOnly
                                    className="w-full bg-slate-800/40 border border-white/5 text-slate-500 pl-11 pr-4 py-3 rounded-xl outline-none cursor-not-allowed" />
                            </div>
                            <p className="text-slate-600 text-[10px] mt-1">Email cannot be changed. Contact support for assistance.</p>
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Company</label>
                            <div className="relative">
                                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
                                <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                                    placeholder="Your company name"
                                    className="w-full bg-slate-800/60 border border-white/5 text-white pl-11 pr-4 py-3 rounded-xl outline-none focus:border-emerald-500/30 placeholder:text-slate-700" />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <button onClick={handleSaveProfile} disabled={saving}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-40">
                        {saved ? <><CheckCircle2 size={18} /> Saved!</> : saving ? 'Saving...' : <><Save size={18} /> Save Changes</>}
                    </button>
                </div>

                {/* Change Password */}
                <div className="p-6 bg-slate-900/60 border border-white/5 rounded-2xl space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-white font-bold text-sm flex items-center gap-2">
                            <Lock size={16} className="text-amber-400" /> Change Password
                        </h2>
                        <button onClick={() => setShowPasswords(!showPasswords)}
                            className="text-slate-500 hover:text-white transition-colors">
                            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Current Password</label>
                            <input type={showPasswords ? 'text' : 'password'}
                                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password"
                                className="w-full bg-slate-800/60 border border-white/5 text-white px-4 py-3 rounded-xl outline-none focus:border-amber-500/30 placeholder:text-slate-700" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">New Password</label>
                                <input type={showPasswords ? 'text' : 'password'}
                                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Min 8 characters"
                                    className="w-full bg-slate-800/60 border border-white/5 text-white px-4 py-3 rounded-xl outline-none focus:border-amber-500/30 placeholder:text-slate-700" />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Confirm Password</label>
                                <input type={showPasswords ? 'text' : 'password'}
                                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat new password"
                                    className="w-full bg-slate-800/60 border border-white/5 text-white px-4 py-3 rounded-xl outline-none focus:border-amber-500/30 placeholder:text-slate-700" />
                            </div>
                        </div>
                    </div>

                    {pwError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                            <AlertCircle size={16} /> {pwError}
                        </div>
                    )}

                    <button onClick={handleChangePassword}
                        disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
                        className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-all disabled:opacity-40">
                        {pwSaved ? <><CheckCircle2 size={18} /> Password Updated!</> : pwSaving ? 'Updating...' : <><Lock size={18} /> Update Password</>}
                    </button>
                </div>

                {/* Account Info */}
                <div className="p-5 bg-slate-900/40 border border-white/5 rounded-2xl space-y-3">
                    <h3 className="text-xs text-slate-500 font-bold uppercase tracking-widest">Account Info</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-widest">Tier</p>
                            <p className="text-white font-medium">{contact?.tier || 'Standard'}</p>
                        </div>
                        <div>
                            <p className="text-slate-600 text-[10px] uppercase tracking-widest">Loyalty</p>
                            <p className="text-white font-medium">{contact?.loyalty_points || 0} pts</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
