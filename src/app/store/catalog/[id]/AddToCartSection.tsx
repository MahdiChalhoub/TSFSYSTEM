'use client'

import { useState, useTransition } from 'react'
import { addToCart } from '@/app/actions/ecommerce/cart'
import { ShoppingCart, Plus, Minus } from 'lucide-react'

export default function AddToCartSection({ productId, productName }: { productId: number; productName: string }) {
    const [qty, setQty] = useState(1)
    const [toast, setToast] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleAdd = () => {
        startTransition(async () => {
            const res = await addToCart(productId, qty)
            if (res.ok) {
                setToast(`${productName} added to cart ✓`)
                setTimeout(() => setToast(''), 2500)
            } else {
                setToast('Error: ' + res.error)
                setTimeout(() => setToast(''), 3000)
            }
        })
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Qty selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="store-btn store-btn-ghost"
                    style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
                    id="qty-decrease"
                >
                    <Minus size={14} />
                </button>
                <span style={{ fontWeight: 700, fontSize: '1.125rem', minWidth: '2rem', textAlign: 'center' }}>{qty}</span>
                <button
                    onClick={() => setQty(q => q + 1)}
                    className="store-btn store-btn-ghost"
                    style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
                    id="qty-increase"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Add to Cart */}
            <button
                onClick={handleAdd}
                disabled={isPending}
                className="store-btn store-btn-primary"
                style={{ fontSize: '1rem', padding: '0.875rem 1.5rem' }}
                id="add-to-cart-btn"
            >
                <ShoppingCart size={18} />
                {isPending ? 'Adding…' : 'Add to Cart'}
            </button>

            {/* Toast */}
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
