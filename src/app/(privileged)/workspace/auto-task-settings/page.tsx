'use client';

import { useState, useEffect, useMemo } from 'react';
import { erpFetch } from '@/lib/erp-api';
import { toast } from 'sonner';
import clsx from 'clsx';
import {
 Zap, Package, ShoppingCart, DollarSign, Users, Briefcase, UserCheck,
 Settings2, ChevronDown, ChevronRight, Filter, Check, X, Edit3,
 ToggleLeft, ToggleRight, Clock, CalendarDays, Link2, Search,
 AlertTriangle, Repeat, Plus
} from 'lucide-react';

// ── Module Config ─────────────────────────────────────────────────────────────
const MODULE_CONFIG: Record<string, { icon: typeof Package; color: string; bg: string; border: string }> = {
 inventory: { icon: Package, color: 'text-app-primary', bg: 'bg-app-primary-light', border: 'border-app-success' },
 purchasing: { icon: ShoppingCart, color: 'text-app-info', bg: 'bg-app-info-bg', border: 'border-app-info' },
 finance: { icon: DollarSign, color: 'text-app-warning', bg: 'bg-app-warning-bg', border: 'border-app-warning' },
 crm: { icon: Users, color: 'text-app-primary', bg: 'bg-violet-50', border: 'border-violet-200' },
 sales: { icon: Briefcase, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
 hr: { icon: UserCheck, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
 system: { icon: Settings2, color: 'text-app-muted-foreground', bg: 'bg-app-background', border: 'border-app-border' },
};

interface RuleGroup {
 module: string;
 module_display: string;
 total: number;
 active: number;
 event_count: number;
 recurring_count: number;
 rules: any[];
}

const RULE_TYPE_LABELS: Record<string, { label: string; icon: typeof Zap; color: string }> = {
 EVENT: { label: 'Event', icon: Zap, color: 'text-app-primary' },
 RECURRING: { label: 'Recurring', icon: Repeat, color: 'text-app-warning' },
};

const INTERVAL_LABELS: Record<string, string> = {
 DAILY: '⏰ Daily',
 WEEKLY: '📅 Weekly',
 MONTHLY: '🗓 Monthly',
 QUARTERLY: '📊 Quarterly',
};

const PRIORITY_BADGES: Record<string, { label: string; cls: string }> = {
 URGENT: { label: 'Urgent', cls: 'bg-app-error-bg text-app-error border-app-error' },
 HIGH: { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
 MEDIUM: { label: 'Medium', cls: 'bg-app-info-bg text-app-info border-app-info' },
 LOW: { label: 'Low', cls: 'bg-app-surface-2 text-app-muted-foreground border-app-border' },
};

export default function AutoTaskSettingsPage() {
 const [groups, setGroups] = useState<RuleGroup[]>([]);
 const [loading, setLoading] = useState(true);
 const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
 const [filterType, setFilterType] = useState<'ALL' | 'EVENT' | 'RECURRING'>('ALL');
 const [filterActive, setFilterActive] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
 const [search, setSearch] = useState('');

 const load = async () => {
 setLoading(true);
 try {
 const data = await erpFetch('auto-task-rules/grouped/');
 setGroups(Array.isArray(data) ? data : []);
 // Expand all modules by default
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
 next.has(mod) ? next.delete(mod) : next.add(mod);
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

 // ── Filtered data ────────────────────────────────────────────────────────
 const filteredGroups = useMemo(() => {
 return groups.map(group => {
 let rules = group.rules;
 if (filterType !== 'ALL') {
 rules = rules.filter(r => r.rule_type === filterType);
 }
 if (filterActive === 'ACTIVE') {
 rules = rules.filter(r => r.is_active);
 } else if (filterActive === 'INACTIVE') {
 rules = rules.filter(r => !r.is_active);
 }
 if (search.trim()) {
 const q = search.toLowerCase();
 rules = rules.filter(r =>
 r.name?.toLowerCase().includes(q) ||
 r.trigger_display?.toLowerCase().includes(q) ||
 r.code?.toLowerCase().includes(q)
 );
 }
 return { ...group, rules, total: rules.length, active: rules.filter((r: any) => r.is_active).length };
 }).filter(g => g.rules.length > 0);
 }, [groups, filterType, filterActive, search]);

 // ── Stats ─────────────────────────────────────────────────────────────────
 const totalRules = groups.reduce((sum, g) => sum + g.total, 0);
 const totalActive = groups.reduce((sum, g) => sum + g.active, 0);
 const totalEvent = groups.reduce((sum, g) => sum + g.event_count, 0);
 const totalRecurring = groups.reduce((sum, g) => sum + g.recurring_count, 0);

 return (
 <div className="app-page p-4 max-w-7xl mx-auto space-y-4">
 {/* ── Header ──────────────────────────────────────────────────────── */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-xl font-black text-app-foreground flex items-center gap-2">
 <Zap size={20} className="text-app-warning" /> Auto-Task Settings
 </h1>
 <p className="text-xs text-app-muted-foreground mt-0.5">
 Configure automatic task creation for every module and business process
 </p>
 </div>
 <a
 href="/workspace/auto-task-rules"
 className="flex items-center gap-2 px-4 py-2 bg-app-primary text-app-foreground rounded-xl text-sm font-bold hover:bg-app-primary transition-all shadow-md shadow-indigo-200"
 >
 <Plus size={14} /> Create Rule
 </a>
 </div>

 {/* ── Stats Bar ───────────────────────────────────────────────────── */}
 <div className="grid grid-cols-4 gap-3">
 {[
 { label: 'Total Rules', value: totalRules, color: 'text-app-foreground', bg: 'bg-app-surface' },
 { label: 'Active', value: totalActive, color: 'text-app-primary', bg: 'bg-app-primary-light' },
 { label: 'Event-Based', value: totalEvent, color: 'text-app-primary', bg: 'bg-app-primary/5' },
 { label: 'Recurring', value: totalRecurring, color: 'text-app-warning', bg: 'bg-app-warning-bg' },
 ].map(stat => (
 <div key={stat.label} className={clsx('rounded-xl p-3 border border-app-border shadow-sm', stat.bg)}>
 <div className={clsx('text-2xl font-black', stat.color)}>{stat.value}</div>
 <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">{stat.label}</div>
 </div>
 ))}
 </div>

 {/* ── Filters ─────────────────────────────────────────────────────── */}
 <div className="flex items-center gap-3 flex-wrap">
 <div className="flex items-center gap-1 bg-app-surface rounded-xl border border-app-border p-0.5">
 {(['ALL', 'EVENT', 'RECURRING'] as const).map(t => (
 <button
 key={t}
 onClick={() => setFilterType(t)}
 className={clsx(
 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
 filterType === t ? 'bg-app-primary text-app-foreground shadow' : 'text-app-muted-foreground hover:bg-app-background'
 )}
 >
 {t === 'ALL' ? 'All Types' : t === 'EVENT' ? '⚡ Event' : '🔄 Recurring'}
 </button>
 ))}
 </div>

 <div className="flex items-center gap-1 bg-app-surface rounded-xl border border-app-border p-0.5">
 {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(t => (
 <button
 key={t}
 onClick={() => setFilterActive(t)}
 className={clsx(
 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
 filterActive === t ? 'bg-app-primary text-app-foreground shadow' : 'text-app-muted-foreground hover:bg-app-background'
 )}
 >
 {t === 'ALL' ? 'All' : t === 'ACTIVE' ? '✅ Active' : '⬜ Inactive'}
 </button>
 ))}
 </div>

 <div className="relative flex-1 min-w-[200px]">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <input
 value={search}
 onChange={e => setSearch(e.target.value)}
 placeholder="Search rules..."
 className="w-full pl-9 pr-3 py-2 text-sm border border-app-border rounded-xl outline-none focus:ring-2 focus:ring-app-primary"
 />
 </div>
 </div>

 {/* ── Module Groups ────────────────────────────────────────────────── */}
 {loading ? (
 <div className="p-12 text-center text-app-muted-foreground">Loading rules...</div>
 ) : filteredGroups.length === 0 ? (
 <div className="p-12 text-center">
 <Zap size={40} className="text-app-foreground mx-auto mb-3" />
 <p className="text-app-muted-foreground font-medium">No auto-task rules configured yet.</p>
 <p className="text-app-muted-foreground text-sm">Create rules to automate task creation across your modules.</p>
 </div>
 ) : (
 <div className="space-y-3">
 {filteredGroups.map(group => {
 const config = MODULE_CONFIG[group.module] || MODULE_CONFIG.system;
 const Icon = config.icon;
 const isExpanded = expandedModules.has(group.module);

 return (
 <div key={group.module} className={clsx('rounded-2xl border shadow-sm overflow-hidden', config.border)}>
 {/* Module Header */}
 <button
 onClick={() => toggleModule(group.module)}
 className={clsx(
 'w-full flex items-center justify-between p-4 transition-colors',
 config.bg, 'hover:brightness-95'
 )}
 >
 <div className="flex items-center gap-3">
 <div className={clsx('p-2 rounded-xl bg-app-foreground/80 shadow-sm', config.color)}>
 <Icon size={18} />
 </div>
 <div className="text-left">
 <div className="font-black text-app-foreground text-sm">{group.module_display}</div>
 <div className="text-[10px] text-app-muted-foreground font-medium">
 {group.total} rule{group.total !== 1 ? 's' : ''} · {group.active} active
 </div>
 </div>
 </div>
 <div className="flex items-center gap-3">
 {group.event_count > 0 && (
 <span className="text-[10px] font-bold text-app-primary bg-app-foreground/80 px-2 py-0.5 rounded-full">
 ⚡ {group.event_count} event
 </span>
 )}
 {group.recurring_count > 0 && (
 <span className="text-[10px] font-bold text-app-warning bg-app-foreground/80 px-2 py-0.5 rounded-full">
 🔄 {group.recurring_count} recurring
 </span>
 )}
 {isExpanded ? <ChevronDown size={16} className="text-app-muted-foreground" /> : <ChevronRight size={16} className="text-app-muted-foreground" />}
 </div>
 </button>

 {/* Rules List */}
 {isExpanded && (
 <div className="bg-app-surface divide-y divide-gray-50">
 {group.rules.map((rule: any) => (
 <div
 key={rule.id}
 className={clsx(
 'flex items-center gap-3 px-4 py-3 transition-all hover:bg-app-background',
 !rule.is_active && 'opacity-40'
 )}
 >
 {/* Toggle */}
 <button
 onClick={() => toggleRule(rule.id, rule.is_active)}
 className="shrink-0"
 title={rule.is_active ? 'Click to disable' : 'Click to enable'}
 >
 {rule.is_active ? (
 <ToggleRight size={22} className="text-app-primary" />
 ) : (
 <ToggleLeft size={22} className="text-app-muted-foreground" />
 )}
 </button>

 {/* Code */}
 {rule.code && (
 <span className="shrink-0 text-[10px] font-black text-app-muted-foreground bg-app-surface-2 px-2 py-0.5 rounded font-mono w-14 text-center">
 {rule.code}
 </span>
 )}

 {/* Name + Trigger */}
 <div className="flex-1 min-w-0">
 <div className="text-sm font-semibold text-app-foreground truncate">{rule.name}</div>
 <div className="flex items-center gap-2 mt-0.5">
 <span className="text-[10px] text-app-muted-foreground">{rule.trigger_display}</span>
 {rule.chain_parent_name && (
 <span className="text-[10px] text-purple-500 flex items-center gap-0.5">
 <Link2 size={8} /> after: {rule.chain_parent_name}
 </span>
 )}
 </div>
 </div>

 {/* Type Badge */}
 <span className={clsx(
 'shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border',
 rule.rule_type === 'EVENT'
 ? 'bg-app-primary/5 text-app-primary border-app-primary/30'
 : 'bg-app-warning-bg text-app-warning border-app-warning/30'
 )}>
 {rule.rule_type === 'EVENT' ? '⚡ Event' : `🔄 ${INTERVAL_LABELS[rule.recurrence_interval] || 'Recurring'}`}
 </span>

 {/* Priority */}
 {(rule.priority || rule.template?.default_priority) && (
 <span className={clsx(
 'shrink-0 text-[9px] font-bold border px-2 py-0.5 rounded-full',
 PRIORITY_BADGES[rule.priority || rule.template?.default_priority]?.cls || 'bg-app-background text-app-muted-foreground'
 )}>
 {PRIORITY_BADGES[rule.priority || rule.template?.default_priority]?.label || 'Medium'}
 </span>
 )}

 {/* Assignee */}
 <span className="shrink-0 text-[10px] text-app-muted-foreground max-w-[120px] truncate">
 {rule.assign_to_user_name || rule.template_name || '—'}
 </span>

 {/* System Default Badge */}
 {rule.is_system_default && (
 <span className="shrink-0 text-[8px] font-black text-app-muted-foreground bg-app-surface-2 px-1.5 py-0.5 rounded uppercase">
 Default
 </span>
 )}

 {/* Edit */}
 <a
 href="/workspace/auto-task-rules"
 className="shrink-0 p-1.5 rounded-lg bg-app-primary/5 text-app-primary hover:bg-app-primary/10 transition-all"
 >
 <Edit3 size={12} />
 </a>
 </div>
 ))}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}

 {/* ── Legend ───────────────────────────────────────────────────────── */}
 <div className="flex items-center gap-6 text-[10px] text-app-muted-foreground pt-2 border-t border-app-border">
 <span className="flex items-center gap-1"><Zap size={10} className="text-app-primary" /> Event: fires on system events</span>
 <span className="flex items-center gap-1"><Repeat size={10} className="text-app-warning" /> Recurring: fires on schedule</span>
 <span className="flex items-center gap-1"><Link2 size={10} className="text-purple-500" /> Chain: fires after parent task completes</span>
 </div>
 </div>
 );
}
