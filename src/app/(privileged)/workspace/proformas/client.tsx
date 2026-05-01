'use client';

import { useState } from 'react';
import { Check, X, MessageSquare, ArrowRight, Search, Filter } from 'lucide-react';
import { approveProforma, rejectProforma, negotiateProforma, convertProformaToPO } from '@/app/actions/supplier-portal';

const STATUS_COLORS: Record<string, string> = {
    DRAFT: 'var(--app-muted-foreground)', SUBMITTED: 'var(--app-info)', UNDER_REVIEW: 'var(--app-warning)',
    NEGOTIATING: '#a855f7', APPROVED: 'var(--app-success)', REJECTED: 'var(--app-error)',
    CONVERTED: 'var(--app-accent-cyan)', CANCELLED: '#6b7280',
};

export default function ProformaReviewClient({ proformas: init }: any) {
    const [proformas, setProformas] = useState<any[]>(init);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [actionId, setActionId] = useState<number | null>(null);
    const [actionType, setActionType] = useState<string>('');
    const [actionText, setActionText] = useState('');

    const filtered = proformas.filter((p: any) => {
        if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
        return (p.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||
            (p.proforma_number || '').toLowerCase().includes(search.toLowerCase());
    });

    async function handleApprove(id: number) {
        await approveProforma(id);
        setProformas(prev => prev.map(p => p.id === id ? { ...p, status: 'APPROVED' } : p));
    }
    async function handleReject(id: number) {
        await rejectProforma(id, actionText);
        setProformas(prev => prev.map(p => p.id === id ? { ...p, status: 'REJECTED' } : p));
        setActionId(null); setActionText('');
    }
    async function handleNegotiate(id: number) {
        await negotiateProforma(id, actionText);
        setProformas(prev => prev.map(p => p.id === id ? { ...p, status: 'NEGOTIATING' } : p));
        setActionId(null); setActionText('');
    }
    async function handleConvert(id: number) {
        const result = await convertProformaToPO(id);
        setProformas(prev => prev.map(p => p.id === id ? { ...p, status: 'CONVERTED' } : p));
    }

    const cardStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, var(--app-surface-2) 0%, var(--app-bg) 100%)',
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '1rem',
    };

    return (
        <div>
            <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', alignItems: 'center' }}>
                <div style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem',
                    background: 'var(--app-bg)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                }}>
                    <Search size={16} color="var(--app-muted-foreground)" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search proformas..." style={{ flex: 1, background: 'none', border: 'none', color: 'var(--app-border)', outline: 'none' }} />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
                    padding: '0.5rem 1rem', background: 'var(--app-bg)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, color: 'var(--app-border)',
                }}>
                    <option value="ALL">All Statuses</option>
                    {['SUBMITTED', 'UNDER_REVIEW', 'NEGOTIATING', 'APPROVED', 'REJECTED', 'CONVERTED'].map(s =>
                        <option key={s} value={s}>{s}</option>
                    )}
                </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filtered.map((p: any) => (
                    <div key={p.id} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontWeight: 600 }}>{p.proforma_number || `PRO-${p.id}`}</div>
                                <div style={{ color: 'var(--app-faint)', fontSize: '0.85rem' }}>
                                    {p.supplier_name} · {p.line_count || 0} items · {p.currency} {Number(p.total_amount || 0).toLocaleString()}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                    padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                    background: `${STATUS_COLORS[p.status]}20`, color: STATUS_COLORS[p.status],
                                }}>
                                    {p.status}
                                </span>
                                {['SUBMITTED', 'UNDER_REVIEW'].includes(p.status) && (
                                    <>
                                        <button onClick={() => handleApprove(p.id)} title="Approve"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-success)' }}>
                                            <Check size={18} />
                                        </button>
                                        <button onClick={() => { setActionId(p.id); setActionType('reject'); }}
                                            title="Reject" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-error)' }}>
                                            <X size={18} />
                                        </button>
                                        <button onClick={() => { setActionId(p.id); setActionType('negotiate'); }}
                                            title="Negotiate" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a855f7' }}>
                                            <MessageSquare size={18} />
                                        </button>
                                    </>
                                )}
                                {p.status === 'APPROVED' && (
                                    <button onClick={() => handleConvert(p.id)} title="Convert to PO"
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--app-accent-cyan)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                                        <ArrowRight size={14} /> Convert to PO
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Reject/Negotiate form */}
                        {actionId === p.id && (
                            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input value={actionText} onChange={e => setActionText(e.target.value)}
                                    placeholder={actionType === 'reject' ? 'Rejection reason...' : 'Counter-proposal notes...'}
                                    style={{ flex: 1, padding: '0.5rem', background: 'var(--app-bg)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'var(--app-border)' }} />
                                <button onClick={() => actionType === 'reject' ? handleReject(p.id) : handleNegotiate(p.id)}
                                    style={{
                                        padding: '0.5rem 1rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: '#fff',
                                        background: actionType === 'reject' ? 'var(--app-error)' : '#a855f7',
                                    }}>
                                    {actionType === 'reject' ? 'Reject' : 'Send Counter'}
                                </button>
                                <button onClick={() => setActionId(null)} style={{ padding: '0.5rem', background: '#334155', border: 'none', borderRadius: 6, color: 'var(--app-border)', cursor: 'pointer' }}>
                                    Cancel
                                </button>
                            </div>
                        )}

                        <div style={{ color: 'var(--app-muted-foreground)', fontSize: '0.8rem', marginTop: 8 }}>
                            {p.submitted_at && `Submitted: ${new Date(p.submitted_at).toLocaleDateString()}`}
                            {p.valid_until && ` · Valid until: ${new Date(p.valid_until).toLocaleDateString()}`}
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--app-muted-foreground)' }}>No proformas found</div>
                )}
            </div>
        </div>
    );
}
