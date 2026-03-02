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
 ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { getSaasStats } from "./actions";
export default async function SaasMasterDashboard() {
 let stats: any = {};
 try { stats = await getSaasStats(); } catch { }
 const quickStats = [
 { label: "Active Tenants", value: stats?.tenants || "0", icon: Building, color: "emerald", trend: "Stable" },
 { label: "Pending Registrations", value: stats?.pendingRegistrations || "0", icon: Activity, color: "amber", trend: "Review Required", href: "/organizations/registrations" },
 { label: "Modules", value: stats?.modules || "0", icon: Database, color: "purple", trend: "Global" },
 { label: "Active Modules", value: stats?.deployments || "0", icon: Zap, color: "orange", trend: "Active" },
 ];
 return (
 <div className="page-container animate-in fade-in duration-700">
 {/* Header Section: Platform Control Panel */}
 <header className="flex flex-col gap-8 mb-10">
 <div className="flex justify-between items-end">
 <div className="flex items-center gap-6">
 <div className="w-20 h-20 rounded-[2rem] bg-emerald-gradient flex items-center justify-center shadow-2xl shadow-emerald-700/20 group hover:rotate-12 transition-transform duration-500">
 <ShieldCheck size={40} className="text-white fill-white/20" />
 </div>
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
 Global Platform: Active
 </Badge>
 <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2">
 <Activity size={14} className="text-emerald-400" /> Infrastructure Status: Nominal
 </span>
 </div>
 <h1 className="page-header-title">
 SaaS <span className="text-emerald-700">Master Hub</span>
 </h1>
 <p className="page-header-subtitle mt-1">
 Manage tenants, modules, and platform infrastructure.
 </p>
 </div>
 </div>
 <div className="hidden lg:flex items-center gap-4">
 <Link href="/updates">
 <button className="h-14 px-8 rounded-2xl bg-app-surface border border-app-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] font-black text-[11px] uppercase tracking-widest text-app-text-muted flex items-center gap-3 hover:bg-app-bg transition-all active:scale-95">
 <Zap size={18} className="text-amber-500 fill-amber-500/20" /> Platform Updates
 </button>
 </Link>
 <Link href="/organizations">
 <button className="h-14 px-8 rounded-2xl bg-slate-900 text-white font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95 border-b-4 border-b-slate-950">
 Add Tenant <Plus size={18} className="text-emerald-400" />
 </button>
 </Link>
 </div>
 </div>
 </header>
 {/* High-Fidelity Infrastructure Metrics */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
 {quickStats.map((stat, i) => {
 const CardComponent = (
 <Card className="card-premium group hover:shadow-2xl hover:shadow-emerald-700/5 transition-all duration-500 overflow-hidden relative h-full">
 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
 <CardContent className="p-8 space-y-6">
 <div className="w-14 h-14 rounded-2xl bg-app-bg text-emerald-600 flex items-center justify-center shadow-inner shadow-slate-200 group-hover:rotate-12 transition-transform duration-500">
 <stat.icon size={28} />
 </div>
 <div>
 <div className="text-[11px] font-black text-app-text-faint uppercase tracking-widest flex justify-between items-center group-hover:text-emerald-500 transition-colors">
 {stat.label}
 {stat.label.includes("Module") && <Zap size={14} className="text-amber-500 animate-pulse" />}
 </div>
 <div className="text-4xl font-black text-app-text mt-1.5 tracking-tighter">{stat.value}</div>
 </div>
 <div className="flex items-center gap-2.5 text-[10px] font-black text-app-text-faint uppercase tracking-widest bg-app-bg w-fit px-3 py-1.5 rounded-lg border border-app-border">
 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {stat.trend}
 </div>
 </CardContent>
 </Card>
 );
 if (stat.label.includes("Module") || stat.href) {
 return (
 <Link href={stat.href || "/modules"} key={i} className="block group">
 {CardComponent}
 </Link>
 );
 }
 return <div key={i}>{CardComponent}</div>;
 })}
 </div>
 {/* Main Content Area */}
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Recent Provisioning */}
 <Card className="lg:col-span-2 card-premium overflow-hidden bg-app-surface">
 <CardHeader className="p-10 pb-4 flex flex-row items-center justify-between">
 <div>
 <CardTitle className="text-xs font-black uppercase tracking-widest text-app-text-faint mb-2">Platform Genesis Feed</CardTitle>
 <h3 className="text-2xl font-black text-app-text tracking-tight">Recent Deployments</h3>
 </div>
 <Link href="/organizations">
 <button className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] px-4 py-2 rounded-xl hover:bg-emerald-50 transition-colors active:scale-95">
 Genesis Console
 </button>
 </Link>
 </CardHeader>
 <CardContent className="px-6 pb-10">
 <div className="space-y-3">
 {stats?.latestTenants?.map((ten: Record<string, any>) => (
 <div key={ten.id} className="flex items-center justify-between p-6 rounded-[2rem] hover:bg-slate-50/50 transition-all border border-transparent hover:border-app-border group/ten">
 <div className="flex items-center gap-6">
 <div className="w-14 h-14 rounded-2xl bg-emerald-gradient flex items-center justify-center text-white font-black text-xl shadow-lg shadow-emerald-700/10 group-hover/ten:rotate-3 transition-transform">
 {ten.name[0]}
 </div>
 <div>
 <div className="text-[15px] font-black text-app-text uppercase tracking-tight">{ten.name}</div>
 <div className="text-[10px] font-black text-app-text-faint uppercase tracking-[0.1em] mt-1">{ten.slug}.localhost</div>
 </div>
 </div>
 <div className="flex items-center gap-10">
 <Badge variant="outline" className={`min-w-[100px] py-1.5 font-black text-[10px] uppercase text-center tracking-widest rounded-full border-0 ${ten.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-app-surface-2 text-app-text-faint'}`}>
 {ten.is_active ? 'ACTIVE' : 'SUSPENDED'}
 </Badge>
 <div className="text-[10px] font-black text-slate-300 uppercase italic w-24 text-right">{ten.created_at}</div>
 </div>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>

 {/* Quick Actions Panel */}
 <Card className="card-premium overflow-hidden bg-app-surface border-emerald-100 shadow-emerald-700/5">
 <CardHeader className="p-10 pt-10 pb-6">
 <CardTitle className="text-[11px] font-black uppercase tracking-widest text-emerald-500 mb-2">Strategic Shortcuts</CardTitle>
 <h3 className="text-2xl font-black text-app-text tracking-tight flex items-center gap-3">
 <Zap className="text-amber-500" size={24} /> Hub Actions
 </h3>
 </CardHeader>
 <CardContent className="p-8 pt-0">
 <div className="space-y-4">
 {[
 { title: "Global Registry", desc: "Manage modules", href: "/modules", icon: Database, color: "text-emerald-600", bg: "bg-emerald-50" },
 { title: "Platform Health", desc: "System health monitoring", href: "/health", icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
 { title: "Platform Updates", desc: "Release notes & updates", href: "/updates", icon: Zap, color: "text-amber-600", bg: "bg-amber-50" },
 { title: "API Connectors", desc: "API connectors", href: "/connector", icon: Globe, color: "text-purple-600", bg: "bg-purple-50" },
 ].map((action, i) => (
 <Link key={i} href={action.href} className="block group/act">
 <div className="flex items-center gap-5 p-5 rounded-[1.8rem] hover:bg-app-bg transition-all border border-transparent hover:border-app-border shadow-sm hover:shadow-lg hover:shadow-slate-200/20 active:scale-[0.98]">
 <div className={`w-12 h-12 rounded-xl ${action.bg} ${action.color} flex items-center justify-center group-hover/act:scale-110 transition-transform shadow-inner`}>
 <action.icon size={22} />
 </div>
 <div className="flex-1">
 <div className="text-[13px] font-black text-app-text uppercase tracking-tight group-hover/act:text-emerald-700 transition-colors">{action.title}</div>
 <p className="text-[10px] font-bold text-app-text-faint mt-1 italic uppercase tracking-tighter">{action.desc}</p>
 </div>
 <ArrowRight size={16} className="text-slate-200 group-hover/act:text-emerald-400 transition-all group-hover/act:translate-x-1" />
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
