'use client';

import { useState } from 'react';
import { Check, X, ArrowLeftRight, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { approvePriceRequest, rejectPriceRequest, counterProposePriceRequest } from '@/app/actions/supplier-portal';

const STATUS_COLORS: Record<string, string> = {
 PENDING: '#f59e0b', APPROVED: '#22c55e', REJECTED: '#ef4444',
 COUNTER: '#a855f7', ACCEPTED: '#06b6d4',
};

export default function PriceRequestClient({ requests: init }: any) {
 const [requests, setRequests] = useState<any[]>(init);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState('ALL');
 const [actionId, setActionId] = useState<number | null>(null);
 const [actionType, setActionType] = useState<string>('');
 const [actionText, setActionText] = useState('');
 const [counterPrice, setCounterPrice] = useState('');

 const filtered = requests.filter((r: any) => {
 if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
 return (r.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||
 (r.product_name || '').toLowerCase().includes(search.toLowerCase());
 });

 async function handleApprove(id: number) {
 await approvePriceRequest(id);
 setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'APPROVED' } : r));
 }
 async function handleReject(id: number) {
 await rejectPriceRequest(id, actionText);
 setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'REJECTED' } : r));
 setActionId(null); setActionText('');
 }
 async function handleCounter(id: number) {
 await counterProposePriceRequest(id, parseFloat(counterPrice), actionText);
 setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'COUNTER', counter_price: counterPrice } : r));
 setActionId(null); setActionText(''); setCounterPrice('');
 }

 const cardStyle: React.CSSProperties = {
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '1rem',
 };

 return (
 <div>
 <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', alignItems: 'center' }}>
 <div style={{
 flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem',
 background: '#0f172a', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
 }}>
 <Search size={16} color="#64748b" />
 <input value={search} onChange={e => setSearch(e.target.value)}
 placeholder="Search by supplier or product..."
 style={{ flex: 1, background: 'none', border: 'none', color: '#e2e8f0', outline: 'none' }} />
 </div>
 <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{
 padding: '0.5rem 1rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)',
 borderRadius: 8, color: '#e2e8f0',
 }}>
 <option value="ALL">All Statuses</option>
 {['PENDING', 'APPROVED', 'REJECTED', 'COUNTER', 'ACCEPTED'].map(s =>
 <option key={s} value={s}>{s}</option>
 )}
 </select>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
 {filtered.map((r: any) => {
 const isIncrease = r.proposed_price > r.current_price;
 const changePct = r.price_change_percent;

 return (
 <div key={r.id} style={cardStyle}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div style={{ flex: 1 }}>
 <div style={{ fontWeight: 600 }}>{r.product_name}</div>
 <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
 {r.supplier_name} · {r.request_type === 'SELLING' ? 'Selling Price' : 'Purchase Price'}
 </div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
 <div style={{ textAlign: 'center' }}>
 <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Current</div>
 <div style={{ fontWeight: 600 }}>{Number(r.current_price).toLocaleString()}</div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: isIncrease ? '#ef4444' : '#22c55e' }}>
 {isIncrease ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
 <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{changePct}%</span>
 </div>
 <div style={{ textAlign: 'center' }}>
 <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Proposed</div>
 <div style={{ fontWeight: 600, color: isIncrease ? '#ef4444' : '#22c55e' }}>
 {Number(r.proposed_price).toLocaleString()}
 </div>
 </div>
 {r.counter_price && (
 <div style={{ textAlign: 'center' }}>
 <div style={{ color: '#64748b', fontSize: '0.7rem', textTransform: 'uppercase' }}>Counter</div>
 <div style={{ fontWeight: 600, color: '#a855f7' }}>{Number(r.counter_price).toLocaleString()}</div>
 </div>
 )}
 <span style={{
 padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
 background: `${STATUS_COLORS[r.status]}20`, color: STATUS_COLORS[r.status],
 }}>
 {r.status}
 </span>
 </div>
 <div style={{ display: 'flex', gap: 6, marginLeft: 12 }}>
 {r.status === 'PENDING' && (
 <>
 <button onClick={() => handleApprove(r.id)} title="Approve"
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#22c55e' }}>
 <Check size={18} />
 </button>
 <button onClick={() => { setActionId(r.id); setActionType('reject'); }}
 title="Reject" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
 <X size={18} />
 </button>
 <button onClick={() => { setActionId(r.id); setActionType('counter'); }}
 title="Counter-Propose" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a855f7' }}>
 <ArrowLeftRight size={18} />
 </button>
 </>
 )}
 </div>
 </div>

 {r.reason && (
 <div style={{ marginTop: 8, color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
 &quot;{r.reason}&quot;
 </div>
 )}

 {actionId === r.id && (
 <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
 {actionType === 'counter' && (
 <input value={counterPrice} onChange={e => setCounterPrice(e.target.value)}
 placeholder="Counter price..." type="number"
 style={{ width: 120, padding: '0.5rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0' }} />
 )}
 <input value={actionText} onChange={e => setActionText(e.target.value)}
 placeholder={actionType === 'reject' ? 'Rejection reason...' : 'Notes...'}
 style={{ flex: 1, padding: '0.5rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#e2e8f0' }} />
 <button onClick={() => actionType === 'reject' ? handleReject(r.id) : handleCounter(r.id)}
 style={{
 padding: '0.5rem 1rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, color: '#fff',
 background: actionType === 'reject' ? '#ef4444' : '#a855f7',
 }}>
 {actionType === 'reject' ? 'Reject' : 'Send Counter'}
 </button>
 <button onClick={() => setActionId(null)} style={{ padding: '0.5rem', background: '#334155', border: 'none', borderRadius: 6, color: '#e2e8f0', cursor: 'pointer' }}>
 Cancel
 </button>
 </div>
 )}
 </div>
 );
 })}
 {filtered.length === 0 && (
 <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No price change requests found</div>
 )}
 </div>
 </div>
 );
}
