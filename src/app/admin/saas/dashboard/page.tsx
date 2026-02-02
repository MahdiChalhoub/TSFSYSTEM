'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    LayoutDashboard,
    Building,
    Users,
    Activity,
    Plus,
    TrendingUp,
    Database,
    Globe,
    ShieldCheck,
    Zap
} from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function SaasMasterDashboard() {
    return (
        <div className="p-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex justify-between items-end">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-[0.2em]">
                        <ShieldCheck size={14} /> Platform Control Center
                    </div>
                    <h1 className="text-5xl font-black text-white tracking-tight">SaaS Dashboard</h1>
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
                {[
                    { label: "Active Tenants", value: "24", icon: Building, color: "emerald", trend: "+12%" },
                    { label: "Total Platform Users", value: "1,248", icon: Users, color: "blue", trend: "+5.4%" },
                    { label: "Database Load", value: "32%", icon: Database, color: "purple", trend: "Optimal" },
                    { label: "Global Reach", value: "12 Countries", icon: Globe, color: "orange", trend: "Expanding" },
                ].map((stat, i) => (
                    <Card key={i} className="bg-[#0F172A] border-gray-800 rounded-[2rem] overflow-hidden group hover:border-emerald-500/30 transition-all shadow-2xl">
                        <CardContent className="p-8 space-y-4">
                            <div className={`p-4 bg-${stat.color}-500/10 rounded-2xl w-fit text-${stat.color}-400 group-hover:scale-110 transition-transform`}>
                                <stat.icon size={24} />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-gray-500 uppercase tracking-widest">{stat.label}</div>
                                <div className="text-3xl font-black text-white mt-1">{stat.value}</div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold">
                                <span className="text-emerald-400 flex items-center gap-1">
                                    <TrendingUp size={12} /> {stat.trend}
                                </span>
                                <span className="text-gray-600">vs last month</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}
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
                            <Button variant="ghost" className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 font-bold rounded-xl text-sm">
                                View Full Console
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-8">
                        <div className="space-y-2">
                            {[
                                { name: "Bakery Corp Côte d'Ivoire", slug: "bakery-ci", sites: 4, status: "Active", time: "2h ago" },
                                { name: "Abidjan Tech Hub", slug: "abidjan-tech", sites: 1, status: "Provisioning", time: "5h ago" },
                                { name: "Global Logistics Ltd", slug: "gl-logistics", sites: 12, status: "Suspended", time: "1d ago" },
                            ].map((org, i) => (
                                <div key={i} className="flex items-center justify-between p-6 rounded-3xl hover:bg-white/5 transition-all border border-transparent hover:border-gray-800">
                                    <div className="flex items-center gap-5">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-800 flex items-center justify-center text-white font-bold border border-gray-700 shadow-inner">
                                            {org.name[0]}
                                        </div>
                                        <div>
                                            <div className="text-lg font-bold text-white">{org.name}</div>
                                            <div className="text-xs font-mono text-gray-500 uppercase tracking-tighter">{org.slug}.tsf-city.com</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-8">
                                        <div className="text-center">
                                            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Sites</div>
                                            <div className="text-sm font-black text-white">{org.sites}</div>
                                        </div>
                                        <div className="w-24 px-3 py-1.5 rounded-full border border-gray-800 text-[10px] font-black uppercase text-center tracking-widest bg-gray-900/50 text-gray-400">
                                            {org.status}
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium w-16 text-right">{org.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* System Activity */}
                <Card className="bg-[#0F172A] border-gray-800 rounded-[2.5rem] shadow-2xl">
                    <CardHeader className="p-8">
                        <CardTitle className="text-2xl font-black text-white flex items-center gap-3">
                            <Zap className="text-yellow-400 fill-yellow-400" size={24} /> Feed
                        </CardTitle>
                        <CardDescription className="text-gray-400">Real-time platform events</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-2">
                        <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-emerald-500/50 before:via-gray-800 before:to-transparent">
                            {[
                                { title: "API Bridge Stabilized", desc: "Next-to-Django gateway re-synchronized", time: "12m ago", icon: Activity, color: "emerald" },
                                { title: "New Org Provisioned", desc: "Abidjan Tech Hub successfully onboarded", time: "5h ago", icon: Building, color: "blue" },
                                { title: "Database Optimization", desc: "Automated Vacuum completed on dev.db", time: "14h ago", icon: Database, color: "purple" },
                                { title: "Security Audit", desc: "Passed weekly infrastructure check", time: "22h ago", icon: ShieldCheck, color: "emerald" },
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
