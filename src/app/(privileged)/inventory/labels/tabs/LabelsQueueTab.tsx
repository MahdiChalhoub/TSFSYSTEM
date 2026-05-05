'use client'

import { useState, useTransition, useMemo, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import {
    Search, Barcode, Package, Plus, Minus, Trash2,
    Printer, Tag, Loader2,
} from 'lucide-react'
import { getProductsForLabels, createPrintSession, type LabelProduct } from '@/app/actions/labels'

const v = (name: string) => `var(${name})`
const soft = (varName: string, pct = 10) => ({ backgroundColor: `color-mix(in srgb, ${v(varName)} ${pct}%, transparent)` })
const grad = (varName: string) => ({ background: `linear-gradient(135deg, ${v(varName)}, color-mix(in srgb, ${v(varName)} 80%, black))` })

type QueueProduct = LabelProduct & {
    category_name?: string
    supplier_name?: string
    selling_price_ttc?: number | string
    selling_price?: number | string
    stock_qty?: number
    total_stock?: number
}

type QueueItem = { product: QueueProduct; quantity: number }

interface Props {
    initialProducts: QueueProduct[]
    onSessionCreated: () => void
}

export default function LabelsQueueTab({ initialProducts, onSessionCreated }: Props) {
    const [isPending, startTransition] = useTransition()
    const [products, setProducts] = useState<QueueProduct[]>(initialProducts)
    const [search, setSearch] = useState('')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [supplierFilter, setSupplierFilter] = useState('')
    const [inStockOnly, setInStockOnly] = useState(false)
    const [queue, setQueue] = useState<QueueItem[]>([])
    const [labelType, setLabelType] = useState('SHELF')

    const categories = useMemo(() => {
        const cats = new Set<string>()
        products.forEach(p => p.category_name && cats.add(p.category_name))
        return Array.from(cats).sort()
    }, [products])

    const suppliers = useMemo(() => {
        const sups = new Set<string>()
        products.forEach(p => p.supplier_name && sups.add(p.supplier_name))
        return Array.from(sups).sort()
    }, [products])

    const filteredProducts = useMemo(() => {
        let list = products
        const q = search.toLowerCase()
        if (q) list = list.filter(p =>
            p.name?.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.barcode?.toLowerCase().includes(q))
        if (categoryFilter) list = list.filter(p => p.category_name === categoryFilter)
        if (supplierFilter) list = list.filter(p => p.supplier_name === supplierFilter)
        if (inStockOnly) list = list.filter(p => (p.stock_qty || p.total_stock || 0) > 0)
        return list
    }, [products, search, categoryFilter, supplierFilter, inStockOnly])

    const queueProductIds = useMemo(() => new Set(queue.map(q => q.product.id)), [queue])
    const totalLabels = useMemo(() => queue.reduce((s, q) => s + q.quantity, 0), [queue])

    const addToQueue = useCallback((product: QueueProduct) => {
        setQueue(prev => prev.find(q => q.product.id === product.id) ? prev : [...prev, { product, quantity: 1 }])
    }, [])

    const removeFromQueue = useCallback((productId: number) => {
        setQueue(prev => prev.filter(q => q.product.id !== productId))
    }, [])

    const updateQuantity = useCallback((productId: number, delta: number) => {
        setQueue(prev => prev.map(q => q.product.id !== productId ? q : { ...q, quantity: Math.max(1, q.quantity + delta) }))
    }, [])

    const handleCreateSession = useCallback(() => {
        if (queue.length === 0) { toast.error('Add products to the queue first'); return }
        startTransition(async () => {
            try {
                const res = await createPrintSession({
                    label_type: labelType,
                    items: queue.map(q => ({ product_id: q.product.id, quantity: q.quantity })),
                })
                if (res?.id) {
                    toast.success(`Session ${res.session_code} created with ${res.total_labels} labels`)
                    setQueue([])
                    onSessionCreated()
                } else {
                    toast.error(res?.error || res?.detail || 'Failed')
                }
            } catch { toast.error('Failed') }
        })
    }, [queue, labelType, onSessionCreated])

    useEffect(() => {
        const t = setTimeout(() => {
            startTransition(async () => {
                const res = await getProductsForLabels({ search, page_size: 50 })
                setProducts((res?.results ?? []) as QueueProduct[])
            })
        }, 300)
        return () => clearTimeout(t)
    }, [search])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
            {/* ── Product Table ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                {/* Filters */}
                <div className="px-4 py-3 border-b border-app-border/50 bg-app-background shrink-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative flex-1 min-w-[150px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-muted-foreground" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search by product"
                                className="w-full pl-9 pr-3 h-9 rounded-lg border border-app-border bg-app-surface text-[11px] font-semibold text-app-foreground placeholder:text-app-muted-foreground focus:ring-2 focus:ring-app-primary/20 outline-none" />
                        </div>
                        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-app-border bg-app-surface text-[11px] font-semibold text-app-foreground outline-none">
                            <option value="">All Category</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-app-border bg-app-surface text-[11px] font-semibold text-app-foreground outline-none">
                            <option value="">All Supplier</option>
                            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="relative flex-1 min-w-[150px]">
                            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-muted-foreground" />
                            <input type="text" placeholder="Scan barcode..."
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        const val = (e.target as HTMLInputElement).value.trim()
                                        if (!val) return
                                        const match = products.find(p => p.barcode === val || p.sku === val)
                                        if (match) { addToQueue(match); (e.target as HTMLInputElement).value = '' }
                                        else toast.error('No product found')
                                    }
                                }}
                                className="w-full pl-9 pr-3 h-9 rounded-lg border border-app-border bg-app-surface text-[11px] font-semibold text-app-foreground placeholder:text-app-muted-foreground focus:ring-2 focus:ring-app-primary/20 outline-none" />
                        </div>
                        <button onClick={() => filteredProducts.forEach(p => addToQueue(p))}
                            className="flex items-center gap-1.5 px-4 h-9 rounded-lg text-white text-[11px] font-bold shadow-md shrink-0" style={grad('--app-primary')}>
                            <Plus size={14} /> Add All
                        </button>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-semibold text-app-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)}
                            className="w-3.5 h-3.5 rounded border-app-border text-app-primary" />
                        Only in stock
                    </label>
                </div>

                {/* Header row */}
                <div className="px-4 py-2 border-b border-app-border/30 bg-app-background/50 flex items-center gap-3 text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider shrink-0">
                    <span className="w-5"></span>
                    <span className="flex-1 min-w-[120px]">Product</span>
                    <span className="w-[120px]">SKU/Barcode</span>
                    <span className="w-[80px]">Category</span>
                    <span className="w-[100px]">Supplier</span>
                    <span className="w-[70px] text-right">Price</span>
                    <span className="w-[50px] text-right">Stock</span>
                    <span className="w-[40px]"></span>
                </div>

                {/* Scrollable rows */}
                <div className="flex-1 overflow-y-auto">
                    <div className="px-4 py-2">
                        <span className="text-[11px] font-bold text-app-foreground">Products ({filteredProducts.length})</span>
                    </div>
                    {filteredProducts.length === 0 ? (
                        <div className="py-16 text-center">
                            <Package size={32} className="mx-auto text-app-muted-foreground opacity-20" />
                            <p className="text-[11px] text-app-muted-foreground mt-2">No products found</p>
                        </div>
                    ) : filteredProducts.map(p => {
                        const inQ = queueProductIds.has(p.id)
                        return (
                            <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-app-border/20 hover:bg-app-background/50 transition-colors ${inQ ? 'opacity-50' : ''}`}>
                                <input type="checkbox" checked={inQ} onChange={() => inQ ? removeFromQueue(p.id) : addToQueue(p)}
                                    className="w-4 h-4 rounded border-app-border text-app-primary shrink-0" />
                                <span className="flex-1 min-w-[120px] text-[12px] font-bold text-app-foreground truncate">{p.name}</span>
                                <div className="w-[120px]">
                                    <span className="text-[11px] font-mono font-bold text-app-foreground block truncate">{p.sku || '—'}</span>
                                    <span className="text-[9px] text-app-muted-foreground font-mono block truncate">{p.barcode || ''}</span>
                                </div>
                                <span className="w-[80px]">
                                    {p.category_name && <span className="px-2 py-0.5 rounded-md text-[9px] font-bold" style={{ ...soft('--app-info', 12), color: v('--app-info') }}>{p.category_name}</span>}
                                </span>
                                <span className="w-[100px] text-[10px] text-app-muted-foreground truncate">{p.supplier_name || '—'}</span>
                                <span className="w-[70px] text-right text-[11px] font-bold text-app-foreground">${Number(p.selling_price_ttc || p.selling_price || 0).toFixed(2)}</span>
                                <span className="w-[50px] text-right text-[11px] font-bold" style={{ color: v((p.stock_qty || p.total_stock || 0) > 0 ? '--app-info' : '--app-error') }}>{p.stock_qty || p.total_stock || 0}</span>
                                <div className="w-[40px] text-center">
                                    <button onClick={() => addToQueue(p)} disabled={inQ} className="p-1 rounded-lg hover:bg-app-primary/10 disabled:opacity-30"><Plus size={16} style={{ color: v('--app-primary') }} /></button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* ── Print Queue ── */}
            <div className="bg-app-surface rounded-2xl border border-app-border/50 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 340px)' }}>
                <div className="px-4 py-3 border-b border-app-border/50 bg-app-background shrink-0">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[13px] font-black text-app-foreground flex items-center gap-2">
                            <Printer size={16} style={{ color: v('--app-primary') }} /> Print Queue ({queue.length})
                        </h3>
                        <select value={labelType} onChange={e => setLabelType(e.target.value)}
                            className="h-8 px-2 rounded-lg border border-app-border bg-app-surface text-[10px] font-bold text-app-foreground outline-none">
                            <option value="SHELF">Shelf Labels</option>
                            <option value="BARCODE">Barcode Stickers</option>
                            <option value="PACKAGING">Packaging</option>
                            <option value="FRESH">Fresh / Weight</option>
                            <option value="CUSTOM">Custom</option>
                        </select>
                    </div>
                    <p className="text-[9px] text-app-muted-foreground mt-0.5">{totalLabels} total labels</p>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {queue.length === 0 ? (
                        <div className="py-12 text-center">
                            <Tag size={28} className="mx-auto text-app-muted-foreground opacity-20" />
                            <p className="text-[10px] font-bold text-app-muted-foreground mt-2">Queue is empty</p>
                        </div>
                    ) : queue.map(q => (
                        <div key={q.product.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-app-border/30 hover:bg-app-background/50">
                            <div className="flex-1 min-w-0">
                                <span className="text-[11px] font-bold text-app-foreground block truncate">{q.product.name}</span>
                                <span className="text-[9px] text-app-muted-foreground font-mono">{q.product.sku || q.product.barcode || ''}</span>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button onClick={() => updateQuantity(q.product.id, -1)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-app-background"><Minus size={12} className="text-app-muted-foreground" /></button>
                                <span className="w-8 text-center text-[12px] font-black text-app-foreground">{q.quantity}</span>
                                <button onClick={() => updateQuantity(q.product.id, 1)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-app-background"><Plus size={12} style={{ color: v('--app-primary') }} /></button>
                            </div>
                            <button onClick={() => removeFromQueue(q.product.id)} className="p-1 rounded-lg hover:bg-app-error/10 shrink-0"><Trash2 size={12} className="text-app-error" /></button>
                        </div>
                    ))}
                </div>

                {queue.length > 0 && (
                    <div className="px-4 py-3 border-t border-app-border/50 bg-app-background shrink-0 space-y-2">
                        <button onClick={handleCreateSession} disabled={isPending}
                            className="w-full flex items-center justify-center gap-2 h-10 rounded-xl text-white text-[12px] font-bold shadow-lg disabled:opacity-50" style={grad('--app-primary')}>
                            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Create Print Session
                        </button>
                        <button onClick={() => setQueue([])} className="w-full flex items-center justify-center gap-2 h-8 rounded-lg border border-app-border text-[10px] font-bold text-app-muted-foreground hover:bg-app-background">
                            <Trash2 size={12} /> Clear Queue
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
