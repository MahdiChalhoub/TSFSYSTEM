'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';
import {
  Plus, Trash2, Save, Shield, Monitor, Users, Key,
  CreditCard, Banknote, Smartphone, Truck, Wallet, Loader2,
  RefreshCw, Hash, Settings2, AlertTriangle, CheckCircle2,
  ChevronRight, X, Check, Eye, EyeOff, Phone, Zap, TestTube,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

/* ── Shared style tokens (use CSS variables from layout engine) ── */
const card = 'bg-[var(--app-surface)] border border-[var(--app-border)] rounded-[var(--card-radius,0.75rem)] shadow-[var(--card-shadow,none)]';
const input = 'w-full px-3 py-2.5 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-[var(--input-radius,0.5rem)] text-[var(--app-text)] text-sm outline-none focus:ring-2 focus:ring-[var(--app-primary)]/30 focus:border-[var(--app-primary)]/50 transition-all placeholder:text-[var(--app-text-muted)]/50';
const label = 'text-[11px] text-[var(--app-text-muted)] uppercase tracking-wider font-bold block mb-1.5';
const btnPrimary = 'inline-flex items-center gap-2 px-4 py-2 bg-[var(--app-primary)] hover:bg-[var(--app-primary-dark,var(--app-primary))] text-white rounded-[var(--button-radius,0.5rem)] font-bold text-sm shadow-lg shadow-[var(--app-primary)]/20 hover:shadow-[var(--app-primary)]/30 transition-all disabled:opacity-50';
const btnGhost = 'inline-flex items-center gap-2 px-3 py-2 text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded-[var(--button-radius,0.5rem)] font-bold text-sm hover:bg-[var(--app-surface)] transition-all';
const sectionHead = 'text-[10px] text-[var(--app-text-muted)] uppercase tracking-widest font-black mb-3 flex items-center gap-2';

/* ── Types ── */
type TabId = 'registers' | 'global' | 'users' | 'accounts';
type Reg = { id: number; name: string; siteId: number; siteName: string; warehouseId?: number; cashAccountId?: number; cashAccountName?: string; accountBookId?: number; accountBookName?: string; allowedAccounts: any[]; authorizedUsers: any[]; openingMode: string; paymentMethods: any[]; registerRulesOverride: Record<string, any>; isOpen: boolean; isConfigComplete: boolean; missingCashAccount: boolean; missingAccountBook: boolean; };
type FA = { id: number; name: string; type: string; currency: string };
type UD = { id: number; username: string; first_name: string; last_name: string; pos_pin?: boolean; has_override_pin?: boolean; role_name?: string };
type Site = { id: number; name: string; code: string; registers: Reg[] };

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════════ */
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
    <div className="app-page flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin text-[var(--app-primary)]/60" />
    </div>
  );

  const TABS: { id: TabId; label: string; icon: any; color: string; badge?: number }[] = [
    { id: 'registers', label: 'Registers', icon: Monitor, color: 'text-[var(--app-primary)]', badge: incomplete || undefined },
    { id: 'global', label: 'Global Rules', icon: Settings2, color: 'text-amber-400' },
    { id: 'users', label: 'Users & PINs', icon: Key, color: 'text-blue-400' },
    { id: 'accounts', label: 'Payment Accounts', icon: CreditCard, color: 'text-emerald-400' },
  ];

  return (
    <div className="app-page space-y-5">
      {/* ── Page Header ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--app-primary-light, rgba(16,185,129,0.1))', border: '1px solid var(--app-primary-glow, rgba(16,185,129,0.2))' }}>
            <Settings2 size={26} style={{ color: 'var(--app-primary)' }} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--app-text-muted)]">Point of Sale</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--app-text)]">
              POS <span style={{ color: 'var(--app-primary)' }}>Configuration</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {incomplete > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-black">
              <AlertTriangle size={10} />{incomplete} incomplete
            </span>
          )}
          <button onClick={load} className={btnGhost}><RefreshCw size={14} />Reload</button>
        </div>
      </header>

      {/* ── Tab Navigation (horizontal scroll on mobile, row on desktop) ── */}
      <nav className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id !== 'registers') setSelected(null); }}
            className={clsx('shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all',
              tab === t.id
                ? 'bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)] shadow-sm'
                : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-surface)]/50')}>
            <t.icon size={15} className={tab === t.id ? t.color : 'opacity-50'} />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            {t.badge && <span className="bg-red-500 text-white text-[8px] font-black rounded-full w-4 h-4 flex items-center justify-center">{t.badge}</span>}
          </button>
        ))}
      </nav>

      {/* ── Tab Content ── */}
      <div className="min-h-0">
        {tab === 'registers' && <RegistersView sites={sites} accounts={accounts} warehouses={warehouses} users={users} selected={selected} setSelected={setSelected} onRefresh={load} />}
        {tab === 'global' && <GlobalSettings />}
        {tab === 'users' && <UsersView users={users} onRefresh={load} />}
        {tab === 'accounts' && <AccountsView accounts={accounts} onRefresh={load} />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   REGISTERS VIEW — responsive master/detail
   ══════════════════════════════════════════════════════════════════ */
function RegistersView({ sites, accounts, warehouses, users, selected, setSelected, onRefresh }: {
  sites: Site[]; accounts: FA[]; warehouses: any[]; users: UD[];
  selected: Reg | null; setSelected: (r: Reg | null) => void; onRefresh: () => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', siteId: 0, warehouseId: 0, cashAccountId: 0, accountBookId: 0 });
  const allRegisters = sites.flatMap(s => s.registers);
  // FinancialAccount types: CASH, BANK, MOBILE, PETTY_CASH, SAVINGS, FOREIGN, ESCROW, INVESTMENT
  // For cash drawer we show CASH and PETTY_CASH primarily, but allow all
  const cashAccounts = accounts; // Show all — let user pick any financial account

  // For branches: lobby only returns branches that already have registers.
  // If sites is empty (no registers exist yet), use warehouses as fallback for the "Site" dropdown
  const branchOptions = sites.length > 0
    ? sites.map(s => ({ id: s.id, name: s.name }))
    : warehouses.filter((w: any) => w.location_type === 'BRANCH' || !w.parent).map((w: any) => ({ id: w.id, name: w.name }));

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

  // On mobile: show detail as overlay. On desktop: side-by-side.
  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Register list — always visible on desktop, hidden on mobile when detail open */}
      <div className={clsx('space-y-2', selected ? 'hidden lg:block lg:w-80 lg:shrink-0' : 'w-full')}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-black text-[var(--app-text)]">Registers</h2>
            <p className="text-xs text-[var(--app-text-muted)]">{allRegisters.length} terminal{allRegisters.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowCreate(v => !v)} className={btnPrimary}><Plus size={14} />New</button>
        </div>

        {showCreate && (
          <div className={card + ' p-4 space-y-3 mb-3'}>
            <p className={sectionHead}><Plus size={10} />Create Register</p>
            <div><label className={label}>Name *</label><input placeholder="e.g. Caisse 1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={input} /></div>
            <div><label className={label}>Branch / Site *</label>
              <select value={form.siteId} onChange={e => setForm(f => ({ ...f, siteId: +e.target.value }))} className={input}>
                <option value={0}>Select branch…</option>
                {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div><label className={label}>Warehouse (Stock Source)</label>
              <select value={form.warehouseId} onChange={e => setForm(f => ({ ...f, warehouseId: +e.target.value }))} className={input}>
                <option value={0}>-- none --</option>
                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.parent ? `  ↳ ${w.name}` : w.name}</option>)}
              </select>
            </div>
            <div><label className={label}>Cash Account</label>
              <select value={form.cashAccountId} onChange={e => setForm(f => ({ ...f, cashAccountId: +e.target.value }))} className={input}>
                <option value={0}>Auto-create under RegisterCash</option>
                {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
              </select>
            </div>
            <div><label className={label}>Account Book</label>
              <select value={form.accountBookId} onChange={e => setForm(f => ({ ...f, accountBookId: +e.target.value }))} className={input}>
                <option value={0}>Select account book…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handleCreate} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Create</button>
              <button onClick={() => setShowCreate(false)} className={btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {allRegisters.length === 0 && !showCreate && (
          <div className={card + ' p-10 text-center'}><Monitor size={32} className="text-[var(--app-text-muted)]/30 mx-auto mb-3" /><p className="text-[var(--app-text-muted)] text-sm font-bold">No registers yet</p></div>
        )}

        {sites.map(site => (
          <div key={site.id} className="space-y-1.5">
            <p className="text-[10px] text-[var(--app-text-muted)] uppercase tracking-widest font-black px-2 pt-2">{site.name}</p>
            {site.registers.map(reg => (
              <button key={reg.id} onClick={() => setSelected(selected?.id === reg.id ? null : reg)}
                className={clsx('w-full text-left p-3.5 rounded-xl border transition-all',
                  selected?.id === reg.id ? 'bg-[var(--app-surface)] border-[var(--app-border)] shadow-sm' : 'hover:bg-[var(--app-surface)]/50 border-transparent',
                  !reg.isConfigComplete && 'border-l-2 border-l-red-500/50')}>
                <div className="flex items-center gap-2.5">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    reg.isOpen ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[var(--app-surface)] text-[var(--app-text-muted)]')}>
                    <Monitor size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[var(--app-text)] truncate">{reg.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {reg.missingCashAccount && <span className="text-[8px] text-red-400 font-black flex items-center gap-0.5"><AlertTriangle size={8} />NO CASH</span>}
                      {reg.missingAccountBook && <span className="text-[8px] text-red-400 font-black flex items-center gap-0.5"><AlertTriangle size={8} />NO BOOK</span>}
                      {reg.isConfigComplete && <span className="text-[8px] text-emerald-400/60 font-black flex items-center gap-0.5"><CheckCircle2 size={8} />READY</span>}
                    </div>
                  </div>
                  <ChevronRight size={12} className="text-[var(--app-text-muted)] shrink-0" />
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Per-register config panel */}
      {selected && (
        <div className="flex-1 min-w-0">
          {/* Mobile back button */}
          <button onClick={() => setSelected(null)} className="lg:hidden mb-3 flex items-center gap-2 text-sm font-bold text-[var(--app-text-muted)]">
            <ChevronRight size={14} className="rotate-180" />Back to list
          </button>
          <RegisterConfigPanel reg={selected} accounts={accounts} warehouses={warehouses} users={users} onRefresh={onRefresh} onClose={() => setSelected(null)} />
        </div>
      )}
    </div>
  );
}

/* ── Per-Register Config Panel ── */
function RegisterConfigPanel({ reg, accounts, warehouses, users, onRefresh, onClose }: {
  reg: Reg; accounts: FA[]; warehouses: any[]; users: UD[];
  onRefresh: () => void; onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: reg.name, warehouseId: reg.warehouseId || 0, cashAccountId: reg.cashAccountId || 0,
    accountBookId: reg.accountBookId || 0, openingMode: reg.openingMode || 'standard',
    allowedAccountIds: reg.allowedAccounts.map((a: any) => a.id) as number[],
    authorizedUserIds: reg.authorizedUsers.map((u: any) => u.id) as number[],
    paymentMethods: reg.paymentMethods || [],
    rulesOverride: reg.registerRulesOverride || {},
  });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const toggleId = (arr: number[], id: number) => arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

  const handleSave = async () => {
    if (!form.cashAccountId) { toast.error('Cash Account is required'); return; }
    if (!form.accountBookId) { toast.error('Account Book is required'); return; }
    setSaving(true);
    try {
      await erpFetch('pos-registers/update-register/', {
        method: 'POST', body: JSON.stringify({
          id: reg.id, name: form.name, warehouse_id: form.warehouseId || null,
          cash_account_id: form.cashAccountId || null, account_book_id: form.accountBookId || null,
          opening_mode: form.openingMode.toUpperCase(),
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

  const cashAccounts = accounts; // All FinancialAccount types: CASH, BANK, MOBILE, PETTY_CASH, etc.
  const ICONS: Record<string, any> = { CASH: Banknote, CARD: CreditCard, WALLET: Wallet, OM: Smartphone, WAVE: Smartphone, DELIVERY: Truck };
  const OVERRIDE_RULES = [
    { key: 'requireCountOnClose', label: 'Require Cash Count on Close' },
    { key: 'lockRegisterOnClose', label: 'Lock Register on Close' },
    { key: 'printReceiptOnClose', label: 'Print Z-Report on Close' },
    { key: 'allowNegativeStock', label: 'Allow Negative Stock Sales' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-[var(--app-text)]">{reg.name}</h2>
          <p className="text-xs text-[var(--app-text-muted)]">{reg.siteName} · Register #{reg.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save</button>
          <button onClick={onClose} className={btnGhost + ' hidden lg:flex'}><X size={14} /></button>
        </div>
      </div>

      {/* Incomplete warning */}
      {!reg.isConfigComplete && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-red-400">Register is not operational</p>
            <p className="text-xs text-red-400/60 mt-0.5">
              {reg.missingCashAccount && '⚠ No Cash Account. '}{reg.missingAccountBook && '⚠ No Account Book.'}
            </p>
          </div>
        </div>
      )}

      {/* Register Info */}
      <div className={card + ' p-5 space-y-3'}>
        <p className={sectionHead}><Monitor size={10} style={{ color: 'var(--app-primary)' }} />Register Info</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={label}>Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} className={input} /></div>
          <div><label className={label}>Branch</label><p className="text-sm font-bold text-[var(--app-text)]/80 px-3 py-2">{reg.siteName}</p></div>
          <div><label className={label}>Warehouse</label>
            <select value={form.warehouseId} onChange={e => set('warehouseId', +e.target.value)} className={input}>
              <option value={0}>-- none --</option>
              {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.parent ? `  ↳ ${w.name}` : w.name}</option>)}
            </select>
          </div>
          <div><label className={label}>Opening Mode</label>
            <select value={form.openingMode} onChange={e => set('openingMode', e.target.value)} className={input}>
              <option value="standard">Standard</option>
              <option value="advanced">Advanced — Full reconciliation</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cash Account (REQUIRED) */}
      <div className={card + ' p-5'}>
        <p className={sectionHead}><Banknote size={10} className="text-amber-400" />Cash Account <span className="text-red-400 ml-1 text-[9px]">REQUIRED</span></p>
        <select value={form.cashAccountId} onChange={e => set('cashAccountId', +e.target.value)} className={input}>
          <option value={0}>⚠ Select cash account…</option>
          {cashAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
        </select>
      </div>

      {/* Account Book (REQUIRED) */}
      <div className={card + ' p-5'}>
        <p className={sectionHead}><Hash size={10} className="text-blue-400" />Account Book <span className="text-red-400 ml-1 text-[9px]">REQUIRED</span></p>
        <select value={form.accountBookId} onChange={e => set('accountBookId', +e.target.value)} className={input}>
          <option value={0}>⚠ Select account book…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Allowed Payment Accounts */}
      <div className={card + ' p-5'}>
        <p className={sectionHead}><CreditCard size={10} className="text-emerald-400" />Allowed Payment Accounts</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {accounts.map(a => {
            const on = form.allowedAccountIds.includes(a.id);
            return (
              <button key={a.id} onClick={() => set('allowedAccountIds', toggleId(form.allowedAccountIds, a.id))}
                className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all text-sm',
                  on ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'border-[var(--app-border)]/50 text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]')}>
                <div className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0', on ? 'bg-emerald-500 border-emerald-400' : 'border-[var(--app-border)]')}>
                  {on && <Check size={9} className="text-white" />}
                </div>
                <span className="flex-1 truncate font-medium">{a.name}</span>
                <span className="text-[9px] opacity-50">{a.type}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Authorized Cashiers */}
      <div className={card + ' p-5'}>
        <p className={sectionHead}><Users size={10} className="text-blue-400" />Authorized Cashiers</p>
        <p className="text-[10px] text-[var(--app-text-muted)] mb-3">Leave empty to allow all users.</p>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {users.map(u => {
            const on = form.authorizedUserIds.includes(u.id);
            const name = `${u.first_name} ${u.last_name}`.trim() || u.username;
            return (
              <button key={u.id} onClick={() => set('authorizedUserIds', toggleId(form.authorizedUserIds, u.id))}
                className={clsx('w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all text-sm',
                  on ? 'bg-blue-500/5 border-blue-500/20 text-blue-400' : 'border-[var(--app-border)]/50 text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]')}>
                <div className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0', on ? 'bg-blue-500 border-blue-400' : 'border-[var(--app-border)]')}>
                  {on && <Check size={9} className="text-white" />}
                </div>
                <span className="flex-1 truncate font-medium">{name}</span>
                {!u.pos_pin && <span className="text-[9px] text-red-400/70 font-black">NO PIN</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Payment Methods */}
      <div className={card + ' p-5'}>
        <p className={sectionHead}><Banknote size={10} style={{ color: 'var(--app-primary)' }} />Payment Methods</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {['CASH', 'CARD', 'WALLET', 'WAVE', 'OM', 'DELIVERY', 'CREDIT', 'CHECK'].map(key => {
            const active = form.paymentMethods.some((m: any) => m.key === key);
            const Icon = ICONS[key] || CreditCard;
            return (
              <button key={key} onClick={() => set('paymentMethods', active ? form.paymentMethods.filter((m: any) => m.key !== key) : [...form.paymentMethods, { key, label: key, accountId: null }])}
                className={clsx('flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-bold transition-all',
                  active ? 'bg-[var(--app-primary)]/5 border-[var(--app-primary)]/20 text-[var(--app-primary)]' : 'border-[var(--app-border)]/50 text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]')}>
                <Icon size={13} /> {key}
                {active && <Check size={11} className="ml-auto" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rules Override */}
      <div className={card + ' p-5'}>
        <p className={sectionHead}><Shield size={10} className="text-amber-400" />Register Rules Override</p>
        <div className="space-y-0">
          {OVERRIDE_RULES.map(rule => {
            const val = form.rulesOverride[rule.key];
            const isSet = val !== undefined;
            return (
              <div key={rule.key} className="flex items-center justify-between py-2.5 border-b border-[var(--app-border)]/30 last:border-0">
                <div>
                  <p className="text-sm font-bold text-[var(--app-text)]">{rule.label}</p>
                  <p className="text-[10px] text-[var(--app-text-muted)]">{isSet ? 'Override active' : 'Using global'}</p>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {isSet && <button onClick={() => { const r = { ...form.rulesOverride }; delete r[rule.key]; set('rulesOverride', r); }} className="text-[9px] text-[var(--app-text-muted)] hover:text-red-400 transition-all">reset</button>}
                  <button onClick={() => set('rulesOverride', { ...form.rulesOverride, [rule.key]: !val })}
                    className={clsx('w-10 h-5 rounded-full relative transition-all', isSet ? (val ? 'bg-amber-500' : 'bg-[var(--app-surface)]') : 'bg-[var(--app-surface)] opacity-40')}>
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

/* ══════════════════════════════════════════════════════════════════
   GLOBAL SETTINGS TAB
   ══════════════════════════════════════════════════════════════════ */
function GlobalSettings() {
  const [section, setSection] = useState<'security' | 'delivery'>('security');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-[var(--app-text)]">Global Settings</h2>
        <p className="text-xs text-[var(--app-text-muted)]">Applies to all registers unless overridden</p>
      </div>
      <div className="flex gap-2">
        {([['security', 'Security Rules', Shield, 'text-amber-400'], ['delivery', 'Delivery & SMS', Truck, 'text-red-400']] as const).map(([id, lbl, Icon, color]) => (
          <button key={id} onClick={() => setSection(id)}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all',
              section === id ? 'bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-text)]' : `${color} opacity-50 hover:opacity-80`)}>
            <Icon size={14} />{lbl}
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
    pos_offline_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      erpFetch('pos/pos-settings/').catch(() => ({})),
      erpFetch('pos-registers/pos-settings/').catch(() => ({})),
    ]).then(([sec, reg]) => { setRules(r => ({ ...r, ...sec, ...reg })); }).finally(() => setLoading(false));
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
      <div className="flex items-center justify-between py-2.5 border-b border-[var(--app-border)]/30 last:border-0">
        <div><p className="text-sm font-bold text-[var(--app-text)]">{label}</p><p className="text-[10px] text-[var(--app-text-muted)]">{desc}</p></div>
        <button onClick={() => set(k, !rules[k])} className={clsx('w-10 h-5 rounded-full relative transition-all ml-4 shrink-0', rules[k] ? 'bg-[var(--app-primary)]' : 'bg-[var(--app-surface)]')}>
          <span className={clsx('w-3.5 h-3.5 rounded-full bg-white shadow absolute top-0.5 transition-all', rules[k] ? 'left-5' : 'left-0.5')} />
        </button>
      </div>
    );
  }
  function NRow({ label, k, suffix }: { label: string; k: string; suffix: string }) {
    return (
      <div className="flex items-center justify-between py-2.5 border-b border-[var(--app-border)]/30 last:border-0">
        <p className="text-sm font-bold text-[var(--app-text)]">{label}</p>
        <div className="flex items-center gap-1.5 ml-4 shrink-0">
          <input type="number" value={rules[k] || 0} onChange={e => set(k, +e.target.value)} className="w-16 px-2 py-1 bg-[var(--app-bg)] border border-[var(--app-border)] rounded-lg text-[var(--app-text)] text-sm font-bold text-center outline-none" />
          <span className="text-[10px] text-[var(--app-text-muted)] font-bold">{suffix}</span>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[var(--app-text-muted)]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save All</button></div>
      {[
        {
          title: 'Connectivity', color: '#06b6d4', icon: Zap, rows: [
            <TRow key="offline" label="POS Offline Mode" desc="Allow POS to queue orders offline and sync later" k="pos_offline_enabled" />,
          ]
        },
        {
          title: 'Authentication', color: 'var(--app-primary)', icon: Key, rows: [
            <TRow key="a" label="Require PIN to Login" desc="Users must enter PIN to access" k="requirePinForLogin" />,
            <TRow key="b" label="Allow Cashier Switching" desc="Switch without closing register" k="allowCashierSwitch" />,
            <NRow key="c" label="Auto-Lock After Idle" k="autoLockIdleMinutes" suffix="min" />,
          ]
        },
        {
          title: 'Manager Overrides', color: '#ef4444', icon: Shield, rows: [
            <TRow key="a" label="Void / Cancel Order" desc="Require manager PIN to void" k="requireManagerForVoid" />,
            <TRow key="b" label="Apply Discount" desc="Require manager PIN for discounts" k="requireManagerForDiscount" />,
            <TRow key="c" label="Price Override" desc="Require manager PIN to lower price" k="requireManagerForPriceOverride" />,
            <TRow key="d" label="Process Refund" desc="Require manager PIN for refunds" k="requireManagerForRefund" />,
            <TRow key="e" label="Clear Cart" desc="Require manager PIN to clear cart" k="requireManagerForClearCart" />,
            <TRow key="f" label="Delete Line Item" desc="Require manager PIN to remove item" k="requireManagerForDeleteItem" />,
            <NRow key="g" label="Max Discount Without Approval" k="maxDiscountPercent" suffix="%" />,
          ]
        },
        {
          title: 'Register Rules', color: '#f59e0b', icon: Monitor, rows: [
            <TRow key="a" label="Lock on Close" desc="Prevent access after closing" k="lockRegisterOnClose" />,
            <TRow key="b" label="Print Z-Report on Close" desc="Auto-print summary" k="printReceiptOnClose" />,
            <TRow key="c" label="Require Cash Count" desc="Count cash on close" k="requireCountOnClose" />,
            <TRow key="d" label="Allow Negative Stock" desc="Sell even if stock is 0" k="allowNegativeStock" />,
          ]
        },
        {
          title: 'Reconciliation', color: '#3b82f6', icon: Zap, rows: [
            <TRow key="a" label="Enable Reconciliation" desc="Full reconciliation on close" k="enableReconciliation" />,
            <TRow key="b" label="Controlled = Truth" desc="Wave/OM/Bank are always correct" k="controlledAccountsAreTruth" />,
            <TRow key="c" label="Auto-Calibrate Cash" desc="Mismatch adjusts cash" k="autoCalibrateToClose" />,
            <TRow key="d" label="Require Statement Entry" desc="Cashier enters provider amounts" k="requireStatementOnClose" />,
            <TRow key="e" label="Account Book" desc="Enable Livre de Caisse" k="enableAccountBook" />,
            <TRow key="f" label="Auto-Transfer Excess" desc="Surplus to reserve" k="autoTransferExcessToReserve" />,
            <TRow key="g" label="Unique Cash Per Register" desc="Isolated cash accounts" k="restrict_unique_cash_account" />,
          ]
        },
      ].map(sec => (
        <div key={sec.title} className={card + ' p-5'}>
          <p className={sectionHead}><sec.icon size={10} style={{ color: sec.color }} />{sec.title}</p>
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
  const FIELDS: Record<string, string[]> = { twilio: ['twilio_account_sid', 'twilio_auth_token', 'twilio_from_number'], orange: ['orange_api_key', 'orange_sender_id'], whatsapp: ['whatsapp_token', 'whatsapp_phone_id'] };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-[var(--app-text-muted)]" /></div>;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={handleSave} disabled={saving} className={btnPrimary}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Save</button></div>
      <div className={card + ' p-5'}>
        <p className={sectionHead}><Hash size={10} style={{ color: 'var(--app-primary)' }} />Delivery Codes</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={label}>Mode</label><select value={s.delivery_code_mode} onChange={e => set('delivery_code_mode', e.target.value)} className={input}><option value="auto">Auto-generate</option><option value="manual">Manual</option><option value="disabled">Disabled</option></select></div>
          <div><label className={label}>Digits</label><input type="number" min={4} max={8} value={s.delivery_code_digits} onChange={e => set('delivery_code_digits', +e.target.value)} className={input} /></div>
          <div><label className={label}>Expiry (hours)</label><input type="number" value={s.delivery_code_expiry_hours} onChange={e => set('delivery_code_expiry_hours', +e.target.value)} className={input} /></div>
        </div>
      </div>
      <div className={card + ' p-5'}>
        <p className={sectionHead}><Phone size={10} className="text-blue-400" />SMS Provider</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {PROVIDERS.map(p => (
            <button key={p.key} onClick={() => set('sms_provider', p.key)}
              className={clsx('flex items-center gap-2 p-3 rounded-xl border text-left transition-all', s.sms_provider === p.key ? 'border-[var(--app-border)] bg-[var(--app-surface)] shadow-sm' : 'border-[var(--app-border)]/30 hover:bg-[var(--app-surface)]')}>
              <p.icon size={15} className={s.sms_provider === p.key ? 'text-[var(--app-primary)]' : 'text-[var(--app-text-muted)]'} />
              <span className="text-sm font-bold text-[var(--app-text)]">{p.label}</span>
              {s.sms_provider === p.key && <Check size={11} className="ml-auto text-[var(--app-primary)]" />}
            </button>
          ))}
        </div>
        {FIELDS[s.sms_provider] && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS[s.sms_provider].map(field => (
              <div key={field}><label className={label}>{field.replace(/_/g, ' ')}</label><input type="password" value={s[field] || ''} onChange={e => set(field, e.target.value)} className={input} /></div>
            ))}
          </div>
        )}
      </div>
      {s.sms_provider !== 'none' && (
        <div className={card + ' p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3'}>
          <TestTube size={13} className="text-[var(--app-text-muted)] shrink-0 hidden sm:block" />
          <input placeholder="Test phone number" value={testPhone} onChange={e => setTestPhone(e.target.value)} className={input + ' flex-1'} />
          <button onClick={testSMS} disabled={testing} className={btnPrimary + ' justify-center'}>{testing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}Test</button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   USERS & PINs VIEW
   ══════════════════════════════════════════════════════════════════ */
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="text-lg font-black text-[var(--app-text)]">Users & PIN Codes</h2><p className="text-xs text-[var(--app-text-muted)]">Global cashier access & manager PINs</p></div>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…" className={input + ' sm:w-44'} />
      </div>
      <div className="space-y-2">
        {filtered.map(u => {
          const name = `${u.first_name} ${u.last_name}`.trim() || u.username;
          return (
            <div key={u.id} className={card + ' p-4'}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-sm shrink-0">
                  {(u.first_name?.[0] || u.username?.[0] || '?').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--app-text)] truncate">{name} <span className="text-[var(--app-text-muted)] text-xs font-normal">@{u.username}</span></p>
                  <p className="text-[10px] text-[var(--app-text-muted)]">{u.role_name || 'Staff'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-black', u.pos_pin ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                    {u.pos_pin ? '● PIN' : '○ No PIN'}
                  </span>
                  <span className={clsx('text-[9px] px-2 py-0.5 rounded-full font-black', u.has_override_pin ? 'bg-amber-500/10 text-amber-400' : 'bg-[var(--app-surface)] text-[var(--app-text-muted)]')}>
                    {u.has_override_pin ? '⚑ Override' : '○ N/A'}
                  </span>
                  <button onClick={() => { setPinFor(pinFor === u.id ? null : u.id); setPinVal(''); }} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-400/40 hover:text-blue-400 transition-all"><Key size={13} /></button>
                  <button onClick={() => { setOverrideFor(overrideFor === u.id ? null : u.id); setOverrideVal(''); }} className="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-400/40 hover:text-amber-400 transition-all"><Shield size={13} /></button>
                </div>
              </div>
              {pinFor === u.id && (
                <div className="mt-3 flex items-center gap-2">
                  <input type={show ? 'text' : 'password'} placeholder="PIN (4-6 digits)" value={pinVal} onChange={e => setPinVal(e.target.value.replace(/\D/g, '').slice(0, 6))} className={input + ' flex-1'} />
                  <button onClick={() => setShow(v => !v)} className="p-2 text-[var(--app-text-muted)]">{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  <button onClick={() => setPin(u.id)} disabled={saving} className={btnPrimary + ' px-3 py-2 text-xs'}>{saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Set</button>
                  <button onClick={() => setPinFor(null)} className="p-2 text-[var(--app-text-muted)]"><X size={13} /></button>
                </div>
              )}
              {overrideFor === u.id && (
                <div className="mt-3 flex items-center gap-2">
                  <input type="password" placeholder="Manager override PIN" value={overrideVal} onChange={e => setOverrideVal(e.target.value.replace(/\D/g, '').slice(0, 6))} className={input + ' flex-1'} />
                  <button onClick={() => setOverride(u.id)} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl font-black text-xs disabled:opacity-50 transition-all">{saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}Set Override</button>
                  <button onClick={() => setOverrideFor(null)} className="p-2 text-[var(--app-text-muted)]"><X size={13} /></button>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className={card + ' p-10 text-center'}><Users size={28} className="text-[var(--app-text-muted)]/30 mx-auto mb-2" /><p className="text-[var(--app-text-muted)] text-sm font-bold">No users found</p></div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PAYMENT ACCOUNTS VIEW
   ══════════════════════════════════════════════════════════════════ */
function AccountsView({ accounts, onRefresh }: { accounts: FA[]; onRefresh: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-black text-[var(--app-text)]">Payment Accounts</h2>
        <p className="text-xs text-[var(--app-text-muted)]">Full settings in Finance → Chart of Accounts</p>
      </div>
      <div className={card + ' p-4 flex items-start gap-3'}>
        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-400">Account Access Managed in Finance</p>
          <p className="text-[10px] text-[var(--app-text-muted)] mt-1">To control multi-register access, go to <Link href="/finance/chart-of-accounts" className="text-amber-400/70 underline">Finance → Chart of Accounts</Link>.</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {accounts.map(a => (
          <div key={a.id} className={card + ' p-4 flex items-center gap-3'}>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
              <CreditCard size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--app-text)] truncate">{a.name}</p>
              <p className="text-[10px] text-[var(--app-text-muted)]">{a.type} · {a.currency}</p>
            </div>
          </div>
        ))}
        {accounts.length === 0 && <div className={card + ' col-span-full p-10 text-center'}><CreditCard size={28} className="text-[var(--app-text-muted)]/30 mx-auto mb-2" /><p className="text-[var(--app-text-muted)] text-sm font-bold">No accounts found</p></div>}
      </div>
    </div>
  );
}
