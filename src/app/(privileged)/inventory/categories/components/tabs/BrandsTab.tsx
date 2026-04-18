// @ts-nocheck
'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Plus, Paintbrush, Loader2, AlertTriangle, Unlink, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

/* ═══════════════════════════════════════════════════════════
 *  Brands Tab — pre-register / unlink + conflict resolution
 * ═══════════════════════════════════════════════════════════ */
export function BrandsTab({ categoryId, categoryName }: { categoryId: number; categoryName: string }) {
    const [linkedBrands, setLinkedBrands] = useState<any[]>([])
    const [allBrands, setAllBrands] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [linking, setLinking] = useState(false)
    const [showLink, setShowLink] = useState(false)
    const [conflict, setConflict] = useState<any>(null)
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

    const linkBrand = async (brandId: number) => {
        const brandObj = allBrands.find(b => b.id === brandId)
        if (brandObj) setLinkedBrands(prev => [...prev, { ...brandObj, product_count: 0, source: 'explicit' }])
        try {
            await erpFetch(`inventory/categories/${categoryId}/link_brand/`, { method: 'POST', body: JSON.stringify({ brand_id: brandId }) })
            toast.success('Brand pre-registered')
            loadData(); router.refresh()
        } catch (e: any) { toast.error(e?.message || 'Failed to link'); loadData() }
    }

    const unlinkBrand = async (brandId: number) => {
        setLinking(true); setConflict(null)
        try {
            await erpFetch(`inventory/categories/${categoryId}/unlink_brand/`, { method: 'POST', body: JSON.stringify({ brand_id: brandId }) })
            setLinkedBrands(prev => prev.filter(b => b.id !== brandId))
            toast.success('Brand unlinked'); loadData(); router.refresh()
        } catch (e: any) {
            const cd = e?.data || e
            if (cd?.error === 'conflict' && cd?.products) setConflict({ ...cd, _brandId: brandId })
            else toast.error(e?.message || 'Failed to unlink')
        } finally { setLinking(false) }
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-[10px] font-bold text-app-muted-foreground">
                    {loading ? 'Loading...' : `${linkedBrands.length} brand${linkedBrands.length !== 1 ? 's' : ''} linked`}
                </p>
                <button onClick={() => setShowLink(!showLink)}
                    className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all"
                    style={showLink ? { background: 'color-mix(in srgb, #8b5cf6 10%, transparent)', color: '#8b5cf6' } : { color: 'var(--app-muted-foreground)' }}>
                    <Plus size={11} /> Pre-register
                </button>
            </div>

            {showLink && (
                <div className="flex-shrink-0 px-4 py-2.5 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, #8b5cf6 3%, var(--app-surface))' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5">Available ({unlinkedBrands.length})</p>
                    {unlinkedBrands.length === 0 ? (
                        <p className="text-[11px] text-app-muted-foreground">All brands are already linked.</p>
                    ) : (
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                            {unlinkedBrands.map(b => (
                                <button key={b.id} onClick={() => linkBrand(b.id)} disabled={linking}
                                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all hover:brightness-110 disabled:opacity-50"
                                    style={{ background: 'color-mix(in srgb, #8b5cf6 8%, transparent)', color: '#8b5cf6', border: '1px solid color-mix(in srgb, #8b5cf6 15%, transparent)' }}>
                                    <Plus size={9} />{b.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Conflict Dialog */}
            {conflict && (
                <div className="flex-shrink-0 px-4 py-3 animate-in slide-in-from-top-2 duration-200"
                    style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-error) 4%, var(--app-surface))' }}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} style={{ color: 'var(--app-error)' }} />
                        <span className="text-[11px] font-black text-app-error">Cannot Unlink — {conflict.affected_count} product{conflict.affected_count !== 1 ? 's' : ''} affected</span>
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mb-2">{conflict.message}</p>
                    <div className="flex items-center gap-2 mb-2 py-1.5 px-2 rounded-lg"
                        style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                        <span className="text-[10px] font-bold text-app-foreground whitespace-nowrap">Reassign all to:</span>
                        <select id="bulk-brand-select" className="flex-1 text-[10px] font-bold rounded-md px-2 py-1 bg-transparent border border-app-border text-app-foreground" defaultValue="">
                            <option value="" disabled>Select brand...</option>
                            {allBrands.filter(b => b.id !== conflict._brandId).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <button onClick={async () => {
                            const sel = document.getElementById('bulk-brand-select') as HTMLSelectElement
                            const newBrandId = parseInt(sel?.value)
                            if (!newBrandId) { toast.error('Select a target brand'); return }
                            setLinking(true); let ok = 0
                            for (const p of conflict.products || []) { try { await erpFetch(`inventory/products/${p.id}/`, { method: 'PATCH', body: JSON.stringify({ brand: newBrandId }) }); ok++ } catch {} }
                            toast.success(`${ok} product${ok !== 1 ? 's' : ''} reassigned`); setConflict(null); setLinking(false); loadData(); router.refresh()
                        }} disabled={linking} className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all disabled:opacity-50" style={{ background: 'var(--app-primary)', color: 'white' }}>
                            {linking ? 'Working...' : 'Reassign All'}
                        </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                        {(conflict.products || []).map((p: any) => (
                            <div key={p.id} className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--app-error) 4%, transparent)' }}>
                                <span className="font-mono font-bold text-app-muted-foreground flex-shrink-0">{p.sku}</span>
                                <span className="font-bold text-app-foreground truncate flex-1">{p.name}</span>
                                <select id={`brand-sel-${p.id}`} className="text-[10px] font-bold rounded-md px-1.5 py-0.5 bg-transparent border border-app-border text-app-foreground max-w-[100px]" defaultValue="">
                                    <option value="" disabled>Brand...</option>
                                    {allBrands.filter(b => b.id !== conflict._brandId).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <button onClick={async () => {
                                    const sel = document.getElementById(`brand-sel-${p.id}`) as HTMLSelectElement
                                    const newBrandId = parseInt(sel?.value)
                                    if (!newBrandId) { toast.error('Select a brand'); return }
                                    try {
                                        await erpFetch(`inventory/products/${p.id}/`, { method: 'PATCH', body: JSON.stringify({ brand: newBrandId }) })
                                        toast.success(`${p.name} reassigned`)
                                        setConflict((prev: any) => { if (!prev) return null; const remaining = prev.products.filter((x: any) => x.id !== p.id); if (remaining.length === 0) { loadData(); return null }; return { ...prev, products: remaining, affected_count: remaining.length } })
                                    } catch (e: any) { toast.error(e?.message || 'Failed to reassign') }
                                }} className="text-[9px] font-black px-1.5 py-0.5 rounded transition-all flex-shrink-0" style={{ background: 'var(--app-primary)', color: 'white' }}>✓</button>
                            </div>
                        ))}
                        {conflict.affected_count > 20 && <p className="text-[10px] font-bold text-app-muted-foreground px-2">...and {conflict.affected_count - 20} more</p>}
                    </div>
                    <button onClick={() => setConflict(null)} className="mt-2 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all">Dismiss</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16"><Loader2 size={22} className="animate-spin" style={{ color: '#8b5cf6' }} /></div>
                ) : linkedBrands.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                        <Paintbrush size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">No brands linked</p>
                        <p className="text-[11px] text-app-muted-foreground mt-1">Brands appear automatically when products use them.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-app-border/30">
                        {linkedBrands.map((b: any) => (
                            <div key={b.id} className="flex items-center gap-3 px-4 py-2 group transition-all hover:bg-app-surface/50">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, #8b5cf6 10%, transparent)', color: '#8b5cf6' }}><Paintbrush size={12} /></div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-[12px] font-bold text-app-foreground truncate">{b.name}</p>
                                        <span className="text-[8px] font-black px-1 py-0.5 rounded uppercase tracking-wider flex-shrink-0"
                                            style={b.source === 'auto' || b.source === 'both' ? { background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' } : { background: 'color-mix(in srgb, #8b5cf6 10%, transparent)', color: '#8b5cf6' }}>
                                            {b.source === 'auto' ? 'AUTO' : b.source === 'both' ? 'AUTO' : 'PRE-REG'}
                                        </span>
                                    </div>
                                    {b.product_count != null && <p className="text-[10px] font-bold text-app-muted-foreground">{b.product_count} product{b.product_count !== 1 ? 's' : ''}</p>}
                                </div>
                                <button onClick={() => unlinkBrand(b.id)} disabled={linking}
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
