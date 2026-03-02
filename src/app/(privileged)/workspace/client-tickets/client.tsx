'use client';

import { useState } from 'react';
import { Search, UserPlus, CheckCircle, XCircle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { assignTicket, resolveTicket, closeTicket, reopenTicket } from '@/app/actions/client-portal';

const STATUS_COLORS: Record<string, string> = {
 OPEN: '#ef4444', IN_PROGRESS: '#f59e0b', WAITING_CLIENT: '#8b5cf6',
 RESOLVED: '#22c55e', CLOSED: '#64748b',
};
const PRIORITY_COLORS: Record<string, string> = {
 LOW: '#64748b', NORMAL: '#06b6d4', HIGH: '#f59e0b', URGENT: '#ef4444',
};
const TYPE_EMOJI: Record<string, string> = {
 GENERAL: '💬', ORDER_ISSUE: '📦', DELIVERY_PROBLEM: '🚛', RETURN_REQUEST: '↩️',
 PRODUCT_FEEDBACK: '📝', COMPLAINT: '⚠️', SUGGESTION: '💡',
};

export default function ClientTicketsClient({ tickets: init }: { tickets: any[] }) {
 const [tickets, setTickets] = useState<any[]>(init);
 const [search, setSearch] = useState('');
 const [expanded, setExpanded] = useState<number | null>(null);
 const [resolveNotes, setResolveNotes] = useState('');

 const filtered = tickets.filter(t =>
 (t.ticket_number || '').toLowerCase().includes(search.toLowerCase()) ||
 (t.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
 (t.subject || '').toLowerCase().includes(search.toLowerCase())
 );

 async function handleResolve(id: number) {
 await resolveTicket(id, resolveNotes);
 setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'RESOLVED' } : t));
 setResolveNotes('');
 }
 async function handleClose(id: number) {
 await closeTicket(id);
 setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'CLOSED' } : t));
 }
 async function handleReopen(id: number) {
 await reopenTicket(id);
 setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'OPEN' } : t));
 }

 const cardStyle: React.CSSProperties = {
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
 };

 return (
 <div>
 <div style={{
 display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', marginBottom: '1.5rem',
 background: '#0f172a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
 }}>
 <Search size={16} color="#64748b" />
 <input value={search} onChange={e => setSearch(e.target.value)}
 placeholder="Search tickets..."
 style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', outline: 'none' }} />
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
 {filtered.map((t: any) => (
 <div key={t.id} style={{ ...cardStyle, padding: '1rem' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <button onClick={() => setExpanded(expanded === t.id ? null : t.id)}
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
 {expanded === t.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
 </button>
 <span style={{ fontSize: '1.25rem' }}>{TYPE_EMOJI[t.ticket_type] || '💬'}</span>
 <div>
 <div style={{ fontWeight: 600 }}>
 {t.ticket_number} — {t.subject}
 </div>
 <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
 {t.contact_name} · {new Date(t.created_at).toLocaleDateString()}
 </div>
 </div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <span style={{
 padding: '2px 8px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 600,
 background: `${PRIORITY_COLORS[t.priority]}20`, color: PRIORITY_COLORS[t.priority],
 }}>{t.priority}</span>
 <span style={{
 padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
 background: `${STATUS_COLORS[t.status]}20`, color: STATUS_COLORS[t.status],
 }}>{t.status}</span>
 {['OPEN', 'IN_PROGRESS'].includes(t.status) && (
 <button onClick={() => setExpanded(t.id)} title="Resolve" style={{
 display: 'flex', alignItems: 'center', gap: 4,
 padding: '4px 10px', background: '#22c55e', border: 'none',
 borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: '0.8rem',
 }}>
 <CheckCircle size={14} /> Resolve
 </button>
 )}
 {t.status === 'RESOLVED' && (
 <button onClick={() => handleClose(t.id)} title="Close" style={{
 display: 'flex', alignItems: 'center', gap: 4,
 padding: '4px 10px', background: '#64748b', border: 'none',
 borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: '0.8rem',
 }}>
 <XCircle size={14} /> Close
 </button>
 )}
 {t.status === 'CLOSED' && (
 <button onClick={() => handleReopen(t.id)} title="Reopen" style={{
 display: 'flex', alignItems: 'center', gap: 4,
 padding: '4px 10px', background: '#f59e0b', border: 'none',
 borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: '0.8rem',
 }}>
 <RotateCcw size={14} /> Reopen
 </button>
 )}
 </div>
 </div>

 {expanded === t.id && (
 <div style={{
 marginTop: 12, padding: 12, background: '#0f172a', borderRadius: 8,
 fontSize: '0.85rem', color: '#94a3b8',
 }}>
 <div style={{ marginBottom: 8 }}>
 <strong>Description:</strong>
 <p style={{ marginTop: 4, color: '#e2e8f0' }}>{t.description}</p>
 </div>
 {t.resolution_notes && (
 <div style={{ marginBottom: 8 }}>
 <strong>Resolution:</strong>
 <p style={{ marginTop: 4, color: '#22c55e' }}>{t.resolution_notes}</p>
 </div>
 )}
 {t.satisfaction_rating && (
 <div><strong>Satisfaction:</strong> {'⭐'.repeat(t.satisfaction_rating)}</div>
 )}
 {['OPEN', 'IN_PROGRESS'].includes(t.status) && (
 <div style={{ marginTop: 12 }}>
 <textarea placeholder="Resolution notes..."
 value={resolveNotes} onChange={e => setResolveNotes(e.target.value)}
 style={{
 width: '100%', padding: '0.5rem', background: '#1e293b',
 border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
 color: '#e2e8f0', resize: 'vertical', minHeight: 60,
 }} />
 <button onClick={() => handleResolve(t.id)} style={{
 marginTop: 8, padding: '6px 16px', background: '#22c55e',
 border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer',
 fontWeight: 600,
 }}>Submit Resolution</button>
 </div>
 )}
 </div>
 )}
 </div>
 ))}
 {filtered.length === 0 && (
 <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No tickets found</div>
 )}
 </div>
 </div>
 );
}
