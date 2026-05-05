/** Workspace — Employee Performance & KPIs */
import { erpFetch } from "@/lib/erp-api";
import { TrendingUp, Award, Trophy, Target, Users2, Star } from "lucide-react";
import PerformanceClient from "./client";

export const dynamic = 'force-dynamic';

async function getLeaderboard() {
    try { return await erpFetch('workspace/scores/leaderboard/') } catch { return [] }
}

async function getMyPerformance() {
    try { return await erpFetch('workspace/scores/my_performance/') } catch { return [] }
}

async function getKPIConfig() {
    try { return await erpFetch('workspace/kpi-config/') } catch { return [] }
}

export default async function PerformancePage() {
    const [leaderboard, myPerformance, kpiConfig] = await Promise.all([
        getLeaderboard(), getMyPerformance(), getKPIConfig(),
    ]);
    const leaders = Array.isArray(leaderboard) ? leaderboard : (leaderboard?.results ?? []);
    const myData = Array.isArray(myPerformance) ? myPerformance : (myPerformance?.results ?? []);
    const config = Array.isArray(kpiConfig) ? kpiConfig[0] : kpiConfig;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-[20px] bg-app-warning flex items-center justify-center text-white shadow-2xl">
                            <Trophy size={24} />
                        </div>
                        <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.4em]">Workspace</span>
                    </div>
                    <h1 className="text-6xl lg:text-7xl font-black text-app-foreground tracking-tighter">
                        Perfor<span className="text-app-warning">mance</span>
                    </h1>
                    <p className="text-app-muted-foreground font-medium max-w-xl text-lg leading-relaxed">
                        Employee KPIs, leaderboard, and performance tracking. Monitor task completion, checklists, and evaluation scores.
                    </p>
                </div>
            </div>

            <PerformanceClient leaderboard={leaders} myPerformance={myData} kpiConfig={config} />
        </div>
    );
}
