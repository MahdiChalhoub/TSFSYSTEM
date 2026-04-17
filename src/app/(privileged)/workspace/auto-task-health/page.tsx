'use client';

import { useState, useEffect, useMemo } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import { cn } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Zap, Repeat,
  RefreshCw, Search, Package, ShoppingCart, DollarSign, Users,
  Briefcase, UserCheck, Settings2,
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
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.rules;
    if (filter === 'STALE') rows = rows.filter(r => r.is_stale);
    else if (filter === 'ACTIVE') rows = rows.filter(r => r.is_active);
    else if (filter === 'INACTIVE') rows = rows.filter(r => !r.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.trigger_event?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, filter, search]);

  const FILTER_TABS: { key: FilterKey; label: string }[] = [
    { key: 'ALL', label: 'All' },
    { key: 'STALE', label: 'Stale' },
    { key: 'ACTIVE', label: 'Active' },
    { key: 'INACTIVE', label: 'Inactive' },
  ];

  return (
    <div className="p-6 space-y-6 bg-app-bg min-h-full">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-app-foreground flex items-center gap-3 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-app-primary flex items-center justify-center shadow-lg shadow-app-primary/20">
              <Activity size={20} className="text-white" />
            </div>
            Auto-Task Health
          </h1>
          <p className="text-sm text-app-muted-foreground mt-1">
            Monitor which rules are firing, which are idle, and which need attention.
          </p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm">
          <RefreshCw size={14} className={cn('mr-2', loading && 'animate-spin')} />
          Refresh
        </Button>
      </header>

      {/* ── Primary KPI Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-app-primary text-white border-0 shadow-lg shadow-app-primary/10">
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <Zap size={28} className="opacity-80" />
              <div>
                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Total Rules</p>
                <p className="text-2xl font-black">{data?.total_rules ?? 0}</p>
                <p className="text-xs font-medium opacity-60">Event + recurring</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-app-success text-white border-0 shadow-lg shadow-app-success/10">
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={28} className="opacity-80" />
              <div>
                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Active</p>
                <p className="text-2xl font-black">{data?.active_rules ?? 0}</p>
                <p className="text-xs font-medium opacity-60">Eligible to fire</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            'border-0 shadow-lg text-white',
            (data?.stale_rules ?? 0) > 0
              ? 'bg-app-error shadow-app-error/10'
              : 'bg-app-surface-2 text-app-foreground shadow-none border border-app-border'
          )}
        >
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <AlertTriangle size={28} className={cn((data?.stale_rules ?? 0) > 0 ? 'opacity-80' : 'text-app-muted-foreground')} />
              <div>
                <p className={cn('text-xs uppercase font-black tracking-widest', (data?.stale_rules ?? 0) > 0 ? 'opacity-80' : 'text-app-muted-foreground')}>Stale</p>
                <p className="text-2xl font-black">{data?.stale_rules ?? 0}</p>
                <p className={cn('text-xs font-medium', (data?.stale_rules ?? 0) > 0 ? 'opacity-60' : 'text-app-muted-foreground')}>
                  Need attention
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-app-info text-white border-0 shadow-lg shadow-app-info/10">
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <Repeat size={28} className="opacity-80" />
              <div>
                <p className="text-xs uppercase font-black opacity-80 tracking-widest">Fired (7d)</p>
                <p className="text-2xl font-black">{data?.fired_last_7d ?? 0}</p>
                <p className="text-xs font-medium opacity-60">Tasks generated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────── */}
      <Card className="border-app-border bg-app-surface/40">
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-app-border bg-app-bg p-0.5">
            {FILTER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-bold transition-all',
                  filter === t.key
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
              placeholder="Search by name, code, trigger…"
              className="pl-9"
            />
          </div>
          {data && (
            <div className="text-xs text-app-muted-foreground">
              Generated {formatRelative(data.generated_at)} · {filtered.length} shown
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Rules Table ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="p-12 text-center text-app-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Activity size={40} className="text-app-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-app-muted-foreground font-medium">
                No rules match these filters.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-36">Last fired</TableHead>
                  <TableHead className="w-16 text-right">7d</TableHead>
                  <TableHead className="w-16 text-right">30d</TableHead>
                  <TableHead className="w-24 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(rule => {
                  const ModIcon = MODULE_ICONS[rule.module ?? 'system'] ?? Settings2;
                  return (
                    <TableRow
                      key={rule.id}
                      className={cn(
                        !rule.is_active && 'opacity-50',
                        rule.is_stale && 'bg-app-error/5'
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ModIcon size={14} className="text-app-muted-foreground shrink-0" />
                          {rule.code && (
                            <span className="text-[10px] font-black text-app-muted-foreground bg-app-surface-2 px-1.5 py-0.5 rounded font-mono">
                              {rule.code}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-app-foreground truncate">{rule.name}</div>
                            <div className="text-[10px] text-app-muted-foreground">{rule.trigger_event}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full border',
                            rule.rule_type === 'EVENT'
                              ? 'bg-app-primary/10 text-app-primary border-app-primary/30'
                              : 'bg-app-warning/10 text-app-warning border-app-warning/30'
                          )}
                        >
                          {rule.rule_type === 'EVENT' ? 'Event' : rule.recurrence_interval ?? 'Recurring'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-app-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock size={10} /> {formatRelative(rule.last_fired_at)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold">{rule.tasks_fired_last_7d}</TableCell>
                      <TableCell className="text-right font-bold">{rule.tasks_fired_last_30d}</TableCell>
                      <TableCell className="text-center">
                        {rule.is_stale ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-app-error/10 text-app-error border border-app-error/30">
                            <AlertTriangle size={10} /> Stale
                          </span>
                        ) : rule.is_active ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-app-success/10 text-app-success border border-app-success/30">
                            <CheckCircle2 size={10} /> OK
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-app-surface-2 text-app-muted-foreground border border-app-border">
                            Off
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Legend ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 text-xs text-app-muted-foreground pt-2">
        <span className="flex items-center gap-1">
          <AlertTriangle size={12} className="text-app-error" />
          Stale = active recurring rule that hasn't fired in 2× its interval
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle2 size={12} className="text-app-success" />
          OK = active and firing normally
        </span>
      </div>
    </div>
  );
}
