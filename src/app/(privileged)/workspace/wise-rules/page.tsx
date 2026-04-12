import { ListChecks, Plus, RefreshCw, Layers } from "lucide-react";
import { getWorkforceRulesAll, bulkRecalculateWise } from "@/app/actions/workforce";
import { revalidatePath } from "next/cache";

export const dynamic = 'force-dynamic';

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

export default async function WiseRulesPage() {
    const rules = await getWorkforceRulesAll();
    const ruleList = Array.isArray(rules) ? rules : (rules?.results ?? []);

    const handleRecalculate = async () => {
        'use server';
        await bulkRecalculateWise();
        revalidatePath('/workspace/wise-rules');
    };

    return (
        <div className="app-page space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div
                        className="w-16 h-16 rounded-3xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--app-primary-glow)', border: '1px solid var(--app-primary-border)' }}
                    >
                        <ListChecks size={32} className="text-app-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Engine Management</p>
                        <h1 className="text-4xl font-black tracking-tighter italic">
                            WISE <span className="text-app-primary">Scoring Rules</span>
                        </h1>
                        <p className="text-sm opacity-40 mt-0.5 font-medium">
                            Configure how system events translate into employee performance points.
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <form action={handleRecalculate}>
                        <button type="submit" className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-app-surface/5 border border-app-border text-xs font-black uppercase tracking-widest hover:bg-app-surface/10 transition-all active:scale-95">
                            <RefreshCw size={14} className="text-app-primary" />
                            Bulk Recalculate
                        </button>
                    </form>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-app-primary text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-app-primary/30 hover:shadow-app-primary/50 transition-all active:scale-95">
                        <Plus size={14} />
                        Define New Rule
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Stats Sidebar */}
                <aside className="space-y-6">
                    <div className="bg-app-surface border border-app-border rounded-[2rem] p-6 space-y-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">Rule Stats</p>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs opacity-50 font-bold">Total Rules</span>
                                    <span className="text-sm font-black italic">{ruleList.length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs opacity-50 font-bold">Active</span>
                                    <span className="text-sm font-black italic text-emerald-400">{ruleList.filter((r: any) => r.is_active).length}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs opacity-50 font-bold">Inactive</span>
                                    <span className="text-sm font-black italic text-rose-400">{ruleList.filter((r: any) => !r.is_active).length}</span>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-app-border">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-3">By Module</p>
                            <div className="space-y-2">
                                {Object.entries(
                                    ruleList.reduce((acc: any, r: any) => {
                                        acc[r.module] = (acc[r.module] || 0) + 1;
                                        return acc;
                                    }, {})
                                ).map(([mod, count]: [string, any]) => (
                                    <div key={mod} className="flex justify-between items-center group cursor-default">
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${MODULE_COLORS[mod] || 'bg-app-surface/5 text-white/40'}`}>
                                            {mod}
                                        </span>
                                        <span className="text-[10px] font-bold opacity-30 group-hover:opacity-100 transition-opacity italic">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Main Rule List */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-app-surface border border-app-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <div className="p-8 border-b border-app-border bg-app-surface/5 flex items-center justify-between">
                            <h2 className="text-xl font-black italic flex items-center gap-3">
                                <Layers size={20} className="text-app-primary" /> Active Rule Registry
                            </h2>
                        </div>
                        <div className="divide-y divide-app-border">
                            {ruleList.map((rule: any) => (
                                <div key={rule.id} className={`p-6 flex items-center gap-6 hover:bg-app-surface/[0.02] transition-colors ${!rule.is_active && 'opacity-30'}`}>
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${rule.direction === 'POSITIVE' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                                        }`}>
                                        {rule.direction === 'POSITIVE' ? '+' : '−'}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-lg">{rule.name}</span>
                                            <span className="text-[9px] font-black opacity-20 bg-app-surface/5 px-1.5 py-0.5 rounded uppercase tracking-tighter tabular-nums">ID:{rule.id}</span>
                                        </div>
                                        <div className="flex gap-2 mt-1.5 flex-wrap">
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${MODULE_COLORS[rule.module] || 'bg-app-surface/5 text-white/40'}`}>
                                                {rule.module}
                                            </span>
                                            <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest">{rule.dimension?.replace(/_/g, ' ')}</span>
                                            {rule.daily_cap && <span className="text-[9px] font-bold opacity-30 uppercase bg-app-surface/5 px-2 py-0.5 rounded">Cap: {rule.daily_cap}/day</span>}
                                            {rule.is_critical_rule && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-500 text-white animate-pulse">Critical</span>}
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className={`text-2xl font-black tabular-nums tracking-tighter ${rule.direction === 'POSITIVE' ? "text-emerald-400" : "text-rose-400"
                                            }`}>
                                            {rule.direction === 'POSITIVE' ? '+' : '−'}{parseFloat(rule.base_points).toFixed(0)}<span className="text-[10px] ml-0.5">PTS</span>
                                        </div>
                                        <div className="text-[10px] font-bold uppercase tracking-widest opacity-20 italic">
                                            {rule.submodule || 'Default Trigger'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
