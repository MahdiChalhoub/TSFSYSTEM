'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getOrgTaxPolicy, getCounterpartyTaxProfiles } from '@/app/actions/finance/tax-engine'
import { toast } from 'sonner'
import {
    Shield, Users, TrendingUp, TrendingDown,
    DollarSign, Calculator, Settings, ArrowRight,
    CheckCircle2, Percent, Building2, BarChart3, FileCheck,
    Maximize2, Minimize2, Search, Loader2,
    FileText, Clock, Landmark, ChevronRight, Zap
} from 'lucide-react'

// ── KPI helpers ──
function buildKPIs(policy: any, profiles: any[]) {
    if (!policy) return []
    const vatRate = policy.vat_output_enabled ? 'Active' : 'Off'
    const purchaseRate = `${(parseFloat(policy.purchase_tax_rate || 0) * 100).toFixed(1)}%`
    const salesRate = `${(parseFloat(policy.sales_tax_rate || 0) * 100).toFixed(1)}%`
    const profileCount = profiles.length
    const vatRegCount = profiles.filter(p => p.vat_registered).length

    return [
        { label: 'VAT Output', value: vatRate, color: 'var(--app-success, #22c55e)', icon: <CheckCircle2 size={14} /> },
        { label: 'Purchase Tax', value: purchaseRate, color: 'var(--app-info, #3b82f6)', icon: <TrendingDown size={14} /> },
        { label: 'Sales Tax', value: salesRate, color: 'var(--app-warning, #f59e0b)', icon: <TrendingUp size={14} /> },
        { label: 'Profiles', value: profileCount, color: '#8b5cf6', icon: <Users size={14} /> },
        { label: 'VAT Registered', value: vatRegCount, color: 'var(--app-primary)', icon: <Shield size={14} /> },
    ]
}

// ── Tax type config ──
const TAX_TYPES = [
    { key: 'vat', label: 'VAT (TVA)', icon: CheckCircle2, color: 'var(--app-success, #22c55e)',
      getValue: (p: any) => `Output: ${p.vat_output_enabled ? 'YES' : 'NO'} · Input: ${(parseFloat(p.vat_input_recoverability || 0) * 100).toFixed(0)}%` },
    { key: 'airsi', label: 'AIRSI', icon: Shield, color: '#8b5cf6',
      getValue: (p: any) => p.airsi_treatment || '—' },
    { key: 'purchase', label: 'Purchase Tax', icon: TrendingDown, color: 'var(--app-info, #3b82f6)',
      getValue: (p: any) => `${(parseFloat(p.purchase_tax_rate || 0) * 100).toFixed(2)}% · ${p.purchase_tax_mode || '—'}` },
    { key: 'sales', label: 'Sales/Turnover', icon: TrendingUp, color: 'var(--app-warning, #f59e0b)',
      getValue: (p: any) => `${(parseFloat(p.sales_tax_rate || 0) * 100).toFixed(2)}% · ${p.sales_tax_trigger || '—'}` },
    { key: 'periodic', label: 'Periodic/Forfait', icon: Calculator, color: 'var(--app-error, #ef4444)',
      getValue: (p: any) => `${p.periodic_amount || '0'} ${p.periodic_interval || ''}`.trim() || '—' },
    { key: 'profit', label: 'Profit Tax', icon: DollarSign, color: 'var(--app-primary)',
      getValue: (p: any) => p.profit_tax_mode || '—' },
]

// ── Module navigation cards ──
const MODULE_CARDS = [
    {
        title: 'Organization Tax Policies', subtitle: 'Configure how your organization handles all 6 tax types',
        icon: Building2, color: 'var(--app-primary)', url: '/finance/org-tax-policies',
        stats: (p: any) => [{ label: 'Active Policy', value: p?.name || 'None' }, { label: 'Country', value: p?.country_code || '—' }],
    },
    {
        title: 'Counterparty Profiles', subtitle: 'Tax treatment presets for suppliers and customers',
        icon: Users, color: 'var(--app-success, #22c55e)', url: '/finance/counterparty-tax-profiles',
        stats: (_: any, profiles: any[]) => [
            { label: 'Total', value: profiles.length },
            { label: 'VAT Reg', value: profiles.filter(p => p.vat_registered).length },
            { label: 'AIRSI', value: profiles.filter(p => p.airsi_subject).length },
        ],
    },
    {
        title: 'Tax Groups', subtitle: 'Grouped VAT rates for products (e.g. TVA 18%, TVA 0%)',
        icon: Percent, color: 'var(--app-info, #3b82f6)', url: '/finance/tax-groups',
        stats: () => [{ label: 'Module', value: 'Tax Groups' }],
    },
    {
        title: 'Custom Tax Rules', subtitle: 'Product/category-specific tax overrides',
        icon: Settings, color: '#8b5cf6', url: '/finance/custom-tax-rules',
        stats: () => [{ label: 'Module', value: 'Overrides' }],
    },
    {
        title: 'Periodic Tax Accruals', subtitle: 'Automated sales tax and forfait provisions',
        icon: Calculator, color: 'var(--app-warning, #f59e0b)', url: '/finance/periodic-tax',
        stats: () => [{ label: 'Module', value: 'Accruals' }],
    },
    {
        title: 'VAT Returns & Settlement', subtitle: 'VAT reports, returns, and settlement posting',
        icon: FileCheck, color: 'var(--app-error, #ef4444)', url: '/finance/vat-return',
        stats: () => [{ label: 'Module', value: 'VAT Returns' }],
    },
]

export default function TaxPolicyDashboard() {
    const { fmt } = useCurrency()
    const router = useRouter()
    const [focusMode, setFocusMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const searchRef = useRef<HTMLInputElement>(null)

    const [policy, setPolicy] = useState<any>(null)
    const [profiles, setProfiles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // ── Keyboard shortcuts ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const [pol, profs] = await Promise.all([
                getOrgTaxPolicy(),
                getCounterpartyTaxProfiles(),
            ])
            const p = Array.isArray(pol) ? pol[0] : pol?.results?.[0]
            setPolicy(p || null)
            setProfiles(Array.isArray(profs) ? profs : profs?.results || [])
        } catch (error) {
            toast.error('Failed to load tax policy')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const kpis = buildKPIs(policy, profiles)

    const filteredModules = MODULE_CARDS.filter(m =>
        !searchQuery || m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // ═══════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-app-primary" />
            </div>
        )
    }

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>

            {/* ── Header ── */}
            {!focusMode ? (
                <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary"
                            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Shield size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                                Tax Policy Engine
                            </h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {policy ? `${policy.name} · ${policy.country_code}` : 'No Active Policy'} · {profiles.length} Profiles
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {policy && (
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                    color: 'var(--app-success, #22c55e)',
                                    border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)',
                                }}>
                                <Zap size={11} /> Active
                            </div>
                        )}
                        <button onClick={() => router.push('/finance/org-tax-policies')}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Settings size={14} />
                            <span className="hidden sm:inline">Configure Policy</span>
                        </button>
                        <button onClick={() => setFocusMode(true)}
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Maximize2 size={13} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                            <Shield size={14} className="text-white" />
                        </div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Tax Engine</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground">{filteredModules.length} Modules</span>
                    </div>
                    <div className="flex-1" />
                    <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                </div>
            )}

            {/* ── KPI Strip ── */}
            {!focusMode && kpis.length > 0 && (
                <div className="flex-shrink-0 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {kpis.map(s => (
                        <div key={s.label}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                {s.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── 6 Tax Types Strip ── */}
            {!focusMode && policy && (
                <div className="flex-shrink-0 mb-4 p-4 rounded-2xl"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        borderLeft: '3px solid var(--app-primary)',
                    }}>
                    <div className="flex items-center gap-2 mb-3">
                        <Landmark size={13} style={{ color: 'var(--app-primary)' }} />
                        <span className="text-[11px] font-black text-app-foreground uppercase tracking-wider">6 Tax Components</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                        {TAX_TYPES.map(tax => {
                            const Icon = tax.icon
                            return (
                                <div key={tax.key}
                                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
                                    style={{
                                        background: `color-mix(in srgb, ${tax.color} 6%, transparent)`,
                                        border: `1px solid color-mix(in srgb, ${tax.color} 15%, transparent)`,
                                    }}>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${tax.color} 12%, transparent)`, color: tax.color }}>
                                        <Icon size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[9px] font-black uppercase tracking-widest"
                                            style={{ color: 'var(--app-muted-foreground)' }}>{tax.label}</div>
                                        <div className="text-[12px] font-bold text-app-foreground truncate">
                                            {tax.getValue(policy)}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ── Search Bar ── */}
            <div className="flex-shrink-0 mb-3 flex items-center gap-2">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search modules... (Ctrl+K)"
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                    />
                </div>
            </div>

            {/* ── Module Cards ── */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                {filteredModules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                        <Shield size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">
                            {searchQuery ? 'No matching modules' : 'No tax modules available'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                        {filteredModules.map(card => {
                            const Icon = card.icon
                            const stats = card.stats(policy, profiles)
                            return (
                                <div key={card.title}
                                    className="group rounded-2xl overflow-hidden transition-all cursor-pointer hover:brightness-[1.02] animate-in fade-in duration-200"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}
                                    onClick={() => router.push(card.url)}>

                                    {/* Card Header */}
                                    <div className="flex items-center gap-3 px-4 py-3"
                                        style={{
                                            background: `color-mix(in srgb, ${card.color} 3%, var(--app-surface))`,
                                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                                            borderLeft: `3px solid ${card.color}`,
                                        }}>
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: `color-mix(in srgb, ${card.color} 12%, transparent)`, color: card.color }}>
                                            <Icon size={17} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] font-bold text-app-foreground truncate">{card.title}</div>
                                            <div className="text-[10px] font-bold text-app-muted-foreground truncate">{card.subtitle}</div>
                                        </div>
                                        <ChevronRight size={14} className="text-app-muted-foreground group-hover:text-app-foreground transition-colors flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                    </div>

                                    {/* Card Stats */}
                                    <div className="px-4 py-3">
                                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, 1fr)`, gap: '8px' }}>
                                            {stats.map(stat => (
                                                <div key={stat.label}
                                                    className="px-2.5 py-2 rounded-xl text-center"
                                                    style={{
                                                        background: `color-mix(in srgb, ${card.color} 5%, transparent)`,
                                                        border: `1px solid color-mix(in srgb, ${card.color} 10%, transparent)`,
                                                    }}>
                                                    <div className="text-[13px] font-black text-app-foreground tabular-nums">{stat.value}</div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest"
                                                        style={{ color: 'var(--app-muted-foreground)' }}>{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* ── Tax Reports Quick Link ── */}
                {!searchQuery && (
                    <div className="mt-4 rounded-2xl overflow-hidden cursor-pointer group transition-all hover:brightness-[1.02]"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                        }}
                        onClick={() => router.push('/finance/tax-reports')}>
                        <div className="flex items-center gap-3 px-4 py-3"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                                borderLeft: '3px solid var(--app-muted-foreground)',
                            }}>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                <BarChart3 size={17} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-bold text-app-foreground">Tax Reports & Analytics</div>
                                <div className="text-[10px] font-bold text-app-muted-foreground">
                                    Comprehensive tax reports, VAT settlement, and analytics dashboard
                                </div>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <button onClick={(e) => { e.stopPropagation(); router.push('/finance/vat-return') }}
                                    className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all">
                                    <FileText size={11} /> VAT Return
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); router.push('/finance/vat-settlement') }}
                                    className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all">
                                    <DollarSign size={11} /> Settlement
                                </button>
                            </div>
                            <ChevronRight size={14} className="text-app-muted-foreground group-hover:text-app-foreground transition-colors flex-shrink-0" />
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
