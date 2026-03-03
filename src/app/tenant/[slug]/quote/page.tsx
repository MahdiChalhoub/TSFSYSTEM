'use client'

import { useTheme } from '@/storefront/engine/ThemeProvider'

export default function QuotePageRoute() {
 const { components, loading } = useTheme()

 if (loading || !components) {
 return (
 <div className="min-h-screen bg-app-bg flex items-center justify-center">
 <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
 </div>
 )
 }

 const QuotePage = (components as any).QuotePage
 if (!QuotePage) return <div className="p-20 text-app-text text-center">Quote component not implemented in this theme.</div>

 return <QuotePage />
}
