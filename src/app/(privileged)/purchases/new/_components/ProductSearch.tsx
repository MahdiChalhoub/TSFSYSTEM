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
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                <input
                    ref={ref}
                    type="text"
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-transparent border-none outline-none transition-all"
                    style={{ color: 'var(--app-foreground)' }}
                    placeholder="Search product name, barcode, SKU..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 1 && setOpen(true)}
                />
                {open && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 max-h-64 mt-1 rounded-xl shadow-xl z-50 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                        }}>
                        {results.map(r => (
                            <button
                                key={r.id as React.Key}
                                type="button"
                                onClick={() => { callback(r); setQuery(''); setOpen(false) }}
                                className="w-full text-left p-3 border-b last:border-b-0 text-[12px] font-bold transition-all flex items-center gap-2"
                                style={{ color: 'var(--app-foreground)', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 5%, transparent)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    <Package size={12} />
                                </div>
                                <span className="flex-1 truncate">{r.name as React.ReactNode}</span>
                                <span className="font-mono text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>{r.sku as React.ReactNode}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )
    }
)
