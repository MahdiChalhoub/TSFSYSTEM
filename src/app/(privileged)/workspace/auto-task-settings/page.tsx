'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import {
  Zap, Package, ShoppingCart, DollarSign, Users, Briefcase, UserCheck,
  Settings2, ChevronDown, ChevronRight, Edit3, Link2, Search, Repeat,
  Plus, Activity, Loader2, Maximize2, Minimize2,
} from 'lucide-react';

interface RuleGroup {
  module: string;
  module_display: string;
  total: number;
  active: number;
  event_count: number;
  recurring_count: number;
  rules: any[];
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

const INTERVAL_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
};

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: 'var(--app-error, #ef4444)',
  HIGH: 'var(--app-warning, #f59e0b)',
  MEDIUM: 'var(--app-info, #3b82f6)',
  LOW: 'var(--app-muted-foreground)',
};

type FilterType = 'ALL' | 'EVENT' | 'RECURRING';

export default function AutoTaskSettingsPage() {
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<FilterType | null>(null);
  const [search, setSearch] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await erpFetch('auto-task-rules/grouped/');
      setGroups(Array.isArray(data) ? data : []);
      if (Array.isArray(data)) {
        setExpandedModules(new Set(data.map((g: RuleGroup) => g.module)));
      }
    } catch {
      toast.error('Failed to load auto-task rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const toggleModule = (mod: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod); else next.add(mod);
      return next;
    });
  };

  const toggleRule = async (ruleId: number, currentActive: boolean) => {
    try {
      await erpFetch(`auto-task-rules/${ruleId}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !currentActive }),
      });
      load();
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const filteredGroups = useMemo(() => {
    return groups.map(group => {
      let rules = group.rules;
      if (activeFilter === 'EVENT' || activeFilter === 'RECURRING') {
        rules = rules.filter(r => r.rule_type === activeFilter);
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        rules = rules.filter(r =>
          r.name?.toLowerCase().includes(q) ||
          r.trigger_display?.toLowerCase().includes(q) ||
          r.code?.toLowerCase().includes(q)
        );
      }
      return {
        ...group,
        rules,
        total: rules.length,
        active: rules.filter((r: any) => r.is_active).length,
      };
    }).filter(g => g.rules.length > 0);
  }, [groups, activeFilter, search]);

  const totalRules = groups.reduce((s, g) => s + g.total, 0);
  const totalActive = groups.reduce((s, g) => s + g.active, 0);
  const totalEvent = groups.reduce((s, g) => s + g.event_count, 0);
  const totalRecurring = groups.reduce((s, g) => s + g.recurring_count, 0);

  const kpis: { label: string; value: number; color: string; icon: React.ReactNode; filterKey: FilterType | null }[] = [
    { label: 'Total',     value: totalRules,     color: 'var(--app-primary)',          icon: <Zap size={14} />,        filterKey: null },
    { label: 'Active',    value: totalActive,    color: 'var(--app-success, #22c55e)', icon: <Activity size={14} />,   filterKey: null },
    { label: 'Event',     value: totalEvent,     color: 'var(--app-info, #3b82f6)',    icon: <Zap size={14} />,        filterKey: 'EVENT' },
    { label: 'Recurring', value: totalRecurring, color: 'var(--app-warning, #f59e0b)', icon: <Repeat size={14} />,     filterKey: 'RECURRING' },
  ];

  return (
    <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
      {/* ── Header ────────────────────────────────────────────────── */}
      {focusMode ? (
        <div className="flex items-center gap-2 flex-shrink-0 mb-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Auto-Task Settings</span>
            <span className="text-[10px] font-bold text-app-muted-foreground">{totalActive}/{totalRules}</span>
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
            <Zap size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
              Auto-Task Settings
            </h1>
            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
              {totalRules} Rules · {totalActive} Active · {totalEvent} Event · {totalRecurring} Recurring
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href="/workspace/auto-task-health"
              className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
            >
              <Activity size={13} />
              <span className="hidden md:inline">Health</span>
            </a>
            <a
              href="/workspace/auto-task-rules"
              className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
              style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Rule</span>
            </a>
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
          {/* ── KPI Strip ─────────────────────────────────────────── */}
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
                    border: `1px solid color-mix(in srgb, ${isActive ? k.color : 'var(--app-border)'} 50%, transparent)`,
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

          {activeFilter && (
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
                placeholder="Search rules… (Ctrl+K)"
                className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
              />
            </div>
          </div>
        </>
      )}

      {/* ── Tree Container ───────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-app-primary" />
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Zap size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No auto-task rules match your filters</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">
                Create rules to automate task creation across your modules.
              </p>
            </div>
          ) : (
            filteredGroups.map(group => {
              const Icon = MODULE_ICONS[group.module] ?? Settings2;
              const isExpanded = expandedModules.has(group.module);

              return (
                <div key={group.module}>
                  {/* Module Row (root) */}
                  <button
                    onClick={() => toggleModule(group.module)}
                    className="w-full group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface py-2.5 md:py-3"
                    style={{
                      paddingLeft: '12px',
                      paddingRight: '12px',
                      background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                      borderLeft: '3px solid var(--app-primary)',
                    }}
                  >
                    <div className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-app-border/50 text-app-muted-foreground flex-shrink-0">
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </div>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        color: 'var(--app-primary)',
                      }}
                    >
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="truncate text-[13px] font-bold text-app-foreground">{group.module_display}</span>
                    </div>
                    {group.event_count > 0 && (
                      <span
                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                          color: 'var(--app-info, #3b82f6)',
                          border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
                        }}
                      >
                        {group.event_count} event
                      </span>
                    )}
                    {group.recurring_count > 0 && (
                      <span
                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                          background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                          color: 'var(--app-warning, #f59e0b)',
                          border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)',
                        }}
                      >
                        {group.recurring_count} recurring
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-app-muted-foreground tabular-nums flex-shrink-0">
                      {group.active}/{group.total}
                    </span>
                  </button>

                  {/* Rule Rows (children) */}
                  {isExpanded && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                      {group.rules.map((rule: any) => (
                        <div
                          key={rule.id}
                          className={`group flex items-center gap-2 md:gap-3 transition-all duration-150 border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2 ${!rule.is_active ? 'opacity-60' : ''}`}
                          style={{
                            paddingLeft: '32px',
                            paddingRight: '12px',
                            borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            marginLeft: '22px',
                          }}
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleRule(rule.id, rule.is_active); }}
                            className={`w-9 h-4 rounded-full relative transition-all flex-shrink-0 ${rule.is_active ? 'bg-app-primary' : 'bg-app-border'}`}
                            title={rule.is_active ? 'Disable' : 'Enable'}
                          >
                            <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow ${rule.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                          </button>

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

                          <div className="flex-1 min-w-0">
                            <div className="truncate text-[13px] font-medium text-app-foreground">{rule.name}</div>
                            <div className="flex items-center gap-2 text-[11px] font-medium text-app-muted-foreground">
                              <span className="truncate">{rule.trigger_display}</span>
                              {rule.chain_parent_name && (
                                <span className="flex items-center gap-0.5 flex-shrink-0" style={{ color: 'var(--app-primary)' }}>
                                  <Link2 size={10} /> after: {rule.chain_parent_name}
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:inline-flex"
                            style={{
                              background: rule.rule_type === 'EVENT'
                                ? 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)'
                                : 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                              color: rule.rule_type === 'EVENT' ? 'var(--app-info, #3b82f6)' : 'var(--app-warning, #f59e0b)',
                              border: `1px solid color-mix(in srgb, ${rule.rule_type === 'EVENT' ? 'var(--app-info)' : 'var(--app-warning)'} 25%, transparent)`,
                            }}
                          >
                            {rule.rule_type === 'EVENT' ? 'Event' : (INTERVAL_LABELS[rule.recurrence_interval] ?? 'Recurring')}
                          </span>

                          {(rule.priority || rule.template?.default_priority) && (
                            <span
                              className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hidden md:inline-flex"
                              style={{
                                background: `color-mix(in srgb, ${PRIORITY_COLOR[rule.priority || rule.template?.default_priority] ?? 'var(--app-muted-foreground)'} 10%, transparent)`,
                                color: PRIORITY_COLOR[rule.priority || rule.template?.default_priority] ?? 'var(--app-muted-foreground)',
                                border: `1px solid color-mix(in srgb, ${PRIORITY_COLOR[rule.priority || rule.template?.default_priority] ?? 'var(--app-muted-foreground)'} 25%, transparent)`,
                              }}
                            >
                              {rule.priority || rule.template?.default_priority}
                            </span>
                          )}

                          <div className="hidden lg:flex flex-shrink-0 w-32 truncate text-[11px] font-medium text-app-muted-foreground">
                            {rule.assign_to_user_name || rule.template_name || '—'}
                          </div>

                          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href="/workspace/auto-task-rules"
                              className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"
                              title="Edit"
                            >
                              <Edit3 size={12} />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
