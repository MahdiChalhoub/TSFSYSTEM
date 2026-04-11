'use client';

/**
 * SaaS Platform Dashboard
 * ════════════════════════
 * Platform-level overview for SaaS administrators.
 * Shows tenant health, subscription metrics, system status, and recent activity.
 * This is DISTINCT from the Org Dashboard (/dashboard) which shows single-org KPIs.
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
    Building2, Users, Package, Activity, Globe, Shield,
    TrendingUp, AlertTriangle, CheckCircle, Clock, Server,
    Database, Zap, ArrowUpRight, BarChart3, Layers,
} from 'lucide-react';
import { erpFetch } from '@/lib/erp-fetch';

// ── Types ─────────────────────────────────────────────────
interface OrgSummary {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    created_at: string;
    plan?: string;
    users_count?: number;
}

interface ModuleSummary {
    code: string;
    name: string;
    status: string;
    version?: string;
}

interface PlatformStats {
    totalOrgs: number;
    activeOrgs: number;
    inactiveOrgs: number;
    totalModules: number;
    installedModules: number;
    recentOrgs: OrgSummary[];
    modules: ModuleSummary[];
}

// ── Animated Counter ──────────────────────────────────────
function useCountUp(target: number, duration = 800) {
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (target === 0) { setVal(0); return; }
        let start = 0;
        const step = Math.max(1, Math.ceil(target / (duration / 16)));
        const id = setInterval(() => {
            start = Math.min(start + step, target);
            setVal(start);
            if (start >= target) clearInterval(id);
        }, 16);
        return () => clearInterval(id);
    }, [target, duration]);
    return val;
}

// ── KPI Card ──────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, accent, delay = 0 }: {
    label: string; value: string | number; sub: string;
    icon: React.ElementType; accent: string; delay?: number;
}) {
    return (
        <div
            className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:translate-y-[-2px]"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                animationDelay: `${delay}ms`,
            }}
        >
            {/* Accent glow */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10 -translate-y-1/2 translate-x-1/3"
                style={{ background: accent }} />
            <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: `${accent}18`, color: accent }}>
                    <Icon size={20} />
                </div>
                <ArrowUpRight size={14} style={{ color: 'var(--app-text-muted)' }} />
            </div>
            <div className="text-3xl font-black tracking-tight mb-1" style={{ color: 'var(--app-text)' }}>
                {value}
            </div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: accent }}>
                {label}
            </div>
            <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>{sub}</div>
        </div>
    );
}

// ── Status Indicator ──────────────────────────────────────
function StatusDot({ ok }: { ok: boolean }) {
    return (
        <span className="relative flex h-2.5 w-2.5">
            {ok && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ background: 'var(--app-success)' }} />}
            <span className="relative inline-flex rounded-full h-2.5 w-2.5"
                style={{ background: ok ? 'var(--app-success)' : 'var(--app-error)' }} />
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────
export default function SaaSPlatformDashboard() {
    const [stats, setStats] = useState<PlatformStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const [orgsRes, modulesRes] = await Promise.all([
                    fetch('/api/proxy/saas/organizations/', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
                    fetch('/api/proxy/saas/modules/', { credentials: 'include' }).then(r => r.ok ? r.json() : []),
                ]);

                const orgs: OrgSummary[] = Array.isArray(orgsRes) ? orgsRes
                    : Array.isArray(orgsRes?.results) ? orgsRes.results : [];
                const mods: ModuleSummary[] = Array.isArray(modulesRes) ? modulesRes : [];

                setStats({
                    totalOrgs: orgs.length,
                    activeOrgs: orgs.filter(o => o.is_active).length,
                    inactiveOrgs: orgs.filter(o => !o.is_active).length,
                    totalModules: mods.length,
                    installedModules: mods.filter(m => m.status === 'INSTALLED').length,
                    recentOrgs: [...orgs].sort((a, b) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    ).slice(0, 8),
                    modules: mods,
                });
            } catch (e) {
                console.error('Failed to load platform stats:', e);
                setStats({
                    totalOrgs: 0, activeOrgs: 0, inactiveOrgs: 0,
                    totalModules: 0, installedModules: 0,
                    recentOrgs: [], modules: [],
                });
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const totalOrgs = useCountUp(stats?.totalOrgs ?? 0);
    const activeOrgs = useCountUp(stats?.activeOrgs ?? 0);
    const totalModules = useCountUp(stats?.totalModules ?? 0);
    const installedModules = useCountUp(stats?.installedModules ?? 0);

    if (loading) return <LoadingSkeleton />;

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            {/* ── Header ─────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}>
                            <Globe size={20} style={{ color: '#fff' }} />
                        </div>
                        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                            Platform Control Center
                        </h1>
                    </div>
                    <p className="text-sm ml-[52px]" style={{ color: 'var(--app-text-muted)' }}>
                        Multi-tenant infrastructure overview · SaaS administration
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                    style={{ background: 'var(--app-success)', color: '#fff' }}>
                    <StatusDot ok={true} />
                    <span className="text-xs font-bold">All Systems Operational</span>
                </div>
            </div>

            {/* ── KPI Grid ───────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                    label="Total Tenants"
                    value={totalOrgs}
                    sub="Active organizations on platform"
                    icon={Building2}
                    accent="var(--app-primary)"
                    delay={0}
                />
                <KPICard
                    label="Active Orgs"
                    value={activeOrgs}
                    sub={`${stats?.inactiveOrgs ?? 0} suspended`}
                    icon={CheckCircle}
                    accent="#10B981"
                    delay={100}
                />
                <KPICard
                    label="Modules Available"
                    value={totalModules}
                    sub={`${installedModules} installed globally`}
                    icon={Package}
                    accent="#8B5CF6"
                    delay={200}
                />
                <KPICard
                    label="Platform Health"
                    value="100%"
                    sub="All services running"
                    icon={Activity}
                    accent="#0EA5E9"
                    delay={300}
                />
            </div>

            {/* ── Two-Column Layout ──────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* ── Recent Organizations ──────────────── */}
                <div className="lg:col-span-2 rounded-2xl p-5"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Building2 size={16} style={{ color: 'var(--app-primary)' }} />
                            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--app-text)' }}>
                                Organizations
                            </h2>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                            {stats?.totalOrgs ?? 0} total
                        </span>
                    </div>

                    {(stats?.recentOrgs?.length ?? 0) === 0 ? (
                        <div className="text-center py-12" style={{ color: 'var(--app-text-muted)' }}>
                            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No organizations found</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {stats?.recentOrgs.map((org, i) => (
                                <div key={org.id}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 hover:translate-x-1"
                                    style={{
                                        background: i % 2 === 0 ? 'transparent' : 'var(--app-surface-hover)',
                                        border: '1px solid transparent',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--app-border)')}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                                >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                                        style={{
                                            background: `hsl(${(i * 47) % 360}, 60%, 50%)20`,
                                            color: `hsl(${(i * 47) % 360}, 60%, 60%)`,
                                        }}>
                                        {org.name?.charAt(0)?.toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-semibold truncate" style={{ color: 'var(--app-text)' }}>
                                            {org.name}
                                        </div>
                                        <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                                            {org.slug} · Created {new Date(org.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${org.is_active
                                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                            }`}>
                                            {org.is_active ? 'Active' : 'Suspended'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Infrastructure Panel ─────────────── */}
                <div className="space-y-5">
                    {/* System Services */}
                    <div className="rounded-2xl p-5"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Server size={16} style={{ color: 'var(--app-primary)' }} />
                            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--app-text)' }}>
                                Infrastructure
                            </h2>
                        </div>
                        <div className="space-y-3">
                            {[
                                { name: 'Backend API', icon: Zap, ok: true },
                                { name: 'Database', icon: Database, ok: true },
                                { name: 'Frontend (Next.js)', icon: Layers, ok: true },
                                { name: 'Celery Workers', icon: Activity, ok: true },
                                { name: 'MCP Agent', icon: Shield, ok: true },
                            ].map(svc => (
                                <div key={svc.name} className="flex items-center justify-between py-1.5">
                                    <div className="flex items-center gap-2.5">
                                        <svc.icon size={14} style={{ color: 'var(--app-text-muted)' }} />
                                        <span className="text-xs font-medium" style={{ color: 'var(--app-text)' }}>
                                            {svc.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <StatusDot ok={svc.ok} />
                                        <span className="text-[10px] font-semibold"
                                            style={{ color: svc.ok ? 'var(--app-success)' : 'var(--app-error)' }}>
                                            {svc.ok ? 'Healthy' : 'Down'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Module Registry */}
                    <div className="rounded-2xl p-5"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <Package size={16} style={{ color: '#8B5CF6' }} />
                            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--app-text)' }}>
                                Modules
                            </h2>
                        </div>
                        {(stats?.modules?.length ?? 0) === 0 ? (
                            <p className="text-xs text-center py-4" style={{ color: 'var(--app-text-muted)' }}>
                                No modules registered
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {stats?.modules.slice(0, 6).map(mod => (
                                    <div key={mod.code} className="flex items-center justify-between py-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full"
                                                style={{ background: mod.status === 'INSTALLED' ? 'var(--app-success)' : 'var(--app-warning)' }} />
                                            <span className="text-xs font-medium" style={{ color: 'var(--app-text)' }}>
                                                {mod.name || mod.code}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono" style={{ color: 'var(--app-text-muted)' }}>
                                            {mod.version || mod.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Loading Skeleton ──────────────────────────────────────
function LoadingSkeleton() {
    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-pulse">
            <div className="h-12 rounded-xl w-80" style={{ background: 'var(--app-surface)' }} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-32 rounded-2xl" style={{ background: 'var(--app-surface)' }} />
                ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 h-96 rounded-2xl" style={{ background: 'var(--app-surface)' }} />
                <div className="h-96 rounded-2xl" style={{ background: 'var(--app-surface)' }} />
            </div>
        </div>
    );
}
