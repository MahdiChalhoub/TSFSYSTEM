'use client'

import { useState, useMemo } from 'react'
import { Bookmark, FolderTree, Bookmark as BookmarkIcon, Wrench } from 'lucide-react'
import Link from 'next/link'
import { buildTree } from '@/lib/utils/tree'
import { CategoryTree } from '@/components/admin/categories/CategoryTree'
import { CreateCategoryButton } from '@/components/admin/categories/CreateCategoryButton'

export function CategoriesClient({ initialCategories, industryVector }: { initialCategories: any[], industryVector?: string }) {
    const [data] = useState(initialCategories)

    // Build tree structure
    const tree = useMemo(() => buildTree(data), [data])

    return (
        <div className="space-y-12">
            {/* Minimalist Premium Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        <FolderTree className="text-orange-500" size={32} />
                        Product Categories
                    </h1>
                    <p className="text-gray-400 font-medium">Manage hierarchical classification and product grouping.</p>
                </div>

                <div className="flex items-center gap-4">
                    {industryVector && (
                        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 shadow-sm">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Industry</span>
                            <span className="text-sm font-bold">{industryVector}</span>
                        </div>
                    )}

                    <Link
                        href="/inventory/maintenance?tab=category"
                        className="p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm flex items-center gap-2"
                        title="Advanced Reorganization"
                    >
                        <Wrench size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Clean Metadata</span>
                    </Link>

                    <CreateCategoryButton
                        potentialParents={data}
                    />
                </div>
            </div>

            {/* Tree View Structure */}
            <div className="relative">
                {/* Decorative background gradient */}
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-100/20 blur-[100px] pointer-events-none rounded-full" />

                <div className="relative z-10 bg-white/50 backdrop-blur-md border border-gray-100/50 rounded-[2.5rem] p-8 shadow-2xl shadow-gray-200/50">
                    <CategoryTree
                        categories={tree}
                        allCategories={data}
                    />
                </div>
            </div>

            <div className="p-8 bg-gray-50/50 border border-gray-100 rounded-[2.5rem]">
                <div className="flex items-center gap-4 text-gray-400 mb-6">
                    <div className="p-2 bg-white rounded-xl border border-gray-100">
                        <Bookmark size={16} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900">Total System Coverage</h4>
                        <p className="text-xs font-medium">{data.length} registered category nodes across the organization.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: 'Root Levels', value: tree.length, color: 'orange' },
                        { label: 'Leaf Nodes', value: data.filter(d => !data.some(c => c.parent === d.id)).length, color: 'emerald' },
                        { label: 'Avg Depth', value: '2.4', color: 'blue' },
                        { label: 'Complexity', value: data.length > 50 ? 'High' : 'Optimal', color: 'purple' }
                    ].map(stat => (
                        <div key={stat.label} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="text-2xl font-black text-gray-900">{stat.value}</div>
                            <div className={`text-[10px] font-black uppercase tracking-widest text-${stat.color}-500 opacity-60`}>{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

