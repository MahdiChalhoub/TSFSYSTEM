import { Zap, ShieldAlert, History } from "lucide-react";
import { getWorkforceLeaderboard, getWorkforceRiskHeatmap, getWorkforceEvents } from "@/app/actions/workforce";
import WiseAdjustmentClient from "./client";

export const dynamic = 'force-dynamic';

export default async function WiseAdjustmentsPage() {
    const [leaderboard, riskEmployees, recentEvents] = await Promise.all([
        getWorkforceLeaderboard(50),
        getWorkforceRiskHeatmap(),
        getWorkforceEvents({ direction: 'NEGATIVE' }), // Focus on negative events for adjustment review
    ]);

    const leaders = Array.isArray(leaderboard) ? leaderboard : (leaderboard?.results ?? []);
    const atRisk = Array.isArray(riskEmployees) ? riskEmployees : (riskEmployees?.results ?? []);
    const history = Array.isArray(recentEvents) ? recentEvents : (recentEvents?.results ?? []);

    return (
        <div className="app-page space-y-8 animate-in fade-in duration-500">
            <header className="space-y-6">
                <div className="flex items-center gap-4">
                    <div
                        className="w-16 h-16 rounded-3xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)' }}
                    >
                        <Zap size={32} className="text-violet-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Manual Intervention</p>
                        <h1 className="text-4xl font-black tracking-tighter italic">
                            WISE <span className="text-violet-400">Adjustment Center</span>
                        </h1>
                        <p className="text-sm opacity-40 mt-0.5 font-medium">
                            Correct scoring errors or award manual performance bonuses/penalties.
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Action Panel */}
                <div className="lg:col-span-2">
                    <WiseAdjustmentClient
                        leaderboard={leaders}
                        atRisk={atRisk}
                    />
                </div>

                {/* Secondary Info / History */}
                <aside className="space-y-6">
                    {/* Recent High-Impact Events */}
                    <div className="bg-app-surface border border-app-border rounded-[2rem] overflow-hidden shadow-xl">
                        <div className="px-6 py-4 border-b border-app-border bg-white/5 flex items-center gap-3">
                            <History size={16} className="text-violet-400 opacity-50" />
                            <span className="text-xs font-black uppercase tracking-widest">Recent Negative Events</span>
                        </div>
                        <div className="divide-y divide-app-border">
                            {history.slice(0, 8).map((ev: any) => (
                                <div key={ev.id} className="p-4 space-y-2 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex justify-between items-start">
                                        <div className="font-bold text-xs">{ev.employee_name}</div>
                                        <div className="text-[10px] font-black text-rose-400 tabular-nums">-{parseFloat(ev.final_points).toFixed(0)} pts</div>
                                    </div>
                                    <div className="text-[10px] opacity-40 italic line-clamp-1">{ev.event_type}</div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded bg-white/5 opacity-50">{ev.module}</span>
                                        <span className="text-[8px] opacity-20">{new Date(ev.event_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                            {history.length === 0 && (
                                <div className="p-8 text-center opacity-20 text-xs font-medium">No recent major negative events.</div>
                            )}
                        </div>
                    </div>

                    {/* Audit Warning */}
                    <div className="p-6 rounded-[2rem] bg-rose-500/5 border border-rose-500/20 space-y-3">
                        <div className="flex items-center gap-2 text-rose-400">
                            <ShieldAlert size={16} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Audit Governance</span>
                        </div>
                        <p className="text-[10px] font-medium opacity-60 leading-relaxed">
                            All manual adjustments are tracked with the manager's ID and timestamp. Ensure a clear reason is provided as these are reviewed during quarterly performance audits.
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}
