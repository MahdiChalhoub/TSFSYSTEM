// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Paintbrush, Loader2, AlertTriangle, Unlink, ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { DeleteConflictDialog } from '@/components/ui/DeleteConflictDialog'

/* ═══════════════════════════════════════════════════════════
 *  Brands Tab — pre-register / unlink + conflict resolution
 *  Mirrors AttributesTab: pre-flight warning when products
 *  reference the brand, inline reassign-all, and a modal
 *  DeleteConflictDialog fallback for the 409 guard so the user
 *  always sees it regardless of drawer clipping.
 * ═══════════════════════════════════════════════════════════ */
export function BrandsTab({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
    const [linkedBrands, setLinkedBrands] = useState<any[]>([])
    const [allBrands, setAllBrands] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const [conflict, setConflict] = useState<any>(null)
    const [unlinkTarget, setUnlinkTarget] = useState<any>(null)
    const [bulkTargetId, setBulkTargetId] = useState<string>('')
    const [reassigning, setReassigning] = useState(false)
    const router = useRouter()

    const loadData = useCallback(() => {
        setLoading(true)
        erpFetch(`inventory/categories/${categoryId}/linked_brands/`)
            .then((data: any) => {
                setLinkedBrands(Array.isArray(data?.linked) ? data.linked : [])
                setAllBrands(Array.isArray(data?.all) ? data.all : [])
                setLoading(false)
            }).catch(() => setLoading(false))
    }, [categoryId])

    useEffect(() => { loadData() }, [loadData])

    const linkedIds = useMemo(() => new Set(linkedBrands.map(b => b.id)), [linkedBrands])
    const unlinkedBrands = allBrands.filter(b => !linkedIds.has(b.id))

    // Link: no optimistic source label — backend decides auto/both/explicit.
    // We wait for loadData() so the row always reflects reality.
    const linkBrand = async (brandId: number) => {
        setLinking(true)
        try {
            await erpFetch(`inventory/categories/${categoryId}/link_brand/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand_id: brandId }),
            })
            toast.success('Brand pre-registered')
            loadData(); router.refresh()
        } catch (e: any) {
            toast.error(e?.message || 'Failed to link')
        } finally { setLinking(false) }
    }

    // Pre-flight: only prompt when products are affected. Zero products →
    // unlink immediately and show a success toast.
    const requestUnlink = (brand: any) => {
        if ((brand.product_count ?? 0) > 0) setUnlinkTarget(brand)
        else executeUnlink(brand.id)
    }

    const executeUnlink = async (brandId: number, force = false) => {
        setLinking(true); setConflict(null); setUnlinkTarget(null)
        try {
            const url = force
                ? `inventory/categories/${categoryId}/unlink_brand/?force=1`
                : `inventory/categories/${categoryId}/unlink_brand/`
            await erpFetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brand_id: brandId, ...(force ? { force: true } : {}) }),
            })
            toast.success(force ? 'Brand force-unlinked (pre-registration removed)' : 'Brand unlinked')
            loadData(); router.refresh()
        } catch (e: any) {
            const cd = e?.data || e
            if (cd?.error === 'conflict' && cd?.products) {
                setConflict({ ...cd, _brandId: brandId })
            } else {
                toast.error(e?.message || 'Failed to unlink')
            }
        } finally { setLinking(false) }
    }

    // Bulk reassign: parallel PATCH with allSettled so one failure doesn't
    // silently swallow the rest. Surfaces an accurate success/failure count.
    const bulkReassign = async () => {
        if (!conflict) return
        const newBrandId = parseInt(bulkTargetId)
        if (!newBrandId) { toast.error('Select a target brand'); return }
        setReassigning(true)
        try {
            const results = await Promise.allSettled(
                (conflict.products || []).map((p: any) =>
                    erpFetch(`inventory/products/${p.id}/`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ brand: newBrandId }),
                    })
                )
            )
            const ok = results.filter(r => r.status === 'fulfilled').length
            const failed = results.length - ok
            if (failed > 0) {
                toast.error(
                    `${ok} product${ok !== 1 ? 's' : ''} reassigned, ${failed} failed — open them manually`,
                    { duration: 8000 }
                )
            } else {
                toast.success(`${ok} product${ok !== 1 ? 's' : ''} reassigned`)
            }
            setConflict(null); setBulkTargetId(''); loadData(); router.refresh()
        } finally { setReassigning(false) }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-sm font-medium text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linkedBrands.length} brand${linkedBrands.length !== 1 ? 's' : ''} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-tp-xs font-bold uppercase tracking-wide px-2 py-1 rounded-lg transition-colors"
                    style={showLink ? { background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' } : { color: 'var(--app-muted-foreground)' }}>
                    <Plus size={11} /> Pre-register
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-info) 3%, var(--app-surface))' }}>
                    <p className="text-tp-xs font-bold uppercase tracking-wide text-app-muted-foreground mb-1.5">Available ({unlinkedBrands.length})</p>
                    {unlinkedBrands.length === 0 ? (
                        <p className="text-tp-sm text-app-muted-foreground">All brands are already linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                            {unlinkedBrands.map(b => (
                                <button key={b.id} onClick={() => linkBrand(b.id)} disabled={linking}
                                    className="flex items-center gap-1 text-tp-sm font-semibold px-2 py-1 rounded-lg transition-colors hover:brightness-110 disabled:opacity-50"
                                    style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', color: 'var(--app-info)', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
                                    <Plus size={10} />{b.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Pre-flight confirmation (before API call) ── */}
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
                        <strong>{unlinkTarget.product_count}</strong> product{unlinkTarget.product_count !== 1 ? 's' : ''} in this category use this brand.
                        Force-unlink removes the pre-registration only — products keep the brand FK and the auto-link will
                        reappear until you reassign them.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => executeUnlink(unlinkTarget.id, true)} disabled={linking}
                            className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-error)', color: 'white' }}>
                            <AlertTriangle size={10} />
                            {linking ? 'Checking…' : 'Force Unlink'}
                        </button>
                        <button onClick={() => executeUnlink(unlinkTarget.id, false)} disabled={linking}
                            className="flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            Try Unlink (shows reassign)
                        </button>
                        <button onClick={() => setUnlinkTarget(null)}
                            className="text-tp-xs font-bold text-app-muted-foreground hover:text-app-foreground transition-all px-2 py-1">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── Backend 409 conflict — inline reassign helper (products list) ── */}
            {conflict && (
                <div className="flex-shrink-0 px-4 py-3 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error) 4%, var(--app-surface))' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} style={{ color: 'var(--app-error)' }} />
                        <span className="text-tp-md font-bold text-app-error">Cannot Unlink — {conflict.affected_count} product{conflict.affected_count !== 1 ? 's' : ''} affected</span>
                        {conflict.barcode_count > 0 && (
                            <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>
                                🔒 {conflict.barcode_count} with barcodes
                            </span>
                        )}
                    </div>
                    <p className="text-tp-sm text-app-muted-foreground mb-2">{conflict.message}</p>
                    <div className="flex items-center gap-2 mb-2 py-1.5 px-2 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                        <span className="text-tp-sm font-semibold text-app-foreground whitespace-nowrap">Reassign all to:</span>
                        <select value={bulkTargetId} onChange={e => setBulkTargetId(e.target.value)}
                            className="flex-1 text-tp-sm font-semibold rounded-md px-2 py-1 bg-transparent border border-app-border text-app-foreground">
                            <option value="" disabled>Select brand...</option>
                            {allBrands.filter(b => b.id !== conflict._brandId).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <button onClick={bulkReassign} disabled={reassigning}
                            className="text-tp-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            {reassigning ? 'Working…' : 'Reassign All'}
                        </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {(conflict.products || []).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-tp-sm py-1.5 px-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
                                <span className="font-mono font-semibold text-app-muted-foreground flex-shrink-0">{p.sku}</span>
                                <span className="font-medium text-app-foreground truncate flex-1">{p.name}</span>
                                {p.has_barcode && (
                                    <span className="text-tp-xxs font-bold px-1 py-0.5 rounded flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>BARCODE</span>
                                )}
                                <button onClick={() => window.open(`/inventory/products/${p.id}`, '_blank')}
                                    className="text-tp-xxs font-bold px-1.5 py-0.5 rounded transition-colors flex-shrink-0"
                                    style={{ background: 'var(--app-primary)', color: 'white' }}>Open</button>
                            </div>
                        ))}
                        {conflict.affected_count > 20 && <p className="text-tp-sm font-medium text-app-muted-foreground px-2">...and {conflict.affected_count - 20} more</p>}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => executeUnlink(conflict._brandId, true)}
                            className="text-tp-xxs font-bold uppercase tracking-wide px-2 py-1 rounded-lg"
                            style={{ background: 'var(--app-error)', color: 'white' }}>
                            Force Unlink
                        </button>
                        <button onClick={() => setConflict(null)} className="text-tp-sm font-medium text-app-muted-foreground hover:text-app-foreground transition-colors">Dismiss</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-info)' }} /></div>
                ) : linkedBrands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Paintbrush size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-tp-md font-semibold text-app-muted-foreground">No brands linked</p>
                        <p className="text-tp-sm text-app-muted-foreground mt-1">Brands appear automatically when products use them.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {linkedBrands.map((b: any) => (
                            <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}><Paintbrush size={13} /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-tp-md font-semibold text-app-foreground truncate">{b.name}</p>
                                        <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                                            style={b.source === 'auto' || b.source === 'both' ? { background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' } : { background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                            {b.source === 'auto' ? 'AUTO' : b.source === 'both' ? 'AUTO' : 'PRE-REG'}
                                        </span>
                                    </div>
                                    {b.product_count != null && <p className="text-tp-sm font-medium text-app-muted-foreground">{b.product_count} product{b.product_count !== 1 ? 's' : ''}</p>}
                                </div>
                                {/* Action button: always visible on touch/narrow viewports (no hover),
                                    hover-gated from md+ where the group-hover pattern works. */}
                                <button onClick={() => requestUnlink(b)} disabled={linking}
                                    className="flex items-center gap-1 text-tp-xs font-semibold px-2 py-1 rounded-lg transition-all disabled:opacity-50 opacity-100 md:opacity-0 md:group-hover:opacity-100 pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto"
                                    style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', minHeight: 32 }}>
                                    <Unlink size={11} />Unlink
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal fallback — guarantees the 409 guard is always visible,
                even when the inline panel gets clipped by the drawer. */}
            <DeleteConflictDialog
                conflict={conflict ? {
                    error: 'conflict',
                    entity: 'brand',
                    affected_count: conflict.affected_count,
                    barcode_count: conflict.barcode_count,
                    message: conflict.message,
                    products: conflict.products,
                } : null}
                sourceName={conflict?._brandName || 'brand'}
                entityName="brand"
                targets={allBrands
                    .filter(b => b.id !== conflict?._brandId)
                    .map(b => ({ id: b.id, name: b.name }))}
                onMigrate={async (targetId) => {
                    setBulkTargetId(String(targetId))
                    // Defer so the dialog's internal busy state triggers correctly.
                    await new Promise(r => setTimeout(r, 0))
                    await bulkReassign()
                    setConflict(null)
                }}
                onForceDelete={async () => {
                    if (conflict?._brandId) await executeUnlink(conflict._brandId, true)
                }}
                onCancel={() => setConflict(null)}
            />
        </div>
    )
}
