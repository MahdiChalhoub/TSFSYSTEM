'use client'

import { useTheme } from '@/storefront/engine/ThemeProvider'

export default function CategoriesPageRoute() {
 const { components, loading } = useTheme()

 if (loading || !components) {
 return (
 <div className="min-h-screen bg-app-bg flex items-center justify-center">
 <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
 </div>
 )
 }

 const CategoriesPage = components.CategoriesPage
 if (!CategoriesPage) {
 return <div className="min-h-screen bg-app-bg text-app-text p-8">Categories not available for this theme</div>
 }
 return <CategoriesPage />
}
