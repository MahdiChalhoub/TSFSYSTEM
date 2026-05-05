'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import {
 Plus, Trash2, Save, ArrowLeft, Shield, Monitor, Users, Key,
 CreditCard, Banknote, Smartphone, Truck, Wallet, Building2,
 Lock, Unlock, Edit, Check, X, AlertTriangle, Eye, EyeOff,
 ChevronDown, ChevronRight, Loader2, RefreshCw, Hash, Settings2
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

// ── Types ──
type PaymentMethodConfig = { key: string; label: string; accountId: number | null };
type FinancialAccount = { id: number; name: string; type: string; currency: string };
type SiteData = { id: number; name: string; code: string };
type UserData = { id: number; username: string; first_name: string; last_name: string; email: string; pos_pin?: boolean; role?: string };
type RegisterData = {
 id: number; name: string; siteId: number; siteName: string;
 warehouseId?: number; cashAccountId?: number; isActive: boolean; isOpen: boolean;
};
type WarehouseData = { id: number; name: string; parent: number | null };

const ICONS: Record<string, any> = { CASH: Banknote, CARD: CreditCard, WALLET: Wallet, OM: Smartphone, WAVE: Smartphone, DELIVERY: Truck };
const PRESET_METHODS = ['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'MULTI', 'DELIVERY', 'CREDIT', 'CHECK', 'TRANSFER'];

type TabId = 'registers' | 'users' | 'payments' | 'security';

export default function POSSettingsPage() {
 const [activeTab, setActiveTab] = useState<TabId>('registers');
 const [loading, setLoading] = useState(true);

 // Data stores
 const [sites, setSites] = useState<SiteData[]>([]);
 const [users, setUsers] = useState<UserData[]>([]);
 const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
 const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
 const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
 const [lobbyData, setLobbyData] = useState<any[]>([]);

 // Load all data
 const loadData = useCallback(async () => {
 setLoading(true);
 try {
 const [sitesRes, usersRes, acctsRes, whRes, methodsRes, lobbyRes] = await Promise.all([
 erpFetch('erp/sites/').catch(() => []),
 erpFetch('erp/users/').catch(() => []),
 erpFetch('accounts/').catch(() => []),
 erpFetch('inventory/warehouses/').catch(() => []),
 erpFetch('settings/item/pos_payment_methods/').catch(() => null),
 erpFetch('pos-registers/lobby/').catch(() => []),
 ]);
 const sitesArray = Array.isArray(sitesRes) ? sitesRes : sitesRes?.results || [];
 const lobbyArray = Array.isArray(lobbyRes) ? lobbyRes : [];
 // Fallback: if /sites/ returned empty but lobby has branches, use lobby data as sites
 const effectiveSites = sitesArray.length > 0 ? sitesArray : lobbyArray.map((s: any) => ({ id: s.id, name: s.name, code: s.code || '' }));
 setSites(effectiveSites);
 setUsers(Array.isArray(usersRes) ? usersRes : usersRes?.results || []);
 setAccounts(Array.isArray(acctsRes) ? acctsRes : acctsRes?.results || []);
 setWarehouses(Array.isArray(whRes) ? whRes : whRes?.results || []);
 setLobbyData(lobbyArray);
 // Payment methods
 if (methodsRes && Array.isArray(methodsRes) && methodsRes.length > 0) {
 setMethods(methodsRes.map((m: any) => typeof m === 'string' ? { key: m, label: m, accountId: null } : { key: m.key, label: m.label || m.key, accountId: m.accountId || null }));
 } else {
 setMethods([
 { key: 'CASH', label: 'Cash', accountId: null },
 { key: 'CARD', label: 'Card', accountId: null },
 { key: 'WALLET', label: 'Wallet', accountId: null },
 { key: 'WAVE', label: 'Wave', accountId: null },
 { key: 'OM', label: 'OM', accountId: null },
 { key: 'MULTI', label: 'Multi', accountId: null },
 { key: 'DELIVERY', label: 'Delivery', accountId: null },
 ]);
 }
 } catch (e) {
 toast.error('Failed to load settings data');
 }
 setLoading(false);
 }, []);

 useEffect(() => { loadData(); }, [loadData]);

 const tabs = [
 { id: 'registers' as TabId, label: 'Registers', icon: Monitor, desc: 'POS terminals & sessions' },
 { id: 'users' as TabId, label: 'Users & PINs', icon: Key, desc: 'Cashier access & PINs' },
 { id: 'payments' as TabId, label: 'Payment Methods', icon: CreditCard, desc: 'Configure payment options' },
 { id: 'security' as TabId, label: 'Security', icon: Shield, desc: 'Rules & access control' },
 ];

 if (loading) {
 return (
 <div className="app-page flex items-center justify-center h-screen bg-app-background">
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-warning)20', border: `1px solid $var(--app-warning)40` }}>
        <Settings2 size={26} style={{ color: 'var(--app-warning)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">POS Settings</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Point of sale configuration</p>
      </div>
    </div>
  </header>
 <div className="text-center">
 <Loader2 size={32} className="text-app-primary animate-spin mx-auto mb-3" />
 <p className="text-sm text-app-muted-foreground font-bold">Loading POS Settings...</p>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-app-background">
 {/* Header */}
 <div className="bg-app-surface border-b border-app-border px-6 py-4">
 <div className="max-w-6xl mx-auto flex items-center justify-between">
 <div className="flex items-center gap-4">
 <Link href="/inventory" className="p-2 rounded-lg hover:bg-app-surface-2 transition-colors">
 <ArrowLeft size={20} className="text-app-muted-foreground" />
 </Link>
 <div>
 <h1 className="text-xl font-black text-app-foreground">POS Configuration</h1>
 <p className="text-xs text-app-muted-foreground mt-0.5">Registers, cashiers, payment methods & security</p>
 </div>
 </div>
 <button onClick={loadData} className="p-2 rounded-lg hover:bg-app-surface-2 text-app-muted-foreground hover:text-app-muted-foreground transition-all">
 <RefreshCw size={16} />
 </button>
 </div>
 </div>

 <div className="max-w-6xl mx-auto py-6 px-6 flex gap-6">
 {/* Sidebar Tabs */}
 <div className="w-56 shrink-0 space-y-1">
 {tabs.map(tab => {
 const Icon = tab.icon;
 return (
 <button
 key={tab.id}
 onClick={() => setActiveTab(tab.id)}
 className={clsx(
 "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all",
 activeTab === tab.id
 ? "bg-app-primary/5 text-app-primary shadow-sm border border-app-primary/30"
 : "bg-app-surface hover:bg-app-background text-app-muted-foreground border border-transparent"
 )}
 >
 <Icon size={18} className={activeTab === tab.id ? "text-app-primary" : "text-app-muted-foreground"} />
 <div>
 <p className="text-sm font-bold">{tab.label}</p>
 <p className="text-[10px] text-app-muted-foreground">{tab.desc}</p>
 </div>
 </button>
 );
 })}
 </div>

 {/* Content */}
 <div className="flex-1 min-w-0">
 {activeTab === 'registers' && (
 <RegistersTab sites={sites} accounts={accounts} warehouses={warehouses} users={users} lobbyData={lobbyData} onRefresh={loadData} />
 )}
 {activeTab === 'users' && (
 <UsersTab users={users} lobbyData={lobbyData} onRefresh={loadData} />
 )}
 {activeTab === 'payments' && (
 <PaymentsTab methods={methods} setMethods={setMethods} accounts={accounts} />
 )}
 {activeTab === 'security' && (
 <SecurityTab />
 )}
 </div>
 </div>
 </div>
 );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 1: REGISTERS
// ═══════════════════════════════════════════════════════════════════
function RegistersTab({ sites, accounts, warehouses, users, lobbyData, onRefresh }: {
 sites: SiteData[]; accounts: FinancialAccount[]; warehouses: WarehouseData[];
 users: UserData[]; lobbyData: any[]; onRefresh: () => void;
}) {
 const [showCreate, setShowCreate] = useState(false);
 const [editId, setEditId] = useState<number | null>(null);
 const [saving, setSaving] = useState(false);

 // Create form
 const [form, setForm] = useState({
 name: '', siteId: '', warehouseId: '', cashAccountId: '',
 allowedAccountIds: [] as number[], authorizedUserIds: [] as number[],
 });

 const handleCreate = async () => {
 if (!form.name || !form.siteId) {
 toast.error('Name and Site are required');
 return;
 }
 setSaving(true);
 try {
 await erpFetch('pos-registers/create-register/', {
 method: 'POST',
 body: JSON.stringify({
 name: form.name,
 site_id: Number(form.siteId),
 warehouse_id: form.warehouseId ? Number(form.warehouseId) : null,
 cash_account_id: form.cashAccountId ? Number(form.cashAccountId) : null,
 allowed_account_ids: form.allowedAccountIds,
 authorized_user_ids: form.authorizedUserIds,
 })
 });
 toast.success(`Register "${form.name}" created!`);
 setShowCreate(false);
 setForm({ name: '', siteId: '', warehouseId: '', cashAccountId: '', allowedAccountIds: [], authorizedUserIds: [] });
 onRefresh();
 } catch (e) {
 toast.error('Failed to create register');
 }
 setSaving(false);
 };

 const handleUpdate = async () => {
 if (!editId) return;
 setSaving(true);
 try {
 await erpFetch('pos-registers/update-register/', {
 method: 'POST',
 body: JSON.stringify({
 id: editId,
 name: form.name,
 warehouse_id: form.warehouseId ? Number(form.warehouseId) : null,
 cash_account_id: form.cashAccountId ? Number(form.cashAccountId) : null,
 allowed_account_ids: form.allowedAccountIds,
 authorized_user_ids: form.authorizedUserIds,
 })
 });
 toast.success('Register updated!');
 setEditId(null);
 onRefresh();
 } catch (e) {
 toast.error('Failed to update register');
 }
 setSaving(false);
 };

 // Flatten lobby data for display
 const allRegisters: any[] = [];
 lobbyData.forEach((site: any) => {
 (site.registers || []).forEach((reg: any) => {
 allRegisters.push({ ...reg, siteName: site.name, siteId: site.id });
 });
 });

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-black text-app-foreground">POS Registers</h2>
 <p className="text-xs text-app-muted-foreground">Physical terminals at each site with their own cash accounts</p>
 </div>
 <button
 onClick={() => { setShowCreate(!showCreate); setEditId(null); }}
 className="flex items-center gap-2 px-4 py-2 bg-app-primary text-app-foreground rounded-xl font-bold text-sm hover:bg-app-primary transition-all shadow-lg shadow-indigo-100"
 >
 <Plus size={16} />
 New Register
 </button>
 </div>

 {/* Create / Edit Form */}
 {(showCreate || editId) && (
 <div className="bg-app-surface rounded-2xl border border-app-primary/30 p-5 space-y-4 shadow-sm animate-in slide-in-from-top-2">
 <h3 className="font-black text-sm text-app-primary">{editId ? 'Edit Register' : 'Create New Register'}</h3>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-1">Register Name *</label>
 <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
 placeholder="e.g. Caisse 1" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-app-primary focus:border-app-primary/30" />
 </div>
 {!editId && (
 <div>
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-1">Branch / Location *</label>
 <select value={form.siteId} onChange={(e) => setForm(f => ({ ...f, siteId: e.target.value }))}
 className="w-full px-3 py-2 border border-app-border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-app-primary">
 <option value="">Select branch...</option>
 {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
 </select>
 </div>
 )}
 <div>
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-1">Warehouse</label>
 <select value={form.warehouseId} onChange={(e) => setForm(f => ({ ...f, warehouseId: e.target.value }))}
 className="w-full px-3 py-2 border border-app-border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-app-primary">
 <option value="">Default warehouse</option>
 {warehouses.filter(w => !form.siteId || w.parent === Number(form.siteId)).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 </div>
 <div>
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-1">Cash Account</label>
 <select value={form.cashAccountId} onChange={(e) => setForm(f => ({ ...f, cashAccountId: e.target.value }))}
 className="w-full px-3 py-2 border border-app-border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-app-primary">
 <option value="">No dedicated cash account</option>
 {accounts.filter(a => a.type === 'CASH' || a.type === 'PETTY_CASH').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
 </select>
 </div>
 </div>

 {/* Allowed Payment Accounts */}
 <div>
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-2">Allowed Payment Accounts</label>
 <div className="flex flex-wrap gap-2">
 {accounts.filter(a => a.type !== 'SAVINGS' && a.type !== 'INVESTMENT').map(acc => (
 <button key={acc.id}
 onClick={() => setForm(f => ({
 ...f,
 allowedAccountIds: f.allowedAccountIds.includes(acc.id)
 ? f.allowedAccountIds.filter(id => id !== acc.id)
 : [...f.allowedAccountIds, acc.id]
 }))}
 className={clsx(
 "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
 form.allowedAccountIds.includes(acc.id)
 ? "bg-app-primary-light border-app-success text-app-success"
 : "bg-app-background border-app-border text-app-muted-foreground hover:border-app-border"
 )}>
 {form.allowedAccountIds.includes(acc.id) ? <Check size={10} className="inline mr-1" /> : null}
 {acc.name}
 </button>
 ))}
 </div>
 </div>

 {/* Authorized Users */}
 <div>
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest block mb-2">Authorized Cashiers</label>
 <div className="flex flex-wrap gap-2">
 {users.map(u => (
 <button key={u.id}
 onClick={() => setForm(f => ({
 ...f,
 authorizedUserIds: f.authorizedUserIds.includes(u.id)
 ? f.authorizedUserIds.filter(id => id !== u.id)
 : [...f.authorizedUserIds, u.id]
 }))}
 className={clsx(
 "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5",
 form.authorizedUserIds.includes(u.id)
 ? "bg-app-primary/5 border-app-primary/30 text-app-primary"
 : "bg-app-background border-app-border text-app-muted-foreground hover:border-app-border"
 )}>
 <Users size={10} />
 {u.first_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}
 </button>
 ))}
 </div>
 </div>

 <div className="flex justify-end gap-2 pt-2">
 <button onClick={() => { setShowCreate(false); setEditId(null); }}
 className="px-4 py-2 text-app-muted-foreground text-sm font-bold hover:bg-app-surface-2 rounded-lg transition-all">Cancel</button>
 <button onClick={editId ? handleUpdate : handleCreate} disabled={saving}
 className="flex items-center gap-2 px-5 py-2 bg-app-primary text-app-foreground rounded-xl font-bold text-sm hover:bg-app-primary disabled:opacity-50 transition-all shadow">
 {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
 {editId ? 'Update' : 'Create'}
 </button>
 </div>
 </div>
 )}

 {/* Register List */}
 {sites.map(site => {
 const siteRegisters = allRegisters.filter(r => r.siteId === site.id);
 return (
 <div key={site.id} className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm">
 <div className="px-4 py-3 bg-app-background border-b border-app-border flex items-center gap-2">
 <Building2 size={14} className="text-app-muted-foreground" />
 <span className="text-sm font-black text-app-muted-foreground">{site.name}</span>
 <span className="text-[10px] text-app-muted-foreground font-mono">{site.code || ''}</span>
 <span className="ml-auto text-[10px] font-bold text-app-muted-foreground">{siteRegisters.length} register(s)</span>
 </div>
 {siteRegisters.length === 0 ? (
 <div className="px-4 py-8 text-center text-app-muted-foreground text-sm">No registers at this site</div>
 ) : (
 <div className="divide-y divide-app-border">
 {siteRegisters.map((reg: any) => (
 <div key={reg.id} className="px-4 py-3 flex items-center gap-4 hover:bg-app-surface-2/50 transition-colors">
 <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
 reg.isOpen ? "bg-app-primary-light text-app-primary" : "bg-app-surface-2 text-app-muted-foreground")}>
 <Monitor size={20} />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-black text-app-foreground">{reg.name}</p>
 <div className="flex items-center gap-2 mt-0.5">
 {reg.isOpen ? (
 <span className="flex items-center gap-1 text-[10px] font-bold text-app-primary bg-app-primary-light px-1.5 py-0.5 rounded">
 <Unlock size={8} /> Open — {reg.currentSession?.cashierName}
 </span>
 ) : (
 <span className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground bg-app-background px-1.5 py-0.5 rounded">
 <Lock size={8} /> Closed
 </span>
 )}
 {reg.cashAccountName && (
 <span className="text-[10px] font-bold text-app-warning bg-app-warning-bg px-1.5 py-0.5 rounded">
 💰 {reg.cashAccountName}
 </span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-1.5">
 {reg.authorizedUsers?.slice(0, 3).map((u: any) => (
 <span key={u.id} className="w-7 h-7 rounded-full bg-app-primary/5 text-app-primary flex items-center justify-center text-[9px] font-black" title={u.name}>
 {u.name?.substring(0, 2).toUpperCase()}
 </span>
 ))}
 {(reg.authorizedUsers?.length || 0) > 3 && (
 <span className="text-[9px] text-app-muted-foreground">+{reg.authorizedUsers.length - 3}</span>
 )}
 </div>
 <button
 onClick={() => {
 setEditId(reg.id);
 setShowCreate(false);
 setForm({
 name: reg.name,
 siteId: String(reg.siteId),
 warehouseId: reg.warehouseId ? String(reg.warehouseId) : '',
 cashAccountId: reg.cashAccountId ? String(reg.cashAccountId) : '',
 allowedAccountIds: reg.allowedAccounts?.map((a: any) => a.id) || [],
 authorizedUserIds: reg.authorizedUsers?.map((u: any) => u.id) || [],
 });
 }}
 className="p-2 rounded-lg hover:bg-app-primary/5 text-app-muted-foreground hover:text-app-primary transition-all">
 <Edit size={14} />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 })}

 {sites.length === 0 && (
 <div className="bg-app-warning-bg border border-app-warning/30 rounded-xl p-6 text-center">
 <AlertTriangle size={24} className="text-app-warning mx-auto mb-2" />
 <p className="text-sm font-bold text-app-warning">No sites configured</p>
 <p className="text-xs text-app-warning mt-1">
 Create locations first in <Link href="/inventory/warehouses" className="underline">Inventory → Locations</Link>
 </p>
 </div>
 )}
 </div>
 );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 2: USERS & PINs
// ═══════════════════════════════════════════════════════════════════
function UsersTab({ users, lobbyData, onRefresh }: { users: UserData[]; lobbyData: any[]; onRefresh: () => void }) {
 const [pinInputs, setPinInputs] = useState<Record<number, string>>({});
 const [overridePinInputs, setOverridePinInputs] = useState<Record<number, string>>({});
 const [savingPinFor, setSavingPinFor] = useState<number | null>(null);
 const [savingOverrideFor, setSavingOverrideFor] = useState<number | null>(null);
 const [showPinFor, setShowPinFor] = useState<number | null>(null);
 const [showOverrideFor, setShowOverrideFor] = useState<number | null>(null);

 // Build a map of which registers each user is assigned to
 const userRegisterMap: Record<number, string[]> = {};
 lobbyData.forEach((site: any) => {
 (site.registers || []).forEach((reg: any) => {
 (reg.authorizedUsers || []).forEach((u: any) => {
 if (!userRegisterMap[u.id]) userRegisterMap[u.id] = [];
 userRegisterMap[u.id].push(`${reg.name} (${site.name})`);
 });
 });
 });

 const handleSetPin = async (userId: number) => {
 const pin = pinInputs[userId];
 if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
 toast.error('PIN must be 4-6 digits'); return;
 }
 setSavingPinFor(userId);
 try {
 const res = await erpFetch('pos-registers/set-pin/', { method: 'POST', body: JSON.stringify({ user_id: userId, pin }) });
 if (res?.error) toast.error(res.error);
 else { toast.success(res.message || 'PIN set!'); setPinInputs(p => ({ ...p, [userId]: '' })); onRefresh(); }
 } catch (e) { toast.error('Failed to set PIN'); }
 setSavingPinFor(null);
 };

 const handleSetOverridePin = async (userId: number) => {
 const pin = overridePinInputs[userId];
 if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
 toast.error('PIN must be 4-6 digits'); return;
 }
 setSavingOverrideFor(userId);
 try {
 const res = await erpFetch('pos-registers/set-override-pin/', { method: 'POST', body: JSON.stringify({ user_id: userId, pin }) });
 if (res?.error) toast.error(res.error);
 else { toast.success(res.message || 'Override PIN set!'); setOverridePinInputs(p => ({ ...p, [userId]: '' })); onRefresh(); }
 } catch (e) { toast.error('Failed to set override PIN'); }
 setSavingOverrideFor(null);
 };

 return (
 <div className="space-y-6">
 <div>
 <h2 className="text-lg font-black text-app-foreground">Users & PIN Codes</h2>
 <p className="text-xs text-app-muted-foreground">Manage cashier PINs (POS login) and manager override PINs (security authorizations)</p>
 </div>

 {/* ── Section 1: Cashier PINs ── */}
 <div>
 <h3 className="text-xs font-black text-app-primary uppercase tracking-widest mb-2 flex items-center gap-2">
 <Key size={12} /> Cashier PINs — POS Login
 </h3>
 <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm">
 <div className="grid grid-cols-[1fr_100px_1fr_160px] gap-3 px-4 py-3 bg-app-background border-b border-app-border">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">User</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Status</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Registers</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Set / Change</span>
 </div>
 {users.map(user => {
 const hasPin = (user as any).pos_pin || false;
 const assignedRegisters = userRegisterMap[user.id] || [];
 return (
 <div key={user.id} className="grid grid-cols-[1fr_100px_1fr_160px] gap-3 px-4 py-2.5 border-b border-app-border items-center hover:bg-app-surface-2/50">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-lg bg-app-primary/5 text-app-primary flex items-center justify-center font-black text-[10px] shrink-0">
 {(user.first_name || user.username || '?').substring(0, 2).toUpperCase()}
 </div>
 <div className="min-w-0">
 <p className="text-xs font-bold text-app-foreground truncate">
 {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.username}
 </p>
 </div>
 </div>
 <div>
 {hasPin ? (
 <span className="flex items-center gap-1 text-[10px] font-bold text-app-primary bg-app-primary-light px-1.5 py-0.5 rounded">
 <Check size={8} /> Set
 </span>
 ) : (
 <span className="flex items-center gap-1 text-[10px] font-bold text-app-warning bg-app-warning-bg px-1.5 py-0.5 rounded">
 <AlertTriangle size={8} /> None
 </span>
 )}
 </div>
 <div className="flex flex-wrap gap-1">
 {assignedRegisters.length === 0 ? (
 <span className="text-[10px] text-app-muted-foreground">—</span>
 ) : assignedRegisters.map((r, i) => (
 <span key={i} className="text-[9px] font-bold text-app-primary bg-app-primary/5 px-1 py-0.5 rounded">{r}</span>
 ))}
 </div>
 <div className="flex items-center gap-1">
 <div className="relative flex-1">
 <input
 type={showPinFor === user.id ? "text" : "password"}
 value={pinInputs[user.id] || ''}
 onChange={(e) => setPinInputs(p => ({ ...p, [user.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
 placeholder="PIN" maxLength={6}
 className="w-full px-2 py-1 border border-app-border rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-app-primary text-center"
 />
 <button onClick={() => setShowPinFor(showPinFor === user.id ? null : user.id)}
 className="absolute right-1 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-muted-foreground">
 {showPinFor === user.id ? <EyeOff size={10} /> : <Eye size={10} />}
 </button>
 </div>
 <button onClick={() => handleSetPin(user.id)}
 disabled={savingPinFor === user.id || !(pinInputs[user.id]?.length >= 4)}
 className="p-1 rounded-lg bg-app-primary text-app-foreground hover:bg-app-primary disabled:opacity-30 transition-all shrink-0">
 {savingPinFor === user.id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* ── Section 2: Manager Override PINs ── */}
 <div>
 <h3 className="text-xs font-black text-app-error uppercase tracking-widest mb-2 flex items-center gap-2">
 <Shield size={12} /> Manager Override PINs — Security Authorization
 </h3>
 <p className="text-[10px] text-app-muted-foreground mb-2">
 Managers use this PIN to authorize: <b>void, refund, clear cart, delete item, decrease qty, discount, price override</b>
 </p>
 <div className="bg-app-surface rounded-2xl border border-rose-100 overflow-hidden shadow-sm">
 <div className="grid grid-cols-[1fr_120px_200px] gap-3 px-4 py-3 bg-app-error-bg/50 border-b border-rose-100">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">User</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Override PIN Status</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Set / Change Override PIN</span>
 </div>
 {users.map(user => {
 const hasOverride = (user as any).has_override_pin || false;
 return (
 <div key={user.id} className="grid grid-cols-[1fr_120px_200px] gap-3 px-4 py-2.5 border-b border-app-border items-center hover:bg-app-surface-2/50">
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-lg bg-app-error-bg text-app-error flex items-center justify-center font-black text-[10px] shrink-0">
 <Shield size={14} />
 </div>
 <div className="min-w-0">
 <p className="text-xs font-bold text-app-foreground truncate">
 {user.first_name ? `${user.first_name} ${user.last_name}`.trim() : user.username}
 </p>
 <p className="text-[9px] text-app-muted-foreground">{user.role || 'User'}</p>
 </div>
 </div>
 <div>
 {hasOverride ? (
 <span className="flex items-center gap-1 text-[10px] font-bold text-app-primary bg-app-primary-light px-1.5 py-0.5 rounded">
 <Check size={8} /> Can Authorize
 </span>
 ) : (
 <span className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground bg-app-background px-1.5 py-0.5 rounded">
 <Lock size={8} /> Not a Manager
 </span>
 )}
 </div>
 <div className="flex items-center gap-1">
 <div className="relative flex-1">
 <input
 type={showOverrideFor === user.id ? "text" : "password"}
 value={overridePinInputs[user.id] || ''}
 onChange={(e) => setOverridePinInputs(p => ({ ...p, [user.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
 placeholder="Override PIN" maxLength={6}
 className="w-full px-2 py-1 border border-app-error rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-rose-200 text-center"
 />
 <button onClick={() => setShowOverrideFor(showOverrideFor === user.id ? null : user.id)}
 className="absolute right-1 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-muted-foreground">
 {showOverrideFor === user.id ? <EyeOff size={10} /> : <Eye size={10} />}
 </button>
 </div>
 <button onClick={() => handleSetOverridePin(user.id)}
 disabled={savingOverrideFor === user.id || !(overridePinInputs[user.id]?.length >= 4)}
 className="p-1 rounded-lg bg-app-error text-app-foreground hover:bg-app-error disabled:opacity-30 transition-all shrink-0">
 {savingOverrideFor === user.id ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Info */}
 <div className="bg-app-info-bg border border-app-info/30 rounded-xl p-4">
 <h3 className="text-xs font-black text-app-info uppercase tracking-wider mb-2">How PINs Work</h3>
 <ul className="text-xs text-app-info space-y-1 font-medium">
 <li>• <b>Cashier PIN</b> — Used to log into a POS register at the lobby screen</li>
 <li>• <b>Manager Override PIN</b> — Used to authorize sensitive actions (void, discount, delete, qty decrease, clear cart, refund, price override)</li>
 <li>• Both PINs are <b>4-6 digits</b>, hashed securely (admins cannot see existing PINs)</li>
 <li>• A user can have <b>both</b> PINs — one for login, one for overrides</li>
 <li>• Only users with an override PIN can authorize protected actions on any register</li>
 </ul>
 </div>
 </div>
 );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 3: PAYMENT METHODS
// ═══════════════════════════════════════════════════════════════════
function PaymentsTab({ methods, setMethods, accounts }: {
 methods: PaymentMethodConfig[]; setMethods: (m: PaymentMethodConfig[]) => void; accounts: FinancialAccount[];
}) {
 const [saving, setSaving] = useState(false);
 const [newMethodKey, setNewMethodKey] = useState('');

 const handleSave = async () => {
 setSaving(true);
 try {
 await erpFetch('settings/item/pos_payment_methods/', {
 method: 'POST',
 body: JSON.stringify(methods)
 });
 toast.success('Payment methods saved!');
 } catch (e) { toast.error('Failed to save'); }
 setSaving(false);
 };

 const addMethod = () => {
 const key = newMethodKey.trim().toUpperCase();
 if (!key || methods.find(m => m.key === key)) { toast.error(`"${key}" already exists`); return; }
 setMethods([...methods, { key, label: key, accountId: null }]);
 setNewMethodKey('');
 };

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-black text-app-foreground">Payment Methods</h2>
 <p className="text-xs text-app-muted-foreground">Configure POS payment buttons and link them to financial accounts</p>
 </div>
 <button onClick={handleSave} disabled={saving}
 className="flex items-center gap-2 px-5 py-2 bg-app-primary text-app-foreground rounded-xl font-bold text-sm hover:bg-app-primary disabled:opacity-50 shadow-lg shadow-emerald-100 transition-all">
 {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
 Save
 </button>
 </div>

 <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-sm">
 <div className="grid grid-cols-[40px_1fr_120px_200px_40px] gap-3 px-4 py-3 bg-app-background border-b border-app-border">
 <span className="text-[10px] font-black text-app-muted-foreground uppercase">#</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase">Label</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase">Key</span>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase">Account</span>
 <span />
 </div>
 {methods.map((method, idx) => {
 const Icon = ICONS[method.key] || CreditCard;
 return (
 <div key={method.key} className="grid grid-cols-[40px_1fr_120px_200px_40px] gap-3 px-4 py-3 border-b border-app-border items-center hover:bg-app-surface-2/50">
 <div className="flex flex-col items-center gap-0.5">
 <button onClick={() => { const arr = [...methods]; if (idx > 0) [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; setMethods(arr); }}
 disabled={idx === 0} className="text-app-muted-foreground hover:text-app-muted-foreground disabled:opacity-20 text-[10px]">▲</button>
 <button onClick={() => { const arr = [...methods]; if (idx < arr.length - 1) [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; setMethods(arr); }}
 disabled={idx === methods.length - 1} className="text-app-muted-foreground hover:text-app-muted-foreground disabled:opacity-20 text-[10px]">▼</button>
 </div>
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-app-primary-light flex items-center justify-center text-app-primary shrink-0">
 <Icon size={16} />
 </div>
 <input type="text" value={method.label}
 onChange={(e) => { const arr = [...methods]; arr[idx] = { ...arr[idx], label: e.target.value }; setMethods(arr); }}
 className="text-sm font-bold text-app-foreground bg-transparent border-b border-transparent hover:border-app-border focus:border-app-primary outline-none py-1 w-full" />
 </div>
 <span className="text-xs font-mono text-app-muted-foreground bg-app-surface-2 px-2 py-1 rounded text-center">{method.key}</span>
 <select value={method.accountId || ''}
 onChange={(e) => { const arr = [...methods]; arr[idx] = { ...arr[idx], accountId: e.target.value ? Number(e.target.value) : null }; setMethods(arr); }}
 className={clsx("text-xs font-bold rounded-lg px-2 py-2 border outline-none w-full",
 method.accountId ? "bg-app-primary-light border-app-success text-app-success" : "bg-app-warning-bg border-app-warning text-app-warning")}>
 <option value="">⚠ No account linked</option>
 {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.type || 'N/A'})</option>)}
 </select>
 <button onClick={() => setMethods(methods.filter(m => m.key !== method.key))}
 className="w-8 h-8 rounded-lg bg-app-error-bg text-app-error hover:bg-app-error hover:text-app-foreground flex items-center justify-center transition-all">
 <Trash2 size={14} />
 </button>
 </div>
 );
 })}

 <div className="px-4 py-3 bg-app-surface-2/50 flex items-center gap-3">
 <select value={newMethodKey} onChange={(e) => setNewMethodKey(e.target.value)}
 className="text-sm font-bold text-app-muted-foreground bg-app-surface border border-app-border rounded-lg px-3 py-2 outline-none flex-1">
 <option value="">Select method...</option>
 {PRESET_METHODS.filter(p => !methods.find(m => m.key === p)).map(p => <option key={p} value={p}>{p}</option>)}
 </select>
 <input type="text" value={newMethodKey} onChange={(e) => setNewMethodKey(e.target.value.toUpperCase())}
 placeholder="Or custom..." className="text-sm font-bold bg-app-surface border border-app-border rounded-lg px-3 py-2 outline-none w-32" />
 <button onClick={addMethod} disabled={!newMethodKey.trim()}
 className="flex items-center gap-2 px-4 py-2 bg-app-primary text-app-foreground rounded-lg font-bold text-sm hover:bg-app-primary disabled:opacity-40">
 <Plus size={16} /> Add
 </button>
 </div>
 </div>
 </div>
 );
}


// ═══════════════════════════════════════════════════════════════════
// TAB 4: SECURITY RULES
// ═══════════════════════════════════════════════════════════════════
function SecurityTab() {
 const [rules, setRules] = useState({
 requirePinForLogin: true,
 allowCashierSwitch: true,
 autoLockIdleMinutes: 15,
 requireManagerForVoid: true,
 requireManagerForDiscount: true,
 requireManagerForPriceOverride: true,
 requireManagerForRefund: true,
 requireManagerForClearCart: true,
 requireManagerForDeleteItem: true,
 requireManagerForDecreaseQty: true,
 maxDiscountPercent: 20,
 lockRegisterOnClose: true,
 printReceiptOnClose: true,
 requireCountOnClose: true,
 allowNegativeStock: false,
 // Reconciliation strategy
 enableReconciliation: true,
 controlledAccountsAreTruth: true,
 autoCalibrateToClose: true,
 enableAccountBook: true,
 autoTransferExcessToReserve: true,
 autoDeductShortageFromCashier: true,
 requireStatementOnClose: true,
 });
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 erpFetch('settings/item/pos_security_rules/').then(data => {
 if (data && typeof data === 'object' && !Array.isArray(data)) {
 setRules(prev => ({ ...prev, ...data }));
 }
 }).catch(() => { });
 }, []);

 const handleSave = async () => {
 setSaving(true);
 try {
 await erpFetch('settings/item/pos_security_rules/', { method: 'POST', body: JSON.stringify(rules) });
 toast.success('Security rules saved!');
 } catch (e) { toast.error('Failed to save'); }
 setSaving(false);
 };

 const ToggleRow = ({ label, desc, field }: { label: string; desc: string; field: keyof typeof rules }) => (
 <div className="flex items-center justify-between py-3 border-b border-app-border">
 <div className="flex-1">
 <p className="text-sm font-bold text-app-foreground">{label}</p>
 <p className="text-[10px] text-app-muted-foreground">{desc}</p>
 </div>
 <button
 onClick={() => setRules(r => ({ ...r, [field]: !r[field] }))}
 className={clsx("w-11 h-6 rounded-full transition-all relative shrink-0",
 rules[field] ? "bg-app-primary" : "bg-app-border")}
 >
 <div className={clsx("w-4 h-4 rounded-full bg-app-surface shadow absolute top-1 transition-all",
 rules[field] ? "left-6" : "left-1")} />
 </button>
 </div>
 );

 const NumberRow = ({ label, desc, field, suffix }: { label: string; desc: string; field: keyof typeof rules; suffix: string }) => (
 <div className="flex items-center justify-between py-3 border-b border-app-border">
 <div className="flex-1">
 <p className="text-sm font-bold text-app-foreground">{label}</p>
 <p className="text-[10px] text-app-muted-foreground">{desc}</p>
 </div>
 <div className="flex items-center gap-2">
 <input type="number" value={rules[field] as number}
 onChange={(e) => setRules(r => ({ ...r, [field]: Number(e.target.value) }))}
 className="w-16 px-2 py-1 text-center text-sm font-bold border border-app-border rounded-lg outline-none focus:ring-2 focus:ring-app-primary" />
 <span className="text-xs text-app-muted-foreground font-bold">{suffix}</span>
 </div>
 </div>
 );

 return (
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-black text-app-foreground">Security Rules</h2>
 <p className="text-xs text-app-muted-foreground">Control POS access, overrides, reconciliation, and restrictions</p>
 </div>
 <button onClick={handleSave} disabled={saving}
 className="flex items-center gap-2 px-5 py-2 bg-app-primary text-app-foreground rounded-xl font-bold text-sm hover:bg-app-primary disabled:opacity-50 shadow-lg shadow-emerald-100 transition-all">
 {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
 Save
 </button>
 </div>

 {/* Authentication */}
 <div className="bg-app-surface rounded-2xl border border-app-border p-5 shadow-sm">
 <h3 className="text-xs font-black text-app-primary uppercase tracking-widest mb-3 flex items-center gap-2">
 <Key size={12} /> Authentication
 </h3>
 <ToggleRow label="Require PIN for POS Login" desc="Users must enter their PIN to access any register" field="requirePinForLogin" />
 <ToggleRow label="Allow Cashier Switching" desc="Allow switching between cashiers without closing the register" field="allowCashierSwitch" />
 <NumberRow label="Auto-Lock After Idle" desc="Lock the register after this many minutes of inactivity" field="autoLockIdleMinutes" suffix="min" />
 </div>

 {/* Manager Overrides */}
 <div className="bg-app-surface rounded-2xl border border-app-border p-5 shadow-sm">
 <h3 className="text-xs font-black text-app-error uppercase tracking-widest mb-3 flex items-center gap-2">
 <Shield size={12} /> Manager Overrides Required
 </h3>
 <ToggleRow label="Void / Cancel Order" desc="Require manager PIN to void a completed order" field="requireManagerForVoid" />
 <ToggleRow label="Apply Discount" desc="Require manager PIN to apply any manual discount" field="requireManagerForDiscount" />
 <ToggleRow label="Price Override" desc="Require manager PIN to change a product's price downward" field="requireManagerForPriceOverride" />
 <ToggleRow label="Process Refund" desc="Require manager PIN to process a refund" field="requireManagerForRefund" />
 <ToggleRow label="Clear Cart" desc="Require manager PIN to clear the entire cart" field="requireManagerForClearCart" />
 <ToggleRow label="Delete Item" desc="Require manager PIN to remove an item from the cart" field="requireManagerForDeleteItem" />
 <ToggleRow label="Decrease Quantity" desc="Require manager PIN to decrease any product's quantity" field="requireManagerForDecreaseQty" />
 <NumberRow label="Max Discount Without Approval" desc="Cashiers can apply up to this discount % without manager PIN" field="maxDiscountPercent" suffix="%" />
 </div>

 {/* Register Close Rules */}
 <div className="bg-app-surface rounded-2xl border border-app-border p-5 shadow-sm">
 <h3 className="text-xs font-black text-app-warning uppercase tracking-widest mb-3 flex items-center gap-2">
 <Monitor size={12} /> Register Open / Close Rules
 </h3>
 <ToggleRow label="Lock Register on Close" desc="Prevent access after closing until reopened" field="lockRegisterOnClose" />
 <ToggleRow label="Print Receipt on Register Close" desc="Auto-print a Z-report summary when closing the register" field="printReceiptOnClose" />
 <ToggleRow label="Require Cash Count on Close" desc="Cashier must count and enter physical cash when closing" field="requireCountOnClose" />
 <ToggleRow label="Allow Negative Stock Sales" desc="Allow selling products even if stock is 0 or negative" field="allowNegativeStock" />
 </div>

 {/* Reconciliation Strategy */}
 <div className="bg-app-surface rounded-2xl border border-violet-100 p-5 shadow-sm">
 <h3 className="text-xs font-black text-app-primary uppercase tracking-widest mb-3 flex items-center gap-2">
 <Settings2 size={12} /> Reconciliation Strategy
 </h3>
 <div className="bg-violet-50 rounded-xl p-3 mb-3 text-xs text-app-primary font-medium space-y-1">
 <p className="font-black text-app-primary">How closing reconciliation works:</p>
 <p>1. <b>Controlled accounts</b> (Wave, Orange, Bank) → provider statement is truth</p>
 <p>2. Any difference between software & statement → <b>calibrated to cash</b> (cashier used wrong payment method)</p>
 <p>3. After calibration, cash in hand + address book balance = expected cash software</p>
 <p>4. <b>Excess cash</b> → auto-transferred to reserve account + notified</p>
 <p>5. <b>Missing cash</b> → auto-deducted from cashier account</p>
 </div>
 <ToggleRow label="Enable Reconciliation on Close" desc="Run the full reconciliation workflow when closing a register" field="enableReconciliation" />
 <ToggleRow label="Controlled Accounts = Truth" desc="Wave, Orange Money, Bank statements are always correct. Any difference is calibrated." field="controlledAccountsAreTruth" />
 <ToggleRow label="Auto-Calibrate Differences to Cash" desc="When controlled account has a mismatch, auto-adjust the cash account" field="autoCalibrateToClose" />
 <ToggleRow label="Require Statement Entry on Close" desc="Cashier must enter real amounts from provider statements for each controlled account" field="requireStatementOnClose" />
 <ToggleRow label="Enable Address Book" desc="Allow cashiers to log offline transactions (payments they can't enter in POS)" field="enableAccountBook" />
 <ToggleRow label="Auto-Transfer Excess to Reserve" desc="If more cash in hand than expected, transfer surplus to the reserve account" field="autoTransferExcessToReserve" />
 <ToggleRow label="Auto-Deduct Shortage from Cashier" desc="If less cash in hand, deduct the difference from the cashier's personal account" field="autoDeductShortageFromCashier" />
 </div>
 </div>
 );
}
