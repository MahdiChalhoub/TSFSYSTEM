'use client'

import { useState, useEffect, useCallback } from 'react'
import { getProducts, getCategories, getBrands, deleteProduct } from '@/app/actions/inventory/product-actions'
import { getWarehouses } from '@/app/actions/inventory/valuation'
import { InventoryListView, type ColumnDef, type FilterOption } from '@/components/inventory/InventoryListView'
import { useCurrency } from '@/lib/utils/currency'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown, ChevronUp, Filter, RotateCcw } from 'lucide-react'

/* ─── Health Badge ──────────────────────────────────── */
function HealthBadge({ margin }: { margin: number }) {
    if (margin >= 40) return <span className="text-xs font-semibold text-emerald-600">Excellent</span>
    if (margin >= 25) return <span className="text-xs font-semibold text-emerald-500">Good</span>
    if (margin >= 10) return <span className="text-xs font-semibold text-amber-500">Warning</span>
    return <span className="text-xs font-semibold text-red-500">Critical</span>
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        inactive: 'bg-gray-50 text-gray-500 border-gray-200',
        'low-stock': 'bg-amber-50 text-amber-700 border-amber-200',
        discontinued: 'bg-red-50 text-red-500 border-red-200',
    }
    const s = status?.toLowerCase() || 'active'
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[s] || colors.active}`}>
            {status || 'Active'}
        </span>
    )
}

function MarginBadge({ cost, price }: { cost: number; price: number }) {
    if (!price || !cost) return <span className="text-xs text-gray-400">—</span>
    const margin = ((price - cost) / price * 100)
    const color = margin >= 30 ? 'text-emerald-600 bg-emerald-50' : margin >= 15 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50'
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${color}`}>{margin.toFixed(1)}%</span>
}

export default function ProductInventoryPage() {
    const { fmt } = useCurrency()
    const router = useRouter()
    const [products, setProducts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [brands, setBrands] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    /* Filters */
    const [search, setSearch] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterStatus, setFilterStatus] = useState('')
    const [showMoreFilters, setShowMoreFilters] = useState(false)
    const [filterBrand, setFilterBrand] = useState('')
    const [filterUnit, setFilterUnit] = useState('')

    const loadData = useCallback(async () => {
        try {
            const [prods, cats, brs, whs] = await Promise.all([
                getProducts(),
                getCategories(),
                getBrands(),
                getWarehouses(),
            ])
            setProducts(prods)
            setCategories(cats)
            setBrands(brs)
            setWarehouses(whs)
        } catch { toast.error('Failed to load data') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    /* ─── Columns ─────────────────────────────────── */
    const columns: ColumnDef<any>[] = [
        {
            key: 'name', label: 'Product',
            render: r => (
                <div>
                    <p className="font-medium text-gray-900 text-sm">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.brand_name || r.brand?.name || ''}</p>
                </div>
            )
        },
        {
            key: 'barcode', label: 'Barcode/SKU',
            render: r => (
                <div>
                    <p className="font-mono text-sm">{r.barcode || '—'}</p>
                    <p className="text-xs text-gray-400 font-mono">{r.sku || r.code || ''}</p>
                </div>
            )
        },
        {
            key: 'category', label: 'Category',
            render: r => {
                const name = r.category_name || r.category?.name
                return name
                    ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700">{name}</span>
                    : <span className="text-gray-400">—</span>
            }
        },
        { key: 'total_qty', label: 'Total Qty', align: 'right', render: r => r.total_quantity || r.total_qty || 0 },
        { key: 'cost_price', label: 'Cost', align: 'right', render: r => fmt(r.cost_price || 0) },
        { key: 'selling_price', label: 'Selling Price', align: 'right', render: r => fmt(r.selling_price || 0) },
        {
            key: 'margin', label: 'Margin %', align: 'center',
            render: r => <MarginBadge cost={r.cost_price || 0} price={r.selling_price || 0} />
        },
        {
            key: 'health', label: 'Health', align: 'center',
            render: r => {
                const margin = r.selling_price ? ((r.selling_price - (r.cost_price || 0)) / r.selling_price * 100) : 0
                return <HealthBadge margin={margin} />
            }
        },
        {
            key: 'status', label: 'Status', align: 'center',
            render: r => <StatusBadge status={r.lifecycle_status || r.status || 'Active'} />
        },
    ]

    /* ─── Filters ─────────────────────────────────── */
    const filters: FilterOption[] = [
        {
            key: 'category', label: 'All Category', value: filterCategory,
            options: categories.map(c => ({ value: String(c.id), label: c.name }))
        },
        {
            key: 'status', label: 'All Status', value: filterStatus,
            options: [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'low-stock', label: 'Low-stock' },
            ]
        },
    ]

    const handleFilterChange = (key: string, value: string) => {
        const v = value === '__all__' ? '' : value
        if (key === 'category') setFilterCategory(v)
        if (key === 'status') setFilterStatus(v)
        if (key === 'brand') setFilterBrand(v)
    }

    const filteredProducts = products.filter(p => {
        if (filterCategory && String(p.category_id || p.category?.id || p.category) !== filterCategory) return false
        if (filterStatus) {
            const s = (p.lifecycle_status || p.status || 'active').toLowerCase()
            if (s !== filterStatus) return false
        }
        if (filterBrand && String(p.brand_id || p.brand?.id || p.brand) !== filterBrand) return false
        if (search) {
            const q = search.toLowerCase()
            return (
                p.name?.toLowerCase().includes(q) ||
                p.barcode?.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.code?.toLowerCase().includes(q)
            )
        }
        return true
    })

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete "${row.name}"?`)) return
        try {
            await deleteProduct(row.id)
            toast.success('Product deleted')
            loadData()
        } catch (e: any) { toast.error(e.message || 'Failed to delete') }
    }

    return (
        <div className="p-6 animate-in fade-in duration-500">
            <InventoryListView<any>
                title="Product Inventory"
                addLabel="Add Product"
                onAdd={() => router.push('/inventory/global')}
                onExport={() => toast.info('Export coming soon')}
                data={filteredProducts}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                filters={filters}
                onFilterChange={handleFilterChange}
                searchPlaceholder="Search by name, SKU, or barcode..."
                searchValue={search}
                onSearchChange={setSearch}
                onView={r => router.push(`/inventory/global?product=${r.id}`)}
                onEdit={r => router.push(`/inventory/global?product=${r.id}&edit=1`)}
                onDelete={handleDelete}
            />

            {/* ─── More Filters Panel ─────────────────── */}
            <div className="mt-2">
                <button
                    onClick={() => setShowMoreFilters(!showMoreFilters)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                    <Filter className="h-3.5 w-3.5" />
                    {showMoreFilters ? 'Hide' : 'More'} Filters
                    {showMoreFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                {showMoreFilters && (
                    <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-white grid grid-cols-2 md:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-200">
                        <div>
                            <Label className="text-xs text-gray-500">Brand</Label>
                            <Select value={filterBrand} onValueChange={v => setFilterBrand(v === '__all__' ? '' : v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="All Brands" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">All Brands</SelectItem>
                                    {brands.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-end">
                            <button onClick={() => { setFilterCategory(''); setFilterStatus(''); setFilterBrand(''); setFilterUnit(''); setSearch('') }}
                                className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors h-8 px-3 border rounded">
                                <RotateCcw className="h-3 w-3" /> Reset Filter
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}