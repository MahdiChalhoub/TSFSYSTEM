'use client'

import { useState } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getBrandHierarchy } from '@/app/actions/inventory/brands'
import { BrandFormModal } from '@/components/admin/BrandFormModal'
import { Badge } from '@/components/ui/badge'
import { Globe, Award, Layers, Package, Edit2, ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export function BrandsClient({ initialBrands, countries, categories }: { initialBrands: any[], countries: any[], categories: any[] }) {
    const [data, setData] = useState(initialBrands)
    const [loading, setLoading] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingBrand, setEditingBrand] = useState<any>(null)

    const columns = [
        {
            key: 'name',
            label: 'Brand',
            alwaysVisible: true,
            render: (row: any) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-600 uppercase border border-gray-100 overflow-hidden">
                        {row.logo ? <img src={row.logo} className="w-full h-full object-cover" /> : row.name.substring(0, 2)}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">{row.name}</p>
                        {row.short_name && <p className="text-[10px] text-gray-400 font-medium">({row.short_name})</p>}
                    </div>
                </div>
            )
        },
        {
            key: 'origins',
            label: 'Origins',
            render: (row: any) => (
                <div className="flex flex-wrap gap-1">
                    {row.countries?.map((c: any) => (
                        <span key={c.id} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono border border-gray-200">
                            {c.code}
                        </span>
                    )) || <span className="text-gray-300 italic text-xs">Universal</span>}
                </div>
            )
        },
        {
            key: 'product_count',
            label: 'SKUs',
            align: 'center' as const,
            render: (row: any) => (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none font-bold">
                    {row.product_count || 0}
                </Badge>
            )
        }
    ]

    const renderExpanded = (row: any) => <BrandHierarchy brandId={row.id} />

    const renderCard = (row: any) => (
        <div
            className="group p-6 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/5 transition-all relative overflow-hidden h-full flex flex-col justify-between cursor-pointer"
            onClick={() => { setEditingBrand(row); setIsFormOpen(true); }}
        >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Award size={80} />
            </div>

            <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 rounded-[1.5rem] bg-gray-50 flex items-center justify-center text-2xl font-bold text-gray-700 border border-gray-100 overflow-hidden shadow-inner">
                    {row.logo ? <img src={row.logo} className="w-full h-full object-cover" /> : row.name.substring(0, 2)}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-black uppercase tracking-widest">
                        {row.countries?.[0]?.code || 'WW'} HUB
                    </Badge>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                        <Package size={12} />
                        {row.product_count || 0} PRODUCTS
                    </div>
                </div>
            </div>

            <div>
                <h4 className="text-2xl font-black text-gray-900 leading-tight group-hover:text-emerald-600 transition-colors">
                    {row.name}
                </h4>
                <div className="flex items-center gap-2 mt-2">
                    <div className="flex flex-wrap gap-1">
                        {row.categories?.slice(0, 2).map((cat: any) => (
                            <span key={cat.id} className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg border border-purple-100 font-bold">
                                {cat.name}
                            </span>
                        ))}
                        {row.categories?.length > 2 && <span className="text-[10px] text-gray-400 font-bold">+{row.categories.length - 2} more</span>}
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <TypicalListView
                title="Brands"
                data={data}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                onAdd={() => { setEditingBrand(null); setIsFormOpen(true); }}
                addLabel="ADD BRAND"
                renderCard={renderCard}
                renderExpanded={renderExpanded}
                headerExtras={
                    <Link
                        href="/inventory/maintenance?tab=brand"
                        className="text-xs font-bold text-gray-400 hover:text-emerald-600 transition-colors flex items-center gap-1.5 ml-2"
                    >
                        <Wrench size={14} />
                        <span>Maintenance</span>
                    </Link>
                }
                actions={{
                    onEdit: (r) => { setEditingBrand(r); setIsFormOpen(true); }
                }}
            >
                <TypicalFilter
                    onFilter={() => { }}
                    searchPlaceholder="Search brands by name, code, origin..."
                />
            </TypicalListView>

            {isFormOpen && (
                <BrandFormModal
                    isOpen={true}
                    onClose={() => setIsFormOpen(false)}
                    brand={editingBrand}
                    countries={countries}
                    categories={categories}
                />
            )}
        </div>
    )
}

function BrandHierarchy({ brandId }: { brandId: number }) {
    const [data, setData] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)

    useState(() => {
        getBrandHierarchy(brandId).then(res => {
            setData(res)
            setLoading(false)
        })
    })

    if (loading) return (
        <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500 inline-block"></div>
        </div>
    )

    if (!data || (data.groups.length === 0 && data.looseProducts.length === 0)) return (
        <div className="p-12 text-center text-gray-400 italic font-medium">
            No product clusters found for this brand hub.
        </div>
    )

    return (
        <div className="p-8 space-y-8 bg-gray-50/50">
            {data.groups.map((group: any) => (
                <div key={group.id} className="bg-white border border-gray-100 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                    <div className="px-6 py-4 bg-gray-50/30 border-b border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
                                <Layers size={18} />
                            </div>
                            <div>
                                <h5 className="font-black text-gray-900 leading-tight">{group.name}</h5>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{group.products.length} Variants Available</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Total Hub Stock</span>
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-mono font-black text-lg px-4 py-1 rounded-xl">
                                {group.totalStock}
                            </Badge>
                        </div>
                    </div>
                    <div className="divide-y divide-gray-50">
                        {group.products.map((p: any) => (
                            <div key={p.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-[10px] font-black text-gray-400 border border-gray-100">
                                        {p.countryName?.substring(0, 2) || 'WW'}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-900 text-sm">{p.name} {p.size && `- ${p.size}${p.unitName}`}</span>
                                        <span className="text-[10px] text-gray-400 font-mono tracking-tighter">SKU: {p.sku || 'PENDING'}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className={`text-lg font-black font-mono ${p.stock > 0 ? 'text-gray-900' : 'text-rose-500'}`}>
                                        {p.stock}
                                    </span>
                                    {p.stock === 0 && <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Out of Stock</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {data.looseProducts.length > 0 && (
                <div className="bg-white border border-dashed border-gray-200 rounded-[2rem] p-6">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <Package size={16} className="text-gray-400" />
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Ungrouped Assets</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.looseProducts.map((p: any) => (
                            <div key={p.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="font-bold text-gray-800 text-xs">{p.name}</span>
                                    <span className="text-[10px] text-gray-400 font-mono">{p.sku || 'NO-SKU'}</span>
                                </div>
                                <Badge className="bg-white text-gray-900 border-gray-200 font-mono font-bold">
                                    {p.stock}
                                </Badge>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
