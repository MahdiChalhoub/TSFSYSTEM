'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth, useCart, useConfig, useWishlist } from '../../engine'
import {
    ShoppingBag, Heart, User, Search, Menu, X,
    LogOut, Package, ChevronDown
} from 'lucide-react'

export default function BoutiqueHeader() {
    const { user, isAuthenticated, logout } = useAuth()
    const { cartCount } = useCart()
    const { wishlistCount } = useWishlist()
    const { orgName, slug } = useConfig()
    const [mobileOpen, setMobileOpen] = useState(false)
    const [userMenuOpen, setUserMenuOpen] = useState(false)

    const base = `/tenant/${slug}`

    return (
        <>
            <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
            <header className="bg-white border-b border-violet-100 sticky top-0 z-50">
                {/* Top bar */}
                <div className="bg-gradient-to-r from-violet-600 to-pink-500 text-white text-center text-xs py-1.5 tracking-widest font-medium uppercase"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    Free shipping on orders over $100 ✨
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <Link href={base} className="flex items-center gap-2 group">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-violet-200"
                                style={{ fontFamily: "'Playfair Display', serif" }}>
                                {orgName?.charAt(0) || 'B'}
                            </div>
                            <span className="text-xl font-semibold text-indigo-950 tracking-tight hidden sm:block"
                                style={{ fontFamily: "'Playfair Display', serif" }}>
                                {orgName || 'Boutique'}
                            </span>
                        </Link>

                        {/* Desktop nav */}
                        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-app-muted-foreground"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            <Link href={base} className="hover:text-violet-600 transition">Home</Link>
                            <Link href={`${base}/categories`} className="hover:text-violet-600 transition">Collections</Link>
                            <Link href={`${base}/search`} className="hover:text-violet-600 transition">Shop All</Link>
                        </nav>

                        {/* Actions */}
                        <div className="flex items-center gap-1 sm:gap-3">
                            <Link href={`${base}/search`}
                                className="p-2.5 rounded-xl text-app-muted-foreground hover:text-violet-600 hover:bg-violet-50 transition">
                                <Search size={20} />
                            </Link>

                            <Link href={`${base}/account/wishlist`}
                                className="p-2.5 rounded-xl text-app-muted-foreground hover:text-app-error hover:bg-app-error-soft transition relative">
                                <Heart size={20} />
                                {wishlistCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-app-error text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                        {wishlistCount}
                                    </span>
                                )}
                            </Link>

                            <Link href={`${base}/cart`}
                                className="p-2.5 rounded-xl text-app-muted-foreground hover:text-violet-600 hover:bg-violet-50 transition relative">
                                <ShoppingBag size={20} />
                                {cartCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-violet-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                        {cartCount}
                                    </span>
                                )}
                            </Link>

                            {isAuthenticated ? (
                                <div className="relative">
                                    <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                                        className="flex items-center gap-1.5 p-2 rounded-xl text-app-muted-foreground hover:text-violet-600 hover:bg-violet-50 transition text-sm font-medium"
                                        style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                        <User size={18} />
                                        <span className="hidden sm:inline max-w-[80px] truncate">{user?.name?.split(' ')[0]}</span>
                                        <ChevronDown size={14} />
                                    </button>
                                    {userMenuOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                            <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-violet-100 py-2 z-50"
                                                style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                                <Link href={`${base}/account`} onClick={() => setUserMenuOpen(false)}
                                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-app-muted-foreground hover:bg-violet-50 hover:text-violet-600">
                                                    <User size={15} /> My Account
                                                </Link>
                                                <Link href={`${base}/account/orders`} onClick={() => setUserMenuOpen(false)}
                                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-app-muted-foreground hover:bg-violet-50 hover:text-violet-600">
                                                    <Package size={15} /> Orders
                                                </Link>
                                                <hr className="my-1 border-violet-100" />
                                                <button onClick={() => { logout(); setUserMenuOpen(false) }}
                                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-app-error hover:bg-app-error-soft w-full text-left">
                                                    <LogOut size={15} /> Sign Out
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <Link href={`${base}/login`}
                                    className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition shadow-sm shadow-violet-200"
                                    style={{ fontFamily: "'DM Sans', sans-serif" }}>
                                    Sign In
                                </Link>
                            )}

                            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 text-app-muted-foreground">
                                <Menu size={22} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile drawer */}
                {mobileOpen && (
                    <div className="fixed inset-0 z-50 md:hidden">
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                        <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl p-6 flex flex-col"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}>
                            <button onClick={() => setMobileOpen(false)} className="self-end p-2 text-app-muted-foreground hover:text-app-muted-foreground">
                                <X size={20} />
                            </button>
                            <nav className="mt-6 flex flex-col gap-1">
                                {[
                                    { label: 'Home', href: base },
                                    { label: 'Collections', href: `${base}/categories` },
                                    { label: 'Shop All', href: `${base}/search` },
                                    { label: 'Cart', href: `${base}/cart` },
                                    { label: 'Wishlist', href: `${base}/account/wishlist` },
                                ].map(link => (
                                    <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
                                        className="px-4 py-3 rounded-xl text-app-muted-foreground hover:bg-violet-50 hover:text-violet-600 text-sm font-medium transition">
                                        {link.label}
                                    </Link>
                                ))}
                            </nav>
                            <div className="mt-auto pt-4 border-t border-violet-100">
                                {isAuthenticated ? (
                                    <button onClick={() => { logout(); setMobileOpen(false) }}
                                        className="w-full px-4 py-3 text-left text-sm text-app-error hover:bg-app-error-soft rounded-xl font-medium">
                                        Sign Out
                                    </button>
                                ) : (
                                    <Link href={`${base}/login`} onClick={() => setMobileOpen(false)}
                                        className="block w-full text-center px-4 py-3 bg-violet-600 text-white rounded-xl text-sm font-semibold">
                                        Sign In
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </header>
        </>
    )
}
