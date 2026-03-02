'use client'

import { useTheme } from '@/storefront/engine/ThemeProvider'

export default function OrderDetailPageRoute() {
 const { components, loading } = useTheme()

 if (loading || !components) {
 return (
 <div className="min-h-screen bg-slate-950 flex items-center justify-center">
 <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
 </div>
 )
 }

 const OrderDetailPage = (components as any).OrderDetailPage
 if (!OrderDetailPage) return <div className="p-20 text-white text-center">Order detail component not implemented in this theme.</div>

 return <OrderDetailPage />
}
