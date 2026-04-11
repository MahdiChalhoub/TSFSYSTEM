'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Heart, ShoppingCart, Trash2, HeartOff } from 'lucide-react'
import { WishlistItem, removeFromWishlist } from '@/app/actions/ecommerce/wishlist'
import { addToCart } from '@/app/actions/ecommerce/cart'

interface Props { initialItems: WishlistItem[] }

export default function WishlistClient({ initialItems }: Props) {
    const [items, setItems] = useState(initialItems)
    const [toast, setToast] = useState('')
    const [isPending, startTransition] = useTransition()

    const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

    const handleRemove = (id: number) => {
        startTransition(async () => {
            await removeFromWishlist(id)
            setItems(prev => prev.filter(i => i.id !== id))
            showToast('Removed from wishlist')
        })
    }

    const handleMoveToCart = (item: WishlistItem) => {
        startTransition(async () => {
            const res = await addToCart(item.product, 1)
            if (res.ok) {
                await removeFromWishlist(item.id)
                setItems(prev => prev.filter(i => i.id !== item.id))
                showToast(`${item.product_name} moved to cart ✓`)
            } else {
                showToast('Error: ' + res.error)
            }
        })
    }

    const fmt = (v: string) => parseFloat(v).toLocaleString(undefined, { minimumFractionDigits: 2 })

    return (
        <div className="store-section">
            <div className="store-container">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Heart size={24} style={{ color: '#ef4444' }} fill="currentColor" />
                    <h1 className="store-section-title" style={{ margin: 0 }}>My Wishlist</h1>
                    <span style={{ color: '#94a3b8', fontSize: '0.9375rem' }}>({items.length} item{items.length !== 1 ? 's' : ''})</span>
                </div>

                {items.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                        <HeartOff size={56} style={{ color: '#cbd5e1', margin: '0 auto 1rem' }} />
                        <p style={{ color: '#94a3b8', marginBottom: '1.25rem' }}>Your wishlist is empty.</p>
                        <Link href="/store/catalog" className="store-btn store-btn-primary">Browse Products</Link>
                    </div>
                )}

                <div className="store-product-grid">
                    {items.map(item => (
                        <div key={item.id} className="store-product-card">
                            <Link href={`/store/catalog/${item.product}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                <div className="store-product-image">
                                    {item.product_image
                                        ? <img src={item.product_image} alt={item.product_name} />
                                        : <ShoppingCart size={40} style={{ color: '#cbd5e1' }} />}
                                </div>
                            </Link>
                            <div className="store-product-body">
                                <p className="store-product-name">{item.product_name}</p>
                                <p className="store-product-price">{fmt(item.product_price)}</p>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                    <button onClick={() => handleMoveToCart(item)} disabled={isPending}
                                        className="store-btn store-btn-primary"
                                        style={{ flex: 1, fontSize: '0.8125rem', padding: '0.5rem' }}
                                        id={`move-to-cart-${item.id}`}>
                                        <ShoppingCart size={13} /> Move to Cart
                                    </button>
                                    <button onClick={() => handleRemove(item.id)} disabled={isPending}
                                        className="store-btn store-btn-ghost"
                                        style={{ padding: '0.5rem', color: '#ef4444' }}
                                        id={`remove-wish-${item.id}`}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {toast && (
                <div style={{
                    position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 50,
                    background: '#1e293b', color: '#fff', padding: '0.75rem 1.25rem',
                    borderRadius: '0.75rem', fontSize: '0.875rem', fontWeight: 600,
                    boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
                }}>
                    {toast}
                </div>
            )}
        </div>
    )
}
