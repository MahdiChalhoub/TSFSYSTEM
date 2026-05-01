'use client';
import { useState, useMemo, useTransition } from 'react';
import { Plus, Minus, Search, Filter, ShieldAlert, CheckCircle2, Info, RefreshCw, Camera } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { bulkRecalculateWise, snapshotWisePeriod } from '@/app/actions/workforce';

interface Rule {
    id: number;
    code: string;
    name: string;
    module: string;
    dimension: string;
    direction: string;
    base_points: string;
    event_code: string;
    score_family: string;
    is_active: boolean;
    is_critical_rule: boolean;
    can_be_manual: boolean;
    daily_cap: number | null;
    monthly_cap: number | null;
    requires_review: boolean;
    default_severity: string;
}

interface Props {
    rules: Rule[];
    modules: string[];
}

const MODULE_COLORS: Record<string, string> = {
    crm: 'bg-app-info/10 text-app-info border-app-info/20',
    finance: 'bg-app-primary/10 text-app-success border-app-success/20',
    hr: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    sales: 'bg-app-warning/10 text-app-warning border-app-warning/20',
    inventory: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    workspace: 'bg-indigo-500/10 text-app-info border-app-info/20',
    manual: 'bg-app-error/10 text-app-error border-app-error/20',
};

const SEV_COLORS: Record<string, string> = {
    CRITICAL: 'text-app-error',
    MAJOR: 'text-app-warning',
    MEDIUM: 'text-app-warning',
    MINOR: 'text-white/30',
};

export default function WiseRulesClient({ rules, modules }: Props) {
    const [moduleFilter, setModuleFilter] = useState('');
    const [dirFilter, setDirFilter] = useState('');
    const [search, setSearch] = useState('');
    const [showCapped, setShowCapped] = useState(false);
    const [isPending, startTransition] = useTransition();

    function handleRecalculate() {
        startTransition(async () => {
            const res = await bulkRecalculateWise();
            if (res?.success) {
                toast.success(`Recalculated ${res.total} employees — ${res.errors} errors`);
            } else {
                toast.error(res?.error || 'Recalculation failed');
            }
        });
    }

    function handleSnapshot() {
        startTransition(async () => {
            const res = await snapshotWisePeriod('MONTHLY');
            if (res?.success) {
                toast.success(`Snapshot saved for period ${res.period_key} — ${res.created} new, ${res.updated} updated`);
            } else {
                toast.error(res?.error || 'Snapshot failed');
            }
        });
    }

    const filtered = useMemo(() => {
        return rules.filter(r => {
            if (moduleFilter && r.module !== moduleFilter) return false;
            if (dirFilter && r.direction !== dirFilter) return false;
            if (showCapped && !r.daily_cap && !r.monthly_cap) return false;
            if (search) {
                const q = search.toLowerCase();
                return r.name.toLowerCase().includes(q) || r.event_code.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
            }
            return true;
        });
    }, [rules, moduleFilter, dirFilter, search, showCapped]);

    // Group by module for display
    const grouped = useMemo(() => {
        const g: Record<string, Rule[]> = {};
        for (const r of filtered) {
            if (!g[r.module]) g[r.module] = [];
            g[r.module].push(r);
        }
        return g;
    }, [filtered]);

    return (
        <div className="space-y-6">
            {/* Search + Filters */}
            <div className="bg-app-surface border border-app-border rounded-[2rem] p-5 flex flex-wrap gap-4 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-40" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search rules, event codes…"
                        className="w-full bg-app-surface/5 border border-app-border rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-app-primary/50"
                    />
                </div>

                {/* Module pills */}
                <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setModuleFilter('')}
                        className={clsx("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                            !moduleFilter ? "bg-app-primary text-white border-app-primary" : "bg-app-surface/5 text-white/40 border-app-border hover:text-white"
                        )}>All</button>
                    {modules.map(mod => (
                        <button key={mod} onClick={() => setModuleFilter(mod === moduleFilter ? '' : mod)}
                            className={clsx("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                moduleFilter === mod ? "bg-app-primary text-white border-app-primary" :
                                    `${MODULE_COLORS[mod] || 'bg-app-surface/5 text-white/40 border-app-border'} hover:opacity-100`
                            )}>{mod}</button>
                    ))}
                </div>

                {/* Dir + Cap toggles */}
                <div className="flex gap-2 flex-wrap">
                    {['POSITIVE', 'NEGATIVE'].map(dir => (
                        <button key={dir} onClick={() => setDirFilter(p => p === dir ? '' : dir)}
                            className={clsx("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                dirFilter === dir
                                    ? dir === 'POSITIVE' ? "bg-app-primary text-white border-app-success" : "bg-app-error text-white border-app-error"
                                    : "bg-app-surface/5 text-white/40 border-app-border hover:text-white"
                            )}>
                            {dir === 'POSITIVE' ? '+' : '−'} {dir}
                        </button>
                    ))}
                    <button onClick={() => setShowCapped(p => !p)}
                        className={clsx("px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                            showCapped ? "bg-app-warning text-white border-app-warning" : "bg-app-surface/5 text-white/40 border-app-border hover:text-white"
                        )}>Capped only</button>
                </div>

                {/* Admin actions */}
                <div className="ml-auto flex gap-2">
                    <button
                        onClick={handleSnapshot}
                        disabled={isPending}
                        title="Save a period snapshot of all current scores"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-app-border bg-app-surface/5 text-white/40 hover:text-app-info hover:border-app-info/30 hover:bg-app-info/5 transition-all disabled:opacity-40"
                    >
                        <Camera size={11} /> Snapshot
                    </button>
                    <button
                        onClick={handleRecalculate}
                        disabled={isPending}
                        title="Re-score all employees using the current rule set"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-violet-500/30 bg-violet-500/5 text-violet-400 hover:bg-violet-500/10 transition-all disabled:opacity-40"
                    >
                        <RefreshCw size={11} className={isPending ? 'animate-spin' : ''} />
                        {isPending ? 'Running…' : 'Recalculate All'}
                    </button>
                </div>
            </div>

            {/* Rule Groups */}
            {Object.entries(grouped).map(([module, moduleRules]) => (
                <div key={module} className="bg-app-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-xl">
                    {/* Group Header */}
                    <div className={clsx("px-8 py-4 flex items-center justify-between border-b border-app-border",
                        MODULE_COLORS[module]?.split(' ')[0] || 'bg-app-surface/5'
                    )}>
                        <span className={clsx("font-black uppercase tracking-widest text-sm", MODULE_COLORS[module]?.split(' ')[1])}>
                            {module.toUpperCase()} MODULE
                        </span>
                        <span className="text-[10px] font-bold opacity-60">{moduleRules.length} rules</span>
                    </div>

                    <div className="divide-y divide-app-border">
                        {moduleRules.map(rule => (
                            <div key={rule.id} className={clsx(
                                "px-8 py-5 flex items-center gap-6 hover:bg-app-surface/[0.02] transition-colors",
                                !rule.is_active && "opacity-40"
                            )}>
                                {/* Direction */}
                                <div className={clsx(
                                    "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shrink-0",
                                    rule.direction === 'POSITIVE' ? "bg-app-primary/10 text-app-success" : "bg-app-error/10 text-app-error"
                                )}>
                                    {rule.direction === 'POSITIVE' ? '+' : '−'}
                                </div>

                                {/* Details */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-bold">{rule.name}</span>
                                        {rule.is_critical_rule && (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-app-error/10 text-app-error border border-app-error/20">Critical</span>
                                        )}
                                        {rule.can_be_manual && (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-app-warning/10 text-app-warning border border-app-warning/20">Manual</span>
                                        )}
                                        {rule.requires_review && (
                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-app-info/10 text-app-info border border-app-info/20">Review Required</span>
                                        )}
                                    </div>
                                    <div className="flex gap-3 mt-1 text-[10px] opacity-40 flex-wrap">
                                        <code className="font-mono">{rule.event_code}</code>
                                        <span>·</span>
                                        <span>{rule.dimension?.replace(/_/g, ' ')}</span>
                                        <span>·</span>
                                        <span>{rule.score_family}</span>
                                        {rule.default_severity && rule.default_severity !== 'MEDIUM' && (
                                            <><span>·</span><span className={SEV_COLORS[rule.default_severity]}>{rule.default_severity}</span></>
                                        )}
                                    </div>
                                </div>

                                {/* Caps */}
                                {(rule.daily_cap || rule.monthly_cap) && (
                                    <div className="text-right text-[10px] opacity-50 shrink-0">
                                        {rule.daily_cap && <div>Cap: {rule.daily_cap}/day</div>}
                                        {rule.monthly_cap && <div>Cap: {rule.monthly_cap}/mo</div>}
                                    </div>
                                )}

                                {/* Points */}
                                <div className={clsx(
                                    "font-black text-xl tabular-nums w-24 text-right shrink-0",
                                    rule.direction === 'POSITIVE' ? "text-app-success" : "text-app-error"
                                )}>
                                    {rule.direction === 'POSITIVE' ? '+' : '−'}{rule.base_points}
                                    <div className="text-[9px] opacity-40 font-normal">base pts</div>
                                </div>

                                {/* Active */}
                                <div className={clsx("w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                                    rule.is_active ? "text-app-success" : "text-white/20"
                                )}>
                                    {rule.is_active ? <CheckCircle2 size={16} /> : <Info size={16} />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {filtered.length === 0 && (
                <div className="py-20 text-center bg-app-surface border border-app-border rounded-[2.5rem] border-dashed">
                    <Filter size={48} className="mx-auto opacity-20 mb-4" />
                    <p className="text-sm font-bold opacity-40">No rules match the current filters.</p>
                </div>
            )}
        </div>
    );
}
