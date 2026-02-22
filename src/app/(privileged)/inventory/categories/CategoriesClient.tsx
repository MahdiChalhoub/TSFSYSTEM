'use client'

import { useState } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { deleteCategory } from '@/app/actions/inventory/categories'
import { CategoryFormModal } from '@/components/admin/categories/CategoryFormModal'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Bookmark, Folder, Tag, Box, Search, Wrench } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProductList } from '@/components/inventory/ProductList'

export function CategoriesClient({ initialData, industryVector }: { initialData: any[], industryVector?: string }) {
    const [data, setData] = useState(initialData)
    const [loading, setLoading] = useState(false)
    const [formModal, setFormModal] = useState<{ open: boolean, category?: any }>({ open: false })

    const columns = [
        {
            key: 'name',
            label: 'Category Name',
            alwaysVisible: true,
            render: (row: any) => (
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${row.parent ? 'bg-gray-100 text-gray-500' : 'bg-orange-100 text-orange-600'}`}>
                        {row.parent ? <Folder size={16} /> : <Bookmark size={16} />}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">{row.name}</p>
                        {row.code && <p className="text-[10px] text-gray-400 font-mono uppercase">{row.code}</p>}
                    </div>
                </div>
            )
        },
        {
            key: 'parent_name',
            label: 'Parent',
            render: (row: any) => row.parent_name ? (
                <Badge variant="outline" className="font-medium bg-gray-50/50">
                    {row.parent_name}
                </Badge>
            ) : <span className="text-gray-300 text-xs italic">Master</span>
        },
        {
            key: 'product_count',
            label: 'Products',
            align: 'center' as const,
            render: (row: any) => (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold">
                    {row.product_count || 0}
                </Badge>
            )
        },
        {
            key: 'brand_count',
            label: 'Brands',
            align: 'center' as const,
            render: (row: any) => (
                <div className="flex items-center justify-center gap-1.5 text-blue-600 font-bold">
                    <Tag size={12} />
                    <span>{row.brand_count || 0}</span>
                </div>
            )
        }
    ]

    const handleDelete = async (row: any) => {
        if (confirm(`Are you sure you want to delete ${row.name}?`)) {
            try {
                await deleteCategory(row.id)
                setData(prev => prev.filter(c => c.id !== row.id))
                toast.success('Category deleted')
            } catch (err) {
                toast.error('Failed to delete category')
            }
        }
    }

    const renderCard = (row: any) => (
        <div
            className={`group p-6 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between ${!row.parent
                ? 'bg-white border-orange-100 shadow-sm hover:shadow-2xl hover:shadow-orange-900/5'
                : 'bg-gray-50 border-transparent hover:bg-white hover:border-gray-200'
                }`}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${!row.parent ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-400'
                    }`}>
                    {!row.parent ? <Bookmark size={24} /> : <Folder size={24} />}
                </div>
                {!row.parent && (
                    <Badge className="bg-orange-50 text-orange-600 border-orange-100 font-black uppercase tracking-widest text-[10px]">
                        Master
                    </Badge>
                )}
            </div>

            <div>
                <h4 className="text-xl font-extrabold text-gray-900 mb-1 group-hover:text-orange-600 transition-colors">
                    {row.name}
                </h4>
                {row.parent_name && (
                    <p className="text-xs text-gray-400 font-medium mb-3">
                        Sub-category of <span className="text-gray-600">{row.parent_name}</span>
                    </p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[10px] font-bold">
                        {row.product_count || 0} Products
                    </Badge>
                    <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-[10px] font-bold">
                        {row.brand_count || 0} Brands
                    </Badge>
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 rounded-lg hover:bg-amber-50 hover:text-amber-600"
                    onClick={() => setFormModal({ open: true, category: row })}
                >
                    <Search size={14} />
                </Button>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <TypicalListView
                title="Product Categories"
                data={data}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                onAdd={() => setFormModal({ open: true })}
                addLabel="ADD CATEGORY"
                renderCard={renderCard}
                renderExpanded={(row: any) => <ProductList categoryId={row.id} />}
                headerExtras={
                    <>
                        {industryVector && (
                            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                                <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Industry Vector</span>
                                <span className="text-sm font-bold">{industryVector}</span>
                            </div>
                        )}
                        <Link
                            href="/inventory/maintenance?tab=category"
                            className="text-xs font-bold text-gray-400 hover:text-emerald-600 transition-colors flex items-center gap-1.5 ml-2"
                        >
                            <Wrench size={14} />
                            <span>Maintenance</span>
                        </Link>
                    </>
                }
                actions={{
                    onEdit: (r) => setFormModal({ open: true, category: r }),
                    onDelete: handleDelete
                }}
            >
                <TypicalFilter
                    search={{
                        placeholder: "Search categories by name, code...",
                        value: "",
                        onChange: () => { }
                    }}
                />
            </TypicalListView>

            {formModal.open && (
                <CategoryFormModal
                    isOpen={true}
                    onClose={() => setFormModal({ open: false })}
                    category={formModal.category}
                    potentialParents={data}
                />
            )}
        </div>
    )
}
