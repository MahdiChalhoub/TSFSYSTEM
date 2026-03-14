'use client';
import { useState, useTransition } from 'react';
import { Zap, Send, X, Brain, User, Search, Fingerprint } from 'lucide-react';
import clsx from 'clsx';
import { applyWorkforceAdjustment } from '@/app/actions/workforce';

interface Summary {
    id: number;
    employee_id_pk?: number;
    employee_name: string;
    global_score: string;
    net_points: string;
    badge_level: string;
    risk_level: string;
}

interface Props {
    leaderboard: Summary[];
    atRisk: Summary[];
}

const RISK_COLORS: Record<string, string> = {
    STABLE: 'text-emerald-400',
    AT_RISK: 'text-amber-400',
    HIGH_RISK: 'text-orange-400',
    CRITICAL: 'text-rose-400',
};

export default function WiseAdjustmentClient({ leaderboard, atRisk }: Props) {
    const [adjustTarget, setAdjustTarget] = useState<Summary | null>(null);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ points: '', reason: '', type: 'BONUS', dimension: 'PRODUCTIVITY' });
    const [result, setResult] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const allEmps = [...atRisk, ...leaderboard.filter(l => !atRisk.find(r => r.id === l.id))];
    const filteredEmps = search
        ? allEmps.filter(e => e.employee_name.toLowerCase().includes(search.toLowerCase()))
        : allEmps;

    function openAdjust(emp: Summary) {
        setAdjustTarget(emp);
        setForm({ points: '', reason: '', type: 'BONUS', dimension: 'PRODUCTIVITY' });
        setResult(null);
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
                setResult('✅ Adjustment applied successfully.');
                setForm(f => ({ ...f, points: '', reason: '' }));
            } else {
                setResult(`❌ ${res?.error ?? 'Adjustment failed.'}`);
            }
        });
    }

    return (
        <div className="bg-app-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!adjustTarget ? (
                /* ── Selection Phase ─────────────────────────────────── */
                <div className="p-8 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h2 className="text-xl font-black italic flex items-center gap-3">
                            <User className="text-violet-400" /> Select Employee
                        </h2>
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-violet-400 transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder="Search by name..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="bg-white/5 border border-app-border rounded-2xl pl-12 pr-6 py-2.5 text-sm outline-none focus:border-violet-500/50 transition-all w-64 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredEmps.map(emp => (
                            <button key={emp.id} onClick={() => openAdjust(emp)}
                                className="flex items-center gap-4 p-5 rounded-3xl bg-white/[0.03] border border-app-border hover:border-violet-500/40 hover:bg-violet-500/10 transition-all text-left group">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-black tabular-nums shrink-0 group-hover:scale-110 transition-transform">
                                    {Math.round(parseFloat(emp.global_score))}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate">{emp.employee_name}</div>
                                    <div className={clsx("text-[9px] font-black uppercase tracking-widest mt-0.5", RISK_COLORS[emp.risk_level])}>
                                        {emp.risk_level.replace('_', ' ')}
                                    </div>
                                </div>
                                <Zap size={16} className="text-violet-400 opacity-20 group-hover:opacity-100 transition-opacity" />
                            </button>
                        ))}
                    </div>
                </div>
            ) : (
                /* ── Adjustment Form Phase ───────────────────────────── */
                <div className="animate-in zoom-in-95 duration-300">
                    <div className="p-8 border-b border-app-border bg-violet-500/5 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
                            <Brain size={28} className="text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-400">Target Employee</p>
                            <h2 className="text-2xl font-black italic truncate">{adjustTarget.employee_name}</h2>
                            <div className="flex gap-3 items-center mt-1">
                                <span className="text-[10px] font-black uppercase bg-white/5 px-2 py-0.5 rounded opacity-40">Current Score: {Math.round(parseFloat(adjustTarget.global_score))}</span>
                                <span className={clsx("text-[10px] font-black uppercase tracking-widest", RISK_COLORS[adjustTarget.risk_level])}>{adjustTarget.risk_level}</span>
                            </div>
                        </div>
                        <button onClick={() => setAdjustTarget(null)} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all group">
                            <X size={20} className="text-white/40 group-hover:text-white" />
                        </button>
                    </div>

                    <form onSubmit={handleAdjust} className="p-10 space-y-8">
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-4 flex items-center gap-2">
                                <Fingerprint size={10} /> Selection Adjustment Type
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {['BONUS', 'PENALTY', 'CORRECTION'].map(t => (
                                    <button type="button" key={t}
                                        onClick={() => setForm(f => ({ ...f, type: t }))}
                                        className={clsx(
                                            "py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest border transition-all duration-300",
                                            form.type === t
                                                ? t === 'BONUS' ? "bg-emerald-500 text-white border-emerald-500 shadow-xl shadow-emerald-500/40 scale-105"
                                                    : t === 'PENALTY' ? "bg-rose-500 text-white border-rose-500 shadow-xl shadow-rose-500/40 scale-105"
                                                        : "bg-amber-500 text-white border-amber-500 shadow-xl shadow-amber-500/40 scale-105"
                                                : "bg-white/[0.03] text-white/30 border-app-border hover:text-white hover:bg-white/10"
                                        )}>{t}</button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Dimension</label>
                                <select value={form.dimension} onChange={e => setForm(f => ({ ...f, dimension: e.target.value }))}
                                    className="w-full bg-white/5 border border-app-border rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-violet-500/50 transition-colors cursor-pointer">
                                    {['PRODUCTIVITY', 'ACCURACY', 'TIMELINESS', 'ATTENDANCE', 'COMPLIANCE', 'LEADERSHIP', 'TEAMWORK', 'CUSTOMER_IMPACT', 'FINANCIAL_DISCIPLINE', 'INVENTORY_DISCIPLINE'].map(d => (
                                        <option key={d} value={d} className="bg-app-surface">{d.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">
                                    Magnitude (Points)
                                </label>
                                <input type="number" min="1" max="500"
                                    value={form.points}
                                    onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
                                    placeholder="e.g. 25"
                                    required
                                    className="w-full bg-white/5 border border-app-border rounded-2xl px-5 py-3.5 text-sm outline-none focus:border-violet-500/50 transition-colors shadow-inner"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">
                                Rationale & Justification <span className="text-rose-400">*</span>
                            </label>
                            <textarea value={form.reason}
                                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                rows={4}
                                placeholder="State the clear reason for this override..."
                                required
                                className="w-full bg-white/5 border border-app-border rounded-2xl px-5 py-4 text-sm outline-none focus:border-violet-500/50 transition-colors resize-none shadow-inner leading-relaxed"
                            />
                        </div>

                        {result && (
                            <div className={clsx("rounded-2xl p-5 text-sm font-bold border animate-in slide-in-from-top-2",
                                result.startsWith('✅')
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            )}>
                                <div className="flex items-center gap-3">
                                    {result.startsWith('✅') ? <Send size={16} /> : <X size={16} />}
                                    {result}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <button type="button" onClick={() => setAdjustTarget(null)}
                                className="px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border border-app-border text-white/40 hover:bg-white/5">
                                Cancel
                            </button>
                            <button type="submit" disabled={isPending}
                                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-3 disabled:opacity-50 bg-violet-500 text-white hover:bg-violet-600 shadow-2xl shadow-violet-500/30 active:scale-[0.98]">
                                <Send size={15} />
                                {isPending ? 'Propagating to Engine...' : 'Authorize Adjustment'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
