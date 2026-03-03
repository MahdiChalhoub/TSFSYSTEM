'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import {
    ShoppingCart,
    Search,
    Menu,
    X,
    LogOut,
    Heart,
    Bell,
    Store,
    User,
    ChevronDown,
    MapPin,
    HelpCircle
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../engine/hooks/useAuth'
import { useCart } from '../../engine/hooks/useCart'
import { useConfig } from '../../engine/hooks/useConfig'
import { useWishlist } from '../../engine/hooks/useWishlist'
import { usePortal } from '@/context/PortalContext'

export default function EmporiumHeader() {
    const { slug } = useParams<{ slug: string }>()
    const pathname = usePathname()
    const { user, isAuthenticated, logout } = useAuth()
    const { cartCount } = useCart()
    const { orgName, orgLogo, config } = useConfig()
    const { wishlistCount } = useWishlist()
    const { setCartOpen } = usePortal()
    const [menuOpen, setMenuOpen] = useState(false)

    const storeName = config?.storefront_title || orgName || ''

    return (
        <header className="bg-app-surface border-b border-app-border">
            {/* Top Bar - Marketplace Identity */}
            <div className="bg-app-bg border-b border-app-border py-1.5 px-4 lg:px-6 hidden md:block">
                <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] font-bold text-app-text-faint uppercase tracking-widest">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5"><MapPin size={12} className="text-app-text-faint" /> Deliver to <span className="text-app-text">Global</span></div>
                        <Link href="#" className="hover:text-amber-600 transition-colors">Sell on {storeName}</Link>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link href="#" className="flex items-center gap-1.5 hover:text-app-text transition-colors"><HelpCircle size={12} /> Support</Link>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-app-text transition-colors">USD <ChevronDown size={10} /></div>
                    </div>
                </div>
            </div>

            {/* Main Header */}
            <div className="max-w-7xl mx-auto px-4 lg:px-6 h-20 flex items-center gap-6 lg:gap-12">
                {/* Logo & Category Trigger */}
                <div className="flex items-center gap-6">
                    <Link href={`/tenant/${slug}`} className="flex items-center gap-3 shrink-0">
                        {orgLogo ? (
                            <img src={orgLogo} alt={storeName} className="w-10 h-10 rounded-xl object-cover border border-app-border" />
                        ) : (
                            <div className="w-10 h-10 bg-yellow-400 border border-yellow-500 shadow-sm rounded-xl flex items-center justify-center text-app-text">
                                <Store size={20} />
                            </div>
                        )}
                        <span className="font-black text-lg tracking-tighter text-app-text hidden lg:block italic lowercase">
                            {storeName.replace(/\s+/g, '') || slug}
                        </span>
                    </Link>
                </div>

                {/* Central Search - The "Amazon" Style Bar */}
                <div className="flex-1 hidden md:flex items-center relative">
                    <button className="h-12 px-4 bg-app-surface-2 border-y border-l border-app-border rounded-l-xl text-xs font-black text-app-text-muted flex items-center gap-2 hover:bg-app-border transition-colors">
                        All <ChevronDown size={14} />
                    </button>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="What are you looking for today?"
                            className="w-full h-12 bg-app-surface-2 border-y border-app-border px-4 text-sm font-medium focus:outline-none"
                        />
                    </div>
                    <button className="h-12 w-16 bg-yellow-400 border border-yellow-500 rounded-r-xl flex items-center justify-center text-app-text hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-200/50 active:scale-95">
                        <Search size={22} />
                    </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                    {isAuthenticated ? (
                        <Link href={`/tenant/${slug}/account`} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-app-bg transition-all group">
                            <div className="w-10 h-10 bg-app-surface-2 border border-app-border rounded-full flex items-center justify-center text-app-text-faint group-hover:bg-yellow-400 group-hover:border-yellow-500 group-hover:text-app-text transition-all">
                                <User size={20} />
                            </div>
                            <div className="hidden lg:block text-left">
                                <p className="text-[10px] font-black text-app-text-faint uppercase leading-none mb-1 tracking-widest">Hi, {user?.name?.split(' ')[0]}</p>
                                <p className="text-sm font-black text-app-text leading-none">Account</p>
                            </div>
                        </Link>
                    ) : (
                        <Link href={`/tenant/${slug}/register`} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-app-bg transition-all group">
                            <div className="w-10 h-10 bg-app-surface-2 border border-app-border rounded-full flex items-center justify-center text-app-text-faint group-hover:bg-yellow-400 group-hover:border-yellow-500 group-hover:text-app-text transition-all">
                                <User size={20} />
                            </div>
                            <div className="hidden lg:block text-left">
                                <p className="text-[10px] font-black text-app-text-faint uppercase leading-none mb-1 tracking-widest">Guest</p>
                                <p className="text-sm font-black text-app-text leading-none">Sign In</p>
                            </div>
                        </Link>
                    )}

                    <div className="h-8 w-px bg-app-border hidden lg:block" />

                    <button
                        onClick={() => setCartOpen(true)}
                        className="relative w-12 h-12 flex items-center justify-center text-app-text hover:text-yellow-600 transition-all active:scale-90"
                    >
                        <ShoppingCart size={24} />
                        {cartCount > 0 && (
                            <span className="absolute top-1 right-1 min-w-[20px] h-[20px] bg-yellow-400 border-2 border-white text-[10px] font-black text-app-text rounded-full flex items-center justify-center shadow-sm">
                                {cartCount}
                            </span>
                        )}
                    </button>

                    <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-12 h-12 flex items-center justify-center text-app-text">
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Sub Nav / Category Bar - Desktop Only */}
            <div className="max-w-7xl mx-auto px-6 hidden lg:flex items-center gap-8 py-3">
                <button className="flex items-center gap-2 text-sm font-black text-app-text uppercase tracking-wider hover:text-yellow-600 transition-colors">
                    <Menu size={16} /> Shop by Category
                </button>
                <nav className="flex items-center gap-6">
                    <Link href={`/tenant/${slug}`} className="text-sm font-bold text-app-text-faint hover:text-app-text transition-colors">New Releases</Link>
                    <Link href={`/tenant/${slug}/search`} className="text-sm font-bold text-app-text-faint hover:text-app-text transition-colors text-orange-600">Flash Deals</Link>
                    <Link href={`/tenant/${slug}/categories`} className="text-sm font-bold text-app-text-faint hover:text-app-text transition-colors">Global Brands</Link>
                    <Link href={`/tenant/${slug}/register`} className="text-sm font-bold text-app-text-faint hover:text-app-text transition-colors">Gift Cards</Link>
                </nav>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden border-t border-app-border bg-app-surface p-4 space-y-4 shadow-xl animate-in slide-in-from-top duration-300">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-text-faint" size={18} />
                        <input
                            type="text"
                            placeholder="Search Marketplace..."
                            className="w-full bg-app-bg border border-app-border rounded-xl py-3 pl-12 pr-4 text-sm font-medium"
                        />
                    </div>
                    <nav className="space-y-1">
                        <Link href={`/tenant/${slug}`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-app-text font-black text-sm rounded-xl hover:bg-app-bg">HOME</Link>
                        <Link href={`/tenant/${slug}/categories`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-app-text font-black text-sm rounded-xl hover:bg-app-bg">CATEGORIES</Link>
                        <Link href={`/tenant/${slug}/search`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-app-text font-black text-sm rounded-xl hover:bg-app-bg text-orange-600">FLASH DEALS</Link>
                    </nav>
                </div>
            )}
        </header>
    )
}
