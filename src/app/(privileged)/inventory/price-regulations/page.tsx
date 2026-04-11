'use client'

import { useEffect, useState, useCallback } from 'react'
import {
    listRegulations, createRegulation, updateRegulation, deleteRegulation,
    getComplianceSummary, runBulkCheck, createNewVersion,
    listRules, createRule, deleteRule,
    listAuditLogs,
} from '@/app/actions/compliance/regulations'
import {
    Scale, Plus, Edit2, Trash2, Shield, ShieldCheck, ShieldAlert,
    AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown,
    Clock, FileText, Eye, Layers, Filter, RefreshCw, Zap,
    Globe, ChevronDown, ChevronUp, History, Activity,
    Package, BarChart3, Gavel, Archive, Settings2,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──
interface Regulation {
    id: number
    name: string
    code: string
    description: string
    regulation_type: string
    fixed_price: string | null
    max_price: string | null
    min_price: string | null
    currency_code: string
    tolerance: string
    scope: string
    severity: string
    auto_correct: boolean
    allow_override: boolean
    reference: string
    authority: string
    effective_date: string
    expiry_date: string | null
    jurisdiction_country_name: string
    jurisdiction_country_iso2: string
    jurisdiction_region: string
    version: number
    is_current: boolean
    status: string
    rules_count: number
    products_count: number
    violations_count: number
    created_at: string
}

interface Summary {
    total_regulations: number
    active_regulations: number
    total_regulated_products: number
    compliant_products: number
    violating_products: number
    compliance_rate: number
    expiring_soon: number
}

interface AuditEntry {
    id: number
    action: string
    action_display: string
    username: string
    product_sku: string
    product_name: string
    regulation_code: string
    old_price: string | null
    new_price: string | null
    regulated_price: string | null
    violation_amount: string | null
    currency_code: string
    source_display: string
    timestamp: string
}

// ── Config Maps ──
const TYPE_CONFIG: Record<string, { label: string; icon: any; bg: string; fg: string }> = {
    FIXED: { label: 'Fixed', icon: Gavel, bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' },
    MAX: { label: 'Maximum', icon: TrendingUp, bg: 'rgba(251,191,36,0.1)', fg: '#f59e0b' },
    MIN: { label: 'Minimum', icon: TrendingDown, bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6' },
    RANGE: { label: 'Range', icon: Layers, bg: 'rgba(139,92,246,0.1)', fg: '#8b5cf6' },
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    DRAFT: { label: 'Draft', bg: 'rgba(107,114,128,0.12)', fg: 'var(--app-muted-foreground)' },
    ACTIVE: { label: 'Active', bg: 'rgba(34,197,94,0.12)', fg: 'var(--app-success)' },
    EXPIRED: { label: 'Expired', bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' },
    SUSPENDED: { label: 'Suspended', bg: 'rgba(251,191,36,0.1)', fg: '#f59e0b' },
}

const SEVERITY_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
    BLOCKING: { label: 'Blocking', bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' },
    WARNING: { label: 'Warning', bg: 'rgba(251,191,36,0.1)', fg: '#f59e0b' },
}

type TabKey = 'regulations' | 'audit'

export default function PriceRegulationsPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('regulations')
    const [regulations, setRegulations] = useState<Regulation[]>([])
    const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Regulation | null>(null)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [bulkRunning, setBulkRunning] = useState(false)
    const [statusFilter, setStatusFilter] = useState<string>('ALL')

    const [form, setForm] = useState({
        name: '', code: '', description: '',
        regulation_type: 'MAX', fixed_price: '', max_price: '', min_price: '',
        currency: '', tolerance: '0', scope: 'BOTH', severity: 'BLOCKING',
        allow_override: false, auto_correct: false,
        reference: '', authority: '',
        effective_date: '', expiry_date: '',
        jurisdiction_country: '', jurisdiction_region: '',
        status: 'DRAFT',
    })

    const loadData = useCallback(async () => {
        try {
            setLoading(true)
            const [regs, summ] = await Promise.all([
                listRegulations(statusFilter !== 'ALL' ? { status: statusFilter } : undefined),
                getComplianceSummary(),
            ])
            setRegulations(Array.isArray(regs) ? regs : (regs?.results || []))
            setSummary(summ)
        } catch (e: any) {
            toast.error(e.message || 'Failed to load data')
        } finally {
            setLoading(false)
        }
    }, [statusFilter])

    useEffect(() => { loadData() }, [loadData])

    async function loadAuditLogs() {
        try {
            const data = await listAuditLogs()
            setAuditLogs(Array.isArray(data) ? data : (data?.results || []))
        } catch (e: any) {
            toast.error(e.message || 'Failed to load audit log')
        }
    }

    useEffect(() => {
        if (activeTab === 'audit') loadAuditLogs()
    }, [activeTab])

    function resetForm() {
        setForm({
            name: '', code: '', description: '',
            regulation_type: 'MAX', fixed_price: '', max_price: '', min_price: '',
            currency: '', tolerance: '0', scope: 'BOTH', severity: 'BLOCKING',
            allow_override: false, auto_correct: false,
            reference: '', authority: '',
            effective_date: '', expiry_date: '',
            jurisdiction_country: '', jurisdiction_region: '',
            status: 'DRAFT',
        })
        setEditing(null)
        setShowForm(false)
    }

    function startEdit(r: Regulation) {
        setForm({
            name: r.name, code: r.code, description: r.description,
            regulation_type: r.regulation_type,
            fixed_price: r.fixed_price || '', max_price: r.max_price || '', min_price: r.min_price || '',
            currency: '', tolerance: r.tolerance || '0',
            scope: r.scope, severity: r.severity,
            allow_override: r.allow_override, auto_correct: r.auto_correct,
            reference: r.reference || '', authority: r.authority || '',
            effective_date: r.effective_date || '', expiry_date: r.expiry_date || '',
            jurisdiction_country: '', jurisdiction_region: r.jurisdiction_region || '',
            status: r.status,
        })
        setEditing(r)
        setShowForm(true)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.name.trim() || !form.code.trim()) { toast.error('Name and Code are required'); return }
        if (!form.effective_date) { toast.error('Effective date is required'); return }

        const payload: Record<string, any> = {
            name: form.name, code: form.code, description: form.description,
            regulation_type: form.regulation_type,
            tolerance: parseFloat(form.tolerance) || 0,
            scope: form.scope, severity: form.severity,
            allow_override: form.allow_override, auto_correct: form.auto_correct,
            reference: form.reference, authority: form.authority,
            effective_date: form.effective_date,
            expiry_date: form.expiry_date || null,
            jurisdiction_region: form.jurisdiction_region,
            status: form.status,
        }

        if (form.regulation_type === 'FIXED') payload.fixed_price = parseFloat(form.fixed_price) || null
        if (['MAX', 'RANGE'].includes(form.regulation_type)) payload.max_price = parseFloat(form.max_price) || null
        if (['MIN', 'RANGE'].includes(form.regulation_type)) payload.min_price = parseFloat(form.min_price) || null

        try {
            if (editing) {
                await updateRegulation(editing.id, payload)
                toast.success('Regulation updated')
            } else {
                await createRegulation(payload)
                toast.success('Regulation created')
            }
            resetForm()
            loadData()
        } catch (e: any) {
            toast.error(e.message || 'Failed to save regulation')
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this price regulation?')) return
        try {
            await deleteRegulation(id)
            toast.success('Regulation deleted')
            loadData()
        } catch (e: any) {
            toast.error(e.message || 'Failed to delete')
        }
    }

    async function handleBulkCheck(autoFix: boolean) {
        setBulkRunning(true)
        try {
            const result = await runBulkCheck(autoFix)
            toast.success(
                `Checked ${result.total_checked} products. ` +
                `${result.violations_found} violations found. ` +
                (autoFix ? `${result.auto_fixed} auto-fixed.` : '')
            )
            loadData()
        } catch (e: any) {
            toast.error(e.message || 'Bulk check failed')
        } finally {
            setBulkRunning(false)
        }
    }

    // ── Summary Cards ──
    function SummaryCards() {
        if (!summary) return null
        const cards = [
            { label: 'Active Regulations', value: summary.active_regulations, icon: Scale, color: 'var(--app-primary)' },
            { label: 'Regulated Products', value: summary.total_regulated_products, icon: Package, color: '#8b5cf6' },
            { label: 'Compliant', value: summary.compliant_products, icon: CheckCircle2, color: 'var(--app-success)' },
            { label: 'Violations', value: summary.violating_products, icon: ShieldAlert, color: '#ef4444' },
            { label: 'Compliance Rate', value: `${summary.compliance_rate}%`, icon: BarChart3, color: '#3b82f6' },
            { label: 'Expiring Soon', value: summary.expiring_soon, icon: Clock, color: '#f59e0b' },
        ]
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
                {cards.map((c, i) => {
                    const Icon = c.icon
                    return (
                        <div key={i} className="rounded-xl p-3 transition-all hover:scale-[1.02]"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: `color-mix(in srgb, ${c.color} 12%, transparent)` }}>
                                    <Icon size={14} style={{ color: c.color }} />
                                </div>
                            </div>
                            <div className="text-xl font-black" style={{ color: c.color }}>{c.value}</div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground">{c.label}</div>
                        </div>
                    )
                })}
            </div>
        )
    }

    // ── Tab Bar ──
    function TabBar() {
        const tabs: { key: TabKey; label: string; icon: any; count?: number }[] = [
            { key: 'regulations', label: 'Regulations', icon: Scale, count: regulations.length },
            { key: 'audit', label: 'Audit Trail', icon: History, count: auditLogs.length },
        ]
        return (
            <div className="flex items-center gap-1 mb-5 rounded-xl p-1"
                style={{ background: 'var(--app-muted)' }}>
                {tabs.map(t => {
                    const Icon = t.icon
                    const active = activeTab === t.key
                    return (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                            style={{
                                background: active ? 'var(--app-surface)' : 'transparent',
                                color: active ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                                boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            }}>
                            <Icon size={14} />
                            {t.label}
                            {typeof t.count === 'number' && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                                    style={{ background: active ? 'var(--app-primary)' : 'var(--app-border)', color: active ? 'white' : 'var(--app-muted-foreground)' }}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        )
    }

    // ── Regulation Card ──
    function RegulationCard({ r }: { r: Regulation }) {
        const typeCfg = TYPE_CONFIG[r.regulation_type] || TYPE_CONFIG.MAX
        const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.DRAFT
        const severityCfg = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.BLOCKING
        const TypeIcon = typeCfg.icon
        const expanded = expandedId === r.id

        const priceDisplay = () => {
            switch (r.regulation_type) {
                case 'FIXED': return `${r.currency_code} ${Number(r.fixed_price).toLocaleString()}`
                case 'MAX': return `≤ ${r.currency_code} ${Number(r.max_price).toLocaleString()}`
                case 'MIN': return `≥ ${r.currency_code} ${Number(r.min_price).toLocaleString()}`
                case 'RANGE': return `${r.currency_code} ${Number(r.min_price).toLocaleString()} — ${Number(r.max_price).toLocaleString()}`
                default: return '—'
            }
        }

        return (
            <div className="rounded-xl transition-all" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                {/* Main Row */}
                <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expanded ? null : r.id)}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Type Icon */}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: typeCfg.bg }}>
                            <TypeIcon size={18} style={{ color: typeCfg.fg }} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-app-foreground">{r.name}</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                                    style={{ background: 'var(--app-muted)', color: 'var(--app-muted-foreground)' }}>
                                    {r.code}
                                </span>
                                {r.version > 1 && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                                        style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>
                                        v{r.version}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {/* Status */}
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase"
                                    style={{ background: statusCfg.bg, color: statusCfg.fg }}>
                                    {statusCfg.label}
                                </span>
                                {/* Type */}
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                                    style={{ background: typeCfg.bg, color: typeCfg.fg }}>
                                    {typeCfg.label}
                                </span>
                                {/* Severity */}
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                                    style={{ background: severityCfg.bg, color: severityCfg.fg }}>
                                    {severityCfg.label}
                                </span>
                                {/* Country */}
                                {r.jurisdiction_country_name && (
                                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium"
                                        style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)' }}>
                                        <Globe size={9} /> {r.jurisdiction_country_iso2 || r.jurisdiction_country_name}
                                    </span>
                                )}
                                {r.auto_correct && (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                                        style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--app-success)' }}>
                                        ⚡ Auto-fix
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Right: Price + Stats */}
                    <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                            <div className="text-lg font-black" style={{ color: typeCfg.fg }}>{priceDisplay()}</div>
                            <div className="text-[10px] text-app-muted-foreground">
                                {r.products_count} products · {r.violations_count > 0
                                    ? <span style={{ color: '#ef4444' }}>{r.violations_count} violations</span>
                                    : <span style={{ color: 'var(--app-success)' }}>✓ All compliant</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); startEdit(r) }}
                                className="p-2 rounded-lg transition-all hover:scale-110 text-app-muted-foreground hover:text-app-foreground"
                                title="Edit">
                                <Edit2 size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
                                className="p-2 rounded-lg transition-all hover:scale-110"
                                style={{ color: '#ef4444' }} title="Delete">
                                <Trash2 size={14} />
                            </button>
                            {expanded ? <ChevronUp size={16} className="text-app-muted-foreground" />
                                : <ChevronDown size={16} className="text-app-muted-foreground" />}
                        </div>
                    </div>
                </div>

                {/* Expanded Details */}
                {expanded && (
                    <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: 'var(--app-border)' }}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                            <DetailItem label="Authority" value={r.authority || '—'} />
                            <DetailItem label="Reference" value={r.reference || '—'} />
                            <DetailItem label="Effective" value={r.effective_date} />
                            <DetailItem label="Expiry" value={r.expiry_date || 'Indefinite'} />
                            <DetailItem label="Scope" value={r.scope} />
                            <DetailItem label="Tolerance" value={`${r.currency_code} ${r.tolerance}`} />
                            <DetailItem label="Override Allowed" value={r.allow_override ? 'Yes' : 'No'} />
                            <DetailItem label="Rules" value={String(r.rules_count)} />
                        </div>
                        {r.description && (
                            <p className="text-xs text-app-muted-foreground mt-3 leading-relaxed">{r.description}</p>
                        )}
                    </div>
                )}
            </div>
        )
    }

    function DetailItem({ label, value }: { label: string; value: string }) {
        return (
            <div>
                <div className="text-[9px] font-bold uppercase tracking-wider text-app-muted-foreground mb-0.5">{label}</div>
                <div className="text-xs font-bold text-app-foreground">{value}</div>
            </div>
        )
    }

    // ── Audit Row ──
    function AuditRow({ entry }: { entry: AuditEntry }) {
        const isViolation = entry.action.includes('VIOLATION') || entry.action.includes('BLOCK')
        const isFix = entry.action.includes('FIX') || entry.action.includes('CLAMP')
        return (
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg transition-all hover:bg-app-muted/30"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: isViolation ? 'rgba(239,68,68,0.1)' : isFix ? 'rgba(34,197,94,0.1)' : 'var(--app-muted)' }}>
                    {isViolation ? <ShieldAlert size={13} style={{ color: '#ef4444' }} />
                        : isFix ? <CheckCircle2 size={13} style={{ color: 'var(--app-success)' }} />
                            : <Activity size={13} className="text-app-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-app-foreground truncate">{entry.action_display}</div>
                    <div className="text-[10px] text-app-muted-foreground truncate">
                        {entry.product_name || entry.product_sku} · {entry.regulation_code}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    {entry.violation_amount && (
                        <div className="text-xs font-bold" style={{ color: Number(entry.violation_amount) > 0 ? '#ef4444' : '#3b82f6' }}>
                            {Number(entry.violation_amount) > 0 ? '+' : ''}{entry.violation_amount} {entry.currency_code}
                        </div>
                    )}
                    <div className="text-[9px] text-app-muted-foreground">
                        {entry.username && `${entry.username} · `}
                        {new Date(entry.timestamp).toLocaleDateString()}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all max-h-[calc(100vh-8rem)]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Scale size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Price Regulations</h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            Government Compliance · {regulations.length} Regulations
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Bulk Check */}
                    <button onClick={() => handleBulkCheck(false)}
                        disabled={bulkRunning}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105"
                        style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)' }}>
                        <RefreshCw size={13} className={bulkRunning ? 'animate-spin' : ''} />
                        Check All
                    </button>
                    <button onClick={() => handleBulkCheck(true)}
                        disabled={bulkRunning}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105"
                        style={{ background: 'var(--app-success)' }}>
                        <Zap size={13} />
                        Fix All
                    </button>
                    <button onClick={() => { resetForm(); setShowForm(!showForm) }}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:scale-105"
                        style={{ background: showForm ? 'var(--app-muted-foreground)' : 'var(--app-primary)' }}>
                        {showForm ? <ChevronUp size={14} /> : <Plus size={14} />}
                        {showForm ? 'Cancel' : 'Add Regulation'}
                    </button>
                </div>
            </div>

            {/* Summary */}
            <SummaryCards />

            {/* Tabs */}
            <TabBar />

            {/* Status Filter (for regulations tab) */}
            {activeTab === 'regulations' && (
                <div className="flex items-center gap-2 mb-4">
                    <Filter size={13} className="text-app-muted-foreground" />
                    {['ALL', 'ACTIVE', 'DRAFT', 'EXPIRED', 'SUSPENDED'].map(s => (
                        <button key={s} onClick={() => setStatusFilter(s)}
                            className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all"
                            style={{
                                background: statusFilter === s ? 'var(--app-primary)' : 'var(--app-muted)',
                                color: statusFilter === s ? 'white' : 'var(--app-muted-foreground)',
                            }}>
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Add/Edit Form */}
            {showForm && (
                <form onSubmit={handleSubmit} className="rounded-xl p-5 mb-5 space-y-4"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <h3 className="text-sm font-bold text-app-foreground mb-3">
                        {editing ? `Edit: ${editing.name}` : 'New Price Regulation'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <FormField label="Name" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="e.g. Cooking Oil Max Price" />
                        <FormField label="Code" value={form.code} onChange={v => setForm({ ...form, code: v })} placeholder="REG-CI-2026-042" />
                        <FormSelect label="Type" value={form.regulation_type} onChange={v => setForm({ ...form, regulation_type: v })}
                            options={[['FIXED', 'Fixed Price'], ['MAX', 'Maximum Price'], ['MIN', 'Minimum Price'], ['RANGE', 'Price Range']]} />
                        <FormSelect label="Status" value={form.status} onChange={v => setForm({ ...form, status: v })}
                            options={[['DRAFT', 'Draft'], ['ACTIVE', 'Active'], ['SUSPENDED', 'Suspended']]} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {['FIXED'].includes(form.regulation_type) && (
                            <FormField label="Fixed Price" value={form.fixed_price} type="number" onChange={v => setForm({ ...form, fixed_price: v })} placeholder="0.00" />
                        )}
                        {['MAX', 'RANGE'].includes(form.regulation_type) && (
                            <FormField label="Max Price" value={form.max_price} type="number" onChange={v => setForm({ ...form, max_price: v })} placeholder="0.00" />
                        )}
                        {['MIN', 'RANGE'].includes(form.regulation_type) && (
                            <FormField label="Min Price" value={form.min_price} type="number" onChange={v => setForm({ ...form, min_price: v })} placeholder="0.00" />
                        )}
                        <FormField label="Tolerance" value={form.tolerance} type="number" onChange={v => setForm({ ...form, tolerance: v })} placeholder="0.00" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <FormSelect label="Severity" value={form.severity} onChange={v => setForm({ ...form, severity: v })}
                            options={[['BLOCKING', 'Blocking — Hard Block'], ['WARNING', 'Warning — Soft Alert']]} />
                        <FormSelect label="Scope" value={form.scope} onChange={v => setForm({ ...form, scope: v })}
                            options={[['BOTH', 'Both'], ['OFFICIAL', 'Official Only'], ['INTERNAL', 'Internal Only']]} />
                        <FormField label="Effective Date" value={form.effective_date} type="date" onChange={v => setForm({ ...form, effective_date: v })} />
                        <FormField label="Expiry Date" value={form.expiry_date} type="date" onChange={v => setForm({ ...form, expiry_date: v })} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <FormField label="Authority" value={form.authority} onChange={v => setForm({ ...form, authority: v })} placeholder="Ministry of Commerce" />
                        <FormField label="Legal Reference" value={form.reference} onChange={v => setForm({ ...form, reference: v })} placeholder="Decree #2026-042" />
                        <FormField label="Region" value={form.jurisdiction_region} onChange={v => setForm({ ...form, jurisdiction_region: v })} placeholder="(empty = whole country)" />
                        <div className="flex items-center gap-4 mt-5">
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" checked={form.auto_correct} onChange={e => setForm({ ...form, auto_correct: e.target.checked })}
                                    className="rounded" />
                                <span className="font-bold text-app-foreground">Auto-fix</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                                <input type="checkbox" checked={form.allow_override} onChange={e => setForm({ ...form, allow_override: e.target.checked })}
                                    className="rounded" />
                                <span className="font-bold text-app-foreground">Allow Override</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg text-xs font-medium text-app-muted-foreground"
                            style={{ background: 'var(--app-muted)' }}>Cancel</button>
                        <button type="submit" className="px-5 py-2 rounded-lg text-xs font-bold text-white"
                            style={{ background: 'var(--app-primary)' }}>
                            {editing ? 'Update Regulation' : 'Create Regulation'}
                        </button>
                    </div>
                </form>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
                    </div>
                ) : activeTab === 'regulations' ? (
                    regulations.length === 0 ? (
                        <div className="text-center py-20 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <Scale size={40} className="mx-auto mb-3 text-app-muted-foreground opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No price regulations configured</p>
                            <p className="text-xs text-app-muted-foreground mt-1">
                                Create a regulation to enforce government pricing on your products
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {regulations.map(r => <RegulationCard key={r.id} r={r} />)}
                        </div>
                    )
                ) : activeTab === 'audit' ? (
                    auditLogs.length === 0 ? (
                        <div className="text-center py-20 rounded-xl" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <History size={40} className="mx-auto mb-3 text-app-muted-foreground opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No audit entries yet</p>
                            <p className="text-xs text-app-muted-foreground mt-1">
                                Compliance actions will appear here as they occur
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            {auditLogs.map(e => <AuditRow key={e.id} entry={e} />)}
                        </div>
                    )
                ) : null}
            </div>
        </div>
    )
}

// ── Reusable Form Components ──
function FormField({ label, value, onChange, placeholder, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
    return (
        <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                step={type === 'number' ? '0.01' : undefined}
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }} />
        </div>
    )
}

function FormSelect({ label, value, onChange, options }: {
    label: string; value: string; onChange: (v: string) => void; options: [string, string][]
}) {
    return (
        <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-xs"
                style={{ background: 'var(--app-muted)', color: 'var(--app-foreground)', border: '1px solid var(--app-border)' }}>
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
        </div>
    )
}
