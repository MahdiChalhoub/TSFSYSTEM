"use client"

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
    CheckCircle2,
    Calendar,
    ChevronRight,
    Search,
    Monitor
} from "lucide-react"
import Link from "next/link"
import { PLATFORM_CONFIG } from '@/lib/branding'
import { useState } from "react"
import type { ReactNode } from "react"

/* ─── Style Helpers ─────────────────────────────────────────────── */
const grad = (v: string) => ({ background: `linear-gradient(135deg, var(${v}), color-mix(in srgb, var(${v}) 65%, black))` });
const soft = (v: string, p = 12) => ({ backgroundColor: `color-mix(in srgb, var(${v}) ${p}%, transparent)` });

/* ─── Types ─────────────────────────────────────────────────────── */
interface Props {
    stats: any;
}

/* ═══════════════════════════════════════════════════════════════════
 *  SUB-COMPONENTS
 * ═══════════════════════════════════════════════════════════════════ */

function SectionHeader({ title, subtitle, icon: Icon, color }: { title: string, subtitle?: string, icon?: any, color?: string }) {
    return (
        <div className="flex items-center gap-2.5 mb-6">
            {Icon && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={soft(color || '--app-primary', 15)}>
                    <Icon size={16} style={{ color: `var(${color || '--app-primary'})` }} />
                </div>
            )}
            <div>
                <h3 className="uppercase tracking-[0.2em] text-app-muted-foreground">{title}</h3>
                {subtitle && <p className="text-[13px] font-bold text-app-foreground mt-0.5">{subtitle}</p>}
            </div>
        </div>
    )
}

function KpiCard({ label, value, icon: Icon, color, trend, href }: any) {
    return (
        <Link href={href} className="group relative overflow-hidden bg-app-surface border border-app-border/40 rounded-2xl p-6 hover:shadow-2xl hover:shadow-app-primary/5 transition-all duration-500 hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 blur-3xl opacity-0 group-hover:opacity-40 transition-opacity" style={grad(color)} />

            <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform duration-500" style={grad(color)}>
                    <Icon size={22} className="text-white" />
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-app-background border border-app-border/50 text-app-muted-foreground group-hover:text-app-foreground transition-colors">
                    <Activity size={12} style={{ color: `var(${color})` }} /> {trend}
                </div>
            </div>

            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground group-hover:text-app-primary transition-colors">{label}</p>
                <h4 className="font-black text-app-foreground mt-1.5 tracking-tight group-hover:scale-105 origin-left transition-transform">{value}</div>
            </div>
        </Link>
    )
}

/* ═══════════════════════════════════════════════════════════════════
 *  MAIN CLIENT COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
export default function SaasHomeClient({ stats }: Props) {
    const quickStats = [
        { label: "Active Tenants", value: stats?.tenants ?? "0", icon: Building, color: "--app-primary", trend: stats?.activeTenants ? `${stats.activeTenants} Active` : "Online", href: "/organizations" },
        { label: "Deployments", value: stats?.deployments ?? "0", icon: Zap, color: "--app-warning", trend: "Nominal", href: "/modules" },
        { label: "Global Modules", value: stats?.modules ?? "0", icon: Database, color: "--app-info", trend: "Synchronized", href: "/modules" },
        { label: "Infrastructure", value: "99.9%", icon: ShieldCheck, color: "--app-success", trend: "High Availability", href: "/health" },
    ]

    const shortcuts = [
        { title: "Manage Tenants", desc: "Organization lifecycle", href: "/organizations", icon: Building, color: "--app-primary" },
        { title: "Global Registry", desc: "Module deployments", href: "/modules", icon: Database, color: "--app-info" },
        { title: "Intelligence Hub", desc: "Mission control", href: "/mcp", icon: Zap, color: "--app-warning" },
        { title: "Platform Health", desc: "System monitoring", href: "/health", icon: Activity, color: "--app-success" },
        { title: "Regional Policy", desc: "Compliance & Taxes", href: "/settings/regional", icon: Globe, color: "--app-danger" },
    ]

    return (
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-700 space-y-10 pb-20">

            {/* ── Header Area ── */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-[2rem] flex items-center justify-center shadow-2xl relative group overflow-hidden" style={grad('--app-success')}>
                        <ShieldCheck size={36} className="text-white relative z-10 group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-app-surface/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white" style={grad('--app-success')}>
                                <div className="w-1.5 h-1.5 rounded-full bg-app-surface animate-pulse" /> Platform Active
                            </span>
                            <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <Monitor size={14} className="text-app-primary" /> v{PLATFORM_CONFIG.version.split('-')[0]} Stable
                            </span>
                        </div>
                        <h1>
                            SaaS <span style={{ color: 'var(--app-success)' }}>Master Hub</span>
                        </h1>
                        <p className="text-xs md:text-sm text-app-muted-foreground mt-1 font-medium">
                            Orchestrating multi-tenant architecture and global module delivery.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link href="/organizations" className="h-12 md:h-14 px-6 md:px-8 rounded-2xl bg-app-surface border border-app-border/50 text-app-foreground font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-app-hover transition-all active:scale-95 shadow-sm">
                        <Plus size={18} style={{ color: 'var(--app-success)' }} /> Provision Tenant
                    </Link>
                </div>
            </header>

            {/* ── KPI Grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {quickStats.map((stat, i) => (
                    <KpiCard key={i} {...stat} />
                ))}
            </div>

            {/* ── Main Content Split ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left: Recent Activity / Tenants */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-app-surface rounded-[2.5rem] border border-app-border/40 overflow-hidden shadow-sm">
                        <div className="px-8 py-6 border-b border-app-border/30 flex items-center justify-between bg-app-background/40 backdrop-blur-sm">
                            <SectionHeader title="Deployment Feed" subtitle="Recently Provisioned Tenants" icon={Building} color="--app-primary" />
                            <Link href="/organizations" className="text-[10px] font-black text-app-primary uppercase tracking-widest hover:underline">
                                Genesis Console
                            </Link>
                        </div>

                        <div className="p-4 space-y-2">
                            {stats?.latestTenants && stats.latestTenants.length > 0 ? (
                                stats.latestTenants.map((ten: any) => (
                                    <div key={ten.id} className="group relative flex items-center justify-between p-4 rounded-[1.5rem] hover:bg-app-background border border-transparent hover:border-app-border/50 transition-all duration-300">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg relative group-hover:rotate-3 transition-transform duration-500" style={grad('--app-primary')}>
                                                {ten.name?.[0] || "?"}
                                                <div className="absolute inset-0 bg-black/10 rounded-2xl scale-75 group-hover:scale-100 transition-transform opacity-0 group-hover:opacity-100" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-app-foreground uppercase tracking-tight">{ten.name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-mono text-app-muted-foreground">{ten.slug}{PLATFORM_CONFIG.suffix}</span>
                                                    <span className="text-[10px] text-app-muted-foreground opacity-30">|</span>
                                                    <span className="text-[10px] text-app-muted-foreground flex items-center gap-1 font-bold">
                                                        <Calendar size={10} /> {ten.created_at}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-app-border/50 ${ten.is_active ? 'bg-app-success/10 text-app-success' : 'bg-app-muted-foreground/10 text-app-muted-foreground'}`}>
                                                {ten.is_active ? 'Active' : 'Halted'}
                                            </div>
                                            <Link href={`/organizations/${ten.id}`} className="p-2 rounded-xl text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/10 transition-all">
                                                <ChevronRight size={18} />
                                            </Link>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-20 text-center">
                                    <Building size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-20" />
                                    <p className="text-sm font-black text-app-muted-foreground">No recent tenants</p>
                                    <p className="text-xs text-app-muted-foreground opacity-60">Platform is ready for provisioning</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Strategic Actions */}
                <div className="space-y-6">
                    <div className="bg-app-surface rounded-[2.5rem] border border-app-border/40 p-8 h-full shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-app-warning/5 rounded-full -mr-16 -mt-16 blur-3xl" />

                        <SectionHeader title="Strategic Shortcuts" subtitle="Administrative Orchestration" icon={Zap} color="--app-warning" />

                        <div className="space-y-3 mt-8">
                            {shortcuts.map((action, i) => (
                                <Link key={i} href={action.href} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-app-background border border-transparent hover:border-app-border/50 transition-all duration-300 group/item active:scale-[0.98]">
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-500 group-hover/item:scale-110" style={soft(action.color, 12)}>
                                        <action.icon size={20} style={{ color: `var(${action.color})` }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-black text-app-foreground uppercase tracking-tight group-hover/item:text-app-primary transition-colors">{action.title}</div>
                                        <p className="text-[10px] font-bold text-app-muted-foreground mt-0.5 truncate">{action.desc}</p>
                                    </div>
                                    <ArrowRight size={16} className="text-app-muted-foreground opacity-0 group-hover/item:opacity-100 group-hover/item:translate-x-1 transition-all" />
                                </Link>
                            ))}
                        </div>

                        {/* Footer Action */}
                        <div className="mt-10 p-6 rounded-[2rem] bg-app-background/50 border border-app-border/30 relative overflow-hidden group/footer">
                            <div className="absolute inset-0 bg-app-primary/5 opacity-0 group-hover/footer:opacity-100 transition-opacity" />
                            <div className="text-[11px] font-black uppercase tracking-widest text-app-foreground mb-1">Global Documentation</h4>
                            <p className="text-[10px] text-app-muted-foreground leading-relaxed mb-4">Access architectural guidelines and deployment workflows.</p>
                            <button className="w-full py-3 rounded-xl bg-app-surface border border-app-border/50 text-[10px] font-black uppercase tracking-widest text-app-foreground flex items-center justify-center gap-2 hover:bg-app-hover transition-all">
                                Architecture Wiki <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    )
}
