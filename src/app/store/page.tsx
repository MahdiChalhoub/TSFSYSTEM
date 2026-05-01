import { getStorefrontPublicConfig } from '@/app/actions/ecommerce/store-auth'
import { erpFetch } from '@/lib/erp-api'
import Link from 'next/link'
import { ShoppingBag, ArrowRight } from 'lucide-react'

async function getFeaturedProducts() {
    try {
        const data = await erpFetch('inventory/products/?is_active=true&page_size=8&ordering=-created_at')
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch { return [] }
}

async function getActivePromotions() {
    try {
        const data = await erpFetch('client-portal/cart-promotions/?is_active=true&page_size=5')
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch { return [] }
}

export default async function StorefrontHome() {
    const [config, products, promotions] = await Promise.all([
        getStorefrontPublicConfig().catch(() => null),
        getFeaturedProducts(),
        getActivePromotions(),
    ])

    const headline = config?.storefront_title
        ? `Welcome to ${config.storefront_title}`
        : 'Welcome to our store'
    const subtitle = config?.storefront_tagline ?? 'Shop our latest collection'

    return (
        <>
            {/* Hero */}
            <div className="store-hero">
                <div className="store-container">
                    <h1>{headline}</h1>
                    <p>{subtitle}</p>
                    <Link href="/store/catalog" className="store-btn store-btn-outline" id="hero-shop-btn"
                        style={{ borderColor: '#fff', color: '#fff', display: 'inline-flex' }}>
                        Shop Now <ArrowRight size={16} />
                    </Link>
                </div>
            </div>

            {/* Promo banner (if active promotions) */}
            {promotions.length > 0 && (
                <div style={{ background: 'var(--app-surface-2)', color: '#fff', padding: '0.75rem 0' }}>
                    <div className="store-container" style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                        🎉 {promotions[0].name}: {promotions[0].description ?? 'Special deal active!'}
                        {promotions.length > 1 && ` · +${promotions.length - 1} more promotions`}
                    </div>
                </div>
            )}

            {/* Featured Products */}
            <section className="store-section">
                <div className="store-container">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                        <h2 className="store-section-title" style={{ margin: 0 }}>Featured Products</h2>
                        <Link href="/store/catalog" className="store-btn store-btn-ghost" id="view-all-btn">
                            View All <ArrowRight size={14} />
                        </Link>
                    </div>
                    <div className="store-product-grid">
                        {products.length === 0 && (
                            <p style={{ color: 'var(--app-faint)', gridColumn: '1/-1', textAlign: 'center', padding: '3rem 0' }}>
                                No products available yet.
                            </p>
                        )}
                        {products.map((p: any) => (
                            <Link key={p.id} href={`/store/catalog/${p.id}`} className="store-product-card" id={`product-${p.id}`}>
                                <div className="store-product-image">
                                    {p.image_url
                                        ? <img src={p.image_url} alt={p.name} />
                                        : <ShoppingBag size={40} />}
                                </div>
                                <div className="store-product-body">
                                    {p.category?.name && <span className="store-product-category">{p.category.name}</span>}
                                    <p className="store-product-name">{p.name}</p>
                                    <p className="store-product-price">
                                        {Number(p.price).toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        </>
    )
}
