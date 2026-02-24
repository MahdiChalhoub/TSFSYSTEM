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
    PLATINUM: { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', text: 'text-white', icon: '💎' },
    GOLD: { bg: 'bg-gradient-to-r from-amber-400 to-yellow-500', text: 'text-white', icon: '🥇' },
    SILVER: { bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-gray-800', icon: '🥈' },
    BRONZE: { bg: 'bg-gradient-to-r from-amber-600 to-orange-700', text: 'text-white', icon: '🥉' },
};
export default function PerformanceClient({ leaderboard, myPerformance, kpiConfig }: Props) {
    const [tab, setTab] = useState<'leaderboard' | 'my'>('leaderboard');
    const latest = myPerformance[0];
    return (
        <div className="space-y-6">
            {/* My Score Summary */}
            {latest && (
                <div className="bg-white rounded-3xl border border-gray-50 p-8 shadow-lg shadow-gray-100">
                    <div className="flex items-center gap-3 mb-6">
                        <Star size={20} className="text-amber-500" />
                        <h2 className="text-lg font-bold text-gray-900">Your Performance — {latest.period_label}</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-gray-900">{latest.overall_score}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Score</div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-indigo-600">{latest.tier ? TIER_STYLES[latest.tier]?.icon : '—'}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">{latest.tier || 'No Tier'}</div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-emerald-600">{latest.tasks_completed}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Completed</div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-sky-600">{latest.completion_rate}%</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Completion</div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-violet-600">{latest.on_time_rate}%</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">On Time</div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-amber-500">{latest.task_points}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Points</div>
                        </div>
                        <div className="bg-gray-50 rounded-2xl p-4 text-center">
                            <div className="text-3xl font-black text-red-500">{latest.tasks_overdue}</div>
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1">Overdue</div>
                        </div>
                    </div>
                </div>
            )}
            {/* Tab Switch */}
            <div className="flex gap-2 bg-white p-1.5 rounded-2xl shadow-lg shadow-gray-100 border border-gray-50 w-fit">
                <button onClick={() => setTab('leaderboard')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'leaderboard' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'text-gray-500 hover:text-gray-700'}`}>
                    🏆 Leaderboard
                </button>
                <button onClick={() => setTab('my')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${tab === 'my' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:text-gray-700'}`}>
                    📊 My History
                </button>
            </div>
            {/* Content */}
            {tab === 'leaderboard' ? (
                <div className="bg-white rounded-3xl border border-gray-50 overflow-hidden shadow-lg shadow-gray-100">
                    <div className="p-6 border-b border-gray-50">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <Trophy size={20} className="text-amber-500" /> Top Performers
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {leaderboard.length === 0 ? (
                            <div className="text-center py-16">
                                <Trophy size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-400 font-medium">No performance data yet</p>
                            </div>
                        ) : leaderboard.map((score, idx) => {
                            const tierStyle = score.tier ? TIER_STYLES[score.tier] : null;
                            return (
                                <div key={score.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-black text-gray-400">
                                        {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `#${idx + 1}`}
                                    </div>
                                    <div className="flex-1">
                                        <div className="font-bold text-gray-900">{score.employee_name}</div>
                                        <div className="text-xs text-gray-400">{score.period_label}</div>
                                    </div>
                                    {tierStyle && (
                                        <span className={`text-xs font-bold px-3 py-1 rounded-xl ${tierStyle.bg} ${tierStyle.text}`}>
                                            {tierStyle.icon} {score.tier}
                                        </span>
                                    )}
                                    <div className="text-right">
                                        <div className="text-lg font-black text-gray-900">{score.overall_score}</div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">score</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-emerald-600">{score.completion_rate}%</div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">completion</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-amber-500">{score.task_points} pts</div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">earned</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-gray-50 overflow-hidden shadow-lg shadow-gray-100">
                    <div className="p-6 border-b border-gray-50">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <BarChart3 size={20} className="text-indigo-600" /> Performance History
                        </h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {myPerformance.length === 0 ? (
                            <div className="text-center py-16">
                                <BarChart3 size={48} className="mx-auto text-gray-300 mb-4" />
                                <p className="text-gray-400 font-medium">No performance data yet</p>
                            </div>
                        ) : myPerformance.map(score => (
                            <div key={score.id} className="flex items-center gap-6 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                                <div className="text-sm font-bold text-gray-600 w-24">{score.period_label}</div>
                                <div className="flex-1 bg-gray-100 rounded-full h-3">
                                    <div className="bg-gradient-to-r from-indigo-500 to-sky-400 h-3 rounded-full transition-all" style={{ width: `${Math.min(score.overall_score, 100)}%` }} />
                                </div>
                                <span className="text-lg font-black text-gray-900 w-16 text-right">{score.overall_score}</span>
                                {score.tier && (
                                    <span className={`text-xs font-bold px-3 py-1 rounded-xl ${TIER_STYLES[score.tier]?.bg} ${TIER_STYLES[score.tier]?.text}`}>
                                        {TIER_STYLES[score.tier]?.icon}
                                    </span>
                                )}
                                <div className="text-xs text-gray-400 w-24 text-right">
                                    {score.tasks_completed}/{score.tasks_assigned} tasks
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {/* KPI Weights */}
            {kpiConfig && (
                <div className="bg-white rounded-3xl border border-gray-50 p-6 shadow-lg shadow-gray-100">
                    <h3 className="text-sm font-bold text-gray-500 mb-4 flex items-center gap-2"><Target size={16} /> KPI Weights</h3>
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-indigo-50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-indigo-600">{kpiConfig.task_completion_weight}%</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase">Tasks</div>
                        </div>
                        <div className="bg-sky-50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-sky-600">{kpiConfig.on_time_weight}%</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase">On Time</div>
                        </div>
                        <div className="bg-emerald-50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-emerald-600">{kpiConfig.checklist_weight}%</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase">Checklists</div>
                        </div>
                        <div className="bg-amber-50 rounded-2xl p-4 text-center">
                            <div className="text-2xl font-black text-amber-600">{kpiConfig.evaluation_weight}%</div>
                            <div className="text-[10px] text-gray-400 font-bold uppercase">Evaluations</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
