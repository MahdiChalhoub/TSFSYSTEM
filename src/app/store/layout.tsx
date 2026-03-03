import type { Metadata } from 'next'
import { getClientUser, clientLogout, getStorefrontPublicConfig } from '@/app/actions/ecommerce/store-auth'
import Link from 'next/link'
import { ShoppingCart, User, Store, Heart, LogOut, LogIn } from 'lucide-react'
import './store.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Store' }

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
    const [user, config] = await Promise.all([
        getClientUser(),
        getStorefrontPublicConfig(),
    ])
    const storeName = config?.storefront_title ?? 'Online Store'
    const theme = config?.storefront_theme ?? 'midnight'

    return (
        <div className="store-shell" data-theme={theme}>
            {/* Header */}
            <header className="store-header">
                <div className="store-container store-header-inner">
                    {/* Brand */}
                    <Link href="/store" className="store-brand">
                        <Store size={22} />
                        <span>{storeName}</span>
                    </Link>

                    {/* Nav */}
                    <nav className="store-nav hidden md:flex">
                        <Link href="/store" className="store-nav-link">Home</Link>
                        <Link href="/store/catalog" className="store-nav-link">Shop</Link>
                        {user && <Link href="/store/wishlist" className="store-nav-link">Wishlist</Link>}
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        {user ? (
                            <>
                                <Link href="/store/wishlist" className="store-icon-btn" aria-label="Wishlist" id="store-wishlist-btn">
                                    <Heart size={18} />
                                </Link>
                                <Link href="/store/cart" className="store-icon-btn" aria-label="Cart" id="store-cart-btn">
                                    <ShoppingCart size={18} />
                                </Link>
                                <Link href="/store/account" className="store-icon-btn" aria-label="Account" id="store-account-btn" title={user.name || user.email}>
                                    <User size={18} />
                                </Link>
                                <form action={async () => { 'use server'; await clientLogout() }}>
                                    <button type="submit" className="store-icon-btn" aria-label="Sign out" id="store-logout-btn">
                                        <LogOut size={16} />
                                    </button>
                                </form>
                            </>
                        ) : (
                            <>
                                <Link href="/store/cart" className="store-icon-btn" aria-label="Cart" id="store-cart-btn">
                                    <ShoppingCart size={18} />
                                </Link>
                                <Link href="/store/login" className="store-btn store-btn-primary" id="store-login-btn" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                                    <LogIn size={15} /> Sign In
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="store-main">{children}</main>

            {/* Footer */}
            <footer className="store-footer">
                <div className="store-container store-footer-inner">
                    <p className="text-sm opacity-60">© {new Date().getFullYear()} {storeName}. All rights reserved.</p>
                    <div className="flex gap-4 text-sm opacity-60">
                        <Link href="/store/catalog">Shop</Link>
                        {user ? <Link href="/store/account">My Account</Link> : <Link href="/store/login">Sign In</Link>}
                        <Link href="/store/cart">Cart</Link>
                    </div>
                </div>
            </footer>
        </div>
    )
}
