'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    ArrowLeft, ShoppingCart, FileQuestion, Loader2, CheckCircle2,
    Package, Star, Minus, Plus, Tag, Layers, AlertCircle, Heart
} from 'lucide-react'
import { useCart } from '../../engine/hooks/useCart'
import { useStorefrontPath } from '../../engine/hooks/useStorefrontPath'
import { useConfig } from '../../engine/hooks/useConfig'
import { useWishlist } from '../../engine/hooks/useWishlist'
import { useAuth } from '../../engine/hooks/useAuth'
import type { ProductDetailProps, ProductVariant } from '../../engine/types'
export default function MidnightProductDetail({ product }: ProductDetailProps) {
    const router = useRouter()
    const { path } = useStorefrontPath()
    const { addToCart } = useCart()
    const { showPrice, isQuoteMode } = useConfig()
    const { isInWishlist, toggleWishlist } = useWishlist()
    const { isAuthenticated } = useAuth()
    const [reviews, setReviews] = useState<any[]>([])
    const [reviewLoading, setReviewLoading] = useState(true)
    const [showReviewForm, setShowReviewForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [newReview, setNewReview] = useState({ rating: 5, title: '', content: '' })
    const fetchReviews = useCallback(() => {
        fetch(`/api/client_portal/reviews/?product=${product.id}`)
            .then(res => res.json())
            .then(data => { setReviews(Array.isArray(data) ? data : (data.results || [])); setReviewLoading(false) })
            .catch(() => setReviewLoading(false))
    }, [product.id])
    useEffect(() => { fetchReviews() }, [fetchReviews])
    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!isAuthenticated) return
        setSubmitting(true)
        try {
            const res = await fetch('/api/client_portal/reviews/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${localStorage.getItem('portal_token')}` },
                body: JSON.stringify({ product: product.id, ...newReview }),
            })
            if (res.ok) { setShowReviewForm(false); setNewReview({ rating: 5, title: '', content: '' }); fetchReviews() }
        } catch (err) { console.error('[Review] Submission failed:', err) }
        finally { setSubmitting(false) }
    }
    // Variant Logic
    const options = useMemo(() => {
        if (product.options?.length) return product.options
        if (!product.variants?.length) return []
        const optMap: Record<string, Set<string>> = {}
        product.variants.forEach(v => {
            Object.entries(v.option_values).forEach(([name, val]) => {
                if (!optMap[name]) optMap[name] = new Set()
                optMap[name].add(val)
            })
        })
        return Object.entries(optMap).map(([name, set]) => ({ id: name, name, values: Array.from(set) }))
    }, [product.options, product.variants])
    const [selections, setSelections] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {}
        options.forEach(opt => { if (opt.values.length) initial[opt.name] = opt.values[0] })
        return initial
    })
    const activeVariant = useMemo(() => {
        if (!product.variants?.length) return null
        return product.variants.find(v => Object.entries(selections).every(([name, val]) => v.option_values[name] === val))
    }, [product.variants, selections])
    const currentPrice = activeVariant?.price ?? product.selling_price_ttc
    const currentPriceHT = activeVariant?.selling_price_ht ?? product.selling_price_ht
    const currentImage = activeVariant?.image_url ?? product.image_url
    const currentSKU = activeVariant?.sku ?? product.sku
    const currentStock = activeVariant?.stock_quantity ?? product.stock_quantity
    const [quantity, setQuantity] = useState(1)
    const [added, setAdded] = useState(false)
    const handleAddToCart = () => {
        addToCart({
            product_id: product.id, variant_id: activeVariant?.id,
            product_name: product.name + (activeVariant ? ` - ${activeVariant.name}` : ''),
            unit_price: currentPrice, quantity, image_url: currentImage,
            tax_rate: (product as any).tax_rate || 0,
        })
        setAdded(true)
        setTimeout(() => setAdded(false), 2000)
    }
    return (
        <div className="min-h-screen bg-slate-950 py-8">
            <div className="max-w-5xl mx-auto px-4">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-app-text-faint hover:text-white mb-8 transition-colors">
                    <ArrowLeft size={16} /> Back
                </button>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Product Image */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden aspect-square">
                        {currentImage ? (
                            <img src={currentImage} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                                <Package size={64} className="text-app-text" />
                            </div>
                        )}
                    </div>
                    {/* Product Info */}
                    <div className="space-y-6">
                        {product.category_name && (
                            <span className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">
                                <Tag size={10} /> {product.category_name}
                            </span>
                        )}
                        <h1 className="text-4xl font-black text-white tracking-tight">{product.name}</h1>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-emerald-400">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <Star key={i} size={14} fill={i <= ((product as any).rating || 5) ? "currentColor" : "none"} />
                                ))}
                            </div>
                            <span className="text-xs text-app-text-faint">{reviews.length} Reviews</span>
                        </div>
                        <p className="text-[10px] text-app-text-muted font-mono tracking-widest uppercase">SKU: {currentSKU}</p>
                        {product.description && <p className="text-app-text-faint leading-relaxed text-sm">{product.description}</p>}
                        {/* Variant Options */}
                        {options.length > 0 && (
                            <div className="space-y-6 pt-2">
                                {options.map(opt => (
                                    <div key={opt.id} className="space-y-3">
                                        <p className="text-[10px] font-black text-app-text-faint uppercase tracking-widest">{opt.name}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {opt.values.map(val => (
                                                <button key={val} onClick={() => setSelections(prev => ({ ...prev, [opt.name]: val }))}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all
                                                        ${selections[opt.name] === val
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                                            : 'bg-white/5 text-app-text-faint border-white/5 hover:border-white/20 hover:text-white'
                                                        }`}>
                                                    {val}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Pricing */}
                        {showPrice ? (
                            <div className="space-y-1 pt-4">
                                <div className="text-4xl font-black text-white">
                                    <span className="text-emerald-500 mr-1">$</span>{currentPrice}
                                </div>
                                {currentPriceHT && currentPriceHT !== currentPrice && (
                                    <p className="text-xs text-app-text-muted">Before tax: ${currentPriceHT}</p>
                                )}
                            </div>
                        ) : (
                            <div className="text-amber-400 flex items-center gap-2 text-lg font-bold pt-4">
                                <FileQuestion size={20} /> Price on Request
                            </div>
                        )}
                        {/* Stock */}
                        {currentStock !== undefined && (
                            <div className={`flex items-center gap-2 text-xs font-bold ${Number(currentStock) > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {Number(currentStock) > 0
                                    ? <><CheckCircle2 size={14} /> {Math.round(Number(currentStock))} in stock</>
                                    : <><AlertCircle size={14} /> Out of stock</>
                                }
                            </div>
                        )}
                        {/* Add to Cart */}
                        {!isQuoteMode && (
                            <div className="space-y-4 pt-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs text-app-text-faint font-bold uppercase tracking-wider">Qty</span>
                                    <div className="flex items-center bg-white/5 border border-white/10 rounded-xl">
                                        <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/5 rounded-l-xl transition-colors">
                                            <Minus size={14} />
                                        </button>
                                        <span className="w-12 text-center text-white font-bold text-sm">{quantity}</span>
                                        <button onClick={() => setQuantity(quantity + 1)}
                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-white/5 rounded-r-xl transition-colors">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={handleAddToCart}
                                        disabled={currentStock !== undefined && Number(currentStock) <= 0}
                                        className={`flex-1 py-4 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2
                                            ${added ? 'bg-emerald-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'}
                                            disabled:opacity-40 disabled:cursor-not-allowed`}>
                                        {added ? <><CheckCircle2 size={18} /> Added to Cart</> : <><ShoppingCart size={18} /> Add to Cart</>}
                                    </button>
                                    <button onClick={() => toggleWishlist(product.id)}
                                        className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all
                                            ${isInWishlist(product.id)
                                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                                                : 'bg-white/5 text-app-text-faint border-white/10 hover:text-rose-400'
                                            }`}>
                                        <Heart size={20} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* Quote Mode CTA */}
                        {isQuoteMode && (
                            <Link href={path('/quote')}
                                className="block w-full py-4 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-2xl font-bold text-sm uppercase tracking-wider text-center hover:bg-teal-500/20 transition-all">
                                <FileQuestion size={18} className="inline mr-2" /> Request a Quote
                            </Link>
                        )}
                    </div>
                </div>
                {/* Reviews Section */}
                <div className="mt-24 pt-24 border-t border-white/5">
                    <div className="flex items-center justify-between mb-12">
                        <div>
                            <h2 className="text-3xl font-black text-white italic tracking-tight">Customer <span className="text-emerald-500">Feedback</span></h2>
                            <p className="text-xs text-app-text-faint mt-2 font-bold uppercase tracking-widest">Verified Experiences</p>
                        </div>
                        {isAuthenticated && (
                            <button onClick={() => setShowReviewForm(!showReviewForm)}
                                className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-white uppercase tracking-widest hover:bg-white/10 transition-all">
                                {showReviewForm ? 'Cancel' : 'Write a Review'}
                            </button>
                        )}
                    </div>
                    {showReviewForm && (
                        <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
                            <form onSubmit={handleReviewSubmit} className="bg-slate-900/60 border border-emerald-500/20 p-8 rounded-[2.5rem] space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-app-text-faint uppercase tracking-widest">Rate this product</p>
                                        <div className="flex gap-2">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <button key={star} type="button" onClick={() => setNewReview(prev => ({ ...prev, rating: star }))} className="transition-transform hover:scale-110">
                                                    <Star size={32} className={star <= newReview.rating ? 'text-emerald-500' : 'text-app-text-muted'} fill={star <= newReview.rating ? 'currentColor' : 'none'} />
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-black text-app-text-faint uppercase tracking-widest">Review Headline</p>
                                        <input required type="text" placeholder="Example: Absolutely amazing!" value={newReview.title}
                                            onChange={e => setNewReview(prev => ({ ...prev, title: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500/50" />
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black text-app-text-faint uppercase tracking-widest">Detailed Feedback</p>
                                        <textarea required rows={4} placeholder="What did you like or dislike?" value={newReview.content}
                                            onChange={e => setNewReview(prev => ({ ...prev, content: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button disabled={submitting} type="submit"
                                        className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-emerald-400 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Publish Review'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                    {reviewLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-emerald-500" size={32} />
                        </div>
                    ) : reviews.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {reviews.map((review, i) => (
                                <div key={i} className="bg-slate-900/40 border border-white/5 p-8 rounded-[2rem] space-y-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-black text-xs uppercase">
                                                {review.name?.substring(0, 2)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-white">{review.name}</p>
                                                <div className="flex items-center gap-1 text-emerald-400 mt-1">
                                                    {[1, 2, 3, 4, 5].map(star => (
                                                        <Star key={star} size={10} fill={star <= review.rating ? "currentColor" : "none"} />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                        {review.is_verified_purchase && (
                                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                Verified Purchase
                                            </span>
                                        )}
                                    </div>
                                    {review.title && <h3 className="font-bold text-white uppercase tracking-tight">{review.title}</h3>}
                                    <p className="text-sm text-app-text-faint leading-relaxed font-medium line-clamp-3">{review.content}</p>
                                    <p className="text-[10px] text-app-text-muted font-bold uppercase tracking-widest pt-2">
                                        {new Date(review.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-slate-900/20 border-2 border-dashed border-white/5 rounded-[2.5rem] py-20 flex flex-col items-center text-center px-6">
                            <Star size={40} className="text-app-text mb-4" />
                            <h3 className="text-lg font-black text-app-text-faint uppercase italic">No reviews yet</h3>
                            <p className="text-sm text-app-text-muted mt-2 max-w-xs font-medium">Be the first to share your experience with this product.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
