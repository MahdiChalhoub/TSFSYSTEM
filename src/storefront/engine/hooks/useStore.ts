'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { UseStoreReturn, Product, Category } from '../types'

/**
 * useStore — Storefront Engine Hook
 * Provides products, categories, and search/filter functionality.
 */
export function useStore(): UseStoreReturn {
    const params = useParams<{ slug: string }>()
    const [products, setProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!params?.slug) return

        const fetchProducts = async () => {
            try {
                setLoading(true)
                const djangoUrl = process.env.NEXT_PUBLIC_DJANGO_URL || 'http://127.0.0.1:8000'
                // Use the public storefront API (no auth needed)
                const res = await fetch(`${djangoUrl}/api/products/public/?organization_slug=${params.slug}`)
                if (!res.ok) {
                    // Fallback to server action
                    const { getPublicProducts } = await import('@/app/tenant/[slug]/actions')
                    const data = await getPublicProducts(params.slug)
                    setProducts(Array.isArray(data) ? data : [])
                    return
                }
                const data = await res.json()
                const arr = Array.isArray(data) ? data : data.results || []
                setProducts(arr)
            } catch (err: any) {
                setError(err.message)
                setProducts([])
            } finally {
                setLoading(false)
            }
        }

        fetchProducts()
    }, [params?.slug])

    const categories = useMemo(() => {
        const catMap = new Map<string, Category>()
        products.forEach(p => {
            if (p.category_name && p.category_id) {
                if (!catMap.has(p.category_id)) {
                    catMap.set(p.category_id, {
                        id: p.category_id,
                        name: p.category_name,
                        product_count: 1,
                    })
                } else {
                    const cat = catMap.get(p.category_id)!
                    cat.product_count = (cat.product_count || 0) + 1
                }
            } else if (p.category_name) {
                const key = p.category_name
                if (!catMap.has(key)) {
                    catMap.set(key, {
                        id: key,
                        name: p.category_name,
                        product_count: 1,
                    })
                } else {
                    const cat = catMap.get(key)!
                    cat.product_count = (cat.product_count || 0) + 1
                }
            }
        })
        return Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name))
    }, [products])

    const searchProducts = useCallback((query: string): Product[] => {
        if (!query) return products
        const q = query.toLowerCase()
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.sku?.toLowerCase().includes(q) ||
            p.category_name?.toLowerCase().includes(q)
        )
    }, [products])

    const getProductsByCategory = useCallback((categoryId: string): Product[] => {
        return products.filter(p =>
            p.category_id === categoryId || p.category_name === categoryId
        )
    }, [products])

    return {
        products,
        categories,
        loading,
        error,
        searchProducts,
        getProductsByCategory,
    }
}
