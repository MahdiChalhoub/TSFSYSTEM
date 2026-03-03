// @ts-nocheck
'use client'

import { useState } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getBrandHierarchy } from '@/app/actions/inventory/brands'
import { BrandFormModal } from '@/components/admin/BrandFormModal'
import { Badge } from '@/components/ui/badge'
import { Globe, Award, Layers, Package, Edit2, ChevronDown, ChevronRight, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export function BrandsClient({ initialBrands, countries, categories }: { initialBrands: any[], countries: any[], categories: any[] }) {
 const settings = useListViewSettings('inv_brands', {
 columns: ['name', 'origins', 'product_count'],
 pageSize: 25,
 sortKey: 'name',
 sortDir: 'asc',
 })
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
 <div className="w-10 h-10 rounded-lg bg-app-background flex items-center justify-center text-sm font-bold text-app-muted-foreground uppercase border border-app-border overflow-hidden">
 {row.logo ? <img src={row.logo} className="w-full h-full object-cover" /> : row.name.substring(0, 2)}
 </div>
 <div>
 <p className="font-bold text-app-foreground">{row.name}</p>
 {row.short_name && <p className="text-[10px] text-app-muted-foreground font-medium">({row.short_name})</p>}
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
 <span key={c.id} className="text-[10px] bg-app-surface-2 text-app-muted-foreground px-1.5 py-0.5 rounded font-mono border border-app-border">
 {c.code}
 </span>
 )) || <span className="text-app-muted-foreground italic text-xs">Universal</span>}
 </div>
 )
 },
 {
 key: 'product_count',
 label: 'SKUs',
 align: 'center' as const,
 render: (row: any) => (
 <Badge variant="secondary" className="bg-app-info-bg text-app-info border-none font-bold">
 {row.product_count || 0}
 </Badge>
 )
 }
 ]

 const renderExpanded = (row: any) => <BrandHierarchy brandId={row.id} />

 const renderCard = (row: any) => (
 <div
 className="group p-6 rounded-[2.5rem] bg-app-surface border border-app-border shadow-sm hover:shadow-2xl hover:shadow-app-primary/20 transition-all relative overflow-hidden h-full flex flex-col justify-between cursor-pointer"
 onClick={() => { setEditingBrand(row); setIsFormOpen(true); }}
 >
 <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
 <Award size={80} />
 </div>

 <div className="flex justify-between items-start mb-6">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-background flex items-center justify-center text-2xl font-bold text-app-muted-foreground border border-app-border overflow-hidden shadow-inner">
 {row.logo ? <img src={row.logo} className="w-full h-full object-cover" /> : row.name.substring(0, 2)}
 </div>
 <div className="flex flex-col items-end gap-2">
 <Badge className="bg-app-primary-light text-app-success border-app-success/30 text-[10px] font-black uppercase tracking-widest">
 {row.countries?.[0]?.code || 'WW'} HUB
 </Badge>
 <div className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground">
 <Package size={12} />
 {row.product_count || 0} PRODUCTS
 </div>
 </div>
 </div>

 <div>
 <h4 className="text-2xl font-black text-app-foreground leading-tight group-hover:text-app-primary transition-colors">
 {row.name}
 </h4>
 <div className="flex items-center gap-2 mt-2">
 <div className="flex flex-wrap gap-1">
 {row.categories?.slice(0, 2).map((cat: any) => (
 <span key={cat.id} className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-lg border border-purple-100 font-bold">
 {cat.name}
 </span>
 ))}
 {row.categories?.length > 2 && <span className="text-[10px] text-app-muted-foreground font-bold">+{row.categories.length - 2} more</span>}
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
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 onAdd={() => { setEditingBrand(null); setIsFormOpen(true); }}
 addLabel="ADD BRAND"
 renderCard={renderCard}
 renderExpanded={renderExpanded}
 headerExtras={
 <Link
 href="/inventory/maintenance?tab=brand"
 className="text-xs font-bold text-app-muted-foreground hover:text-app-primary transition-colors flex items-center gap-1.5 ml-2"
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

 useEffect(() => {
 let mounted = true;
 getBrandHierarchy(brandId).then(res => {
 if (mounted) {
 setData(res)
 setLoading(false)
 }
 }).catch(() => {
 if (mounted) setLoading(false);
 });
 return () => { mounted = false; };
 }, [brandId])

 if (loading) return (
 <div className="p-12 text-center">
 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-app-primary inline-block"></div>
 </div>
 )

 const groups = data?.productGroups || [];
 const loose = data?.products || [];

 if (!data || (groups.length === 0 && loose.length === 0)) return (
 <div className="p-12 text-center text-app-muted-foreground italic font-medium">
 No product clusters found for this brand hub.
 </div>
 )

 return (
 <div className="p-8 space-y-8 bg-app-surface-2/50">
 {groups.map((group: any) => (
 <div key={group.id} className="bg-app-surface border border-app-border rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
 <div className="px-6 py-4 bg-app-surface-2/30 border-b border-app-border flex justify-between items-center">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-app-info-bg text-app-info rounded-xl border border-app-info/30 shadow-sm">
 <Layers size={18} />
 </div>
 <div>
 <h5 className="font-black text-app-foreground leading-tight">{group.name}</h5>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-widest">{group.products?.length || 0} Variants Available</p>
 </div>
 </div>
 <div className="text-right">
 <span className="block text-[10px] text-app-muted-foreground uppercase font-black tracking-widest mb-1">Total Hub Stock</span>
 <Badge className="bg-app-primary-light text-app-success border-app-success/30 font-mono font-black text-lg px-4 py-1 rounded-xl">
 {group.products?.reduce((acc: number, p: any) => acc + (p.stock || 0), 0) || 0}
 </Badge>
 </div>
 </div>
 <div className="divide-y divide-gray-50">
 {group.products?.map((p: any) => (
 <div key={p.id} className="px-6 py-4 flex justify-between items-center hover:bg-app-background transition-colors">
 <div className="flex items-center gap-4">
 <div className="w-8 h-8 rounded-lg bg-app-background flex items-center justify-center text-[10px] font-black text-app-muted-foreground border border-app-border">
 {p.country_name?.substring(0, 2) || 'WW'}
 </div>
 <div className="flex flex-col">
 <span className="font-bold text-app-foreground text-sm">{p.name} {p.size && `- ${p.size}${p.unit_name || ''}`}</span>
 <span className="text-[10px] text-app-muted-foreground font-mono tracking-tighter">SKU: {p.sku || 'PENDING'}</span>
 </div>
 </div>
 <div className="flex flex-col items-end">
 <span className={`text-lg font-black font-mono ${p.stock > 0 ? 'text-app-foreground' : 'text-rose-500'}`}>
 {p.stock}
 </span>
 {p.stock === 0 && <span className="text-[8px] font-black text-rose-400 uppercase tracking-widest">Out of Stock</span>}
 </div>
 </div>
 ))}
 </div>
 </div>
 ))}

 {loose.length > 0 && (
 <div className="bg-app-surface border border-dashed border-app-border rounded-[2rem] p-6">
 <div className="flex items-center gap-2 mb-4 px-2">
 <Package size={16} className="text-app-muted-foreground" />
 <span className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Ungrouped Assets</span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {loose.map((p: any) => (
 <div key={p.id} className="p-4 bg-app-background rounded-2xl border border-app-border flex justify-between items-center">
 <div className="flex flex-col">
 <span className="font-bold text-app-foreground text-xs">{p.name}</span>
 <span className="text-[10px] text-app-muted-foreground font-mono">{p.sku || 'NO-SKU'}</span>
 </div>
 <Badge className="bg-app-surface text-app-foreground border-app-border font-mono font-bold">
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
