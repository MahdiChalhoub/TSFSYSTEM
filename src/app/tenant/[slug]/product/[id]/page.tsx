'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTheme } from '@/storefront/engine/ThemeProvider'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ProductDetailRoute() {
 const { slug, id } = useParams<{ slug: string; id: string }>()
 const { components, loading: themeLoading } = useTheme()
 const [product, setProduct] = useState<any>(null)
 const [loading, setLoading] = useState(true)

 useEffect(() => {
 const isClient = typeof window !== 'undefined'
 const djangoUrl = isClient ? '' : (process.env.DJANGO_URL || 'http://backend:8000')
 fetch(`${djangoUrl}/api/products/storefront/${id}/?organization_slug=${slug}`)
 .then(r => r.ok ? r.json() : null)
 .then(data => { setProduct(data); setLoading(false) })
 .catch(() => setLoading(false))
 }, [slug, id])

 if (themeLoading || loading) {
 return (
 <div className="min-h-screen bg-slate-950 flex items-center justify-center">
 <Loader2 className="animate-spin text-emerald-500" size={40} />
 </div>
 )
 }

 if (!product) {
 return (
 <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
 <div className="text-center space-y-4">
 <AlertCircle size={48} className="mx-auto text-app-text-muted" />
 <h1 className="text-2xl font-bold text-app-text">Product Not Found</h1>
 <Link href={`/tenant/${slug}`}
 className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm font-medium">
 <ArrowLeft size={16} /> Back to Store
 </Link>
 </div>
 </div>
 )
 }

 if (!components) return null

 const ProductDetail = components.ProductDetail
 return <ProductDetail product={product} />
}
