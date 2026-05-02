'use client'

/**
 * Attributes Tab — every distinct attribute_value_name carried by any
 * product of this brand, with a count of how many products use it.
 * Source of truth is the product list; there's no brand↔attribute M2M
 * in the model — attributes live on the product, so we derive them.
 */

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Tag, Package } from 'lucide-react'
import { erpFetch } from '@/lib/erp-api'

interface AttrProduct { id: number; name: string }
interface AttrRow { value: string; products: AttrProduct[] }

export function AttributesTab({ brandId, brandName }: { brandId: number; brandName: string }) {
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<Array<Record<string, unknown>>>([])
    const [openAttr, setOpenAttr] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        erpFetch(`inventory/products/?brand=${brandId}&page_size=200`)
            .then((res: any) => {
                if (cancelled) return
                const items = Array.isArray(res) ? res : (res?.results ?? [])
                setProducts(items)
            })
            .catch(() => { if (!cancelled) setProducts([]) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [brandId])

    const rows = useMemo<AttrRow[]>(() => {
        const map = new Map<string, AttrProduct[]>()
        products.forEach(p => {
            const attrs = (p as any).attribute_value_names as string[] | undefined
            if (!attrs || attrs.length === 0) return
            attrs.forEach(v => {
                if (!map.has(v)) map.set(v, [])
                map.get(v)!.push({ id: (p as any).id, name: (p as any).name })
            })
        })
        return [...map.entries()]
            .map(([value, products]) => ({ value, products }))
            .sort((a, b) => a.value.localeCompare(b.value))
    }, [products])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={22} className="animate-spin" style={{ color: 'var(--app-success)' }} />
            </div>
        )
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <Tag size={32} className="text-app-muted-foreground mb-2 opacity-40" />
                <p className="text-tp-md font-semibold text-app-muted-foreground">No attributes</p>
                <p className="text-tp-sm text-app-muted-foreground mt-1">
                    {brandName}&apos;s products don&apos;t carry any attribute values yet.
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-200">
            <div className="flex-shrink-0 px-4 py-2.5"
                style={{ borderBottom: '1px solid var(--app-border)' }}>
                <p className="text-tp-sm font-medium text-app-muted-foreground">
                    {rows.length} distinct attribute value{rows.length !== 1 ? 's' : ''} across {products.length} product{products.length !== 1 ? 's' : ''}
                </p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="divide-y divide-app-border/30">
                    {rows.map(row => {
                        const isOpen = openAttr === row.value
                        return (
                            <div key={row.value}>
                                <button
                                    type="button"
                                    onClick={() => setOpenAttr(isOpen ? null : row.value)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-app-surface-hover text-left">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                            color: 'var(--app-success)'
                                        }}>
                                        <Tag size={13} />
                                    </div>
                                    <p className="flex-1 min-w-0 text-tp-md font-semibold text-app-foreground truncate">
                                        {row.value}
                                    </p>
                                    <span className="text-tp-xxs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-success) 12%, transparent)',
                                            color: 'var(--app-success)'
                                        }}>
                                        {row.products.length} product{row.products.length !== 1 ? 's' : ''}
                                    </span>
                                </button>
                                {isOpen && (
                                    <div className="bg-app-background/30">
                                        {row.products.map(p => (
                                            <a key={p.id} href={`/inventory/products/${p.id}`}
                                                className="flex items-center gap-3 px-4 py-2 pl-12 text-tp-sm hover:bg-app-surface-hover transition-colors">
                                                <Package size={11} className="text-app-muted-foreground flex-shrink-0" />
                                                <span className="flex-1 min-w-0 truncate text-app-muted-foreground">{p.name}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
