'use client'

import { useState, useEffect } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { PackageSearch, Search, DollarSign, TrendingDown, TrendingUp, Calendar, Truck, ArrowRight } from 'lucide-react'

export default function SupplierPackagePricesPage() {
    const [prices, setPrices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const res = await erpFetch('/pos/supplier-package-prices/')
            setPrices(Array.isArray(res) ? res : res?.results || [])
        } catch { setPrices([]) }
        setLoading(false)
    }

    const fmtCurrency = (v: any) => v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

    const filtered = prices.filter(p =>
        !search || (p.supplier_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.packaging_name || '').toLowerCase().includes(search.toLowerCase())
    )

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding bg-app-bg">
            <div className="mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--app-warning), var(--app-primary))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                    <PackageSearch className="w-6 h-6 text-white" />
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Procurement</p>
                    <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                        Supplier <span style={{ color: 'var(--app-primary)' }}>Package Prices</span>
                    </h1>
                </div>
            </div>

            <div className="mb-4 flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input type="text" placeholder="Search by supplier, product, or packaging..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                </div>
                <span className="text-xs font-bold text-app-muted-foreground">{filtered.length} prices</span>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Supplier</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Product</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Package</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Unit Price</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Pack Price</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Min Qty</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Valid Until</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((p, i) => (
                            <tr key={p.id || i} style={{ borderBottom: '1px solid var(--app-border)' }} className="hover:bg-app-surface-hover transition-all">
                                <td className="px-4 py-3 font-medium text-app-foreground flex items-center gap-2">
                                    <Truck size={12} className="text-app-muted-foreground" />{p.supplier_name || p.supplier || '—'}
                                </td>
                                <td className="px-4 py-3 text-app-foreground">{p.product_name || p.product || '—'}</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ background: 'color-mix(in srgb, var(--app-info) 15%, transparent)', color: 'var(--app-info)' }}>{p.packaging_name || p.packaging_level || '—'}</span></td>
                                <td className="px-4 py-3 text-right font-mono text-xs text-app-foreground">{fmtCurrency(p.unit_price)}</td>
                                <td className="px-4 py-3 text-right font-mono text-xs font-bold text-app-foreground">{fmtCurrency(p.package_price || p.price)}</td>
                                <td className="px-4 py-3 text-xs text-app-muted-foreground">{p.min_quantity || p.moq || '—'}</td>
                                <td className="px-4 py-3 text-xs text-app-muted-foreground flex items-center gap-1">
                                    <Calendar size={10} />
                                    {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : 'No expiry'}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-app-muted-foreground">No supplier package prices found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
