'use client'

import { useState, useEffect, useCallback } from 'react'
import { getProducts, getCategories, getBrands, deleteProduct } from '@/app/actions/inventory/product-actions'
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

function MarginBadge({ cost, price }: { cost: number; price: number }) {
    if (!price || !cost) return <span className="text-xs text-gray-400">—</span>
    const margin = ((price - cost) / price * 100)
    const color = margin >= 30 ? 'text-emerald-600 bg-emerald-50' : margin >= 15 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>{margin.toFixed(1)}%</span>
}
function HealthBadge({ margin }: { margin: number }) {
    if (margin >= 40) return <span className="text-xs font-semibold text-emerald-600">Excellent</span>
    if (margin >= 25) return <span className="text-xs font-semibold text-emerald-500">Good</span>
    if (margin >= 10) return <span className="text-xs font-semibold text-amber-500">Warning</span>
    return <span className="text-xs font-semibold text-red-500">Critical</span>
}
function ProdStatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        inactive: 'bg-gray-50 text-gray-500 border-gray-200',
        'low-stock': 'bg-amber-50 text-amber-700 border-amber-200',
        discontinued: 'bg-red-50 text-red-500 border-red-200',
    }
    const s = status?.toLowerCase() || 'active'
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[s] || colors.active}`}>{status || 'Active'}</span>
}

const ALL_COLUMNS: ColumnDef<any>[] = [
    { key: 'name', label: 'Product', alwaysVisible: true, sortable: true },
    { key: 'barcode', label: 'Barcode/SKU' },
    { key: 'category', label: 'Category' },
    { key: 'qty', label: 'Total Qty', align: 'right', sortable: true },
    { key: 'cost', label: 'Cost', align: 'right', sortable: true },
    { key: 'price', label: 'Selling Price', align: 'right', sortable: true },
    { key: 'margin', label: 'Margin %', align: 'center' },
    { key: 'health', label: 'Health', align: 'center' },
    { key: 'status', label: 'Status', align: 'center' },
]

export default function ProductInventoryPage() {
    const { fmt } = useCurrency()
    const router = useRouter()
    const settings = useListViewSettings('inventory_products', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 25,
        sortKey: 'name',
        sortDir: 'asc',
    })

    const [products, setProducts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [brands, setBrands] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [filterBrand, setFilterBrand] = useState('')

    const loadData = useCallback(async () => {
        try {
            const [p, c, b] = await Promise.all([getProducts(), getCategories(), getBrands()])
            setProducts(p); setCategories(c); setBrands(b)
        } catch { toast.error('Failed to load') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const columns: ColumnDef<any>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: any) => React.ReactNode> = {
            name: r => (<div><p className="font-medium text-gray-900 text-sm">{r.name}</p><p className="text-xs text-gray-400">{r.brand_name || r.brand?.name || ''}</p></div>),
            barcode: r => (<div><p className="font-mono text-sm">{r.barcode || '—'}</p><p className="text-xs text-gray-400 font-mono">{r.sku || r.code || ''}</p></div>),
            category: r => { const n = r.category_name || r.category?.name; return n ? <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">{n}</span> : <span className="text-gray-400">—</span> },
            qty: r => r.total_quantity || r.total_qty || 0,
            cost: r => fmt(r.cost_price || 0),
            price: r => fmt(r.selling_price || 0),
            margin: r => <MarginBadge cost={r.cost_price || 0} price={r.selling_price || 0} />,
            health: r => { const m = r.selling_price ? ((r.selling_price - (r.cost_price || 0)) / r.selling_price * 100) : 0; return <HealthBadge margin={m} /> },
            status: r => <ProdStatusBadge status={r.lifecycle_status || r.status || 'Active'} />,
        }
        return { ...c, render: renderers[c.key] }
    })

    const filtered = products.filter(p => {
        if (filterCategory && String(p.category_id || p.category?.id || p.category) !== filterCategory) return false
        if (filterStatus) { const s = (p.lifecycle_status || p.status || 'active').toLowerCase(); if (s !== filterStatus) return false }
        if (filterBrand && String(p.brand_id || p.brand?.id || p.brand) !== filterBrand) return false
        if (search) { const q = search.toLowerCase(); return p.name?.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q) }
        return true
    })

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete "${row.name}"?`)) return
        try { await deleteProduct(row.id); toast.success('Deleted'); loadData() } catch (e: any) { toast.error(e.message || 'Failed') }
    }

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <TypicalListView<any>
                title="Product Inventory"
                addLabel="Add Product"
                onAdd={() => router.push('/inventory/global')}
                onExport={() => toast.info('Export coming soon')}
                data={filtered}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={k => settings.setSort(k)}
                actions={{
                    onView: r => router.push(`/inventory/global?product=${r.id}`),
                    onEdit: r => router.push(`/inventory/global?product=${r.id}&edit=1`),
                    onDelete: handleDelete,
                }}
            >
                <TypicalFilter
                    search={{ placeholder: 'Search by name, SKU, barcode...', value: search, onChange: setSearch }}
                    filters={[
                        { key: 'category', label: 'All Category', type: 'select', options: categories.map(c => ({ value: String(c.id), label: c.name })) },
                        { key: 'status', label: 'All Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'low-stock', label: 'Low-stock' }] },
                    ]}
                    maxVisible={2}
                    moreFilters={[
                        { key: 'brand', label: 'Brand', type: 'select', options: brands.map(b => ({ value: String(b.id), label: b.name })) },
                    ]}
                    values={{ category: filterCategory, status: filterStatus, brand: filterBrand }}
                    onChange={(k, v) => { const s = v === '' ? '' : String(v); if (k === 'category') setFilterCategory(s); if (k === 'status') setFilterStatus(s); if (k === 'brand') setFilterBrand(s) }}
                    onReset={() => { setFilterCategory(''); setFilterStatus(''); setFilterBrand(''); setSearch('') }}
                />
            </TypicalListView>
        </div>
    )
}