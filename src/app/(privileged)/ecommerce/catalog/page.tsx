'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Search, Tag, Grid, RefreshCw, Package, Eye, EyeOff, CheckCircle, XCircle, ShoppingBag } from 'lucide-react'

type Product = {
 id: number
 name: string
 sku?: string
 price: number
 stock_quantity?: number
 category?: { name: string }
 category_name?: string
 is_active?: boolean
 is_published?: boolean
 image_url?: string
}

export default function EcommerceCatalogPage() {
 const [products, setProducts] = useState<Product[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [view, setView] = useState<'grid' | 'list'>('grid')
 const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

 useEffect(() => { load() }, [])

 async function load() {
 setLoading(true)
 try {
 const data = await erpFetch('inventory/products/?is_active=true&page_size=100')
 setProducts(Array.isArray(data) ? data : (data?.results ?? []))
 } catch { setProducts([]) }
 setLoading(false)
 }

 function showToast(msg: string, type: 'ok' | 'err') {
 setToast({ msg, type })
 setTimeout(() => setToast(null), 3000)
 }

 async function togglePublish(p: Product) {
 try {
 await erpFetch(`inventory/products/${p.id}/`, {
 method: 'PATCH',
 body: JSON.stringify({ is_published: !p.is_published })
 })
 setProducts(prev => prev.map(x => x.id === p.id ? { ...x, is_published: !x.is_published } : x))
 showToast(!p.is_published ? 'Published to storefront' : 'Hidden from storefront', 'ok')
 } catch { showToast('Failed to update', 'err') }
 }

 const filtered = products.filter(p => {
 const q = search.toLowerCase()
 return !q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
 })

 const published = products.filter(p => p.is_published).length

 return (
 <div className="app-page min-h-screen bg-[#070D1B] text-app-foreground p-6 flex flex-col gap-6 bg-app-background">
 {toast && (
 <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-app-success/80 border-app-success/30 text-app-success' : 'bg-app-error/80 border-app-error/30 text-app-error'}`}>
 {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
 {toast.msg}
 </div>
 )}

 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-primary flex items-center justify-center shadow-lg shadow-violet-900/40">
 <ShoppingBag size={28} className="text-app-foreground" />
 </div>
 Online <span className="text-app-primary">Catalog</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">{published} of {products.length} products published</p>
 </div>
 <div className="flex items-center gap-2">
 <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-app-surface-2 hover:bg-app-surface text-app-muted-foreground text-sm">
 <RefreshCw size={14} />Refresh
 </button>
 <div className="flex gap-0.5 bg-app-surface-2 p-1 rounded-xl">
 <button onClick={() => setView('grid')} className={`p-2 rounded-lg ${view === 'grid' ? 'bg-app-surface text-app-foreground' : 'text-app-muted-foreground'}`}><Grid size={14} /></button>
 <button onClick={() => setView('list')} className={`p-2 rounded-lg ${view === 'list' ? 'bg-app-surface text-app-foreground' : 'text-app-muted-foreground'}`}><Tag size={14} /></button>
 </div>
 </div>
 </div>

 {/* Search */}
 <div className="relative max-w-md">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <input
 value={search} onChange={e => setSearch(e.target.value)}
 placeholder="Search by name or SKU…"
 className="w-full pl-9 pr-4 py-2 bg-[#0F1729] border border-app-border rounded-xl text-sm text-app-muted-foreground placeholder-gray-600 focus:outline-none focus:border-teal-700"
 />
 </div>

 {/* Product grid / list */}
 {loading ? (
 <div className={`grid ${view === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'} gap-4`}>
 {Array.from({ length: 8 }).map((_, i) => <div key={i} className={`h-${view === 'grid' ? '48' : '16'} bg-app-surface-2/50 rounded-2xl animate-pulse`} />)}
 </div>
 ) : filtered.length === 0 ? (
 <div className="bg-[#0F1729] rounded-2xl border border-app-border py-16 flex flex-col items-center gap-3 text-app-muted-foreground">
 <Package size={48} className="opacity-20" />
 <p className="text-sm">No products found</p>
 </div>
 ) : view === 'grid' ? (
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
 {filtered.map(p => (
 <div key={p.id} className={`bg-[#0F1729] rounded-2xl border flex flex-col overflow-hidden transition-all ${p.is_published ? 'border-teal-800/50' : 'border-app-border opacity-70'}`}>
 <div className="h-32 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
 {p.image_url ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" /> : <Package size={32} className="text-app-muted-foreground" />}
 </div>
 <div className="p-3 flex flex-col gap-1 flex-1">
 <p className="font-semibold text-sm text-app-foreground truncate">{p.name}</p>
 {p.sku && <p className="text-xs font-mono text-app-muted-foreground">{p.sku}</p>}
 <p className="text-sm font-bold text-teal-400 mt-auto">${Number(p.price || 0).toFixed(2)}</p>
 </div>
 <button
 onClick={() => togglePublish(p)}
 className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all ${p.is_published ? 'bg-teal-900/20 text-teal-400 hover:bg-app-error/20 hover:text-app-error' : 'bg-app-surface-2 text-app-muted-foreground hover:bg-teal-900/20 hover:text-teal-400'}`}
 >
 {p.is_published ? <><Eye size={11} />Published</> : <><EyeOff size={11} />Hidden</>}
 </button>
 </div>
 ))}
 </div>
 ) : (
 <div className="flex flex-col gap-2">
 {filtered.map(p => (
 <div key={p.id} className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border ${p.is_published ? 'border-teal-800/40 bg-[#0F1729]' : 'border-app-border bg-[#0F1729] opacity-70'}`}>
 <Package size={14} className="text-teal-400 shrink-0" />
 <div className="flex-1 min-w-0">
 <div className="font-medium text-sm text-app-foreground truncate">{p.name}</div>
 <div className="text-xs text-app-muted-foreground">{p.sku || '—'}{p.category?.name ? ` · ${p.category.name}` : ''}</div>
 </div>
 <div className="font-mono font-bold text-sm text-teal-400 shrink-0">${Number(p.price || 0).toFixed(2)}</div>
 <div className="text-xs text-app-muted-foreground shrink-0">Stock: {p.stock_quantity ?? '—'}</div>
 <button
 onClick={() => togglePublish(p)}
 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${p.is_published ? 'bg-teal-900/30 text-teal-400 hover:bg-app-error/20 hover:text-app-error' : 'bg-app-surface-2 text-app-muted-foreground hover:bg-teal-900/20 hover:text-teal-400'}`}
 >
 {p.is_published ? <><Eye size={11} />Show</> : <><EyeOff size={11} />Hidden</>}
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 )
}
