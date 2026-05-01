'use client'

import { useState, useEffect, useTransition, useMemo, useCallback } from 'react'
import {
    getDataQuality, getProductsForMaintenance, getMaintenanceFilterOptions,
    bulkUpdateProducts, generateBarcodes, type ProductUpdate,
} from '@/app/actions/inventory/data-quality'
import {
    Search, Barcode, AlertTriangle, CheckCircle2, Package2, Tag,
    Layers, DollarSign, Percent, Save, Loader2, ScanBarcode,
    Wrench, ArrowLeft, RefreshCw, Filter, X, Check, Package, Sparkles,
} from 'lucide-react'
import Link from 'next/link'

/* ═══════════════════════════════════════════════════════════
 *  DATA QUALITY — product-health dashboard + bulk editor
 *  Designed on V2 tokens (var(--app-*)), matches the Categories
 *  / Attributes aesthetic: icon-box header, click-to-filter
 *  KPI strip, themed inline-edit table, native themed modal for
 *  barcode-generation feedback.
 * ═══════════════════════════════════════════════════════════ */

interface Product {
    id: number
    sku: string
    name: string
    barcode: string | null
    category: number | null
    category_name?: string
    brand: number | null
    brand_name?: string
    unit: number | null
    unit_name?: string
    parfum: number | null
    tva_rate: number
    cost_price_ht: number
    cost_price_ttc: number
    selling_price_ht: number
    selling_price_ttc: number
    size: number | null
}

interface DataQuality {
    total_products: number
    missing_barcode: number
    missing_category: number
    missing_brand: number
    zero_tva: number
    zero_cost_price: number
    zero_selling_price: number
    missing_name: number
}

interface FilterOpts {
    categories: { id: number; name: string }[]
    brands: { id: number; name: string }[]
    units: { id: number; name: string }[]
}

type IssueFilter = 'all' | 'missing_barcode' | 'missing_category' | 'missing_brand' | 'zero_tva' | 'zero_price'

const ISSUE_LABEL: Record<IssueFilter, string> = {
    all: 'All products',
    missing_barcode: 'No barcode',
    missing_category: 'No category',
    missing_brand: 'No brand',
    zero_tva: 'Zero TVA',
    zero_price: 'No selling price',
}

export default function DataQualityPage() {
    const [quality, setQuality] = useState<DataQuality | null>(null)
    const [products, setProducts] = useState<Product[]>([])
    const [filterOpts, setFilterOpts] = useState<FilterOpts | null>(null)
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState('')
    const [issueFilter, setIssueFilter] = useState<IssueFilter>('all')
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [pendingEdits, setPendingEdits] = useState<Map<number, Partial<ProductUpdate>>>(new Map())
    const [barcodeResult, setBarcodeResult] = useState<{ generated: number } | null>(null)

    const reload = useCallback(() => {
        startTransition(async () => {
            const [q, p, f] = await Promise.all([
                getDataQuality(),
                getProductsForMaintenance(),
                getMaintenanceFilterOptions(),
            ])
            setQuality(q as DataQuality | null)
            const productList = Array.isArray(p)
                ? p
                : (p && typeof p === 'object' && 'results' in p && Array.isArray((p as { results?: unknown[] }).results))
                    ? (p as { results: unknown[] }).results
                    : []
            setProducts(productList as Product[])
            const asNamedList = (raw: unknown): { id: number; name: string }[] => {
                if (Array.isArray(raw)) return raw as { id: number; name: string }[]
                if (raw && typeof raw === 'object' && 'results' in raw) {
                    const r = (raw as { results?: unknown }).results
                    if (Array.isArray(r)) return r as { id: number; name: string }[]
                }
                return []
            }
            setFilterOpts({
                categories: asNamedList(f.categories),
                brands: asNamedList(f.brands),
                units: asNamedList(f.units),
            })
            setLoading(false)
        })
    }, [])
    useEffect(() => { reload() }, [reload])

    const filtered = useMemo(() => {
        let list = products
        const q = search.trim().toLowerCase()
        if (q) {
            list = list.filter(p =>
                p.name?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.barcode?.toLowerCase().includes(q)
            )
        }
        switch (issueFilter) {
            case 'missing_barcode': list = list.filter(p => !p.barcode); break
            case 'missing_category': list = list.filter(p => !p.category); break
            case 'missing_brand': list = list.filter(p => !p.brand); break
            case 'zero_tva': list = list.filter(p => Number(p.tva_rate) === 0); break
            case 'zero_price': list = list.filter(p => Number(p.selling_price_ht) === 0 && Number(p.selling_price_ttc) === 0); break
        }
        return list
    }, [products, search, issueFilter])

    type EditableField = keyof Omit<ProductUpdate, 'id'>
    type EditValue = string | number | null | undefined

    const setEdit = (productId: number, field: EditableField, value: EditValue) => {
        setPendingEdits(prev => {
            const next = new Map(prev)
            const existing = next.get(productId) || {}
            next.set(productId, { ...existing, id: productId, [field]: value })
            return next
        })
    }
    const getEditValue = (productId: number, field: EditableField, original: EditValue): EditValue => {
        const edit = pendingEdits.get(productId)
        if (edit && field in edit) return (edit as Record<string, EditValue>)[field]
        return original
    }
    const hasEdits = pendingEdits.size > 0

    const handleSave = () => {
        const updates = Array.from(pendingEdits.values()) as ProductUpdate[]
        if (updates.length === 0) return
        startTransition(async () => {
            await bulkUpdateProducts(updates)
            setPendingEdits(new Map())
            reload()
        })
    }

    const handleGenerateBarcodes = (selectedOnly: boolean) => {
        const ids = selectedOnly ? Array.from(selected) : undefined
        startTransition(async () => {
            const result = await generateBarcodes(ids)
            setBarcodeResult(result)
            setSelected(new Set())
            reload()
        })
    }

    const toggleSelect = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }
    const toggleSelectAll = () => {
        if (selected.size === filtered.length) setSelected(new Set())
        else setSelected(new Set(filtered.map(p => p.id)))
    }

    const getIssues = (p: Product) => {
        const issues: string[] = []
        if (!p.barcode) issues.push('barcode')
        if (!p.category) issues.push('category')
        if (!p.brand) issues.push('brand')
        if (Number(p.tva_rate) === 0) issues.push('tva')
        if (Number(p.selling_price_ht) === 0 && Number(p.selling_price_ttc) === 0) issues.push('price')
        return issues
    }

    return (
        <div className="flex flex-col p-4 md:px-6 md:pt-6 md:pb-2 animate-in fade-in duration-300 overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ═══════════════ HEADER ═══════════════ */}
            <div className="flex-shrink-0 space-y-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/inventory/maintenance"
                            className="p-2 rounded-xl transition-all"
                            style={{
                                color: 'var(--app-muted-foreground)',
                                background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            }}
                            aria-label="Back to Maintenance">
                            <ArrowLeft size={16} />
                        </Link>
                        <div className="page-header-icon"
                            style={{
                                background: 'var(--app-warning)',
                                boxShadow: '0 4px 14px color-mix(in srgb, var(--app-warning) 30%, transparent)',
                            }}>
                            <Wrench size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black tracking-tight"
                                style={{ color: 'var(--app-foreground)' }}>
                                Product Data Quality
                            </h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold uppercase tracking-widest"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                {quality ? `${quality.total_products} products audited` : 'Loading…'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <button onClick={reload} disabled={isPending}
                            className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-xl border transition-all disabled:opacity-60"
                            style={{
                                color: 'var(--app-muted-foreground)',
                                borderColor: 'var(--app-border)',
                                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                            }}>
                            <RefreshCw size={13} style={{ animation: isPending ? 'spin 0.9s linear infinite' : undefined }} />
                            <span className="hidden md:inline">Refresh</span>
                        </button>
                        {hasEdits && (
                            <button onClick={handleSave} disabled={isPending}
                                className="flex items-center gap-1.5 text-tp-sm font-bold px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                style={{
                                    background: 'var(--app-success)', color: 'white',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-success) 30%, transparent)',
                                }}>
                                <Save size={13} />
                                Save {pendingEdits.size} change{pendingEdits.size !== 1 ? 's' : ''}
                            </button>
                        )}
                    </div>
                </div>

                {/* ═══ KPI STRIP — click to filter ═══ */}
                {quality && (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '8px',
                    }}>
                        <KpiTile label="Total" value={quality.total_products}
                            icon={<Package2 size={12} />} color="var(--app-primary)" />
                        <KpiTile label="No Barcode" value={quality.missing_barcode}
                            icon={<Barcode size={12} />} color="var(--app-error)"
                            filterKey="missing_barcode" active={issueFilter === 'missing_barcode'}
                            onClick={() => setIssueFilter(issueFilter === 'missing_barcode' ? 'all' : 'missing_barcode')}
                            healthyColor="var(--app-success)" />
                        <KpiTile label="No Category" value={quality.missing_category}
                            icon={<Layers size={12} />} color="var(--app-warning)"
                            filterKey="missing_category" active={issueFilter === 'missing_category'}
                            onClick={() => setIssueFilter(issueFilter === 'missing_category' ? 'all' : 'missing_category')}
                            healthyColor="var(--app-success)" />
                        <KpiTile label="No Brand" value={quality.missing_brand}
                            icon={<Tag size={12} />} color="var(--app-warning)"
                            filterKey="missing_brand" active={issueFilter === 'missing_brand'}
                            onClick={() => setIssueFilter(issueFilter === 'missing_brand' ? 'all' : 'missing_brand')}
                            healthyColor="var(--app-success)" />
                        <KpiTile label="Zero TVA" value={quality.zero_tva}
                            icon={<Percent size={12} />} color="var(--app-accent)"
                            filterKey="zero_tva" active={issueFilter === 'zero_tva'}
                            onClick={() => setIssueFilter(issueFilter === 'zero_tva' ? 'all' : 'zero_tva')}
                            healthyColor="var(--app-success)" />
                        <KpiTile label="No Cost" value={quality.zero_cost_price}
                            icon={<DollarSign size={12} />} color="var(--app-error)"
                            healthyColor="var(--app-success)" />
                        <KpiTile label="No Sell Price" value={quality.zero_selling_price}
                            icon={<DollarSign size={12} />} color="var(--app-error)"
                            filterKey="zero_price" active={issueFilter === 'zero_price'}
                            onClick={() => setIssueFilter(issueFilter === 'zero_price' ? 'all' : 'zero_price')}
                            healthyColor="var(--app-success)" />
                    </div>
                )}

                {/* ═══ Toolbar: search + barcode gen ═══ */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex-1 relative min-w-[200px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--app-muted-foreground)' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, SKU, barcode…"
                            className="w-full pl-9 pr-3 py-2 rounded-xl text-tp-md outline-none transition-all"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                color: 'var(--app-foreground)',
                            }} />
                    </div>
                    {quality && quality.missing_barcode > 0 && (
                        <div className="flex gap-1.5">
                            {selected.size > 0 && (
                                <button onClick={() => handleGenerateBarcodes(true)} disabled={isPending}
                                    className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-xl border transition-all disabled:opacity-50"
                                    style={{
                                        color: 'var(--app-primary)',
                                        borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                        background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                                    }}>
                                    <ScanBarcode size={13} />
                                    Generate ({selected.size})
                                </button>
                            )}
                            <button onClick={() => handleGenerateBarcodes(false)} disabled={isPending}
                                className="flex items-center gap-1.5 text-tp-sm font-bold px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                style={{
                                    background: 'var(--app-primary)', color: 'white',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                }}>
                                <Sparkles size={13} />
                                Generate all missing ({quality.missing_barcode})
                            </button>
                        </div>
                    )}
                </div>

                {/* ═══ Active filter chip ═══ */}
                {issueFilter !== 'all' && (
                    <div className="flex items-center gap-2">
                        <Filter size={12} style={{ color: 'var(--app-muted-foreground)' }} />
                        <button onClick={() => setIssueFilter('all')}
                            className="flex items-center gap-1.5 text-tp-xs font-bold uppercase tracking-wider px-2 py-1 rounded-lg"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                color: 'var(--app-primary)',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            }}>
                            {ISSUE_LABEL[issueFilter]} <X size={11} />
                        </button>
                        <span className="text-tp-sm font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                            {filtered.length} product{filtered.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                )}
            </div>

            {/* ═══════════════ TABLE ═══════════════ */}
            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col"
                style={{
                    background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}>
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {loading ? (
                        <div className="h-full flex items-center justify-center py-16">
                            <Loader2 size={20} className="animate-spin"
                                style={{ color: 'var(--app-primary)' }} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-2 py-16 px-4 text-center">
                            {issueFilter === 'all' ? (
                                <>
                                    <Package size={28} className="opacity-40"
                                        style={{ color: 'var(--app-muted-foreground)' }} />
                                    <p className="text-tp-md font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                        No products
                                    </p>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={28}
                                        style={{ color: 'var(--app-success)' }} />
                                    <p className="text-tp-md font-bold" style={{ color: 'var(--app-success)' }}>
                                        All good — no products with this issue
                                    </p>
                                </>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-tp-sm">
                            <thead className="sticky top-0 z-10"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-surface) 90%, transparent)',
                                    borderBottom: '2px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}>
                                <tr className="text-tp-xxs font-black uppercase tracking-widest"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    <th className="px-3 py-2 w-10">
                                        <Checkbox on={selected.size === filtered.length && filtered.length > 0}
                                            onClick={toggleSelectAll} />
                                    </th>
                                    <th className="px-2 py-2 text-left">SKU</th>
                                    <th className="px-2 py-2 text-left min-w-[200px]">Name</th>
                                    <th className="px-2 py-2 text-left min-w-[140px]">Barcode</th>
                                    <th className="px-2 py-2 text-left">Category</th>
                                    <th className="px-2 py-2 text-left">Brand</th>
                                    <th className="px-2 py-2 text-left min-w-[80px]">TVA %</th>
                                    <th className="px-2 py-2 text-left min-w-[100px]">Cost HT</th>
                                    <th className="px-2 py-2 text-left min-w-[100px]">Sell HT</th>
                                    <th className="px-2 py-2 text-left min-w-[100px]">Sell TTC</th>
                                    <th className="px-2 py-2 text-center">Issues</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.slice(0, 100).map(p => {
                                    const issues = getIssues(p)
                                    const isEdited = pendingEdits.has(p.id)
                                    const isSelected = selected.has(p.id)
                                    return (
                                        <tr key={p.id}
                                            style={{
                                                background: isEdited
                                                    ? 'color-mix(in srgb, var(--app-warning) 5%, transparent)'
                                                    : isSelected
                                                        ? 'color-mix(in srgb, var(--app-primary) 4%, transparent)'
                                                        : 'transparent',
                                                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                                            }}>
                                            <td className="px-3 py-1.5">
                                                <Checkbox on={isSelected} onClick={() => toggleSelect(p.id)} />
                                            </td>
                                            <td className="px-2 py-1.5 font-mono text-tp-xxs"
                                                style={{ color: 'var(--app-muted-foreground)' }}>
                                                {p.sku}
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <InlineText value={getEditValue(p.id, 'name', p.name)}
                                                    onChange={v => setEdit(p.id, 'name', v)} />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                {p.barcode ? (
                                                    <span className="font-mono text-tp-xxs font-bold px-1.5 py-0.5 rounded"
                                                        style={{
                                                            background: 'color-mix(in srgb, var(--app-info) 8%, transparent)',
                                                            color: 'var(--app-info)',
                                                        }}>
                                                        {p.barcode}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-tp-xxs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                                                        style={{
                                                            background: 'color-mix(in srgb, var(--app-error) 10%, transparent)',
                                                            color: 'var(--app-error)',
                                                            border: '1px solid color-mix(in srgb, var(--app-error) 25%, transparent)',
                                                        }}>
                                                        <AlertTriangle size={10} /> Missing
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <InlineSelect value={getEditValue(p.id, 'category', p.category)}
                                                    options={filterOpts?.categories || []}
                                                    onChange={v => setEdit(p.id, 'category', v ? Number(v) : null)} />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <InlineSelect value={getEditValue(p.id, 'brand', p.brand)}
                                                    options={filterOpts?.brands || []}
                                                    onChange={v => setEdit(p.id, 'brand', v ? Number(v) : null)} />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <InlineNumber value={getEditValue(p.id, 'tva_rate', Number(p.tva_rate))}
                                                    onChange={v => setEdit(p.id, 'tva_rate', v)} width={64} />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <InlineNumber value={getEditValue(p.id, 'cost_price_ht', Number(p.cost_price_ht))}
                                                    onChange={v => setEdit(p.id, 'cost_price_ht', v)} width={80} />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <InlineNumber value={getEditValue(p.id, 'selling_price_ht', Number(p.selling_price_ht))}
                                                    onChange={v => setEdit(p.id, 'selling_price_ht', v)} width={80} />
                                            </td>
                                            <td className="px-2 py-1.5">
                                                <InlineNumber value={getEditValue(p.id, 'selling_price_ttc', Number(p.selling_price_ttc))}
                                                    onChange={v => setEdit(p.id, 'selling_price_ttc', v)} width={80} />
                                            </td>
                                            <td className="px-2 py-1.5 text-center">
                                                {issues.length === 0 ? (
                                                    <CheckCircle2 size={14} className="mx-auto"
                                                        style={{ color: 'var(--app-success)' }} />
                                                ) : (
                                                    <span className="inline-flex items-center justify-center gap-1 text-tp-xxs font-bold tabular-nums px-1.5 py-0.5 rounded-full"
                                                        style={{
                                                            background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)',
                                                            color: 'var(--app-warning)',
                                                        }}>
                                                        <AlertTriangle size={10} /> {issues.length}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
                {filtered.length > 100 && (
                    <div className="flex-shrink-0 px-3 py-2 text-tp-xs text-center font-medium"
                        style={{
                            color: 'var(--app-muted-foreground)',
                            borderTop: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                            background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                        }}>
                        Showing first 100 of {filtered.length} — refine the search or pick a filter to narrow down.
                    </div>
                )}
            </div>

            {/* ═══ Barcode-result modal ═══ */}
            {barcodeResult && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setBarcodeResult(null) }}>
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                        }}>
                        <div className="px-5 py-3 flex items-center justify-between"
                            style={{
                                background: 'color-mix(in srgb, var(--app-success) 8%, var(--app-surface))',
                                borderBottom: '1px solid var(--app-border)',
                            }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--app-success)' }}>
                                    <ScanBarcode size={14} className="text-white" />
                                </div>
                                <h3 className="text-sm font-bold" style={{ color: 'var(--app-foreground)' }}>
                                    Barcodes generated
                                </h3>
                            </div>
                            <button onClick={() => setBarcodeResult(null)}
                                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-app-border/30">
                                <X size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                            </button>
                        </div>
                        <div className="p-5">
                            <p className="text-tp-sm" style={{ color: 'var(--app-muted-foreground)' }}>
                                Successfully generated <strong style={{ color: 'var(--app-foreground)' }}>{barcodeResult.generated}</strong> EAN-13 barcode{barcodeResult.generated !== 1 ? 's' : ''}.
                            </p>
                        </div>
                        <div className="px-5 py-3 flex justify-end"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)',
                                borderTop: '1px solid var(--app-border)',
                            }}>
                            <button onClick={() => setBarcodeResult(null)}
                                className="flex items-center gap-1.5 text-tp-sm font-bold uppercase tracking-wider px-4 py-2 rounded-xl"
                                style={{
                                    background: 'var(--app-success)', color: 'white',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-success) 30%, transparent)',
                                }}>
                                <Check size={12} /> Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ─── KPI tile — clickable when filterKey is set ─── */
function KpiTile({ label, value, icon, color, filterKey, active, onClick, healthyColor }: {
    label: string; value: number; icon: React.ReactNode; color: string
    filterKey?: string; active?: boolean
    onClick?: () => void; healthyColor?: string
}) {
    const clickable = !!filterKey
    const effective = value === 0 && healthyColor ? healthyColor : color
    const Tag = (clickable ? 'button' : 'div') as React.ElementType
    return (
        <Tag onClick={onClick}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left ${clickable ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.99]' : ''}`}
            style={active ? {
                background: `color-mix(in srgb, ${effective} 14%, transparent)`,
                border: `1.5px solid ${effective}`,
                boxShadow: `0 2px 10px color-mix(in srgb, ${effective} 22%, transparent)`,
            } : {
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}>
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: active ? effective : `color-mix(in srgb, ${effective} 12%, transparent)`,
                    color: active ? 'white' : effective,
                }}>
                {icon}
            </div>
            <div className="min-w-0">
                <div className="text-tp-xxs font-bold uppercase tracking-wider"
                    style={{ color: active ? effective : 'var(--app-muted-foreground)' }}>
                    {label}
                </div>
                <div className="text-sm font-black tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                    {value}
                </div>
            </div>
            {clickable && active && (
                <X size={11} className="ml-auto flex-shrink-0" style={{ color: effective }} />
            )}
        </Tag>
    )
}

/* ─── Inline editors ─── */
function Checkbox({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
        <button onClick={onClick}
            className="w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0"
            style={on ? {
                background: 'var(--app-primary)',
                border: '1px solid var(--app-primary)', color: 'white',
            } : {
                background: 'var(--app-background)',
                border: '1px solid var(--app-border)',
            }}>
            {on && <Check size={10} />}
        </button>
    )
}
function InlineText({ value, onChange }: { value: string | number | null | undefined; onChange: (v: string) => void }) {
    return (
        <input value={value ?? ''} onChange={e => onChange(e.target.value)}
            className="w-full px-2 py-1 rounded-md text-tp-sm font-medium outline-none transition-all"
            style={{
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--app-foreground)',
            }}
            onFocus={e => {
                e.currentTarget.style.border = '1px solid var(--app-border)'
                e.currentTarget.style.background = 'var(--app-background)'
            }}
            onBlur={e => {
                e.currentTarget.style.border = '1px solid transparent'
                e.currentTarget.style.background = 'transparent'
            }} />
    )
}
function InlineNumber({ value, onChange, width }: { value: string | number | null | undefined; onChange: (v: number) => void; width?: number }) {
    return (
        <input type="number" value={value ?? 0}
            onChange={e => onChange(parseFloat(e.target.value) || 0)}
            className="px-2 py-1 rounded-md text-tp-sm font-mono tabular-nums outline-none transition-all"
            style={{
                width: width ? `${width}px` : '100%',
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--app-foreground)',
            }}
            onFocus={e => {
                e.currentTarget.style.border = '1px solid var(--app-border)'
                e.currentTarget.style.background = 'var(--app-background)'
            }}
            onBlur={e => {
                e.currentTarget.style.border = '1px solid transparent'
                e.currentTarget.style.background = 'transparent'
            }} />
    )
}
function InlineSelect({ value, options, onChange }: {
    value: string | number | null | undefined; options: { id: number; name: string }[]
    onChange: (v: string) => void
}) {
    return (
        <select value={value ?? ''} onChange={e => onChange(e.target.value)}
            className="w-full px-2 py-1 rounded-md text-tp-sm font-medium outline-none transition-all"
            style={{
                background: 'transparent',
                border: '1px solid transparent',
                color: 'var(--app-foreground)',
            }}
            onFocus={e => {
                e.currentTarget.style.border = '1px solid var(--app-border)'
                e.currentTarget.style.background = 'var(--app-background)'
            }}
            onBlur={e => {
                e.currentTarget.style.border = '1px solid transparent'
                e.currentTarget.style.background = 'transparent'
            }}>
            <option value="">—</option>
            {options.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
            ))}
        </select>
    )
}
