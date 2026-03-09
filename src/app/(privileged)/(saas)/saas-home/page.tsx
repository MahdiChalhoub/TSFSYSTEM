"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Activity,
    Plus,
    Database,
    Globe,
    ShieldCheck,
    Zap,
    Building,
    ArrowRight,
    AlertTriangle,
    Loader2
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useEffect, useState } from "react"
import { getSaasStats } from "./actions"

export default function SaasMasterDashboard() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        getSaasStats()
            .then((data) => { setStats(data); setLoading(false) })
            .catch((e) => { setError(e?.message || "Failed to load"); setLoading(false) })
    }, [])

    const quickStats = [
        { label: "Active Tenants", value: stats?.tenants ?? "—", icon: Building, trend: stats?.activeTenants ? `${stats.activeTenants} active` : "Stable", href: "/organizations" },
        { label: "Pending Registrations", value: stats?.pendingRegistrations ?? "—", icon: Activity, trend: "Review Required", href: "/organizations/registrations" },
        { label: "Modules", value: stats?.modules ?? "—", icon: Database, trend: "Global", href: "/modules" },
        { label: "Active Modules", value: stats?.deployments ?? "—", icon: Zap, trend: "Active", href: "/modules" },
    ]

    return (
        <div className="animate-in fade-in duration-700">
            {/* Header */}
            <header className="flex flex-col gap-8 mb-10">
                <div className="flex justify-between items-end">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-[2rem] bg-app-success flex items-center justify-center shadow-2xl shadow-app-primary/20 hover:rotate-12 transition-transform duration-500">
                            <ShieldCheck size={40} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
                                    Global Platform: Active
                                </Badge>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Activity size={14} className="text-emerald-500" /> Infrastructure Status: Nominal
                                </span>
                            </div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
                                SaaS <span className="text-emerald-500">Master Hub</span>
                            </h1>
                            <p className="text-sm text-gray-400 mt-1">
                                Manage tenants, modules, and platform infrastructure.
                            </p>
                        </div>
                    </div>
                    <div className="hidden lg:flex items-center gap-4">
                        <Link href="/updates">
                            <button className="h-14 px-8 rounded-2xl bg-white border border-gray-200 shadow-sm font-black text-[11px] uppercase tracking-widest text-gray-500 flex items-center gap-3 hover:bg-gray-50 transition-all active:scale-95">
                                <Zap size={18} className="text-amber-500" /> Platform Updates
                            </button>
                        </Link>
                        <Link href="/organizations">
                            <button className="h-14 px-8 rounded-2xl bg-white text-gray-900 font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-gray-50 transition-all shadow-lg active:scale-95 border border-gray-200">
                                Add Tenant <Plus size={18} className="text-emerald-500" />
                            </button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Error Banner */}
            {error && (
                <div className="mb-8 p-6 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-4">
                    <AlertTriangle size={24} className="text-red-500 shrink-0" />
                    <div>
                        <div className="text-sm font-bold text-red-600">Dashboard data unavailable</div>
                        <div className="text-xs text-gray-500 mt-1">{error}</div>
                    </div>
                </div>
            )}

            {/* Loading Skeleton */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={32} className="animate-spin text-emerald-500" />
                    <span className="ml-3 text-sm font-bold text-gray-400">Loading dashboard data...</span>
                </div>
            )}

            {/* KPI Cards */}
            {!loading && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {quickStats.map((stat, i) => (
                            <Link href={stat.href} key={i} className="block group">
                                <Card style={{background:"white",color:"#111827",borderRadius:"1rem"}} className="group hover:shadow-xl transition-all duration-300 overflow-hidden relative h-full bg-white border border-gray-100">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                                    <CardContent className="p-8 space-y-6">
                                        <div className="w-14 h-14 rounded-2xl bg-gray-50 text-emerald-500 flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform duration-500">
                                            <stat.icon size={28} />
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-black text-gray-400 uppercase tracking-widest flex justify-between items-center group-hover:text-emerald-500 transition-colors">
                                                {stat.label}
                                                {stat.label.includes("Module") && <Zap size={14} className="text-amber-500 animate-pulse" />}
                                            </div>
                                            <div className="text-4xl font-black text-gray-900 mt-1.5 tracking-tighter">{stat.value}</div>
                                        </div>
                                        <div className="flex items-center gap-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 w-fit px-3 py-1.5 rounded-lg border border-gray-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {stat.trend}
                                        </div>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>

                    {/* Main Content */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Recent Tenants */}
                        <Card style={{background:"white",color:"#111827",borderRadius:"1rem"}} className="lg:col-span-2 overflow-hidden bg-white border border-gray-100">
                            <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Platform Genesis Feed</CardTitle>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Recent Deployments</h3>
                                </div>
                                <Link href="/organizations">
                                    <button className="text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] px-4 py-2 rounded-xl hover:bg-emerald-50 transition-colors active:scale-95">
                                        Genesis Console
                                    </button>
                                </Link>
                            </CardHeader>
                            <CardContent className="px-6 pb-8">
                                <div className="space-y-3">
                                    {stats?.latestTenants && stats.latestTenants.length > 0 ? (
                                        stats.latestTenants.map((ten: Record<string, any>) => (
                                            <div key={ten.id} className="flex items-center justify-between p-5 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 group/ten">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-12 h-12 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-500/20 group-hover/ten:rotate-3 transition-transform">
                                                        {ten.name?.[0] || "?"}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-black text-gray-900 uppercase tracking-tight">{ten.name}</div>
                                                        <div className="text-[10px] font-bold text-gray-400 mt-0.5">{ten.slug}.tsf.ci</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <Badge variant="outline" className={`px-3 py-1 font-bold text-[10px] uppercase tracking-wider rounded-full border-0 ${ten.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                                        {ten.is_active ? 'ACTIVE' : 'SUSPENDED'}
                                                    </Badge>
                                                    <div className="text-[10px] font-bold text-gray-400 w-20 text-right">{ten.created_at}</div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 text-gray-400">
                                            <Building size={40} className="mx-auto mb-4 opacity-30" />
                                            <p className="text-sm font-bold">No recent deployments</p>
                                            <p className="text-xs mt-1 opacity-60">Provision a new tenant to see activity here</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Quick Actions */}
                        <Card style={{background:"white",color:"#111827",borderRadius:"1rem"}} className="overflow-hidden bg-white border border-gray-100">
                            <CardHeader className="p-8 pb-4">
                                <CardTitle className="text-[11px] font-black uppercase tracking-widest text-emerald-500 mb-2">Strategic Shortcuts</CardTitle>
                                <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                                    <Zap className="text-amber-500" size={24} /> Hub Actions
                                </h3>
                            </CardHeader>
                            <CardContent className="p-8 pt-0">
                                <div className="space-y-3">
                                    {[
                                        { title: "Global Registry", desc: "Manage modules", href: "/modules", icon: Database, color: "text-emerald-500", bg: "bg-emerald-50" },
                                        { title: "Organizations", desc: "All tenants", href: "/organizations", icon: Building, color: "text-blue-500", bg: "bg-blue-50" },
                                        { title: "Platform Health", desc: "System monitoring", href: "/health", icon: Activity, color: "text-cyan-500", bg: "bg-cyan-50" },
                                        { title: "Platform Updates", desc: "Release notes", href: "/updates", icon: Zap, color: "text-amber-500", bg: "bg-amber-50" },
                                        { title: "API Connectors", desc: "API connectors", href: "/connector", icon: Globe, color: "text-purple-500", bg: "bg-purple-50" },
                                    ].map((action, i) => (
                                        <Link key={i} href={action.href} className="block group/act">
                                            <div className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition-all border border-transparent hover:border-gray-100 active:scale-[0.98]">
                                                <div className={`w-11 h-11 rounded-xl ${action.bg} ${action.color} flex items-center justify-center group-hover/act:scale-110 transition-transform`}>
                                                    <action.icon size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-[13px] font-black text-gray-900 uppercase tracking-tight group-hover/act:text-emerald-500 transition-colors">{action.title}</div>
                                                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">{action.desc}</p>
                                                </div>
                                                <ArrowRight size={16} className="text-gray-300 group-hover/act:text-emerald-500 group-hover/act:translate-x-1 transition-all" />
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    )
}
