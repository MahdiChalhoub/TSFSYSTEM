'use client'

import { useState, useEffect, forwardRef } from 'react'
import { Search, Package } from 'lucide-react'
import { searchProductsSimple } from '@/app/actions/inventory/product-actions'

type Props = {
    callback: (p: Record<string, any>) => void
    siteId: number
}

export const ProductSearch = forwardRef<HTMLInputElement, Props>(
    function ProductSearch({ callback, siteId }, ref) {
        const [query, setQuery] = useState('')
        const [results, setResults] = useState<Record<string, any>[]>([])
        const [open, setOpen] = useState(false)

        useEffect(() => {
            const timer = setTimeout(async () => {
                if (query.length > 1) {
                    const res = await searchProductsSimple(query, siteId)
                    setResults(res)
                    setOpen(true)
                } else {
                    setResults([])
                    setOpen(false)
                }
            }, 300)
            return () => clearTimeout(timer)
        }, [query, siteId])

        return (
            <div className="flex-1 relative">
                <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-app-muted-foreground/60" />
                <input
                    ref={ref}
                    type="text"
                    className="w-full pl-6 pr-3 py-2 text-[12px] font-bold bg-transparent border-none outline-none placeholder:text-app-muted-foreground/40"
                    style={{ color: 'var(--app-foreground)' }}
                    placeholder="Search product name, barcode, SKU..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 1 && setOpen(true)}
                />

                {open && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 max-h-72 mt-2 rounded-xl shadow-2xl z-50 overflow-y-auto border border-app-border bg-app-surface animate-in fade-in zoom-in-95 duration-150">
                        {results.map(r => (
                            <button
                                key={r.id as React.Key}
                                type="button"
                                onClick={() => { callback(r); setQuery(''); setOpen(false) }}
                                className="w-full text-left p-3 border-b border-app-border/40 last:border-b-0 transition-all flex items-center gap-3 hover:bg-app-primary/[0.04]"
                            >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-app-primary/10 text-app-primary">
                                    <Package size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[11px] font-black text-app-foreground truncate">{r.name as React.ReactNode}</div>
                                    <div className="text-[9px] font-bold text-app-muted-foreground uppercase">{r.sku as React.ReactNode}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }
)
