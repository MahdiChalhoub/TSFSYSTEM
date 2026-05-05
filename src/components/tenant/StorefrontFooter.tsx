'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { usePortal } from '@/context/PortalContext'
import { PLATFORM_CONFIG } from '@/lib/branding'
import { Store, ShoppingCart, User, FileQuestion, Shield, Heart, Search, Grid3X3, Bell, LifeBuoy, Wallet, Package } from 'lucide-react'

export function StorefrontFooter() {
    const { slug } = useParams<{ slug: string }>()
    const { config, organization } = usePortal()
    const storeMode = config?.store_mode || 'HYBRID'
    const storeName = config?.storefront_title || organization?.name || slug

    return (
        <footer className="bg-slate-950 border-t border-white/5">
            <div className="max-w-6xl mx-auto px-4 py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    {/* Brand */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="flex items-center gap-3">
                            {organization?.logo ? (
                                <img src={organization.logo} alt={storeName} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                            ) : (
                                <div className="w-10 h-10 bg-app-success/20 border border-app-success/30 rounded-xl flex items-center justify-center text-emerald-400">
                                    <Store size={20} />
                                </div>
                            )}
                            <span className="text-xl font-black text-white">{storeName}</span>
                        </div>
                        <p className="text-app-muted-foreground text-sm leading-relaxed max-w-sm">
                            {config?.storefront_tagline || `Welcome to ${storeName}. Your trusted digital storefront for quality products and services.`}
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-4">Shop</div>
                        <ul className="space-y-2.5">
                            <li>
                                <Link href={`/tenant/${slug}`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <Store size={14} /> Products
                                </Link>
                            </li>
                            <li>
                                <Link href={`/tenant/${slug}/categories`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <Grid3X3 size={14} /> Categories
                                </Link>
                            </li>
                            <li>
                                <Link href={`/tenant/${slug}/search`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <Search size={14} /> Search
                                </Link>
                            </li>
                            {storeMode !== 'CATALOG_QUOTE' && (
                                <li>
                                    <Link href={`/tenant/${slug}/cart`}
                                        className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                        <ShoppingCart size={14} /> Cart
                                    </Link>
                                </li>
                            )}
                            {storeMode === 'CATALOG_QUOTE' && (
                                <li>
                                    <Link href={`/tenant/${slug}/quote`}
                                        className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                        <FileQuestion size={14} /> Request Quote
                                    </Link>
                                </li>
                            )}
                        </ul>
                    </div>

                    {/* Account Links */}
                    <div>
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-4">Account</div>
                        <ul className="space-y-2.5">
                            <li>
                                <Link href={`/tenant/${slug}/account`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <User size={14} /> Dashboard
                                </Link>
                            </li>
                            <li>
                                <Link href={`/tenant/${slug}/account/orders`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <Package size={14} /> Orders
                                </Link>
                            </li>
                            <li>
                                <Link href={`/tenant/${slug}/account/wishlist`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <Heart size={14} /> Wishlist
                                </Link>
                            </li>
                            <li>
                                <Link href={`/tenant/${slug}/account/wallet`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <Wallet size={14} /> Wallet
                                </Link>
                            </li>
                            <li>
                                <Link href={`/tenant/${slug}/account/notifications`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <Bell size={14} /> Notifications
                                </Link>
                            </li>
                            <li>
                                <Link href={`/tenant/${slug}/account/tickets`}
                                    className="text-app-muted-foreground hover:text-white text-sm font-medium transition-colors flex items-center gap-2">
                                    <LifeBuoy size={14} /> Support
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest">
                        © {new Date().getFullYear()} {storeName} • Powered by {PLATFORM_CONFIG.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-app-muted-foreground font-medium">
                        <Shield size={12} /> Encrypted & Secured
                    </div>
                </div>
            </div>
        </footer>
    )
}
