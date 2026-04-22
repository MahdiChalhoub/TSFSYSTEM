// @ts-nocheck
'use client'

/* ═══════════════════════════════════════════════════════════
 *  PackagesClient — Package Master Page
 *
 *  Packages are first-class: each has a barcode, price, image,
 *  and can be linked to categories/brands/attributes via the
 *  PackagingSuggestionRule engine.
 *
 *  Layout: flat list grouped by unit (via chip filter), KPIs,
 *  search, inline create, per-row detail drawer with Overview /
 *  Links / Products tabs.
 * ═══════════════════════════════════════════════════════════ */

import { useState, useMemo, useCallback, useTransition, useEffect } from 'react'
import {
    Box, Plus, Search, Package, Barcode, DollarSign, Ruler, Tag, X, Pencil,
    Trash2, Loader2, Sparkles, Power, Check, ChevronRight, ArrowRight,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPackage, updatePackage, deletePackage, getPackageRules, type Package as Pkg } from '@/app/actions/inventory/packages'
import {
    createPackagingRule, deletePackagingRule,
} from '@/app/actions/inventory/packaging-suggestions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'

type Option = { id: number; name: string; code?: string }

export default function PackagesClient({
    initialPackages, units, categories, brands, attributes,
}: {
    initialPackages: Pkg[]
    units: Option[]
    categories: Option[]
    brands: Option[]
    attributes: Option[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [packages, setPackages] = useState<Pkg[]>(initialPackages)

    const [searchQuery, setSearchQuery] = useState('')
    const [unitFilter, setUnitFilter] = useState<number | null>(null)
    const [showInactive, setShowInactive] = useState(false)

    // Create/edit form
    const [editing, setEditing] = useState<Pkg | null>(null)
    const [showForm, setShowForm] = useState(false)

    // Detail drawer
    const [drawerPkg, setDrawerPkg] = useState<Pkg | null>(null)

    // Delete flow
    const [deleteTarget, setDeleteTarget] = useState<Pkg | null>(null)
    const [deleteConflict, setDeleteConflict] = useState<any>(null)

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        return packages.filter(p => {
            if (!showInactive && p.is_active === false) return false
            if (unitFilter && p.unit !== unitFilter) return false
            if (!q) return true
            return (p.name || '').toLowerCase().includes(q)
                || (p.code || '').toLowerCase().includes(q)
                || (p.barcode || '').toLowerCase().includes(q)
                || (p.unit_name || '').toLowerCase().includes(q)
        })
    }, [packages, searchQuery, unitFilter, showInactive])

    const stats = useMemo(() => {
        const active = packages.filter(p => p.is_active !== false).length
        const withBarcode = packages.filter(p => !!p.barcode).length
        const withPrice = packages.filter(p => p.selling_price != null && Number(p.selling_price) > 0).length
        const defaults = packages.filter(p => p.is_default).length
        return { total: packages.length, active, withBarcode, withPrice, defaults }
    }, [packages])

    const unitOptions = useMemo(() => {
        const used = new Set(packages.map(p => p.unit))
        return units.filter(u => used.has(u.id)).sort((a, b) => a.name.localeCompare(b.name))
    }, [packages, units])

    const openNewForm = useCallback(() => { setEditing(null); setShowForm(true) }, [])
    const openEditForm = useCallback((p: Pkg) => { setEditing(p); setShowForm(true) }, [])
    const closeForm = useCallback(() => { setShowForm(false); setEditing(null) }, [])

    const handleSave = async (formData: Pkg) => {
        const action = editing?.id
            ? updatePackage(editing.id, formData)
            : createPackage(formData)
        const res: any = await action
        if (res.success) {
            toast.success(editing ? 'Package updated' : 'Package created')
            closeForm()
            router.refresh()
        } else {
            toast.error(res.message || 'Failed to save')
        }
    }

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const source = deleteTarget
        setDeleteTarget(null)
        startTransition(async () => {
            const res: any = await deletePackage(source.id!)
            if (res?.success) { toast.success(`"${source.name}" deleted`); router.refresh(); return }
            if (res?.conflict) { setDeleteConflict({ conflict: res.conflict, source }); return }
            toast.error(res?.message || 'Delete failed')
        })
    }
    const handleForceDelete = async () => {
        const source = deleteConflict?.source
        if (!source) return
        const res: any = await deletePackage(source.id, { force: true })
        if (res?.success) { toast.success(`"${source.name}" force-deleted`); setDeleteConflict(null); router.refresh() }
        else toast.error(res?.message || 'Delete failed')
    }

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="page-header-icon bg-app-primary"
                        style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Package size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                            Packages
                        </h1>
                        <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            {stats.total} Package{stats.total !== 1 ? 's' : ''} · {stats.active} active
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setShowInactive(s => !s)}
                        className="flex items-center gap-1.5 text-[11px] font-bold border px-2.5 py-1.5 rounded-xl transition-all"
                        style={showInactive ? {
                            background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)',
                            color: 'var(--app-warning)',
                            borderColor: 'color-mix(in srgb, var(--app-warning) 30%, transparent)',
                        } : { color: 'var(--app-muted-foreground)', borderColor: 'var(--app-border)' }}>
                        <Power size={13} /> {showInactive ? 'Showing Inactive' : 'Show Inactive'}
                    </button>
                    <button onClick={openNewForm}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Plus size={14} /> New Package
                    </button>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="mb-4 flex-shrink-0"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                {[
                    { label: 'Total', value: stats.total, icon: <Package size={14} />, color: 'var(--app-primary)' },
                    { label: 'Active', value: stats.active, icon: <Check size={14} />, color: 'var(--app-success, #22c55e)' },
                    { label: 'With Barcode', value: stats.withBarcode, icon: <Barcode size={14} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'With Price', value: stats.withPrice, icon: <DollarSign size={14} />, color: 'var(--app-warning, #f59e0b)' },
                    { label: 'Defaults', value: stats.defaults, icon: <Sparkles size={14} />, color: '#8b5cf6' },
                ].map(k => (
                    <div key={k.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}>
                            {k.icon}
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground">{k.label}</div>
                            <div className="text-sm font-black text-app-foreground tabular-nums">{k.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search + unit filter chips */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
                <div className="flex-1 relative min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search packages by name, code, barcode, unit…"
                        className="w-full pl-9 pr-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl outline-none text-app-foreground" />
                </div>
                {unitOptions.length > 0 && (
                    <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                        <button onClick={() => setUnitFilter(null)}
                            className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                            style={unitFilter === null ? { background: 'var(--app-primary)', color: '#fff' } : { color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                            All ({packages.length})
                        </button>
                        {unitOptions.map(u => {
                            const n = packages.filter(p => p.unit === u.id).length
                            return (
                                <button key={u.id} onClick={() => setUnitFilter(u.id)}
                                    className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg whitespace-nowrap"
                                    style={unitFilter === u.id ? { background: 'var(--app-info)', color: '#fff' } : { color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                                    {u.name} ({n})
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Package list */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl border"
                style={{ borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)', background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)' }}>
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 px-4 text-center">
                        <Package size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">
                            {searchQuery ? 'No matching packages' : 'No packages yet'}
                        </p>
                        <p className="text-[11px] text-app-muted-foreground mt-1 max-w-xs">
                            {searchQuery ? 'Try another term.' : 'Create a package — Pack of 6, Carton 24, Pallet 144 — then link it to categories, brands, or attributes.'}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {filtered.map(p => (
                            <PackageRow key={p.id}
                                pkg={p}
                                onOpen={() => setDrawerPkg(p)}
                                onEdit={() => openEditForm(p)}
                                onDelete={() => setDeleteTarget(p)} />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-[11px] font-bold rounded-b-2xl mt-[-1px]"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    borderTop: 'none', color: 'var(--app-muted-foreground)', backdropFilter: 'blur(10px)',
                }}>
                <div className="flex items-center gap-3 flex-wrap">
                    <span>{filtered.length} of {packages.length} packages shown</span>
                    {unitFilter && (<>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span style={{ color: 'var(--app-info)' }}>Unit: {units.find(u => u.id === unitFilter)?.name}</span>
                        <button onClick={() => setUnitFilter(null)} className="underline" style={{ color: 'var(--app-info)' }}>Clear</button>
                    </>)}
                </div>
                <span style={{ color: 'var(--app-foreground)' }}>
                    Status: <span style={{ color: 'var(--app-success)' }}>Operational</span>
                </span>
            </div>

            {/* Modals */}
            {showForm && (
                <PackageFormModal
                    pkg={editing}
                    units={units}
                    onSave={handleSave}
                    onClose={closeForm}
                />
            )}
            {drawerPkg && (
                <PackageDetailDrawer
                    pkg={drawerPkg}
                    categories={categories}
                    brands={brands}
                    attributes={attributes}
                    onClose={() => setDrawerPkg(null)}
                    onEdit={() => { openEditForm(drawerPkg); setDrawerPkg(null) }}
                />
            )}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                onConfirm={handleConfirmDelete}
                title={`Delete "${deleteTarget?.name}"?`}
                description="If products are using this package as a template, you'll be guided to force-delete."
                confirmText="Delete" variant="danger"
            />
            <DeleteConflictDialog
                conflict={deleteConflict?.conflict || null}
                sourceName={deleteConflict?.source?.name || ''}
                entityName="brand"  /* no migrate path for packages yet — force-only */
                targets={[]}
                onMigrate={async () => { /* no-op */ }}
                onForceDelete={handleForceDelete}
                onCancel={() => setDeleteConflict(null)}
                migrateDisabled={true}
            />
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  PACKAGE ROW — one card-like row per package
 * ═══════════════════════════════════════════════════════════ */
function PackageRow({ pkg, onOpen, onEdit, onDelete }: { pkg: Pkg; onOpen: () => void; onEdit: () => void; onDelete: () => void }) {
    const ratio = Number(pkg.ratio ?? 1)
    const price = pkg.selling_price != null ? Number(pkg.selling_price) : null
    return (
        <div className="group flex items-center gap-3 px-4 py-3 hover:bg-app-surface/50 transition-all cursor-pointer"
            onClick={onOpen}
            style={{ opacity: pkg.is_active === false ? 0.5 : 1 }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, #6366f1))', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                <Package size={16} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-black text-app-foreground truncate">{pkg.name}</span>
                    {pkg.is_default && (
                        <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-[1px] rounded-full"
                            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff' }}>
                            Default
                        </span>
                    )}
                    {pkg.is_active === false && (
                        <span className="text-[7px] font-black uppercase px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>
                            Inactive
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {pkg.code && <span className="font-mono text-[9px] font-bold text-app-muted-foreground">{pkg.code}</span>}
                    <span className="text-[9px] font-bold flex items-center gap-1" style={{ color: 'var(--app-info)' }}>
                        <Ruler size={9} /> ×{ratio} {pkg.unit_code || pkg.unit_name}
                    </span>
                    {pkg.barcode && (
                        <span className="text-[9px] font-mono flex items-center gap-1" style={{ color: 'var(--app-muted-foreground)' }}>
                            <Barcode size={9} /> {pkg.barcode}
                        </span>
                    )}
                    {price != null && price > 0 && (
                        <span className="text-[9px] font-black flex items-center gap-1" style={{ color: 'var(--app-warning)' }}>
                            <DollarSign size={9} /> {price.toLocaleString()}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                <button onClick={(e) => { e.stopPropagation(); onEdit() }}
                    className="p-1.5 hover:bg-app-border/40 rounded-lg" title="Edit">
                    <Pencil size={12} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete() }}
                    className="p-1.5 hover:bg-app-border/40 rounded-lg" title="Delete">
                    <Trash2 size={12} style={{ color: 'var(--app-error)' }} />
                </button>
                <ChevronRight size={12} className="text-app-muted-foreground mx-1" />
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  PACKAGE FORM MODAL — create / edit
 * ═══════════════════════════════════════════════════════════ */
function PackageFormModal({ pkg, units, onSave, onClose }: { pkg: Pkg | null; units: Option[]; onSave: (data: Pkg) => Promise<void>; onClose: () => void }) {
    const [form, setForm] = useState<Pkg>({
        unit: pkg?.unit ?? units[0]?.id ?? 0,
        name: pkg?.name ?? '',
        code: pkg?.code ?? '',
        ratio: pkg?.ratio ?? 1,
        barcode: pkg?.barcode ?? '',
        selling_price: pkg?.selling_price ?? null,
        image_url: pkg?.image_url ?? '',
        is_active: pkg?.is_active ?? true,
        is_default: pkg?.is_default ?? false,
        order: pkg?.order ?? 0,
        notes: pkg?.notes ?? '',
    })
    const [saving, setSaving] = useState(false)

    const submit = async () => {
        if (!form.name.trim()) { toast.error('Name is required'); return }
        if (!form.unit) { toast.error('Pick a unit'); return }
        setSaving(true)
        try { await onSave(form) } finally { setSaving(false) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-xl rounded-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
                <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--app-primary)' }}>
                            <Package size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black">{pkg ? 'Edit Package' : 'New Package'}</h3>
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                {pkg ? `${pkg.code || ''} · ${pkg.name}` : 'First-class packaging template'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30"><X size={16} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Name *" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Pack of 6" />
                        <Field label="Code" value={form.code || ''} onChange={v => setForm({ ...form, code: v })} placeholder="PK6" mono />
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Unit *</label>
                            <select value={form.unit} onChange={e => setForm({ ...form, unit: Number(e.target.value) })}
                                className="w-full px-3 py-2 rounded-xl outline-none text-[12px] font-bold"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                {units.map(u => <option key={u.id} value={u.id}>{u.name}{u.code ? ` (${u.code})` : ''}</option>)}
                            </select>
                        </div>
                        <Field label="Ratio (base units)" value={String(form.ratio)} onChange={v => setForm({ ...form, ratio: Number(v) || 1 })} mono placeholder="6" />
                        <Field label="Barcode" value={form.barcode || ''} onChange={v => setForm({ ...form, barcode: v })} placeholder="6001234000001" mono />
                        <Field label="Selling Price" value={form.selling_price != null ? String(form.selling_price) : ''} onChange={v => setForm({ ...form, selling_price: v ? Number(v) : null })} placeholder="2800" mono />
                    </div>
                    <Field label="Image URL" value={form.image_url || ''} onChange={v => setForm({ ...form, image_url: v })} placeholder="https://…" />
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                            <input type="checkbox" checked={form.is_default ?? false} onChange={e => setForm({ ...form, is_default: e.target.checked })} />
                            Set as default package for this unit
                        </label>
                        <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
                            <input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                            Active
                        </label>
                    </div>
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Notes</label>
                        <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })}
                            rows={2} className="w-full px-3 py-2 rounded-xl outline-none text-[12px]"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                    </div>
                </div>

                <div className="px-5 py-3 flex items-center justify-end gap-2 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose} disabled={saving} className="text-[11px] font-bold px-3 py-2 rounded-xl" style={{ color: 'var(--app-muted-foreground)' }}>Cancel</button>
                    <button onClick={submit} disabled={saving}
                        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-xl"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {pkg ? 'Save Changes' : 'Create Package'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function Field({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
    return (
        <div>
            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{label}</label>
            <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className={`w-full px-3 py-2 rounded-xl outline-none text-[12px] ${mono ? 'font-mono font-bold' : 'font-medium'}`}
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  PACKAGE DETAIL DRAWER — Overview + Links tabs
 * ═══════════════════════════════════════════════════════════ */
function PackageDetailDrawer({ pkg, categories, brands, attributes, onClose, onEdit }: {
    pkg: Pkg; categories: Option[]; brands: Option[]; attributes: Option[]; onClose: () => void; onEdit: () => void
}) {
    const [tab, setTab] = useState<'overview' | 'links'>('overview')
    const [rules, setRules] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [adding, setAdding] = useState(false)
    const [newLink, setNewLink] = useState<{ category: string; brand: string; attribute: string; attribute_value: string }>({ category: '', brand: '', attribute: '', attribute_value: '' })

    const loadRules = useCallback(async () => {
        if (!pkg.id) return
        setLoading(true)
        try { const data = await getPackageRules(pkg.id); setRules(data) }
        finally { setLoading(false) }
    }, [pkg.id])

    useEffect(() => { if (tab === 'links') loadRules() }, [tab, loadRules])

    const handleAddLink = async () => {
        if (!newLink.category && !newLink.brand && !newLink.attribute) {
            toast.error('Pick at least one of category / brand / attribute'); return
        }
        try {
            await createPackagingRule({
                category: newLink.category ? Number(newLink.category) : null,
                brand: newLink.brand ? Number(newLink.brand) : null,
                attribute: newLink.attribute ? Number(newLink.attribute) : null,
                attribute_value: newLink.attribute_value || null,
                packaging: pkg.id!,
            })
            toast.success('Link added')
            setNewLink({ category: '', brand: '', attribute: '', attribute_value: '' })
            setAdding(false)
            loadRules()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add link')
        }
    }
    const handleRemoveLink = async (ruleId: number) => {
        if (!confirm('Remove this link?')) return
        try { await deletePackagingRule(ruleId); toast.success('Removed'); loadRules() }
        catch (e: any) { toast.error(e?.message || 'Failed') }
    }

    return (
        <div className="fixed inset-0 z-40 flex justify-end animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-lg h-full flex flex-col animate-in slide-in-from-right-4 duration-300"
                style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}>

                {/* Header */}
                <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Package size={16} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-black truncate">{pkg.name}</h2>
                            <p className="text-[10px] font-mono font-bold text-app-muted-foreground">
                                ×{Number(pkg.ratio).toLocaleString()} {pkg.unit_code || pkg.unit_name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={onEdit} className="p-1.5 hover:bg-app-border/40 rounded-lg" title="Edit"><Pencil size={13} /></button>
                        <button onClick={onClose} className="p-1.5 hover:bg-app-border/40 rounded-lg"><X size={14} /></button>
                    </div>
                </div>

                {/* Tab bar */}
                <div className="flex-shrink-0 flex items-center px-3 border-b" style={{ borderColor: 'var(--app-border)' }}>
                    {(['overview', 'links'] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className="text-[11px] font-bold px-3 py-2.5 transition-all"
                            style={{
                                color: tab === t ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                                borderBottom: tab === t ? '2px solid var(--app-primary)' : '2px solid transparent',
                                marginBottom: '-1px',
                            }}>
                            {t === 'overview' ? 'Overview' : `Links${rules.length ? ` (${rules.length})` : ''}`}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {tab === 'overview' && (
                        <div className="p-4 space-y-2">
                            {[
                                ['Code', pkg.code],
                                ['Ratio', `×${Number(pkg.ratio).toLocaleString()} ${pkg.unit_code || ''}`],
                                ['Barcode', pkg.barcode],
                                ['Selling Price', pkg.selling_price != null ? Number(pkg.selling_price).toLocaleString() : null],
                                ['Default', pkg.is_default ? 'Yes' : '—'],
                                ['Status', pkg.is_active !== false ? 'Active' : 'Inactive'],
                                ['Notes', pkg.notes],
                            ].filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                                <div key={k} className="flex items-start gap-3 px-3 py-2 rounded-xl"
                                    style={{ background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }}>
                                    <span className="text-[9px] font-black uppercase tracking-widest w-28 flex-shrink-0 pt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>{k}</span>
                                    <span className="text-[12px] font-bold text-app-foreground flex-1">{v}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {tab === 'links' && (
                        <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Category / Brand / Attribute rules that fire this package
                                </p>
                                <button onClick={() => setAdding(s => !s)}
                                    className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
                                    style={adding ? { background: 'var(--app-surface)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' } : { background: 'var(--app-primary)', color: '#fff' }}>
                                    {adding ? <><X size={10} /> Cancel</> : <><Plus size={10} /> Add Link</>}
                                </button>
                            </div>

                            {adding && (
                                <div className="rounded-xl p-3 space-y-2"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    <div className="grid grid-cols-1 gap-2">
                                        <LinkField label="Category" value={newLink.category} onChange={v => setNewLink({ ...newLink, category: v })} options={categories} />
                                        <LinkField label="Brand" value={newLink.brand} onChange={v => setNewLink({ ...newLink, brand: v })} options={brands} />
                                        <LinkField label="Attribute" value={newLink.attribute} onChange={v => setNewLink({ ...newLink, attribute: v })} options={attributes} />
                                        {newLink.attribute && (
                                            <Field label="Attribute Value (optional)" value={newLink.attribute_value} onChange={v => setNewLink({ ...newLink, attribute_value: v })} placeholder="e.g. Big" />
                                        )}
                                    </div>
                                    <button onClick={handleAddLink}
                                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider py-2 rounded-lg"
                                        style={{ background: 'var(--app-primary)', color: '#fff' }}>
                                        <Check size={12} /> Create Link
                                    </button>
                                </div>
                            )}

                            {loading ? (
                                <div className="py-6 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-app-primary" /></div>
                            ) : rules.length === 0 ? (
                                <div className="py-6 text-center">
                                    <Sparkles size={20} className="mx-auto text-app-muted-foreground opacity-40 mb-1" />
                                    <p className="text-[11px] font-bold text-app-muted-foreground">No links yet</p>
                                    <p className="text-[10px] text-app-muted-foreground mt-1">Link this package to a category, brand, or attribute so the smart engine suggests it during product creation.</p>
                                </div>
                            ) : (
                                rules.map(r => (
                                    <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl group"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                                        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                                            {r.category_name && <Chip icon={<Tag size={9} />} color="var(--app-success)">{r.category_name}</Chip>}
                                            {r.brand_name && <Chip icon={<Tag size={9} />} color="#8b5cf6">{r.brand_name}</Chip>}
                                            {r.attribute_name && <Chip icon={<Tag size={9} />} color="var(--app-warning)">{r.attribute_name}{r.attribute_value ? `=${r.attribute_value}` : ''}</Chip>}
                                            <span className="text-[9px] font-mono opacity-60">p{r.effective_priority}</span>
                                        </div>
                                        <button onClick={() => handleRemoveLink(r.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-app-border/50">
                                            <Trash2 size={10} style={{ color: 'var(--app-error)' }} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function LinkField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Option[] }) {
    return (
        <div>
            <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl outline-none text-[12px] font-bold"
                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                <option value="">— Any {label.toLowerCase()} —</option>
                {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
        </div>
    )
}

function Chip({ icon, color, children }: { icon: React.ReactNode; color: string; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg"
            style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
            {icon}{children}
        </span>
    )
}
