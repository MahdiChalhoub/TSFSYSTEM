// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Tag, Loader2, AlertTriangle, Unlink, Pencil, ShieldAlert, ArrowRightLeft, Package, Barcode, X, ArrowRight, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'

/* ═══════════════════════════════════════════════════════════
 *  Attributes Tab — pre-register / unlink + full conflict guard
 *  
 *  Guard mirrors the BrandsTab pattern:
 *  1. Unlink attempt → backend returns 409 with affected products
 *  2. Conflict dialog shows products with barcode severity
 *  3. Per-product "Edit" button (attributes are complex — no bulk dropdown)
 *  4. Only when all products reassigned → Refresh & Retry unlinks
 * ═══════════════════════════════════════════════════════════ */
export function AttributesTab({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
    const [linkedAttrs, setLinkedAttrs] = useState<any[]>([])
    const [allAttrs, setAllAttrs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const [conflict, setConflict] = useState<any>(null)
    const [unlinkTarget, setUnlinkTarget] = useState<any>(null) // Pre-flight confirmation
    // Migration flow state
    const [migrateSource, setMigrateSource] = useState<any>(null) // The source group we're migrating away from
    const [migrateTargetId, setMigrateTargetId] = useState<number | ''>('')
    const [migratePreview, setMigratePreview] = useState<any>(null)
    const [migrateMapping, setMigrateMapping] = useState<Record<number, number | ''>>({})
    const [migrateLoading, setMigrateLoading] = useState(false)
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        erpFetch(`inventory/categories/${categoryId}/linked_attributes/`)
            .then((data: any) => {
                setLinkedAttrs(Array.isArray(data?.linked) ? data.linked : [])
                setAllAttrs(Array.isArray(data?.all) ? data.all : [])
                setLoading(false)
            }).catch(() => setLoading(false))
    }, [categoryId])

    useEffect(() => { loadData() }, [loadData])

    const linkedIds = useMemo(() => new Set(linkedAttrs.map(a => a.id)), [linkedAttrs])
    const unlinkedAttrs = allAttrs.filter(a => !linkedIds.has(a.id))

    // No optimistic row — backend decides auto/both/explicit and an early
    // mis-label (e.g. 'explicit' while products are already using it →
    // actually 'both') makes the row flicker.
    const linkAttr = async (attrId: number) => {
        try {
            await erpFetch(`inventory/categories/${categoryId}/link_attribute/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ attribute_id: attrId }),
            })
            toast.success('Attribute pre-registered'); loadData(); router.refresh()
        } catch (e: any) { toast.error(e?.message || 'Failed to link') }
    }

    // Step 1: Pre-flight confirmation — only prompt when products are actually
    // at risk. Zero products → unlink is safe, run it directly and let the
    // success toast confirm. Any products → show the guard with the
    // Migrate / Force / Cancel paths.
    const requestUnlink = (group: any) => {
        if ((group.product_count ?? 0) > 0) {
            setUnlinkTarget(group)
        } else {
            executeUnlink(group.id)
        }
    }

    // Step 2: Execute the actual unlink (backend will still guard with 409 if products remain)
    const executeUnlink = async (attrId: number) => {
        setLinking(true); setConflict(null); setUnlinkTarget(null)
        try {
            await erpFetch(`inventory/categories/${categoryId}/unlink_attribute/`, { method: 'POST', body: JSON.stringify({ attribute_id: attrId }) })
            setLinkedAttrs(prev => prev.filter(a => a.id !== attrId))
            toast.success('Attribute unlinked'); loadData(); router.refresh()
        } catch (e: any) {
            const cd = e?.data || e
            if (cd?.error === 'conflict' && cd?.products) {
                // Attach source attribute ref so the migrate CTA knows which group to migrate from
                const source = linkedAttrs.find(a => a.id === attrId)
                setConflict({ ...cd, _attrId: attrId, _source: source })
            } else {
                toast.error(e?.message || 'Failed to unlink')
            }
        } finally { setLinking(false) }
    }

    // ── Migration flow ──────────────────────────────────────────────────────
    // Open migration from either the conflict dialog (Refresh & Retry isn't
    // enough — the user needs to bulk-move values) or the direct Migrate
    // button on a linked attribute row.
    const openMigrate = useCallback(async (source: any) => {
        setMigrateSource(source)
        setConflict(null); setUnlinkTarget(null)
        setMigrateTargetId(''); setMigrateMapping({})
        setMigrateLoading(true)
        try {
            const preview = await erpFetch(
                `inventory/categories/${categoryId}/migrate_attribute_preview/?source_attribute_id=${source.id}`
            )
            setMigratePreview(preview)
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load migration preview')
            setMigrateSource(null)
        } finally {
            setMigrateLoading(false)
        }
    }, [categoryId])

    const closeMigrate = () => {
        setMigrateSource(null); setMigrateTargetId(''); setMigratePreview(null); setMigrateMapping({})
    }

    // When target changes, re-fetch preview with that target to populate target_values for the mapping
    const selectMigrateTarget = async (targetId: number | '') => {
        setMigrateTargetId(targetId)
        setMigrateMapping({})  // reset mapping when target changes
        if (!migrateSource) return
        setMigrateLoading(true)
        try {
            const qs = targetId ? `&target_attribute_id=${targetId}` : ''
            const preview = await erpFetch(
                `inventory/categories/${categoryId}/migrate_attribute_preview/?source_attribute_id=${migrateSource.id}${qs}`
            )
            setMigratePreview(preview)
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load target values')
        } finally {
            setMigrateLoading(false)
        }
    }

    const applyMigration = async () => {
        if (!migrateSource) return
        setMigrateLoading(true)
        try {
            const body: any = {
                source_attribute_id: migrateSource.id,
                unlink: true,
            }
            if (migrateTargetId) body.target_attribute_id = migrateTargetId
            // Keep only explicit picks; missing entries = drop (null on backend)
            const mapping: Record<string, number | null> = {}
            Object.entries(migrateMapping).forEach(([sv, tv]) => {
                mapping[sv] = tv === '' ? null : tv
            })
            body.value_mapping = mapping
            console.log('[migrate_attribute] POST', body)
            const res: any = await erpFetch(
                `inventory/categories/${categoryId}/migrate_attribute/`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            )
            console.log('[migrate_attribute] response', res)
            const updated = res?.products_updated ?? 0
            const unlinked = !!res?.unlinked
            if (updated === 0 && !unlinked) {
                toast.warning('Nothing to migrate — no products currently use values from this group.', { duration: 5000 })
            } else {
                toast.success(
                    `Migrated ${updated} product${updated === 1 ? '' : 's'}` +
                    (unlinked ? ' and unlinked source' : ''),
                    { duration: 5000 }
                )
            }
            closeMigrate(); loadData(); router.refresh()
        } catch (e: any) {
            console.error('[migrate_attribute] failed', e)
            toast.error(e?.message || 'Migration failed', { duration: 6000 })
        } finally {
            setMigrateLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-xs font-bold text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linkedAttrs.length} attribute group${linkedAttrs.length !== 1 ? 's' : ''} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition-all"
                    style={showLink ? { background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' } : { color: 'var(--app-muted-foreground)' }}>
                    <Plus size={11} /> Pre-register
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-warning) 3%, var(--app-surface))' }}>
                    <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground mb-1.5">Available ({unlinkedAttrs.length})</p>
                    {unlinkedAttrs.length === 0 ? (
                        <p className="text-tp-sm text-app-muted-foreground">All attribute groups are already linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                            {unlinkedAttrs.map(a => (
                                <button key={a.id} onClick={() => linkAttr(a.id)} disabled={linking}
                                    className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
                                    style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)' }}>
                                    <Plus size={9} />{a.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Pre-flight Confirmation (before API call) ── */}
            {unlinkTarget && (
                <div className="flex-shrink-0 px-4 py-3 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error) 4%, var(--app-surface))' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldAlert size={14} style={{ color: 'var(--app-error)' }} />
                        <span className="text-tp-sm font-bold" style={{ color: 'var(--app-error)' }}>
                            ⚠ Unlink "{unlinkTarget.name}"?
                        </span>
                    </div>
                    <p className="text-tp-xs text-app-muted-foreground mb-2">
                        This attribute group is <strong>actively used by products</strong> in this category.
                        Unlinking may affect product barcodes and attribute values. Products with attribute-based
                        barcodes will need manual reassignment.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => openMigrate(unlinkTarget)} disabled={migrateLoading}
                            className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            <ArrowRightLeft size={10} />
                            Migrate & Unlink
                        </button>
                        <button onClick={() => executeUnlink(unlinkTarget.id)} disabled={linking}
                            className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-error)', color: 'white' }}>
                            <AlertTriangle size={10} />
                            {linking ? 'Checking...' : 'Force Unlink'}
                        </button>
                        <button onClick={() => setUnlinkTarget(null)}
                            className="text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground transition-all px-2 py-1">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── Backend Conflict Guard (409 response) ── */}
            {conflict && (
                <div className="flex-shrink-0 px-4 py-3 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error) 4%, var(--app-surface))' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} style={{ color: 'var(--app-error)' }} />
                        <span className="text-tp-sm font-bold text-app-error">Cannot Unlink — {conflict.affected_count} product{conflict.affected_count !== 1 ? 's' : ''} affected</span>
                        {conflict.barcode_count > 0 && (
                            <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>🔒 {conflict.barcode_count} with barcodes</span>
                        )}
                    </div>
                    <p className="text-tp-xs text-app-muted-foreground mb-2">
                        {conflict.message}
                    </p>

                    {/* Product list with per-product edit access */}
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {(conflict.products || []).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-tp-xs py-1.5 px-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
                                <span className="font-mono font-bold text-app-muted-foreground flex-shrink-0">{p.sku}</span>
                                <span className="font-bold text-app-foreground truncate flex-1">{p.name}</span>
                                {p.has_barcode && (
                                    <span className="text-tp-xxs font-bold px-1 py-0.5 rounded flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>BARCODE</span>
                                )}
                                <button onClick={() => window.open(`/inventory/products/${p.id}`, '_blank')}
                                    className="flex items-center gap-1 text-tp-xxs font-bold px-2 py-0.5 rounded transition-all flex-shrink-0" style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    <Pencil size={9} /> Edit
                                </button>
                            </div>
                        ))}
                        {conflict.affected_count > 20 && <p className="text-tp-xs font-bold text-app-muted-foreground px-2">...and {conflict.affected_count - 20} more</p>}
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {conflict._source && (
                            <button onClick={() => openMigrate(conflict._source)} className="flex items-center gap-1 text-tp-xs font-bold px-2.5 py-1 rounded-lg transition-all" style={{ background: 'var(--app-primary)', color: 'white' }}>
                                <ArrowRightLeft size={10} /> Migrate Attribute Values
                            </button>
                        )}
                        <button onClick={() => { setConflict(null); loadData(); router.refresh() }} className="flex items-center gap-1 text-tp-xs font-bold px-2 py-1 rounded-lg transition-all" style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                            <ArrowRightLeft size={10} /> Refresh & Retry
                        </button>
                        <button onClick={() => setConflict(null)} className="text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground transition-all">Dismiss</button>
                    </div>
                </div>
            )}

            {/* ── Migration Panel — map source values → target values, then bulk-reassign ── */}
            {migrateSource && (
                <div className="flex-shrink-0 px-4 py-3 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))' }}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <ArrowRightLeft size={14} style={{ color: 'var(--app-primary)' }} />
                            <span className="text-tp-sm font-bold" style={{ color: 'var(--app-primary)' }}>
                                Migrate "{migrateSource.name}" → ?
                            </span>
                            {migratePreview?.affected_product_count !== undefined && (
                                <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                    {migratePreview.affected_product_count} product{migratePreview.affected_product_count === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>
                        <button onClick={closeMigrate} className="text-app-muted-foreground hover:text-app-foreground"><X size={14} /></button>
                    </div>

                    {/* Target group picker */}
                    <div className="mb-2">
                        <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground mb-1">Target attribute group</p>
                        <select value={migrateTargetId} onChange={e => selectMigrateTarget(e.target.value ? Number(e.target.value) : '')}
                            className="w-full text-tp-sm font-bold px-2 py-1.5 rounded-lg outline-none"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                            <option value="">— Drop all values (no replacement) —</option>
                            {allAttrs.filter(a => a.id !== migrateSource.id).map(a => (
                                <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ''}</option>
                            ))}
                        </select>
                    </div>

                    {/* Per-value mapping — chip pickers instead of <select> so there's
                        no native dropdown latency inside the drawer + backdrop-blur stack. */}
                    {migrateLoading ? (
                        <div className="flex items-center justify-center py-4"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--app-primary)' }} /></div>
                    ) : migratePreview?.source_values?.length > 0 ? (
                        <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar mb-2">
                            {migratePreview.source_values.map((sv: any) => {
                                const picked = migrateMapping[sv.id]
                                const setPick = (v: number | '') =>
                                    setMigrateMapping(prev => ({ ...prev, [sv.id]: v }))
                                const dropActive = picked === '' || picked === undefined
                                return (
                                    <div key={sv.id} className="p-1.5 rounded-lg"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-tp-xs font-bold text-app-foreground truncate">{sv.name}</span>
                                                    {sv.product_count > 0 && (
                                                        <span className="text-tp-xxs font-bold px-1 py-0.5 rounded-full flex-shrink-0"
                                                            style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>
                                                            <Package size={8} className="inline mr-0.5" />{sv.product_count}
                                                        </span>
                                                    )}
                                                </div>
                                                {sv.code && <span className="text-tp-xxs font-mono text-app-muted-foreground">{sv.code}</span>}
                                            </div>
                                            <ArrowRight size={12} className="text-app-muted-foreground flex-shrink-0" />
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            <button type="button" onClick={() => setPick('')}
                                                className="text-tp-xxs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full transition-all"
                                                style={dropActive ? {
                                                    background: 'var(--app-error)', color: 'white',
                                                } : {
                                                    background: 'color-mix(in srgb, var(--app-error) 8%, transparent)',
                                                    color: 'var(--app-error)',
                                                    border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)',
                                                }}>
                                                Drop
                                            </button>
                                            {(migratePreview?.target_values || []).map((tv: any) => {
                                                const on = picked === tv.id
                                                return (
                                                    <button type="button" key={tv.id} onClick={() => setPick(tv.id)}
                                                        className="text-tp-xxs font-bold px-2 py-0.5 rounded-full transition-all"
                                                        style={on ? {
                                                            background: 'var(--app-primary)', color: 'white',
                                                        } : {
                                                            background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                                                            color: 'var(--app-primary)',
                                                            border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                                        }}>
                                                        {tv.name}
                                                    </button>
                                                )
                                            })}
                                            {!migratePreview?.target_values?.length && (
                                                <span className="text-tp-xxs text-app-muted-foreground italic px-1">
                                                    pick a target group first
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <p className="text-tp-xs text-app-muted-foreground py-2">No products currently use values from this group — a direct unlink will succeed.</p>
                    )}

                    <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                        <button onClick={applyMigration} disabled={migrateLoading}
                            className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            {migrateLoading ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                            Apply Migration & Unlink
                        </button>
                        <button onClick={closeMigrate}
                            className="text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground transition-all px-2 py-1">
                            Cancel
                        </button>
                        <span className="text-tp-xxs text-app-muted-foreground ml-auto">
                            Unmapped values will be dropped from products.
                        </span>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-warning)' }} /></div>
                ) : linkedAttrs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Tag size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">No attribute groups linked</p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">Attribute groups appear automatically when products use them.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {linkedAttrs.map((group: any) => {
                            const pc = group.product_count ?? 0
                            const bc = group.barcode_count ?? 0
                            const hasProducts = pc > 0
                            return (
                                <div key={group.id} className="flex items-center gap-3 px-4 py-2.5 group transition-all hover:bg-app-surface/50">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}><Tag size={12} /></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <p className="text-tp-md font-bold text-app-foreground truncate">{group.name}</p>
                                            <span className="text-tp-xxs font-bold px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                                                style={group.source === 'auto' || group.source === 'both' ? { background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' } : { background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                                                {group.source === 'auto' ? 'AUTO' : group.source === 'both' ? 'AUTO' : 'PRE-REG'}
                                            </span>
                                            {/* Product count badge — always shown so users know impact before unlinking */}
                                            <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0"
                                                style={hasProducts
                                                    ? { background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }
                                                    : { background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                                <Package size={9} />{pc} product{pc === 1 ? '' : 's'}
                                            </span>
                                            {bc > 0 && (
                                                <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
                                                    <Barcode size={9} />{bc} with barcode
                                                </span>
                                            )}
                                            {/* Danger indicator for auto-linked attributes */}
                                            {(group.source === 'auto' || group.source === 'both') && hasProducts && (
                                                <span className="text-tp-xxs font-bold px-1 py-0.5 rounded flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)' }}>
                                                    IN USE
                                                </span>
                                            )}
                                        </div>
                                        {group.code && <p className="text-tp-xs font-mono font-bold text-app-muted-foreground">{group.code}</p>}
                                    </div>
                                    {/* Actions: always visible on touch / small screens (no hover),
                                        hover-gated from md+. The opacity-0 variant also disables
                                        pointer events so an invisible button can never swallow a
                                        tap meant for the row itself. */}
                                    <div className="flex items-center gap-1 transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto">
                                        {hasProducts && (
                                            <button onClick={(e) => { e.stopPropagation(); openMigrate(group) }} disabled={migrateLoading}
                                                className="flex items-center gap-1 text-tp-xxs font-bold px-2 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                                style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)', minHeight: 32 }}
                                                title="Migrate attribute values to another group before unlinking">
                                                <ArrowRightLeft size={10} />Migrate
                                            </button>
                                        )}
                                        <button onClick={(e) => { e.stopPropagation(); requestUnlink(group) }} disabled={linking}
                                            className="flex items-center gap-1 text-tp-xxs font-bold px-2 py-1.5 rounded-lg transition-all disabled:opacity-50"
                                            style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', minHeight: 32 }}>
                                            <Unlink size={10} />Unlink
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
             *  MODAL OVERLAYS — always visible regardless of tab scroll /
             *  drawer height. The inline panels above handle the in-tab
             *  workflow; these guarantee the user sees the guard and the
             *  backend 409 conflict even when the drawer clips content.
             * ═══════════════════════════════════════════════════════════ */}
            <DeleteConflictDialog
                conflict={conflict ? {
                    error: 'conflict',
                    entity: 'attribute',
                    affected_count: conflict.affected_count,
                    barcode_count: conflict.barcode_count,
                    message: conflict.message,
                    products: conflict.products,
                } : null}
                sourceName={conflict?._source?.name || 'attribute'}
                entityName="attribute"
                targets={[]}
                migrateDisabled
                onMigrate={async () => { /* in-tab migration handles mapping */ }}
                onForceDelete={async () => {
                    // Force-unlink: the backend accepts force=true in the body
                    // (see unlink_attribute view). Products keep their
                    // attribute_values — only the explicit category↔attribute
                    // M2M link is removed. User is warned in the dialog copy.
                    const attrId = conflict?._attrId
                    if (!attrId) return
                    try {
                        await erpFetch(`inventory/categories/${categoryId}/unlink_attribute/`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ attribute_id: attrId, force: true }),
                        })
                        toast.success('Attribute force-unlinked (product tags kept)')
                        setConflict(null); loadData(); router.refresh()
                    } catch (e: any) {
                        toast.error(e?.message || 'Failed to force-unlink — open the product pages and reassign values manually.')
                    }
                }}
                onCancel={() => setConflict(null)}
            />
        </div>
    )
}
