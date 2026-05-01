'use client'

import { useState, useEffect, useTransition } from 'react'
import { erpFetch } from '@/lib/erp-api'
import Link from 'next/link'
import { Search, ShoppingBag, Filter } from 'lucide-react'
import { addToCart } from '@/app/actions/ecommerce/cart'

interface Product {
    id: number
    name: string
    sku: string
    price: number
    image_url: string | null
    category?: { id: number; name: string }
    is_active: boolean
}

interface Category { id: number; name: string }

export default function StoreCatalogPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [search, setSearch] = useState('')
    const [catFilter, setCatFilter] = useState<number | null>(null)
    const [loading, setLoading] = useState(true)
    const [toast, setToast] = useState('')
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [prods, cats] = await Promise.all([
                erpFetch('inventory/products/?is_active=true&page_size=100&ordering=name'),
                erpFetch('inventory/categories/?page_size=50'),
            ])
            setProducts(Array.isArray(prods) ? prods : prods?.results ?? [])
            const catsArr = Array.isArray(cats) ? cats : cats?.results ?? []
            setCategories(catsArr)
            setLoading(false)
        }
        load()
    }, [])

    const showToast = (msg: string) => {
        setToast(msg)
        setTimeout(() => setToast(''), 2500)
    }

    const handleAddToCart = (p: Product) => {
        startTransition(async () => {
            const res = await addToCart(p.id, 1)
            if (res.ok) showToast(`${p.name} added to cart ✓`)
            else showToast('Error: ' + res.error)
        })
    }

    const filtered = products.filter(p => {
        const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku?.includes(search)
        const matchCat = !catFilter || p.category?.id === catFilter
        return matchSearch && matchCat
    })

    const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2 })

    return (
        <div className="store-section">
            <div className="store-container">
                {/* Search + Filter bar */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                        <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--app-faint)' }} />
                        <input
                            id="catalog-search"
                            className="store-input"
                            placeholder="Search products…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ paddingLeft: '2.25rem' }}
                        />
                    </div>
                </div>

                {/* Category pills */}
                {categories.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        <button
                            onClick={() => setCatFilter(null)}
                            className={`store-btn ${!catFilter ? 'store-btn-primary' : 'store-btn-ghost'}`}
                            style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
                            id="cat-all"
                        >
                            All
                        </button>
                        {categories.map(c => (
                            <button
                                key={c.id}
                                onClick={() => setCatFilter(catFilter === c.id ? null : c.id)}
                                className={`store-btn ${catFilter === c.id ? 'store-btn-primary' : 'store-btn-ghost'}`}
                                style={{ padding: '0.375rem 0.875rem', fontSize: '0.8125rem' }}
                                id={`cat-${c.id}`}
                            >
                                {c.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* Results summary */}
                <p style={{ color: 'var(--app-faint)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    {loading ? 'Loading…' : `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`}
                    {search && ` for "${search}"`}
                </p>

                {/* Grid */}
                <div className="store-product-grid">
                    {filtered.map(p => (
                        <div key={p.id} className="store-product-card" style={{ textDecoration: 'none', cursor: 'default' }}>
                            <Link href={`/store/catalog/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div className="store-product-image">
                                    {p.image_url
                                        ? <img src={p.image_url} alt={p.name} />
                                        : <ShoppingBag size={40} />}
                                </div>
                            </Link>
                            <div className="store-product-body">
                                {p.category?.name && <span className="store-product-category">{p.category.name}</span>}
                                <Link href={`/store/catalog/${p.id}`} style={{ textDecoration: 'none' }}>
                                    <p className="store-product-name">{p.name}</p>
                                </Link>
                                <p className="store-product-price">{fmt(p.price)}</p>
                                <button
                                    onClick={() => handleAddToCart(p)}
                                    disabled={isPending}
                                    className="store-btn store-btn-primary"
                                    style={{ width: '100%', marginTop: '0.5rem' }}
                                    id={`add-to-cart-${p.id}`}
                                >
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    ))}
                    {!loading && filtered.length === 0 && (
                        <p style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--app-faint)', padding: '3rem 0' }}>
                            No products found.
                        </p>
                    )}
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 50,
                    background: 'var(--app-surface-2)', color: '#fff', padding: '0.75rem 1.25rem',
                    borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                }}>
                    {toast}
                </div>
            )}
        </div>
    )
}
