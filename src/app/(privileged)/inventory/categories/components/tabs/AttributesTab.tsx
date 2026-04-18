// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Tag, Loader2, AlertTriangle, Unlink, Pencil, ShieldAlert, ArrowRightLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

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

    const linkAttr = async (attrId: number) => {
        const attrObj = allAttrs.find(a => a.id === attrId)
        if (attrObj) setLinkedAttrs(prev => [...prev, { ...attrObj, source: 'explicit' }])
        try {
            await erpFetch(`inventory/categories/${categoryId}/link_attribute/`, { method: 'POST', body: JSON.stringify({ attribute_id: attrId }) })
            toast.success('Attribute pre-registered'); loadData(); router.refresh()
        } catch (e: any) { toast.error(e?.message || 'Failed to link'); loadData() }
    }

    // Step 1: Pre-flight confirmation — show warning before even attempting API
    const requestUnlink = (group: any) => {
        // If source is 'auto' or 'both', products are using this — show pre-flight warning
        if (group.source === 'auto' || group.source === 'both') {
            setUnlinkTarget(group)
        } else {
            // PRE-REG only — safe to proceed directly
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
                setConflict({ ...cd, _attrId: attrId })
            } else {
                toast.error(e?.message || 'Failed to unlink')
            }
        } finally { setLinking(false) }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-[10px] font-bold text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linkedAttrs.length} attribute group${linkedAttrs.length !== 1 ? 's' : ''} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all"
                    style={showLink ? { background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' } : { color: 'var(--app-muted-foreground)' }}>
                    <Plus size={11} /> Pre-register
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-warning) 3%, var(--app-surface))' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">Available ({unlinkedAttrs.length})</p>
                    {unlinkedAttrs.length === 0 ? (
                        <p className="text-[11px] text-app-muted-foreground">All attribute groups are already linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                            {unlinkedAttrs.map(a => (
                                <button key={a.id} onClick={() => linkAttr(a.id)} disabled={linking}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
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
                        <span className="text-[11px] font-black" style={{ color: 'var(--app-error)' }}>
                            ⚠ Unlink "{unlinkTarget.name}"?
                        </span>
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mb-2">
                        This attribute group is <strong>actively used by products</strong> in this category.
                        Unlinking may affect product barcodes and attribute values. Products with attribute-based
                        barcodes will need manual reassignment.
                    </p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => executeUnlink(unlinkTarget.id)} disabled={linking}
                            className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-error)', color: 'white' }}>
                            <AlertTriangle size={10} />
                            {linking ? 'Checking...' : 'Proceed with Unlink'}
                        </button>
                        <button onClick={() => setUnlinkTarget(null)}
                            className="text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all px-2 py-1">
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
                        <span className="text-[11px] font-black text-app-error">Cannot Unlink — {conflict.affected_count} product{conflict.affected_count !== 1 ? 's' : ''} affected</span>
                        {conflict.barcode_count > 0 && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-error) 12%, transparent)', color: 'var(--app-error)' }}>🔒 {conflict.barcode_count} with barcodes</span>
                        )}
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mb-2">
                        {conflict.message}
                    </p>

                    {/* Product list with per-product edit access */}
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {(conflict.products || []).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
                                <span className="font-mono font-bold text-app-muted-foreground flex-shrink-0">{p.sku}</span>
                                <span className="font-bold text-app-foreground truncate flex-1">{p.name}</span>
                                {p.has_barcode && (
                                    <span className="text-[8px] font-black px-1 py-0.5 rounded flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>BARCODE</span>
                                )}
                                <button onClick={() => window.open(`/inventory/products/${p.id}`, '_blank')}
                                    className="flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded transition-all flex-shrink-0" style={{ background: 'var(--app-primary)', color: 'white' }}>
                                    <Pencil size={9} /> Edit
                                </button>
                            </div>
                        ))}
                        {conflict.affected_count > 20 && <p className="text-[10px] font-bold text-app-muted-foreground px-2">...and {conflict.affected_count - 20} more</p>}
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <button onClick={() => { setConflict(null); loadData(); router.refresh() }} className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all" style={{ background: 'var(--app-primary)', color: 'white' }}>
                            <ArrowRightLeft size={10} /> Refresh & Retry
                        </button>
                        <button onClick={() => setConflict(null)} className="text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all">Dismiss</button>
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
                        <p className="text-[11px] text-app-muted-foreground mt-1">Attribute groups appear automatically when products use them.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {linkedAttrs.map((group: any) => (
                            <div key={group.id} className="flex items-center gap-3 px-4 py-2.5 group transition-all hover:bg-app-surface/50">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}><Tag size={12} /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[12px] font-bold text-app-foreground truncate">{group.name}</p>
                                        <span className="text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                                            style={group.source === 'auto' || group.source === 'both' ? { background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' } : { background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                                            {group.source === 'auto' ? 'AUTO' : group.source === 'both' ? 'AUTO' : 'PRE-REG'}
                                        </span>
                                        {/* Danger indicator for auto-linked attributes */}
                                        {(group.source === 'auto' || group.source === 'both') && (
                                            <span className="text-[8px] font-black px-1 py-0.5 rounded flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)' }}>
                                                IN USE
                                            </span>
                                        )}
                                    </div>
                                    {group.code && <p className="text-[10px] font-mono font-bold text-app-muted-foreground">{group.code}</p>}
                                </div>
                                <button onClick={() => requestUnlink(group)} disabled={linking}
                                    className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                    style={{ color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 8%, transparent)' }}>
                                    <Unlink size={10} />Unlink
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
