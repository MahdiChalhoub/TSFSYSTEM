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
 <div className="app-page space-y-8 animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <TrendingUp size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Workspace</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Performance <span className="text-app-primary">Hub</span>
          </h1>
        </div>
      </div>
    </header>

 <PerformanceClient leaderboard={leaders} myPerformance={myData} kpiConfig={config} />
 </div>
 );
}
