'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import {
    ShoppingCart, Search, Menu, X, LogOut, Heart, Bell,
    LayoutDashboard, Store, FileQuestion, User
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../engine/hooks/useAuth'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'
import { useWishlist } from '../../engine/hooks/useWishlist'
import { usePortal } from '@/context/PortalContext'

export default function MidnightHeader() {
    const { slug } = useParams<{ slug: string }>()
    const pathname = usePathname()
    const { user, isAuthenticated, logout } = useAuth()
    const { cartCount } = useCart()
    const { orgName, orgLogo, storeMode, config } = useConfig()
    const { wishlistCount } = useWishlist()
    const { setCartOpen } = usePortal()
    const [menuOpen, setMenuOpen] = useState(false)

    const storeName = config?.storefront_title || orgName || ''

    // Don't show on the main storefront page
    const isMainPage = pathname === `/tenant/${slug}`
    if (isMainPage) return null

    return (
        <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
            <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link href={`/tenant/${slug}`}
                    className="flex items-center gap-3 text-white hover:text-emerald-400 transition-colors">
                    {orgLogo ? (
                        <img src={orgLogo} alt={storeName} className="w-9 h-9 rounded-xl object-cover border border-white/10" />
                    ) : (
                        <div className="w-9 h-9 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400">
                            <Store size={18} />
                        </div>
                    )}
                    <span className="font-black text-sm tracking-tight hidden sm:block">{storeName || slug}</span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-6">
                    <Link href={`/tenant/${slug}`} className="text-sm text-slate-400 hover:text-white font-medium transition-colors">Products</Link>
                    <Link href={`/tenant/${slug}/categories`} className="text-sm text-slate-400 hover:text-white font-medium transition-colors">Categories</Link>
                    {storeMode === 'CATALOG_QUOTE' && (
                        <Link href={`/tenant/${slug}/quote`} className="text-sm text-slate-400 hover:text-white font-medium transition-colors flex items-center gap-1.5">
                            <FileQuestion size={14} />Quote
                        </Link>
                    )}
                    {isAuthenticated && (
                        <Link href={`/tenant/${slug}/dashboard`} className="text-sm text-slate-400 hover:text-white font-medium transition-colors flex items-center gap-1.5">
                            <LayoutDashboard size={14} />Dashboard
                        </Link>
                    )}
                </nav>

                {/* Right Items */}
                <div className="flex items-center gap-2">
                    <Link href={`/tenant/${slug}/search`} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                        <Search size={20} />
                    </Link>
                    {isAuthenticated && (
                        <>
                            <Link href={`/tenant/${slug}/account/wishlist`} className="relative w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-colors">
                                <Heart size={20} />
                                {wishlistCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-[10px] font-black text-white rounded-full flex items-center justify-center px-1">{wishlistCount}</span>
                                )}
                            </Link>
                            <Link href={`/tenant/${slug}/account/notifications`} className="relative w-10 h-10 flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-colors">
                                <Bell size={20} />
                            </Link>
                        </>
                    )}
                    {storeMode !== 'CATALOG_QUOTE' && (
                        <button
                            onClick={() => setCartOpen(true)}
                            className="relative w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                        >
                            <ShoppingCart size={20} />
                            {cartCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-emerald-500 text-[10px] font-black text-white rounded-full flex items-center justify-center px-1">{cartCount}</span>
                            )}
                        </button>
                    )}
                    {isAuthenticated ? (
                        <Link href={`/tenant/${slug}/account`}
                            className="w-9 h-9 bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400 text-xs font-black hover:bg-emerald-500/30 transition-all">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </Link>
                    ) : (
                        <Link href={`/tenant/${slug}/register`}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-all">
                            Sign In
                        </Link>
                    )}
                    <button onClick={() => setMenuOpen(!menuOpen)}
                        className="md:hidden w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white">
                        {menuOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden border-t border-white/5 bg-slate-950/95 backdrop-blur-xl p-4 space-y-1">
                    <Link href={`/tenant/${slug}`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-white font-medium rounded-xl hover:bg-white/5 transition-all">Products</Link>
                    <Link href={`/tenant/${slug}/categories`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-white font-medium rounded-xl hover:bg-white/5 transition-all">Categories</Link>
                    <Link href={`/tenant/${slug}/search`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-white font-medium rounded-xl hover:bg-white/5 transition-all">Search</Link>
                    {storeMode !== 'CATALOG_QUOTE' && (
                        <button
                            onClick={() => { setCartOpen(true); setMenuOpen(false); }}
                            className="w-full text-left px-4 py-3 text-white font-medium rounded-xl hover:bg-white/5 transition-all flex items-center gap-3"
                        >
                            <ShoppingCart size={18} className="text-emerald-400" /> Cart {cartCount > 0 && `(${cartCount})`}
                        </button>
                    )}
                    {isAuthenticated && (
                        <>
                            <div className="border-t border-white/5 my-2" />
                            <Link href={`/tenant/${slug}/account`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-white font-medium rounded-xl hover:bg-white/5 transition-all">My Account</Link>
                            <Link href={`/tenant/${slug}/account/orders`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-white font-medium rounded-xl hover:bg-white/5 transition-all">Orders</Link>
                            <Link href={`/tenant/${slug}/account/wallet`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-white font-medium rounded-xl hover:bg-white/5 transition-all">Wallet & Loyalty</Link>
                            <div className="border-t border-white/5 my-2" />
                            <button onClick={() => { logout(); setMenuOpen(false) }}
                                className="w-full text-left px-4 py-3 text-red-400 font-medium rounded-xl hover:bg-red-500/10 transition-all flex items-center gap-2">
                                <LogOut size={16} /> Sign Out
                            </button>
                        </>
                    )}
                </div>
            )}
        </header>
    )
}
