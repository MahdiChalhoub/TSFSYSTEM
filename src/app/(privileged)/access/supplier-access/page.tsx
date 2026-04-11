'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
    Truck, Search, Loader2, CheckCircle, XCircle, Clock,
    RefreshCw, Ban, Unlock, Users, ShieldCheck, Link2,
    X, Save, Edit3, UserPlus, RotateCcw, Lock,
    ChevronRight, Shield
} from 'lucide-react'

type PortalAccess = {
    id: number
    user: number; user_email: string; user_name: string
    contact: number; contact_name: string; contact_type: string
    portal_type: string; status: string
    relationship_role: string; is_primary: boolean; created_via: string
    can_access_portal: boolean
    granted_at: string | null; revoked_at: string | null; revoke_reason: string | null
    last_portal_login: string | null; created_at: string
}

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
    ACTIVE: { color: '#10b981', label: 'Active' },
    BLOCKED: { color: '#f59e0b', label: 'Blocked' },
    REVOKED: { color: '#ef4444', label: 'Revoked' },
}

const ROLE_LABELS: Record<string, string> = {
    OWNER: 'Owner', REPRESENTATIVE: 'Rep', ACCOUNTING: 'Accounting',
    LOGISTICS: 'Logistics', PURCHASER: 'Purchaser', SELF: 'Self',
}

const VIA_LABELS: Record<string, string> = {
    AUTO_LINK: 'Auto-linked', ADMIN_CREATE: 'Admin',
    SELF_REGISTER: 'Self', APPROVAL: 'Approved', TRANSFER: 'Transfer',
}

export default function SupplierAccessPage() {
    const [records, setRecords] = useState<PortalAccess[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [grantOpen, setGrantOpen] = useState(false)
    const [selectedRecord, setSelectedRecord] = useState<PortalAccess | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await erpFetch('iam/portal-access/?portal_type=SUPPLIER')
            setRecords(Array.isArray(data) ? data : data?.results ?? [])
        } catch { toast.error('Failed to load supplier access records') }
        setLoading(false)
    }, [])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        let list = records
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(r =>
                r.user_name?.toLowerCase().includes(q) ||
                r.user_email?.toLowerCase().includes(q) ||
                r.contact_name?.toLowerCase().includes(q)
            )
        }
        if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter)
        return list
    }, [records, search, statusFilter])

    const kpis = useMemo(() => ({
        total: records.length,
        active: records.filter(r => r.status === 'ACTIVE').length,
        reps: records.filter(r => r.relationship_role !== 'SELF' && r.status === 'ACTIVE').length,
        revoked: records.filter(r => r.status === 'REVOKED').length,
    }), [records])

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Truck size={24} color="white" />
                </div>
                <div style={{ flex: '1 1 auto', minWidth: 200 }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)', margin: 0 }}>Supplier Portal Access</h1>
                    <p style={{ fontSize: '0.875rem', color: 'var(--app-muted-foreground)', margin: 0 }}>Manage supplier portal users, representatives, and access rights</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={load} style={{ padding: '0.5rem 1rem', borderRadius: 8, background: 'var(--app-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--app-foreground)', fontSize: '0.875rem' }}>
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button onClick={() => setGrantOpen(true)} style={{ padding: '0.5rem 1rem', borderRadius: 8, background: '#f59e0b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                        <UserPlus size={14} /> Grant Access
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                    { label: 'Total Records', value: kpis.total, icon: Users, color: 'var(--app-primary)' },
                    { label: 'Active Access', value: kpis.active, icon: ShieldCheck, color: '#10b981' },
                    { label: 'Active Reps', value: kpis.reps, icon: Link2, color: '#f59e0b' },
                    { label: 'Revoked', value: kpis.revoked, icon: Ban, color: '#ef4444' },
                ].map(k => (
                    <div key={k.label} style={{ padding: '1.25rem', borderRadius: 12, background: 'var(--app-card)', border: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `color-mix(in srgb, ${k.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <k.icon size={20} color={k.color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--app-foreground)' }}>{k.value}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--app-muted)', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
                    <Search size={16} color="var(--app-muted-foreground)" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, email, or supplier..."
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--app-foreground)', fontSize: '0.875rem' }} />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.875rem', background: 'var(--app-muted)', border: 'none', color: 'var(--app-foreground)', cursor: 'pointer' }}>
                    <option value="all">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="BLOCKED">Blocked</option>
                    <option value="REVOKED">Revoked</option>
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--app-muted-foreground)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 1rem' }} />Loading supplier access records...
                </div>
            ) : (
                <div style={{ borderRadius: 12, border: '1px solid var(--app-border)', overflow: 'hidden', background: 'var(--app-card)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-muted)' }}>
                                {['User', 'Supplier Contact', 'Status', 'Role', 'Primary', 'Last Login', 'Actions'].map(h => (
                                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--app-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => {
                                const st = STATUS_STYLE[r.status] || STATUS_STYLE.ACTIVE
                                return (
                                    <tr key={r.id} onClick={() => setSelectedRecord(r)} style={{ borderBottom: '1px solid var(--app-border)', cursor: 'pointer' }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, #f59e0b 4%, transparent)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--app-foreground)', fontSize: '0.875rem' }}>{r.user_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>{r.user_email}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: 500, color: 'var(--app-foreground)', fontSize: '0.875rem' }}>{r.contact_name}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span style={{ padding: '0.25rem 0.625rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500, color: st.color, background: `color-mix(in srgb, ${st.color} 12%, transparent)` }}>{st.label}</span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--app-muted-foreground)' }}>{ROLE_LABELS[r.relationship_role] || r.relationship_role}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {r.is_primary ? <CheckCircle size={16} color="#10b981" /> : <XCircle size={16} color="var(--app-muted-foreground)" />}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--app-muted-foreground)' }}>{r.last_portal_login ? new Date(r.last_portal_login).toLocaleDateString() : 'Never'}</td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ display: 'flex', gap: '0.375rem' }} onClick={e => e.stopPropagation()}>
                                                <button onClick={() => setSelectedRecord(r)} title="Details" style={{ padding: '0.375rem', borderRadius: 6, border: 'none', background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)', cursor: 'pointer' }}><Edit3 size={14} /></button>
                                                {r.status === 'ACTIVE' && (
                                                    <button onClick={async () => {
                                                        const reason = prompt('Reason for revoking access:')
                                                        if (reason === null) return
                                                        await erpFetch(`iam/portal-access/${r.id}/revoke/`, { method: 'POST', body: JSON.stringify({ reason }), headers: { 'Content-Type': 'application/json' } })
                                                        toast.success('Supplier access revoked'); load()
                                                    }} title="Revoke" style={{ padding: '0.375rem', borderRadius: 6, border: 'none', background: 'color-mix(in srgb, #ef4444 12%, transparent)', color: '#ef4444', cursor: 'pointer' }}><Ban size={14} /></button>
                                                )}
                                                {r.status !== 'ACTIVE' && (
                                                    <button onClick={async () => { await erpFetch(`iam/portal-access/${r.id}/reactivate/`, { method: 'POST' }); toast.success('Supplier access reactivated'); load() }}
                                                        title="Reactivate" style={{ padding: '0.375rem', borderRadius: 6, border: 'none', background: 'color-mix(in srgb, #10b981 12%, transparent)', color: '#10b981', cursor: 'pointer' }}><Unlock size={14} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--app-muted-foreground)' }}>
                                    {search ? 'No records match your search' : 'No supplier access records found'}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Grant Access Modal */}
            {grantOpen && <GrantAccessModal onClose={() => setGrantOpen(false)} onCreated={() => { setGrantOpen(false); load() }} />}

            {/* Detail Drawer */}
            {selectedRecord && <DetailDrawer record={selectedRecord} onClose={() => setSelectedRecord(null)} onRefresh={() => { setSelectedRecord(null); load() }} />}
        </div>
    )
}

/* ═══ GRANT ACCESS MODAL ═══ */
function GrantAccessModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [contacts, setContacts] = useState<{ id: number; name: string; type: string }[]>([])
    const [users, setUsers] = useState<{ id: number; username: string; email: string; first_name: string; last_name: string }[]>([])
    const [form, setForm] = useState({ contact_id: 0, user_id: 0, relationship_role: 'SELF', can_access_portal: true })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

    useEffect(() => {
        (async () => {
            try {
                const [cData, uData] = await Promise.all([
                    erpFetch('crm/contacts/?type=SUPPLIER'),
                    erpFetch('erp/users/'),
                ])
                setContacts(Array.isArray(cData) ? cData : cData?.results ?? [])
                setUsers(Array.isArray(uData) ? uData : uData?.results ?? [])
            } catch { toast.error('Failed to load data') }
            setLoading(false)
        })()
    }, [])

    const handleGrant = async () => {
        if (!form.contact_id || !form.user_id) { toast.error('Select both a contact and a user'); return }
        setSaving(true)
        try {
            await erpFetch('iam/portal-access/', {
                method: 'POST',
                body: JSON.stringify({ ...form, portal_type: 'SUPPLIER' }),
                headers: { 'Content-Type': 'application/json' },
            })
            toast.success('Supplier access granted!')
            onCreated()
        } catch (e: any) { toast.error(e?.message || 'Failed to grant access') }
        setSaving(false)
    }

    const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.75rem', borderRadius: 8, border: '1px solid var(--app-border)', background: 'var(--app-background)', color: 'var(--app-foreground)', fontSize: '0.875rem', outline: 'none' }
    const labelStyle: React.CSSProperties = { fontSize: '0.75rem', fontWeight: 600, color: 'var(--app-muted-foreground)', marginBottom: 4, display: 'block' }

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', zIndex: 50 }} onClick={onClose} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                <div style={{ width: '100%', maxWidth: 480, background: 'var(--app-card)', border: '1px solid var(--app-border)', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'color-mix(in srgb, #f59e0b 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <ShieldCheck size={18} color="#f59e0b" />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--app-foreground)' }}>Grant Supplier Access</h3>
                        </div>
                        <button onClick={onClose} style={{ padding: 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--app-muted-foreground)' }}><X size={16} /></button>
                    </div>
                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--app-muted-foreground)' }}><Loader2 size={24} className="animate-spin" /></div>
                    ) : (
                        <>
                            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                                <div>
                                    <label style={labelStyle}>Supplier Contact *</label>
                                    <select style={inputStyle} value={form.contact_id} onChange={e => set('contact_id', +e.target.value)}>
                                        <option value={0}>— Select Supplier —</option>
                                        {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>User *</label>
                                    <select style={inputStyle} value={form.user_id} onChange={e => set('user_id', +e.target.value)}>
                                        <option value={0}>— Select User —</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email || u.username})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Relationship Role</label>
                                    <select style={inputStyle} value={form.relationship_role} onChange={e => set('relationship_role', e.target.value)}>
                                        {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--app-foreground)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={form.can_access_portal} onChange={e => set('can_access_portal', e.target.checked)} /> Portal Access
                                </label>
                            </div>
                            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--app-border)', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button onClick={onClose} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: '1px solid var(--app-border)', background: 'transparent', cursor: 'pointer', color: 'var(--app-muted-foreground)', fontSize: '0.875rem' }}>Cancel</button>
                                <button onClick={handleGrant} disabled={saving} style={{ padding: '0.5rem 1.25rem', borderRadius: 8, border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem', opacity: saving ? 0.6 : 1 }}>
                                    {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />} Grant
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

/* ═══ DETAIL DRAWER ═══ */
function DetailDrawer({ record, onClose, onRefresh }: { record: PortalAccess; onClose: () => void; onRefresh: () => void }) {
    const [showPwReset, setShowPwReset] = useState(false)
    const [newPw, setNewPw] = useState('')

    const handleResetPassword = async () => {
        if (newPw.length < 4) { toast.error('Password must be at least 4 characters'); return }
        try {
            await erpFetch(`erp/users/${record.user}/reset-password/`, { method: 'POST', body: JSON.stringify({ new_password: newPw }), headers: { 'Content-Type': 'application/json' } })
            toast.success('Password reset')
            setShowPwReset(false); setNewPw('')
        } catch (e: any) { toast.error(e?.message || 'Failed') }
    }

    const st = STATUS_STYLE[record.status] || STATUS_STYLE.ACTIVE
    const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.75rem', borderRadius: 8, border: '1px solid var(--app-border)', background: 'var(--app-background)', color: 'var(--app-foreground)', fontSize: '0.875rem', outline: 'none' }
    const labelStyle: React.CSSProperties = { fontSize: '0.7rem', fontWeight: 700, color: 'var(--app-muted-foreground)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)', zIndex: 50 }} onClick={onClose} />
            <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 520, background: 'var(--app-card)', borderLeft: '1px solid var(--app-border)', boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', zIndex: 51, display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.2s ease' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--app-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--app-foreground)' }}>{record.user_name}</h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--app-muted-foreground)' }}>{record.user_email} · Supplier Portal</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        <span style={{ padding: '0.25rem 0.625rem', borderRadius: 6, fontSize: '0.75rem', fontWeight: 500, color: st.color, background: `color-mix(in srgb, ${st.color} 12%, transparent)` }}>{st.label}</span>
                        <button onClick={onClose} style={{ padding: '0.5rem', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--app-muted-foreground)' }}><X size={16} /></button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* User Info */}
                    <section>
                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--app-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> User Info</h4>
                        <div style={{ padding: '0.875rem', background: 'var(--app-muted)', borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div><span style={{ fontSize: '0.7rem', color: 'var(--app-muted-foreground)' }}>Name</span><div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--app-foreground)' }}>{record.user_name}</div></div>
                            <div><span style={{ fontSize: '0.7rem', color: 'var(--app-muted-foreground)' }}>Email</span><div style={{ fontSize: '0.85rem', color: 'var(--app-foreground)' }}>{record.user_email}</div></div>
                            <div><span style={{ fontSize: '0.7rem', color: 'var(--app-muted-foreground)' }}>Role</span><div style={{ fontSize: '0.85rem', color: 'var(--app-foreground)' }}>{ROLE_LABELS[record.relationship_role] || record.relationship_role}</div></div>
                            <div><span style={{ fontSize: '0.7rem', color: 'var(--app-muted-foreground)' }}>Primary</span><div style={{ fontSize: '0.85rem', color: 'var(--app-foreground)' }}>{record.is_primary ? 'Yes' : 'No'}</div></div>
                        </div>
                    </section>

                    {/* Contact Info */}
                    <section>
                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--app-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}><Link2 size={14} /> Supplier Contact (Source of Truth)</h4>
                        <div style={{ padding: '0.875rem', background: 'var(--app-muted)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--app-foreground)' }}>{record.contact_name}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--app-muted-foreground)' }}>ID: #{record.contact}</div>
                                </div>
                                <a href="/crm/contacts" style={{ padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', textDecoration: 'none' }}>
                                    Edit in CRM <ChevronRight size={10} style={{ verticalAlign: 'middle' }} />
                                </a>
                            </div>
                        </div>
                    </section>

                    {/* Password Reset */}
                    <section>
                        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: 'var(--app-foreground)', display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={14} /> Security</h4>
                        {!showPwReset ? (
                            <button onClick={() => setShowPwReset(true)} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid var(--app-border)', background: 'transparent', cursor: 'pointer', color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <RotateCcw size={13} /> Reset Password
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1 }}><label style={labelStyle}>New Password</label><input style={inputStyle} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 4 characters" /></div>
                                <button onClick={handleResetPassword} style={{ padding: '0.625rem 1rem', borderRadius: 8, border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Reset</button>
                                <button onClick={() => { setShowPwReset(false); setNewPw('') }} style={{ padding: '0.625rem', borderRadius: 8, border: '1px solid var(--app-border)', background: 'transparent', cursor: 'pointer', color: 'var(--app-muted-foreground)' }}><X size={14} /></button>
                            </div>
                        )}
                    </section>

                    {/* Access Actions */}
                    <section style={{ borderTop: '1px solid var(--app-border)', paddingTop: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {record.status === 'ACTIVE' ? (
                                <button onClick={async () => {
                                    const reason = prompt('Reason for revoking:')
                                    if (reason === null) return
                                    await erpFetch(`iam/portal-access/${record.id}/revoke/`, { method: 'POST', body: JSON.stringify({ reason }), headers: { 'Content-Type': 'application/json' } })
                                    toast.success('Access revoked'); onRefresh()
                                }} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)', background: 'color-mix(in srgb, #ef4444 8%, transparent)', cursor: 'pointer', color: '#ef4444', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <Ban size={13} /> Revoke Access
                                </button>
                            ) : (
                                <button onClick={async () => { await erpFetch(`iam/portal-access/${record.id}/reactivate/`, { method: 'POST' }); toast.success('Access reactivated'); onRefresh() }}
                                    style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid color-mix(in srgb, #10b981 30%, transparent)', background: 'color-mix(in srgb, #10b981 8%, transparent)', cursor: 'pointer', color: '#10b981', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                    <Unlock size={13} /> Reactivate Access
                                </button>
                            )}
                        </div>
                        {record.revoke_reason && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--app-muted-foreground)', marginTop: 8 }}>Revoke reason: {record.revoke_reason}</p>
                        )}
                    </section>
                </div>
            </div>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        </>
    )
}
