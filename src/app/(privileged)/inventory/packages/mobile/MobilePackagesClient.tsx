'use client'

/**
 * MobilePackagesClient — phone-friendly UnitPackage catalog
 *
 * Mirrors the desktop structure: a list grouped by unit, a primary
 * "New Template" action, and a bottom-sheet detail with Overview /
 * Adopters / Audit tabs. Reuses the shared dataTools factory so
 * Import/Export works the same on both surfaces.
 */

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
    Package, Plus, Box, Ruler, Layers, History, Loader2, ChevronRight,
    Pencil, Trash2, Sparkles, Archive, X,
    User as UserIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { TemplateFormModal } from '../_shared/TemplateFormModal'
import { buildPackagesDataTools } from '../_lib/dataTools'
import '@/lib/tours/definitions/inventory-packages-mobile'

type Option = { id: number; name: string; code?: string }
type Tpl = {
    id: number
    unit: number
    unit_name?: string
    unit_code?: string
    parent?: number | null
    parent_name?: string | null
    parent_ratio?: number | null
    name: string
    code?: string | null
    ratio: number
    is_default?: boolean
    order?: number
    notes?: string | null
    is_archived?: boolean
}
type UnitOpt = { id: number; name: string; code?: string; base_unit?: number | null }

interface Props {
    initialTemplates: Tpl[]
    units: UnitOpt[]
    categories: Option[]
    brands: Option[]
    attributes: Option[]
    attributeValuesByParent?: Record<number, Option[]>
    loadErrors?: Record<string, string>
    currentUser?: { is_staff?: boolean; is_superuser?: boolean } | null
}

export function MobilePackagesClient({
    initialTemplates, units, categories, brands, attributes, attributeValuesByParent,
    loadErrors, currentUser,
}: Props) {
    void categories; void brands; void attributes; void attributeValuesByParent
    const router = useRouter()
    const isStaff = !!(currentUser?.is_staff || currentUser?.is_superuser)
    const [templates, setTemplates] = useState<Tpl[]>(initialTemplates)
    const [showArchived, setShowArchived] = useState(false)
    const [editing, setEditing] = useState<Tpl | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [sheetTpl, setSheetTpl] = useState<Tpl | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Tpl | null>(null)
    const [search, setSearch] = useState('')

    useEffect(() => { setTemplates(initialTemplates) }, [initialTemplates])

    useEffect(() => {
        if (!loadErrors) return
        const keys = Object.keys(loadErrors)
        if (keys.length) toast.error(`Could not load: ${keys.join(', ')}`)
    }, [loadErrors])

    const refresh = useCallback(async () => {
        try {
            const url = showArchived ? 'unit-packages/?include_archived=1' : 'unit-packages/'
            const data = await erpFetch(url, { cache: 'no-store' } as RequestInit) as { results?: Tpl[] } | Tpl[]
            setTemplates(Array.isArray(data) ? data : (data?.results ?? []))
        } catch { toast.error('Failed to refresh templates') }
        router.refresh()
    }, [router, showArchived])

    useEffect(() => { refresh() }, [showArchived, refresh])

    const stats = useMemo(() => {
        const defaults = templates.filter(t => t.is_default).length
        const archived = templates.filter(t => t.is_archived).length
        const unitsUsed = new Set(templates.map(t => t.unit)).size
        return { total: templates.length, defaults, unitsUsed, archived }
    }, [templates])

    const grouped = useMemo(() => {
        const q = search.trim().toLowerCase()
        const matches = (t: Tpl) =>
            !q
            || t.name?.toLowerCase().includes(q)
            || (t.code || '').toLowerCase().includes(q)
            || (t.unit_name || '').toLowerCase().includes(q)
            || (t.unit_code || '').toLowerCase().includes(q)
        const byUnit: Record<number, { unit: UnitOpt; rows: Tpl[] }> = {}
        for (const u of units) byUnit[u.id] = { unit: u, rows: [] }
        for (const t of templates) {
            if (!matches(t)) continue
            if (!byUnit[t.unit]) {
                // Unit may not be in the dropdown list (deleted) — keep it
                // grouped under a synthetic header so the row stays visible.
                byUnit[t.unit] = { unit: { id: t.unit, name: t.unit_name || `Unit #${t.unit}`, code: t.unit_code }, rows: [] }
            }
            byUnit[t.unit].rows.push(t)
        }
        return Object.values(byUnit)
            .filter(g => g.rows.length > 0)
            .map(g => ({
                ...g,
                rows: [...g.rows].sort((a, b) => Number(a.ratio || 0) - Number(b.ratio || 0)),
            }))
            .sort((a, b) => (a.unit.name || '').localeCompare(b.unit.name || ''))
    }, [templates, units, search])

    const openNewForm = useCallback(() => { setEditing(null); setShowForm(true) }, [])
    const openEditForm = useCallback((t: Tpl) => { setEditing(t); setShowForm(true) }, [])
    const closeForm = useCallback(() => { setShowForm(false); setEditing(null) }, [])

    const handleSave = async (data: Record<string, unknown>) => {
        try {
            if (editing?.id) {
                await erpFetch(`unit-packages/${editing.id}/`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                toast.success('Template updated')
            } else {
                await erpFetch('unit-packages/', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
                toast.success('Template created')
            }
            closeForm(); refresh()
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    }

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        const t = deleteTarget
        setDeleteTarget(null)
        try {
            await erpFetch(`unit-packages/${t.id}/`, { method: 'DELETE' })
            toast.success(`"${t.name}" deleted`)
            refresh()
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Delete failed') }
    }

    const handleToggleArchive = async (t: Tpl) => {
        try {
            await erpFetch(`unit-packages/${t.id}/`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_archived: !t.is_archived }),
            })
            toast.success(t.is_archived ? `Restored "${t.name}"` : `Archived "${t.name}"`)
            refresh()
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Failed') }
    }

    return (
        <MobileMasterPage
            config={{
                title: 'Package Templates',
                subtitle: `${stats.total} template${stats.total === 1 ? '' : 's'} · ${stats.unitsUsed} unit famil${stats.unitsUsed === 1 ? 'y' : 'ies'}`,
                icon: <Package size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'inventory-packages-mobile',
                searchPlaceholder: 'Search by name, code, unit…',
                primaryAction: { label: 'New Template', icon: <Plus size={16} strokeWidth={2.6} />, onClick: openNewForm },
                dataTools: buildPackagesDataTools(templates, units),
                secondaryActions: [
                    {
                        label: showArchived ? 'Hide archived' : 'Show archived',
                        icon: <Archive size={14} />,
                        onClick: () => setShowArchived(s => !s),
                        active: showArchived,
                        activeColor: 'var(--app-warning)',
                    },
                    { label: 'Units', icon: <Ruler size={14} />, href: '/inventory/units' },
                ],
                kpis: [
                    { label: 'Total', value: stats.total, icon: <Box size={13} />, color: 'var(--app-primary)' },
                    { label: 'Units', value: stats.unitsUsed, icon: <Ruler size={13} />, color: 'var(--app-info, #3b82f6)' },
                    { label: 'Defaults', value: stats.defaults, icon: <Sparkles size={13} />, color: 'var(--app-info)' },
                    { label: 'Archived', value: stats.archived, icon: <Archive size={13} />, color: 'var(--app-warning, #f59e0b)' },
                ],
                onSearchChange: setSearch,
                onRefresh: refresh,
            }}
            modals={
                <>
                    {showForm && (
                        <TemplateFormModal
                            tpl={editing ? {
                                id: editing.id,
                                unit: editing.unit,
                                parent: editing.parent,
                                parent_ratio: editing.parent_ratio,
                                name: editing.name,
                                code: editing.code ?? undefined,
                                ratio: editing.ratio,
                                is_default: editing.is_default,
                                order: editing.order,
                                notes: editing.notes ?? undefined,
                                unit_code: editing.unit_code,
                            } : null}
                            units={units.map((u) => ({ id: u.id, name: u.name, code: u.code }))}
                            allTemplates={templates.map((t) => ({
                                id: t.id, unit: t.unit, parent: t.parent, parent_ratio: t.parent_ratio,
                                name: t.name, code: t.code ?? undefined, ratio: t.ratio,
                                is_default: t.is_default, order: t.order, notes: t.notes ?? undefined,
                                unit_code: t.unit_code,
                            }))}
                            onSave={handleSave}
                            onClose={closeForm}
                        />
                    )}
                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
                        onConfirm={handleConfirmDelete}
                        title={`Delete "${deleteTarget?.name}"?`}
                        description="Past ProductPackagings keep their data. Suggestion rules targeting this template are removed."
                        confirmText="Delete"
                        variant="danger"
                    />
                </>
            }
            sheet={
                <MobileBottomSheet
                    open={sheetTpl !== null}
                    onClose={() => setSheetTpl(null)}
                    initialSnap="peek">
                    {sheetTpl && (
                        <MobileTemplateDetail
                            tpl={sheetTpl}
                            isStaff={isStaff}
                            onEdit={() => { const t = sheetTpl; setSheetTpl(null); openEditForm(t) }}
                            onDelete={() => { const t = sheetTpl; setSheetTpl(null); setDeleteTarget(t) }}
                            onToggleArchive={() => { handleToggleArchive(sheetTpl); setSheetTpl(null) }}
                            onClose={() => setSheetTpl(null)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            <div className="px-3 pb-24 space-y-4">
                {grouped.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <Box size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="font-bold text-app-muted-foreground" style={{ fontSize: 'var(--tp-lg)' }}>
                            {search ? 'No matching templates' : 'No package templates yet'}
                        </p>
                        <p className="text-app-muted-foreground mt-1 max-w-[280px]" style={{ fontSize: 'var(--tp-sm)' }}>
                            Define standard pack sizes (Pack of 6, Carton 24…) so products can adopt them.
                        </p>
                    </div>
                ) : (
                    grouped.map(group => (
                        <section key={group.unit.id}>
                            <div className="flex items-center gap-2 px-1 mb-1.5">
                                <Ruler size={12} style={{ color: 'var(--app-info, #3b82f6)' }} />
                                <span className="font-bold uppercase tracking-wider" style={{ fontSize: 'var(--tp-xs)', color: 'var(--app-info, #3b82f6)' }}>
                                    {group.unit.name}
                                </span>
                                {group.unit.code && (
                                    <span className="font-mono font-bold rounded px-1.5 py-0.5"
                                        style={{ fontSize: 'var(--tp-xxs)', background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                        {group.unit.code}
                                    </span>
                                )}
                                <span className="ml-auto text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>
                                    {group.rows.length}
                                </span>
                            </div>
                            <div className="rounded-2xl overflow-hidden divide-y divide-app-border/30"
                                 style={{ border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                {group.rows.map(t => (
                                    <button key={t.id}
                                        onClick={() => setSheetTpl(t)}
                                        className="w-full flex items-center gap-2.5 px-3 py-2.5 active:bg-app-bg/50 transition-colors text-left">
                                        <div className="flex items-center justify-center rounded-lg flex-shrink-0"
                                            style={{
                                                width: 32, height: 32,
                                                background: t.is_archived
                                                    ? 'color-mix(in srgb, var(--app-warning) 12%, transparent)'
                                                    : 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                                color: t.is_archived ? 'var(--app-warning)' : 'var(--app-primary)',
                                            }}>
                                            <Box size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-app-foreground truncate" style={{ fontSize: 'var(--tp-md)' }}>{t.name}</span>
                                                {t.is_default && (
                                                    <span className="font-bold uppercase tracking-wider rounded px-1 py-0.5 flex-shrink-0"
                                                        style={{ fontSize: 'var(--tp-xxs)', background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                                                        default
                                                    </span>
                                                )}
                                                {t.is_archived && (
                                                    <span className="font-bold uppercase tracking-wider rounded px-1 py-0.5 flex-shrink-0"
                                                        style={{ fontSize: 'var(--tp-xxs)', background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
                                                        archived
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-app-muted-foreground mt-0.5" style={{ fontSize: 'var(--tp-xxs)' }}>
                                                <span className="font-mono">×{t.ratio}</span>
                                                {t.code && <span className="font-mono">{t.code}</span>}
                                                {t.parent_name && <span className="truncate">↑ {t.parent_name}</span>}
                                            </div>
                                        </div>
                                        <ChevronRight size={14} className="text-app-muted-foreground/60 flex-shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))
                )}
            </div>
        </MobileMasterPage>
    )
}


/* ─── Bottom-sheet detail with three tabs ─── */
type SheetTab = 'overview' | 'audit'

function MobileTemplateDetail({
    tpl, isStaff, onEdit, onDelete, onToggleArchive, onClose,
}: {
    tpl: Tpl
    isStaff: boolean
    onEdit: () => void
    onDelete: () => void
    onToggleArchive: () => void
    onClose: () => void
}) {
    const [tab, setTab] = useState<SheetTab>('overview')
    useEffect(() => { setTab('overview') }, [tpl.id])

    return (
        <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-3 pt-2 pb-3 flex items-center gap-2"
                style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 10%, var(--app-surface)), var(--app-surface))',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)',
                }}>
                <div className="flex items-center justify-center rounded-xl flex-shrink-0"
                    style={{
                        width: 40, height: 40,
                        background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 70%, var(--app-accent)))',
                        boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        color: '#fff',
                    }}>
                    <Box size={16} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="truncate" style={{ fontSize: 'var(--tp-2xl)' }}>{tpl.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                        {tpl.code && (
                            <span className="font-mono font-bold" style={{ fontSize: 'var(--tp-sm)', color: 'var(--app-primary)' }}>{tpl.code}</span>
                        )}
                        {tpl.unit_name && (
                            <span className="text-app-muted-foreground" style={{ fontSize: 'var(--tp-xs)' }}>{tpl.unit_name}</span>
                        )}
                    </div>
                </div>
                <button onClick={onClose}
                    className="flex items-center justify-center rounded-xl active:scale-95 transition-transform"
                    style={{ width: 36, height: 36, color: 'var(--app-muted-foreground)', background: 'color-mix(in srgb, var(--app-border) 25%, transparent)' }}
                    aria-label="Close">
                    <X size={16} />
                </button>
            </div>

            <div className="flex-shrink-0 px-2 py-2 flex items-center gap-1 overflow-x-auto custom-scrollbar"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)', background: 'var(--app-surface)' }}>
                {[
                    { id: 'overview' as SheetTab, label: 'Overview', icon: <Layers size={13} /> },
                    { id: 'audit' as SheetTab, label: 'Audit', icon: <History size={13} /> },
                ].map(t => {
                    const active = tab === t.id
                    return (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            className="flex-shrink-0 flex items-center gap-1.5 rounded-xl font-bold active:scale-[0.97] transition-all"
                            style={{
                                padding: '6px 11px', fontSize: 'var(--tp-xs)',
                                background: active ? 'color-mix(in srgb, var(--app-primary) 14%, transparent)' : 'transparent',
                                color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                border: `1px solid ${active ? 'color-mix(in srgb, var(--app-primary) 35%, transparent)' : 'transparent'}`,
                            }}>
                            {t.icon} {t.label}
                        </button>
                    )
                })}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-3 custom-scrollbar">
                {tab === 'overview' && (
                    <div className="rounded-2xl overflow-hidden"
                        style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        {[
                            ['Ratio (base units)', `×${tpl.ratio}`],
                            ['Parent', tpl.parent_name || '—'],
                            ['Parent ratio', tpl.parent_ratio != null ? `×${tpl.parent_ratio}` : '—'],
                            ['Order', String(tpl.order ?? 0)],
                            ['Default', tpl.is_default ? 'Yes' : 'No'],
                            ['Archived', tpl.is_archived ? 'Yes' : 'No'],
                            ['Notes', tpl.notes || '—'],
                        ].map(([label, value], i) => (
                            <div key={label}
                                className="flex items-center justify-between gap-3 px-3 py-2.5"
                                style={{ borderTop: i === 0 ? undefined : '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)' }}>
                                <span className="font-bold uppercase tracking-wide text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>{label}</span>
                                <span className="font-bold text-app-foreground truncate text-right" style={{ fontSize: 'var(--tp-md)' }}>{value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'audit' && <MobileTemplateAudit tplId={tpl.id} />}
            </div>

            <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2"
                style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 55%, transparent)', background: 'var(--app-surface)' }}>
                <button onClick={onToggleArchive}
                    className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                    style={{
                        fontSize: 'var(--tp-md)', height: 42, padding: '0 14px',
                        color: 'var(--app-warning, #f59e0b)',
                        background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)',
                    }}>
                    <Archive size={14} /> {tpl.is_archived ? 'Restore' : 'Archive'}
                </button>
                {isStaff && (
                    <button onClick={onDelete}
                        className="flex items-center justify-center gap-1.5 rounded-xl active:scale-[0.97] transition-transform font-bold flex-shrink-0"
                        style={{
                            fontSize: 'var(--tp-md)', height: 42, padding: '0 14px',
                            color: 'var(--app-error, #ef4444)',
                            background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)',
                        }}>
                        <Trash2 size={14} />
                    </button>
                )}
                <button onClick={onEdit}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl active:scale-[0.98] transition-transform font-bold"
                    style={{
                        fontSize: 'var(--tp-md)', height: 42,
                        color: '#fff', background: 'var(--app-primary)',
                        boxShadow: '0 2px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    <Pencil size={14} /> Edit
                </button>
            </div>
        </div>
    )
}


/* ─── Audit timeline (mobile-tuned) ─── */
type AuditFC = { field_name: string; old_value: string | null; new_value: string | null }
type AuditEntry = { id: number; action: string; timestamp: string; username?: string; field_changes?: AuditFC[] }
function fmtAgo(ts: string) {
    const ms = Date.now() - new Date(ts).getTime()
    if (Number.isNaN(ms)) return ts
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d}d ago`
    return new Date(ts).toLocaleDateString()
}
function MobileTemplateAudit({ tplId }: { tplId: number }) {
    const [rows, setRows] = useState<AuditEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    useEffect(() => {
        let cancelled = false
        setLoading(true); setError(null)
        erpFetch(`inventory/audit-trail/?resource_type=unitpackage&resource_id=${tplId}&limit=80`)
            .then((d: unknown) => {
                if (cancelled) return
                const list = Array.isArray(d) ? d : ((d as { results?: AuditEntry[] })?.results ?? [])
                setRows(list as AuditEntry[])
            })
            .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load') })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [tplId])
    if (loading) return <div className="flex items-center justify-center py-8"><Loader2 size={16} className="animate-spin text-app-muted-foreground" /></div>
    if (error) return <div className="text-app-muted-foreground py-4 text-center" style={{ fontSize: 'var(--tp-sm)' }}>Audit log unavailable.</div>
    if (rows.length === 0) return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
            <History size={20} className="text-app-muted-foreground mb-2 opacity-40" />
            <p className="font-bold text-app-muted-foreground" style={{ fontSize: 'var(--tp-md)' }}>No history yet</p>
        </div>
    )
    return (
        <div className="space-y-2">
            <p className="font-bold uppercase tracking-wide text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>
                {rows.length} event{rows.length === 1 ? '' : 's'}
            </p>
            {rows.map(e => {
                const tail = (e.action.split('.').pop() || '').toLowerCase()
                const tone =
                    tail === 'create' ? { bg: 'var(--app-success)' }
                    : tail === 'delete' ? { bg: 'var(--app-error)' }
                    : { bg: 'var(--app-info, #3b82f6)' }
                return (
                    <div key={e.id} className="rounded-2xl p-2.5 space-y-1.5"
                         style={{ background: 'var(--app-bg)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold uppercase tracking-widest rounded-full px-2 py-0.5"
                                style={{ fontSize: 'var(--tp-xxs)', background: `color-mix(in srgb, ${tone.bg} 14%, transparent)`, color: tone.bg }}>
                                {tail || e.action}
                            </span>
                            <span className="flex items-center gap-1 text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>
                                <UserIcon size={10} /><span className="truncate max-w-[100px]">{e.username || 'system'}</span>
                            </span>
                            <span className="text-app-muted-foreground" style={{ fontSize: 'var(--tp-xxs)' }}>
                                {fmtAgo(e.timestamp)}
                            </span>
                        </div>
                        {e.field_changes && e.field_changes.length > 0 && (
                            <div className="space-y-0.5">
                                {e.field_changes.map((fc, i) => (
                                    <div key={i} className="flex items-center gap-1 flex-wrap" style={{ fontSize: 'var(--tp-xs)' }}>
                                        <span className="font-mono font-bold text-app-foreground">{fc.field_name}</span>
                                        <span className="font-mono px-1 rounded text-app-muted-foreground"
                                            style={{ background: 'color-mix(in srgb, var(--app-error) 6%, transparent)', textDecoration: 'line-through' }}>
                                            {fc.old_value ?? '∅'}
                                        </span>
                                        <ChevronRight size={9} className="opacity-50" />
                                        <span className="font-mono px-1 rounded text-app-foreground"
                                            style={{ background: 'color-mix(in srgb, var(--app-success) 6%, transparent)' }}>
                                            {fc.new_value ?? '∅'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
