'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Zap, Repeat,
  RefreshCw, Search, Package, ShoppingCart, DollarSign, Users,
  Briefcase, UserCheck, Settings2, Maximize2, Minimize2, Loader2,
} from 'lucide-react';

interface RuleHealth {
  id: number;
  code: string | null;
  name: string;
  module: string | null;
  trigger_event: string;
  rule_type: 'EVENT' | 'RECURRING';
  is_active: boolean;
  recurrence_interval: string | null;
  last_fired_at: string | null;
  tasks_fired_last_7d: number;
  tasks_fired_last_30d: number;
  is_stale: boolean;
}

interface HealthResponse {
  generated_at: string;
  total_rules: number;
  active_rules: number;
  stale_rules: number;
  fired_last_7d: number;
  rules: RuleHealth[];
}

const MODULE_ICONS: Record<string, typeof Package> = {
  inventory: Package,
  purchasing: ShoppingCart,
  finance: DollarSign,
  crm: Users,
  sales: Briefcase,
  hr: UserCheck,
  system: Settings2,
};

type FilterKey = 'ALL' | 'STALE' | 'ACTIVE' | 'INACTIVE';

function formatRelative(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function AutoTaskHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);
  const [search, setSearch] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await erpFetch('workspace/auto-rules/health/');
      setData(res as HealthResponse);
    } catch {
      toast.error('Failed to load auto-task health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Ctrl+K / Ctrl+Q shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.rules;
    if (activeFilter === 'STALE') rows = rows.filter(r => r.is_stale);
    else if (activeFilter === 'ACTIVE') rows = rows.filter(r => r.is_active);
    else if (activeFilter === 'INACTIVE') rows = rows.filter(r => !r.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.trigger_event?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, activeFilter, search]);

  // KPI strip — with optional filter toggle mode
  const kpis: { label: string; value: number; color: string; icon: React.ReactNode; filterKey: FilterKey | null }[] = [
    { label: 'Total',    value: data?.total_rules ?? 0,  color: 'var(--app-primary)',          icon: <Zap size={14} />,            filterKey: 'ALL' },
    { label: 'Active',   value: data?.active_rules ?? 0, color: 'var(--app-success, #22c55e)', icon: <CheckCircle2 size={14} />,   filterKey: 'ACTIVE' },
    { label: 'Stale',    value: data?.stale_rules ?? 0,  color: 'var(--app-error, #ef4444)',   icon: <AlertTriangle size={14} />,  filterKey: 'STALE' },
    { label: 'Fired 7d', value: data?.fired_last_7d ?? 0, color: 'var(--app-info, #3b82f6)',   icon: <Repeat size={14} />,         filterKey: null },
  ];

  return (
    <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
      {/* ── Header ────────────────────────────────────────────────── */}
      {focusMode ? (
        <div className="flex items-center gap-2 flex-shrink-0 mb-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
              <Activity size={14} className="text-white" />
            </div>
            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Auto-Task Health</span>
            <span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length}/{data?.total_rules ?? 0}</span>
          </div>
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search… (Ctrl+K)"
              className="w-full pl-9 pr-3 py-1.5 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
            />
          </div>
          <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
            <Minimize2 size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0 mb-3">
          <div className="page-header-icon bg-app-primary"
               style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
            <Activity size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
              Auto-Task Health
            </h1>
            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
              {data?.total_rules ?? 0} Rules · {data?.stale_rules ?? 0} Stale · Fired {data?.fired_last_7d ?? 0} (7d)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span className="hidden md:inline">Refresh</span>
            </button>
            <button
              onClick={() => setFocusMode(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
              title="Focus Mode (Ctrl+Q)"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      )}

      {!focusMode && (
        <>
          {/* ── KPI Strip (with filter-toggle mode) ───────────────── */}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}
            className="flex-shrink-0 mb-3"
          >
            {kpis.map(k => {
              const isActive = !!k.filterKey && activeFilter === k.filterKey;
              const clickable = k.filterKey !== null;
              return (
                <button
                  key={k.label}
                  disabled={!clickable}
                  onClick={() => {
                    if (!k.filterKey) return;
                    setActiveFilter(prev => prev === k.filterKey ? null : k.filterKey);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left ${clickable ? 'cursor-pointer' : 'cursor-default'} ${isActive ? 'ring-2 shadow-md scale-[1.02]' : ''}`}
                  style={{
                    background: isActive
                      ? `color-mix(in srgb, ${k.color} 15%, var(--app-surface))`
                      : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                    border: `1px solid color-mix(in srgb, ${isActive ? k.color : 'var(--app-border)'} ${isActive ? '50' : '50'}%, transparent)`,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}
                  >
                    {k.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
                      {k.label}
                    </div>
                    <div className="text-sm font-black text-app-foreground tabular-nums">{k.value}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active filter pill */}
          {activeFilter && activeFilter !== 'ALL' && (
            <div className="flex items-center gap-2 flex-shrink-0 mb-3">
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg"
                style={{
                  background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                  color: 'var(--app-primary)',
                  border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                }}
              >
                Filter: {activeFilter}
                <button onClick={() => setActiveFilter(null)} className="hover:opacity-70">✕</button>
              </span>
            </div>
          )}

          {/* ── Search bar ─────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-shrink-0 mb-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, code, trigger… (Ctrl+K)"
                className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
              />
            </div>
          </div>
        </>
      )}

      {/* ── Table Container ──────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
        {/* Column Headers */}
        <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
          <div className="w-7 flex-shrink-0" />
          <div className="flex-1 min-w-0">Rule</div>
          <div className="hidden sm:block w-24 flex-shrink-0">Type</div>
          <div className="hidden md:block w-28 flex-shrink-0">Last Fired</div>
          <div className="w-12 text-right flex-shrink-0">7d</div>
          <div className="hidden sm:block w-12 text-right flex-shrink-0">30d</div>
          <div className="w-20 text-center flex-shrink-0">Status</div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
          {loading && !data ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-app-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Activity size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No rules found</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">
                Try clearing the filter or adjusting search terms.
              </p>
            </div>
          ) : (
            filtered.map(rule => {
              const ModIcon = MODULE_ICONS[rule.module ?? 'system'] ?? Settings2;
              const borderColor = rule.is_stale
                ? 'var(--app-error, #ef4444)'
                : rule.is_active
                  ? 'var(--app-success, #22c55e)'
                  : 'var(--app-border)';
              return (
                <div
                  key={rule.id}
                  className={`group flex items-center gap-2 md:gap-3 transition-all duration-150 border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5 ${!rule.is_active ? 'opacity-60' : ''}`}
                  style={{
                    paddingLeft: '12px',
                    paddingRight: '12px',
                    borderLeft: `3px solid ${borderColor}`,
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                      color: 'var(--app-muted-foreground)',
                    }}
                  >
                    <ModIcon size={13} />
                  </div>

                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    {rule.code && (
                      <span
                        className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                          color: 'var(--app-muted-foreground)',
                        }}
                      >
                        {rule.code}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-bold text-app-foreground">{rule.name}</div>
                      <div className="truncate text-[11px] font-medium text-app-muted-foreground">{rule.trigger_event}</div>
                    </div>
                  </div>

                  <div className="hidden sm:block w-24 flex-shrink-0">
                    <span
                      className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center"
                      style={{
                        background: rule.rule_type === 'EVENT'
                          ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)'
                          : 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                        color: rule.rule_type === 'EVENT' ? 'var(--app-primary)' : 'var(--app-warning, #f59e0b)',
                        border: `1px solid color-mix(in srgb, ${rule.rule_type === 'EVENT' ? 'var(--app-primary)' : 'var(--app-warning, #f59e0b)'} 25%, transparent)`,
                      }}
                    >
                      {rule.rule_type === 'EVENT' ? 'Event' : (rule.recurrence_interval ?? 'Recurring')}
                    </span>
                  </div>

                  <div className="hidden md:flex w-28 flex-shrink-0 items-center gap-1 text-[11px] font-bold text-app-muted-foreground">
                    <Clock size={10} /> {formatRelative(rule.last_fired_at)}
                  </div>

                  <div className="w-12 text-right font-mono text-[12px] font-bold tabular-nums flex-shrink-0"
                       style={{ color: rule.tasks_fired_last_7d > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                    {rule.tasks_fired_last_7d}
                  </div>
                  <div className="hidden sm:block w-12 text-right font-mono text-[12px] font-bold tabular-nums flex-shrink-0"
                       style={{ color: rule.tasks_fired_last_30d > 0 ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                    {rule.tasks_fired_last_30d}
                  </div>

                  <div className="w-20 flex-shrink-0 flex justify-center">
                    {rule.is_stale ? (
                      <span
                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                        style={{
                          background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
                          color: 'var(--app-error, #ef4444)',
                          border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)',
                        }}
                      >
                        <AlertTriangle size={10} /> Stale
                      </span>
                    ) : rule.is_active ? (
                      <span
                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                        style={{
                          background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                          color: 'var(--app-success, #22c55e)',
                          border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)',
                        }}
                      >
                        <CheckCircle2 size={10} /> OK
                      </span>
                    ) : (
                      <span
                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                          color: 'var(--app-muted-foreground)',
                        }}
                      >
                        Off
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
