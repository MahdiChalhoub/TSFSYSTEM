'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
    Users, Shield, Search, Loader2, Key, Eye, EyeOff, Plus,
    CheckCircle, XCircle, Clock, UserPlus, RefreshCw,
    Mail, Filter, ChevronRight, AlertTriangle,
    UserCheck, Lock, Unlock, Ban, X, Save,
    Trash2, Link2, Edit3, RotateCcw, Maximize2, Minimize2,
    MessageSquare, Send, AlertCircle, Star, Hash, Activity
} from 'lucide-react'

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

type User = {
    id: number; username: string; email?: string; phone?: string
    first_name: string; last_name: string
    is_active?: boolean; account_status?: string
    registration_channel?: string; registration_status?: string
    role_name?: string; role?: number; date_joined?: string; last_login?: string
    is_superuser?: boolean; is_staff?: boolean
    pos_pin?: boolean; has_override_pin?: boolean
}
type RoleItem = { id: number; name: string }
type LinkedContact = { access_id: number; contact_id: number; contact_name: string; portal_type: string; status: string; relationship_role: string }
type PendingUser = {
    id: number; first_name: string; last_name: string
    email: string; role: string; status: string
    employee_details?: { phone?: string; nationality?: string }
}

type ActiveTab = 'users' | 'pending'

const STATUS_COLORS: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: 'var(--app-success, #10b981)', label: 'Active' },
    PENDING: { color: 'var(--app-warning, #f59e0b)', label: 'Pending' },
    BLOCKED: { color: 'var(--app-error, #ef4444)', label: 'Blocked' },
    SUSPENDED: { color: 'var(--app-warning, #f59e0b)', label: 'Suspended' },
    REJECTED: { color: 'var(--app-error, #ef4444)', label: 'Rejected' },
}

function getStatusInfo(status?: string) {
    return STATUS_COLORS[status || 'ACTIVE'] || STATUS_COLORS.ACTIVE
}

// ══════════════════════════════════════════════════════════════
// User Row
// ══════════════════════════════════════════════════════════════

function UserRow({ u, onEdit, onBlock, onActivate }: {
    u: User; onEdit: (u: User) => void
    onBlock: (u: User) => void; onActivate: (u: User) => void
}) {
    const name = `${u.first_name} ${u.last_name}`.trim() || u.username
    const initial = (u.first_name?.[0] || u.username[0] || '?').toUpperCase()
    const st = getStatusInfo(u.account_status)

    return (
        <div
            className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 md:py-3"
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
            onClick={() => onEdit(u)}
        >
            {/* Avatar */}
            <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-[13px] font-black"
                style={{
                    background: u.is_superuser
                        ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                        : 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                    color: u.is_superuser ? 'white' : 'var(--app-primary)',
                }}
            >
                {initial}
            </div>

            {/* Name + username */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-bold text-app-foreground">{name}</span>
                    {u.is_superuser && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, #f59e0b 10%, transparent)', color: '#f59e0b', border: '1px solid color-mix(in srgb, #f59e0b 20%, transparent)' }}>
                            Admin
                        </span>
                    )}
                    {u.is_staff && !u.is_superuser && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                            Staff
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] font-bold text-app-muted-foreground">@{u.username}</span>
                    {u.role_name && (
                        <span className="text-[10px] font-bold text-app-muted-foreground flex items-center gap-1">
                            <Shield size={9} /> {u.role_name}
                        </span>
                    )}
                </div>
            </div>

            {/* Email */}
            <div className="hidden md:block w-44 flex-shrink-0 text-[11px] text-app-muted-foreground font-bold truncate">
                {u.email || '—'}
            </div>

            {/* Status Badge */}
            <div className="hidden sm:flex w-20 flex-shrink-0">
                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{
                        background: `color-mix(in srgb, ${st.color} 10%, transparent)`,
                        color: st.color,
                        border: `1px solid color-mix(in srgb, ${st.color} 20%, transparent)`,
                    }}>
                    {st.label}
                </span>
            </div>

            {/* POS PIN */}
            <div className="hidden lg:flex w-20 flex-shrink-0">
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={{
                        background: u.pos_pin
                            ? 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)'
                            : 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                        color: u.pos_pin ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)',
                    }}>
                    {u.pos_pin ? <><CheckCircle size={9} /> PIN</> : <><XCircle size={9} /> No PIN</>}
                </span>
            </div>

            {/* Last Login */}
            <div className="hidden xl:block w-24 flex-shrink-0 text-[11px] text-app-muted-foreground font-bold">
                {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
            </div>

            {/* Hover Actions */}
            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => onEdit(u)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                    <Edit3 size={12} />
                </button>
                {(u.account_status === 'ACTIVE' || !u.account_status) && !u.is_superuser && (
                    <button onClick={() => onBlock(u)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors" title="Block">
                        <Ban size={12} />
                    </button>
                )}
                {['BLOCKED', 'SUSPENDED'].includes(u.account_status || '') && (
                    <button onClick={() => onActivate(u)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-success transition-colors" title="Activate">
                        <Unlock size={12} />
                    </button>
                )}
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════
// Edit Drawer
// ══════════════════════════════════════════════════════════════

function EditDrawer({ user, roles, onClose, onRefresh }: {
    user: User; roles: RoleItem[]; onClose: () => void; onRefresh: () => void
}) {
    const [form, setForm] = useState({
        first_name: user.first_name, last_name: user.last_name,
        email: user.email || '', role: user.role || 0,
        account_status: user.account_status || 'ACTIVE',
    })
    const [saving, setSaving] = useState(false)
    const [linkedContacts, setLinkedContacts] = useState<LinkedContact[]>([])
    const [showPwReset, setShowPwReset] = useState(false)
    const [newPw, setNewPw] = useState('')
    const [pinVal, setPinVal] = useState('')
    const [showPin, setShowPin] = useState(false)
    const [settingPin, setSettingPin] = useState(false)
    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
    const name = `${user.first_name} ${user.last_name}`.trim() || user.username

    useEffect(() => {
        erpFetch(`erp/users/${user.id}/linked-contacts/`).then(c => {
            if (Array.isArray(c)) setLinkedContacts(c)
        }).catch(() => {})
    }, [user.id])

    const handleSave = async () => {
        setSaving(true)
        try {
            await erpFetch(`erp/users/${user.id}/`, { method: 'PATCH', body: JSON.stringify({ ...form, role: form.role || null }), headers: { 'Content-Type': 'application/json' } })
            toast.success('User updated'); onRefresh()
        } catch { toast.error('Failed to save') }
        setSaving(false)
    }

    const handleResetPw = async () => {
        if (newPw.length < 4) { toast.error('Min 4 characters'); return }
        try {
            await erpFetch(`erp/users/${user.id}/reset-password/`, { method: 'POST', body: JSON.stringify({ new_password: newPw }), headers: { 'Content-Type': 'application/json' } })
            toast.success('Password reset'); setShowPwReset(false); setNewPw('')
        } catch { toast.error('Failed') }
    }

    const handleSetPin = async () => {
        if (!pinVal || pinVal.length < 4) { toast.error('PIN must be 4+ digits'); return }
        setSettingPin(true)
        try {
            await erpFetch('pos-registers/set-pin/', { method: 'POST', body: JSON.stringify({ user_id: user.id, pin: pinVal }) })
            toast.success('PIN set'); setPinVal('')
        } catch { toast.error('Failed to set PIN') }
        setSettingPin(false)
    }

    const handleDelete = async () => {
        if (!confirm(`Delete user "${name}"?\n\nUsers with transactions will be deactivated instead.`)) return
        try {
            const res = await erpFetch(`erp/users/${user.id}/`, { method: 'DELETE' })
            toast.success(res?.soft_deleted ? res.message : 'User deleted'); onRefresh()
        } catch { toast.error('Failed to delete') }
    }

    const lbl = "text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block"
    const inp = "w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"

    return (
        <>
            <div className="fixed inset-0 z-50 animate-in fade-in duration-150" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
            <div className="fixed top-0 right-0 bottom-0 w-full max-w-[520px] z-51 flex flex-col animate-in slide-in-from-right duration-200"
                style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)' }}>

                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black"
                            style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            {(user.first_name?.[0] || user.username[0]).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">{name}</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">@{user.username} · ID #{user.id}</p>
                        </div>
                    </div>
                    <div className="flex gap-1.5">
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary text-white px-3 py-1.5 rounded-xl transition-all"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-xl text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-5">
                    {/* Basic Info */}
                    <section>
                        <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"><Edit3 size={11} /> Basic Info</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                            <div><label className={lbl}>First Name</label><input className={inp} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
                            <div><label className={lbl}>Last Name</label><input className={inp} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
                        </div>
                        <div className="mt-2"><label className={lbl}>Email</label><input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                    </section>

                    {/* Role & Status */}
                    <section>
                        <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"><Shield size={11} /> Role & Status</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                            <div>
                                <label className={lbl}>Role</label>
                                <select className={inp} value={form.role} onChange={e => set('role', +e.target.value)} disabled={user.is_superuser}>
                                    <option value={0}>— None —</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={lbl}>Status</label>
                                <select className={inp} value={form.account_status} onChange={e => set('account_status', e.target.value)}>
                                    <option value="ACTIVE">Active</option><option value="PENDING">Pending</option>
                                    <option value="BLOCKED">Blocked</option><option value="SUSPENDED">Suspended</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* POS PIN */}
                    <section>
                        <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"><Key size={11} /> POS PIN</h4>
                        <div className="flex items-center gap-2">
                            <input type={showPin ? 'text' : 'password'} placeholder="Enter 4-6 digit PIN" value={pinVal}
                                onChange={e => setPinVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="flex-1 text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none" />
                            <button onClick={() => setShowPin(v => !v)} className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
                                {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                            <button onClick={handleSetPin} disabled={settingPin || pinVal.length < 4}
                                className="text-[10px] font-bold px-3 py-2 rounded-xl text-white disabled:opacity-40 transition-all"
                                style={{ background: 'var(--app-primary)' }}>
                                {settingPin ? <Loader2 size={12} className="animate-spin" /> : 'Set PIN'}
                            </button>
                        </div>
                        <p className="text-[10px] text-app-muted-foreground mt-1 font-bold">
                            Current: {user.pos_pin ? '✅ PIN set' : '❌ No PIN'}{user.has_override_pin ? ' · Manager Override' : ''}
                        </p>
                    </section>

                    {/* Linked Contacts */}
                    <section>
                        <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"><Link2 size={11} /> Linked Contacts</h4>
                        {linkedContacts.length === 0 ? (
                            <p className="text-[11px] font-bold text-app-muted-foreground p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                No CRM contacts linked to this user.
                            </p>
                        ) : linkedContacts.map(lc => (
                            <div key={lc.access_id} className="flex items-center gap-2 p-2.5 rounded-xl mb-1" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                <Users size={12} className="text-app-primary flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-bold text-app-foreground">{lc.contact_name || `Contact #${lc.contact_id}`}</div>
                                    <div className="text-[10px] text-app-muted-foreground font-bold">{lc.portal_type} · {lc.relationship_role}</div>
                                </div>
                            </div>
                        ))}
                    </section>

                    {/* Security */}
                    <section>
                        <h4 className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"><Lock size={11} /> Security</h4>
                        {!showPwReset ? (
                            <button onClick={() => setShowPwReset(true)}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border transition-all"
                                style={{ borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                                <RotateCcw size={12} /> Reset Password
                            </button>
                        ) : (
                            <div className="flex gap-2 items-end">
                                <div className="flex-1"><label className={lbl}>New Password</label><input className={inp} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 4 characters" /></div>
                                <button onClick={handleResetPw} className="text-[10px] font-bold px-3 py-2 rounded-xl text-white" style={{ background: 'var(--app-warning, #f59e0b)' }}>Reset</button>
                                <button onClick={() => { setShowPwReset(false); setNewPw('') }} className="p-2 rounded-xl border border-app-border text-app-muted-foreground"><X size={13} /></button>
                            </div>
                        )}
                    </section>

                    {/* Delete */}
                    <section className="pt-3" style={{ borderTop: '1px solid var(--app-border)' }}>
                        <button onClick={handleDelete}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl transition-all"
                            style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)', color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)' }}>
                            <Trash2 size={12} /> Delete User
                        </button>
                        <p className="text-[10px] text-app-muted-foreground font-bold mt-1">Users with transactions will be deactivated instead.</p>
                    </section>
                </div>
            </div>
        </>
    )
}

// ══════════════════════════════════════════════════════════════
// Create Modal
// ══════════════════════════════════════════════════════════════

function CreateModal({ roles, onClose, onCreated }: { roles: RoleItem[]; onClose: () => void; onCreated: () => void }) {
    const [form, setForm] = useState({ first_name: '', last_name: '', username: '', email: '', password: '', role: 0, account_status: 'ACTIVE' })
    const [saving, setSaving] = useState(false)
    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
    const lbl = "text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block"
    const inp = "w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"

    const handleCreate = async () => {
        if (!form.username || !form.password) { toast.error('Username and password required'); return }
        setSaving(true)
        try {
            await erpFetch('erp/users/', { method: 'POST', body: JSON.stringify({ ...form, role: form.role || undefined }), headers: { 'Content-Type': 'application/json' } })
            toast.success(`User ${form.username} created!`); onCreated()
        } catch (e: any) { toast.error(e?.message || 'Failed') }
        setSaving(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <UserPlus size={15} className="text-white" />
                        </div>
                        <h3 className="text-sm font-black text-app-foreground">Create User</h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all"><X size={16} /></button>
                </div>
                <div className="p-5 space-y-3">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                        <div><label className={lbl}>First Name</label><input className={inp} value={form.first_name} onChange={e => set('first_name', e.target.value)} /></div>
                        <div><label className={lbl}>Last Name</label><input className={inp} value={form.last_name} onChange={e => set('last_name', e.target.value)} /></div>
                    </div>
                    <div><label className={lbl}>Username *</label><input className={inp} value={form.username} onChange={e => set('username', e.target.value)} /></div>
                    <div><label className={lbl}>Email</label><input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
                    <div><label className={lbl}>Password *</label><input className={inp} type="password" value={form.password} onChange={e => set('password', e.target.value)} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                        <div><label className={lbl}>Role</label><select className={inp} value={form.role} onChange={e => set('role', +e.target.value)}><option value={0}>— None —</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
                        <div><label className={lbl}>Status</label><select className={inp} value={form.account_status} onChange={e => set('account_status', e.target.value)}><option value="ACTIVE">Active</option><option value="PENDING">Pending</option></select></div>
                    </div>
                </div>
                <div className="px-5 pb-5 flex gap-2">
                    <button onClick={onClose} className="flex-1 text-[11px] font-bold py-2.5 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-surface transition-all">Cancel</button>
                    <button onClick={handleCreate} disabled={saving}
                        className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2.5 rounded-xl text-white transition-all disabled:opacity-50"
                        style={{ background: 'var(--app-primary)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Create
                    </button>
                </div>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════

export default function AccessUsersPage() {
    const [users, setUsers] = useState<User[]>([])
    const [pending, setPending] = useState<PendingUser[]>([])
    const [roles, setRoles] = useState<RoleItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [activeTab, setActiveTab] = useState<ActiveTab>('users')
    const [focusMode, setFocusMode] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [editUser, setEditUser] = useState<User | null>(null)
    const [processing, setProcessing] = useState<number | null>(null)
    const [correctionTarget, setCorrectionTarget] = useState<PendingUser | null>(null)
    const [correctionNotes, setCorrectionNotes] = useState('')
    const searchRef = useRef<HTMLInputElement>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [uData, rData, pData] = await Promise.all([
                erpFetch('erp/users/'),
                erpFetch('erp/roles/'),
                erpFetch('manager/approvals/pending/').catch(() => []),
            ])
            setUsers(Array.isArray(uData) ? uData : uData?.results ?? [])
            setRoles(Array.isArray(rData) ? rData : rData?.results ?? [])
            setPending(Array.isArray(pData) ? pData : [])
        } catch { toast.error('Failed to load') }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const filtered = useMemo(() => {
        let list = users
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(u => u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || `${u.first_name} ${u.last_name}`.toLowerCase().includes(q))
        }
        if (statusFilter !== 'all') list = list.filter(u => (u.account_status || 'ACTIVE') === statusFilter)
        return list
    }, [users, search, statusFilter])

    const stats = useMemo(() => ({
        total: users.length,
        active: users.filter(u => (u.account_status || 'ACTIVE') === 'ACTIVE').length,
        withPin: users.filter(u => u.pos_pin).length,
        staff: users.filter(u => u.is_staff).length,
        pending: pending.length,
    }), [users, pending])

    const handleBlock = async (u: User) => {
        await erpFetch(`erp/users/${u.id}/`, { method: 'PATCH', body: JSON.stringify({ account_status: 'BLOCKED' }), headers: { 'Content-Type': 'application/json' } })
        toast.success(`${u.first_name || u.username} blocked`); load()
    }
    const handleActivate = async (u: User) => {
        await erpFetch(`erp/users/${u.id}/`, { method: 'PATCH', body: JSON.stringify({ account_status: 'ACTIVE' }), headers: { 'Content-Type': 'application/json' } })
        toast.success(`${u.first_name || u.username} activated`); load()
    }
    const handleApprove = async (id: number) => {
        setProcessing(id)
        try { await erpFetch(`manager/approvals/${id}/approve/`, { method: 'POST' }); toast.success('User approved'); load() }
        catch { toast.error('Approval failed') }
        setProcessing(null)
    }
    const handleReject = async (id: number) => {
        if (!confirm('Reject this registration permanently?')) return
        setProcessing(id)
        try { await erpFetch(`manager/approvals/${id}/reject/`, { method: 'POST' }); toast.success('User rejected'); load() }
        catch { toast.error('Rejection failed') }
        setProcessing(null)
    }
    const submitCorrection = async () => {
        if (!correctionTarget || !correctionNotes.trim()) return
        setProcessing(correctionTarget.id)
        try {
            await erpFetch(`manager/approvals/${correctionTarget.id}/correction/`, { method: 'POST', body: JSON.stringify({ notes: correctionNotes }), headers: { 'Content-Type': 'application/json' } })
            toast.info('Correction requested'); setCorrectionTarget(null); setCorrectionNotes(''); load()
        } catch { toast.error('Failed') }
        setProcessing(null)
    }

    const kpis = [
        { label: 'Total Users', value: stats.total, color: 'var(--app-primary)', icon: <Users size={11} /> },
        { label: 'Active', value: stats.active, color: 'var(--app-success, #22c55e)', icon: <CheckCircle size={11} /> },
        { label: 'POS PIN Set', value: stats.withPin, color: 'var(--app-info, #3b82f6)', icon: <Key size={11} /> },
        { label: 'Staff', value: stats.staff, color: '#8b5cf6', icon: <Shield size={11} /> },
        { label: 'Pending', value: stats.pending, color: 'var(--app-warning, #f59e0b)', icon: <Clock size={11} /> },
    ]

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center"><Users size={14} className="text-white" /></div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Users</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length}/{stats.total}</span>
                        </div>
                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" />
                        </div>
                        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0"><Plus size={12} /><span className="hidden sm:inline">New</span></button>
                        <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0"><Minimize2 size={13} /></button>
                    </div>
                ) : (<>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                <Users size={20} className="text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">User Management</h1>
                                <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                    {stats.total} Users · {stats.active} Active · {stats.withPin} POS PIN
                                    {stats.pending > 0 && <> · <span style={{ color: 'var(--app-warning, #f59e0b)' }}>{stats.pending} Pending</span></>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <button onClick={load} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /><span className="hidden md:inline">Refresh</span>
                            </button>
                            <button onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                <UserPlus size={14} /><span className="hidden sm:inline">New User</span>
                            </button>
                            <button onClick={() => setFocusMode(true)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>

                    {/* KPI Strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        {kpis.map(s => (
                            <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left cursor-pointer"
                                onClick={s.label === 'Pending' && stats.pending > 0 ? () => setActiveTab('pending') : undefined}
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                                <div className="min-w-0">
                                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                    <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tab Strip */}
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                            <button onClick={() => setActiveTab('users')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                style={activeTab === 'users' ? { background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' } : { color: 'var(--app-muted-foreground)' }}>
                                <Users size={12} /> All Users <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black" style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>{stats.total}</span>
                            </button>
                            <button onClick={() => setActiveTab('pending')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                                style={activeTab === 'pending' ? { background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)' } : { color: 'var(--app-muted-foreground)' }}>
                                <Clock size={12} /> Pending
                                {stats.pending > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black text-white animate-pulse" style={{ background: 'var(--app-warning, #f59e0b)' }}>{stats.pending}</span>}
                            </button>
                        </div>

                        {activeTab === 'users' && (
                            <>
                                <div className="flex-1 relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                    <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users... (Ctrl+K)"
                                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                                </div>
                                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                    className="text-[11px] font-bold px-2.5 py-2 rounded-xl border border-app-border/50 bg-app-surface/50 text-app-foreground outline-none">
                                    <option value="all">All Status</option><option value="ACTIVE">Active</option>
                                    <option value="PENDING">Pending</option><option value="BLOCKED">Blocked</option>
                                </select>
                            </>
                        )}
                    </div>
                </>)}
            </div>

            {/* ═══ USERS TAB ═══ */}
            {activeTab === 'users' && (
                <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                    <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                        <div className="w-9 flex-shrink-0" />
                        <div className="flex-1 min-w-0">User</div>
                        <div className="hidden md:block w-44 flex-shrink-0">Email</div>
                        <div className="hidden sm:block w-20 flex-shrink-0">Status</div>
                        <div className="hidden lg:block w-20 flex-shrink-0">POS PIN</div>
                        <div className="hidden xl:block w-24 flex-shrink-0">Last Login</div>
                        <div className="w-20 flex-shrink-0" />
                    </div>
                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                        {loading ? (
                            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
                        ) : filtered.length > 0 ? (
                            filtered.map(u => <UserRow key={u.id} u={u} onEdit={setEditUser} onBlock={handleBlock} onActivate={handleActivate} />)
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                <Users size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                <p className="text-sm font-bold text-app-muted-foreground">No users found</p>
                                <p className="text-[11px] text-app-muted-foreground mt-1 font-bold">{search ? 'Try a different search.' : 'Create your first user to get started.'}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ PENDING TAB ═══ */}
            {activeTab === 'pending' && (
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2">
                    {pending.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <UserCheck size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-foreground">All Clear</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1 font-bold">All identity requests have been processed.</p>
                        </div>
                    ) : (<>
                        <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)' }}>
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                            <p className="text-[11px] text-app-muted-foreground leading-relaxed font-bold">
                                <strong>{pending.length} user{pending.length !== 1 ? 's' : ''}</strong> requested access. Review each profile and approve, reject, or request corrections.
                            </p>
                        </div>
                        {pending.map(u => {
                            const init = `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}`.toUpperCase() || '?'
                            const nm = `${u.first_name} ${u.last_name}`.trim()
                            const isProc = processing === u.id
                            return (
                                <div key={u.id} className="rounded-2xl border overflow-hidden transition-all"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)', borderLeft: '3px solid var(--app-warning, #f59e0b)' }}>
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>{init}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-black text-app-foreground truncate">{nm}</p>
                                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                                <span className="text-[10px] text-app-muted-foreground font-bold flex items-center gap-1"><Mail size={10} /> {u.email}</span>
                                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase" style={{ background: 'color-mix(in srgb, #3b82f6 10%, transparent)', color: '#3b82f6' }}>{u.role}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button onClick={() => handleApprove(u.id)} disabled={isProc} className="p-2 rounded-xl text-white transition-all hover:brightness-110 disabled:opacity-50"
                                                style={{ background: 'var(--app-success, #10b981)' }} title="Approve">
                                                {isProc ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                            </button>
                                            <button onClick={() => setCorrectionTarget(u)} disabled={isProc} className="p-2 rounded-xl transition-all disabled:opacity-50"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }} title="Request correction">
                                                <MessageSquare size={14} />
                                            </button>
                                            <button onClick={() => handleReject(u.id)} disabled={isProc} className="p-2 rounded-xl transition-all disabled:opacity-50"
                                                style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)' }} title="Reject">
                                                <XCircle size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </>)}
                </div>
            )}

            {/* Modals */}
            {createOpen && <CreateModal roles={roles} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load() }} />}
            {editUser && <EditDrawer user={editUser} roles={roles} onClose={() => setEditUser(null)} onRefresh={() => { setEditUser(null); load() }} />}

            {/* Correction Modal */}
            {correctionTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setCorrectionTarget(null) }}>
                    <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div className="px-5 pt-5 pb-3">
                            <div className="flex items-center gap-3 mb-1">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}><MessageSquare size={18} /></div>
                                <div>
                                    <h3 className="text-[14px] font-black text-app-foreground">Request Correction</h3>
                                    <p className="text-[10px] text-app-muted-foreground font-bold">Tell <strong>{correctionTarget.first_name}</strong> what to fix</p>
                                </div>
                            </div>
                        </div>
                        <div className="px-5 pb-5 space-y-3">
                            <textarea placeholder="e.g. Please upload a clear ID or correct your birth date." value={correctionNotes} onChange={e => setCorrectionNotes(e.target.value)} rows={4}
                                className="w-full text-[12px] px-3 py-2.5 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none resize-none" />
                            <div className="flex gap-2">
                                <button onClick={() => { setCorrectionTarget(null); setCorrectionNotes('') }} className="flex-1 text-[11px] font-bold py-2.5 rounded-xl border border-app-border text-app-muted-foreground hover:bg-app-surface transition-all">Cancel</button>
                                <button onClick={submitCorrection} disabled={!correctionNotes.trim() || processing === correctionTarget.id}
                                    className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-2.5 rounded-xl text-white transition-all disabled:opacity-40"
                                    style={{ background: 'var(--app-primary)' }}>
                                    {processing === correctionTarget.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
