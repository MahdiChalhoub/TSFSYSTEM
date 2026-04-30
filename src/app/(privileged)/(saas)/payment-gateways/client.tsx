'use client'

import { useState, useMemo, useTransition } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    CreditCard, Search, ArrowLeft, X, Check,
    Globe, Filter, ExternalLink, Layers, Eye, EyeOff,
    Building2, MapPin, Lock, Settings2, Plus, Pencil, Trash2, Power,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    deleteRefPaymentGateway, toggleRefPaymentGateway,
} from '@/app/actions/reference'
import { runTimed } from '@/lib/perf-timing'
import { GatewayEditorDialog } from './GatewayEditorDialog'

/* ── Input styles ── */
const inputCls = "w-full text-[12px] font-bold px-3 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 transition-all"

export default function PaymentGatewaysClient({ allGateways, initialOrgGateways }: {
    allGateways: any[]
    initialOrgGateways: any[]
}) {
    const router = useRouter()
    const [, startTransition] = useTransition()
    const [search, setSearch] = useState('')
    const [familyFilter, setFamilyFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('')
    const [expanded, setExpanded] = useState<number | null>(null)
    const [editorOpen, setEditorOpen] = useState(false)
    const [editorTarget, setEditorTarget] = useState<any | null>(null)
    const [pendingDelete, setPendingDelete] = useState<any | null>(null)

    function openCreate() {
        setEditorTarget(null)
        setEditorOpen(true)
    }
    function openEdit(gw: any) {
        setEditorTarget(gw)
        setEditorOpen(true)
    }
    async function handleToggle(gw: any) {
        const res = await runTimed(
            'saas.payment-gateways:toggle-active',
            () => toggleRefPaymentGateway(gw.id),
        )
        if (res.success) {
            toast.success(`${gw.name} ${gw.is_active ? 'deactivated' : 'activated'}`)
            startTransition(() => router.refresh())
        } else {
            toast.error(res.error || 'Failed to toggle')
        }
    }
    async function handleConfirmDelete() {
        if (!pendingDelete) return
        const target = pendingDelete
        setPendingDelete(null)
        const res = await runTimed(
            'saas.payment-gateways:delete',
            () => deleteRefPaymentGateway(target.id),
        )
        if (res.success) {
            toast.success(`${target.name} removed`)
            startTransition(() => router.refresh())
        } else {
            toast.error(res.error || 'Failed to delete')
        }
    }

    /* ── Derived state ── */
    const families = useMemo(() => {
        const fams = [...new Set(allGateways.map(g => g.provider_family).filter(Boolean))]
        return fams.sort()
    }, [allGateways])

    const filtered = useMemo(() => {
        let list = allGateways
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(g =>
                g.name.toLowerCase().includes(q) ||
                g.code.toLowerCase().includes(q) ||
                (g.provider_family || '').toLowerCase().includes(q) ||
                (g.description || '').toLowerCase().includes(q)
            )
        }
        if (familyFilter) {
            list = list.filter(g => g.provider_family === familyFilter)
        }
        if (statusFilter === 'active') list = list.filter(g => g.is_active)
        if (statusFilter === 'inactive') list = list.filter(g => !g.is_active)
        return list
    }, [allGateways, search, familyFilter, statusFilter])

    const activeCount = allGateways.filter(g => g.is_active).length
    const globalCount = allGateways.filter(g => g.is_global).length
    const regionalCount = allGateways.length - globalCount
    const familyCount = families.length

    // Group by family for visual organization
    const familyGroups = useMemo(() => {
        const groups: Record<string, any[]> = {}
        filtered.forEach(gw => {
            const fam = gw.provider_family || 'Other'
            if (!groups[fam]) groups[fam] = []
            groups[fam].push(gw)
        })
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    }, [filtered])

    return (
        <div className="app-page max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* ═══ Header ═══ */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2 fade-in-up">
                <div className="flex items-center gap-4">
                    <Link href="/saas-home">
                        <button className="w-9 h-9 rounded-xl border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                            <ArrowLeft size={16} />
                        </button>
                    </Link>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ background: 'var(--app-primary-bg)', border: '1px solid var(--app-primary-border)' }}>
                        <CreditCard size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                            SaaS · Reference Data
                        </p>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                            Payment Gateway Catalog
                        </h1>
                        <p className="text-[11px] text-app-muted-foreground mt-0.5">
                            Global catalog of digital payment providers. Tenants activate these for their organizations.
                        </p>
                    </div>
                </div>
                <button onClick={openCreate}
                        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl text-white transition-all hover:shadow-md"
                        style={{ background: 'var(--app-primary)' }}>
                    <Plus size={12} /> Add Gateway
                </button>
            </header>

            {/* ═══ KPI Strip ═══ */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {[
                    { label: 'Total Gateways', value: allGateways.length, color: 'var(--app-primary)', icon: <Layers size={14} /> },
                    { label: 'Active', value: activeCount, color: 'var(--app-success, #22c55e)', icon: <Check size={14} /> },
                    { label: 'Global', value: globalCount, color: 'var(--app-info, #3b82f6)', icon: <Globe size={14} /> },
                    { label: 'Regional', value: regionalCount, color: '#8b5cf6', icon: <MapPin size={14} /> },
                    { label: 'Families', value: familyCount, color: '#f59e0b', icon: <Filter size={14} /> },
                ].map(s => (
                    <div key={s.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}>{s.icon}</div>
                        <div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground">{s.label}</div>
                            <div className="text-lg font-black text-app-foreground tabular-nums leading-none">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══ Search & Filter Bar ═══ */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, code, family…" className={`${inputCls} pl-9`} />
                </div>
                <select value={familyFilter} onChange={e => setFamilyFilter(e.target.value)}
                    className={`${inputCls} w-[160px] appearance-none pr-7`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                    <option value="">All Families</option>
                    {families.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
                    className={`${inputCls} w-[120px] appearance-none pr-7`}
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}>
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                </select>
                {(search || familyFilter || statusFilter) && (
                    <button onClick={() => { setSearch(''); setFamilyFilter(''); setStatusFilter('') }}
                        className="text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground px-2 py-1.5 rounded-lg hover:bg-app-surface transition-all flex items-center gap-1">
                        <X size={10} /> Clear
                    </button>
                )}
                <div className="ml-auto text-[10px] font-bold text-app-muted-foreground">
                    {filtered.length} of {allGateways.length} shown
                </div>
            </div>

            {/* ═══ Gateway Catalog — Grouped by Family ═══ */}
            {familyGroups.map(([family, gateways]) => (
                <div key={family} className="space-y-3">
                    {/* Family Header */}
                    <div className="flex items-center gap-2 pt-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-primary)' }} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">{family}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', color: 'var(--app-primary)' }}>
                            {gateways.length}
                        </span>
                        <div className="flex-1 border-t border-app-border/30" />
                    </div>

                    {/* Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {gateways.map(gw => {
                            const color = gw.color || '#6366f1'
                            const fieldCount = gw.config_schema?.length || 0
                            const countryList: string[] = gw.country_codes || []
                            const isExpanded = expanded === gw.id

                            return (
                                <div key={gw.id}
                                    className="rounded-2xl p-4 flex flex-col gap-2.5 transition-all group hover:shadow-lg relative overflow-hidden cursor-pointer"
                                    onClick={() => setExpanded(isExpanded ? null : gw.id)}
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                        border: `1.5px solid color-mix(in srgb, var(--app-border) 50%, transparent)`,
                                        opacity: gw.is_active ? 1 : 0.6,
                                    }}>
                                    {/* Status badge */}
                                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                                        {gw.is_active ? (
                                            <span className="inline-flex items-center gap-0.5 text-[7px] font-black px-1.5 py-0.5 rounded-full"
                                                style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                                                <Eye size={7} /> LIVE
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-0.5 text-[7px] font-black px-1.5 py-0.5 rounded-full"
                                                style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                <EyeOff size={7} /> DRAFT
                                            </span>
                                        )}
                                    </div>

                                    {/* Header */}
                                    <div className="flex items-start gap-3">
                                        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                                            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
                                            {gw.logo_emoji || '💳'}
                                        </div>
                                        <div className="min-w-0 flex-1 pr-12">
                                            <h3 className="text-[13px] font-black text-app-foreground truncate">{gw.name}</h3>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[9px] font-mono font-bold text-app-muted-foreground">{gw.code}</span>
                                                {gw.is_global && (
                                                    <span className="inline-flex items-center gap-0.5 text-[7px] font-bold px-1 py-px rounded"
                                                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                                        <Globe size={7} /> GLOBAL
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Description */}
                                    <p className="text-[10px] font-bold text-app-muted-foreground leading-relaxed line-clamp-2 min-h-[28px]">
                                        {gw.description || 'No description available'}
                                    </p>

                                    {/* Country tags + metadata */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-wrap gap-1">
                                            {countryList.slice(0, 4).map((code: string) => (
                                                <span key={code} className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                                                    style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                    {code}
                                                </span>
                                            ))}
                                            {countryList.length > 4 && (
                                                <span className="text-[8px] font-bold text-app-muted-foreground">+{countryList.length - 4}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {fieldCount > 0 && (
                                                <span className="text-[8px] font-bold text-app-muted-foreground flex items-center gap-0.5">
                                                    <Lock size={7} /> {fieldCount} config fields
                                                </span>
                                            )}
                                            {gw.website_url && (
                                                <a href={gw.website_url} target="_blank" rel="noopener noreferrer"
                                                    className="text-app-muted-foreground hover:text-app-foreground transition-colors"
                                                    onClick={e => e.stopPropagation()}>
                                                    <ExternalLink size={10} />
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="space-y-2.5 pt-2 border-t animate-in fade-in slide-in-from-top-2 duration-200"
                                            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                            {/* Config Schema */}
                                            {fieldCount > 0 && (
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 flex items-center gap-1">
                                                        <Settings2 size={9} /> Config Schema ({fieldCount})
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-1">
                                                        {(gw.config_schema || []).map((f: any) => (
                                                            <div key={f.key} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[9px]"
                                                                style={{ background: `color-mix(in srgb, ${color} 5%, transparent)` }}>
                                                                <span className="font-mono font-bold" style={{ color }}>{f.key}</span>
                                                                <span className="text-app-muted-foreground">{f.type}</span>
                                                                {f.required && <span className="text-[7px] font-black" style={{ color: 'var(--app-error, #ef4444)' }}>REQ</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Countries */}
                                            {countryList.length > 0 && (
                                                <div>
                                                    <div className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 flex items-center gap-1">
                                                        <MapPin size={9} /> Available Countries ({countryList.length})
                                                    </div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {countryList.map((code: string) => (
                                                            <span key={code} className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                                                                style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                                                {code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tenant Activation Summary */}
                                            {(() => {
                                                const activations = initialOrgGateways.filter(og => og.gateway === gw.id)
                                                return activations.length > 0 ? (
                                                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                                                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 15%, transparent)' }}>
                                                        <Building2 size={11} style={{ color: 'var(--app-success, #22c55e)' }} />
                                                        <span className="text-[10px] font-bold text-app-foreground">
                                                            Used by <span className="font-black">{activations.length}</span> org(s)
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <div className="text-[9px] font-bold text-app-muted-foreground text-center py-1">
                                                        Not yet activated by any organization
                                                    </div>
                                                )
                                            })()}

                                            {/* Admin Actions */}
                                            <div className="flex items-center justify-end gap-1 pt-2"
                                                 style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                                <button onClick={(e) => { e.stopPropagation(); handleToggle(gw) }}
                                                    title={gw.is_active ? 'Deactivate' : 'Activate'}
                                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-app-surface-hover transition-all"
                                                    style={{ color: gw.is_active ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' }}>
                                                    <Power size={10} /> {gw.is_active ? 'Deactivate' : 'Activate'}
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); openEdit(gw) }}
                                                    title="Edit"
                                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-app-surface-hover transition-all text-app-muted-foreground hover:text-app-foreground">
                                                    <Pencil size={10} /> Edit
                                                </button>
                                                <button onClick={(e) => {
                                                    e.stopPropagation()
                                                    const inUse = initialOrgGateways.some(og => og.gateway === gw.id)
                                                    if (inUse) {
                                                        toast.error('In use by one or more orgs — deactivate instead.')
                                                        return
                                                    }
                                                    setPendingDelete(gw)
                                                }}
                                                    title="Delete"
                                                    className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg hover:bg-app-error/10 transition-all"
                                                    style={{ color: 'var(--app-error, #ef4444)' }}>
                                                    <Trash2 size={10} /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}

            {/* Empty State */}
            {filtered.length === 0 && (
                <div className="text-center py-16 rounded-2xl border-2 border-dashed border-app-border">
                    <CreditCard size={40} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-bold text-app-muted-foreground">
                        {search || familyFilter || statusFilter ? 'No gateways match your filters' : 'No payment gateways in the catalog'}
                    </p>
                    <p className="text-[11px] text-app-muted-foreground mt-1">
                        {search || familyFilter || statusFilter
                            ? 'Try adjusting your search or filter.'
                            : 'Click "Add Gateway" above, or run the seed_payment_gateways command.'}
                    </p>
                    {!(search || familyFilter || statusFilter) && (
                        <button onClick={openCreate}
                                className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl text-white"
                                style={{ background: 'var(--app-primary)' }}>
                            <Plus size={12} /> Add First Gateway
                        </button>
                    )}
                </div>
            )}

            <GatewayEditorDialog
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                onSaved={() => startTransition(() => router.refresh())}
                initial={editorTarget}
            />

            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(o) => { if (!o) setPendingDelete(null) }}
                title={pendingDelete ? `Delete ${pendingDelete.name}?` : 'Delete'}
                description="This removes the gateway from the global catalog. Tenants who haven't activated it won't be affected."
                confirmText="Delete"
                variant="danger"
                onConfirm={handleConfirmDelete}
            />
        </div>
    )
}
