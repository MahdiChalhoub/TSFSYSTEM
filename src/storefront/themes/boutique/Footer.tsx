'use client'

import Link from 'next/link'
import { useConfig } from '../../engine'
import { Heart } from 'lucide-react'

export default function BoutiqueFooter() {
    const { orgName, slug } = useConfig()
    const base = `/tenant/${slug}`

    return (
        <footer className="bg-indigo-950 text-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
                    {/* Brand */}
                    <div className="md:col-span-1">
                        <h3 className="text-2xl font-bold tracking-tight mb-3"
                            style={{ fontFamily: "'Playfair Display', serif" }}>
                            {orgName || 'Boutique'}
                        </h3>
                        <p className="text-indigo-300 text-sm leading-relaxed">
                            Curated collections crafted with care. Every piece tells a story.
                        </p>
                    </div>

                    {/* Shop */}
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-4">Shop</div>
                        <nav className="flex flex-col gap-2.5">
                            <Link href={base} className="text-sm text-indigo-300 hover:text-white transition">Home</Link>
                            <Link href={`${base}/categories`} className="text-sm text-indigo-300 hover:text-white transition">Collections</Link>
                            <Link href={`${base}/search`} className="text-sm text-indigo-300 hover:text-white transition">Shop All</Link>
                        </nav>
                    </div>

                    {/* Account */}
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-4">Account</div>
                        <nav className="flex flex-col gap-2.5">
                            <Link href={`${base}/account`} className="text-sm text-indigo-300 hover:text-white transition">My Account</Link>
                            <Link href={`${base}/account/orders`} className="text-sm text-indigo-300 hover:text-white transition">Orders</Link>
                            <Link href={`${base}/account/wishlist`} className="text-sm text-indigo-300 hover:text-white transition">Wishlist</Link>
                        </nav>
                    </div>

                    {/* Support */}
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-4">Support</div>
                        <nav className="flex flex-col gap-2.5">
                            <Link href={`${base}/account/tickets`} className="text-sm text-indigo-300 hover:text-white transition">Contact Us</Link>
                            <Link href={`${base}/account/wallet`} className="text-sm text-indigo-300 hover:text-white transition">Wallet & Loyalty</Link>
                        </nav>
                    </div>
                </div>

                <div className="mt-14 pt-6 border-t border-indigo-800/50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-indigo-400">
                        © {new Date().getFullYear()} {orgName}. All rights reserved.
                    </p>
                    <p className="text-xs text-app-info flex items-center gap-1">
                        Made with <Heart size={10} className="text-pink-400 fill-pink-400" /> by TSF Platform
                    </p>
                </div>
            </div>
        </footer>
    )
}
