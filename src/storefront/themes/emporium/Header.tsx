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

export default function EmporiumHeader() {
    const { slug } = useParams<{ slug: string }>()
    const pathname = usePathname()
    const { user, isAuthenticated, logout } = useAuth()
    const { cartCount } = useCart()
    const { orgName, orgLogo, config } = useConfig()
    const { wishlistCount } = useWishlist()
    const [menuOpen, setMenuOpen] = useState(false)

    const storeName = config?.storefront_title || orgName || ''

    return (
        <header className="bg-white border-b border-slate-200">
            {/* Top Bar - Marketplace Identity */}
            <div className="bg-slate-50 border-b border-slate-200 py-1.5 px-4 lg:px-6 hidden md:block">
                <div className="max-w-7xl mx-auto flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400" /> Deliver to <span className="text-slate-900">Global</span></div>
                        <Link href="#" className="hover:text-amber-600 transition-colors">Sell on {storeName}</Link>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link href="#" className="flex items-center gap-1.5 hover:text-slate-900 transition-colors"><HelpCircle size={12} /> Support</Link>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors">USD <ChevronDown size={10} /></div>
                    </div>
                </div>
            </div>

            {/* Main Header */}
            <div className="max-w-7xl mx-auto px-4 lg:px-6 h-20 flex items-center gap-6 lg:gap-12">
                {/* Logo & Category Trigger */}
                <div className="flex items-center gap-6">
                    <Link href={`/tenant/${slug}`} className="flex items-center gap-3 shrink-0">
                        {orgLogo ? (
                            <img src={orgLogo} alt={storeName} className="w-10 h-10 rounded-xl object-cover border border-slate-100" />
                        ) : (
                            <div className="w-10 h-10 bg-yellow-400 border border-yellow-500 shadow-sm rounded-xl flex items-center justify-center text-slate-900">
                                <Store size={20} />
                            </div>
                        )}
                        <span className="font-black text-lg tracking-tighter text-slate-900 hidden lg:block italic lowercase">
                            {storeName.replace(/\s+/g, '') || slug}
                        </span>
                    </Link>
                </div>

                {/* Central Search - The "Amazon" Style Bar */}
                <div className="flex-1 hidden md:flex items-center relative">
                    <button className="h-12 px-4 bg-slate-100 border-y border-l border-slate-200 rounded-l-xl text-xs font-black text-slate-600 flex items-center gap-2 hover:bg-slate-200 transition-colors">
                        All <ChevronDown size={14} />
                    </button>
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            placeholder="What are you looking for today?"
                            className="w-full h-12 bg-slate-100 border-y border-slate-200 px-4 text-sm font-medium focus:outline-none"
                        />
                    </div>
                    <button className="h-12 w-16 bg-yellow-400 border border-yellow-500 rounded-r-xl flex items-center justify-center text-slate-900 hover:bg-yellow-500 transition-all shadow-lg shadow-yellow-200/50 active:scale-95">
                        <Search size={22} />
                    </button>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                    {isAuthenticated ? (
                        <Link href={`/tenant/${slug}/account`} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all group">
                            <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-yellow-400 group-hover:border-yellow-500 group-hover:text-slate-900 transition-all">
                                <User size={20} />
                            </div>
                            <div className="hidden lg:block text-left">
                                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1 tracking-widest">Hi, {user?.name?.split(' ')[0]}</p>
                                <p className="text-sm font-black text-slate-900 leading-none">Account</p>
                            </div>
                        </Link>
                    ) : (
                        <Link href={`/tenant/${slug}/register`} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-50 transition-all group">
                            <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-yellow-400 group-hover:border-yellow-500 group-hover:text-slate-900 transition-all">
                                <User size={20} />
                            </div>
                            <div className="hidden lg:block text-left">
                                <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1 tracking-widest">Guest</p>
                                <p className="text-sm font-black text-slate-900 leading-none">Sign In</p>
                            </div>
                        </Link>
                    )}

                    <div className="h-8 w-px bg-slate-200 hidden lg:block" />

                    <Link href={`/tenant/${slug}/cart`} className="relative w-12 h-12 flex items-center justify-center text-slate-900 hover:text-yellow-600 transition-all active:scale-90">
                        <ShoppingCart size={24} />
                        {cartCount > 0 && (
                            <span className="absolute top-1 right-1 min-w-[20px] h-[20px] bg-yellow-400 border-2 border-white text-[10px] font-black text-slate-900 rounded-full flex items-center justify-center shadow-sm">
                                {cartCount}
                            </span>
                        )}
                    </Link>

                    <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-12 h-12 flex items-center justify-center text-slate-900">
                        {menuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Sub Nav / Category Bar - Desktop Only */}
            <div className="max-w-7xl mx-auto px-6 hidden lg:flex items-center gap-8 py-3">
                <button className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wider hover:text-yellow-600 transition-colors">
                    <Menu size={16} /> Shop by Category
                </button>
                <nav className="flex items-center gap-6">
                    <Link href={`/tenant/${slug}`} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">New Releases</Link>
                    <Link href={`/tenant/${slug}/search`} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors text-orange-600">Flash Deals</Link>
                    <Link href={`/tenant/${slug}/categories`} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Global Brands</Link>
                    <Link href={`/tenant/${slug}/register`} className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">Gift Cards</Link>
                </nav>
            </div>

            {/* Mobile Menu */}
            {menuOpen && (
                <div className="md:hidden border-t border-slate-100 bg-white p-4 space-y-4 shadow-xl animate-in slide-in-from-top duration-300">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search Marketplace..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm font-medium"
                        />
                    </div>
                    <nav className="space-y-1">
                        <Link href={`/tenant/${slug}`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-slate-900 font-black text-sm rounded-xl hover:bg-slate-50">HOME</Link>
                        <Link href={`/tenant/${slug}/categories`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-slate-900 font-black text-sm rounded-xl hover:bg-slate-50">CATEGORIES</Link>
                        <Link href={`/tenant/${slug}/search`} onClick={() => setMenuOpen(false)} className="block px-4 py-3 text-slate-900 font-black text-sm rounded-xl hover:bg-slate-50 text-orange-600">FLASH DEALS</Link>
                    </nav>
                </div>
            )}
        </header>
    )
}
