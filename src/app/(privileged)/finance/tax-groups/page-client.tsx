'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
    Plus, Search, Percent, Star, Trash2, RefreshCw, Edit2,
    Save, X, Loader2, Maximize2, Minimize2, Layers, Globe,
    Download, Shield, Hash, AlertTriangle, ChevronDown
} from 'lucide-react'
import { toast } from 'sonner'

// ══════════════════════════════════════════════════════════════
// Types & Constants
// ══════════════════════════════════════════════════════════════

type TemplateData = {
    country_code: string
    country_name: string
    presets: any[]
    total: number
    imported: number
    message?: string
}

type TaxGroup = {
    id: number
    name: string
    rate: number
    description?: string
    is_default: boolean
    tax_type?: string
}

type FormState = {
    name: string
    rate: string
    description: string
    tax_type: string
}

const EMPTY_FORM: FormState = { name: '', rate: '', description: '', tax_type: 'STANDARD' }

const TAX_TYPES = [
    { value: 'STANDARD', label: 'Standard', color: 'var(--app-success, #22c55e)' },
    { value: 'REDUCED', label: 'Reduced', color: 'var(--app-info, #3b82f6)' },
    { value: 'ZERO', label: 'Zero Rate', color: 'var(--app-muted-foreground)' },
    { value: 'EXEMPT', label: 'Exempt', color: 'var(--app-warning, #f59e0b)' },
    { value: 'REVERSE_CHARGE', label: 'Reverse Charge', color: 'var(--app-accent)' },
]

function getTypeColor(taxType?: string) {
    return TAX_TYPES.find(t => t.value === taxType)?.color || 'var(--app-success, #22c55e)'
}

function getTypeLabel(taxType?: string) {
    return TAX_TYPES.find(t => t.value === taxType)?.label || 'Standard'
}

// ══════════════════════════════════════════════════════════════
// Group Row Component
// ══════════════════════════════════════════════════════════════

function GroupRow({ tg, onEdit, onDelete, onSetDefault, settingDefault, deleting }: {
    tg: TaxGroup
    onEdit: (tg: TaxGroup) => void
    onDelete: (id: number) => void
    onSetDefault: (id: number) => void
    settingDefault: number | null
    deleting: number | null
}) {
    const color = getTypeColor(tg.tax_type)

    return (
        <div
            className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 md:py-3"
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
        >
            {/* Rate Icon Box */}
            <div
                className="w-9 h-9 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                style={{
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    color: color,
                    border: `1px solid color-mix(in srgb, ${color} 20%, transparent)`,
                }}
            >
                <span className="text-[13px] font-black tabular-nums leading-none">
                    {Number(tg.rate).toFixed(0)}
                </span>
                <span className="text-[7px] font-black leading-none mt-0.5">%</span>
            </div>

            {/* Name + Badges */}
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-2.5">
                <span className="truncate text-[13px] font-bold text-app-foreground">
                    {tg.name}
                </span>
                {tg.is_default && (
                    <span
                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                            color: 'var(--app-warning, #f59e0b)',
                            border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)',
                        }}
                    >
                        <Star size={8} fill="currentColor" /> Default
                    </span>
                )}
                <span
                    className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:inline"
                    style={{
                        background: `color-mix(in srgb, ${color} 8%, transparent)`,
                        color: color,
                        border: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
                    }}
                >
                    {getTypeLabel(tg.tax_type)}
                </span>
            </div>

            {/* Rate Column */}
            <div
                className="hidden sm:block w-20 text-right flex-shrink-0 font-mono text-[13px] font-black tabular-nums"
                style={{ color }}
            >
                {Number(tg.rate).toFixed(2)}%
            </div>

            {/* Description Column */}
            <div className="hidden md:block w-40 flex-shrink-0 text-[11px] text-app-muted-foreground font-bold truncate">
                {tg.description || '—'}
            </div>

            {/* Hover Actions */}
            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                {!tg.is_default && (
                    <button
                        onClick={() => onSetDefault(tg.id)}
                        disabled={settingDefault === tg.id}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-warning transition-colors"
                        title="Set as default"
                    >
                        {settingDefault === tg.id
                            ? <RefreshCw size={12} className="animate-spin" />
                            : <Star size={12} />
                        }
                    </button>
                )}
                <button
                    onClick={() => onEdit(tg)}
                    className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"
                    title="Edit"
                >
                    <Edit2 size={12} />
                </button>
                <button
                    onClick={() => onDelete(tg.id)}
                    disabled={deleting === tg.id || tg.is_default}
                    className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors disabled:opacity-30"
                    title={tg.is_default ? 'Cannot delete default' : 'Delete'}
                >
                    {deleting === tg.id
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <Trash2 size={12} />
                    }
                </button>
            </div>
        </div>
    )
}


// ══════════════════════════════════════════════════════════════
// Main Page Component
// ══════════════════════════════════════════════════════════════

export default function TaxGroupsPage() {
    const [groups, setGroups] = useState<TaxGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<TaxGroup | null>(null)
    const [form, setForm] = useState<FormState>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [settingDefault, setSettingDefault] = useState<number | null>(null)
    const [deleting, setDeleting] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const [templateData, setTemplateData] = useState<TemplateData | null>(null)
    const [importing, setImporting] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    // ── Lifecycle ──
    useEffect(() => { load(); loadTemplate() }, [])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault()
                searchRef.current?.focus()
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') {
                e.preventDefault()
                setFocusMode(prev => !prev)
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // ── Data Fetchers ──
    async function load() {
        setLoading(true)
        try {
            const data = await erpFetch('finance/tax-groups/')
            setGroups(Array.isArray(data) ? data : (data?.results ?? []))
        } catch {
            setGroups([])
            toast.error('Failed to load tax groups')
        } finally {
            setLoading(false)
        }
    }

    async function loadTemplate() {
        try {
            const data = await erpFetch('finance/tax-groups/available-templates/')
            if (data && data.presets?.length > 0) setTemplateData(data)
        } catch { /* silently skip — template not available */ }
    }

    async function importFromTemplate() {
        setImporting(true)
        try {
            const res = await erpFetch('finance/tax-groups/import-from-template/', {
                method: 'POST',
                body: JSON.stringify({})
            })
            toast.success(res.message || `${res.created?.length || 0} tax groups imported`)
            load()
            loadTemplate()
        } catch {
            toast.error('Import failed')
        } finally {
            setImporting(false)
        }
    }

    // ── Form Handlers ──
    function startEdit(tg: TaxGroup) {
        setEditing(tg)
        setForm({
            name: tg.name,
            rate: String(tg.rate),
            description: tg.description || '',
            tax_type: tg.tax_type || 'STANDARD',
        })
        setShowForm(true)
    }

    function startCreate() {
        setEditing(null)
        setForm(EMPTY_FORM)
        setShowForm(true)
    }

    function cancelForm() {
        setShowForm(false)
        setEditing(null)
        setForm(EMPTY_FORM)
    }

    async function handleSave() {
        if (!form.name || !form.rate) return

        // Client-side duplicate rate pre-check
        const parsedRate = parseFloat(form.rate)
        const duplicate = groups.find(g =>
            Number(g.rate).toFixed(2) === parsedRate.toFixed(2) &&
            g.id !== editing?.id
        )
        if (duplicate) {
            toast.error(
                `Rate ${parsedRate.toFixed(2)}% already exists: "${duplicate.name}". Each rate must be unique.`
            )
            return
        }

        setSaving(true)
        try {
            const body = {
                name: form.name,
                rate: parsedRate,
                description: form.description,
                tax_type: form.tax_type,
            }
            if (editing) {
                await erpFetch(`finance/tax-groups/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(body) })
                toast.success('Tax group updated')
            } else {
                await erpFetch('finance/tax-groups/', { method: 'POST', body: JSON.stringify(body) })
                toast.success('Tax group created')
            }
            cancelForm()
            load()
        } catch (err: any) {
            // Extract server validation message
            const msg = err?.rate?.[0] || err?.detail || err?.non_field_errors?.[0]
                || (typeof err === 'string' ? err : 'Save failed — duplicate rate or name')
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleSetDefault(id: number) {
        setSettingDefault(id)
        try {
            await erpFetch('finance/tax-groups/set_default/', { method: 'POST', body: JSON.stringify({ tax_group_id: id }) })
            toast.success('Default tax group updated')
            load()
        } catch {
            toast.error('Failed to set default')
        } finally {
            setSettingDefault(null)
        }
    }

    async function handleDelete(id: number) {
        setDeleting(id)
        try {
            await erpFetch(`finance/tax-groups/${id}/`, { method: 'DELETE' })
            toast.success('Tax group deleted')
            load()
        } catch {
            toast.error('Delete failed — may be in use')
        } finally {
            setDeleting(null)
        }
    }

    // ── Computed Data ──
    const { filtered, stats, duplicateRates } = useMemo(() => {
        let f = groups
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            f = f.filter(g =>
                g.name?.toLowerCase().includes(q) ||
                g.tax_type?.toLowerCase().includes(q) ||
                g.description?.toLowerCase().includes(q)
            )
        }
        const total = groups.length
        const avg = total ? groups.reduce((s, g) => s + Number(g.rate || 0), 0) / total : 0
        const def = groups.find(g => g.is_default)?.name || 'None'
        const types = new Set(groups.map(g => g.tax_type || 'STANDARD')).size

        // Detect duplicate rates
        const rateMap = new Map<string, TaxGroup[]>()
        for (const g of groups) {
            const key = Number(g.rate).toFixed(2)
            const arr = rateMap.get(key) || []
            arr.push(g)
            rateMap.set(key, arr)
        }
        const duplicateRates: { rate: string; groups: TaxGroup[] }[] = []
        for (const [rate, grps] of rateMap) {
            if (grps.length > 1) duplicateRates.push({ rate, groups: grps })
        }

        return { filtered: f, stats: { total, avg, def, filtered: f.length, types }, duplicateRates }
    }, [groups, searchQuery])

    const canImport = templateData && templateData.presets?.some((p: any) => !p.already_imported)

    // ── KPI Data ──
    const kpis = [
        { label: 'Total Groups', value: stats.total, color: 'var(--app-primary)', icon: <Percent size={11} /> },
        { label: 'Average Rate', value: `${stats.avg.toFixed(1)}%`, color: 'var(--app-info, #3b82f6)', icon: <Hash size={11} /> },
        { label: 'Default', value: stats.def, color: 'var(--app-warning, #f59e0b)', icon: <Star size={11} /> },
        { label: 'Tax Types', value: stats.types, color: 'var(--app-accent)', icon: <Shield size={11} /> },
        { label: 'Showing', value: stats.filtered, color: 'var(--app-success, #22c55e)', icon: <Layers size={11} /> },
    ]

    // ══════════════════════════════════════════════════════════
    // Render
    // ══════════════════════════════════════════════════════════

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {/* ── Focus Mode Header ── */}
                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                                <Percent size={14} className="text-white" />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Tax Groups</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{stats.filtered}/{stats.total}</span>
                        </div>
                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={startCreate}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0"
                        >
                            <Plus size={12} />
                            <span className="hidden sm:inline">New</span>
                        </button>
                        <button
                            onClick={() => setFocusMode(false)}
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0"
                        >
                            <Minimize2 size={13} />
                        </button>
                    </div>

                ) : (<>

                    {/* ── Full Header ── */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div
                                className="page-header-icon bg-app-primary"
                                style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}
                            >
                                <Percent size={20} className="text-white" />
                            </div>
                            <div>
                                <h1>
                                    Tax Groups
                                </h1>
                                <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                    {stats.total} Groups · Average {stats.avg.toFixed(1)}% · Default: {stats.def}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <button
                                onClick={load}
                                className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            >
                                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                                <span className="hidden md:inline">Refresh</span>
                            </button>
                            <button
                                onClick={startCreate}
                                className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                            >
                                <Plus size={14} />
                                <span className="hidden sm:inline">New Group</span>
                            </button>
                            <button
                                onClick={() => setFocusMode(true)}
                                className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                            >
                                <Maximize2 size={13} />
                            </button>
                        </div>
                    </div>

                    {/* ── KPI Strip ── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        {kpis.map(s => (
                            <div
                                key={s.label}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}
                            >
                                <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{
                                        background: `color-mix(in srgb, ${s.color} 10%, transparent)`,
                                        color: s.color,
                                    }}
                                >
                                    {s.icon}
                                </div>
                                <div className="min-w-0">
                                    <div
                                        className="text-[10px] font-bold uppercase tracking-wider"
                                        style={{ color: 'var(--app-muted-foreground)' }}
                                    >
                                        {s.label}
                                    </div>
                                    <div className="text-sm font-black text-app-foreground tabular-nums truncate">
                                        {s.value}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ── Search Bar ── */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search tax groups by name, type, description... (Ctrl+K)"
                                className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                            />
                        </div>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{
                                    color: 'var(--app-error)',
                                    borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)',
                                    background: 'color-mix(in srgb, var(--app-error) 5%, transparent)',
                                }}
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* ── Duplicate Rate Warning ── */}
                    {duplicateRates.length > 0 && (
                        <div
                            className="px-3 py-2.5 rounded-xl animate-in slide-in-from-top-2 duration-300"
                            style={{
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, var(--app-surface))',
                                border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)',
                            }}
                        >
                            <div className="flex items-center gap-2 mb-1.5">
                                <div
                                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)',
                                        color: 'var(--app-warning, #f59e0b)',
                                    }}
                                >
                                    <AlertTriangle size={12} />
                                </div>
                                <span className="text-[11px] font-bold text-app-foreground">
                                    Duplicate rates detected — {duplicateRates.length} rate{duplicateRates.length > 1 ? 's' : ''} shared by multiple groups
                                </span>
                            </div>
                            <div className="ml-8 space-y-1">
                                {duplicateRates.map(d => (
                                    <div key={d.rate} className="flex items-center gap-2 text-[10px]">
                                        <span className="font-mono font-black tabular-nums" style={{ color: 'var(--app-warning, #f59e0b)' }}>{d.rate}%</span>
                                        <span className="text-app-muted-foreground">→</span>
                                        {d.groups.map((g, i) => (
                                            <span key={g.id} className="inline-flex items-center gap-1">
                                                <span className="font-bold text-app-foreground">{g.name}</span>
                                                {!g.is_default && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(g.id) }}
                                                        className="text-app-muted-foreground hover:text-app-error transition-colors p-0.5 rounded"
                                                        title={`Delete ${g.name}`}
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                )}
                                                {i < d.groups.length - 1 && <span className="text-app-muted-foreground mx-0.5">·</span>}
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Template Import Banner ── */}
                    {canImport && (
                        <div
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl animate-in slide-in-from-top-2 duration-300"
                            style={{
                                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, var(--app-surface))',
                                border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
                            }}
                        >
                            <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',
                                    color: 'var(--app-info, #3b82f6)',
                                }}
                            >
                                <Globe size={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-bold text-app-foreground">
                                    {templateData!.country_name} template available
                                </span>
                                <span className="text-[10px] font-bold text-app-muted-foreground ml-2">
                                    — {templateData!.presets.filter((p: any) => !p.already_imported).length} of {templateData!.total} groups ready to import
                                </span>
                            </div>
                            <button
                                onClick={importFromTemplate}
                                disabled={importing}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all flex-shrink-0"
                                style={{
                                    background: 'var(--app-info, #3b82f6)',
                                    color: 'white',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
                                }}
                            >
                                {importing ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                                {importing ? 'Importing...' : 'Apply Template'}
                            </button>
                        </div>
                    )}
                </>)}
            </div>

            {/* ══════════════════════════════════════════════════════ */}
            {/* Inline Create / Edit Form                            */}
            {/* ══════════════════════════════════════════════════════ */}
            {showForm && (
                <div
                    className="flex-shrink-0 mb-3 p-4 border rounded-2xl animate-in slide-in-from-top-2 duration-200"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                        borderColor: 'var(--app-border)',
                        borderLeft: '3px solid var(--app-primary)',
                    }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="uppercase">
                            {editing ? 'Edit Tax Group' : 'Create Tax Group'}
                        </h3>
                        <button
                            onClick={cancelForm}
                            className="p-1 hover:bg-app-border/50 rounded-lg transition-colors"
                        >
                            <X size={14} className="text-app-muted-foreground" />
                        </button>
                    </div>
                    <form
                        onSubmit={e => { e.preventDefault(); handleSave() }}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                            gap: '8px',
                            alignItems: 'end',
                        }}
                    >
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                                Name
                            </label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. TVA Normal (18%)"
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                                Rate (%)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.rate}
                                onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                                placeholder="18.00"
                                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                                Type
                            </label>
                            <select
                                value={form.tax_type}
                                onChange={e => setForm(f => ({ ...f, tax_type: e.target.value }))}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"
                            >
                                {TAX_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                                Description
                            </label>
                            <input
                                value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Optional description..."
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={saving || !form.name || !form.rate}
                            className="flex items-center justify-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                        >
                            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                            {editing ? 'Save Changes' : 'Create Group'}
                        </button>
                    </form>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════ */}
            {/* Table Container                                       */}
            {/* ══════════════════════════════════════════════════════ */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">

                {/* Column Headers */}
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-9 flex-shrink-0" /> {/* Icon spacer */}
                    <div className="flex-1 min-w-0">Group</div>
                    <div className="hidden sm:block w-20 text-right flex-shrink-0">Rate</div>
                    <div className="hidden md:block w-40 flex-shrink-0">Description</div>
                    <div className="w-24 flex-shrink-0" /> {/* Actions spacer */}
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-app-primary" />
                        </div>
                    ) : filtered.length > 0 ? (
                        filtered.map(tg => (
                            <GroupRow
                                key={tg.id}
                                tg={tg}
                                onEdit={startEdit}
                                onDelete={handleDelete}
                                onSetDefault={handleSetDefault}
                                settingDefault={settingDefault}
                                deleting={deleting}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <Percent size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No tax groups found</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1 font-bold">
                                {searchQuery
                                    ? 'Try a different search term.'
                                    : canImport
                                        ? 'Apply the country template above to get started.'
                                        : 'Create your first tax group to get started.'
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
