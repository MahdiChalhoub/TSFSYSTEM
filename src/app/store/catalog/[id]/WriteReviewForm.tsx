'use client'

import { useState, useTransition } from 'react'
import { submitReview } from '@/app/actions/ecommerce/wishlist'
import { Star } from 'lucide-react'

interface Props {
    productId: number
    onSubmitted?: () => void
}

export default function WriteReviewForm({ productId, onSubmitted }: Props) {
    const [rating, setRating] = useState(5)
    const [hovered, setHovered] = useState(0)
    const [body, setBody] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!body.trim()) { setError('Please write something about this product.'); return }
        setError('')
        startTransition(async () => {
            const res = await submitReview({ product: productId, rating, body })
            if (!res.ok) { setError(res.error ?? 'Failed to submit'); return }
            setSubmitted(true)
            onSubmitted?.()
        })
    }

    if (submitted) return (
        <div style={{ background: '#d1fae5', color: '#065f46', padding: '1rem', borderRadius: '0.75rem', fontWeight: 600, textAlign: 'center' }}>
            ✓ Thank you for your review!
        </div>
    )

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <h3 style={{ fontWeight: 700, color: '#1e293b', fontSize: '1.0625rem' }}>Write a Review</h3>

            {/* Star picker */}
            <div>
                <label className="store-label">Your Rating</label>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button"
                            onMouseEnter={() => setHovered(n)}
                            onMouseLeave={() => setHovered(0)}
                            onClick={() => setRating(n)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', lineHeight: 1 }}
                            id={`star-${n}`}>
                            <Star size={28}
                                fill={n <= (hovered || rating) ? '#f59e0b' : 'none'}
                                style={{ color: '#f59e0b', transition: 'all 0.1s' }} />
                        </button>
                    ))}
                    <span style={{ alignSelf: 'center', fontSize: '0.875rem', color: '#94a3b8', marginLeft: '0.5rem' }}>
                        {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][hovered || rating]}
                    </span>
                </div>
            </div>

            {/* Body */}
            <div>
                <label className="store-label">Your Review</label>
                <textarea id="review-body" className="store-input" rows={3}
                    value={body} onChange={e => setBody(e.target.value)}
                    placeholder="What did you think about this product?" />
            </div>

            {error && <p style={{ color: '#dc2626', fontSize: '0.875rem' }}>{error}</p>}

            <button id="submit-review-btn" type="submit" disabled={isPending}
                className="store-btn store-btn-primary" style={{ alignSelf: 'flex-start', padding: '0.625rem 1.25rem' }}>
                {isPending ? 'Submitting…' : 'Submit Review'}
            </button>
        </form>
    )
}
