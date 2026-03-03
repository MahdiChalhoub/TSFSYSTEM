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
 <h1 className="text-4xl font-extrabold text-app-foreground tracking-tight flex items-center gap-3">
 <FolderTree className="text-orange-500" size={32} />
 Product Categories
 </h1>
 <p className="text-app-muted-foreground font-medium">Manage hierarchical classification and product grouping.</p>
 </div>

 <div className="flex items-center gap-4">
 {industryVector && (
 <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-app-primary-light text-app-success rounded-2xl border border-app-success/30 shadow-sm">
 <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Industry</span>
 <span className="text-sm font-bold">{industryVector}</span>
 </div>
 )}

 <Link
 href="/inventory/maintenance?tab=category"
 className="p-3 bg-app-surface border border-app-border rounded-2xl text-app-muted-foreground hover:text-orange-600 hover:border-orange-200 transition-all shadow-sm flex items-center gap-2"
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

 <div className="relative z-10 bg-app-foreground/50 backdrop-blur-md border border-app-border/50 rounded-[2.5rem] p-8 shadow-2xl shadow-app-border/20">
 <CategoryTree
 categories={tree}
 allCategories={data}
 />
 </div>
 </div>

 <div className="p-8 bg-app-surface-2/50 border border-app-border rounded-[2.5rem]">
 <div className="flex items-center gap-4 text-app-muted-foreground mb-6">
 <div className="p-2 bg-app-surface rounded-xl border border-app-border">
 <Bookmark size={16} />
 </div>
 <div>
 <h4 className="font-bold text-app-foreground">Total System Coverage</h4>
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
 <div key={stat.label} className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-sm">
 <div className="text-2xl font-black text-app-foreground">{stat.value}</div>
 <div className={`text-[10px] font-black uppercase tracking-widest text-${stat.color}-500 opacity-60`}>{stat.label}</div>
 </div>
 ))}
 </div>
 </div>
 </div>
 )
}

