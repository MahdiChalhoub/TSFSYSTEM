'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
 ArrowLeft, User, Mail, Building2, Lock, Eye, EyeOff,
 Save, CheckCircle2, AlertCircle, Shield, Tag
} from 'lucide-react'

interface SupplierSession {
 token: string
 user: { id: string; email: string; name: string }
 contact: { id: string; name: string; company: string; supplier_category: string }
 organization: { id: string; name: string; slug: string }
 permissions: string[]
}

function getSession(slug: string): SupplierSession | null {
 if (typeof window === 'undefined') return null
 try {
 const raw = localStorage.getItem('supplier_session')
 if (!raw) return null
 const s = JSON.parse(raw) as SupplierSession
 if (s.organization.slug !== slug) return null
 return s
 } catch { return null }
}

export default function SupplierProfilePage() {
 const { slug } = useParams<{ slug: string }>()
 const [session, setSession] = useState<SupplierSession | null>(null)

 useEffect(() => { setSession(getSession(slug)) }, [slug])

 // Personal Info
 const [name, setName] = useState('')
 const [email, setEmail] = useState('')
 const [company, setCompany] = useState('')
 const [saving, setSaving] = useState(false)
 const [saved, setSaved] = useState(false)
 const [error, setError] = useState('')

 // Password
 const [currentPassword, setCurrentPassword] = useState('')
 const [newPassword, setNewPassword] = useState('')
 const [confirmPassword, setConfirmPassword] = useState('')
 const [showPasswords, setShowPasswords] = useState(false)
 const [pwSaving, setPwSaving] = useState(false)
 const [pwSaved, setPwSaved] = useState(false)
 const [pwError, setPwError] = useState('')

 useEffect(() => {
 if (session) {
 setName(session.user.name || '')
 setEmail(session.user.email || '')
 setCompany(session.contact.company || '')
 }
 }, [session])

 const handleSaveProfile = async () => {
 if (!session) return
 setSaving(true); setError(''); setSaved(false)
 try {
 const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
 const res = await fetch(`${djangoUrl}/api/supplier-portal/profile/update/`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Token ${session.token}`,
 },
 body: JSON.stringify({ name, company }),
 })
 if (!res.ok) throw new Error('Failed to update profile')
 setSaved(true)
 setTimeout(() => setSaved(false), 3000)
 } catch (err: any) {
 setError(err.message)
 } finally {
 setSaving(false)
 }
 }

 const handleChangePassword = async () => {
 if (!session) return
 setPwError('')
 if (newPassword.length < 8) { setPwError('Password must be at least 8 characters'); return }
 if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
 setPwSaving(true); setPwSaved(false)
 try {
 const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://backend:8000'
 const res = await fetch(`${djangoUrl}/api/supplier-portal/profile/change-password/`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Token ${session.token}`,
 },
 body: JSON.stringify({
 current_password: currentPassword,
 new_password: newPassword,
 }),
 })
 if (!res.ok) {
 const data = await res.json()
 throw new Error(data.error || 'Failed to change password')
 }
 setPwSaved(true)
 setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
 setTimeout(() => setPwSaved(false), 3000)
 } catch (err: any) {
 setPwError(err.message)
 } finally {
 setPwSaving(false)
 }
 }

 if (!session) {
 return (
 <div className="min-h-screen bg-[#020617] flex items-center justify-center p-6">
 <div className="text-center space-y-4">
 <h1 className="text-2xl font-bold text-white">Session expired</h1>
 <Link href={`/supplier-portal/${slug}`} className="text-indigo-400 font-bold">Go to Login</Link>
 </div>
 </div>
 )
 }

 return (
 <div className="min-h-screen bg-[#020617] p-4 lg:p-12 relative">
 <div className="fixed bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[150px] rounded-full pointer-events-none z-0" />

 <div className="max-w-3xl mx-auto relative z-10 space-y-8">
 <div className="space-y-2">
 <Link href={`/supplier-portal/${slug}`}
 className="inline-flex items-center gap-2 text-app-text-muted hover:text-white text-sm font-medium transition-colors">
 <ArrowLeft size={16} /> Dashboard
 </Link>
 <h1 className="text-4xl font-black text-white">Profile & Settings</h1>
 <p className="text-app-text-muted text-sm">Manage your account information and security</p>
 </div>

 {/* Supplier Info Badge */}
 <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center gap-4">
 <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 text-xl font-black">
 {session.user.name?.charAt(0).toUpperCase() || 'S'}
 </div>
 <div className="flex-1">
 <p className="text-white font-bold">{session.contact.company || session.contact.name}</p>
 <div className="flex items-center gap-3 mt-1">
 <span className="text-[10px] text-indigo-400 font-black uppercase tracking-widest flex items-center gap-1">
 <Tag size={10} /> {session.contact.supplier_category || 'Supplier'}
 </span>
 <span className="text-[10px] text-app-text-muted font-bold">{session.organization.name}</span>
 </div>
 </div>
 </div>

 {/* Personal Information */}
 <div className="p-8 bg-slate-900/60 border border-white/5 rounded-3xl space-y-6">
 <h2 className="text-lg font-bold text-white flex items-center gap-3">
 <User size={20} className="text-indigo-400" /> Contact Information
 </h2>

 {error && (
 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
 <AlertCircle size={16} /> {error}
 </div>
 )}
 {saved && (
 <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
 <CheckCircle2 size={16} /> Profile updated successfully
 </div>
 )}

 <div className="space-y-4">
 <div>
 <label className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
 <User size={12} /> Full Name
 </label>
 <input value={name} onChange={e => setName(e.target.value)}
 className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-indigo-500 transition-all" />
 </div>
 <div>
 <label className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
 <Mail size={12} /> Email
 </label>
 <input value={email} disabled
 className="w-full bg-slate-950/30 border border-white/5 p-4 rounded-xl text-app-text-muted cursor-not-allowed" />
 <p className="text-[10px] text-app-text-muted mt-1">Contact admin to change email</p>
 </div>
 <div>
 <label className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 flex items-center gap-1.5">
 <Building2 size={12} /> Company
 </label>
 <input value={company} onChange={e => setCompany(e.target.value)}
 className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-indigo-500 transition-all" />
 </div>
 </div>

 <button onClick={handleSaveProfile} disabled={saving}
 className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-60">
 <Save size={18} /> {saving ? 'Saving...' : 'Save Changes'}
 </button>
 </div>

 {/* Change Password */}
 <div className="p-8 bg-slate-900/60 border border-white/5 rounded-3xl space-y-6">
 <h2 className="text-lg font-bold text-white flex items-center gap-3">
 <Lock size={20} className="text-amber-400" /> Change Password
 </h2>

 {pwError && (
 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
 <AlertCircle size={16} /> {pwError}
 </div>
 )}
 {pwSaved && (
 <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
 <CheckCircle2 size={16} /> Password changed successfully
 </div>
 )}

 <div className="space-y-4">
 <div className="relative">
 <label className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 block">Current Password</label>
 <input type={showPasswords ? 'text' : 'password'} value={currentPassword}
 onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••"
 className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-700 pr-12" />
 </div>
 <div>
 <label className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 block">New Password</label>
 <input type={showPasswords ? 'text' : 'password'} value={newPassword}
 onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters"
 className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-700" />
 </div>
 <div>
 <label className="text-[10px] text-app-text-muted font-black uppercase tracking-widest mb-2 block">Confirm New Password</label>
 <input type={showPasswords ? 'text' : 'password'} value={confirmPassword}
 onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password"
 className="w-full bg-slate-950/50 border border-white/5 p-4 rounded-xl text-white outline-none focus:border-amber-500 transition-all placeholder:text-slate-700" />
 </div>
 </div>

 <div className="flex items-center justify-between">
 <button onClick={() => setShowPasswords(!showPasswords)}
 className="text-sm text-app-text-muted hover:text-white flex items-center gap-2 transition-colors">
 {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
 {showPasswords ? 'Hide' : 'Show'} passwords
 </button>
 <Shield size={16} className="text-slate-700" />
 </div>

 <button onClick={handleChangePassword} disabled={pwSaving || !currentPassword || !newPassword}
 className="w-full bg-amber-600 hover:bg-amber-500 text-white p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-3 disabled:opacity-60">
 <Lock size={18} /> {pwSaving ? 'Changing...' : 'Change Password'}
 </button>
 </div>
 </div>
 </div>
 )
}
