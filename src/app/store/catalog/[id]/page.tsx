import { erpFetch } from '@/lib/erp-api'
import { notFound } from 'next/navigation'
import AddToCartSection from './AddToCartSection'
import WriteReviewForm from './WriteReviewForm'
import { getClientUser } from '@/app/actions/ecommerce/store-auth'
import { Star, ShoppingBag, Package } from 'lucide-react'

async function getProduct(id: string) {
    const res = await erpFetch(`inventory/products/${id}/`)
    if (!res.ok) return null
    return await res.json()
}

async function getReviews(productId: string) {
    try {
        const res = await erpFetch(`client-portal/reviews/?product=${productId}&page_size=10`)
        if (!res.ok) return []
        const data = await res.json()
        return data.results ?? data
    } catch { return [] }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const [product, reviews, user] = await Promise.all([
        getProduct(id),
        getReviews(id),
        getClientUser(),
    ])

    if (!product) notFound()

    const avgRating = reviews.length
        ? reviews.reduce((s: number, r: any) => s + (r.rating ?? 0), 0) / reviews.length
        : null
    const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2 })

    return (
        <div className="store-section">
            <div className="store-container">
                <div className="store-2col">
                    {/* Left: Image */}
                    <div className="store-card" style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {product.image_url
                            ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.5rem' }} />
                            : <ShoppingBag size={80} style={{ color: '#cbd5e1' }} />}
                    </div>

                    {/* Right: Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {product.category?.name && (
                            <span className="store-product-category">{product.category.name}</span>
                        )}
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--app-surface-2)', lineHeight: 1.2 }}>
                            {product.name}
                        </h1>

                        {avgRating !== null && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                {[1, 2, 3, 4, 5].map(n => (
                                    <Star key={n} size={16} fill={n <= Math.round(avgRating) ? 'currentColor' : 'none'}
                                        style={{ color: 'var(--app-warning)' }} />
                                ))}
                                <span style={{ fontSize: '0.875rem', color: 'var(--app-muted-foreground)' }}>
                                    {avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? 's' : ''})
                                </span>
                            </div>
                        )}

                        <p style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--store-accent, #10b981)' }}>
                            {fmt(product.price)}
                        </p>

                        {product.description && (
                            <p style={{ color: '#475569', lineHeight: 1.6, fontSize: '0.9375rem' }}>
                                {product.description}
                            </p>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Package size={14} style={{ color: 'var(--app-faint)' }} />
                            <span style={{ fontSize: '0.875rem', color: 'var(--app-muted-foreground)' }}>
                                {product.stock_quantity > 0
                                    ? <span style={{ color: '#059669', fontWeight: 600 }}>In stock</span>
                                    : <span style={{ color: '#dc2626', fontWeight: 600 }}>Out of stock</span>}
                            </span>
                        </div>

                        {product.stock_quantity > 0 && (
                            <AddToCartSection productId={product.id} productName={product.name} />
                        )}

                        {/* SKU */}
                        {product.sku && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--app-faint)' }}>SKU: {product.sku}</p>
                        )}
                    </div>
                </div>

                {/* Reviews */}
                <div style={{ marginTop: '3rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--app-surface-2)' }}>
                        Customer Reviews
                    </h2>
                    {reviews.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                            {reviews.map((r: any) => (
                                <div key={r.id} className="store-card" style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        {[1, 2, 3, 4, 5].map(n => (
                                            <Star key={n} size={14} fill={n <= (r.rating ?? 0) ? 'currentColor' : 'none'}
                                                style={{ color: 'var(--app-warning)' }} />
                                        ))}
                                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
                                            {r.contact_name ?? 'Customer'}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--app-faint)', marginLeft: 'auto' }}>
                                            {new Date(r.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    {r.body && <p style={{ fontSize: '0.9375rem', color: '#475569', margin: 0 }}>{r.body}</p>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: 'var(--app-faint)', marginBottom: '1.5rem' }}>No reviews yet — be the first!</p>
                    )}

                    {/* Write a review */}
                    <div className="store-card">
                        {user
                            ? <WriteReviewForm productId={product.id} />
                            : (
                                <p style={{ color: 'var(--app-muted-foreground)', fontSize: '0.9375rem' }}>
                                    <a href="/store/login" style={{ color: 'var(--store-accent, #10b981)', fontWeight: 600 }}>Sign in</a>
                                    {' '}to write a review.
                                </p>
                            )
                        }
                    </div>
                </div>
            </div>
        </div>
    )
}
