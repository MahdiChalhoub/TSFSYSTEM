'use client'

import { ThemeProvider, useTheme } from '@/storefront/engine/ThemeProvider'
import { usePortal } from '@/context/PortalContext'
import { ReactNode } from 'react'

/**
 * ThemeLayout — wraps tenant pages with the active theme's Header + Footer.
 * Reads the org's selected theme from storefront config and passes it to ThemeProvider.
 */
export function ThemeLayout({ children }: { children: ReactNode }) {
 const { config } = usePortal()
 const themeId = (config as any)?.storefront_theme || undefined

 return (
 <ThemeProvider themeId={themeId}>
 <ThemeShell>{children}</ThemeShell>
 </ThemeProvider>
 )
}

function ThemeShell({ children }: { children: ReactNode }) {
 const { components, loading, config: themeConfig } = useTheme()
 const { config } = usePortal()

 // Even if theme components are loading, we can show a branded "Ghost Shell"
 // using the configuration we already hydrated from the server.
 if (loading || !components) {
 const brandColor = (config as any)?.branding_color || '#6366f1' // Default platform indigo
 const bgColor = (config as any)?.storefront_theme === 'midnight' ? '#020617' : '#ffffff'

 return (
 <div
 className="min-h-screen flex flex-col items-center justify-center transition-all duration-700 animate-pulse"
 style={{ background: bgColor }}
 >
 {/* Logo Ghost */}
 <div
 className="w-16 h-16 rounded-[1.5rem] mb-6 flex items-center justify-center shadow-2xl scale-110"
 style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
 >
 {(config as any)?.logo ? (
 <img src={(config as any).logo} alt="loading" className="w-10 h-10 object-contain brightness-0 invert opacity-40 blur-[1px]" />
 ) : (
 <div className="w-8 h-8 rounded-lg bg-app-text/20 blur-[2px]" />
 )}
 </div>

 {/* Loading Progress Bar - Branded */}
 <div className="w-48 h-1 bg-gray-200/10 rounded-full overflow-hidden relative border border-app-text/5">
 <div
 className="absolute inset-0 transition-all duration-[3s] ease-out animate-shimmer"
 style={{
 background: `linear-gradient(90deg, transparent, ${brandColor}, transparent)`,
 width: '70%',
 left: '-10%'
 }}
 />
 </div>

 <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] opacity-30 select-none" style={{ color: brandColor }}>
 Synchronizing Identity
 </p>
 </div>
 )
 }

 const Header = components.Header
 const Footer = components.Footer
 const CartDrawer = (components as any).CartDrawer

 return (
 <div className={`theme-blur-transition ${!loading && components ? 'theme-active' : ''}`}>
 <Header />
 <main className="min-h-screen">
 {children}
 </main>
 <Footer />
 {CartDrawer && <CartDrawer />}
 </div>
 )
}

