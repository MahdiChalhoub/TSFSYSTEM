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
 <div className="space-y-8 animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
 <Trophy size={28} className="text-white" />
 </div>
 Perfor<span className="text-amber-600">mance</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">
 Workspace &bull; Talent Scoring
 </p>
 </div>
 </header>

 <PerformanceClient leaderboard={leaders} myPerformance={myData} kpiConfig={config} />
 </div>
 );
}
