'use client';
import { useState, useTransition } from 'react';
import {
    ShieldAlert, Trophy, BookOpen, AlertTriangle,
    CheckCircle2, ChevronUp, ChevronDown,
    TrendingDown, Send, X, Zap, Brain,
} from 'lucide-react';
import clsx from 'clsx';
import { applyWorkforceAdjustment } from '@/app/actions/workforce';

interface Summary {
    id: number;
    employee_id_pk?: number;
    employee_name: string;
    global_score: string;
    net_points: string;
    event_count: number;
    critical_negative_count: number;
    badge_level: string;
    risk_level: string;
    current_rank_company: number;
    current_rank_branch: number;
    trend_indicator: 'UP' | 'DOWN' | 'STABLE' | 'NEUTRAL';
    last_event_at: string;
    productivity_score: string;
    accuracy_score: string;
    compliance_score: string;
    attendance_score: string;
    leadership_score: string;
    reliability_score: string;
}

interface Rule {
    id: number;
    code: string;
    name: string;
    module: string;
    dimension: string;
    direction: string;
    base_points: string;
    is_active: boolean;
    daily_cap: number | null;
    monthly_cap: number | null;
}

interface Props {
    leaderboard: Summary[];
    atRisk: Summary[];
    rules: Rule[];
}

const RISK_COLORS: Record<string, string> = {
    STABLE: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    AT_RISK: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    HIGH_RISK: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    CRITICAL: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const MODULE_COLORS: Record<string, string> = {
    crm: 'bg-blue-500/10 text-blue-400',
    finance: 'bg-emerald-500/10 text-emerald-400',
    hr: 'bg-purple-500/10 text-purple-400',
    sales: 'bg-amber-500/10 text-amber-400',
    inventory: 'bg-cyan-500/10 text-cyan-400',
    workspace: 'bg-indigo-500/10 text-indigo-400',
    procurement: 'bg-teal-500/10 text-teal-400',
    manual: 'bg-rose-500/10 text-rose-400',
};

function ScoreBar({ val, label }: { val: string; label: string }) {
    const pct = Math.max(4, parseFloat(val || '0'));
    const color = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="w-3 rounded-t-sm" style={{ height: `${pct * 0.32}px`, background: color, opacity: 0.6 }} />
            <span className="text-[7px] uppercase opacity-30">{label}</span>
        </div>
    );
}

export default function WiseConsoleClient({ leaderboard, atRisk, rules }: Props) {
    const [tab, setTab] = useState<'heatmap' | 'leaders' | 'rules' | 'adjust'>('heatmap');
    const [ruleFilter, setRuleFilter] = useState('');

    // Adjust modal state
    const [adjustTarget, setAdjustTarget] = useState<Summary | null>(null);
    const [form, setForm] = useState({ points: '', reason: '', type: 'BONUS', dimension: 'PRODUCTIVITY' });
    const [result, setResult] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const filteredRules = ruleFilter
        ? rules.filter(r => r.module === ruleFilter || r.dimension === ruleFilter)
        : rules;
    const modules = [...new Set(rules.map(r => r.module))].sort();

    function openAdjust(emp: Summary) {
        setAdjustTarget(emp);
        setForm({ points: '', reason: '', type: 'BONUS', dimension: 'PRODUCTIVITY' });
        setResult(null);
        setTab('adjust');
    }

    function handleAdjust(e: React.FormEvent) {
        e.preventDefault();
        if (!adjustTarget) return;
        startTransition(async () => {
            setResult(null);
            const fd = new FormData();
            fd.set('employee_id', String(adjustTarget.employee_id_pk ?? adjustTarget.id));
            fd.set('points', form.points);
            fd.set('reason', form.reason);
            fd.set('adjustment_type', form.type);
            fd.set('dimension', form.dimension);
            const res = await applyWorkforceAdjustment(fd);
            if (res?.success) {
                setResult('✅ Adjustment applied — summary recalculated.');
                setForm(f => ({ ...f, points: '', reason: '' }));
            } else {
                setResult(`❌ ${res?.error ?? 'Adjustment failed.'}`);
            }
        });
    }

    const tabs = [
        { key: 'heatmap' as const, label: '⚠️ Risk Heatmap', count: atRisk.length, danger: true as boolean },
        { key: 'leaders' as const, label: '🏆 Leaderboard', count: leaderboard.length, danger: false as boolean },
        { key: 'rules' as const, label: '📋 Rule Inventory', count: rules.length, danger: false as boolean },
        { key: 'adjust' as const, label: '⚡ Adjust Score', count: 0, danger: false as boolean },
    ];

    return (
        <div className="space-y-6">
            {/* ── Tab Navigation ─────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-2 bg-app-surface/50 backdrop-blur-xl p-2 rounded-[1.5rem] border border-app-border w-fit shadow-xl">
                {tabs.map(({ key, label, count, danger }) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={clsx(
                            "px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2",
                            tab === key
                                ? danger
                                    ? "bg-rose-500 text-white shadow-lg shadow-rose-500/40 scale-105"
                                    : key === 'adjust'
                                        ? "bg-violet-500 text-white shadow-lg shadow-violet-500/40 scale-105"
                                        : "bg-app-primary text-white shadow-lg shadow-app-primary/40 scale-105"
                                : "text-white/40 hover:text-white"
                        )}
                    >
                        {label}
                        {count > 0 && (
                            <span className={clsx("text-[9px] font-black px-1.5 py-0.5 rounded-full", tab === key ? "bg-app-surface/20" : "bg-app-surface/5")}>
                                {count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Risk Heatmap ─────────────────────────────────────────────── */}
            {tab === 'heatmap' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
                    {atRisk.length === 0 ? (
                        <div className="py-24 text-center bg-app-surface border border-app-border rounded-[2.5rem] border-dashed">
                            <CheckCircle2 size={56} className="mx-auto text-emerald-400 opacity-40 mb-4" />
                            <p className="text-xl font-black italic opacity-50">All employees are operating at stable risk levels.</p>
                        </div>
                    ) : (
                        <>
                            {(['CRITICAL', 'HIGH_RISK', 'AT_RISK'] as const).map(level => {
                                const group = atRisk.filter(e => e.risk_level === level);
                                if (!group.length) return null;
                                return (
                                    <div key={level} className="bg-app-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                                        <div className={clsx("px-8 py-4 flex items-center gap-3 border-b border-app-border", RISK_COLORS[level])}>
                                            {level === 'CRITICAL' ? <ShieldAlert size={18} /> : <AlertTriangle size={18} />}
                                            <span className="font-black uppercase tracking-widest text-sm">{level.replace('_', ' ')}</span>
                                            <span className="ml-auto bg-app-surface/10 px-3 py-1 rounded-full text-xs font-black">{group.length} employees</span>
                                        </div>
                                        <div className="divide-y divide-app-border">
                                            {group.map(emp => (
                                                <div key={emp.id} className="p-6 flex items-center gap-6 hover:bg-app-surface/[0.02] transition-colors">
                                                    {/* Score ring */}
                                                    <div className="w-14 h-14 rounded-2xl bg-app-surface/5 flex flex-col items-center justify-center shrink-0">
                                                        <div className="text-xl font-black">{Math.round(parseFloat(emp.global_score))}</div>
                                                        <div className="text-[7px] uppercase opacity-30">Score</div>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold">{emp.employee_name}</div>
                                                        <div className="flex gap-2 mt-1 flex-wrap">
                                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400">
                                                                {emp.critical_negative_count} criticals
                                                            </span>
                                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-app-surface/5 text-white/40">
                                                                Rank #{emp.current_rank_company || '?'}
                                                            </span>
                                                            {emp.trend_indicator === 'DOWN' && (
                                                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 flex items-center gap-1">
                                                                    <TrendingDown size={8} /> Declining
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Mini score bars */}
                                                    <div className="hidden lg:flex gap-2 items-end h-10">
                                                        <ScoreBar val={emp.productivity_score} label="Prod" />
                                                        <ScoreBar val={emp.accuracy_score} label="Acc" />
                                                        <ScoreBar val={emp.compliance_score} label="Comp" />
                                                        <ScoreBar val={emp.attendance_score} label="Att" />
                                                        <ScoreBar val={emp.reliability_score} label="Rel" />
                                                        <ScoreBar val={emp.leadership_score} label="Lead" />
                                                    </div>

                                                    <div className="text-right shrink-0 space-y-1">
                                                        <div className={clsx("text-sm font-black", parseFloat(emp.net_points) >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                                                            {parseFloat(emp.net_points) >= 0 ? '+' : ''}{Math.round(parseFloat(emp.net_points))} pts
                                                        </div>
                                                        <button
                                                            onClick={() => openAdjust(emp)}
                                                            className="flex items-center gap-1 text-[9px] font-black uppercase px-3 py-1.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all"
                                                        >
                                                            <Zap size={9} /> Adjust
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}

            {/* ── Leaderboard ───────────────────────────────────────────────── */}
            {tab === 'leaders' && (
                <div className="bg-app-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-400">
                    <div className="p-8 border-b border-app-border bg-app-surface/5 flex justify-between items-center">
                        <h2 className="text-xl font-black italic flex items-center gap-3">
                            <Trophy className="text-amber-400" /> Full Organization Leaderboard
                        </h2>
                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-40">Top {leaderboard.length}</div>
                    </div>
                    <div className="divide-y divide-app-border">
                        {leaderboard.map((emp, idx) => (
                            <div key={emp.id} className={clsx(
                                "p-5 flex items-center gap-5 hover:bg-app-surface/[0.01] transition-colors",
                                idx === 0 && "bg-amber-500/5"
                            )}>
                                <div className={clsx(
                                    "w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                                    idx === 0 ? "bg-amber-400/20 text-amber-400" :
                                        idx === 1 ? "bg-slate-400/20 text-app-muted-foreground" :
                                            idx === 2 ? "bg-orange-600/20 text-orange-500" :
                                                "bg-app-surface/5 text-white/30"
                                )}>#{idx + 1}</div>

                                <div className="flex-1 min-w-0">
                                    <div className="font-bold">{emp.employee_name}</div>
                                    <div className="flex gap-2 mt-0.5 flex-wrap">
                                        <span className={clsx("text-[9px] font-black uppercase px-2 py-0.5 rounded border", RISK_COLORS[emp.risk_level])}>
                                            {emp.risk_level}
                                        </span>
                                        <span className="text-[9px] opacity-30">{emp.event_count} events</span>
                                    </div>
                                </div>

                                {emp.trend_indicator !== 'NEUTRAL' && (
                                    <div className={clsx(
                                        "flex items-center gap-1 text-[10px] font-black",
                                        emp.trend_indicator === 'UP' ? "text-emerald-400" : "text-rose-400"
                                    )}>
                                        {emp.trend_indicator === 'UP'
                                            ? <ChevronUp size={12} strokeWidth={4} />
                                            : <ChevronDown size={12} strokeWidth={4} />}
                                        {emp.trend_indicator}
                                    </div>
                                )}

                                <div className="text-right shrink-0 space-y-1">
                                    <div className="text-xl font-black text-app-primary">{Math.round(parseFloat(emp.global_score))}</div>
                                    <button onClick={() => openAdjust(emp)}
                                        className="text-[9px] font-black uppercase px-3 py-1 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all flex items-center gap-1">
                                        <Zap size={9} /> Adjust
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Rule Inventory ───────────────────────────────────────────── */}
            {tab === 'rules' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-400">
                    <div className="flex gap-2 flex-wrap">
                        <button onClick={() => setRuleFilter('')}
                            className={clsx("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                ruleFilter === '' ? "bg-app-primary text-white" : "bg-app-surface border border-app-border text-white/40 hover:text-white"
                            )}>All</button>
                        {modules.map(mod => (
                            <button key={mod} onClick={() => setRuleFilter(mod)}
                                className={clsx("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                                    ruleFilter === mod ? "bg-app-primary text-white" : "bg-app-surface border border-app-border text-white/40 hover:text-white"
                                )}>{mod}</button>
                        ))}
                    </div>

                    <div className="bg-app-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-app-border bg-app-surface/5 flex items-center justify-between">
                            <h2 className="text-xl font-black italic flex items-center gap-3">
                                <BookOpen className="text-app-primary" /> Active Scoring Rules
                            </h2>
                            <span className="text-[10px] font-black opacity-40">{filteredRules.length} rules</span>
                        </div>
                        <div className="divide-y divide-app-border">
                            {filteredRules.map(rule => (
                                <div key={rule.id} className={clsx("p-5 flex items-center gap-5 hover:bg-app-surface/[0.02] transition-colors", !rule.is_active && "opacity-30")}>
                                    <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0",
                                        rule.direction === 'POSITIVE' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                    )}>
                                        {rule.direction === 'POSITIVE' ? '+' : '−'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-sm">{rule.name}</div>
                                        <div className="flex gap-2 mt-1 flex-wrap">
                                            <span className={clsx("text-[9px] font-black uppercase px-2 py-0.5 rounded", MODULE_COLORS[rule.module] || 'bg-app-surface/5 text-white/40')}>
                                                {rule.module}
                                            </span>
                                            <span className="text-[9px] font-bold opacity-30 uppercase">{rule.dimension?.replace(/_/g, ' ')}</span>
                                            {rule.daily_cap && <span className="text-[9px] font-bold opacity-30 uppercase">Cap: {rule.daily_cap}/day</span>}
                                            {rule.monthly_cap && <span className="text-[9px] font-bold opacity-30 uppercase">Cap: {rule.monthly_cap}/mo</span>}
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className={clsx("text-lg font-black tabular-nums",
                                            rule.direction === 'POSITIVE' ? "text-emerald-400" : "text-rose-400"
                                        )}>
                                            {rule.direction === 'POSITIVE' ? '+' : '−'}{rule.base_points}pts
                                        </div>
                                        <div className={clsx("text-[9px] font-bold uppercase", rule.is_active ? "text-emerald-400/60" : "text-white/20")}>
                                            {rule.is_active ? 'Active' : 'Paused'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Score Adjustment Panel ──────────────────────────────────── */}
            {tab === 'adjust' && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-400 max-w-2xl mx-auto">
                    <div className="bg-app-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="p-8 border-b border-app-border bg-violet-500/5 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                                <Brain size={24} className="text-violet-400" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-black italic">Manual Score Adjustment</h2>
                                {adjustTarget ? (
                                    <p className="text-sm text-violet-400 font-bold mt-0.5">
                                        Adjusting: <span className="text-white">{adjustTarget.employee_name}</span>
                                        <span className="ml-2 opacity-50">(Current: {Math.round(parseFloat(adjustTarget.global_score))})</span>
                                    </p>
                                ) : (
                                    <p className="text-sm opacity-40 mt-0.5">Select an employee from the Heatmap or Leaderboard, or enter an ID below.</p>
                                )}
                            </div>
                            {adjustTarget && (
                                <button onClick={() => setAdjustTarget(null)} className="p-2 rounded-xl hover:bg-app-surface/5 transition-colors opacity-40 hover:opacity-100">
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        <div className="p-8">
                            {!adjustTarget ? (
                                /* Quick-select grid */
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-4">
                                        Select employee to adjust:
                                    </p>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                        {[...atRisk, ...leaderboard.filter(l => !atRisk.find(r => r.id === l.id))].map(emp => (
                                            <button key={emp.id} onClick={() => openAdjust(emp)}
                                                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-app-surface/3 border border-app-border hover:border-violet-500/30 hover:bg-violet-500/5 transition-all text-left">
                                                <div className="w-10 h-10 rounded-xl bg-app-surface/5 flex items-center justify-center font-black shrink-0">
                                                    {Math.round(parseFloat(emp.global_score))}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-sm">{emp.employee_name}</div>
                                                    <div className={clsx("text-[9px] font-black uppercase", RISK_COLORS[emp.risk_level].split(' ')[0])}>
                                                        {emp.risk_level}
                                                    </div>
                                                </div>
                                                <Zap size={14} className="text-violet-400 shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleAdjust} className="space-y-6">
                                    {/* Type selector */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Adjustment Type</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['BONUS', 'PENALTY', 'CORRECTION'].map(t => (
                                                <button type="button" key={t}
                                                    onClick={() => setForm(f => ({ ...f, type: t }))}
                                                    className={clsx(
                                                        "py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                        form.type === t
                                                            ? t === 'BONUS' ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30"
                                                                : t === 'PENALTY' ? "bg-rose-500 text-white border-rose-500 shadow-lg shadow-rose-500/30"
                                                                    : "bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/30"
                                                            : "bg-app-surface/5 text-white/40 border-app-border hover:text-white"
                                                    )}>{t}</button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dimension */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Dimension</label>
                                        <select value={form.dimension} onChange={e => setForm(f => ({ ...f, dimension: e.target.value }))}
                                            className="w-full bg-app-surface/5 border border-app-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-violet-500/50 transition-colors">
                                            {['PRODUCTIVITY', 'ACCURACY', 'TIMELINESS', 'ATTENDANCE', 'COMPLIANCE', 'LEADERSHIP', 'TEAMWORK', 'CUSTOMER_IMPACT', 'FINANCIAL_DISCIPLINE', 'INVENTORY_DISCIPLINE'].map(d => (
                                                <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Points */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">
                                            Points ({form.type === 'PENALTY' ? 'will be deducted' : 'will be awarded'})
                                        </label>
                                        <input type="number" min="1" max="500"
                                            value={form.points}
                                            onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                                            placeholder="e.g. 50"
                                            required
                                            className="w-full bg-app-surface/5 border border-app-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-violet-500/50 transition-colors"
                                        />
                                    </div>

                                    {/* Reason */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">
                                            Reason <span className="text-rose-400">*</span> (required for audit trail)
                                        </label>
                                        <textarea value={form.reason}
                                            onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                            rows={3}
                                            placeholder="Describe the reason for this adjustment…"
                                            required
                                            className="w-full bg-app-surface/5 border border-app-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-violet-500/50 transition-colors resize-none"
                                        />
                                    </div>

                                    {result && (
                                        <div className={clsx("rounded-2xl p-4 text-sm font-bold border",
                                            result.startsWith('✅')
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                        )}>{result}</div>
                                    )}

                                    <button type="submit" disabled={isPending}
                                        className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 bg-violet-500 text-white hover:bg-violet-600 shadow-lg shadow-violet-500/30">
                                        <Send size={14} />
                                        {isPending ? 'Applying…' : 'Apply Adjustment'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
