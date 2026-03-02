'use client'

import { useTheme } from '@/storefront/engine/ThemeProvider'

export default function SearchPageRoute() {
 const { components, loading } = useTheme()

 if (loading || !components) {
 return (
 <div className="min-h-screen bg-slate-950 flex items-center justify-center">
 <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
 </div>
 )
 }

 const SearchPage = components.SearchPage
 if (!SearchPage) {
 return <div className="min-h-screen bg-slate-950 text-white p-8">Search not available for this theme</div>
 }
 return <SearchPage />
}
