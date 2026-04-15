'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
    getOrgTaxPolicy, getCounterpartyTaxProfiles,
    getTaxHealth, applyCountryTemplate,
} from '@/app/actions/finance/tax-engine'
import { toast } from 'sonner'
import {
    Shield, Users, TrendingUp, TrendingDown,
    DollarSign, Calculator, Settings, ArrowRight,
    CheckCircle2, Percent, Building2, BarChart3, FileCheck,
    Maximize2, Minimize2, Search, Loader2,
    FileText, Clock, Landmark, ChevronRight, Zap,
    AlertTriangle, XCircle, Info, Wand2, RefreshCw, Globe,
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
    {
        key: 'vat', label: 'VAT (TVA)', icon: CheckCircle2, color: 'var(--app-success, #22c55e)',
        getValue: (p: any) => `Output: ${p.vat_output_enabled ? 'YES' : 'NO'} · Input: ${(parseFloat(p.vat_input_recoverability || 0) * 100).toFixed(0)}%`
    },
    {
        key: 'airsi', label: 'AIRSI', icon: Shield, color: '#8b5cf6',
        getValue: (p: any) => p.airsi_treatment || '—'
    },
    {
        key: 'purchase', label: 'Purchase Tax', icon: TrendingDown, color: 'var(--app-info, #3b82f6)',
        getValue: (p: any) => `${(parseFloat(p.purchase_tax_rate || 0) * 100).toFixed(2)}% · ${p.purchase_tax_mode || '—'}`
    },
    {
        key: 'sales', label: 'Sales/Turnover', icon: TrendingUp, color: 'var(--app-warning, #f59e0b)',
        getValue: (p: any) => `${(parseFloat(p.sales_tax_rate || 0) * 100).toFixed(2)}% · ${p.sales_tax_trigger || '—'}`
    },
    {
        key: 'periodic', label: 'Periodic/Forfait', icon: Calculator, color: 'var(--app-error, #ef4444)',
        getValue: (p: any) => `${p.periodic_amount || '0'} ${p.periodic_interval || ''}`.trim() || '—'
    },
    {
        key: 'profit', label: 'Profit Tax', icon: DollarSign, color: 'var(--app-primary)',
        getValue: (p: any) => p.profit_tax_mode || '—'
    },
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

// ── Tax Health Indicator ──
const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string }> = {
    ok: { icon: CheckCircle2, color: 'var(--app-success, #22c55e)', bg: 'color-mix(in srgb, #22c55e 8%, transparent)', border: 'color-mix(in srgb, #22c55e 18%, transparent)' },
    warning: { icon: AlertTriangle, color: 'var(--app-warning, #f59e0b)', bg: 'color-mix(in srgb, #f59e0b 8%, transparent)', border: 'color-mix(in srgb, #f59e0b 18%, transparent)' },
    error: { icon: XCircle, color: 'var(--app-error, #ef4444)', bg: 'color-mix(in srgb, #ef4444 8%, transparent)', border: 'color-mix(in srgb, #ef4444 18%, transparent)' },
    info: { icon: Info, color: 'var(--app-info, #3b82f6)', bg: 'color-mix(in srgb, #3b82f6 8%, transparent)', border: 'color-mix(in srgb, #3b82f6 18%, transparent)' },
}

function HealthBanner({ health, onApplyTemplate, applying }: {
    health: any
    onApplyTemplate: () => void
    applying: boolean
}) {
    if (!health) return null
    const { overall_ok, country_code, indicators } = health
    const hasIssues = !overall_ok
    const errCount = indicators?.filter((i: any) => i.status === 'error').length || 0
    const warnCount = indicators?.filter((i: any) => i.status === 'warning').length || 0

    return (
        <div className="flex-shrink-0 mb-4 rounded-2xl overflow-hidden animate-in fade-in duration-300"
            style={{
                border: `1px solid ${hasIssues ? 'color-mix(in srgb, #f59e0b 25%, transparent)' : 'color-mix(in srgb, #22c55e 25%, transparent)'}`,
                background: hasIssues
                    ? 'color-mix(in srgb, #f59e0b 4%, var(--app-surface))'
                    : 'color-mix(in srgb, #22c55e 4%, var(--app-surface))',
            }}>

            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3"
                style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                    borderLeft: `3px solid ${hasIssues ? '#f59e0b' : '#22c55e'}`,
                }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                        background: hasIssues ? 'color-mix(in srgb, #f59e0b 12%, transparent)' : 'color-mix(in srgb, #22c55e 12%, transparent)',
                        color: hasIssues ? '#f59e0b' : '#22c55e',
                    }}>
                    {hasIssues ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-app-foreground">
                        {overall_ok ? 'Tax Engine Healthy' : `${errCount > 0 ? `${errCount} error${errCount > 1 ? 's' : ''}` : ''}${errCount > 0 && warnCount > 0 ? ', ' : ''}${warnCount > 0 ? `${warnCount} warning${warnCount > 1 ? 's' : ''}` : ''}`}
                    </div>
                    <div className="text-[10px] font-bold text-app-muted-foreground">
                        {country_code ? `Country: ${country_code}` : 'Country not configured'} · Tax Health Check
                    </div>
                </div>
                {hasIssues && (
                    <button
                        onClick={onApplyTemplate}
                        disabled={applying}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex-shrink-0 disabled:opacity-60"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        }}>
                        {applying ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                        {applying ? 'Applying...' : 'Apply Template'}
                    </button>
                )}
            </div>

            {/* Indicators grid */}
            <div className="px-4 py-3"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '6px' }}>
                {(indicators || []).map((ind: any) => {
                    const cfg = STATUS_CONFIG[ind.status] || STATUS_CONFIG.info
                    const Ico = cfg.icon
                    return (
                        <div key={ind.key}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
                            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                            <Ico size={12} style={{ color: cfg.color, flexShrink: 0 }} />
                            <div className="min-w-0">
                                <div className="text-[9px] font-black uppercase tracking-widest"
                                    style={{ color: 'var(--app-muted-foreground)' }}>{ind.label}</div>
                                <div className="text-[11px] font-bold text-app-foreground truncate"
                                    title={ind.description}>{ind.description}</div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function TaxPolicyDashboard() {
    const { fmt } = useCurrency()
    const router = useRouter()
    const [focusMode, setFocusMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const searchRef = useRef<HTMLInputElement>(null)

    const [policy, setPolicy] = useState<any>(null)
    const [profiles, setProfiles] = useState<any[]>([])
    const [health, setHealth] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [applying, setApplying] = useState(false)

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
            const [pol, profs, h] = await Promise.all([
                getOrgTaxPolicy(),
                getCounterpartyTaxProfiles(),
                getTaxHealth(),
            ])
            const p = Array.isArray(pol) ? pol[0] : pol?.results?.[0]
            setPolicy(p || null)
            setProfiles(Array.isArray(profs) ? profs : profs?.results || [])
            setHealth(h?.indicators ? h : null)
        } catch (error) {
            toast.error('Failed to load tax policy')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    async function handleApplyTemplate() {
        setApplying(true)
        try {
            const result = await applyCountryTemplate()
            if (result?.success === false) {
                toast.error(result.errors?.[0] || 'Failed to apply template')
            } else {
                toast.success(result?.message || 'Country template applied successfully')
                await loadData()
            }
        } catch {
            toast.error('Failed to apply country template')
        } finally {
            setApplying(false)
        }
    }

    // ── Tabs ──
    const [activeTab, setActiveTab] = useState('setup')
    const TABS = [
        { id: 'setup', label: 'Setup Wizard', icon: Wand2 },
        { id: 'health', label: 'Tax Health', icon: Shield },
        { id: 'policies', label: 'Org Policies', icon: Building2 },
        { id: 'profiles', label: 'Counterparty Profiles', icon: Users },
        { id: 'categories', label: 'Rate Categories', icon: Percent },
    ]

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
                                Universal Tax Engine
                            </h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {policy ? `${policy.name} · ${policy.country_code}` : 'No Active Policy'} · {profiles.length} Profiles
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        {/* Tab Switcher */}
                        <div className="flex items-center p-1 bg-app-surface/50 border border-app-border/40 rounded-2xl">
                            {TABS.map(tab => {
                                const Icon = tab.icon
                                const isActive = activeTab === tab.id
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${isActive
                                                ? 'bg-app-primary text-white shadow-lg'
                                                : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface'
                                            }`}
                                        style={isActive ? { boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' } : {}}
                                    >
                                        <Icon size={13} />
                                        <span className="hidden lg:inline">{tab.label}</span>
                                    </button>
                                )
                            })}
                        </div>

                        <div className="h-6 w-[1px] bg-app-border mx-1 hidden md:block" />

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

            {/* ── Content Area ── */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">

                {/* ── TAB: Setup Wizard ── */}
                {activeTab === 'setup' && (
                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                        <div className="max-w-4xl mx-auto py-8">
                            <div className="flex flex-col items-center text-center mb-10">
                                <div className="w-16 h-16 rounded-[2rem] bg-app-primary flex items-center justify-center text-white mb-6 shadow-2xl">
                                    <Wand2 size={32} />
                                </div>
                                <h2 className="text-2xl font-black text-app-foreground tracking-tight mb-2">Automated Tax Setup</h2>
                                <p className="text-app-muted-foreground max-w-lg">
                                    Apply an official country template to automatically configure your tax policies,
                                    counterparty profiles, and GL account links.
                                </p>
                            </div>

                            <div className="grid md:grid-rows-1 md:grid-cols-2 gap-8 items-stretch">
                                {/* Wizard Card */}
                                <div className="p-8 rounded-[2rem] border border-app-border bg-app-surface shadow-sm flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center gap-2 text-app-primary font-black uppercase tracking-widest text-[10px] mb-4">
                                            <Globe size={12} /> Regional Standards
                                        </div>
                                        <h3 className="text-xl font-bold text-app-foreground mb-4">Template Application</h3>
                                        <p className="text-sm text-app-muted-foreground mb-6 leading-relaxed">
                                            This will seed standard VAT rates (18%, 9%, 0%), configure AIRSI treatments,
                                            and link mandatory tax accounts for <b>{health?.country_code || 'your country'}</b>.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleApplyTemplate}
                                        disabled={applying}
                                        className="w-full h-14 rounded-2xl bg-app-primary hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl disabled:opacity-50"
                                    >
                                        {applying ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                                        {applying ? 'Applying Template...' : 'Initialize Tax Engine'}
                                    </button>
                                </div>

                                {/* Checklist Card */}
                                <div className="p-8 rounded-[2rem] border border-app-border bg-app-surface/30 flex flex-col gap-4">
                                    <h4 className="font-black text-app-foreground uppercase tracking-widest text-[10px]">Setup Checklist</h4>
                                    {(health?.indicators || []).map((ind: any) => {
                                        const isOk = ind.status === 'ok'
                                        return (
                                            <div key={ind.key} className="flex items-center gap-3">
                                                <div className={`w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 ${isOk ? 'bg-app-success/10 text-app-success' : 'bg-app-muted-background text-app-muted-foreground'}`}>
                                                    {isOk ? <CheckCircle2 size={12} /> : <div className="w-1 h-1 rounded-full bg-current" />}
                                                </div>
                                                <span className={`text-[12px] font-bold ${isOk ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>
                                                    {ind.label}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: Tax Health ── */}
                {activeTab === 'health' && (
                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                        {health && <HealthBanner health={health} onApplyTemplate={handleApplyTemplate} applying={applying} />}

                        <div className="mt-6 mb-4">
                            <h3 className="text-sm font-black text-app-foreground uppercase tracking-widest mb-4">Policy Snapshot</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                                {TAX_TYPES.map(tax => {
                                    const Icon = tax.icon
                                    return (
                                        <div key={tax.key}
                                            className="flex flex-col gap-4 p-5 rounded-2xl bg-app-surface border border-app-border/40"
                                            style={{ borderTop: `4px solid ${tax.color}` }}>
                                            <div className="flex items-center justify-between">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                    style={{ background: `color-mix(in srgb, ${tax.color} 12%, transparent)`, color: tax.color }}>
                                                    <Icon size={20} />
                                                </div>
                                                <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">{tax.key} module</div>
                                            </div>
                                            <div>
                                                <div className="text-[11px] font-bold text-app-muted-foreground uppercase mb-1">{tax.label} Status</div>
                                                <div className="text-lg font-black text-app-foreground">{tax.getValue(policy)}</div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TAB: Lists (Org Policies, Profiles, Categories) ── */}
                {['policies', 'profiles', 'categories'].includes(activeTab) && (
                    <div className="animate-in slide-in-from-bottom-2 duration-300">
                        {/* KPI Strip if not in categories */}
                        {activeTab !== 'categories' && kpis.length > 0 && (
                            <div className="mb-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                                {kpis.map(s => (
                                    <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-app-surface border border-app-border/30">
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground">{s.label}</div>
                                            <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Module filtering logic */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                            {MODULE_CARDS
                                .filter(m => {
                                    if (activeTab === 'policies') return m.url.includes('org-tax-policies')
                                    if (activeTab === 'profiles') return m.url.includes('counterparty-tax-profiles')
                                    if (activeTab === 'categories') return m.url.includes('tax-groups') || m.url.includes('custom-tax-rules') || m.url.includes('tax-rate-categories')
                                    return true
                                })
                                .map(card => {
                                    const Icon = card.icon
                                    const stats = card.stats(policy, profiles)
                                    return (
                                        <div key={card.title}
                                            className="group rounded-3xl overflow-hidden transition-all cursor-pointer bg-app-surface border border-app-border hover:border-app-primary hover:shadow-xl hover:-translate-y-0.5"
                                            onClick={() => router.push(card.url)}>
                                            <div className="flex items-center gap-4 px-6 py-5 border-b border-app-border/40">
                                                <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                                                    style={{ background: `color-mix(in srgb, ${card.color} 12%, transparent)`, color: card.color }}>
                                                    <Icon size={24} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-base font-black text-app-foreground">{card.title}</div>
                                                    <div className="text-[11px] font-bold text-app-muted-foreground">{card.subtitle}</div>
                                                </div>
                                                <ChevronRight size={16} className="text-app-muted-foreground group-hover:text-app-primary group-hover:translate-x-1 transition-all" />
                                            </div>
                                            <div className="px-6 py-4 bg-app-surface/30">
                                                <div className="flex items-center gap-6">
                                                    {stats.map(stat => (
                                                        <div key={stat.label}>
                                                            <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">{stat.label}</div>
                                                            <div className="text-sm font-black text-app-foreground tabular-nums">{stat.value}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}

                            {/* NEW: Tax Rate Categories specifically in Categories tab */}
                            {activeTab === 'categories' && (
                                <div className="group rounded-3xl overflow-hidden transition-all cursor-pointer bg-app-surface border border-app-border hover:border-app-primary hover:shadow-xl hover:-translate-y-0.5"
                                    onClick={() => router.push('/finance/tax-rate-categories')}>
                                    <div className="flex items-center gap-4 px-6 py-5 border-b border-app-border/40">
                                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                            <Percent size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-base font-black text-app-foreground">VAT Rate Overrides</div>
                                            <div className="text-[11px] font-bold text-app-muted-foreground">Per-product tax category overrides</div>
                                        </div>
                                        <ChevronRight size={16} className="text-app-muted-foreground group-hover:text-app-primary group-hover:translate-x-1 transition-all" />
                                    </div>
                                    <div className="px-6 py-4 bg-app-surface/30">
                                        <div className="flex items-center gap-6">
                                            <div>
                                                <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Type</div>
                                                <div className="text-sm font-black text-app-foreground">Product Override</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Footer / Quick Links ── */}
            {!focusMode && !searchQuery && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 py-3 border-t border-app-border/40 flex-shrink-0 animate-in fade-in slide-in-from-bottom-1 delay-150">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-widest cursor-pointer hover:text-app-foreground" onClick={() => router.push('/finance/vat-return')}>
                            <FileText size={12} /> VAT Return
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-widest cursor-pointer hover:text-app-foreground" onClick={() => router.push('/finance/vat-settlement')}>
                            <DollarSign size={12} /> Settlement
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-[10px] font-bold text-app-muted-foreground">
                            Engine Version 2.4.0 · Universal Tax Compliance
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
