import { Gauge } from "lucide-react";
import WiseConsoleClient from "./client";
import {
    getWorkforceLeaderboard,
    getWorkforceRiskHeatmap,
    getWorkforceRules,
    getWorkforceStatistics,
    type WorkforceStatistics,
} from "@/app/actions/workforce";

export const dynamic = 'force-dynamic';

const BADGE_COLORS: Record<string, string> = {
    PLATINUM: 'text-violet-400',
    GOLD: 'text-app-warning',
    SILVER: 'text-app-muted-foreground',
    BRONZE: 'text-app-warning',
    WATCHLIST: 'text-app-error',
};

const BADGE_ICONS: Record<string, string> = {
    PLATINUM: '💎', GOLD: '🥇', SILVER: '🥈', BRONZE: '🥉', WATCHLIST: '⚠️',
};

function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
    return (
        <div className="bg-app-surface border border-app-border rounded-2xl px-5 py-3 text-center flex-shrink-0">
            <div className={`text-2xl font-black ${accent ?? 'text-app-primary'}`}>{value}</div>
            <div className="text-[9px] uppercase tracking-widest opacity-40 mt-0.5">{label}</div>
        </div>
    );
}

export default async function WiseConsolePage() {
    const [leaderboard, riskEmployees, rules, stats] = await Promise.all([
        getWorkforceLeaderboard(20),
        getWorkforceRiskHeatmap(),
        getWorkforceRules(),
        getWorkforceStatistics(),
    ]);

    const leaders = Array.isArray(leaderboard) ? leaderboard : (leaderboard?.results ?? []);
    const atRisk = Array.isArray(riskEmployees) ? riskEmployees : (riskEmployees?.results ?? []);
    const ruleList = Array.isArray(rules) ? rules : (rules?.results ?? []);

    const s = stats as WorkforceStatistics | null;

    // Badge distribution ordered by tier
    const badgeOrder = ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'WATCHLIST'];
    const badgeDist = badgeOrder
        .map(b => ({ badge: b, count: s?.badge_distribution?.[b] ?? 0 }))
        .filter(b => b.count > 0);

    return (
        <div className="app-page space-y-8 animate-in fade-in duration-500">
            <header className="space-y-6">
                {/* Title row */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-16 h-16 rounded-3xl flex items-center justify-center shrink-0"
                            style={{ background: 'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(139,92,246,0.1))', border: '1px solid rgba(239,68,68,0.3)' }}
                        >
                            <Gauge size={32} className="text-app-error" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Manager View</p>
                            <h1 className="italic">
                                WISE <span className="text-app-error">Command Console</span>
                            </h1>
                            {s && (
                                <p className="text-sm opacity-40 mt-0.5 font-medium">
                                    {s.total_employees} employees tracked
                                    {s.avg_global_score != null && ` · Org avg: ${s.avg_global_score.toFixed(1)}`}
                                    {s.min_global_score != null && ` · Range: ${s.min_global_score.toFixed(0)}–${s.max_global_score?.toFixed(0)}`}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Primary KPI pills */}
                    <div className="flex gap-3 flex-wrap">
                        <StatPill label="At Risk" value={atRisk.length} accent="text-app-error" />
                        <StatPill label="Tracked" value={leaders.length} accent="text-app-warning" />
                        <StatPill label="Active Rules" value={ruleList.length} />
                        {s?.avg_global_score != null && (
                            <StatPill label="Org Avg Score" value={s.avg_global_score.toFixed(1)} accent="text-app-primary" />
                        )}
                    </div>
                </div>

                {/* Stats strips — only render if stats loaded */}
                {s && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Risk Distribution */}
                        <div className="bg-app-surface border border-app-border rounded-2xl p-5">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-3">Risk Distribution</p>
                            <div className="flex items-end gap-2 h-12">
                                {Object.entries(s.risk_distribution)
                                    .filter(([, cnt]) => cnt > 0)
                                    .map(([level, cnt]) => {
                                        const total = s.total_employees || 1;
                                        const pct = (cnt / total) * 100;
                                        const colors: Record<string, string> = {
                                            STABLE: 'var(--app-primary)',
                                            AT_RISK: 'var(--app-warning)',
                                            HIGH_RISK: 'var(--app-warning)',
                                            CRITICAL: 'var(--app-error)',
                                        };
                                        return (
                                            <div key={level} className="flex flex-col items-center gap-1 flex-1">
                                                <span className="text-[9px] font-black opacity-60">{cnt}</span>
                                                <div className="w-full rounded-t-lg" style={{ height: `${Math.max(8, pct * 0.44)}px`, background: colors[level] ?? 'var(--app-muted-foreground)', opacity: 0.7 }} />
                                                <span className="text-[8px] uppercase opacity-30">{level.replace('_', ' ')}</span>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        {/* Family Score Averages */}
                        <div className="bg-app-surface border border-app-border rounded-2xl p-5">
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-3">Org Avg Family Scores</p>
                            <div className="grid grid-cols-5 gap-2">
                                {[
                                    { label: 'Perf', val: s.avg_performance_score },
                                    { label: 'Trust', val: s.avg_trust_score },
                                    { label: 'Comp', val: s.avg_compliance_score },
                                    { label: 'Rel', val: s.avg_reliability_score },
                                    { label: 'Lead', val: s.avg_leadership_score },
                                ].map(({ label, val }) => {
                                    const score = val ?? 50;
                                    const color = score >= 75 ? 'var(--app-primary)' : score >= 50 ? 'var(--app-warning)' : 'var(--app-error)';
                                    return (
                                        <div key={label} className="flex flex-col items-center gap-1.5">
                                            <div className="relative w-full h-1.5 rounded-full bg-app-surface/5 overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
                                            </div>
                                            <span className="text-[10px] font-black" style={{ color }}>{score.toFixed(0)}</span>
                                            <span className="text-[8px] uppercase opacity-30">{label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Badge distribution */}
                {badgeDist.length > 0 && (
                    <div className="flex gap-3 flex-wrap">
                        {badgeDist.map(({ badge, count }) => (
                            <div key={badge} className="bg-app-surface border border-app-border rounded-2xl px-4 py-2 flex items-center gap-2">
                                <span className="text-lg">{BADGE_ICONS[badge]}</span>
                                <div>
                                    <div className={`text-sm font-black ${BADGE_COLORS[badge]}`}>{count}</div>
                                    <div className="text-[8px] uppercase opacity-30">{badge}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </header>

            <WiseConsoleClient
                leaderboard={leaders}
                atRisk={atRisk}
                rules={ruleList}
            />
        </div>
    );
}
