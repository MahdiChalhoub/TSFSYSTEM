'use client'

import { useState, useEffect, useMemo } from 'react'
import { Eye, ShoppingBag, Package, Star, Search, Grid3X3, Tag, Sparkles } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────
interface Product {
    id: number
    name: string
    sku: string
    selling_price: number | string
    cost_price: number | string
    category_name?: string
    stock_quantity?: number
    image_url?: string
    is_active?: boolean
}

const CLIENT_TYPES = [
    { key: 'RETAIL', label: 'Retail Customer', color: 'stone', desc: 'Standard pricing — end consumer view' },
    { key: 'WHOLESALE', label: 'Wholesale Buyer', color: 'amber', desc: 'Bulk pricing — reseller/distributor view' },
    { key: 'CONSIGNEE', label: 'Consignee Partner', color: 'purple', desc: 'Consignment pricing — pay-on-sale view' },
] as const

// ─── Server action wrappers ─────────────────────────────────
async function fetchProducts(): Promise<Product[]> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch('products/?is_active=true')
}

async function fetchOrg() {
    const { erpFetch } = await import('@/lib/erp-api')
    const orgs = await erpFetch('organizations/')
    return Array.isArray(orgs) && orgs.length > 0 ? orgs[0] : null
}

// ─── Component ──────────────────────────────────────────────
export default function ClientGatePreviewClient() {
    const [products, setProducts] = useState<Product[]>([])
    const [org, setOrg] = useState<{ name: string; slug: string } | null>(null)
    const [clientType, setClientType] = useState('RETAIL')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([fetchProducts(), fetchOrg()])
            .then(([p, o]) => { setProducts(p || []); setOrg(o) })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    const filtered = useMemo(() => {
        let list = products.filter(p => p.is_active !== false)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
        }
        return list
    }, [products, search])

    // Simulate pricing per client type
    const getPrice = (product: Product) => {
        const base = Number(product.selling_price) || 0
        if (clientType === 'WHOLESALE') return (base * 0.85).toFixed(2)  // ~15% discount
        if (clientType === 'CONSIGNEE') return (base * 0.70).toFixed(2)  // revenue share pricing
        return base.toFixed(2)
    }

    const getPriceLabel = () => {
        if (clientType === 'WHOLESALE') return 'Wholesale Price'
        if (clientType === 'CONSIGNEE') return 'Consignment Price'
        return 'Retail Price'
    }

    const currentType = CLIENT_TYPES.find(t => t.key === clientType) || CLIENT_TYPES[0]

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex items-center gap-3 text-gray-400">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    Loading preview...
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <Eye size={22} className="text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Client Gate Preview</h1>
                        <p className="text-sm text-gray-500">
                            Previewing <strong>{org?.name || 'Your Store'}</strong> as a customer sees it
                        </p>
                    </div>
                </div>
            </div>

            {/* Client Type Selector */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Tag size={14} className="text-gray-400" />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Viewing as</span>
                </div>
                <div className="flex flex-wrap gap-2">
                    {CLIENT_TYPES.map(type => (
                        <button
                            key={type.key}
                            onClick={() => setClientType(type.key)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${clientType === type.key
                                    ? type.color === 'stone' ? 'bg-stone-900 text-white shadow-lg'
                                        : type.color === 'amber' ? 'bg-amber-500 text-white shadow-lg'
                                            : 'bg-purple-600 text-white shadow-lg'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">{currentType.desc}</p>
            </div>

            {/* Preview Frame */}
            <div className="bg-[#020617] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
                {/* Storefront Header */}
                <div className="p-8 pb-4">
                    <div className="max-w-6xl mx-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                                    <ShoppingBag size={18} className="text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white">{org?.name || 'Store'}</h2>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${clientType === 'RETAIL' ? 'bg-stone-700 text-stone-300'
                                                : clientType === 'WHOLESALE' ? 'bg-amber-900/50 text-amber-400'
                                                    : 'bg-purple-900/50 text-purple-400'
                                            }`}>
                                            {currentType.label}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {/* Search */}
                            <div className="relative w-72">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search products..."
                                    className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-emerald-500/30"
                                />
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-4 mb-6">
                            <div className="px-5 py-3 bg-white/5 border border-white/5 rounded-2xl">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Products</span>
                                <div className="text-xl font-black text-white flex items-center gap-2">
                                    <Sparkles size={14} className="text-emerald-400" />
                                    {filtered.length}
                                </div>
                            </div>
                            <div className="px-5 py-3 bg-white/5 border border-white/5 rounded-2xl">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{getPriceLabel()}</span>
                                <div className="text-xl font-black text-white flex items-center gap-2">
                                    <Tag size={14} className={clientType === 'WHOLESALE' ? 'text-amber-400' : clientType === 'CONSIGNEE' ? 'text-purple-400' : 'text-gray-400'} />
                                    Active
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Grid */}
                <div className="bg-[#0a0f1e] p-8 pt-4">
                    <div className="max-w-6xl mx-auto">
                        {filtered.length === 0 ? (
                            <div className="text-center py-16">
                                <Package size={40} className="text-gray-700 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">No products found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {filtered.slice(0, 20).map(product => (
                                    <div
                                        key={product.id}
                                        className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-emerald-500/20 transition-all group"
                                    >
                                        {/* Product Image Placeholder */}
                                        <div className="aspect-square bg-white/5 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                                            {product.image_url ? (
                                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package size={28} className="text-gray-700" />
                                            )}
                                        </div>
                                        {/* Product Info */}
                                        <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                            {product.name}
                                        </h3>
                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">{product.sku}</p>
                                        {product.category_name && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <Grid3X3 size={10} className="text-gray-600" />
                                                <span className="text-[10px] text-gray-600">{product.category_name}</span>
                                            </div>
                                        )}
                                        {/* Price */}
                                        <div className="mt-3 flex items-baseline gap-2">
                                            <span className={`text-lg font-black ${clientType === 'WHOLESALE' ? 'text-amber-400'
                                                    : clientType === 'CONSIGNEE' ? 'text-purple-400'
                                                        : 'text-emerald-400'
                                                }`}>
                                                ${getPrice(product)}
                                            </span>
                                            {clientType !== 'RETAIL' && (
                                                <span className="text-[10px] text-gray-600 line-through">
                                                    ${Number(product.selling_price || 0).toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                        {/* Stock */}
                                        {product.stock_quantity !== undefined && (
                                            <div className="flex items-center gap-1 mt-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${(product.stock_quantity || 0) > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                <span className="text-[10px] text-gray-500">
                                                    {(product.stock_quantity || 0) > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {filtered.length > 20 && (
                            <p className="text-center text-xs text-gray-600 mt-6">
                                Showing 20 of {filtered.length} products
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
