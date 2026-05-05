'use client';

import { useState } from 'react';
import { Trophy, Award, TrendingUp, Target, Star, BarChart3, Medal, ChevronUp, ChevronDown } from 'lucide-react';

interface EmployeeScore {
    id: number;
    employee: number;
    employee_name: string;
    period_label: string;
    tasks_assigned: number;
    tasks_completed: number;
    tasks_on_time: number;
    tasks_overdue: number;
    task_points: number;
    checklist_total: number;
    checklist_completed: number;
    evaluation_score: number;
    overall_score: number;
    tier: string | null;
    hours_worked: number;
    completion_rate: number;
    on_time_rate: number;
}

interface Props {
    leaderboard: EmployeeScore[];
    myPerformance: EmployeeScore[];
    kpiConfig: any;
}

const TIER_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
    PLATINUM: { bg: 'bg-app-primary', text: 'text-white', icon: '💎' },
    GOLD: { bg: 'bg-app-warning', text: 'text-white', icon: '🥇' },
    SILVER: { bg: 'bg-app-gradient-surface', text: 'text-app-foreground', icon: '🥈' },
    BRONZE: { bg: 'bg-app-warning', text: 'text-white', icon: '🥉' },
};

export default function PerformanceClient({ leaderboard, myPerformance, kpiConfig }: Props) {
    const [tab, setTab] = useState<'leaderboard' | 'my'>('leaderboard');

    const latest = myPerformance[0];

    return (
        <div className="space-y-6">
            {/* My Score Summary */}
            {latest && (
                <div className="bg-app-surface rounded-3xl border border-app-border p-8 shadow-lg shadow-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <Star size={20} className="text-app-warning" />
                        <h2>Your Performance — {latest.period_label}</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <div className="bg-app-surface rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-app-foreground">{latest.overall_score}</div>
                            <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-1">Score</div>
                        </div>
                        <div className="bg-app-surface rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-app-info">{latest.tier ? TIER_STYLES[latest.tier]?.icon : '—'}</div>
                            <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-1">{latest.tier || 'No Tier'}</div>
                        </div>
                        <div className="bg-app-surface rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-app-success">{latest.tasks_completed}</div>
                            <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-1">Completed</div>
                        </div>
                        <div className="bg-app-surface rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-app-info">{latest.completion_rate}%</div>
                            <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-1">Completion</div>
                        </div>
                        <div className="bg-app-surface rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-violet-600">{latest.on_time_rate}%</div>
                            <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-1">On Time</div>
                        </div>
                        <div className="bg-app-surface rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-app-warning">{latest.task_points}</div>
                            <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-1">Points</div>
                        </div>
                        <div className="bg-app-surface rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-app-error">{latest.tasks_overdue}</div>
                            <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-1">Overdue</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Switch */}
            <div className="flex gap-2 bg-app-surface p-1.5 rounded-2xl shadow-lg shadow-gray-100 border border-app-border w-fit">
                <button onClick={() => setTab('leaderboard')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'leaderboard' ? 'bg-app-warning text-white shadow-lg shadow-amber-200' : 'text-app-muted-foreground hover:text-app-foreground'}`}>
                    🏆 Leaderboard
                </button>
                <button onClick={() => setTab('my')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'my' ? 'bg-app-info text-white shadow-lg shadow-indigo-200' : 'text-app-muted-foreground hover:text-app-foreground'}`}>
                    📊 My History
                </button>
            </div>

            {/* Content */}
            {tab === 'leaderboard' ? (
                <div className="bg-app-surface rounded-3xl border border-app-border overflow-hidden shadow-lg shadow-gray-100">
                    <div className="p-6 border-b border-app-border">
                        <h2 className="flex items-center gap-2">
                            <Trophy size={20} className="text-app-warning" /> Top Performers
                        </h2>
                    </div>
                    <div className="divide-y divide-app-border">
                        {leaderboard.length === 0 ? (
                            <div className="text-center py-16">
                                <Trophy size={48} className="mx-auto text-app-faint mb-4" />
                                <p className="text-app-muted-foreground font-medium">No performance data yet</p>
                            </div>
                        ) : leaderboard.map((score, idx) => {
                            const tierStyle = score.tier ? TIER_STYLES[score.tier] : null;
                            return (
                                <div key={score.id} className="flex items-center gap-4 px-6 py-4 hover:bg-app-surface/50 transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-app-surface-2 flex items-center justify-center font-black text-app-muted-foreground">
                                        {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-app-foreground">{score.employee_name}</div>
                                        <div className="text-xs text-app-muted-foreground">{score.period_label}</div>
                                    </div>
                                    {tierStyle && (
                                        <span className={`text-xs font-bold px-3 py-1 rounded-xl ${tierStyle.bg} ${tierStyle.text}`}>
                                            {tierStyle.icon} {score.tier}
                                        </span>
                                    )}
                                    <div className="text-right">
                                        <div className="text-lg font-black text-app-foreground">{score.overall_score}</div>
                                        <div className="text-[10px] text-app-muted-foreground uppercase tracking-wider">score</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-app-success">{score.completion_rate}%</div>
                                        <div className="text-[10px] text-app-muted-foreground uppercase tracking-wider">completion</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-app-warning">{score.task_points} pts</div>
                                        <div className="text-[10px] text-app-muted-foreground uppercase tracking-wider">earned</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-app-surface rounded-3xl border border-app-border overflow-hidden shadow-lg shadow-gray-100">
                    <div className="p-6 border-b border-app-border">
                        <h2 className="flex items-center gap-2">
                            <BarChart3 size={20} className="text-app-info" /> Performance History
                        </h2>
                    </div>
                    <div className="divide-y divide-app-border">
                        {myPerformance.length === 0 ? (
                            <div className="text-center py-16">
                                <BarChart3 size={48} className="mx-auto text-app-faint mb-4" />
                                <p className="text-app-muted-foreground font-medium">No performance data yet</p>
                            </div>
                        ) : myPerformance.map(score => (
                            <div key={score.id} className="flex items-center gap-6 px-6 py-4 hover:bg-app-surface/50 transition-colors">
                                <div className="text-sm font-bold text-app-muted-foreground w-24">{score.period_label}</div>
                                <div className="flex-1 bg-app-surface-2 rounded-full h-3">
                                    <div className="bg-app-info h-3 rounded-full transition-all" style={{ width: `${Math.min(score.overall_score, 100)}%` }} />
                                </div>
                                <span className="text-lg font-black text-app-foreground w-16 text-right">{score.overall_score}</span>
                                {score.tier && (
                                    <span className={`text-xs font-bold px-3 py-1 rounded-xl ${TIER_STYLES[score.tier]?.bg} ${TIER_STYLES[score.tier]?.text}`}>
                                        {TIER_STYLES[score.tier]?.icon}
                                    </span>
                                )}
                                <div className="text-xs text-app-muted-foreground w-24 text-right">
                                    {score.tasks_completed}/{score.tasks_assigned} tasks
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* KPI Weights */}
            {kpiConfig && (
                <div className="bg-app-surface rounded-3xl border border-app-border p-6 shadow-lg shadow-gray-100">
                    <h3 className="text-app-muted-foreground mb-4 flex items-center gap-2"><Target size={16} /> KPI Weights</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-app-info-bg rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-app-info">{kpiConfig.task_completion_weight}%</div>
                            <div className="text-[10px] text-app-muted-foreground font-bold uppercase">Tasks</div>
                        </div>
                        <div className="bg-app-info-bg rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-app-info">{kpiConfig.on_time_weight}%</div>
                            <div className="text-[10px] text-app-muted-foreground font-bold uppercase">On Time</div>
                        </div>
                        <div className="bg-app-success-bg rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-app-success">{kpiConfig.checklist_weight}%</div>
                            <div className="text-[10px] text-app-muted-foreground font-bold uppercase">Checklists</div>
                        </div>
                        <div className="bg-app-warning-bg rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-app-warning">{kpiConfig.evaluation_weight}%</div>
                            <div className="text-[10px] text-app-muted-foreground font-bold uppercase">Evaluations</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
