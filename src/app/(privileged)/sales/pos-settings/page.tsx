'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import {
  Plus, Trash2, Save, ArrowLeft, Shield, Monitor, Users, Key,
  CreditCard, Banknote, Smartphone, Truck, Wallet, Building2,
  Lock, Unlock, Edit, Check, X, AlertTriangle, Eye, EyeOff,
  ChevronDown, Loader2, RefreshCw, Hash, Settings2, ExternalLink,
  MessageSquare, Phone, Globe, Zap, TestTube, ToggleLeft, ToggleRight,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

// ── Types ──────────────────────────────────────────────────────────
type PaymentMethodConfig = { key: string; label: string; accountId: number | null };
type FinancialAccount = { id: number; name: string; type: string; currency: string };
type SiteData = { id: number; name: string; code: string };
type UserData = { id: number; username: string; first_name: string; last_name: string; email: string; pos_pin?: boolean; role?: number; role_name?: string; is_staff?: boolean; is_superuser?: boolean; has_override_pin?: boolean };
type RegisterData = { id: number; name: string; siteId: number; siteName: string; warehouseId?: number; cashAccountId?: number; isActive: boolean; isOpen: boolean };
type WarehouseData = { id: number; name: string; parent: number | null };
type TabId = 'registers' | 'users' | 'payments' | 'security' | 'delivery';

const ICONS: Record<string, any> = { CASH: Banknote, CARD: CreditCard, WALLET: Wallet, OM: Smartphone, WAVE: Smartphone, DELIVERY: Truck };
const PRESET_METHODS = ['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'MULTI', 'DELIVERY', 'CREDIT', 'CHECK', 'TRANSFER'];

// ── Shared styles ──────────────────────────────────────────────────
const glassCard = 'bg-white/[0.04] border border-white/10 rounded-2xl backdrop-blur-sm';
const inputCls = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/10 transition-all placeholder:text-white/20';
const labelCls = 'text-[10px] text-white/40 uppercase tracking-widest font-black block mb-1.5';
const btnPrimary = 'flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-900 rounded-xl font-black text-sm shadow-lg shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50';
const btnGhost = 'flex items-center gap-2 px-3 py-2 text-white/50 hover:text-white rounded-xl font-bold text-sm hover:bg-white/5 transition-all';
const btnDanger = 'flex items-center gap-2 px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl font-bold text-sm hover:bg-rose-500/20 transition-all';
const sectionHdr = 'text-[10px] text-white/25 uppercase tracking-widest font-black mb-3 flex items-center gap-2';

// ── Page Shell ─────────────────────────────────────────────────────
export default function POSSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('registers');
  const [loading, setLoading] = useState(true);

  const [sites, setSites] = useState<SiteData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [lobbyData, setLobbyData] = useState<any[]>([]);

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
      const effectiveSites = sitesArray.length > 0 ? sitesArray : lobbyArray.map((s: any) => ({ id: s.id, name: s.name, code: s.code || '' }));
      setSites(effectiveSites);
      setUsers(Array.isArray(usersRes) ? usersRes : usersRes?.results || []);
      setAccounts(Array.isArray(acctsRes) ? acctsRes : acctsRes?.results || []);
      setWarehouses(Array.isArray(whRes) ? whRes : whRes?.results || []);
      setLobbyData(lobbyArray);
      if (methodsRes && Array.isArray(methodsRes) && methodsRes.length > 0) {
        setMethods(methodsRes.map((m: any) => typeof m === 'string' ? { key: m, label: m, accountId: null } : { key: m.key, label: m.label || m.key, accountId: m.accountId || null }));
      } else {
        setMethods(['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'MULTI', 'DELIVERY'].map(k => ({ key: k, label: k, accountId: null })));
      }
    } catch { toast.error('Failed to load settings data'); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs: { id: TabId; label: string; icon: any; color: string }[] = [
    { id: 'registers', label: 'Registers', icon: Monitor, color: 'text-cyan-400' },
    { id: 'users', label: 'Users & PINs', icon: Key, color: 'text-violet-400' },
    { id: 'payments', label: 'Payments', icon: CreditCard, color: 'text-emerald-400' },
    { id: 'security', label: 'Security', icon: Shield, color: 'text-amber-400' },
    { id: 'delivery', label: 'Delivery & SMS', icon: Truck, color: 'text-rose-400' },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080c18' }}>
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)' }}>
          <Settings2 size={28} style={{ color: '#00D4FF' }} />
        </div>
        <Loader2 size={24} className="animate-spin mx-auto mb-3" style={{ color: 'rgba(0,212,255,0.6)' }} />
        <p className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: 'rgba(0,212,255,0.5)' }}>Loading POS Settings...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: '#080c18', backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(0,212,255,0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(139,92,246,0.05) 0%, transparent 40%)' }}>
      {/* Fixed dot grid */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* Header */}
      <div className="relative z-10 border-b border-white/6 px-6 py-4 flex items-center gap-4" style={{ background: 'rgba(8,12,24,0.8)', backdropFilter: 'blur(12px)' }}>
        <Link href="/sales" className="p-2 rounded-xl hover:bg-white/8 transition-colors">
          <ArrowLeft size={18} className="text-white/40" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}>
            <Settings2 size={20} style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-tight">POS Configuration</h1>
            <p className="text-[10px] text-white/30 font-medium">Registers · Cashiers · Payments · Security</p>
          </div>
        </div>
        <button onClick={loadData} className="ml-auto p-2 rounded-xl hover:bg-white/8 transition-colors text-white/30 hover:text-white/60">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar tabs */}
        <aside className="w-52 shrink-0 space-y-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={clsx('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left',
                activeTab === t.id
                  ? 'bg-white/8 border border-white/15 text-white'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/4')}>
              <t.icon size={15} className={activeTab === t.id ? t.color : 'text-white/25'} />
              {t.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {activeTab === 'registers' && <RegistersTab sites={sites} accounts={accounts} warehouses={warehouses} users={users} lobbyData={lobbyData} onRefresh={loadData} />}
          {activeTab === 'users' && <UsersTab users={users} lobbyData={lobbyData} onRefresh={loadData} />}
          {activeTab === 'payments' && <PaymentsTab methods={methods} setMethods={setMethods} accounts={accounts} />}
          {activeTab === 'security' && <SecurityTab />}
          {activeTab === 'delivery' && <DeliveryTab />}
        </main>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 1: REGISTERS
// ══════════════════════════════════════════════════════════════════
function RegistersTab({ sites, accounts, warehouses, users, lobbyData, onRefresh }: {
  sites: SiteData[]; accounts: FinancialAccount[]; warehouses: WarehouseData[];
  users: UserData[]; lobbyData: any[]; onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', siteId: 0, warehouseId: 0, cashAccountId: 0, allowedUsers: [] as number[] });
  const [editForm, setEditForm] = useState<Record<number, any>>({});

  const allRegisters: RegisterData[] = lobbyData.flatMap((site: any) => (site.registers || []).map((r: any) => ({
    id: r.id, name: r.name, siteId: site.id, siteName: site.name,
    warehouseId: r.warehouseId, cashAccountId: r.cashAccountId, isActive: r.isActive !== false, isOpen: r.isOpen,
  })));

  const handleCreate = async () => {
    if (!form.name.trim() || !form.siteId) { toast.error('Name and site are required'); return; }
    setSaving(true);
    try {
      await erpFetch('pos-registers/create-register/', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, site_id: form.siteId,
          warehouse_id: form.warehouseId || undefined,
          cash_account_id: form.cashAccountId || undefined,
          allowed_user_ids: form.allowedUsers,
        }),
      });
      toast.success('Register created!');
      setShowCreate(false);
      setForm({ name: '', siteId: 0, warehouseId: 0, cashAccountId: 0, allowedUsers: [] });
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Failed to create register'); }
    setSaving(false);
  };

  const handleUpdate = async (id: number) => {
    setSaving(true);
    const f = editForm[id] || {};
    try {
      await erpFetch(`pos-registers/${id}/update-register/`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: f.name, warehouse_id: f.warehouseId || undefined,
          cash_account_id: f.cashAccountId || undefined,
          allowed_user_ids: f.allowedUsers,
        }),
      });
      toast.success('Register updated!');
      setEditId(null);
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
    setSaving(false);
  };

  const cashAccounts = accounts.filter(a => a.type === 'CASH' || a.type === 'ASSET');

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-black text-white">Registers</h2>
          <p className="text-xs text-white/30">{allRegisters.length} register{allRegisters.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)} className={btnPrimary}>
          <Plus size={15} /> New Register
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className={glassCard + ' p-5 space-y-4 border-cyan-400/20'}>
          <p className={sectionHdr}><Plus size={11} /> New Register</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Name</label><input placeholder="e.g. Register 1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} /></div>
            <div><label className={labelCls}>Site</label>
              <select value={form.siteId} onChange={e => setForm(f => ({ ...f, siteId: +e.target.value }))} className={inputCls + ' bg-[#0a0f1e]'}>
                <option value={0}>Select site…</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Warehouse (optional)</label>
              <select value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: +e.target.value }))} className={inputCls + ' bg-[#0a0f1e]'}>
                <option value={0}>Auto-assign</option>
                {warehouses.filter(w => !w.parent).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Cash Account (optional)</label>
              <select value={form.cashAccountId} onChange={e => setForm(f => ({ ...f, cashAccountId: +e.target.value }))} className={inputCls + ' bg-[#0a0f1e]'}>
                <option value={0}>Auto-create</option>
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleCreate} disabled={saving} className={btnPrimary}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create
            </button>
            <button onClick={() => setShowCreate(false)} className={btnGhost}>Cancel</button>
          </div>
        </div>
      )}

      {/* Register cards */}
      {allRegisters.length === 0 ? (
        <div className={glassCard + ' p-12 text-center'}>
          <Monitor size={36} className="text-white/10 mx-auto mb-3" />
          <p className="text-white/25 text-sm font-bold">No registers yet</p>
          <p className="text-white/15 text-xs mt-1">Create your first register above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allRegisters.map(reg => {
            const isEditing = editId === reg.id;
            const ef = editForm[reg.id] || { name: reg.name, warehouseId: reg.warehouseId || 0, cashAccountId: reg.cashAccountId || 0, allowedUsers: [] };
            return (
              <div key={reg.id} className={clsx(glassCard, 'p-4', isEditing && 'border-violet-400/30')}>
                {!isEditing ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: reg.isOpen ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${reg.isOpen ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                        <Monitor size={16} className={reg.isOpen ? 'text-emerald-400' : 'text-white/30'} />
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm">{reg.name}</p>
                        <p className="text-[10px] text-white/30">{reg.siteName} {reg.cashAccountId ? `· Account #${reg.cashAccountId}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold', reg.isOpen ? 'bg-emerald-400/15 text-emerald-400' : 'bg-white/5 text-white/25')}>
                        {reg.isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                      <button onClick={() => { setEditId(reg.id); setEditForm(prev => ({ ...prev, [reg.id]: ef })); }} className="p-2 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/70 transition-all">
                        <Edit size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className={sectionHdr}><Edit size={11} className="text-violet-400" /> Edit {reg.name}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Name</label><input value={ef.name} onChange={e => setEditForm(prev => ({ ...prev, [reg.id]: { ...ef, name: e.target.value } }))} className={inputCls} /></div>
                      <div><label className={labelCls}>Cash Account</label>
                        <select value={ef.cashAccountId} onChange={e => setEditForm(prev => ({ ...prev, [reg.id]: { ...ef, cashAccountId: +e.target.value } }))} className={inputCls + ' bg-[#0a0f1e]'}>
                          <option value={0}>-- no change --</option>
                          {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(reg.id)} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save</button>
                      <button onClick={() => setEditId(null)} className={btnGhost}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 2: USERS & PINs
// ══════════════════════════════════════════════════════════════════
function UsersTab({ users, lobbyData, onRefresh }: { users: UserData[]; lobbyData: any[]; onRefresh: () => void }) {
  const [pinInput, setPinInput] = useState('');
  const [pinUserId, setPinUserId] = useState<number | null>(null);
  const [overrideInput, setOverrideInput] = useState('');
  const [overrideUserId, setOverrideUserId] = useState<number | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');

  const handleSetPin = async (userId: number) => {
    if (!pinInput || pinInput.length < 4) { toast.error('PIN must be at least 4 digits'); return; }
    setSaving(true);
    try {
      await erpFetch('erp/users/set-pos-pin/', { method: 'POST', body: JSON.stringify({ user_id: userId, pin: pinInput }) });
      toast.success('PIN set!');
      setPinUserId(null);
      setPinInput('');
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Failed to set PIN'); }
    setSaving(false);
  };

  const handleSetOverridePin = async (userId: number) => {
    if (!overrideInput || overrideInput.length < 4) { toast.error('Override PIN must be at least 4 digits'); return; }
    setSaving(true);
    try {
      await erpFetch('erp/users/set-override-pin/', { method: 'POST', body: JSON.stringify({ user_id: userId, pin: overrideInput }) });
      toast.success('Override PIN set!');
      setOverrideUserId(null);
      setOverrideInput('');
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Failed to set override PIN'); }
    setSaving(false);
  };

  const filtered = users.filter(u => {
    const q = filter.toLowerCase();
    return !q || u.username?.toLowerCase().includes(q) || u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Users & PINs</h2>
          <p className="text-xs text-white/30">{users.length} cashier{users.length !== 1 ? 's' : ''}</p>
        </div>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…" className={inputCls + ' w-48'} />
      </div>
      <div className="space-y-2">
        {filtered.map(u => (
          <div key={u.id} className={glassCard + ' p-4'}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-violet-400 font-black text-sm">
                {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{u.first_name} {u.last_name} <span className="text-white/25 text-xs">@{u.username}</span></p>
                <p className="text-[10px] text-white/30">{u.role_name || 'Staff'} {u.is_superuser ? '· Superuser' : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold', u.pos_pin ? 'bg-emerald-400/12 text-emerald-400' : 'bg-white/5 text-white/25')}>
                  {u.pos_pin ? '● PIN set' : '○ No PIN'}
                </span>
                <span className={clsx('text-[10px] px-2 py-0.5 rounded-full font-bold', u.has_override_pin ? 'bg-amber-400/12 text-amber-400' : 'bg-white/5 text-white/25')}>
                  {u.has_override_pin ? '⚑ Override' : '○ No override'}
                </span>
                <button onClick={() => { setPinUserId(pinUserId === u.id ? null : u.id); setPinInput(''); }}
                  className="p-2 rounded-lg hover:bg-violet-500/10 text-violet-400/50 hover:text-violet-400 transition-all">
                  <Key size={13} />
                </button>
                <button onClick={() => { setOverrideUserId(overrideUserId === u.id ? null : u.id); setOverrideInput(''); }}
                  className="p-2 rounded-lg hover:bg-amber-500/10 text-amber-400/50 hover:text-amber-400 transition-all">
                  <Shield size={13} />
                </button>
              </div>
            </div>
            {pinUserId === u.id && (
              <div className="mt-3 flex items-center gap-2">
                <input type={showPin ? 'text' : 'password'} placeholder="New PIN (4-6 digits)" value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={inputCls + ' flex-1'} />
                <button onClick={() => setShowPin(v => !v)} className="p-2 text-white/30 hover:text-white/60">{showPin ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                <button onClick={() => handleSetPin(u.id)} disabled={saving} className={btnPrimary + ' px-3 py-2 text-xs'}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Set PIN
                </button>
                <button onClick={() => setPinUserId(null)} className={btnGhost + ' px-2 py-2'}><X size={14} /></button>
              </div>
            )}
            {overrideUserId === u.id && (
              <div className="mt-3 flex items-center gap-2">
                <input type="password" placeholder="Manager override PIN" value={overrideInput}
                  onChange={e => setOverrideInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={inputCls + ' flex-1'} />
                <button onClick={() => handleSetOverridePin(u.id)} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 bg-amber-400/15 border border-amber-400/20 text-amber-300 rounded-xl font-black text-xs hover:bg-amber-400/25 transition-all disabled:opacity-50">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Set Override
                </button>
                <button onClick={() => setOverrideUserId(null)} className={btnGhost + ' px-2 py-2'}><X size={14} /></button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className={glassCard + ' p-10 text-center'}>
            <Users size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-white/25 text-sm font-bold">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 3: PAYMENT METHODS
// ══════════════════════════════════════════════════════════════════
function PaymentsTab({ methods, setMethods, accounts }: {
  methods: PaymentMethodConfig[]; setMethods: (m: PaymentMethodConfig[]) => void; accounts: FinancialAccount[];
}) {
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      await erpFetch('settings/item/pos_payment_methods/', { method: 'POST', body: JSON.stringify(methods) });
      toast.success('Payment methods saved!');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const addMethod = () => {
    const k = newKey.toUpperCase().replace(/\s/g, '_');
    if (!k) return;
    if (methods.find(m => m.key === k)) { toast.error('Key already exists'); return; }
    setMethods([...methods, { key: k, label: k, accountId: null }]);
    setNewKey('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-black text-white">Payment Methods</h2><p className="text-xs text-white/30">{methods.length} methods</p></div>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      <div className="space-y-2">
        {methods.map((m, idx) => {
          const Icon = ICONS[m.key] || CreditCard;
          return (
            <div key={m.key} className={glassCard + ' p-4 flex items-center gap-4'}>
              <div className="w-9 h-9 rounded-xl bg-emerald-400/10 border border-emerald-400/15 flex items-center justify-center text-emerald-400 shrink-0">
                <Icon size={15} />
              </div>
              <div className="flex-1 grid grid-cols-3 gap-3 items-center">
                <div>
                  <label className={labelCls}>Key</label>
                  <p className="text-xs font-black text-white/70 font-mono">{m.key}</p>
                </div>
                <div>
                  <label className={labelCls}>Label</label>
                  <input value={m.label} onChange={e => { const c = [...methods]; c[idx] = { ...c[idx], label: e.target.value }; setMethods(c); }}
                    className={inputCls + ' py-1.5 text-xs'} />
                </div>
                <div>
                  <label className={labelCls}>Linked Account</label>
                  <select value={m.accountId || 0} onChange={e => { const c = [...methods]; c[idx] = { ...c[idx], accountId: +e.target.value || null }; setMethods(c); }}
                    className={inputCls + ' py-1.5 text-xs bg-[#0a0f1e]'}>
                    <option value={0}>-- none --</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <button onClick={() => setMethods(methods.filter((_, i) => i !== idx))} className="p-2 text-white/20 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-all">
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div className={glassCard + ' p-4 flex items-center gap-3'}>
        <Hash size={14} className="text-white/20 shrink-0" />
        <input placeholder="New method key (e.g. CRYPTO)" value={newKey} onChange={e => setNewKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addMethod()} className={inputCls + ' flex-1 py-2 text-xs'} />
        <button onClick={addMethod} className={btnPrimary + ' py-2 text-xs'}><Plus size={13} /> Add</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 4: SECURITY RULES
// ══════════════════════════════════════════════════════════════════
function SecurityTab() {
  const [rules, setRules] = useState({
    requirePinForLogin: true, allowCashierSwitch: true, autoLockIdleMinutes: 15,
    requireManagerForVoid: true, requireManagerForDiscount: false, requireManagerForPriceOverride: true,
    requireManagerForRefund: true, requireManagerForClearCart: false, requireManagerForDeleteItem: false,
    requireManagerForDecreaseQty: false, maxDiscountPercent: 20,
    lockRegisterOnClose: false, printReceiptOnClose: true, requireCountOnClose: true, allowNegativeStock: false,
    enableReconciliation: true, controlledAccountsAreTruth: true, autoCalibrateToClose: true,
    requireStatementOnClose: true, enableAccountBook: true, autoTransferExcessToReserve: false, autoDeductShortageFromCashier: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    erpFetch('pos/pos-settings/').then((d: any) => {
      if (d && typeof d === 'object') setRules(r => ({ ...r, ...d }));
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await erpFetch('pos/pos-settings/', { method: 'PATCH', body: JSON.stringify(rules) });
      toast.success('Security rules saved!');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const set = (k: string, v: any) => setRules(r => ({ ...r, [k]: v }));

  function Toggle({ label, desc, field }: { label: string; desc: string; field: keyof typeof rules }) {
    const val = rules[field] as boolean;
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <div>
          <p className="text-sm font-bold text-white/80">{label}</p>
          <p className="text-[10px] text-white/25 mt-0.5">{desc}</p>
        </div>
        <button onClick={() => set(field, !val)} className={clsx('w-11 h-6 rounded-full relative transition-all shrink-0 ml-4', val ? 'bg-cyan-500' : 'bg-white/10')}>
          <span className={clsx('w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all', val ? 'left-6' : 'left-1')} />
        </button>
      </div>
    );
  }

  function NumRow({ label, desc, field, suffix }: { label: string; desc: string; field: keyof typeof rules; suffix: string }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <div>
          <p className="text-sm font-bold text-white/80">{label}</p>
          <p className="text-[10px] text-white/25 mt-0.5">{desc}</p>
        </div>
        <div className="flex items-center gap-1.5 ml-4 shrink-0">
          <input type="number" value={rules[field] as number} onChange={e => set(field, +e.target.value)}
            className="w-16 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-bold text-center outline-none focus:border-cyan-400/40" />
          <span className="text-[10px] text-white/25 font-bold">{suffix}</span>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-white/30" /></div>;

  const sections: Array<{ title: string; icon: any; color: string; items: any[] }> = [
    {
      title: 'Authentication', icon: Key, color: 'text-cyan-400',
      items: [
        <Toggle key="1" label="Require PIN to Login" desc="Users must enter PIN to access any register" field="requirePinForLogin" />,
        <Toggle key="2" label="Allow Cashier Switching" desc="Switch cashiers without closing the register" field="allowCashierSwitch" />,
        <NumRow key="3" label="Auto-Lock After Idle" desc="Lock register after inactivity" field="autoLockIdleMinutes" suffix="min" />,
      ],
    },
    {
      title: 'Manager Overrides', icon: Shield, color: 'text-rose-400',
      items: [
        <Toggle key="1" label="Void / Cancel Order" desc="Require manager PIN to void an order" field="requireManagerForVoid" />,
        <Toggle key="2" label="Apply Discount" desc="Require manager PIN for manual discounts" field="requireManagerForDiscount" />,
        <Toggle key="3" label="Price Override" desc="Require manager PIN to change product price" field="requireManagerForPriceOverride" />,
        <Toggle key="4" label="Process Refund" desc="Require manager PIN for refunds" field="requireManagerForRefund" />,
        <Toggle key="5" label="Clear Cart" desc="Require manager PIN to clear entire cart" field="requireManagerForClearCart" />,
        <Toggle key="6" label="Delete Item" desc="Require manager PIN to remove items" field="requireManagerForDeleteItem" />,
        <Toggle key="7" label="Decrease Quantity" desc="Require manager PIN to reduce item quantity" field="requireManagerForDecreaseQty" />,
        <NumRow key="8" label="Max Discount Without Approval" desc="Cashiers can discount up to this amount freely" field="maxDiscountPercent" suffix="%" />,
      ],
    },
    {
      title: 'Register Rules', icon: Monitor, color: 'text-amber-400',
      items: [
        <Toggle key="1" label="Lock on Close" desc="Prevent access after closing until reopened" field="lockRegisterOnClose" />,
        <Toggle key="2" label="Print Z-Report on Close" desc="Auto-print summary when closing" field="printReceiptOnClose" />,
        <Toggle key="3" label="Require Cash Count on Close" desc="Cashier must count and enter physical cash" field="requireCountOnClose" />,
        <Toggle key="4" label="Allow Negative Stock Sales" desc="Sell even if stock is 0 or negative" field="allowNegativeStock" />,
      ],
    },
    {
      title: 'Reconciliation', icon: Zap, color: 'text-violet-400',
      items: [
        <Toggle key="1" label="Enable Reconciliation on Close" desc="Run full reconciliation when closing" field="enableReconciliation" />,
        <Toggle key="2" label="Controlled Accounts = Truth" desc="Wave, OM, Bank statements are always correct" field="controlledAccountsAreTruth" />,
        <Toggle key="3" label="Auto-Calibrate to Cash" desc="Mismatch in controlled accounts is adjusted in cash" field="autoCalibrateToClose" />,
        <Toggle key="4" label="Require Statement Entry on Close" desc="Cashier must enter provider statement amounts" field="requireStatementOnClose" />,
        <Toggle key="5" label="Enable Account Book" desc="Allow cashiers to log Account Book transactions" field="enableAccountBook" />,
        <Toggle key="6" label="Auto-Transfer Excess to Reserve" desc="Surplus cash transferred to reserve account" field="autoTransferExcessToReserve" />,
        <Toggle key="7" label="Auto-Deduct Shortage from Cashier" desc="Cash shortfall deducted from cashier account" field="autoDeductShortageFromCashier" />,
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-black text-white">Security Rules</h2><p className="text-xs text-white/30">Access control, overrides & reconciliation</p></div>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      {sections.map(sec => (
        <div key={sec.title} className={glassCard + ' p-5'}>
          <div className={sectionHdr}><sec.icon size={11} className={sec.color} />{sec.title}</div>
          <div>{sec.items}</div>
        </div>
      ))}

      <RegisterCashIsolationSection />
    </div>
  );
}

// ── Register Cash Account Isolation ───────────────────────────────
function RegisterCashIsolationSection() {
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    erpFetch('pos-registers/pos-settings/')
      .then((d: any) => { if (d && typeof d.restrict_unique_cash_account === 'boolean') setEnabled(d.restrict_unique_cash_account); })
      .catch(() => { }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await erpFetch('pos-registers/pos-settings/', { method: 'PATCH', body: JSON.stringify({ restrict_unique_cash_account: enabled }) });
      toast.success('Cash isolation setting saved!');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  return (
    <div className={glassCard + ' p-5 border-amber-400/15'}>
      <div className={sectionHdr}><Banknote size={11} className="text-amber-400" />Cash Account Isolation</div>
      <p className="text-[10px] text-white/30 mb-4 leading-relaxed">
        When enabled, each register must have its own unique cash account. A new COA account is auto-created under <b className="text-amber-400/70">RegisterCash</b> if none is specified.
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-white/30"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white/80">Enforce Unique Cash Account</p>
            <p className="text-[10px] text-white/25 mt-0.5">{enabled ? '✅ Each register has its own isolated cash ledger' : '⚠ Registers may share cash accounts (legacy)'}</p>
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <button onClick={() => setEnabled(e => !e)}
              className={clsx('w-11 h-6 rounded-full relative transition-all', enabled ? 'bg-amber-500' : 'bg-white/10')}>
              <span className={clsx('w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all', enabled ? 'left-6' : 'left-1')} />
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/15 border border-amber-500/25 text-amber-300 rounded-xl font-black text-xs hover:bg-amber-500/25 disabled:opacity-50 transition-all">
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB 5: DELIVERY & SMS
// ══════════════════════════════════════════════════════════════════
const SMS_PROVIDERS = [
  { key: 'none', label: 'Disabled', desc: 'No SMS', icon: X, color: 'text-white/30', fields: [] },
  { key: 'twilio', label: 'Twilio', desc: 'Global coverage, most reliable', icon: Phone, color: 'text-cyan-400', fields: ['twilio_account_sid', 'twilio_auth_token', 'twilio_from_number'] },
  { key: 'orange', label: 'Orange', desc: 'Orange Money SMS Ivory Coast', icon: Smartphone, color: 'text-amber-400', fields: ['orange_api_key', 'orange_sender_id'] },
  { key: 'whatsapp', label: 'WhatsApp', desc: 'WhatsApp Business API', icon: MessageSquare, color: 'text-emerald-400', fields: ['whatsapp_token', 'whatsapp_phone_id'] },
];

function DeliveryTab() {
  const [settings, setSettings] = useState<Record<string, any>>({
    delivery_code_mode: 'auto', delivery_code_digits: 6, delivery_code_expiry_hours: 72,
    sms_provider: 'none', sms_on_order_confirm: false, sms_on_delivery_assign: false, sms_on_delivery_complete: false,
    twilio_account_sid: '', twilio_auth_token: '', twilio_from_number: '',
    orange_api_key: '', orange_sender_id: '',
    whatsapp_token: '', whatsapp_phone_id: '',
    sms_template_confirm: 'Your order {order_id} is confirmed. Code: {code}',
    sms_template_assign: 'Your order {order_id} is on the way! Delivery code: {code}',
    sms_template_complete: 'Order {order_id} delivered. Thank you!',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    erpFetch('pos/pos-settings/').then((d: any) => {
      if (d && typeof d === 'object') setSettings(s => ({ ...s, ...d }));
    }).catch(() => { }).finally(() => setLoading(false));
  }, []);

  const set = (k: string, v: any) => setSettings(s => ({ ...s, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await erpFetch('pos/pos-settings/', { method: 'PATCH', body: JSON.stringify(settings) });
      toast.success('Delivery & SMS settings saved!');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };

  const handleTestSMS = async () => {
    if (!testPhone) { toast.error('Enter a phone number'); return; }
    setTesting(true);
    try {
      await erpFetch('pos/pos-settings/test_sms/', { method: 'POST', body: JSON.stringify({ phone: testPhone }) });
      toast.success('Test SMS sent!');
    } catch (e: any) { toast.error(e?.message || 'SMS test failed'); }
    setTesting(false);
  };

  const activeProvider = SMS_PROVIDERS.find(p => p.key === settings.sms_provider) || SMS_PROVIDERS[0];

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-white/30" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-black text-white">Delivery & SMS</h2><p className="text-xs text-white/30">Confirmation codes & notifications</p></div>
        <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save</button>
      </div>

      {/* Delivery codes */}
      <div className={glassCard + ' p-5'}>
        <div className={sectionHdr}><Hash size={11} className="text-cyan-400" />Delivery Codes</div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Mode</label>
            <select value={settings.delivery_code_mode} onChange={e => set('delivery_code_mode', e.target.value)} className={inputCls + ' bg-[#0a0f1e]'}>
              <option value="auto">Auto-generate</option>
              <option value="manual">Manual entry</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Digits</label>
            <input type="number" min={4} max={8} value={settings.delivery_code_digits} onChange={e => set('delivery_code_digits', +e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Expiry</label>
            <div className="flex items-center gap-1.5">
              <input type="number" value={settings.delivery_code_expiry_hours} onChange={e => set('delivery_code_expiry_hours', +e.target.value)} className={inputCls} />
              <span className="text-[10px] text-white/25 whitespace-nowrap font-bold">hours</span>
            </div>
          </div>
        </div>
      </div>

      {/* SMS Provider */}
      <div className={glassCard + ' p-5'}>
        <div className={sectionHdr}><Phone size={11} className="text-violet-400" />SMS Provider</div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {SMS_PROVIDERS.map(p => (
            <button key={p.key} onClick={() => set('sms_provider', p.key)}
              className={clsx('flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                settings.sms_provider === p.key ? 'border-white/20 bg-white/8' : 'border-white/6 bg-white/[0.02] hover:bg-white/5')}>
              <p.icon size={16} className={settings.sms_provider === p.key ? p.color : 'text-white/25'} />
              <div>
                <p className="text-sm font-bold text-white/80">{p.label}</p>
                <p className="text-[10px] text-white/25">{p.desc}</p>
              </div>
              {settings.sms_provider === p.key && <Check size={12} className="ml-auto text-cyan-400 shrink-0" />}
            </button>
          ))}
        </div>

        {activeProvider.fields.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {activeProvider.fields.map(field => (
              <div key={field}>
                <label className={labelCls}>{field.replace(/_/g, ' ')}</label>
                <input type="password" value={settings[field] || ''} onChange={e => set(field, e.target.value)} placeholder={`Enter ${field}`} className={inputCls} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Triggers */}
      <div className={glassCard + ' p-5'}>
        <div className={sectionHdr}><Zap size={11} className="text-amber-400" />Send Notifications When</div>
        {[
          { label: 'Order Confirmed', field: 'sms_on_order_confirm' },
          { label: 'Delivery Assigned', field: 'sms_on_delivery_assign' },
          { label: 'Delivery Completed', field: 'sms_on_delivery_complete' },
        ].map(row => (
          <div key={row.field} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <p className="text-sm text-white/70 font-bold">{row.label}</p>
            <button onClick={() => set(row.field, !settings[row.field])}
              className={clsx('w-10 h-5 rounded-full relative transition-all', settings[row.field] ? 'bg-amber-500' : 'bg-white/10')}>
              <span className={clsx('w-3.5 h-3.5 rounded-full bg-white shadow absolute top-0.5 transition-all', settings[row.field] ? 'left-5' : 'left-0.5')} />
            </button>
          </div>
        ))}
      </div>

      {/* Test SMS */}
      {settings.sms_provider !== 'none' && (
        <div className={glassCard + ' p-4 flex items-center gap-3'}>
          <TestTube size={14} className="text-white/25 shrink-0" />
          <input placeholder="Test phone number" value={testPhone} onChange={e => setTestPhone(e.target.value)} className={inputCls + ' flex-1 py-2 text-xs'} />
          <button onClick={handleTestSMS} disabled={testing} className={btnPrimary + ' py-2 text-xs'}>
            {testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Test SMS
          </button>
        </div>
      )}
    </div>
  );
}
