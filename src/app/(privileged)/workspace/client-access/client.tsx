'use client';
import { useState } from 'react';
import {
 ShieldCheck, ShieldOff, Pause, Plus, Search, QrCode,
 ShoppingCart, Eye, CreditCard, Star, TicketCheck, Grid2X2,
} from 'lucide-react';
import {
 createClientAccess, activateClientAccess, suspendClientAccess,
 revokeClientAccess, setClientPermissions, generateClientBarcode,
} from '@/app/actions/client-portal';
const ALL_PERMISSIONS = [
 { code: 'VIEW_ORDER_HISTORY', label: 'Order History', icon: Eye },
 { code: 'PLACE_ORDERS', label: 'Place Orders', icon: ShoppingCart },
 { code: 'VIEW_WALLET', label: 'View Wallet', icon: CreditCard },
 { code: 'REDEEM_LOYALTY', label: 'Redeem Loyalty', icon: Star },
 { code: 'SUBMIT_TICKETS', label: 'Submit Tickets', icon: TicketCheck },
 { code: 'VIEW_CATALOG', label: 'Browse Catalog', icon: Grid2X2 },
];
const STATUS_COLORS: Record<string, string> = {
 ACTIVE: 'var(--app-success)', SUSPENDED: 'var(--app-warning)', REVOKED: '#ef4444', PENDING: 'var(--app-muted-foreground)',
};
export default function ClientAccessClient({ accesses: init, customers }: any) {
 const [accesses, setAccesses] = useState<any[]>(init);
 const [search, setSearch] = useState('');
 const [showCreate, setShowCreate] = useState(false);
 const [editPerms, setEditPerms] = useState<number | null>(null);
 const [editPermsValues, setEditPermsValues] = useState<string[]>([]);
 const [newAccess, setNewAccess] = useState({ contact: '', user: '' });
 const filtered = accesses.filter((a: any) =>
 (a.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
 (a.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
 (a.barcode || '').toLowerCase().includes(search.toLowerCase())
 );
 async function handleCreate() {
 if (!newAccess.contact) return;
 try {
 const result = await createClientAccess(newAccess);
 setAccesses(prev => [...prev, result]);
 setShowCreate(false);
 setNewAccess({ contact: '', user: '' });
 } catch (e) { console.error(e); }
 }
 async function handleActivate(id: number) {
 const result = await activateClientAccess(id);
 setAccesses(prev => prev.map(a => a.id === id ? { ...a, status: 'ACTIVE', barcode: result.barcode } : a));
 }
 async function handleSuspend(id: number) {
 await suspendClientAccess(id);
 setAccesses(prev => prev.map(a => a.id === id ? { ...a, status: 'SUSPENDED' } : a));
 }
 async function handleRevoke(id: number) {
 await revokeClientAccess(id);
 setAccesses(prev => prev.map(a => a.id === id ? { ...a, status: 'REVOKED' } : a));
 }
 async function handleGenBarcode(id: number) {
 const result = await generateClientBarcode(id);
 setAccesses(prev => prev.map(a => a.id === id ? { ...a, barcode: result.barcode } : a));
 }
 async function handleSavePerms(id: number) {
 await setClientPermissions(id, editPermsValues);
 setAccesses(prev => prev.map(a => a.id === id ? { ...a, permissions: editPermsValues } : a));
 setEditPerms(null);
 }
 const cardStyle: React.CSSProperties = {
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12, border: '1px solid var(--app-surface)',
 };
 return (
 <div>
 <div style={{ display: 'flex', gap: 12, marginBottom: '1.5rem', alignItems: 'center' }}>
 <div style={{
 flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem',
 background: 'var(--app-background)', borderRadius: 8, border: '1px solid var(--app-surface)',
 }}>
 <Search size={16} color="var(--app-muted-foreground)" />
 <input value={search} onChange={e => setSearch(e.target.value)}
 placeholder="Search clients..." style={{ flex: 1, background: 'none', border: 'none', color: 'var(--app-border)', outline: 'none' }} />
 </div>
 <button onClick={() => setShowCreate(true)} style={{
 display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1rem',
 background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
 borderRadius: 8, cursor: 'pointer', fontWeight: 600,
 }}>
 <Plus size={16} /> Grant Access
 </button>
 </div>
 {showCreate && (
 <div style={{ ...cardStyle, padding: '1.25rem', marginBottom: '1.5rem' }}>
 <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Grant New Client Access</h3>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12 }}>
 <select value={newAccess.contact} onChange={e => setNewAccess(prev => ({ ...prev, contact: e.target.value }))}
 style={{ padding: '0.5rem', background: 'var(--app-background)', border: '1px solid var(--app-surface)', borderRadius: 6, color: 'var(--app-border)' }}>
 <option value="">Select Customer...</option>
 {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 <input placeholder="User ID" value={newAccess.user}
 onChange={e => setNewAccess(prev => ({ ...prev, user: e.target.value }))}
 style={{ padding: '0.5rem', background: 'var(--app-background)', border: '1px solid var(--app-surface)', borderRadius: 6, color: 'var(--app-border)' }} />
 <button onClick={handleCreate} style={{
 padding: '0.5rem 1rem', background: 'var(--app-success)', border: 'none',
 borderRadius: 6, cursor: 'pointer', fontWeight: 600,
 }}>Create</button>
 </div>
 </div>
 )}
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
 {filtered.map((a: any) => (
 <div key={a.id} style={{ ...cardStyle, padding: '1rem' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div>
 <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{a.contact_name}</div>
 <div style={{ color: 'var(--app-muted-foreground)', fontSize: '0.85rem' }}>
 {a.user_email}
 {a.barcode && <span style={{ marginLeft: 8, color: 'var(--app-info)' }}>📱 {a.barcode}</span>}
 </div>
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <span style={{
 padding: '2px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
 background: `${STATUS_COLORS[a.status]}20`, color: STATUS_COLORS[a.status],
 }}>{a.status}</span>
 {a.status !== 'ACTIVE' && (
 <button onClick={() => handleActivate(a.id)} title="Activate"
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-success)' }}>
 <ShieldCheck size={18} />
 </button>
 )}
 {a.status === 'ACTIVE' && (
 <button onClick={() => handleSuspend(a.id)} title="Suspend"
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-warning)' }}>
 <Pause size={18} />
 </button>
 )}
 <button onClick={() => handleRevoke(a.id)} title="Revoke"
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
 <ShieldOff size={18} />
 </button>
 {!a.barcode && (
 <button onClick={() => handleGenBarcode(a.id)} title="Generate Barcode"
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--app-info)' }}>
 <QrCode size={18} />
 </button>
 )}
 <button onClick={() => { setEditPerms(a.id); setEditPermsValues(a.permissions || []); }}
 title="Edit Permissions"
 style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1' }}>
 <Eye size={18} />
 </button>
 </div>
 </div>
 <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
 {(a.permissions || []).map((p: string) => {
 const pm = ALL_PERMISSIONS.find(x => x.code === p);
 return (
 <span key={p} style={{
 display: 'flex', alignItems: 'center', gap: 4,
 padding: '2px 8px', borderRadius: 6, fontSize: '0.75rem',
 background: 'var(--app-primary)', color: '#818cf8',
 }}>
 {pm && <pm.icon size={12} />} {pm?.label || p}
 </span>
 );
 })}
 </div>
 {editPerms === a.id && (
 <div style={{ marginTop: 12, padding: 12, background: 'var(--app-background)', borderRadius: 8 }}>
 <div style={{ fontWeight: 600, marginBottom: 8, fontSize: '0.85rem' }}>Edit Permissions</div>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
 {ALL_PERMISSIONS.map(pm => (
 <label key={pm.code} style={{
 display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
 padding: '4px 8px', borderRadius: 6, fontSize: '0.8rem',
 background: editPermsValues.includes(pm.code) ? 'var(--app-primary)' : 'transparent',
 color: editPermsValues.includes(pm.code) ? '#818cf8' : 'var(--app-muted-foreground)',
 }}>
 <input type="checkbox" checked={editPermsValues.includes(pm.code)}
 onChange={e => {
 if (e.target.checked) setEditPermsValues(v => [...v, pm.code]);
 else setEditPermsValues(v => v.filter(x => x !== pm.code));
 }} />
 <pm.icon size={14} /> {pm.label}
 </label>
 ))}
 </div>
 <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
 <button onClick={() => handleSavePerms(a.id)} style={{
 padding: '4px 12px', background: '#6366f1', border: 'none',
 borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
 }}>Save</button>
 <button onClick={() => setEditPerms(null)} style={{
 padding: '4px 12px', background: '#334155', border: 'none',
 borderRadius: 6, color: 'var(--app-border)', cursor: 'pointer', fontSize: '0.8rem',
 }}>Cancel</button>
 </div>
 </div>
 )}
 </div>
 ))}
 {filtered.length === 0 && (
 <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--app-muted-foreground)' }}>No client portal accesses found</div>
 )}
 </div>
 </div>
 );
}
