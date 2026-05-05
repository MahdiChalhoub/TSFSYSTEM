'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTheme } from '@/storefront/engine'
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ProductDetailRoute() {
    const { slug, id } = useParams<{ slug: string; id: string }>()
    const { components, loading: themeLoading } = useTheme()
    const [product, setProduct] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
        fetch(`${djangoUrl}/api/products/storefront/${id}/?organization_slug=${slug}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { setProduct(data); setLoading(false) })
            .catch(() => setLoading(false))
    }, [slug, id])

    if (themeLoading || loading) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center">
                <Loader2 className="animate-spin text-app-success" size={40} />
            </div>
        )
    }

    if (!product) {
        return (
            <div className="min-h-screen bg-app-bg flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <AlertCircle size={48} className="mx-auto text-app-faint" />
                    <h1 className="text-white">Product Not Found</h1>
                    <Link href={`/tenant/${slug}`}
                        className="inline-flex items-center gap-2 text-app-success hover:text-app-success text-sm font-medium">
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
