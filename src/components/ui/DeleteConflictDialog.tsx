'use client'

/* ═══════════════════════════════════════════════════════════
 *  DeleteConflictDialog
 *
 *  Shared dialog for the "can't delete — products reference this"
 *  case across Category / Unit / Brand / Attribute. The backend
 *  returns 409 with a typed conflict payload:
 *
 *    {
 *      error: 'conflict',
 *      entity: 'category' | 'unit' | 'brand' | 'attribute',
 *      affected_count: number,
 *      barcode_count: number,
 *      message: string,
 *      products: [{ id, sku, name, barcode, has_barcode }, ...]
 *    }
 *
 *  The dialog surfaces the product list, lets the user pick a
 *  migration target, and offers three paths:
 *    1. Migrate & Delete — reassigns every affected product to
 *       the picked target, then deletes the source.
 *    2. Force Delete — destroys the source without migrating
 *       (products get SET_NULL on whichever FK this is). Used
 *       only when the user explicitly accepts the data loss.
 *    3. Cancel — dismiss.
 *
 *  Usage (from a page):
 *    const [conflict, setConflict] = useState(null)
 *    const [sourceId, setSourceId] = useState(null)
 *    ...
 *    <DeleteConflictDialog
 *      conflict={conflict}
 *      sourceName={node.name}
 *      targets={allOtherNodes}
 *      entityName="category"
 *      onMigrate={async (targetId) => {
 *        await moveProducts({ source_id: sourceId, target_id: targetId })
 *        await deleteCategory(sourceId, { force: true })
 *        setConflict(null); router.refresh()
 *      }}
 *      onForceDelete={async () => {
 *        await deleteCategory(sourceId, { force: true })
 *        setConflict(null); router.refresh()
 *      }}
 *      onCancel={() => setConflict(null)}
 *    />
 * ═══════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react'
import { AlertTriangle, ShieldAlert, Package, Barcode, ArrowRight, X, Loader2, ArrowRightLeft, Trash2 } from 'lucide-react'

export interface ConflictPayload {
    error: string
    entity?: string
    affected_count: number
    barcode_count?: number
    message?: string
    products?: Array<{ id: number; sku?: string; name: string; barcode?: string; has_barcode?: boolean }>
    children?: boolean  // Category-specific: true when sub-categories block the delete
}

export interface MigrationTarget {
    id: number
    name: string
    code?: string
}

export interface DeleteConflictDialogProps {
    /** Conflict payload from the backend's 409 response. null → dialog hidden. */
    conflict: ConflictPayload | null
    /** Human name of the source being deleted (shown in the title). */
    sourceName: string
    /** Entity type — shown in the UI copy. */
    entityName: 'category' | 'unit' | 'brand' | 'attribute'
    /** Available migration targets (excluding the source itself). */
    targets: MigrationTarget[]
    /** Called when user picks a target and clicks Migrate & Delete. */
    onMigrate: (targetId: number) => Promise<void>
    /** Called when user clicks Force Delete (no migration). */
    onForceDelete: () => Promise<void>
    /** Called on Cancel / X / backdrop click. */
    onCancel: () => void
    /** Optional: when true, hides Migrate path (use when migration isn't
     *  supported for this entity, e.g. sub-categories block). */
    migrateDisabled?: boolean
}

export function DeleteConflictDialog({
    conflict, sourceName, entityName, targets,
    onMigrate, onForceDelete, onCancel, migrateDisabled,
}: DeleteConflictDialogProps) {
    const [targetId, setTargetId] = useState<number | ''>('')
    const [busy, setBusy] = useState<'migrate' | 'force' | null>(null)
    const [confirmForce, setConfirmForce] = useState(false)

    // Reset internal state when the conflict payload changes
    useEffect(() => {
        setTargetId(''); setBusy(null); setConfirmForce(false)
    }, [conflict])

    // Escape key dismissal
    useEffect(() => {
        if (!conflict) return
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
        window.addEventListener('keydown', h)
        return () => window.removeEventListener('keydown', h)
    }, [conflict, busy, onCancel])

    if (!conflict) return null

    const { affected_count, barcode_count = 0, products = [], children } = conflict
    const isChildrenBlock = Boolean(children)  // Category-only: sub-categories nested

    const handleMigrate = async () => {
        if (!targetId || busy) return
        setBusy('migrate')
        try { await onMigrate(Number(targetId)) }
        finally { setBusy(null) }
    }
    const handleForce = async () => {
        if (busy) return
        if (!confirmForce) { setConfirmForce(true); return }
        setBusy('force')
        try { await onForceDelete() }
        finally { setBusy(null); setConfirmForce(false) }
    }

    return (
        <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !busy) onCancel() }}
        >
            <div
                className="w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 35%, var(--app-border))',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    maxHeight: 'calc(100vh - 32px)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-3.5 flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                        <ShieldAlert size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-black tracking-tight truncate" style={{ color: 'var(--app-foreground)' }}>
                            Cannot delete "{sourceName}"
                        </h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--app-error, #ef4444)' }}>
                            {isChildrenBlock
                                ? `${affected_count} sub-${entityName}${affected_count !== 1 ? 'ies' : 'y'} nested`
                                : `${affected_count} product${affected_count !== 1 ? 's' : ''} assigned`}
                            {barcode_count > 0 && ` · ${barcode_count} with barcode`}
                        </p>
                    </div>
                    <button onClick={onCancel} disabled={!!busy}
                        className="w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-4">
                    {/* Message from backend */}
                    <p className="text-[12px] leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                        {conflict.message || `This ${entityName} is still in use. You can either migrate the assigned ${isChildrenBlock ? 'sub-items' : 'products'} to another ${entityName}, or force-delete (which will leave them unassigned).`}
                    </p>

                    {/* Sub-category block — no product list, just a hint */}
                    {isChildrenBlock ? (
                        <div className="px-4 py-3 rounded-xl text-[11px] font-bold leading-relaxed"
                            style={{
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)',
                                color: 'var(--app-warning, #f59e0b)',
                            }}>
                            Use the Move tool in the {entityName} tree to reassign sub-{entityName} to another parent first.
                        </div>
                    ) : (
                        <>
                            {/* Product list preview */}
                            <div className="rounded-xl overflow-hidden"
                                style={{ border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                <div className="flex items-center justify-between px-3 py-2 text-[9px] font-black uppercase tracking-widest"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)',
                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                        color: 'var(--app-muted-foreground)',
                                    }}>
                                    <span>Affected Products (preview)</span>
                                    {products.length < affected_count && <span>Showing {products.length} of {affected_count}</span>}
                                </div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                    {products.map(p => (
                                        <div key={p.id}
                                            className="flex items-center gap-2 px-3 py-1.5 border-b last:border-b-0"
                                            style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                            <Package size={10} style={{ color: 'var(--app-muted-foreground)' }} className="flex-shrink-0" />
                                            {p.sku && <span className="font-mono text-[10px] font-bold flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }}>{p.sku}</span>}
                                            <span className="text-[11px] font-bold truncate flex-1" style={{ color: 'var(--app-foreground)' }}>{p.name}</span>
                                            {p.has_barcode && (
                                                <span className="text-[8px] font-black px-1 py-0.5 rounded flex items-center gap-0.5 flex-shrink-0"
                                                    style={{ background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', color: 'var(--app-error, #ef4444)' }}>
                                                    <Barcode size={8} /> BARCODE
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Target picker — the safe path */}
                            {!migrateDisabled && (
                                <div className="rounded-xl px-4 py-3 space-y-2"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                    }}>
                                    <div className="flex items-center gap-2">
                                        <ArrowRightLeft size={13} style={{ color: 'var(--app-primary)' }} />
                                        <span className="text-[11px] font-black uppercase tracking-widest" style={{ color: 'var(--app-primary)' }}>
                                            Migrate products to another {entityName}
                                        </span>
                                    </div>
                                    <select
                                        value={targetId}
                                        onChange={e => setTargetId(e.target.value ? Number(e.target.value) : '')}
                                        disabled={!!busy}
                                        className="w-full text-[12px] font-bold px-3 py-2 rounded-lg outline-none"
                                        style={{
                                            background: 'var(--app-surface)',
                                            border: '1px solid var(--app-border)',
                                            color: 'var(--app-foreground)',
                                        }}
                                    >
                                        <option value="">— pick a target {entityName} —</option>
                                        {targets.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}{t.code ? ` (${t.code})` : ''}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Every affected product will be reassigned to the picked {entityName}, then "{sourceName}" is deleted. Atomic — if any product fails to move, nothing is deleted.
                                    </p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer — action buttons */}
                <div className="px-5 py-3 flex items-center gap-2 flex-shrink-0 flex-wrap"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)', borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onCancel} disabled={!!busy}
                        className="text-[11px] font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-40"
                        style={{ color: 'var(--app-muted-foreground)', background: 'transparent' }}>
                        Cancel
                    </button>
                    <div className="flex-1" />
                    {!migrateDisabled && !isChildrenBlock && (
                        <button onClick={handleMigrate} disabled={!targetId || !!busy}
                            className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-3 py-2 rounded-xl transition-all disabled:opacity-50"
                            style={{
                                background: targetId ? 'var(--app-primary)' : 'var(--app-muted)',
                                color: '#fff',
                                boxShadow: targetId ? '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'none',
                            }}>
                            {busy === 'migrate' ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                            Migrate & Delete
                        </button>
                    )}
                    <button onClick={handleForce} disabled={!!busy || isChildrenBlock}
                        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-3 py-2 rounded-xl border transition-all disabled:opacity-40"
                        style={confirmForce
                            ? { color: '#fff', background: 'var(--app-error, #ef4444)', borderColor: 'var(--app-error, #ef4444)' }
                            : { color: 'var(--app-error, #ef4444)', background: 'color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent)', borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}
                        title={isChildrenBlock ? `Sub-${entityName} must be moved first` : 'Force-delete without migration'}>
                        {busy === 'force' ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        {confirmForce ? 'Click again to confirm' : 'Force Delete'}
                        {!confirmForce && <AlertTriangle size={10} />}
                    </button>
                </div>
            </div>
        </div>
    )
}
