'use client'

import { useState, useTransition, useMemo } from 'react'
import {
    Search, ArrowRightLeft, CheckSquare, Square, X, AlertCircle,
    Layers, Package, Check,
} from 'lucide-react'
import { moveProductsGeneric } from '@/app/actions/maintenance'
import { createGroupFromProducts } from '@/app/actions/product-groups'
import { CategoryTreeSelector } from '../CategoryTreeSelector'

/* ═══════════════════════════════════════════════════════════
 *  UnifiedReassignmentTable — bulk reassign products from the
 *  current entity bucket to another of the same type. Reuses
 *  the V2 design tokens (CSS variables) so it switches with
 *  theme and feels native alongside Categories / Attributes.
 * ═══════════════════════════════════════════════════════════ */

type Props = {
    products: any[]
    targetEntities: any[]
    type: 'category' | 'brand' | 'unit' | 'country' | 'attribute'
    currentEntityId: number
}

const TYPE_COLOR: Record<string, string> = {
    category: 'var(--app-primary)',
    brand: 'var(--app-info)',
    attribute: 'var(--app-warning)',
    unit: 'var(--app-success)',
    country: '#8b5cf6',
}

export function UnifiedReassignmentTable({ products, targetEntities, type, currentEntityId }: Props) {
    const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
    const [searchTerm, setSearchTerm] = useState('')
    const [isMoveOpen, setIsMoveOpen] = useState(false)
    const [isGroupOpen, setIsGroupOpen] = useState(false)
    const [targetId, setTargetId] = useState<number | null>(null)
    const [isPending, startTransition] = useTransition()

    const color = TYPE_COLOR[type] || 'var(--app-primary)'

    const filteredProducts = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        if (!q) return products
        return products.filter(p =>
            (p.name || '').toLowerCase().includes(q)
            || (p.sku || '').toLowerCase().includes(q)
        )
    }, [products, searchTerm])

    const toggleSelectAll = () => {
        if (selectedProductIds.length === filteredProducts.length) setSelectedProductIds([])
        else setSelectedProductIds(filteredProducts.map(p => p.id))
    }
    const toggleProduct = (id: number) => {
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        )
    }

    const handleMove = () => {
        if (!targetId) return
        startTransition(async () => {
            const result = await moveProductsGeneric(selectedProductIds, targetId, type)
            if (result.success) {
                setIsMoveOpen(false)
                setSelectedProductIds([])
                setTargetId(null)
            } else {
                alert(result.message)
            }
        })
    }

    const renderTargetSelector = () => {
        if (type === 'category') {
            return (
                <div className="h-64 rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--app-border)' }}>
                    <CategoryTreeSelector
                        categories={targetEntities}
                        selectedIds={targetId ? [targetId] : []}
                        onChange={(ids) => setTargetId(ids[0] || null)}
                        maxHeight="h-full"
                    />
                </div>
            )
        }
        return (
            <div className="h-64 rounded-xl overflow-y-auto custom-scrollbar p-2"
                style={{
                    border: '1px solid var(--app-border)',
                    background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))',
                }}>
                {targetEntities
                    .filter(e => e.id !== currentEntityId)
                    .map(e => {
                        const on = targetId === e.id
                        return (
                            <div key={e.id} onClick={() => setTargetId(e.id)}
                                className="p-2 rounded-lg cursor-pointer flex justify-between items-center transition-all"
                                style={on ? {
                                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                                    border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
                                    color,
                                } : {
                                    background: 'transparent',
                                    border: '1px solid transparent',
                                    color: 'var(--app-foreground)',
                                }}>
                                <span className="text-tp-sm font-medium">{e.name}</span>
                                {e.code && (
                                    <span className="font-mono text-tp-xxs px-1.5 py-0.5 rounded"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                            color: 'var(--app-muted-foreground)',
                                        }}>
                                        {e.code}
                                    </span>
                                )}
                            </div>
                        )
                    })}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full">
            {/* ═══ Toolbar ═══ */}
            <div className="flex-shrink-0 p-3 flex items-center justify-between gap-3"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1 max-w-md">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--app-muted-foreground)' }} />
                        <input type="text" placeholder="Search products…"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-tp-sm outline-none transition-all"
                            style={{
                                background: 'var(--app-background)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)',
                            }} />
                    </div>
                    {selectedProductIds.length > 0 && (
                        <span className="text-tp-xxs font-black uppercase tracking-widest px-2 py-1 rounded-full flex items-center gap-1 animate-in fade-in"
                            style={{
                                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                                color,
                                border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`,
                            }}>
                            <Check size={10} /> {selectedProductIds.length} selected
                        </span>
                    )}
                </div>

                <div className="flex gap-1.5">
                    <button onClick={() => setIsGroupOpen(true)} disabled={selectedProductIds.length === 0}
                        className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                        style={{
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                            color: 'var(--app-muted-foreground)',
                            border: '1px solid var(--app-border)',
                        }}>
                        <Layers size={13} />
                        <span className="hidden sm:inline">Group</span>
                    </button>
                    <button onClick={() => setIsMoveOpen(true)} disabled={selectedProductIds.length === 0}
                        className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                        style={{
                            background: selectedProductIds.length === 0 ? 'var(--app-border)' : color,
                            color: 'white',
                            boxShadow: selectedProductIds.length > 0
                                ? `0 2px 8px color-mix(in srgb, ${color} 30%, transparent)`
                                : 'none',
                        }}>
                        <ArrowRightLeft size={13} />
                        Reassign
                    </button>
                    <button onClick={toggleSelectAll}
                        className="p-1.5 rounded-lg transition-colors"
                        title="Select all"
                        style={{
                            color: 'var(--app-muted-foreground)',
                            background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                        }}>
                        {selectedProductIds.length > 0 && selectedProductIds.length === filteredProducts.length
                            ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                </div>
            </div>

            {/* ═══ Product list ═══ */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {filteredProducts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-2 py-10"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <Package size={24} className="opacity-40" />
                        <p className="text-tp-sm font-bold">
                            {searchTerm ? 'No matching products' : `No products linked to this ${type}`}
                        </p>
                    </div>
                ) : (
                    <ProductList products={filteredProducts}
                        selectedProductIds={selectedProductIds}
                        toggleProduct={toggleProduct}
                        color={color} />
                )}
            </div>

            {/* ═══ Move modal ═══ */}
            {isMoveOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setIsMoveOpen(false) }}>
                    <div className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-200"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                        }}>
                        <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                            style={{
                                background: `color-mix(in srgb, ${color} 6%, var(--app-surface))`,
                                borderBottom: '1px solid var(--app-border)',
                            }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: color }}>
                                    <ArrowRightLeft size={14} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                                        Reassign {selectedProductIds.length} product{selectedProductIds.length !== 1 ? 's' : ''}
                                    </h3>
                                    <p className="text-tp-xxs font-bold uppercase tracking-widest"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        Choose a new {type === 'category' ? 'category' : type}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsMoveOpen(false)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30">
                                <X size={16} style={{ color: 'var(--app-muted-foreground)' }} />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto">
                            <label className="text-tp-xxs font-black uppercase tracking-widest mb-2 block"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                Destination {type === 'category' ? 'category' : type}
                            </label>
                            {renderTargetSelector()}
                            {!targetId && (
                                <p className="text-tp-xs mt-2 flex items-center gap-1"
                                    style={{ color: 'var(--app-warning)' }}>
                                    <AlertCircle size={11} /> Pick a target to continue.
                                </p>
                            )}
                        </div>
                        <div className="px-5 py-3 flex gap-2 flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                                borderTop: '1px solid var(--app-border)',
                            }}>
                            <button onClick={() => setIsMoveOpen(false)}
                                className="flex-1 py-2 rounded-xl text-tp-sm font-bold transition-all"
                                style={{
                                    border: '1px solid var(--app-border)',
                                    color: 'var(--app-muted-foreground)',
                                    background: 'transparent',
                                }}>
                                Cancel
                            </button>
                            <button onClick={handleMove} disabled={!targetId || isPending}
                                className="flex-1 py-2 rounded-xl text-tp-sm font-bold flex justify-center items-center gap-1.5 disabled:opacity-50"
                                style={{
                                    background: color, color: 'white',
                                    boxShadow: `0 2px 8px color-mix(in srgb, ${color} 30%, transparent)`,
                                }}>
                                <Check size={13} />
                                {isPending ? 'Moving…' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Group modal ═══ */}
            <GroupModal isOpen={isGroupOpen} onClose={() => setIsGroupOpen(false)}
                productIds={selectedProductIds} color={color}
                onSuccess={() => { setIsGroupOpen(false); setSelectedProductIds([]) }} />
        </div>
    )
}

function GroupModal({ isOpen, onClose, productIds, onSuccess, color }: any) {
    const [groupName, setGroupName] = useState('')
    const [isPending, startTransition] = useTransition()
    if (!isOpen) return null

    const handleCreate = () => {
        if (!groupName) return
        startTransition(async () => {
            const result = await createGroupFromProducts(productIds, { name: groupName })
            if (result.success) onSuccess()
            else alert(result.message)
        })
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden p-5 space-y-4 animate-in zoom-in-95 duration-200"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                }}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: color || 'var(--app-primary)' }}>
                            <Layers size={14} className="text-white" />
                        </div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                            Create product group
                        </h3>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30">
                        <X size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                    </button>
                </div>
                <p className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                    Create a new master product (group) for the {productIds.length} selected items.
                    All items inherit the brand and category of the first item.
                </p>
                <div>
                    <label className="text-tp-xxs font-black uppercase tracking-widest mb-1 block"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        Group name
                    </label>
                    <input value={groupName} onChange={e => setGroupName(e.target.value)}
                        autoFocus placeholder="e.g. Persil Power Gel"
                        className="w-full px-3 py-2 rounded-xl outline-none text-tp-sm"
                        style={{
                            background: 'var(--app-background)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-foreground)',
                        }} />
                </div>
                <div className="flex gap-2 pt-1">
                    <button onClick={onClose}
                        className="flex-1 py-2 rounded-xl text-tp-sm font-bold"
                        style={{
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-muted-foreground)',
                            background: 'transparent',
                        }}>
                        Cancel
                    </button>
                    <button onClick={handleCreate} disabled={!groupName || isPending}
                        className="flex-1 py-2 rounded-xl text-tp-sm font-bold flex justify-center items-center gap-1.5 disabled:opacity-50"
                        style={{
                            background: color || 'var(--app-primary)', color: 'white',
                            boxShadow: `0 2px 8px color-mix(in srgb, ${color || 'var(--app-primary)'} 30%, transparent)`,
                        }}>
                        <Check size={13} />
                        {isPending ? 'Creating…' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    )
}

/* ─── Product list (optionally grouped by productGroup) ─── */
function ProductList({ products, selectedProductIds, toggleProduct, color }: any) {
    const grouped = useMemo(() => {
        const groups: Record<string, any> = {}
        const loose: any[] = []
        products.forEach((p: any) => {
            if (p.productGroup) {
                const gName = p.productGroup.name
                if (!groups[gName]) groups[gName] = { id: p.productGroup.id, name: gName, items: [] }
                groups[gName].items.push(p)
            } else {
                loose.push(p)
            }
        })
        return { groups, loose }
    }, [products])

    return (
        <div className="space-y-2">
            {Object.values(grouped.groups).map((group: any) => (
                <div key={group.name} className="rounded-xl overflow-hidden"
                    style={{
                        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                    }}>
                    <div className="px-3 py-2 flex justify-between items-center"
                        style={{
                            background: `color-mix(in srgb, ${color} 5%, var(--app-surface))`,
                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                        }}>
                        <div className="flex items-center gap-2">
                            <Layers size={13} style={{ color }} />
                            <span className="text-tp-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                                {group.name}
                            </span>
                            <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                    color: 'var(--app-muted-foreground)',
                                }}>
                                {group.items.length} variant{group.items.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div>
                        {group.items.map((product: any) => (
                            <ProductRow key={product.id} product={product} color={color}
                                isSelected={selectedProductIds.includes(product.id)}
                                toggle={() => toggleProduct(product.id)} />
                        ))}
                    </div>
                </div>
            ))}
            {grouped.loose.length > 0 && (
                <div className="space-y-1">
                    {Object.keys(grouped.groups).length > 0 && (
                        <div className="px-2 py-1 text-tp-xxs font-black uppercase tracking-widest mt-3"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Ungrouped products
                        </div>
                    )}
                    {grouped.loose.map((product: any) => (
                        <div key={product.id} className="rounded-xl overflow-hidden"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}>
                            <ProductRow product={product} color={color}
                                isSelected={selectedProductIds.includes(product.id)}
                                toggle={() => toggleProduct(product.id)} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function ProductRow({ product, isSelected, toggle, color }: any) {
    const stock = product.inventory?.reduce(
        (acc: number, item: any) => acc + Number(item.quantity), 0
    ) || 0
    return (
        <div onClick={toggle}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-all"
            style={{
                background: isSelected
                    ? `color-mix(in srgb, ${color} 8%, transparent)`
                    : 'transparent',
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
            }}>
            <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                style={isSelected ? {
                    background: color, border: `1px solid ${color}`, color: 'white',
                } : {
                    background: 'var(--app-background)', border: '1px solid var(--app-border)',
                }}>
                {isSelected && <Check size={10} />}
            </div>
            <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className={`text-tp-sm truncate ${isSelected ? 'font-bold' : 'font-medium'}`}
                        style={{ color: isSelected ? color : 'var(--app-foreground)' }}>
                        {product.name}
                    </p>
                    <div className="flex gap-1.5 items-center mt-0.5">
                        <span className="font-mono text-tp-xxs font-bold px-1 py-0.5 rounded"
                            style={{
                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                color: 'var(--app-muted-foreground)',
                            }}>
                            {product.sku}
                        </span>
                        {product.country?.name && (
                            <span className="text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                                · {product.country.name}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right flex-shrink-0">
                    <span className="text-tp-sm font-bold tabular-nums"
                        style={{ color: stock > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                        {stock}
                    </span>
                    <span className="text-tp-xxs ml-1" style={{ color: 'var(--app-muted-foreground)' }}>
                        qty
                    </span>
                </div>
            </div>
        </div>
    )
}
