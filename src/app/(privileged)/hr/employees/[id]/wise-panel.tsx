'use client';
import { useState } from 'react';
import {
    BarChart3, TrendingUp, TrendingDown, ChevronUp, ChevronDown,
    Zap, ShieldAlert, CheckCircle2, AlertTriangle, X, Send
} from 'lucide-react';
import clsx from 'clsx';
import {
    LineChart, Line, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts';
import { applyWorkforceAdjustment } from '@/app/actions/workforce';

interface Summary {
    id: number;
    global_score: string;
    net_points: string;
    event_count: number;
    critical_negative_count: number;
    badge_level: string;
    risk_level: string;
    trend_indicator: string;
    performance_score: string;
    trust_score: string;
    compliance_score: string;
    attendance_score: string;
    reliability_score: string;
    productivity_score: string;
    accuracy_score: string;
    reward_count: number;
    warning_count: number;
    last_event_at: string;
}

interface Event {
    id: number;
    event_code: string;
    module: string;
    direction: string;
    signed_points: number;
    final_points: string;
    severity_level: string;
    status: string;
    event_at: string;
}

interface Period {
    id: number;
    period_key: string;
    period_type: string;
    global_score: string;
    net_points: string;
    rank_company: number | null;
    snapshot_at: string;
}

interface Props {
    summary: Summary | null;
    events: Event[];
    periods: Period[];
    employeeId: string;
}

const SEVERITY_DOT: Record<string, string> = {
    CRITICAL: 'bg-rose-500',
    MAJOR: 'bg-orange-400',
    MEDIUM: 'bg-amber-400',
    MINOR: 'bg-white/20',
};

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-app-surface border border-app-border rounded-2xl p-4 shadow-2xl text-sm">
            <div className="font-black text-white/60 mb-2">{label}</div>
            <div className="font-black text-2xl" style={{ color: 'var(--app-primary)' }}>
                {payload[0]?.value?.toFixed(1)}
            </div>
            <div className="text-[9px] uppercase opacity-40">Intelligence Score</div>
        </div>
    );
}

export default function EmployeeWisePanel({ summary, events, periods, employeeId }: Props) {
    const [tab, setTab] = useState<'ledger' | 'timeline' | 'adjust'>('ledger');
    const [adjustForm, setAdjustForm] = useState({ points: '', reason: '', type: 'BONUS', dimension: 'PRODUCTIVITY' });
    const [adjusting, setAdjusting] = useState(false);
    const [adjustResult, setAdjustResult] = useState<string | null>(null);

    // Build timeline data from periods
    const timelineData = [...periods]
        .sort((a, b) => a.period_key.localeCompare(b.period_key))
        .map(p => ({
            period: p.period_key,
            score: parseFloat(p.global_score),
            rank: p.rank_company,
        }));

    async function handleAdjust(e: React.FormEvent) {
        e.preventDefault();
        setAdjusting(true);
        setAdjustResult(null);
        try {
            const fd = new FormData();
            fd.set('employee_id', employeeId);
            fd.set('points', adjustForm.points);
            fd.set('reason', adjustForm.reason);
            fd.set('adjustment_type', adjustForm.type);
            fd.set('dimension', adjustForm.dimension);
            const res = await applyWorkforceAdjustment(fd);
            if (res?.success) {
                setAdjustResult('✅ Adjustment applied and score recalculated.');
                setAdjustForm({ points: '', reason: '', type: 'BONUS', dimension: 'PRODUCTIVITY' });
            } else {
                setAdjustResult(`❌ ${res?.error || 'Adjustment failed.'}`);
            }
        } catch (err: any) {
            setAdjustResult(`❌ ${err?.message || 'Network error.'}`);
        } finally {
            setAdjusting(false);
        }
    }

    if (!summary) {
        return (
            <div className="bg-app-surface border border-app-border rounded-[2.5rem] p-12 text-center">
                <BarChart3 size={48} className="mx-auto opacity-20 mb-4" />
                <p className="font-bold opacity-40">No WISE intelligence data recorded for this employee yet.</p>
            </div>
        );
    }

    const avgPeriodScore = timelineData.length
        ? timelineData.reduce((a, p) => a + p.score, 0) / timelineData.length
        : 50;

    return (
        <div className="bg-app-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl">
            {/* Panel header */}
            <div className="p-6 border-b border-app-border bg-white/[0.02] flex items-center justify-between">
                <h3 className="font-black italic flex items-center gap-2 text-lg">
                    <TrendingUp size={20} style={{ color: 'var(--app-primary)' }} />
                    WISE Intelligence
                </h3>
                <div className="flex items-center gap-2 text-[10px] font-bold opacity-40">
                    <span>{summary.event_count} events</span>
                    <span>·</span>
                    <span>{summary.reward_count} rewards</span>
                    <span>·</span>
                    <span>{summary.critical_negative_count} criticals</span>
                </div>
            </div>

            {/* Tab nav */}
            <div className="flex border-b border-app-border">
                {([
                    { key: 'ledger', label: '📋 Event Ledger' },
                    { key: 'timeline', label: '📈 Score Timeline' },
                    { key: 'adjust', label: '⚡ Adjust Score' },
                ] as const).map(({ key, label }) => (
                    <button key={key} onClick={() => setTab(key)}
                        className={clsx(
                            "flex-1 py-4 text-[11px] font-black uppercase tracking-widest transition-all border-b-2",
                            tab === key
                                ? "text-app-primary border-app-primary bg-app-primary/5"
                                : "text-white/30 border-transparent hover:text-white/60"
                        )}>{label}</button>
                ))}
            </div>

            {/* ── Event Ledger ─────────────────────────────────────────── */}
            {tab === 'ledger' && (
                <div className="divide-y divide-app-border max-h-[480px] overflow-y-auto">
                    {events.length === 0 && (
                        <div className="py-16 text-center opacity-30">
                            <CheckCircle2 size={36} className="mx-auto mb-3" />
                            <p className="text-sm font-bold">No events recorded yet.</p>
                        </div>
                    )}
                    {events.map(ev => {
                        const isPos = ev.direction === 'POSITIVE';
                        const isRev = ev.status === 'REVERSED';
                        return (
                            <div key={ev.id} className={clsx(
                                "px-6 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors",
                                isRev && "opacity-30 line-through"
                            )}>
                                {/* Severity dot */}
                                <div className={clsx("w-2 h-2 rounded-full shrink-0", SEVERITY_DOT[ev.severity_level] || 'bg-white/20')} />

                                {/* Direction pill */}
                                <div className={clsx(
                                    "w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0",
                                    isPos ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                )}>{isPos ? '+' : '−'}</div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold truncate">
                                        {ev.event_code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                    </div>
                                    <div className="text-[10px] opacity-30 uppercase font-bold">{ev.module}</div>
                                </div>

                                <div className={clsx("font-black text-base tabular-nums", isPos ? "text-emerald-400" : "text-rose-400")}>
                                    {isPos ? '+' : ''}{ev.signed_points ?? parseFloat(ev.final_points)}
                                </div>
                                <div className="text-[10px] opacity-20 w-20 text-right shrink-0">
                                    {new Date(ev.event_at).toLocaleDateString()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Score Timeline ────────────────────────────────────────── */}
            {tab === 'timeline' && (
                <div className="p-6">
                    {timelineData.length < 2 ? (
                        <div className="py-16 text-center opacity-30">
                            <TrendingUp size={48} className="mx-auto mb-4" />
                            <p className="font-bold">Score history requires at least 2 snapshot periods.</p>
                            <p className="text-sm mt-1">Run <code className="text-app-primary">snapshot_workforce_scores</code> monthly.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Score Trend</div>
                                    <div className="text-2xl font-black mt-1">
                                        {timelineData[timelineData.length - 1]?.score.toFixed(1)}
                                        <span className="text-[10px] opacity-40 ml-1">current</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Avg across periods</div>
                                    <div className="text-2xl font-black mt-1">{avgPeriodScore.toFixed(1)}</div>
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={timelineData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                    <XAxis
                                        dataKey="period"
                                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        domain={[0, 100]}
                                        tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                                    <ReferenceLine y={75} stroke="rgba(16,185,129,0.2)" strokeDasharray="4 4" />
                                    <Line
                                        type="monotone"
                                        dataKey="score"
                                        stroke="var(--app-primary)"
                                        strokeWidth={3}
                                        dot={{ fill: 'var(--app-primary)', r: 5, strokeWidth: 0 }}
                                        activeDot={{ r: 7, fill: 'white', stroke: 'var(--app-primary)', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>

                            {/* Period cards */}
                            <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                                {timelineData.map((p, i) => {
                                    const prev = timelineData[i - 1];
                                    const delta = prev ? p.score - prev.score : 0;
                                    return (
                                        <div key={p.period} className="shrink-0 bg-white/5 rounded-2xl p-4 text-center border border-white/5 min-w-[90px]">
                                            <div className="text-[9px] uppercase opacity-30 mb-1">{p.period}</div>
                                            <div className="text-lg font-black">{p.score.toFixed(0)}</div>
                                            {delta !== 0 && (
                                                <div className={clsx("text-[9px] font-black flex items-center justify-center gap-0.5",
                                                    delta > 0 ? "text-emerald-400" : "text-rose-400"
                                                )}>
                                                    {delta > 0 ? <ChevronUp size={10} strokeWidth={4} /> : <ChevronDown size={10} strokeWidth={4} />}
                                                    {Math.abs(delta).toFixed(1)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Manual Adjustment ────────────────────────────────────── */}
            {tab === 'adjust' && (
                <div className="p-8">
                    <div className="max-w-lg mx-auto">
                        <p className="text-sm text-white/40 mb-6 leading-relaxed">
                            Apply a manual score adjustment to this employee. All adjustments are audited and attributed to your account.
                            The WISE summary will be recalculated immediately.
                        </p>

                        <form onSubmit={handleAdjust} className="space-y-5">
                            {/* Type */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Adjustment Type</label>
                                <div className="flex gap-2">
                                    {['BONUS', 'PENALTY', 'CORRECTION'].map(t => (
                                        <button type="button" key={t}
                                            onClick={() => setAdjustForm(f => ({ ...f, type: t }))}
                                            className={clsx(
                                                "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                                                adjustForm.type === t
                                                    ? t === 'BONUS' ? "bg-emerald-500 text-white border-emerald-500"
                                                        : t === 'PENALTY' ? "bg-rose-500 text-white border-rose-500"
                                                            : "bg-amber-500 text-white border-amber-500"
                                                    : "bg-white/5 text-white/40 border-app-border hover:text-white"
                                            )}>{t}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Dimension */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Dimension</label>
                                <select
                                    value={adjustForm.dimension}
                                    onChange={e => setAdjustForm(f => ({ ...f, dimension: e.target.value }))}
                                    className="w-full bg-white/5 border border-app-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-app-primary/50"
                                >
                                    {['PRODUCTIVITY', 'ACCURACY', 'TIMELINESS', 'ATTENDANCE', 'COMPLIANCE', 'LEADERSHIP', 'TEAMWORK', 'CUSTOMER_IMPACT'].map(d => (
                                        <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Points */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">
                                    Points ({adjustForm.type === 'PENALTY' ? 'will be deducted' : 'will be added'})
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="500"
                                    value={adjustForm.points}
                                    onChange={e => setAdjustForm(f => ({ ...f, points: e.target.value }))}
                                    placeholder="e.g. 50"
                                    required
                                    className="w-full bg-white/5 border border-app-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-app-primary/50"
                                />
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Reason (required for audit)</label>
                                <textarea
                                    value={adjustForm.reason}
                                    onChange={e => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                                    rows={3}
                                    placeholder="Describe why this adjustment is being made…"
                                    required
                                    className="w-full bg-white/5 border border-app-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-app-primary/50 resize-none"
                                />
                            </div>

                            {adjustResult && (
                                <div className={clsx(
                                    "rounded-2xl p-4 text-sm font-bold border",
                                    adjustResult.startsWith('✅')
                                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                        : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                                )}>{adjustResult}</div>
                            )}

                            <button type="submit" disabled={adjusting}
                                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ background: 'var(--app-primary)', color: 'white' }}>
                                <Send size={14} />
                                {adjusting ? 'Applying…' : 'Apply Adjustment'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
