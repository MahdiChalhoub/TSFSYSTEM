'use client'

import { useTheme } from '@/storefront/engine/ThemeProvider'

export default function AccountPageRoute() {
 const { components, loading } = useTheme()

 if (loading || !components) {
 return (
 <div className="min-h-screen bg-app-bg flex items-center justify-center">
 <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
 </div>
 )
 }

 const DashboardPage = (components as any).DashboardPage
 if (!DashboardPage) return <div className="p-20 text-app-text text-center">Dashboard component not implemented in this theme.</div>

 return <DashboardPage />
}
