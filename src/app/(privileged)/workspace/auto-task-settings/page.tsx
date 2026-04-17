'use client';

import { useState, useEffect, useMemo } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import { cn } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Zap, Package, ShoppingCart, DollarSign, Users, Briefcase, UserCheck,
  Settings2, ChevronDown, ChevronRight, Edit3,
  ToggleLeft, ToggleRight, Link2, Search, Repeat, Plus, Activity,
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

const MODULE_ACCENT: Record<string, string> = {
  inventory: 'text-app-success',
  purchasing: 'text-app-info',
  finance: 'text-app-warning',
  crm: 'text-app-primary',
  sales: 'text-app-error',
  hr: 'text-app-info',
  system: 'text-app-muted-foreground',
};

const INTERVAL_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
};

const PRIORITY_BADGE: Record<string, string> = {
  URGENT: 'bg-app-error/10 text-app-error border-app-error/30',
  HIGH: 'bg-app-warning/10 text-app-warning border-app-warning/30',
  MEDIUM: 'bg-app-info/10 text-app-info border-app-info/30',
  LOW: 'bg-app-surface-2 text-app-muted-foreground border-app-border',
};

type FilterType = 'ALL' | 'EVENT' | 'RECURRING';
type FilterActive = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function AutoTaskSettingsPage() {
  const [groups, setGroups] = useState<RuleGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [filterActive, setFilterActive] = useState<FilterActive>('ALL');
  const [search, setSearch] = useState('');

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
      if (filterType !== 'ALL') rules = rules.filter(r => r.rule_type === filterType);
      if (filterActive === 'ACTIVE') rules = rules.filter(r => r.is_active);
      else if (filterActive === 'INACTIVE') rules = rules.filter(r => !r.is_active);
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
  }, [groups, filterType, filterActive, search]);

  const totalRules = groups.reduce((s, g) => s + g.total, 0);
  const totalActive = groups.reduce((s, g) => s + g.active, 0);
  const totalEvent = groups.reduce((s, g) => s + g.event_count, 0);
  const totalRecurring = groups.reduce((s, g) => s + g.recurring_count, 0);

  const TYPE_TABS: { key: FilterType; label: string }[] = [
    { key: 'ALL', label: 'All Types' },
    { key: 'EVENT', label: 'Event' },
    { key: 'RECURRING', label: 'Recurring' },
  ];
  const ACTIVE_TABS: { key: FilterActive; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'INACTIVE', label: 'Inactive' },
  ];

  return (
    <div className="p-6 space-y-6 bg-app-bg min-h-full">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-app-foreground flex items-center gap-3 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-app-warning flex items-center justify-center shadow-lg shadow-app-warning/20">
              <Zap size={20} className="text-white" />
            </div>
            Auto-Task Settings
          </h1>
          <p className="text-sm text-app-muted-foreground mt-1">
            Configure automatic task creation for every module and business process.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <a href="/workspace/auto-task-health">
              <Activity size={14} className="mr-2" /> Health
            </a>
          </Button>
          <Button asChild size="sm">
            <a href="/workspace/auto-task-rules">
              <Plus size={14} className="mr-2" /> Create Rule
            </a>
          </Button>
        </div>
      </header>

      {/* ── KPI Row ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-app-primary text-white border-0 shadow-lg shadow-app-primary/10">
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <Zap size={28} className="opacity-80" />
              <div>
                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Total Rules</p>
                <p className="text-2xl font-black">{totalRules}</p>
                <p className="text-xs font-medium opacity-60">All configured rules</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-app-success text-white border-0 shadow-lg shadow-app-success/10">
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <ToggleRight size={28} className="opacity-80" />
              <div>
                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Active</p>
                <p className="text-2xl font-black">{totalActive}</p>
                <p className="text-xs font-medium opacity-60">Eligible to fire</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-app-primary bg-app-surface/40">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Zap size={20} className="text-app-primary" />
              <div>
                <p className="text-[10px] text-app-muted-foreground uppercase font-black">Event-Based</p>
                <p className="text-lg font-black text-app-primary">{totalEvent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-app-warning bg-app-surface/40">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Repeat size={20} className="text-app-warning" />
              <div>
                <p className="text-[10px] text-app-muted-foreground uppercase font-black">Recurring</p>
                <p className="text-lg font-black text-app-warning">{totalRecurring}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <Card className="border-app-border bg-app-surface/40">
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-app-border bg-app-bg p-0.5">
            {TYPE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilterType(t.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                  filterType === t.key
                    ? 'bg-app-primary text-white shadow'
                    : 'text-app-muted-foreground hover:bg-app-surface'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-app-border bg-app-bg p-0.5">
            {ACTIVE_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilterActive(t.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                  filterActive === t.key
                    ? 'bg-app-primary text-white shadow'
                    : 'text-app-muted-foreground hover:bg-app-surface'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search rules…"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Module Groups ─────────────────────────────────────────── */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-app-muted-foreground">Loading rules…</CardContent>
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Zap size={40} className="text-app-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-app-muted-foreground font-medium">
              No auto-task rules match these filters.
            </p>
            <p className="text-xs text-app-muted-foreground mt-1">
              Create rules to automate task creation across your modules.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => {
            const Icon = MODULE_ICONS[group.module] ?? Settings2;
            const accent = MODULE_ACCENT[group.module] ?? 'text-app-muted-foreground';
            const isExpanded = expandedModules.has(group.module);

            return (
              <Card key={group.module} className="overflow-hidden">
                <button
                  onClick={() => toggleModule(group.module)}
                  className="w-full flex items-center justify-between p-4 hover:bg-app-surface/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-app-surface-2 flex items-center justify-center">
                      <Icon size={18} className={accent} />
                    </div>
                    <div className="text-left">
                      <div className="font-black text-app-foreground text-sm">{group.module_display}</div>
                      <div className="text-xs text-app-muted-foreground font-medium">
                        {group.total} rule{group.total !== 1 ? 's' : ''} · {group.active} active
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {group.event_count > 0 && (
                      <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-app-primary/10 text-app-primary border border-app-primary/30">
                        {group.event_count} event
                      </span>
                    )}
                    {group.recurring_count > 0 && (
                      <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-app-warning/10 text-app-warning border border-app-warning/30">
                        {group.recurring_count} recurring
                      </span>
                    )}
                    {isExpanded
                      ? <ChevronDown size={16} className="text-app-muted-foreground" />
                      : <ChevronRight size={16} className="text-app-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-app-border divide-y divide-app-border">
                    {group.rules.map((rule: any) => (
                      <div
                        key={rule.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 transition-all hover:bg-app-surface/40',
                          !rule.is_active && 'opacity-50'
                        )}
                      >
                        <button
                          onClick={() => toggleRule(rule.id, rule.is_active)}
                          className="shrink-0"
                          title={rule.is_active ? 'Click to disable' : 'Click to enable'}
                        >
                          {rule.is_active
                            ? <ToggleRight size={22} className="text-app-success" />
                            : <ToggleLeft size={22} className="text-app-muted-foreground" />}
                        </button>

                        {rule.code && (
                          <span className="shrink-0 text-[10px] font-black text-app-muted-foreground bg-app-surface-2 px-2 py-0.5 rounded font-mono w-16 text-center">
                            {rule.code}
                          </span>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-app-foreground truncate">{rule.name}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-app-muted-foreground">{rule.trigger_display}</span>
                            {rule.chain_parent_name && (
                              <span className="text-[10px] text-app-primary flex items-center gap-0.5">
                                <Link2 size={10} /> after: {rule.chain_parent_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={cn(
                            'shrink-0 inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full border',
                            rule.rule_type === 'EVENT'
                              ? 'bg-app-primary/10 text-app-primary border-app-primary/30'
                              : 'bg-app-warning/10 text-app-warning border-app-warning/30'
                          )}
                        >
                          {rule.rule_type === 'EVENT' ? 'Event' : (INTERVAL_LABELS[rule.recurrence_interval] ?? 'Recurring')}
                        </span>

                        {(rule.priority || rule.template?.default_priority) && (
                          <span
                            className={cn(
                              'shrink-0 inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full border',
                              PRIORITY_BADGE[rule.priority || rule.template?.default_priority] ??
                                'bg-app-surface-2 text-app-muted-foreground border-app-border'
                            )}
                          >
                            {rule.priority || rule.template?.default_priority}
                          </span>
                        )}

                        <span className="shrink-0 text-xs text-app-muted-foreground max-w-[140px] truncate">
                          {rule.assign_to_user_name || rule.template_name || '—'}
                        </span>

                        {rule.is_system_default && (
                          <span className="shrink-0 text-[10px] font-black text-app-muted-foreground bg-app-surface-2 px-1.5 py-0.5 rounded uppercase border border-app-border">
                            Default
                          </span>
                        )}

                        <Button asChild size="sm" variant="ghost">
                          <a href="/workspace/auto-task-rules">
                            <Edit3 size={14} />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 text-xs text-app-muted-foreground pt-2">
        <span className="flex items-center gap-1">
          <Zap size={12} className="text-app-primary" /> Event: fires on system events
        </span>
        <span className="flex items-center gap-1">
          <Repeat size={12} className="text-app-warning" /> Recurring: fires on schedule
        </span>
        <span className="flex items-center gap-1">
          <Link2 size={12} className="text-app-primary" /> Chain: fires after parent task completes
        </span>
      </div>
    </div>
  );
}
