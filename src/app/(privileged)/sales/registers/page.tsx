// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import { Plus, RefreshCw, Settings, Power, PowerOff, Loader2, X, Check, Monitor } from 'lucide-react';
import Link from 'next/link';

export default function RegistersPage() {
  const [registers, setRegisters] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    branch: '',
    warehouse: '',
    cash_account: '',
    is_active: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [regsData, whData, acctData] = await Promise.all([
        erpFetch('pos-registers/').catch(() => []),
        erpFetch('inventory/warehouses/').catch(() => []),
        erpFetch('accounts/').catch(() => []),
      ]);
      const regs = Array.isArray(regsData) ? regsData : regsData?.results || [];
      const whs = Array.isArray(whData) ? whData : whData?.results || [];
      const accts = Array.isArray(acctData) ? acctData : acctData?.results || [];
      setRegisters(regs);
      setWarehouses(whs);
      setAccounts(accts);
    } catch (err) {
      toast.error('Failed to load registers');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Register name is required'); return; }
    if (!form.branch) { toast.error('Branch (warehouse) is required'); return; }
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        branch: Number(form.branch),
        warehouse: form.warehouse ? Number(form.warehouse) : null,
        cash_account: form.cash_account ? Number(form.cash_account) : null,
        is_active: form.is_active,
      };
      const result = await erpFetch('pos-registers/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (result?.id) {
        toast.success(`Register "${result.name}" created`);
        setShowCreate(false);
        setForm({ name: '', branch: '', warehouse: '', cash_account: '', is_active: true });
        load();
      } else {
        toast.error(result?.detail || result?.name?.[0] || 'Failed to create register');
      }
    } catch (err) {
      toast.error('Connection error');
    }
    setCreating(false);
  };

  const handleToggleActive = async (reg) => {
    try {
      await erpFetch(`pos-registers/${reg.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !reg.is_active }),
      });
      toast.success(reg.is_active ? 'Register deactivated' : 'Register activated');
      load();
    } catch {
      toast.error('Failed to update register');
    }
  };

  // Separate branches (parent warehouses) from child warehouses
  const branches = warehouses.filter(w => !w.parent && !w.parent_id);
  const childWarehouses = warehouses.filter(w => w.parent || w.parent_id);
  const filteredChildWarehouses = form.branch
    ? childWarehouses.filter(w => (w.parent === Number(form.branch) || w.parent_id === Number(form.branch)))
    : childWarehouses;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-app-text tracking-tight flex items-center gap-3">
            <Monitor className="text-app-primary" size={24} />
            POS Registers
          </h1>
          <p className="text-app-text/40 text-sm mt-1">
            Manage your point-of-sale registers and their configurations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="p-2.5 rounded-xl bg-app-text/5 hover:bg-app-text/10 text-app-text/50 hover:text-app-text transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-app-primary text-white font-bold text-sm hover:opacity-90 transition-all"
          >
            <Plus size={16} /> New Register
          </button>
        </div>
      </div>

      {/* Register list */}
      {loading && registers.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-app-text/30">
          <Loader2 className="animate-spin mr-2" size={20} /> Loading registers…
        </div>
      ) : registers.length === 0 ? (
        <div className="text-center py-20">
          <Monitor size={48} className="mx-auto text-app-text/10 mb-4" />
          <p className="text-app-text/40 text-lg font-bold">No registers yet</p>
          <p className="text-app-text/30 text-sm mt-1">Create your first register to get started with POS</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-6 px-6 py-3 rounded-2xl bg-app-primary text-white font-bold hover:opacity-90 transition-all"
          >
            Create Register
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {registers.map((reg) => (
            <div
              key={reg.id}
              className={`p-5 rounded-2xl border transition-all ${
                reg.is_active
                  ? 'bg-app-surface border-app-border hover:border-app-primary/30'
                  : 'bg-app-text/3 border-app-border/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-black text-app-text text-base">{reg.name}</h3>
                  <p className="text-app-text/40 text-xs mt-0.5">
                    {reg.branch_name || reg.branch?.name || 'No branch'} · ID #{reg.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    reg.is_active ? 'bg-green-500/15 text-green-400' : 'bg-app-text/10 text-app-text/30'
                  }`}>
                    {reg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-app-text/50 mb-4">
                {(reg.cash_account_name || reg.cash_account) && (
                  <div className="flex justify-between">
                    <span>Cash Account</span>
                    <span className="font-bold text-app-text/70">{reg.cash_account_name || reg.cash_account}</span>
                  </div>
                )}
                {(reg.warehouse_name || reg.warehouse) && (
                  <div className="flex justify-between">
                    <span>Stock Warehouse</span>
                    <span className="font-bold text-app-text/70">{reg.warehouse_name || reg.warehouse}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Config Status</span>
                  <span className={`font-bold ${reg.is_config_complete ? 'text-green-400' : 'text-amber-400'}`}>
                    {reg.is_config_complete ? '✓ Complete' : '⚠ Incomplete'}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  href="/sales/pos-settings"
                  className="flex-1 py-2 text-center rounded-xl bg-app-text/5 hover:bg-app-text/10 text-app-text/60 hover:text-app-text text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Settings size={13} /> Configure
                </Link>
                <button
                  onClick={() => handleToggleActive(reg)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    reg.is_active
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400'
                      : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'
                  }`}
                >
                  {reg.is_active ? <><PowerOff size={13} /> Deactivate</> : <><Power size={13} /> Activate</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowCreate(false)}
        >
          <div className="w-full max-w-md bg-app-surface rounded-3xl border border-app-text/10 shadow-2xl overflow-hidden">
            <div className="px-6 py-5 border-b border-app-text/5 flex items-center justify-between">
              <h2 className="text-app-text font-black text-lg">New Register</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="w-8 h-8 rounded-xl bg-app-text/5 hover:bg-app-text/10 text-app-text/40 flex items-center justify-center"
              >
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-black text-app-text/40 uppercase tracking-widest mb-1.5">
                  Register Name *
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Caisse 1, Register A"
                  className="w-full px-4 py-3 bg-app-text/5 border border-app-text/10 rounded-xl text-app-text text-sm outline-none focus:ring-2 focus:ring-app-primary/40"
                />
              </div>

              {/* Branch */}
              <div>
                <label className="block text-xs font-black text-app-text/40 uppercase tracking-widest mb-1.5">
                  Branch (Site) *
                </label>
                <select
                  value={form.branch}
                  onChange={e => setForm(f => ({ ...f, branch: e.target.value, warehouse: '' }))}
                  className="w-full px-4 py-3 bg-app-text/5 border border-app-text/10 rounded-xl text-app-text text-sm outline-none focus:ring-2 focus:ring-app-primary/40"
                >
                  <option value="">Select branch…</option>
                  {branches.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                  {branches.length === 0 && warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Warehouse */}
              <div>
                <label className="block text-xs font-black text-app-text/40 uppercase tracking-widest mb-1.5">
                  Stock Warehouse
                </label>
                <select
                  value={form.warehouse}
                  onChange={e => setForm(f => ({ ...f, warehouse: e.target.value }))}
                  className="w-full px-4 py-3 bg-app-text/5 border border-app-text/10 rounded-xl text-app-text text-sm outline-none focus:ring-2 focus:ring-app-primary/40"
                >
                  <option value="">Same as branch</option>
                  {(filteredChildWarehouses.length > 0 ? filteredChildWarehouses : warehouses).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Cash Account */}
              <div>
                <label className="block text-xs font-black text-app-text/40 uppercase tracking-widest mb-1.5">
                  Cash Account
                </label>
                <select
                  value={form.cash_account}
                  onChange={e => setForm(f => ({ ...f, cash_account: e.target.value }))}
                  className="w-full px-4 py-3 bg-app-text/5 border border-app-text/10 rounded-xl text-app-text text-sm outline-none focus:ring-2 focus:ring-app-primary/40"
                >
                  <option value="">Select account…</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.code || a.type})</option>
                  ))}
                </select>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-bold text-app-text/60">Active on creation</span>
                <button
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`w-10 h-6 rounded-full relative transition-all ${form.is_active ? 'bg-app-primary' : 'bg-app-text/20'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${form.is_active ? 'left-5' : 'left-1'}`} />
                </button>
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl bg-app-text/5 hover:bg-app-text/10 text-app-text/50 font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !form.name.trim() || !form.branch}
                className="flex-1 py-3 rounded-xl bg-app-primary hover:opacity-90 text-white font-black text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                {creating ? 'Creating…' : 'Create Register'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
