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
    inventory: { icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    purchasing: { icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    finance: { icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    crm: { icon: Users, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
    sales: { icon: Briefcase, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    hr: { icon: UserCheck, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    system: { icon: Settings2, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' },
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
    EVENT: { label: 'Event', icon: Zap, color: 'text-indigo-500' },
    RECURRING: { label: 'Recurring', icon: Repeat, color: 'text-amber-500' },
};

const INTERVAL_LABELS: Record<string, string> = {
    DAILY: '⏰ Daily',
    WEEKLY: '📅 Weekly',
    MONTHLY: '🗓 Monthly',
    QUARTERLY: '📊 Quarterly',
};

const PRIORITY_BADGES: Record<string, { label: string; cls: string }> = {
    URGENT: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
    HIGH: { label: 'High', cls: 'bg-orange-100 text-orange-700 border-orange-200' },
    MEDIUM: { label: 'Medium', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    LOW: { label: 'Low', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
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
        <div className="p-4 max-w-7xl mx-auto space-y-4">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
                        <Zap size={20} className="text-amber-500" /> Auto-Task Settings
                    </h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Configure automatic task creation for every module and business process
                    </p>
                </div>
                <a
                    href="/workspace/auto-task-rules"
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
                >
                    <Plus size={14} /> Create Rule
                </a>
            </div>

            {/* ── Stats Bar ───────────────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Total Rules', value: totalRules, color: 'text-gray-900', bg: 'bg-white' },
                    { label: 'Active', value: totalActive, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Event-Based', value: totalEvent, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Recurring', value: totalRecurring, color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map(stat => (
                    <div key={stat.label} className={clsx('rounded-xl p-3 border border-gray-100 shadow-sm', stat.bg)}>
                        <div className={clsx('text-2xl font-black', stat.color)}>{stat.value}</div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Filters ─────────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-0.5">
                    {(['ALL', 'EVENT', 'RECURRING'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setFilterType(t)}
                            className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                filterType === t ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'
                            )}
                        >
                            {t === 'ALL' ? 'All Types' : t === 'EVENT' ? '⚡ Event' : '🔄 Recurring'}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 p-0.5">
                    {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setFilterActive(t)}
                            className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                                filterActive === t ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'
                            )}
                        >
                            {t === 'ALL' ? 'All' : t === 'ACTIVE' ? '✅ Active' : '⬜ Inactive'}
                        </button>
                    ))}
                </div>

                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search rules..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* ── Module Groups ────────────────────────────────────────────────── */}
            {loading ? (
                <div className="p-12 text-center text-gray-400">Loading rules...</div>
            ) : filteredGroups.length === 0 ? (
                <div className="p-12 text-center">
                    <Zap size={40} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No auto-task rules configured yet.</p>
                    <p className="text-gray-400 text-sm">Create rules to automate task creation across your modules.</p>
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
                                        <div className={clsx('p-2 rounded-xl bg-white/80 shadow-sm', config.color)}>
                                            <Icon size={18} />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-gray-900 text-sm">{group.module_display}</div>
                                            <div className="text-[10px] text-gray-500 font-medium">
                                                {group.total} rule{group.total !== 1 ? 's' : ''} · {group.active} active
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {group.event_count > 0 && (
                                            <span className="text-[10px] font-bold text-indigo-600 bg-white/80 px-2 py-0.5 rounded-full">
                                                ⚡ {group.event_count} event
                                            </span>
                                        )}
                                        {group.recurring_count > 0 && (
                                            <span className="text-[10px] font-bold text-amber-600 bg-white/80 px-2 py-0.5 rounded-full">
                                                🔄 {group.recurring_count} recurring
                                            </span>
                                        )}
                                        {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                                    </div>
                                </button>

                                {/* Rules List */}
                                {isExpanded && (
                                    <div className="bg-white divide-y divide-gray-50">
                                        {group.rules.map((rule: any) => (
                                            <div
                                                key={rule.id}
                                                className={clsx(
                                                    'flex items-center gap-3 px-4 py-3 transition-all hover:bg-gray-50',
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
                                                        <ToggleRight size={22} className="text-emerald-500" />
                                                    ) : (
                                                        <ToggleLeft size={22} className="text-gray-300" />
                                                    )}
                                                </button>

                                                {/* Code */}
                                                {rule.code && (
                                                    <span className="shrink-0 text-[10px] font-black text-gray-400 bg-gray-100 px-2 py-0.5 rounded font-mono w-14 text-center">
                                                        {rule.code}
                                                    </span>
                                                )}

                                                {/* Name + Trigger */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-gray-900 truncate">{rule.name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] text-gray-400">{rule.trigger_display}</span>
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
                                                        ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                        : 'bg-amber-50 text-amber-600 border-amber-100'
                                                )}>
                                                    {rule.rule_type === 'EVENT' ? '⚡ Event' : `🔄 ${INTERVAL_LABELS[rule.recurrence_interval] || 'Recurring'}`}
                                                </span>

                                                {/* Priority */}
                                                {(rule.priority || rule.template?.default_priority) && (
                                                    <span className={clsx(
                                                        'shrink-0 text-[9px] font-bold border px-2 py-0.5 rounded-full',
                                                        PRIORITY_BADGES[rule.priority || rule.template?.default_priority]?.cls || 'bg-gray-50 text-gray-500'
                                                    )}>
                                                        {PRIORITY_BADGES[rule.priority || rule.template?.default_priority]?.label || 'Medium'}
                                                    </span>
                                                )}

                                                {/* Assignee */}
                                                <span className="shrink-0 text-[10px] text-gray-400 max-w-[120px] truncate">
                                                    {rule.assign_to_user_name || rule.template_name || '—'}
                                                </span>

                                                {/* System Default Badge */}
                                                {rule.is_system_default && (
                                                    <span className="shrink-0 text-[8px] font-black text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                                                        Default
                                                    </span>
                                                )}

                                                {/* Edit */}
                                                <a
                                                    href="/workspace/auto-task-rules"
                                                    className="shrink-0 p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all"
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
            <div className="flex items-center gap-6 text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                <span className="flex items-center gap-1"><Zap size={10} className="text-indigo-500" /> Event: fires on system events</span>
                <span className="flex items-center gap-1"><Repeat size={10} className="text-amber-500" /> Recurring: fires on schedule</span>
                <span className="flex items-center gap-1"><Link2 size={10} className="text-purple-500" /> Chain: fires after parent task completes</span>
            </div>
        </div>
    );
}
