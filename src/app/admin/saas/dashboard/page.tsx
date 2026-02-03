import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Activity,
    Plus,
    TrendingUp,
    Database,
    Globe,
    ShieldCheck,
    Zap,
    Building,
    Clock,
    LayoutDashboard
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getSaasStats } from "./actions";

export default async function SaasMasterDashboard() {
    const stats = await getSaasStats();

    const quickStats = [
        { label: "Provisioned Tenants", value: stats?.tenants || "0", icon: Building, color: "emerald", trend: "Stable" },
        { label: "Active Subscriptions", value: stats?.activeTenants || "0", icon: ShieldCheck, color: "blue", trend: stats?.lastSync ? `Sync ${stats.lastSync}` : "Live" },
        { label: "Module Registries", value: stats?.modules || "0", icon: Database, color: "purple", trend: "Global" },
        { label: "Module Deployments", value: stats?.deployments || "0", icon: Zap, color: "orange", trend: "Active" },
    ];

    return (
        <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-[0.2em]">
                        <ShieldCheck size={14} /> Platform Control Center
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tight flex items-center gap-4">
                        SaaS Dashboard
                    </h1>
                    <p className="text-gray-400 font-medium text-lg">Infrastructure & Tenant Management Engine</p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" className="border-gray-800 bg-gray-900/50 hover:bg-gray-800 text-white rounded-2xl px-6 py-6 font-bold flex gap-2">
                        <Activity size={18} /> System Health
                    </Button>
                    <Link href="/admin/saas/organizations">
                        <Button className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl px-8 py-6 font-bold shadow-xl shadow-emerald-900/40 flex gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <Plus size={20} /> Provision New Instance
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {quickStats.map((stat, i) => {
                    if (stat.label.includes("Module")) {
                        return (
                            <Link href="/admin/saas/modules" key={i} className="block group">
                                <Card className="bg-[#0F172A] border-gray-800 rounded-[2rem] overflow-hidden group hover:border-emerald-500/30 transition-all shadow-2xl h-full cursor-pointer">
                                    <CardContent className="p-8 space-y-4">
                                        <div className={`p-4 bg-${stat.color}-500/10 rounded-2xl w-fit text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                                            <stat.icon size={24} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-gray-500 uppercase tracking-widest flex justify-between items-center group-hover:text-emerald-400 transition-colors">
                                                {stat.label}
                                                <Zap size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="text-4xl font-black text-white mt-1 font-mono tracking-tighter">{stat.value}</div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                            <Clock size={12} /> {stat.trend}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    }

                    return (
                        <Card key={i} className="bg-[#0F172A] border-gray-800 rounded-[2rem] overflow-hidden group hover:border-emerald-500/30 transition-all shadow-2xl h-full">
                            <CardContent className="p-8 space-y-4">
                                <div className={`p-4 bg-${stat.color}-500/10 rounded-2xl w-fit text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                                    <stat.icon size={24} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">{stat.label}</div>
                                    <div className="text-4xl font-black text-white mt-1 font-mono tracking-tighter">{stat.value}</div>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                    <Clock size={12} /> {stat.trend}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Provisioning */}
                <Card className="lg:col-span-2 bg-[#0F172A]/50 backdrop-blur-xl border-gray-800 rounded-[2.5rem] shadow-2xl p-2">
                    <CardHeader className="p-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-2xl font-black text-white">Recent Deployments</CardTitle>
                                <CardDescription className="text-gray-400 mt-1 font-medium italic">Latest business versions spun up</CardDescription>
                            </div>
                            <Link href="/admin/saas/organizations">
                                <Button variant="ghost" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 font-bold rounded-xl text-sm">
                                    View Full Console
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-8">
                        <div className="space-y-2">
                            {stats?.latestTenants?.map((ten: any) => (
                                <div key={ten.id} className="flex items-center justify-between p-6 rounded-3xl hover:bg-white/5 transition-all border border-transparent hover:border-gray-800">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center text-white font-bold border border-gray-700 shadow-inner">
                                            {ten.name[0]}
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-white">{ten.name}</div>
                                            <div className="text-xs font-mono text-gray-500 uppercase tracking-tighter">{ten.slug}.localhost</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="w-24 px-3 py-1.5 rounded-full border border-gray-800 text-[10px] font-black uppercase text-center tracking-widest bg-gray-900/50 text-gray-400">
                                            {ten.is_active ? 'Active' : 'Suspended'}
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium w-16 text-right">{ten.created_at}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* System Activity */}
                <Card className="bg-[#0F172A] border-gray-800 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Globe size={160} />
                    </div>
                    <CardHeader className="p-8 relative z-10">
                        <CardTitle className="text-2xl font-black text-white flex items-center gap-3">
                            <Zap className="text-yellow-400 fill-yellow-400" size={24} /> Platform Feed
                        </CardTitle>
                        <CardDescription className="text-gray-400">Real-time infrastructure pulse</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-2 relative z-10">
                        <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-emerald-500/50 before:via-gray-800 before:to-transparent">
                            {[
                                { title: "Isolation Hardened", desc: "Cross-tenant data separation logic enforced", time: "Now", icon: ShieldCheck, color: "emerald" },
                                { title: "Context Synced", desc: "SaaS Platform recognized as management org", time: "2m ago", icon: Globe, color: "blue" },
                                { title: "Switcher Refined", desc: "Client switcher filtering complete", time: "15m ago", icon: LayoutDashboard, color: "purple" },
                                { title: "API Gateway Resilient", desc: "Missing context errors suppressed for root", time: "1h ago", icon: Activity, color: "emerald" },
                            ].map((event, i) => (
                                <div key={i} className="relative pl-10">
                                    <div className={`absolute left-0 top-1 w-6 h-6 rounded-full bg-[#0F172A] border-2 border-${event.color}-500 flex items-center justify-center z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]`}>
                                        <div className={`w-1.5 h-1.5 rounded-full bg-${event.color}-500`} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold text-white">{event.title}</div>
                                        <p className="text-xs text-gray-500 mt-0.5 font-medium leading-relaxed">{event.desc}</p>
                                        <div className="text-[10px] font-bold text-gray-700 mt-2 uppercase tracking-wide">{event.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
