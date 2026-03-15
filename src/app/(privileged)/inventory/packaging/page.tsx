'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { Package, Search, ArrowRight, Box, Barcode, Plus, X } from 'lucide-react'

export default function PackagingPage() {
    const router = useRouter()
    const [products, setProducts] = useState<any[]>([])
    const [allProducts, setAllProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showProductPicker, setShowProductPicker] = useState(false)
    const [pickerSearch, setPickerSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            setLoading(true)
            const data = await erpFetch('inventory/products/?page_size=200')
            const productList = Array.isArray(data) ? data : data?.results || []
            setAllProducts(productList)
            const withPackaging = productList.filter((p: any) =>
                p.packaging_levels && p.packaging_levels.length > 0
            )
            setProducts(withPackaging)
        } catch (e) {
            console.error('Failed to load products', e)
        } finally {
            setLoading(false)
        }
    }

    const filtered = products.filter(p =>
        !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.packaging_levels?.some((pkg: any) =>
            pkg.name?.toLowerCase().includes(search.toLowerCase()) ||
            pkg.barcode?.toLowerCase().includes(search.toLowerCase())
        )
    )

    const totalPackages = filtered.reduce((sum, p) => sum + (p.packaging_levels?.length || 0), 0)

    const pickerProducts = allProducts.filter(p =>
        !pickerSearch || p.name?.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(pickerSearch.toLowerCase())
    ).slice(0, 20)

    return (
        <div className="min-h-screen layout-container-padding theme-bg">
            {/* Header */}
            <div className="mb-6 md:mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-info))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Package className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black theme-text">Product Packaging</h1>
                            <p className="text-xs font-medium theme-text-muted">Manage packaging levels across all products</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowProductPicker(true)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-lg"
                        style={{
                            background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 80%, #000))',
                            boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}
                    >
                        <Plus className="h-4 w-4" /> New Package
                    </button>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    {[
                        { label: 'Products with Packaging', value: products.length, icon: Box },
                        { label: 'Total Packages', value: totalPackages, icon: Package },
                    ].map(kpi => (
                        <div key={kpi.label} className="p-3 rounded-xl"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2 mb-1">
                                <kpi.icon size={13} className="text-app-muted-foreground" />
                                <span className="text-[10px] font-black uppercase tracking-widest theme-text-muted">{kpi.label}</span>
                            </div>
                            <p className="text-xl font-black theme-text">{kpi.value}</p>
                        </div>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mt-4 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search products or packages..."
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                    />
                </div>
            </div>

            {/* Product Picker Modal */}
            {showProductPicker && (
                <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setShowProductPicker(false)}>
                    <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
                    <div
                        className="relative w-full max-w-lg mx-4 rounded-2xl shadow-2xl overflow-hidden"
                        style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <h3 className="font-bold theme-text">Select Product</h3>
                            <button onClick={() => setShowProductPicker(false)} className="p-1.5 rounded-lg hover:bg-app-surface-hover">
                                <X size={16} className="text-app-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-4">
                            <div className="relative mb-3">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    value={pickerSearch}
                                    onChange={e => setPickerSearch(e.target.value)}
                                    placeholder="Search by name or SKU..."
                                    autoFocus
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] font-medium outline-none"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                />
                            </div>
                            <div className="max-h-72 overflow-y-auto space-y-1">
                                {pickerProducts.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setShowProductPicker(false)
                                            router.push(`/inventory/products/${p.id}?tab=packaging`)
                                        }}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left group transition-all"
                                        style={{ border: '1px solid transparent' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-surface)'; e.currentTarget.style.borderColor = 'var(--app-border)' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
                                    >
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                                            <Box size={14} style={{ color: 'var(--app-primary)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold theme-text truncate">{p.name}</p>
                                            <p className="text-[10px] font-mono theme-text-muted">
                                                {p.sku || `ID: ${p.id}`}
                                                {p.unit_name && <span className="ml-2">· {p.unit_name}</span>}
                                                {p.packaging_levels?.length > 0 && (
                                                    <span className="ml-2 text-violet-400">· {p.packaging_levels.length} pkg</span>
                                                )}
                                            </p>
                                        </div>
                                        <ArrowRight size={14} className="text-app-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                    </button>
                                ))}
                                {pickerProducts.length === 0 && (
                                    <p className="text-center py-6 text-sm theme-text-muted">No products found</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                    <Package size={48} className="mx-auto mb-4 text-app-muted-foreground opacity-30" />
                    <p className="text-sm font-bold theme-text-muted mb-1">
                        {search ? 'No matching packages' : 'No products have packaging yet'}
                    </p>
                    <p className="text-xs theme-text-muted mb-4">
                        Click &ldquo;New Package&rdquo; to add packaging levels to a product
                    </p>
                    <button
                        onClick={() => setShowProductPicker(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                    >
                        <Plus size={14} /> Add Packaging to a Product
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(product => (
                        <div key={product.id} className="rounded-xl overflow-hidden"
                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                            {/* Product header */}
                            <button
                                onClick={() => router.push(`/inventory/products/${product.id}?tab=packaging`)}
                                className="w-full flex items-center justify-between px-4 py-3 group transition-all hover:opacity-80"
                                style={{ borderBottom: '1px solid var(--app-border)' }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}>
                                        <Box size={14} style={{ color: 'var(--app-primary)' }} />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold theme-text">{product.name}</p>
                                        <p className="text-[10px] font-mono theme-text-muted">{product.sku || product.barcode || `ID: ${product.id}`}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                        {product.packaging_levels?.length} package{product.packaging_levels?.length !== 1 ? 's' : ''}
                                    </span>
                                    <ArrowRight size={14} className="text-app-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </button>

                            {/* Package list */}
                            <div className="divide-y" style={{ borderColor: 'var(--app-border)' }}>
                                {product.packaging_levels?.map((pkg: any) => (
                                    <div key={pkg.id} className="px-4 py-2.5 flex items-center gap-4">
                                        <div className="w-1.5 h-6 rounded-full"
                                            style={{
                                                background: pkg.is_default_sale
                                                    ? 'var(--app-success, #10b981)'
                                                    : pkg.is_default_purchase
                                                        ? 'var(--app-info)'
                                                        : 'var(--app-border)'
                                            }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[13px] font-bold theme-text">{pkg.name || pkg.display_name}</span>
                                                <span className="text-[10px] font-mono theme-text-muted">
                                                    L{pkg.level} · {pkg.ratio}× base
                                                </span>
                                                {pkg.unit_name && (
                                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                        {pkg.unit_name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 mt-0.5">
                                                {pkg.barcode && (
                                                    <span className="text-[10px] font-mono theme-text-muted flex items-center gap-1">
                                                        <Barcode size={9} />{pkg.barcode}
                                                    </span>
                                                )}
                                                {pkg.is_default_sale && (
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                                                        style={{ background: 'color-mix(in srgb, var(--app-success, #10b981) 10%, transparent)', color: 'var(--app-success, #10b981)' }}>
                                                        Sale Default
                                                    </span>
                                                )}
                                                {pkg.is_default_purchase && (
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                                                        style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                                        Purchase Default
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {pkg.effective_selling_price != null && (
                                            <span className="text-[12px] font-bold" style={{ color: 'var(--app-success, #10b981)' }}>
                                                {Number(pkg.effective_selling_price).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
