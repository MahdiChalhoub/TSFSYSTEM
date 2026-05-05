'use client'
import { useParams } from 'next/navigation'
import {
    ShoppingCart,
    Truck,
    ShieldCheck,
    RefreshCw,
    Star,
    Package,
    ChevronRight,
    MapPin,
    Heart,
    Share2,
    Info,
    Store
} from 'lucide-react'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'
import type { Product } from '../../engine/types'
import Link from 'next/link'
export default function EmporiumProductDetail({ product }: { product: Product }) {
    const { slug } = useParams<{ slug: string }>()
    const { addToCart } = useCart()
    const { orgName } = useConfig()
    if (!product) return null
    const price = typeof product.selling_price_ttc === 'number'
        ? product.selling_price_ttc
        : parseFloat(product.selling_price_ttc as any) || 0
    return (
        <div className="min-h-screen bg-app-bg pb-20">
            {/* Breadcrumbs */}
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                <Link href={`/tenant/${slug}`} className="hover:text-app-warning transition-colors">Home</Link>
                <ChevronRight size={12} />
                <Link href={`/tenant/${slug}/categories`} className="hover:text-app-warning transition-colors">{product.category_name || 'Catalog'}</Link>
                <ChevronRight size={12} />
                <span className="text-app-foreground truncate max-w-[200px]">{product.name}</span>
            </div>
            <main className="max-w-7xl mx-auto px-4 lg:px-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                    {/* Visuals - Left 7 columns */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="bg-app-surface rounded-[2rem] border border-app-border overflow-hidden aspect-square flex items-center justify-center relative group shadow-sm">
                            {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-slate-200">
                                    <Package size={80} />
                                    <span className="text-xs font-black uppercase tracking-widest">Image Coming Soon</span>
                                </div>
                            )}
                            <div className="absolute top-6 right-6 flex flex-col gap-3">
                                <button className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-2xl border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-error transition-all shadow-sm">
                                    <Heart size={20} />
                                </button>
                                <button className="w-12 h-12 bg-white/90 backdrop-blur-sm rounded-2xl border border-app-border flex items-center justify-center text-app-muted-foreground hover:text-app-info transition-all shadow-sm">
                                    <Share2 size={20} />
                                </button>
                            </div>
                        </div>
                        {/* Secondary Highlights */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-app-surface p-4 rounded-3xl border border-app-border flex items-center gap-4">
                                <div className="w-10 h-10 bg-app-warning-soft rounded-xl flex items-center justify-center text-app-warning">
                                    <Star size={18} fill="currentColor" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-app-foreground leading-none">4.9/5.0</p>
                                    <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest">Marketplace Rating</p>
                                </div>
                            </div>
                            <div className="bg-app-surface p-4 rounded-3xl border border-app-border flex items-center gap-4">
                                <div className="w-10 h-10 bg-app-info-soft rounded-xl flex items-center justify-center text-app-info">
                                    <Info size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-app-foreground leading-none">SKU: {product.sku}</p>
                                    <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest">Platform Ref</p>
                                </div>
                            </div>
                            <div className="bg-app-surface p-4 rounded-3xl border border-app-border flex items-center gap-4">
                                <div className="w-10 h-10 bg-app-success-soft rounded-xl flex items-center justify-center text-app-success">
                                    <Package size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-app-foreground leading-none">In Stock</p>
                                    <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest">Global Node</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Purchase Box - Right 5 columns */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-app-surface rounded-[2rem] border border-app-border p-8 shadow-sm space-y-6">
                            <div>
                                <span className="text-[10px] font-black text-app-warning bg-app-warning-soft px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block">Global Choice Marketplace</span>
                                <h1 className="text-4xl font-black text-app-foreground tracking-tighter leading-tight">{product.name}</h1>
                                <p className="text-sm text-app-muted-foreground mt-3 font-medium leading-relaxed">
                                    Premium quality product distributed by {orgName}. Optimized for logistics and guaranteed performance in {product.category_name || 'general'} environments.
                                </p>
                            </div>
                            <div className="h-px bg-app-surface-2" />
                            <div className="flex items-baseline gap-2">
                                <span className="text-5xl font-black text-app-foreground leading-none">${price.toFixed(2)}</span>
                                <span className="text-sm text-app-muted-foreground font-bold uppercase tracking-widest leading-none">Incl. Global Taxes</span>
                            </div>
                            <div className="space-y-3">
                                <div className="p-4 bg-app-bg rounded-2xl border border-app-border space-y-3">
                                    <div className="flex items-center gap-3">
                                        <MapPin size={16} className="text-app-muted-foreground" />
                                        <div className="text-xs">
                                            <p className="font-black text-app-foreground tracking-tight leading-none mb-1 uppercase">Ship to Global Node</p>
                                            <p className="text-app-muted-foreground font-bold">Delivery by Wednesday, Feb 25 • <span className="text-app-success">FREE</span></p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Truck size={16} className="text-app-muted-foreground" />
                                        <div className="text-xs">
                                            <p className="font-black text-app-foreground tracking-tight leading-none mb-1 uppercase">Standard Logistics</p>
                                            <p className="text-app-muted-foreground font-bold">Expedited & Bulk options available at checkout</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => addToCart({
                                        product_id: product.id,
                                        product_name: product.name,
                                        unit_price: price,
                                        quantity: 1,
                                        image_url: product.image_url,
                                        tax_rate: product.tax_rate || 0,
                                    })}
                                    className="flex-1 h-16 bg-yellow-400 hover:bg-app-warning text-app-foreground rounded-2xl font-black text-sm shadow-xl shadow-yellow-200/50 active:scale-95 transition-all flex items-center justify-center gap-3"
                                >
                                    <ShoppingCart size={20} /> ADD TO CART
                                </button>
                                <button className="flex-1 h-16 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 active:scale-95 transition-all">
                                    BUY IT NOW
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
                                    <ShieldCheck size={14} className="text-app-success" /> Secure Transaction
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
                                    <RefreshCw size={14} className="text-app-info" /> 30-Day Platform Returns
                                </div>
                            </div>
                        </div>
                        {/* Store Badge */}
                        <div className="bg-app-surface border border-app-border rounded-[2rem] p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-app-surface-2 rounded-2xl flex items-center justify-center text-app-muted-foreground">
                                    <Store size={22} />
                                </div>
                                <div>
                                    <h4 className="font-black text-app-foreground tracking-tight leading-none mb-1 uppercase text-sm">Official Node</h4>
                                    <p className="text-[10px] font-black text-app-success uppercase tracking-widest">Verified Global Vendor</p>
                                </div>
                            </div>
                            <button className="px-4 py-2 border border-app-border rounded-xl text-[10px] font-black uppercase hover:bg-app-bg transition-colors">
                                Visit Store
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
