'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
    LayoutDashboard, ShoppingCart, FileText, TrendingDown, Receipt,
    LogOut, ChevronRight, Menu, X, Building2, Bell, User
} from 'lucide-react'

interface SupplierSession {
    token: string
    user: { id: string; email: string; name: string }
    contact: { id: string; name: string; company: string; supplier_category: string }
    organization: { id: string; name: string; slug: string }
    permissions: string[]
}

function getSession(slug: string): SupplierSession | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = localStorage.getItem('supplier_session')
        if (!raw) return null
        const s = JSON.parse(raw) as SupplierSession
        if (s.organization.slug !== slug) return null
        return s
    } catch { return null }
}

export default function SupplierPortalLayout({ children }: { children: React.ReactNode }) {
    const { slug } = useParams<{ slug: string }>()
    const pathname = usePathname()
    const [session, setSession] = useState<SupplierSession | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
        setSession(getSession(slug))
        setHydrated(true)
    }, [slug])

    // If we're on the main login page, don't wrap with layout chrome
    const isLoginPage = pathname === `/supplier-portal/${slug}`

    if (!hydrated) return null

    // No session and not on login page → redirect to login
    if (!session && !isLoginPage) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
                <div className="text-center space-y-6">
                    <Building2 size={48} className="mx-auto text-app-muted-foreground" />
                    <h2 className="text-xl font-bold text-white">Session Expired</h2>
                    <p className="text-app-muted-foreground text-sm">Please log in to access the supplier portal</p>
                    <Link href={`/supplier-portal/${slug}`}
                        className="inline-block px-8 py-4 bg-app-accent text-white rounded-2xl font-bold hover:bg-app-accent transition-all">
                        Go to Login
                    </Link>
                </div>
            </div>
        )
    }

    // Login page renders without chrome
    if (isLoginPage) return <>{children}</>

    const handleLogout = () => {
        localStorage.removeItem('supplier_session')
        window.location.href = `/supplier-portal/${slug}`
    }

    const navItems = [
        { href: `/supplier-portal/${slug}`, icon: LayoutDashboard, label: 'Dashboard' },
        { href: `/supplier-portal/${slug}/orders`, icon: ShoppingCart, label: 'Purchase Orders' },
        { href: `/supplier-portal/${slug}/proformas`, icon: FileText, label: 'Proformas' },
        { href: `/supplier-portal/${slug}/price-requests`, icon: TrendingDown, label: 'Price Requests' },
        { href: `/supplier-portal/${slug}/statement`, icon: Receipt, label: 'Statement' },
        { href: `/supplier-portal/${slug}/notifications`, icon: Bell, label: 'Notifications' },
        { href: `/supplier-portal/${slug}/profile`, icon: User, label: 'Profile' },
    ]

    const isActive = (href: string) => pathname === href

    return (
        <div className="min-h-screen bg-app-bg flex">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:sticky top-0 left-0 h-screen w-72 bg-slate-950/80 backdrop-blur-3xl border-r border-white/5 flex flex-col z-50 transition-transform duration-300
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                {/* Brand */}
                <div className="p-6 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-app-accent/20 border border-app-accent/30 rounded-xl flex items-center justify-center text-app-accent">
                                <Building2 size={20} />
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">Supplier Portal</p>
                                <p className="text-[10px] text-app-muted-foreground font-medium">{session?.organization.name}</p>
                            </div>
                        </div>
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-app-muted-foreground hover:text-white">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map(item => (
                        <Link key={item.href} href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                                ${isActive(item.href)
                                    ? 'bg-app-accent/10 text-app-accent border border-app-accent/20'
                                    : 'text-app-faint hover:text-white hover:bg-app-surface/5 border border-transparent'
                                }`}>
                            <item.icon size={18} />
                            {item.label}
                            {isActive(item.href) && <ChevronRight size={14} className="ml-auto" />}
                        </Link>
                    ))}
                </nav>

                {/* User */}
                <div className="p-4 border-t border-white/5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-app-accent/20 rounded-lg flex items-center justify-center text-app-accent text-xs font-black">
                            {session?.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{session?.user.name}</p>
                            <p className="text-[10px] text-app-muted-foreground truncate">{session?.user.email}</p>
                        </div>
                    </div>
                    <button onClick={handleLogout}
                        className="w-full flex items-center gap-2 justify-center px-4 py-2.5 bg-app-surface/5 border border-white/10 rounded-xl text-app-error text-sm font-medium hover:bg-red-500/10 transition-all">
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 min-w-0">
                {/* Mobile Top Bar */}
                <div className="lg:hidden sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
                    <button onClick={() => setSidebarOpen(true)}
                        className="w-10 h-10 bg-app-surface/5 border border-white/10 rounded-xl flex items-center justify-center text-white">
                        <Menu size={18} />
                    </button>
                    <p className="text-white font-bold text-sm">Supplier Portal</p>
                    <div className="w-10" /> {/* Spacer */}
                </div>

                {/* Content */}
                <main>{children}</main>
            </div>
        </div>
    )
}
