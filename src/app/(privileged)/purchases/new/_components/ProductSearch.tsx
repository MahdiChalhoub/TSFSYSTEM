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
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <input
                    ref={ref}
                    type="text"
                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                    placeholder="Search product name, barcode, SKU... (Ctrl+K)"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 1 && setOpen(true)}
                />

                {open && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 max-h-64 mt-1 z-50 overflow-y-auto rounded-xl border border-app-border custom-scrollbar"
                        style={{
                            background: 'var(--app-surface)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                        }}>
                        {results.map(r => (
                            <button
                                key={r.id as React.Key}
                                type="button"
                                onClick={() => { callback(r); setQuery(''); setOpen(false) }}
                                className="w-full text-left flex items-center gap-3 px-3 py-2.5 border-b border-app-border/40 last:border-b-0 hover:bg-app-primary/5 transition-colors"
                            >
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    <Package size={13} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-bold text-app-foreground truncate">{r.name as React.ReactNode}</div>
                                    <div className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">{r.sku as React.ReactNode}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }
)
