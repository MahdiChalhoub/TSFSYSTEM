'use client'

import { useState, useEffect, useCallback } from 'react'
import { erpFetch } from '@/lib/erp-fetch'
import {
    Store, Package, ShoppingCart, BarChart3, Users, UserCheck,
    Globe, Sparkles, LayoutDashboard, Truck, UserCircle, Box,
    Building2, Shield, ChevronRight, X, Check, Lock,
    ArrowUpRight, Zap, Search, RefreshCw
} from 'lucide-react'

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface ModuleFeature {
    code: string
    label: string
    default: boolean
}

interface MarketplaceModule {
    code: string
    name: string
    version: string
    description: string
    category: string
    plan_required: 'starter' | 'business' | 'enterprise'
    plan_accessible: boolean
    icon: string
    is_core: boolean
    dependencies: string[]
    features: ModuleFeature[]
    active_features: string[]
    state: 'ENABLED' | 'AVAILABLE' | 'LOCKED'
}

/* ─────────────────────────────────────────────
   Icon map
───────────────────────────────────────────── */
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
    Building2, ShoppingCart, Package, BarChart3, Users, UserCheck,
    Globe, Sparkles, LayoutDashboard, Truck, UserCircle, Box, Shield, Store
}

function ModuleIcon({ name, size = 24, className = '' }: { name: string; size?: number; className?: string }) {
    const Icon = ICON_MAP[name] || Package
    return <Icon size={size} className={className} />
}

/* ─────────────────────────────────────────────
   Plan badge
───────────────────────────────────────────── */
const PLAN_STYLES: Record<string, { label: string; cls: string }> = {
    starter: { label: 'Starter', cls: 'bg-app-success/15 text-emerald-400 border-app-success/30' },
    business: { label: 'Business', cls: 'bg-app-info/15 text-blue-400 border-app-info/30' },
    enterprise: { label: 'Enterprise', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
}

function PlanBadge({ plan }: { plan: string }) {
    const { label, cls } = PLAN_STYLES[plan] ?? PLAN_STYLES.starter
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${cls}`}>
            {plan === 'enterprise' && <Sparkles size={9} />}
            {plan === 'business' && <Zap size={9} />}
            {label}
        </span>
    )
}

/* ─────────────────────────────────────────────
   Category tabs
───────────────────────────────────────────── */
const CATEGORIES = [
    { key: 'all', label: 'All' },
    { key: 'ENABLED', label: 'Installed' },
    { key: 'AVAILABLE', label: 'Available' },
    { key: 'platform', label: 'Platform' },
    { key: 'commercial', label: 'Commercial' },
    { key: 'operations', label: 'Operations' },
    { key: 'accounting', label: 'Finance' },
    { key: 'relationships', label: 'Relationships' },
    { key: 'human_resources', label: 'HR' },
    { key: 'intelligence', label: 'AI' },
]

/* ─────────────────────────────────────────────
   Module Card
───────────────────────────────────────────── */
function ModuleCard({
    mod,
    onClick,
    onAction,
    loading,
}: {
    mod: MarketplaceModule
    onClick: () => void
    onAction: (code: string, action: 'enable' | 'disable') => void
    loading: boolean
}) {
    const isEnabled = mod.state === 'ENABLED'
    const isLocked = mod.state === 'LOCKED'

    return (
        <div
            onClick={onClick}
            className="group relative rounded-3xl p-5 cursor-pointer transition-all duration-300
        border border-app-border/40 bg-app-card/60 backdrop-blur-md
        hover:border-app-primary/40 hover:bg-app-card/80 hover:shadow-lg hover:-translate-y-1"
            style={{ boxShadow: isEnabled ? '0 0 0 1px var(--app-primary, #6366f1)22' : undefined }}
        >
            {/* State ribbon */}
            {isEnabled && !mod.is_core && (
                <span className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest
          px-2 py-0.5 rounded-full bg-app-success/15 text-emerald-400 border border-app-success/30">
                    ✓ Installed
                </span>
            )}
            {mod.is_core && (
                <span className="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest
          px-2 py-0.5 rounded-full bg-app-primary/20 text-app-primary border border-app-primary/30">
                    Core
                </span>
            )}

            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-colors
        ${isEnabled
                    ? 'bg-app-success/15 border border-app-success/30'
                    : isLocked
                        ? 'bg-app-muted/10 border border-app-border/30'
                        : 'bg-app-primary/10 border border-app-primary/20'
                }`}>
                <ModuleIcon
                    name={mod.icon}
                    size={28}
                    className={isEnabled ? 'text-emerald-400' : isLocked ? 'text-app-muted-foreground/50' : 'text-app-primary'}
                />
            </div>

            {/* Info */}
            <div className="mb-3">
                <h3 className="mb-0.5">{mod.name}</h3>
                <p className="text-[11px] text-app-muted-foreground line-clamp-2">{mod.description}</p>
            </div>

            {/* Plan badge */}
            <div className="mb-4">
                <PlanBadge plan={mod.plan_required} />
            </div>

            {/* Feature chips */}
            {mod.features.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                    {mod.features.slice(0, 3).map(f => (
                        <span key={f.code}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-app-muted/10 text-app-muted-foreground border border-app-border/30">
                            {f.label}
                        </span>
                    ))}
                    {mod.features.length > 3 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full text-app-muted-foreground">
                            +{mod.features.length - 3}
                        </span>
                    )}
                </div>
            )}

            {/* Action button */}
            <button
                onClick={e => { e.stopPropagation(); !mod.is_core && !isLocked && onAction(mod.code, isEnabled ? 'disable' : 'enable') }}
                disabled={loading || mod.is_core || isLocked}
                className={`w-full py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2
          ${mod.is_core
                        ? 'bg-app-muted/10 text-app-muted-foreground cursor-default border border-app-border/20'
                        : isLocked
                            ? 'bg-app-muted/10 text-app-muted-foreground cursor-not-allowed border border-app-border/20'
                            : isEnabled
                                ? 'bg-app-error/10 text-rose-400 border border-app-error/20 hover:bg-app-error/20'
                                : 'bg-app-primary/15 text-app-primary border border-app-primary/30 hover:bg-app-primary/25'
                    } disabled:opacity-50`}
            >
                {loading ? (
                    <RefreshCw size={14} className="animate-spin" />
                ) : mod.is_core ? (
                    <><Check size={14} /> Always Active</>
                ) : isLocked ? (
                    <><Lock size={14} /> Upgrade Required</>
                ) : isEnabled ? (
                    <>Disable</>
                ) : (
                    <><Zap size={14} /> Enable</>
                )}
            </button>
        </div>
    )
}

/* ─────────────────────────────────────────────
   Detail Panel
───────────────────────────────────────────── */
function DetailPanel({
    mod,
    onClose,
    onAction,
    loading,
}: {
    mod: MarketplaceModule
    onClose: () => void
    onAction: (code: string, action: 'enable' | 'disable') => void
    loading: boolean
}) {
    const isEnabled = mod.state === 'ENABLED'
    const isLocked = mod.state === 'LOCKED'

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div
                className="w-full max-w-md h-full bg-app-card/90 backdrop-blur-2xl border-l border-app-border/40
          shadow-2xl flex flex-col overflow-y-auto animate-in slide-in-from-right duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-app-border/30">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-app-primary/10 border border-app-primary/20">
                            <ModuleIcon name={mod.icon} size={28} className="text-app-primary" />
                        </div>
                        <div>
                            <h2>{mod.name}</h2>
                            <p className="text-xs text-app-muted-foreground">v{mod.version}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-app-muted/10 text-app-muted-foreground transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 p-6 space-y-6">
                    {/* Plan + State */}
                    <div className="flex items-center gap-2">
                        <PlanBadge plan={mod.plan_required} />
                        {isEnabled && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-app-success/15 text-emerald-400 border border-app-success/30">
                                ✓ Installed
                            </span>
                        )}
                    </div>

                    {/* Upgrade notice */}
                    {isLocked && (
                        <div className="rounded-2xl p-4 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm">
                            <p className="font-bold mb-1 flex items-center gap-2">
                                <ArrowUpRight size={14} /> Upgrade Required
                            </p>
                            <p className="text-xs text-violet-400/70">
                                This module requires the <strong className="capitalize">{mod.plan_required}</strong> plan.
                                Contact your administrator to upgrade.
                            </p>
                        </div>
                    )}

                    {/* Description */}
                    <div>
                        <h3 className="uppercase text-app-muted-foreground mb-2">About</h3>
                        <p className="text-sm text-app-foreground/80 leading-relaxed">{mod.description}</p>
                    </div>

                    {/* Features */}
                    {mod.features.length > 0 && (
                        <div>
                            <h3 className="uppercase text-app-muted-foreground mb-3">Features</h3>
                            <div className="space-y-2">
                                {mod.features.map(f => (
                                    <div key={f.code} className="flex items-center justify-between rounded-xl p-3 bg-app-muted/5 border border-app-border/20">
                                        <span className="text-sm text-app-foreground">{f.label}</span>
                                        {f.default ? (
                                            <span className="text-[10px] font-bold text-emerald-400">Included</span>
                                        ) : (
                                            <span className="text-[10px] text-app-muted-foreground">Optional</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dependencies */}
                    {mod.dependencies.length > 0 && (
                        <div>
                            <h3 className="uppercase text-app-muted-foreground mb-3">Dependencies</h3>
                            <div className="flex flex-wrap gap-2">
                                {mod.dependencies.map(dep => (
                                    <span key={dep} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-app-primary/10 text-app-primary border border-app-primary/20">
                                        <Package size={10} /> {dep}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer action */}
                {!mod.is_core && (
                    <div className="p-6 border-t border-app-border/30">
                        {isLocked ? (
                            <button disabled className="w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2
                bg-app-muted/10 text-app-muted-foreground border border-app-border/20 cursor-not-allowed">
                                <Lock size={16} /> Upgrade to {mod.plan_required} to Unlock
                            </button>
                        ) : isEnabled ? (
                            <button
                                onClick={() => onAction(mod.code, 'disable')}
                                disabled={loading}
                                className="w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2
                  bg-app-error/10 text-rose-400 border border-app-error/20 hover:bg-app-error/20 transition-all"
                            >
                                {loading ? <RefreshCw size={16} className="animate-spin" /> : 'Disable Module'}
                            </button>
                        ) : (
                            <button
                                onClick={() => onAction(mod.code, 'enable')}
                                disabled={loading}
                                className="w-full py-3 rounded-2xl font-bold flex items-center justify-center gap-2
                  bg-app-primary/20 text-app-primary border border-app-primary/30 hover:bg-app-primary/30 transition-all"
                            >
                                {loading ? <RefreshCw size={16} className="animate-spin" /> : <><Zap size={16} /> Enable Module</>}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function MarketplacePage() {
    const [modules, setModules] = useState<MarketplaceModule[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState('all')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<MarketplaceModule | null>(null)
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const fetchModules = useCallback(async () => {
        try {
            setLoading(true)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = await erpFetch('marketplace/') as any
            setModules(Array.isArray(data) ? data : data?.results ?? [])
        } catch {
            setError('Failed to load marketplace. Check your connection.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchModules() }, [fetchModules])

    const handleAction = async (code: string, action: 'enable' | 'disable') => {
        setActionLoading(code)
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const res = await erpFetch(`marketplace/${code}/${action}/`, { method: 'POST' }) as any
            if (res?.upgrade_required) {
                showToast(`Upgrade your plan to enable this module.`, 'error')
            } else {
                showToast(res?.message ?? `Module ${action}d successfully.`)
                await fetchModules()
                if (selected?.code === code) {
                    setSelected(prev => prev ? { ...prev, state: action === 'enable' ? 'ENABLED' : 'AVAILABLE' } : null)
                }
            }
        } catch {
            showToast(`Failed to ${action} module. Please try again.`, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    // Filtering
    const filtered = modules.filter(m => {
        const matchSearch = search === '' ||
            m.name.toLowerCase().includes(search.toLowerCase()) ||
            m.description.toLowerCase().includes(search.toLowerCase())

        const matchTab = activeTab === 'all' ? true
            : activeTab === 'ENABLED' ? m.state === 'ENABLED'
                : activeTab === 'AVAILABLE' ? m.state === 'AVAILABLE'
                    : m.category === activeTab

        return matchSearch && matchTab
    })

    const enabledCount = modules.filter(m => m.state === 'ENABLED').length
    const availableCount = modules.filter(m => m.state === 'AVAILABLE').length

    return (
        <div className="app-page min-h-screen p-5 md:p-6 space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-700">

            {/* ── Header ── */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
                        <Store size={32} className="text-app-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Admin · Platform</p>
                        <h1 className="italic">
                            App <span className="text-app-primary">Marketplace</span>
                        </h1>
                    </div>
                </div>

                {/* KPI strip */}
                <div className="flex items-center gap-3">
                    <div className="rounded-2xl px-4 py-2 bg-app-success/10 border border-app-success/20 text-center">
                        <p className="text-xl font-black text-emerald-400">{enabledCount}</p>
                        <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-widest">Installed</p>
                    </div>
                    <div className="rounded-2xl px-4 py-2 bg-app-primary/10 border border-app-primary/20 text-center">
                        <p className="text-xl font-black text-app-primary">{availableCount}</p>
                        <p className="text-[10px] font-bold text-app-primary/70 uppercase tracking-widest">Available</p>
                    </div>
                    <div className="rounded-2xl px-4 py-2 bg-app-muted/10 border border-app-border/30 text-center">
                        <p className="text-xl font-black text-app-foreground">{modules.length}</p>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Total</p>
                    </div>
                </div>
            </header>

            {/* ── Search ── */}
            <div className="relative max-w-lg">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search modules…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-app-card/60 border border-app-border/40
            text-app-foreground placeholder:text-app-muted-foreground focus:outline-none
            focus:border-app-primary/50 focus:bg-app-card/80 backdrop-blur-md transition-all"
                />
            </div>

            {/* ── Category tabs ── */}
            <div className="flex items-center gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.key}
                        onClick={() => setActiveTab(cat.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200
              ${activeTab === cat.key
                                ? 'bg-app-primary text-white shadow-lg shadow-app-primary/20'
                                : 'bg-app-card/60 text-app-muted-foreground border border-app-border/30 hover:border-app-primary/30 hover:text-app-foreground'
                            }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* ── Content ── */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-64 rounded-3xl bg-app-card/40 animate-pulse border border-app-border/20" />
                    ))}
                </div>
            ) : error ? (
                <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-app-error/10 border border-app-error/20 flex items-center justify-center mx-auto mb-4">
                        <Package size={28} className="text-rose-400" />
                    </div>
                    <p className="text-rose-400 font-bold">{error}</p>
                    <button onClick={fetchModules} className="mt-4 px-4 py-2 rounded-xl bg-app-primary/10 text-app-primary border border-app-primary/20 text-sm font-bold hover:bg-app-primary/20 transition-colors">
                        <RefreshCw size={14} className="inline mr-2" />Retry
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-app-muted-foreground font-bold">No modules match your search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filtered.map(mod => (
                        <ModuleCard
                            key={mod.code}
                            mod={mod}
                            onClick={() => setSelected(mod)}
                            onAction={handleAction}
                            loading={actionLoading === mod.code}
                        />
                    ))}
                </div>
            )}

            {/* ── Detail Panel ── */}
            {selected && (
                <DetailPanel
                    mod={selected}
                    onClose={() => setSelected(null)}
                    onAction={handleAction}
                    loading={actionLoading === selected.code}
                />
            )}

            {/* ── Toast ── */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[100] px-5 py-3 rounded-2xl font-bold text-sm shadow-xl
          animate-in slide-in-from-bottom duration-300 flex items-center gap-2
          ${toast.type === 'success'
                        ? 'bg-app-success/20 text-emerald-300 border border-app-success/30'
                        : 'bg-app-error/20 text-rose-300 border border-app-error/30'
                    }`}>
                    {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
                    {toast.msg}
                </div>
            )}
        </div>
    )
}
