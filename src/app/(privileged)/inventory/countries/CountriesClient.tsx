// @ts-nocheck
'use client'

import { useState } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getCountryHierarchy, createCountry, updateCountry } from '@/app/actions/inventory/countries'
import { CountryFormModal } from '@/components/admin/CountryManager'
import { Badge } from '@/components/ui/badge'
import { Package, Factory, Globe } from 'lucide-react'
import { toast } from 'sonner'

export function CountriesClient({ initialCountries, categories }: { initialCountries: any[], categories: any[] }) {
 const settings = useListViewSettings('inv_countries', {
 columns: ['code', 'name', 'product_count'],
 pageSize: 25,
 sortKey: 'name',
 sortDir: 'asc',
 })
 const [data, setData] = useState(initialCountries)
 const [loading, setLoading] = useState(false)
 const [editingCountry, setEditingCountry] = useState<any>(null)
 const [isFormOpen, setIsFormOpen] = useState(false)

 const columns = [
 {
 key: 'code',
 label: 'ISO',
 render: (row: any) => (
 <div className="w-10 h-10 rounded-lg bg-app-primary/5 flex items-center justify-center text-sm font-bold text-app-primary border border-app-primary/30 uppercase">
 {row.code}
 </div>
 )
 },
 {
 key: 'name',
 label: 'Country Name',
 alwaysVisible: true,
 render: (row: any) => (
 <div>
 <p className="font-bold text-app-foreground">{row.name}</p>
 <p className="text-[10px] text-app-muted-foreground font-medium">Origin Node</p>
 </div>
 )
 },
 {
 key: 'product_count',
 label: 'Products',
 align: 'center' as const,
 render: (row: any) => (
 <Badge variant="secondary" className="bg-app-surface-2 text-app-muted-foreground border-none font-bold">
 {row.product_count}
 </Badge>
 )
 }
 ]

 const renderExpanded = (row: any) => <CountryHierarchy countryId={row.id} />

 const renderCard = (row: any) => (
 <div
 className="group p-6 rounded-[2.5rem] bg-app-surface border border-app-border shadow-sm hover:shadow-2xl hover:shadow-indigo-900/5 transition-all relative overflow-hidden h-full flex flex-col justify-between cursor-pointer"
 onClick={() => { setEditingCountry(row); setIsFormOpen(true); }}
 >
 <div className="flex justify-between items-start mb-4">
 <div className="w-12 h-12 rounded-2xl bg-app-primary/5 flex items-center justify-center text-xl font-bold text-app-primary uppercase border border-app-primary/30">
 {row.code}
 </div>
 <Badge className="bg-app-primary/5 text-app-primary border-app-primary/30 text-[10px] font-bold">
 {row.product_count} PRODUCTS
 </Badge>
 </div>

 <div>
 <h4 className="text-xl font-extrabold text-app-foreground group-hover:text-app-primary transition-colors">
 {row.name}
 </h4>
 <div className="flex items-center gap-2 mt-2 text-app-muted-foreground">
 <Globe size={14} />
 <span className="text-xs font-medium">Manufacturing Hub</span>
 </div>
 </div>
 </div>
 )

 return (
 <div className="space-y-6">
 <TypicalListView
 title="Countries"
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
 onAdd={() => { setEditingCountry(null); setIsFormOpen(true); }}
 addLabel="ADD COUNTRY"
 renderCard={renderCard}
 renderExpanded={renderExpanded}
 actions={{
 onEdit: (r) => { setEditingCountry(r); setIsFormOpen(true); }
 }}
 >
 <TypicalFilter
 onFilter={() => { }}
 searchPlaceholder="Search countries by name or ISO code..."
 />
 </TypicalListView>

 {isFormOpen && (
 <ManualCountryFormWrapper
 country={editingCountry}
 onClose={() => setIsFormOpen(false)}
 />
 )}
 </div>
 )
}

function CountryHierarchy({ countryId }: { countryId: number }) {
 const [data, setData] = useState<any[] | null>(null)
 const [loading, setLoading] = useState(true)

 useState(() => {
 getCountryHierarchy(countryId).then(res => {
 setData(res)
 setLoading(false)
 })
 })

 if (loading) return (
 <div className="p-8 text-center">
 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-primary inline-block"></div>
 </div>
 )

 if (!data || data.length === 0) return (
 <div className="p-8 text-center text-app-muted-foreground italic text-sm">
 No active inventory linked to this country hub.
 </div>
 )

 return (
 <div className="p-6 space-y-6 bg-app-surface-2/50">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {data.map(brand => (
 <div key={brand.id} className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
 <div className="px-4 py-3 bg-app-surface-2/50 border-b border-app-border flex justify-between items-center">
 <div className="flex items-center gap-2">
 <Factory size={16} className="text-app-primary" />
 <span className="font-bold text-app-foreground">{brand.name}</span>
 </div>
 <span className="text-[10px] font-black uppercase tracking-widest text-app-primary bg-app-primary-light px-2 py-1 rounded-lg">
 Stock: {brand.totalStock}
 </span>
 </div>
 <div className="divide-y divide-gray-50">
 {brand.products.map((p: any) => (
 <div key={p.id} className="px-4 py-3 flex justify-between items-center text-sm hover:bg-app-background transition-colors">
 <div className="flex flex-col">
 <span className="font-semibold text-app-muted-foreground">{p.name} {p.size && `- ${p.size}${p.unit?.name || ''}`}</span>
 <span className="text-[10px] text-app-muted-foreground font-mono">{p.sku || 'NO-SKU'}</span>
 </div>
 <Badge variant="outline" className={`font-mono font-bold ${p.stock > 0 ? 'text-app-primary border-app-primary/30' : 'text-rose-500 border-rose-100'}`}>
 {p.stock}
 </Badge>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 )
}

// Temporary wrapper because CountryFormModal in CountryManager is exported differently or needs specific props
function ManualCountryFormWrapper({ country, onClose }: { country?: any, onClose: () => void }) {
 // We'll use the existing CountryFormModal but we might need to recreate it if it's too tied to the old manager.
 // For now, let's keep it simple.
 // I will actually just use a simplified version here or import it correctly.
 // The previous CountryManager.tsx had CountryFormModal inside it but not exported.
 // I'll need to extract it or create a new one.
 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-app-background/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
 <div className="bg-app-surface rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="px-8 py-6 border-b border-app-border">
 <h3 className="text-2xl font-bold text-app-foreground">
 {country ? 'Modify Hub' : 'Register Country'}
 </h3>
 <p className="text-app-muted-foreground text-sm font-medium">Manufacturing & Origin Details</p>
 </div>

 <form
 action={async (formData) => {
 const name = formData.get('name') as string
 const code = formData.get('code') as string
 try {
 if (country) await updateCountry(country.id, { name, code })
 else await createCountry({ name, code })
 toast.success('Successfully saved hub details')
 onClose()
 } catch (err) {
 toast.error('Failed to save hub')
 }
 }}
 className="p-8 space-y-5"
 >
 <div className="space-y-1.5">
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest ml-1">Official Name</label>
 <input name="name" defaultValue={country?.name} className="w-full h-12 px-4 rounded-xl border border-app-border bg-app-surface-2/50 focus:bg-app-surface focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary outline-none transition-all font-semibold" placeholder="e.g. France" required />
 </div>
 <div className="space-y-1.5">
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest ml-1">ISO Alpha-2 Code</label>
 <input name="code" defaultValue={country?.code} className="w-full h-12 px-4 rounded-xl border border-app-border bg-app-surface-2/50 focus:bg-app-surface focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary outline-none transition-all font-mono font-bold uppercase" placeholder="FR" required maxLength={3} />
 </div>

 <div className="pt-4 flex gap-3">
 <button type="button" onClick={onClose} className="flex-1 h-12 rounded-xl border border-app-border font-bold text-app-muted-foreground hover:bg-app-background transition-colors">Cancel</button>
 <button type="submit" className="flex-1 h-12 rounded-xl bg-app-surface text-app-foreground font-bold hover:bg-app-surface-2 transition-all shadow-lg active:scale-95">
 Save Hub
 </button>
 </div>
 </form>
 </div>
 </div>
 )
}
