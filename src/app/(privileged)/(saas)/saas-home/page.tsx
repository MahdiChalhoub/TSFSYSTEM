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
    Clock
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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 md:gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-app-success font-bold text-xs uppercase tracking-[0.2em]">
                        <ShieldCheck size={14} /> Platform Control Center
                    </div>
                    <h1 className="flex items-center gap-4">
                        SaaS Dashboard
                    </h1>
                    <p className="text-app-muted-foreground font-medium text-sm md:text-lg italic">Infrastructure & Tenant Management Engine</p>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-4">
                    <Link href="/updates">
                        <Button variant="outline" className="border-app-accent/20 bg-app-accent/5 hover:bg-app-accent/10 text-app-accent rounded-2xl px-4 md:px-6 py-4 md:py-6 font-bold flex gap-2 transition-all text-xs md:text-sm">
                            <Zap size={16} fill="currentColor" /> Updates
                        </Button>
                    </Link>
                    <Link href="/health">
                        <Button variant="outline" className="border-app-border bg-app-surface hover:bg-app-surface text-app-muted-foreground rounded-2xl px-4 md:px-6 py-4 md:py-6 font-bold flex gap-2 text-xs md:text-sm shadow-sm">
                            <Activity size={16} /> Health
                        </Button>
                    </Link>
                    <Link href="/organizations">
                        <Button className="bg-app-primary-dark hover:bg-app-primary text-white rounded-2xl px-6 md:px-8 py-4 md:py-6 font-bold shadow-xl shadow-emerald-900/40 flex gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] text-xs md:text-sm">
                            <Plus size={18} /> Provision
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {quickStats.map((stat, i) => {
                    if (stat.label.includes("Module")) {
                        return (
                            <Link href="/modules" key={i} className="block group">
                                <Card className="bg-app-surface border-app-border rounded-[2rem] overflow-hidden group hover:border-app-primary/30 transition-all shadow-xl h-full cursor-pointer">
                                    <CardContent className="p-8 space-y-4">
                                        <div className={`p-4 bg-${stat.color}-500/10 rounded-2xl w-fit text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                                            <stat.icon size={24} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold text-app-muted-foreground uppercase tracking-widest flex justify-between items-center group-hover:text-app-success transition-colors">
                                                {stat.label}
                                                <Zap size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="text-4xl font-black text-app-foreground mt-1 font-mono tracking-tighter">{stat.value}</div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground">
                                            <Clock size={12} /> {stat.trend}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        );
                    }

                    return (
                        <Card key={i} className="bg-app-surface border-app-border rounded-[2rem] overflow-hidden group hover:border-app-primary/30 transition-all shadow-xl h-full">
                            <CardContent className="p-8 space-y-4">
                                <div className={`p-4 bg-${stat.color}-500/10 rounded-2xl w-fit text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                                    <stat.icon size={24} />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-app-muted-foreground uppercase tracking-widest">{stat.label}</div>
                                    <div className="text-4xl font-black text-app-foreground mt-1 font-mono tracking-tighter">{stat.value}</div>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground">
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
                <Card className="lg:col-span-2 bg-app-surface border-app-border rounded-[2.5rem] shadow-xl p-2">
                    <CardHeader className="p-8">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle className="text-2xl font-black text-app-foreground">Recent Deployments</CardTitle>
                                <CardDescription className="text-app-muted-foreground mt-1 font-medium italic">Latest business versions spun up</CardDescription>
                            </div>
                            <Link href="/organizations">
                                <Button variant="ghost" className="text-app-success hover:text-app-success hover:bg-app-primary/10 font-bold rounded-xl text-sm">
                                    View Full Console
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-8">
                        <div className="space-y-2">
                            {stats?.latestTenants?.map((ten: Record<string, any>) => (
                                <div key={ten.id} className="flex items-center justify-between p-6 rounded-3xl hover:bg-app-surface transition-all border border-transparent hover:border-app-border">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-2xl bg-app-surface-2 flex items-center justify-center text-app-foreground font-bold border border-app-border shadow-inner">
                                            {ten.name[0]}
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-app-foreground">{ten.name}</div>
                                            <div className="text-xs font-mono text-app-muted-foreground uppercase tracking-tighter">{ten.slug}.localhost</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="w-24 px-3 py-1.5 rounded-full border border-app-border text-[10px] font-black uppercase text-center tracking-widest bg-app-surface text-app-muted-foreground">
                                            {ten.is_active ? 'Active' : 'Suspended'}
                                        </div>
                                        <div className="text-xs text-app-muted-foreground font-medium w-16 text-right">{ten.created_at}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card className="bg-app-surface border-app-border rounded-[2.5rem] shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 text-app-faint">
                        <Globe size={160} />
                    </div>
                    <CardHeader className="p-8 relative z-10">
                        <CardTitle className="text-2xl font-black text-app-foreground flex items-center gap-3">
                            <Zap className="text-app-accent fill-indigo-100" size={24} /> Quick Actions
                        </CardTitle>
                        <CardDescription className="text-app-muted-foreground">Platform management shortcuts</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-2 relative z-10">
                        <div className="space-y-3">
                            {[
                                { title: "Global Registry", desc: "Manage modules across all tenants", href: "/modules", icon: Database, color: "purple" },
                                { title: "Platform Health", desc: "System diagnostics & status", href: "/health", icon: Activity, color: "emerald" },
                                { title: "Kernel Updates", desc: "Apply core platform patches", href: "/updates", icon: Zap, color: "indigo" },
                                { title: "Connector Control", desc: "API gateway & integrations", href: "/connector", icon: Globe, color: "blue" },
                            ].map((action, i) => (
                                <Link key={i} href={action.href} className="block group">
                                    <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-app-surface transition-all border border-transparent hover:border-app-border cursor-pointer">
                                        <div className={`p-3 rounded-xl bg-${action.color}-500/10 text-${action.color}-500 group-hover:scale-110 transition-transform`}>
                                            <action.icon size={18} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-app-foreground group-hover:text-app-success transition-colors">{action.title}</div>
                                            <p className="text-xs text-app-muted-foreground mt-0.5 font-medium">{action.desc}</p>
                                        </div>
                                        <TrendingUp size={14} className="text-app-faint group-hover:text-app-success transition-colors" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
