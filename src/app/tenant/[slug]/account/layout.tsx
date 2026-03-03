'use client'

import { useParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { usePortal } from '@/context/PortalContext'
import {
 LayoutDashboard, ShoppingBag, Wallet, LifeBuoy, ArrowLeft,
 ChevronRight, LogOut, Store, Heart, Bell, User
} from 'lucide-react'

export default function AccountLayout({ children }: { children: React.ReactNode }) {
 const { slug } = useParams<{ slug: string }>()
 const pathname = usePathname()
 const { user, contact, logout } = usePortal()

 const navItems = [
 { href: `/tenant/${slug}/account`, icon: LayoutDashboard, label: 'Dashboard' },
 { href: `/tenant/${slug}/account/orders`, icon: ShoppingBag, label: 'Orders' },
 { href: `/tenant/${slug}/account/wishlist`, icon: Heart, label: 'Wishlist' },
 { href: `/tenant/${slug}/account/wallet`, icon: Wallet, label: 'Wallet & Loyalty' },
 { href: `/tenant/${slug}/account/notifications`, icon: Bell, label: 'Notifications' },
 { href: `/tenant/${slug}/account/tickets`, icon: LifeBuoy, label: 'Support' },
 { href: `/tenant/${slug}/account/profile`, icon: User, label: 'Profile' },
 ]

 const isActive = (href: string) => pathname === href

 return (
 <div className="min-h-screen bg-[#020617] flex flex-col lg:flex-row bg-app-bg">
 {/* Sidebar (desktop) / Top Nav (mobile) */}
 <aside className="lg:w-64 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] bg-app-bg/80 border-b lg:border-b-0 lg:border-r border-app-text/5 flex flex-col">
 {/* User card */}
 <div className="p-5 border-b border-app-text/5">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 bg-app-success-bg border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 text-sm font-black">
 {user?.name?.charAt(0).toUpperCase() || 'U'}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-app-text text-sm font-bold truncate">{user?.name || 'Client'}</p>
 <p className="text-[10px] text-app-text-muted truncate">{contact?.tier || 'Standard'} • {contact?.company || ''}</p>
 </div>
 </div>
 </div>

 {/* Nav */}
 <nav className="flex lg:flex-col gap-1 p-3 overflow-x-auto lg:overflow-visible flex-1">
 {navItems.map(item => (
 <Link key={item.href} href={item.href}
 className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap
 ${isActive(item.href)
 ? 'bg-app-success-bg text-emerald-400 border border-emerald-500/20'
 : 'text-app-text-faint hover:text-app-text hover:bg-app-text/5 border border-transparent'
 }`}>
 <item.icon size={18} />
 <span className="hidden lg:inline">{item.label}</span>
 <span className="lg:hidden text-xs">{item.label}</span>
 {isActive(item.href) && <ChevronRight size={14} className="ml-auto hidden lg:block" />}
 </Link>
 ))}
 </nav>

 {/* Footer */}
 <div className="hidden lg:block p-3 border-t border-app-text/5 space-y-2">
 <Link href={`/tenant/${slug}`}
 className="flex items-center gap-2 px-4 py-2.5 text-app-text-faint hover:text-app-text text-sm font-medium rounded-xl hover:bg-app-text/5 transition-all">
 <Store size={14} /> Back to Store
 </Link>
 <button onClick={logout}
 className="w-full flex items-center gap-2 px-4 py-2.5 text-app-error text-sm font-medium rounded-xl hover:bg-app-error-bg transition-all">
 <LogOut size={14} /> Sign Out
 </button>
 </div>
 </aside>

 {/* Content */}
 <main className="flex-1 min-w-0">
 {children}
 </main>
 </div>
 )
}
