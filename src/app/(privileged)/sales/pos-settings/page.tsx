'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import {
  Plus, Trash2, Save, ArrowLeft, Shield, Monitor, Users, Key,
  CreditCard, Banknote, Smartphone, Truck, Wallet, Loader2,
  RefreshCw, Hash, Settings2, AlertTriangle, CheckCircle2,
  ChevronRight, Edit, X, Check, Eye, EyeOff, Phone, Zap, TestTube,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

// ── Shared styles ──────────────────────────────────────────────────
const G = 'bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-2xl';
const I = 'w-full px-3 py-2 bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-xl text-[var(--app-text)] text-sm outline-none focus:border-[var(--app-primary-strong)]/50 transition-all placeholder:text-[var(--app-text-faint)]';
const L = 'text-[10px] text-[var(--app-text-muted)] uppercase tracking-widest font-black block mb-1.5';
const BP = 'flex items-center gap-2 px-4 py-2 bg-[var(--app-primary)] hover:bg-[var(--app-primary-dark)] text-[var(--app-text)] rounded-xl font-black text-sm shadow-lg shadow-[var(--app-primary-glow)] hover:brightness-110 transition-all disabled:opacity-50';
const BG = 'flex items-center gap-2 px-3 py-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded-xl font-bold text-sm hover:bg-[var(--app-surface-2)] transition-all';
const SH = 'text-[10px] text-[var(--app-text-faint)] uppercase tracking-widest font-black mb-3 flex items-center gap-2';

type TabId = 'registers' | 'global' | 'users' | 'accounts';
type Reg = { id: number; name: string; siteId: number; siteName: string; warehouseId?: number; cashAccountId?: number; cashAccountName?: string; accountBookId?: number; accountBookName?: string; allowedAccounts: any[]; authorizedUsers: any[]; openingMode: string; paymentMethods: any[]; registerRulesOverride: Record<string, any>; isOpen: boolean; isConfigComplete: boolean; missingCashAccount: boolean; missingAccountBook: boolean; };
type FA = { id: number; name: string; type: string; currency: string };
type UD = { id: number; username: string; first_name: string; last_name: string; pos_pin?: boolean; has_override_pin?: boolean; role_name?: string };
type Site = { id: number; name: string; code: string; registers: Reg[] };

export default function POSSettingsPage() {
  const [tab, setTab] = useState<TabId>('registers');
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<Site[]>([]);
  const [users, setUsers] = useState<UD[]>([]);
  const [accounts, setAccounts] = useState<FA[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selected, setSelected] = useState<Reg | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lobby, usersR, acctR, whR] = await Promise.all([
        erpFetch('pos-registers/lobby/').catch(() => []),
        erpFetch('erp/users/').catch(() => []),
        erpFetch('accounts/').catch(() => []),
        erpFetch('inventory/warehouses/').catch(() => []),
      ]);
      const lobbyArr = Array.isArray(lobby) ? lobby : [];
      setSites(lobbyArr.map((s: any) => ({
        ...s,
        registers: (s.registers || []).map((r: any) => ({ ...r, siteId: s.id, siteName: s.name })),
      })));
      setUsers(Array.isArray(usersR) ? usersR : usersR?.results || []);
      setAccounts(Array.isArray(acctR) ? acctR : acctR?.results || []);
      setWarehouses(Array.isArray(whR) ? whR : whR?.results || []);
    } catch { toast.error('Failed to load'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const allRegisters = sites.flatMap(s => s.registers);
  const incomplete = allRegisters.filter(r => !r.isConfigComplete).length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--app-bg)' }}>
      <Loader2 size={28} className="animate-spin text-[var(--app-primary)]/60" />
    </div>
  );

  const TABS: { id: TabId; label: string; icon: any; color: string; badge?: number }[] = [
    { id: 'registers', label: 'Registers', icon: Monitor, color: 'text-[var(--app-primary)]', badge: incomplete || undefined },
    { id: 'global', label: 'Global Settings', icon: Settings2, color: 'text-[var(--app-warning)]' },
    { id: 'users', label: 'Users & PINs', icon: Key, color: 'text-[var(--app-info)]' },
    { id: 'accounts', label: 'Payment Accounts', icon: CreditCard, color: 'text-[var(--app-success)]' },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)', backgroundImage: 'radial-gradient(circle at 10% 20%,var(--app-primary-light) 0%,transparent 40%)' }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
      {/* Header */}
      <header className="relative z-10 border-b border-[var(--app-border)]/50 px-6 py-4 flex items-center gap-4" style={{ background: 'var(--app-surface)', backdropFilter: 'blur(12px)' }}>
        <Link href="/sales" className="p-2 rounded-xl hover:bg-[var(--app-surface-hover)] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-all"><ArrowLeft size={18} /></Link>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary-light)', border: '1px solid var(--app-primary-glow)' }}>
          <Settings2 size={20} style={{ color: 'var(--app-primary)' }} />
        </div>
        <div>
          <h1 className="text-lg font-black text-[var(--app-text)] tracking-tight">POS Configuration</h1>
          <p className="text-[10px] text-[var(--app-text-faint)] font-medium">Registers · Security · Cashiers · Payments</p>
        </div>
        {incomplete > 0 && <span className="ml-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--app-error-bg)] border border-[var(--app-error)]/20 text-[var(--app-error)] text-[10px] font-black"><AlertTriangle size={10} />{incomplete} register{incomplete > 1 ? 's' : ''} incomplete</span>}
        <button onClick={load} className="ml-auto p-2 rounded-xl hover:bg-[var(--app-surface-hover)] text-[var(--app-text-faint)] hover:text-[var(--app-text)]/80 transition-all"><RefreshCw size={16} /></button>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 flex gap-6">
        {/* Sidebar */}
        <aside className="w-52 shrink-0 space-y-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'registers') setSelected(null); }}
              className={clsx('w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left relative',
                tab === t.id ? 'bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)]' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]/80 hover:bg-[var(--app-surface-2)]/50')}>
              <t.icon size={15} className={tab === t.id ? t.color : 'text-[var(--app-text-faint)]'} />
              {t.label}
              {t.badge && <span className="ml-auto bg-rose-500 text-[var(--app-text)] text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">{t.badge}</span>}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {tab === 'registers' && <RegistersView sites={sites} accounts={accounts} warehouses={warehouses} users={users} selected={selected} setSelected={setSelected} onRefresh={load} />}
          {tab === 'global' && <GlobalSettings />}
          {tab === 'users' && <UsersView users={users} onRefresh={load} />}
          {tab === 'accounts' && <AccountsView accounts={accounts} onRefresh={load} />}
        </main>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// REGISTERS VIEW — list on left, per-register config on right
// ══════════════════════════════════════════════════════════════════
function RegistersView({ sites, accounts, warehouses, users, selected, setSelected, onRefresh }: {
  sites: Site[]; accounts: FA[]; warehouses: any[]; users: UD[];
  selected: Reg | null; setSelected: (r: Reg | null) => void; onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', siteId: 0, warehouseId: 0, cashAccountId: 0, accountBookId: 0 });

  const allRegisters = sites.flatMap(s => s.registers);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.siteId) { toast.error('Name and site required'); return; }
    setSaving(true);
    try {
      await erpFetch('pos-registers/create-register/', {
        method: 'POST', body: JSON.stringify({
          name: form.name, site_id: form.siteId, warehouse_id: form.warehouseId || undefined,
          cash_account_id: form.cashAccountId || undefined, account_book_id: form.accountBookId || undefined,
        })
      });
      toast.success('Register created!');
      setShowCreate(false);
      setForm({ name: '', siteId: 0, warehouseId: 0, cashAccountId: 0, accountBookId: 0 });
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    setSaving(false);
  };

  const cashAccounts = accounts.filter(a => a.type === 'CASH' || a.type === 'ASSET');

  return (
    <div className="flex gap-5 h-full">
      {/* Register list */}
      <div className={clsx('shrink-0 space-y-2', selected ? 'w-72' : 'flex-1')}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-black text-[var(--app-text)]">Registers</h2>
            <p className="text-xs text-[var(--app-text-muted)]">{allRegisters.length} terminal{allRegisters.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowCreate(v => !v)} className={BP}><Plus size={14} />New</button>
        </div>

        {showCreate && (
          <div className={G + ' p-4 space-y-3 border-[var(--app-primary)]/20 mb-3'}>
            <p className={SH}><Plus size={10} />Create Register</p>
            <div><label className={L}>Name *</label><input placeholder="e.g. Caisse 1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={I} /></div>
            <div><label className={L}>Site *</label>
              <select value={form.siteId} onChange={e => setForm(f => ({ ...f, siteId: +e.target.value }))} className={I + ' bg-[var(--app-surface-2)]'}>
                <option value={0}>Select branch…</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className={L}>Cash Account *</label>
              <select value={form.cashAccountId} onChange={e => setForm(f => ({ ...f, cashAccountId: +e.target.value }))} className={I + ' bg-[var(--app-surface-2)]'}>
                <option value={0}>Auto-create under RegisterCash</option>
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div><label className={L}>Account Book *</label>
              <select value={form.accountBookId} onChange={e => setForm(f => ({ ...f, accountBookId: +e.target.value }))} className={I + ' bg-[var(--app-surface-2)]'}>
                <option value={0}>Select account book…</option>
                {accounts.filter(a => a.type === 'CASH' || a.type === 'ASSET').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreate} disabled={saving} className={BP}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Create</button>
              <button onClick={() => setShowCreate(false)} className={BG}>Cancel</button>
            </div>
          </div>
        )}

        {allRegisters.length === 0 && !showCreate && (
          <div className={G + ' p-10 text-center'}><Monitor size={32} className="text-[var(--app-text-faint)]/50 mx-auto mb-3" /><p className="text-[var(--app-text-faint)] text-sm font-bold">No registers yet</p></div>
        )}

        {sites.map(site => (
          <div key={site.id} className="space-y-1.5">
            <p className="text-[10px] text-[var(--app-text-faint)] uppercase tracking-widest font-black px-2 pt-2">{site.name}</p>
            {site.registers.map(reg => (
              <button key={reg.id} onClick={() => setSelected(selected?.id === reg.id ? null : reg)}
                className={clsx('w-full text-left p-3.5 rounded-xl border transition-all',
                  selected?.id === reg.id ? 'bg-[var(--app-surface-hover)] border-[var(--app-border)]' : 'hover:bg-[var(--app-surface-2)]/50 border-[var(--app-border)]/50',
                  !reg.isConfigComplete && 'border-l-2 border-l-rose-500/50')}>
                <div className="flex items-center gap-2.5">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    reg.isOpen ? 'bg-[var(--app-success-bg)] text-[var(--app-success)]' : 'bg-[var(--app-surface-2)] text-[var(--app-text-faint)]')}>
                    <Monitor size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--app-text)] truncate">{reg.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {reg.missingCashAccount && <span className="text-[8px] text-[var(--app-error)] font-black flex items-center gap-0.5"><AlertTriangle size={8} />NO CASH</span>}
                      {reg.missingAccountBook && <span className="text-[8px] text-[var(--app-error)] font-black flex items-center gap-0.5"><AlertTriangle size={8} />NO BOOK</span>}
                      {reg.isConfigComplete && <span className="text-[8px] text-[var(--app-success)]/60 font-black flex items-center gap-0.5"><CheckCircle2 size={8} />READY</span>}
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-[var(--app-text-faint)] shrink-0" />
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Per-register config panel */}
      {selected && (
        <div className="flex-1 min-w-0">
          <RegisterConfigPanel reg={selected} accounts={accounts} warehouses={warehouses} users={users} onRefresh={onRefresh} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}

// ── Per-Register Config Panel ──────────────────────────────────────
function RegisterConfigPanel({ reg, accounts, warehouses, users, onRefresh, onClose }: {
  reg: Reg; accounts: FA[]; warehouses: any[]; users: UD[];
  onRefresh: () => void; onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: reg.name,
    warehouseId: reg.warehouseId || 0,
    cashAccountId: reg.cashAccountId || 0,
    accountBookId: reg.accountBookId || 0,
    openingMode: reg.openingMode || 'standard',
    cashierCanSeeSoftware: false,
    allowedAccountIds: reg.allowedAccounts.map((a: any) => a.id) as number[],
    authorizedUserIds: reg.authorizedUsers.map((u: any) => u.id) as number[],
    paymentMethods: reg.paymentMethods || [],
    rulesOverride: reg.registerRulesOverride || {},
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const toggleId = (arr: number[], id: number) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

  const handleSave = async () => {
    if (!form.cashAccountId) { toast.error('Cash Account is required to operate this register'); return; }
    if (!form.accountBookId) { toast.error('Account Book is required to open this register'); return; }
    setSaving(true);
    try {
      await erpFetch('pos-registers/update-register/', {
        method: 'POST', body: JSON.stringify({
          id: reg.id,
          name: form.name,
          warehouse_id: form.warehouseId || null,
          cash_account_id: form.cashAccountId || null,
          account_book_id: form.accountBookId || null,
          opening_mode: form.openingMode.toUpperCase(),
          cashier_can_see_software: form.cashierCanSeeSoftware,
          allowed_account_ids: form.allowedAccountIds,
          authorized_user_ids: form.authorizedUserIds,
          payment_methods: form.paymentMethods,
          register_rules_override: form.rulesOverride,
        })
      });
      toast.success('Register saved!');
      onRefresh();
    } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
    setSaving(false);
  };

  const cashAccounts = accounts.filter(a => a.type === 'CASH' || a.type === 'ASSET');
  const ICONS: Record<string, any> = { CASH: Banknote, CARD: CreditCard, WALLET: Wallet, OM: Smartphone, WAVE: Smartphone, DELIVERY: Truck };

  const OVERRIDE_RULES = [
    { key: 'requireCountOnClose', label: 'Require Cash Count on Close' },
    { key: 'lockRegisterOnClose', label: 'Lock Register on Close' },
    { key: 'printReceiptOnClose', label: 'Print Z-Report on Close' },
    { key: 'allowNegativeStock', label: 'Allow Negative Stock Sales' },
  ];

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--app-text)]">{reg.name}</h2>
          <p className="text-xs text-[var(--app-text-muted)]">{reg.siteName} · Register #{reg.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className={BP}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save</button>
          <button onClick={onClose} className={BG}><X size={14} />Close</button>
        </div>
      </div>

      {/* Config completeness */}
      {!reg.isConfigComplete && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--app-error-bg)] border border-[var(--app-error)]/20">
          <AlertTriangle size={16} className="text-[var(--app-error)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-[var(--app-error)]">Register is not operational</p>
            <p className="text-xs text-[var(--app-error)]/60 mt-0.5">
              {reg.missingCashAccount && '⚠ No Cash Account linked. '}{reg.missingAccountBook && '⚠ No Account Book linked.'}
              {' '}Configure below to enable this register.
            </p>
          </div>
        </div>
      )}

      {/* 1 — Register Info */}
      <div className={G + ' p-5 space-y-3'}>
        <p className={SH}><Monitor size={10} className="text-[var(--app-primary)]" />Register Info</p>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={L}>Register Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} className={I} /></div>
          <div><label className={L}>Branch / Location *</label><p className="text-sm font-bold text-[var(--app-text)]/80 px-3 py-2">{reg.siteName}</p></div>
          <div><label className={L}>Warehouse (Stock)</label>
            <select value={form.warehouseId} onChange={e => set('warehouseId', +e.target.value)} className={I + ' bg-[var(--app-surface-2)]'}>
              <option value={0}>-- none --</option>
              {warehouses.filter(w => !w.parent).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div><label className={L}>Opening Mode</label>
            <select value={form.openingMode} onChange={e => set('openingMode', e.target.value)} className={I + ' bg-[var(--app-surface-2)]'}>
              <option value="standard">Standard — Quick cash open</option>
              <option value="advanced">Advanced — Full reconciliation</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2 — Required: Cash Account */}
      <div className={G + ' p-5 border-[var(--app-warning)]/15'}>
        <p className={SH}><Banknote size={10} className="text-[var(--app-warning)]" />Cash Account <span className="text-[var(--app-error)] ml-1">REQUIRED</span></p>
        <p className="text-[10px] text-[var(--app-text-faint)] mb-3">The unique cash drawer account for this register. Without this, the register cannot process transactions.</p>
        <select value={form.cashAccountId} onChange={e => set('cashAccountId', +e.target.value)} className={I + ' bg-[var(--app-surface-2)] ' + (form.cashAccountId ? 'border-[var(--app-warning)]/30' : 'border-[var(--app-error)]/40')}>
          <option value={0}>⚠ No cash account selected</option>
          {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
        </select>
        {!form.cashAccountId && <p className="text-[10px] text-[var(--app-error)] mt-1.5 flex items-center gap-1"><AlertTriangle size={8} />Register will be blocked without a cash account</p>}
      </div>

      {/* 3 — Required: Account Book */}
      <div className={G + ' p-5 border-[var(--app-info)]/15'}>
        <p className={SH}><Hash size={10} className="text-[var(--app-info)]" />Account Book <span className="text-[var(--app-error)] ml-1">REQUIRED</span></p>
        <p className="text-[10px] text-[var(--app-text-faint)] mb-3">The Livre de Caisse account for this register. Without this, the register cannot be opened.</p>
        <select value={form.accountBookId} onChange={e => set('accountBookId', +e.target.value)} className={I + ' bg-[var(--app-surface-2)] ' + (form.accountBookId ? 'border-[var(--app-info)]/30' : 'border-[var(--app-error)]/40')}>
          <option value={0}>⚠ No account book selected</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {!form.accountBookId && <p className="text-[10px] text-[var(--app-error)] mt-1.5 flex items-center gap-1"><AlertTriangle size={8} />Register will be blocked without an account book</p>}
      </div>

      {/* 4 — Allowed Payment Accounts */}
      <div className={G + ' p-5'}>
        <p className={SH}><CreditCard size={10} className="text-[var(--app-success)]" />Allowed Payment Accounts</p>
        <p className="text-[10px] text-[var(--app-text-faint)] mb-3">Which financial accounts this register can accept payments into.</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {accounts.map(a => {
            const on = form.allowedAccountIds.includes(a.id);
            return (
              <button key={a.id} onClick={() => set('allowedAccountIds', toggleId(form.allowedAccountIds, a.id))}
                className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all text-sm',
                  on ? 'bg-[var(--app-success-bg)] border-[var(--app-success)]/25 text-[var(--app-success)]' : 'border-[var(--app-border)]/50 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)]/50')}>
                <div className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0', on ? 'bg-[var(--app-success)] border-emerald-400' : 'border-[var(--app-border-strong)]/30')}>
                  {on && <Check size={9} className="text-[var(--app-text)]" />}
                </div>
                <span className="flex-1 truncate font-medium">{a.name}</span>
                <span className="text-[9px] opacity-50">{a.type}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5 — Authorized Cashiers */}
      <div className={G + ' p-5'}>
        <p className={SH}><Users size={10} className="text-[var(--app-info)]" />Authorized Cashiers</p>
        <p className="text-[10px] text-[var(--app-text-faint)] mb-3">Only these users can operate this register. Leave empty to allow all users.</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {users.map(u => {
            const on = form.authorizedUserIds.includes(u.id);
            const name = `${u.first_name} ${u.last_name}`.trim() || u.username;
            return (
              <button key={u.id} onClick={() => set('authorizedUserIds', toggleId(form.authorizedUserIds, u.id))}
                className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all text-sm',
                  on ? 'bg-[var(--app-info-bg)] border-[var(--app-info)]/25 text-[var(--app-info)]' : 'border-[var(--app-border)]/50 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)]/50')}>
                <div className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0', on ? 'bg-violet-400 border-violet-400' : 'border-[var(--app-border-strong)]/30')}>
                  {on && <Check size={9} className="text-[var(--app-text)]" />}
                </div>
                <span className="flex-1 truncate font-medium">{name}</span>
                {!u.pos_pin && <span className="text-[9px] text-[var(--app-error)]/70 font-black">NO PIN</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6 — Payment Methods */}
      <div className={G + ' p-5'}>
        <p className={SH}><Banknote size={10} className="text-[var(--app-primary)]" />Payment Methods</p>
        <p className="text-[10px] text-[var(--app-text-faint)] mb-3">Methods enabled at this register POS terminal.</p>
        <div className="space-y-1.5">
          {['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'DELIVERY', 'CREDIT', 'CHECK'].map(key => {
            const active = form.paymentMethods.some((m: any) => m.key === key);
            const Icon = ICONS[key] || CreditCard;
            return (
              <button key={key} onClick={() => set('paymentMethods', active ? form.paymentMethods.filter((m: any) => m.key !== key) : [...form.paymentMethods, { key, label: key, accountId: null }])}
                className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all text-sm',
                  active ? 'bg-[var(--app-primary-light)] border-[var(--app-primary)]/20 text-[var(--app-primary)]' : 'border-[var(--app-border)]/50 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-2)]/50')}>
                <Icon size={13} /> <span className="flex-1 font-bold">{key}</span>
                {active && <Check size={11} className="text-[var(--app-primary)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7 — Register-Specific Rules Override */}
      <div className={G + ' p-5'}>
        <p className={SH}><Shield size={10} className="text-[var(--app-warning)]" />Register Rules Override</p>
        <p className="text-[10px] text-[var(--app-text-faint)] mb-3">Override global settings for this register only.</p>
        <div className="space-y-0">
          {OVERRIDE_RULES.map(rule => {
            const val = form.rulesOverride[rule.key];
            const isSet = val !== undefined;
            return (
              <div key={rule.key} className="flex items-center justify-between py-2.5 border-b border-[var(--app-border)]/50 last:border-0">
                <div>
                  <p className="text-sm font-bold text-[var(--app-text)]">{rule.label}</p>
                  <p className="text-[10px] text-[var(--app-text-faint)]">{isSet ? 'Override active' : 'Using global setting'}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {isSet && <button onClick={() => { const r = { ...form.rulesOverride }; delete r[rule.key]; set('rulesOverride', r); }} className="text-[9px] text-[var(--app-text-faint)] hover:text-[var(--app-error)] transition-all">reset</button>}
                  <button onClick={() => set('rulesOverride', { ...form.rulesOverride, [rule.key]: !val })}
                    className={clsx('w-10 h-5 rounded-full relative transition-all', isSet ? (val ? 'bg-amber-500' : 'bg-[var(--app-surface-hover)]') : 'bg-[var(--app-surface-hover)] opacity-40')}>
                    <span className={clsx('w-3.5 h-3.5 rounded-full bg-white shadow absolute top-0.5 transition-all', val && isSet ? 'left-5' : 'left-0.5')} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// GLOBAL SETTINGS TAB
// ══════════════════════════════════════════════════════════════════
function GlobalSettings() {
  const [section, setSection] = useState<'security' | 'delivery'>('security');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-[var(--app-text)]">Global Settings</h2>
        <p className="text-xs text-[var(--app-text-muted)]">Applies to all registers unless overridden per-register</p>
      </div>
      <div className="flex gap-2">
        {([['security', 'Security Rules', 'text-[var(--app-warning)]'], ['delivery', 'Delivery & SMS', 'text-[var(--app-error)]']] as const).map(([id, label, color]) => (
          <button key={id} onClick={() => setSection(id)}
            className={clsx('px-4 py-2 rounded-xl font-bold text-sm transition-all',
              section === id ? 'bg-[var(--app-surface-hover)] border border-[var(--app-border)] text-[var(--app-text)]' : `${color} opacity-50 hover:opacity-80 hover:bg-[var(--app-surface-2)]/50`)}>
            {label}
          </button>
        ))}
      </div>
      {section === 'security' && <SecurityRules />}
      {section === 'delivery' && <DeliverySettings />}
    </div>
  );
}

function SecurityRules() {
  const [rules, setRules] = useState<Record<string, any>>({
    requirePinForLogin: true, allowCashierSwitch: true, autoLockIdleMinutes: 15,
    requireManagerForVoid: true, requireManagerForDiscount: false, requireManagerForPriceOverride: true,
    requireManagerForRefund: true, requireManagerForClearCart: false, requireManagerForDeleteItem: false,
    maxDiscountPercent: 20,
    lockRegisterOnClose: false, printReceiptOnClose: true, requireCountOnClose: true, allowNegativeStock: false,
    enableReconciliation: true, controlledAccountsAreTruth: true, autoCalibrateToClose: true,
    requireStatementOnClose: true, enableAccountBook: true, autoTransferExcessToReserve: false,
    autoDeductShortageFromCashier: false, restrict_unique_cash_account: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([
      erpFetch('pos/pos-settings/').catch(() => ({})),
      erpFetch('pos-registers/pos-settings/').catch(() => ({})),
    ]).then(([sec, reg]) => { setRules(r => ({ ...r, ...sec, ...reg })); }).catch(() => { }).finally(() => setLoading(false));
  }, []);
  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        erpFetch('pos/pos-settings/', { method: 'PATCH', body: JSON.stringify(rules) }),
        erpFetch('pos-registers/pos-settings/', { method: 'PATCH', body: JSON.stringify({ restrict_unique_cash_account: rules.restrict_unique_cash_account }) }),
      ]);
      toast.success('Security rules saved!');
    } catch { toast.error('Failed to save'); }
    setSaving(false);
  };
  const set = (k: string, v: any) => setRules(r => ({ ...r, [k]: v }));

  function TRow({ label, desc, k }: { label: string; desc: string; k: string }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[var(--app-border)]/50 last:border-0">
        <div><p className="text-sm font-bold text-[var(--app-text)]">{label}</p><p className="text-[10px] text-[var(--app-text-faint)]">{desc}</p></div>
        <button onClick={() => set(k, !rules[k])} className={clsx('w-10 h-5 rounded-full relative transition-all ml-4 shrink-0', rules[k] ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-surface-hover)]')}>
          <span className={clsx('w-3.5 h-3.5 rounded-full bg-white shadow absolute top-0.5 transition-all', rules[k] ? 'left-5' : 'left-0.5')} />
        </button>
      </div>
    );
  }
  function NRow({ label, k, suffix }: { label: string; k: string; suffix: string }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[var(--app-border)]/50 last:border-0">
        <p className="text-sm font-bold text-[var(--app-text)]">{label}</p>
        <div className="flex items-center gap-1.5 ml-4 shrink-0">
          <input type="number" value={rules[k] || 0} onChange={e => set(k, +e.target.value)} className="w-16 px-2 py-1 bg-[var(--app-surface-2)] border border-[var(--app-border)] rounded-lg text-[var(--app-text)] text-sm font-bold text-center outline-none" />
          <span className="text-[10px] text-[var(--app-text-faint)] font-bold">{suffix}</span>
        </div>
      </div>
    );
  }
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[var(--app-text-muted)]" /></div>;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={handleSave} disabled={saving} className={BP}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save All</button></div>
      {[
        {
          title: 'Authentication', color: 'text-[var(--app-primary)]', icon: Key, rows: [
            <TRow key="a" label="Require PIN to Login" desc="Users must enter PIN to access any register" k="requirePinForLogin" />,
            <TRow key="b" label="Allow Cashier Switching" desc="Switch cashiers without closing register" k="allowCashierSwitch" />,
            <NRow key="c" label="Auto-Lock After Idle" k="autoLockIdleMinutes" suffix="min" />,
          ]
        },
        {
          title: 'Manager Overrides', color: 'text-[var(--app-error)]', icon: Shield, rows: [
            <TRow key="a" label="Void / Cancel Order" desc="Require manager PIN to void an order" k="requireManagerForVoid" />,
            <TRow key="b" label="Apply Discount" desc="Require manager PIN for manual discounts" k="requireManagerForDiscount" />,
            <TRow key="c" label="Price Override" desc="Require manager PIN to lower a price" k="requireManagerForPriceOverride" />,
            <TRow key="d" label="Process Refund" desc="Require manager PIN for refunds" k="requireManagerForRefund" />,
            <TRow key="e" label="Clear Cart" desc="Require manager PIN to clear the cart" k="requireManagerForClearCart" />,
            <TRow key="f" label="Delete Line Item" desc="Require manager PIN to remove an item" k="requireManagerForDeleteItem" />,
            <NRow key="g" label="Max Discount Without Approval" k="maxDiscountPercent" suffix="%" />,
          ]
        },
        {
          title: 'Register Rules (Global Defaults)', color: 'text-[var(--app-warning)]', icon: Monitor, rows: [
            <TRow key="a" label="Lock on Close" desc="Prevent access after closing" k="lockRegisterOnClose" />,
            <TRow key="b" label="Print Z-Report on Close" desc="Auto-print summary when closing" k="printReceiptOnClose" />,
            <TRow key="c" label="Require Cash Count on Close" desc="Cashier must count cash on close" k="requireCountOnClose" />,
            <TRow key="d" label="Allow Negative Stock Sales" desc="Sell even if stock is 0 or negative" k="allowNegativeStock" />,
          ]
        },
        {
          title: 'Reconciliation', color: 'text-[var(--app-info)]', icon: Zap, rows: [
            <TRow key="a" label="Enable Reconciliation on Close" desc="Run full reconciliation when closing" k="enableReconciliation" />,
            <TRow key="b" label="Controlled Accounts = Truth" desc="Wave, OM, Bank statements are always correct" k="controlledAccountsAreTruth" />,
            <TRow key="c" label="Auto-Calibrate to Cash" desc="Mismatch in controlled accounts adjusts cash" k="autoCalibrateToClose" />,
            <TRow key="d" label="Require Statement Entry on Close" desc="Cashier must enter provider amounts" k="requireStatementOnClose" />,
            <TRow key="e" label="Enable Account Book" desc="Allow cashiers to use the Livre de Caisse" k="enableAccountBook" />,
            <TRow key="f" label="Auto-Transfer Excess to Reserve" desc="Surplus cash moved to reserve" k="autoTransferExcessToReserve" />,
            <TRow key="g" label="Unique Cash Account Per Register" desc="Each register must have its own isolated cash account" k="restrict_unique_cash_account" />,
          ]
        },
      ].map(sec => (
        <div key={sec.title} className={G + ' p-5'}>
          <p className={SH}><sec.icon size={10} className={sec.color} />{sec.title}</p>
          {sec.rows}
        </div>
      ))}
    </div>
  );
}

function DeliverySettings() {
  const [s, setS] = useState<Record<string, any>>({
    delivery_code_mode: 'auto', delivery_code_digits: 6, delivery_code_expiry_hours: 72,
    sms_provider: 'none', sms_on_order_confirm: false, sms_on_delivery_assign: false, sms_on_delivery_complete: false,
    twilio_account_sid: '', twilio_auth_token: '', twilio_from_number: '',
    orange_api_key: '', orange_sender_id: '', whatsapp_token: '', whatsapp_phone_id: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  useEffect(() => { erpFetch('pos/pos-settings/').then((d: any) => { if (d) setS(x => ({ ...x, ...d })); }).catch(() => { }).finally(() => setLoading(false)); }, []);
  const set = (k: string, v: any) => setS(x => ({ ...x, [k]: v }));
  const handleSave = async () => { setSaving(true); try { await erpFetch('pos/pos-settings/', { method: 'PATCH', body: JSON.stringify(s) }); toast.success('Saved!'); } catch { toast.error('Failed'); } setSaving(false); };
  const testSMS = async () => { if (!testPhone) { toast.error('Enter phone'); return; } setTesting(true); try { await erpFetch('pos/pos-settings/test_sms/', { method: 'POST', body: JSON.stringify({ phone: testPhone }) }); toast.success('Test sent!'); } catch (e: any) { toast.error(e?.message || 'Failed'); } setTesting(false); };
  const PROVIDERS = [{ key: 'none', label: 'Disabled', icon: X }, { key: 'twilio', label: 'Twilio', icon: Phone }, { key: 'orange', label: 'Orange', icon: Smartphone }, { key: 'whatsapp', label: 'WhatsApp', icon: Zap }];
  const PROVIDER_FIELDS: Record<string, string[]> = { twilio: ['twilio_account_sid', 'twilio_auth_token', 'twilio_from_number'], orange: ['orange_api_key', 'orange_sender_id'], whatsapp: ['whatsapp_token', 'whatsapp_phone_id'] };
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[var(--app-text-muted)]" /></div>;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={handleSave} disabled={saving} className={BP}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save</button></div>
      <div className={G + ' p-5'}>
        <p className={SH}><Hash size={10} className="text-[var(--app-primary)]" />Delivery Codes</p>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={L}>Mode</label><select value={s.delivery_code_mode} onChange={e => set('delivery_code_mode', e.target.value)} className={I + ' bg-[var(--app-surface-2)]'}><option value="auto">Auto-generate</option><option value="manual">Manual</option><option value="disabled">Disabled</option></select></div>
          <div><label className={L}>Digits</label><input type="number" min={4} max={8} value={s.delivery_code_digits} onChange={e => set('delivery_code_digits', +e.target.value)} className={I} /></div>
          <div><label className={L}>Expiry (hours)</label><input type="number" value={s.delivery_code_expiry_hours} onChange={e => set('delivery_code_expiry_hours', +e.target.value)} className={I} /></div>
        </div>
      </div>
      <div className={G + ' p-5'}>
        <p className={SH}><Phone size={10} className="text-[var(--app-info)]" />SMS Provider</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {PROVIDERS.map(p => (
            <button key={p.key} onClick={() => set('sms_provider', p.key)}
              className={clsx('flex items-center gap-3 p-3 rounded-xl border text-left transition-all', s.sms_provider === p.key ? 'border-[var(--app-border-strong)]/30 bg-[var(--app-surface-hover)]' : 'border-[var(--app-border)]/50 hover:bg-[var(--app-surface-2)]/50')}>
              <p.icon size={15} className={s.sms_provider === p.key ? 'text-[var(--app-primary)]' : 'text-[var(--app-text-faint)]'} />
              <span className="text-sm font-bold text-[var(--app-text)]">{p.label}</span>
              {s.sms_provider === p.key && <Check size={11} className="ml-auto text-[var(--app-primary)]" />}
            </button>
          ))}
        </div>
        {PROVIDER_FIELDS[s.sms_provider] && (
          <div className="grid grid-cols-2 gap-3">
            {PROVIDER_FIELDS[s.sms_provider].map(field => (
              <div key={field}><label className={L}>{field.replace(/_/g, ' ')}</label><input type="password" value={s[field] || ''} onChange={e => set(field, e.target.value)} className={I} /></div>
            ))}
          </div>
        )}
      </div>
      {s.sms_provider !== 'none' && (
        <div className={G + ' p-4 flex items-center gap-3'}>
          <TestTube size={13} className="text-[var(--app-text-faint)] shrink-0" />
          <input placeholder="Test phone number" value={testPhone} onChange={e => setTestPhone(e.target.value)} className={I + ' flex-1 py-2 text-xs'} />
          <button onClick={testSMS} disabled={testing} className={BP + ' py-2 text-xs'}>{testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}Test</button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// USERS & PINs VIEW
// ══════════════════════════════════════════════════════════════════
function UsersView({ users, onRefresh }: { users: UD[]; onRefresh: () => void }) {
  const [pinFor, setPinFor] = useState<number | null>(null);
  const [overrideFor, setOverrideFor] = useState<number | null>(null);
  const [pinVal, setPinVal] = useState('');
  const [overrideVal, setOverrideVal] = useState('');
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);
  const [filter, setFilter] = useState('');

  const setPin = async (uid: number) => {
    if (!pinVal || pinVal.length < 4) { toast.error('PIN must be 4+ digits'); return; }
    setSaving(true);
    try { await erpFetch('erp/users/set-pos-pin/', { method: 'POST', body: JSON.stringify({ user_id: uid, pin: pinVal }) }); toast.success('PIN set!'); setPinFor(null); setPinVal(''); onRefresh(); } catch (e: any) { toast.error(e?.message || 'Failed'); }
    setSaving(false);
  };
  const setOverride = async (uid: number) => {
    if (!overrideVal || overrideVal.length < 4) { toast.error('Override PIN must be 4+ digits'); return; }
    setSaving(true);
    try { await erpFetch('erp/users/set-override-pin/', { method: 'POST', body: JSON.stringify({ user_id: uid, pin: overrideVal }) }); toast.success('Override PIN set!'); setOverrideFor(null); setOverrideVal(''); onRefresh(); } catch (e: any) { toast.error(e?.message || 'Failed'); }
    setSaving(false);
  };

  const filtered = users.filter(u => { const q = filter.toLowerCase(); return !q || u.username?.toLowerCase().includes(q) || u.first_name?.toLowerCase().includes(q) || u.last_name?.toLowerCase().includes(q); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="text-lg font-black text-[var(--app-text)]">Users & PIN Codes</h2><p className="text-xs text-[var(--app-text-muted)]">Global cashier access & manager PINs</p></div>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…" className={I + ' w-44'} />
      </div>
      <div className="space-y-2">
        {filtered.map(u => {
          const name = `${u.first_name} ${u.last_name}`.trim() || u.username;
          return (
            <div key={u.id} className={G + ' p-4'}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--app-info-bg)] border border-[var(--app-info)]/20 flex items-center justify-center text-[var(--app-info)] font-black text-sm shrink-0">
                  {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--app-text)] truncate">{name} <span className="text-[var(--app-text-faint)] text-xs font-normal">@{u.username}</span></p>
                  <p className="text-[10px] text-[var(--app-text-faint)]">{u.role_name || 'Staff'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-black', u.pos_pin ? 'bg-[var(--app-success-bg)] text-[var(--app-success)]' : 'bg-[var(--app-error-bg)] text-[var(--app-error)]')}>
                    {u.pos_pin ? '● PIN' : '○ No PIN'}
                  </span>
                  <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-black', u.has_override_pin ? 'bg-[var(--app-warning-bg)] text-[var(--app-warning)]' : 'bg-[var(--app-surface-2)] text-[var(--app-text-faint)]')}>
                    {u.has_override_pin ? '⚑ Override' : '○ No Override'}
                  </span>
                  <button onClick={() => { setPinFor(pinFor === u.id ? null : u.id); setPinVal(''); }} className="p-2 rounded-lg hover:bg-[var(--app-info-bg)] text-[var(--app-info)]/40 hover:text-[var(--app-info)] transition-all"><Key size={13} /></button>
                  <button onClick={() => { setOverrideFor(overrideFor === u.id ? null : u.id); setOverrideVal(''); }} className="p-2 rounded-lg hover:bg-[var(--app-warning-bg)] text-[var(--app-warning)]/40 hover:text-[var(--app-warning)] transition-all"><Shield size={13} /></button>
                </div>
              </div>
              {pinFor === u.id && (
                <div className="mt-3 flex items-center gap-2">
                  <input type={show ? 'text' : 'password'} placeholder="New PIN (4-6 digits)" value={pinVal} onChange={e => setPinVal(e.target.value.replace(/\D/g, '').slice(0, 6))} className={I + ' flex-1'} />
                  <button onClick={() => setShow(v => !v)} className="p-2 text-[var(--app-text-faint)] hover:text-[var(--app-text)]/80">{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  <button onClick={() => setPin(u.id)} disabled={saving} className={BP + ' px-3 py-2 text-xs'}>{saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Set</button>
                  <button onClick={() => setPinFor(null)} className="p-2 text-[var(--app-text-faint)] hover:text-[var(--app-text)]/80"><X size={13} /></button>
                </div>
              )}
              {overrideFor === u.id && (
                <div className="mt-3 flex items-center gap-2">
                  <input type="password" placeholder="Manager override PIN" value={overrideVal} onChange={e => setOverrideVal(e.target.value.replace(/\D/g, '').slice(0, 6))} className={I + ' flex-1'} />
                  <button onClick={() => setOverride(u.id)} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 bg-[var(--app-warning-bg)] border border-[var(--app-warning)]/20 text-[var(--app-warning)] rounded-xl font-black text-xs hover:bg-[var(--app-warning-bg)] disabled:opacity-50 transition-all">{saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Set Override</button>
                  <button onClick={() => setOverrideFor(null)} className="p-2 text-[var(--app-text-faint)] hover:text-[var(--app-text)]/80"><X size={13} /></button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className={G + ' p-10 text-center'}><Users size={28} className="text-[var(--app-text-faint)]/50 mx-auto mb-2" /><p className="text-[var(--app-text-faint)] text-sm font-bold">No users found</p></div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// PAYMENT ACCOUNTS VIEW
// ══════════════════════════════════════════════════════════════════
function AccountsView({ accounts, onRefresh }: { accounts: FA[]; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-[var(--app-text)]">Payment Accounts</h2>
        <p className="text-xs text-[var(--app-text-muted)]">Configure per-account POS access. Full settings in Finance → Chart of Accounts.</p>
      </div>
      <div className={G + ' p-4 flex items-start gap-3 border-[var(--app-warning)]/15'}>
        <AlertTriangle size={14} className="text-[var(--app-warning)] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-[var(--app-warning)]">Configure Account Access from Finance</p>
          <p className="text-[10px] text-[var(--app-text-muted)] mt-1">To control whether an account can be used across multiple registers or only one, go to <Link href="/finance/chart-of-accounts" className="text-[var(--app-warning)]/70 underline">Finance → Chart of Accounts</Link> and edit the account. The <b>allow_multi_register</b> and <b>pos_access_enabled</b> flags are managed there.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {accounts.map(a => (
          <div key={a.id} className={G + ' p-4 flex items-center gap-3'}>
            <div className="w-9 h-9 rounded-xl bg-[var(--app-success-bg)] border border-[var(--app-success)]/15 flex items-center justify-center text-[var(--app-success)] shrink-0">
              <CreditCard size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--app-text)] truncate">{a.name}</p>
              <p className="text-[10px] text-[var(--app-text-muted)]">{a.type} · {a.currency}</p>
            </div>
          </div>
        ))}
        {accounts.length === 0 && <div className={G + ' col-span-2 p-10 text-center'}><CreditCard size={28} className="text-[var(--app-text-faint)]/50 mx-auto mb-2" /><p className="text-[var(--app-text-faint)] text-sm font-bold">No accounts found</p></div>}
      </div>
    </div>
  );
}
