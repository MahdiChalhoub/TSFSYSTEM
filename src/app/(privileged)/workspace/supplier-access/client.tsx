'use client';
import { ShieldCheck } from 'lucide-react'

import { useState } from 'react';
import {
    ShieldCheck, ShieldOff, Pause, Plus, Search,
    Eye, Package, FileText, DollarSign, BarChart3, ClipboardList,
} from 'lucide-react';
import {
    createPortalAccess, activatePortalAccess, suspendPortalAccess,
    revokePortalAccess, setPortalPermissions,
} from '@/app/actions/supplier-portal';

const ALL_PERMISSIONS = [
    { code: 'VIEW_OWN_ORDERS', label: 'View Orders', icon: ClipboardList },
    { code: 'VIEW_OWN_STOCK', label: 'View Stock', icon: Package },
    { code: 'VIEW_OWN_STATEMENT', label: 'View Statement', icon: FileText },
    { code: 'CREATE_PROFORMA', label: 'Create Proformas', icon: DollarSign },
    { code: 'REQUEST_PRICE_CHANGE', label: 'Price Changes', icon: BarChart3 },
    { code: 'VIEW_PRODUCT_PERFORMANCE', label: 'Product Analytics', icon: Eye },
];

const STATUS_COLORS: Record<string, string> = {
    ACTIVE: '#22c55e', SUSPENDED: '#f59e0b', REVOKED: '#ef4444', PENDING: '#64748b',
};

export default function SupplierAccessClient({ accesses: init, suppliers }: any) {
    const [accesses, setAccesses] = useState<any[]>(init);
    const [search, setSearch] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [editPerms, setEditPerms] = useState<number | null>(null);
    const [editPermsValues, setEditPermsValues] = useState<string[]>([]);
    const [newAccess, setNewAccess] = useState({ contact: '', user: '' });

    const filtered = accesses.filter((a: any) =>
        (a.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (a.user_email || '').toLowerCase().includes(search.toLowerCase())
    );

    async function handleCreate() {
        if (!newAccess.contact) return;
        try {
            const result = await createPortalAccess(newAccess);
            setAccesses(prev => [...prev, result]);
            setShowCreate(false);
            setNewAccess({ contact: '', user: '' });
        } catch (e) { console.error(e); }
    }

    async function handleActivate(id: number) {
        await activatePortalAccess(id);
        setAccesses(prev => prev.map(a => a.id === id ? { ...a, status: 'ACTIVE' } : a));
    }
    async function handleSuspend(id: number) {
        await suspendPortalAccess(id);
        setAccesses(prev => prev.map(a => a.id === id ? { ...a, status: 'SUSPENDED' } : a));
    }
    async function handleRevoke(id: number) {
        await revokePortalAccess(id);
        setAccesses(prev => prev.map(a => a.id === id ? { ...a, status: 'REVOKED' } : a));
    }

    async function handleSavePerms(id: number) {
        await setPortalPermissions(id, editPermsValues);
        setAccesses(prev => prev.map(a => a.id === id ? { ...a, permissions: editPermsValues } : a));
        setEditPerms(null);
    }

    const cardStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
    };

    return (
        <div>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', alignItems: 'center' }}>
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem',
                    background: '#0f172a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <Search size={16} color="#64748b" />
                    <input
                        value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search suppliers..."
                        style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', outline: 'none' }}
                    />
                </div>
                <button onClick={() => setShowCreate(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
                    borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600,
                }}>
                    <Plus size={16} /> Grant Access
                </button>
            </div>

            {/* Create Form */}
            {showCreate && (
                <div style={{ ...cardStyle, padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Grant New Portal Access</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
                        <select
                            value={newAccess.contact}
                            onChange={e => setNewAccess(prev => ({ ...prev, contact: e.target.value }))}
                            style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0' }}
                        >
                            <option value="">Select Supplier...</option>
                            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                        <input
                            placeholder="User ID (existing account)"
                            value={newAccess.user}
                            onChange={e => setNewAccess(prev => ({ ...prev, user: e.target.value }))}
                            style={{ padding: '0.5rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0' }}
                        />
                        <button onClick={handleCreate} style={{
                            padding: '0.5rem 1rem', background: '#22c55e', border: 'none',
                            borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 600,
                        }}>
                            Create
                        </button>
                    </div>
                </div>
            )}

            {/* Access List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.map((a: any) => (
                    <div key={a.id} style={{ ...cardStyle, padding: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{a.contact_name}</div>
                                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{a.user_email}</div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                    padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                    background: `${STATUS_COLORS[a.status]}20`, color: STATUS_COLORS[a.status],
                                }}>
                                    {a.status}
                                </span>
                                {a.status !== 'ACTIVE' && (
                                    <button onClick={() => handleActivate(a.id)} title="Activate"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e' }}>
                                        <ShieldCheck size={18} />
                                    </button>
                                )}
                                {a.status === 'ACTIVE' && (
                                    <button onClick={() => handleSuspend(a.id)} title="Suspend"
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b' }}>
                                        <Pause size={18} />
                                    </button>
                                )}
                                <button onClick={() => handleRevoke(a.id)} title="Revoke"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                    <ShieldOff size={18} />
                                </button>
                                <button onClick={() => { setEditPerms(a.id); setEditPermsValues(a.permissions || []); }}
                                    title="Edit Permissions"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Permissions */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                            {(a.permissions || []).map((p: string) => {
                                const pm = ALL_PERMISSIONS.find(x => x.code === p);
                                return (
                                    <span key={p} style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem',
                                        background: 'rgba(99,102,241,0.15)', color: '#818cf8',
                                    }}>
                                        {pm && <pm.icon size={12} />} {pm?.label || p}
                                    </span>
                                );
                            })}
                        </div>

                        {/* Permission Editor */}
                        {editPerms === a.id && (
                            <div style={{ marginTop: 12, padding: 12, background: '#0f172a', borderRadius: 8 }}>
                                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.85rem' }}>Edit Permissions</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                                    {ALL_PERMISSIONS.map(pm => (
                                        <label key={pm.code} style={{
                                            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                            padding: '4px 8px', borderRadius: 6, fontSize: '0.8rem',
                                            background: editPermsValues.includes(pm.code) ? 'rgba(99,102,241,0.2)' : 'transparent',
                                            color: editPermsValues.includes(pm.code) ? '#818cf8' : '#94a3b8',
                                        }}>
                                            <input
                                                type="checkbox"
                                                checked={editPermsValues.includes(pm.code)}
                                                onChange={e => {
                                                    if (e.target.checked) setEditPermsValues(v => [...v, pm.code]);
                                                    else setEditPermsValues(v => v.filter(x => x !== pm.code));
                                                }}
                                            />
                                            <pm.icon size={14} /> {pm.label}
                                        </label>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                    <button onClick={() => handleSavePerms(a.id)} style={{
                                        padding: '4px 12px', background: '#6366f1', border: 'none',
                                        borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: '0.8rem',
                                    }}>Save</button>
                                    <button onClick={() => setEditPerms(null)} style={{
                                        padding: '4px 12px', background: '#334155', border: 'none',
                                        borderRadius: 6, color: '#e2e8f0', cursor: 'pointer', fontSize: '0.8rem',
                                    }}>Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                        No supplier portal accesses found
                    </div>
                )}
            </div>
        </div>
    );
}
