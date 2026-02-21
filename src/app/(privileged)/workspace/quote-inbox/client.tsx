'use client';

import { useState, useTransition } from 'react';
import { updateQuoteRequest, deleteQuoteRequest } from '@/app/actions/client-portal';
import { Mail, User, Building2, Phone, Package, Hash, Clock, Trash2, CheckCircle, XCircle, Send, Eye } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    PENDING: { label: 'Pending', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    REPLIED: { label: 'Replied', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    CONVERTED: { label: 'Converted', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    DECLINED: { label: 'Declined', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    EXPIRED: { label: 'Expired', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
};

export default function QuoteInboxClient({ quotes: initial }: { quotes: any[] }) {
    const [quotes, setQuotes] = useState(initial);
    const [filter, setFilter] = useState('ALL');
    const [selected, setSelected] = useState<any | null>(null);
    const [isPending, startTransition] = useTransition();

    const filtered = filter === 'ALL' ? quotes : quotes.filter(q => q.status === filter);

    const handleStatusChange = (id: number, newStatus: string) => {
        startTransition(async () => {
            await updateQuoteRequest(id, { status: newStatus });
            setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q));
            if (selected?.id === id) setSelected((prev: any) => ({ ...prev, status: newStatus }));
        });
    };

    const handleDelete = (id: number) => {
        if (!confirm('Delete this quote request permanently?')) return;
        startTransition(async () => {
            await deleteQuoteRequest(id);
            setQuotes(prev => prev.filter(q => q.id !== id));
            if (selected?.id === id) setSelected(null);
        });
    };

    const handleNotesUpdate = (id: number, notes: string) => {
        startTransition(async () => {
            await updateQuoteRequest(id, { internal_notes: notes });
            setQuotes(prev => prev.map(q => q.id === id ? { ...q, internal_notes: notes } : q));
        });
    };

    return (
        <div style={{ display: 'flex', gap: '1.5rem' }}>
            {/* ── Left Panel: List ──────────────────────────────────── */}
            <div style={{ flex: 1 }}>
                {/* Filter Bar */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {['ALL', 'PENDING', 'REPLIED', 'CONVERTED', 'DECLINED'].map(s => (
                        <button key={s} onClick={() => setFilter(s)} style={{
                            padding: '0.4rem 0.85rem', borderRadius: 20,
                            border: `1px solid ${filter === s ? '#6366f1' : '#334155'}`,
                            background: filter === s ? '#6366f1' : 'transparent',
                            color: filter === s ? '#fff' : '#94a3b8',
                            fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                        }}>
                            {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label || s}
                        </button>
                    ))}
                </div>

                {/* Quote List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                            <Mail size={40} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                            <p style={{ fontWeight: 600 }}>No quote requests found</p>
                        </div>
                    ) : filtered.map(q => {
                        const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.PENDING;
                        const isActive = selected?.id === q.id;
                        return (
                            <div key={q.id}
                                onClick={() => setSelected(q)}
                                style={{
                                    background: isActive ? 'rgba(99,102,241,0.08)' : '#1e293b',
                                    border: `1px solid ${isActive ? '#6366f1' : 'rgba(255,255,255,0.06)'}`,
                                    borderRadius: 12, padding: '1rem 1.25rem', cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>
                                            {q.full_name}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>
                                            {q.email} {q.company_name ? `• ${q.company_name}` : ''}
                                        </div>
                                    </div>
                                    <span style={{
                                        padding: '0.25rem 0.6rem', borderRadius: 12,
                                        fontSize: '0.7rem', fontWeight: 600,
                                        background: sc.bg, color: sc.color,
                                    }}>{sc.label}</span>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                                    {q.items && q.items.length > 0 ? (
                                        <span>{q.items[0].product_name} {q.items.length > 1 ? `+ ${q.items.length - 1} more` : ''}</span>
                                    ) : (
                                        <strong>{q.product_name || 'No items'}</strong>
                                    )}
                                    {q.quantity && !q.items?.length ? ` × ${q.quantity}` : ''}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
                                    {q.quote_number} • {new Date(q.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Right Panel: Detail ──────────────────────────────── */}
            <div style={{
                width: '420px', flexShrink: 0,
                background: '#1e293b', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.06)',
                padding: selected ? '1.5rem' : '3rem 1.5rem',
                display: 'flex', flexDirection: 'column',
                overflowY: 'auto', maxHeight: 'calc(100vh - 120px)'
            }}>
                {!selected ? (
                    <div style={{ textAlign: 'center', color: '#475569', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <Eye size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p style={{ fontWeight: 600 }}>Select a quote to view details</p>
                    </div>
                ) : (
                    <>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 0.25rem' }}>
                            {selected.quote_number}
                        </h3>
                        <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
                            {new Date(selected.created_at).toLocaleString()}
                        </p>

                        {/* Contact Info */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                            <DetailRow icon={<User size={14} />} label="Name" value={selected.full_name} />
                            <DetailRow icon={<Mail size={14} />} label="Email" value={selected.email} />
                            {selected.phone && <DetailRow icon={<Phone size={14} />} label="Phone" value={selected.phone} />}
                            {selected.company_name && <DetailRow icon={<Building2 size={14} />} label="Company" value={selected.company_name} />}
                        </div>

                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0.5rem 0' }} />

                        {/* Items Info */}
                        <div style={{ margin: '0.75rem 0' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.5rem' }}>REQUESTED ITEMS</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {selected.items && selected.items.length > 0 ? (
                                    selected.items.map((item: any, idx: number) => (
                                        <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)' }}>
                                            <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>{item.product_name}</div>
                                            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Qty: {item.quantity}</div>
                                            {item.notes && <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: 4, fontStyle: 'italic' }}>Note: {item.notes}</div>}
                                        </div>
                                    ))
                                ) : (
                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.6rem', borderRadius: 8 }}>
                                        <div style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>{selected.product_name}</div>
                                        <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Qty: {selected.quantity}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Message */}
                        <div style={{
                            background: 'rgba(255,255,255,0.03)', borderRadius: 10,
                            padding: '0.875rem', marginTop: '0.5rem',
                        }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>MESSAGE</div>
                            <p style={{ color: '#cbd5e1', fontSize: '0.85rem', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
                                {selected.message}
                            </p>
                        </div>

                        {/* Internal Notes */}
                        <div style={{ marginTop: '1rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '0.35rem' }}>INTERNAL NOTES</div>
                            <textarea
                                defaultValue={selected.internal_notes || ''}
                                onBlur={e => {
                                    if (e.target.value !== (selected.internal_notes || '')) {
                                        handleNotesUpdate(selected.id, e.target.value);
                                    }
                                }}
                                rows={2}
                                placeholder="Add internal notes..."
                                style={{
                                    width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)',
                                    color: '#e2e8f0', fontSize: '0.8rem', resize: 'vertical', outline: 'none',
                                }}
                            />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                            {selected.status === 'PENDING' && (
                                <>
                                    <ActionBtn icon={<Send size={13} />} label="Mark Replied" color="#3b82f6"
                                        onClick={() => handleStatusChange(selected.id, 'REPLIED')} />
                                    <ActionBtn icon={<XCircle size={13} />} label="Decline" color="#ef4444"
                                        onClick={() => handleStatusChange(selected.id, 'DECLINED')} />
                                </>
                            )}
                            {selected.status === 'REPLIED' && (
                                <ActionBtn icon={<CheckCircle size={13} />} label="Convert to Order" color="#22c55e"
                                    onClick={() => handleStatusChange(selected.id, 'CONVERTED')} />
                            )}
                            <ActionBtn icon={<Trash2 size={13} />} label="Delete" color="#ef4444"
                                onClick={() => handleDelete(selected.id)} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ color: '#64748b' }}>{icon}</span>
            <span style={{ color: '#64748b', fontSize: '0.8rem', minWidth: 65 }}>{label}</span>
            <span style={{ color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 500 }}>{value}</span>
        </div>
    );
}

function ActionBtn({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            padding: '0.4rem 0.75rem', borderRadius: 8,
            border: `1px solid ${color}33`, background: `${color}15`,
            color, fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.35rem',
        }}>
            {icon} {label}
        </button>
    );
}
