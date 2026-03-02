'use client'

import { useState } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { deleteWarehouse } from '@/app/actions/inventory/warehouses'
import WarehouseModal from './form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, Store, Warehouse, Cloud, MapPin, Layers, BarChart3, Plus, Trash2, Edit3, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string; bg: string }> = {
 BRANCH: { icon: Building2, color: 'text-indigo-600', label: 'Branch / Site', bg: 'bg-indigo-50' },
 STORE: { icon: Store, color: 'text-emerald-600', label: 'Store', bg: 'bg-emerald-50' },
 WAREHOUSE: { icon: Warehouse, color: 'text-app-text-muted', label: 'Warehouse', bg: 'bg-app-bg' },
 VIRTUAL: { icon: Cloud, color: 'text-violet-600', label: 'Virtual', bg: 'bg-violet-50' },
};

export function WarehouseClient({ initialWarehouses }: { initialWarehouses: any[] }) {
 const settings = useListViewSettings('inv_warehouses', {
 columns: ['name', 'location_type', 'site_name', 'inventory_count'],
 pageSize: 25,
 sortKey: 'name',
 sortDir: 'asc',
 })
 const [data, setData] = useState(initialWarehouses)
 const [loading, setLoading] = useState(false)
 const [isFormOpen, setIsFormOpen] = useState(false)
 const [editingWarehouse, setEditingWarehouse] = useState<any>(null)
 const [deleteTarget, setDeleteTarget] = useState<any>(null)

 const totalNodes = data.length
 const branchCount = data.filter(w => w.location_type === 'BRANCH').length
 const retailActive = data.filter(w => w.can_sell).length
 const globalSKUCount = data.reduce((sum, w) => sum + (w.inventory_count || 0), 0)

 // Parent options for the form: only BRANCH locations
 const parentOptions = data
 .filter(w => w.location_type === 'BRANCH')
 .map(w => ({ id: w.id, name: w.name }))

 const columns = [
 {
 key: 'name',
 label: 'Location',
 alwaysVisible: true,
 render: (row: any) => {
 const cfg = TYPE_CONFIG[row.location_type] || TYPE_CONFIG.WAREHOUSE;
 const Icon = cfg.icon;
 return (
 <div className="flex items-center gap-4">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${cfg.bg} ${cfg.color}`}>
 <Icon size={22} />
 </div>
 <div>
 <p className="font-black text-app-text tracking-tight">{row.name}</p>
 <div className="flex items-center gap-2">
 <span className="text-[10px] text-app-text-faint font-mono uppercase tracking-wider">{row.code || `LOC-${row.id}`}</span>
 <Badge className={`text-[9px] ${cfg.bg} ${cfg.color} border-none font-bold`}>{cfg.label}</Badge>
 </div>
 </div>
 </div>
 );
 }
 },
 {
 key: 'location_type',
 label: 'Type',
 render: (row: any) => {
 const cfg = TYPE_CONFIG[row.location_type] || TYPE_CONFIG.WAREHOUSE;
 return <Badge className={`${cfg.bg} ${cfg.color} border-none font-bold text-[10px]`}>{cfg.label}</Badge>;
 }
 },
 {
 key: 'site_name',
 label: 'Parent',
 render: (row: any) => (
 <div className="flex items-center gap-1.5 text-app-text-muted font-medium">
 <MapPin size={14} className="text-gray-300" />
 <span>{row.parent_name || row.site_name || '—'}</span>
 </div>
 )
 },
 {
 key: 'inventory_count',
 label: 'SKUs',
 align: 'center' as const,
 render: (row: any) => (
 <Badge className="bg-gray-900 text-white border-none font-mono">
 {row.inventory_count || 0}
 </Badge>
 )
 }
 ]

 const handleDelete = async () => {
 if (!deleteTarget) return
 try {
 await deleteWarehouse(deleteTarget.id)
 setData(prev => prev.filter(w => w.id !== deleteTarget.id))
 toast.success('Location removed')
 } catch (err) {
 toast.error('Failed to remove location')
 }
 setDeleteTarget(null)
 }

 const renderCard = (row: any) => {
 const cfg = TYPE_CONFIG[row.location_type] || TYPE_CONFIG.WAREHOUSE;
 const Icon = cfg.icon;

 return (
 <div
 className="group bg-app-surface border border-app-border rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-indigo-900/5 transition-all relative overflow-hidden cursor-pointer"
 onClick={() => { setEditingWarehouse(row); setIsFormOpen(true); }}
 >
 {!row.is_active && (
 <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
 <Badge className="bg-stone-800 text-white font-black text-[10px] tracking-[0.2em] px-4 py-2 rounded-xl">INACTIVE</Badge>
 </div>
 )}

 <div className="flex justify-between items-start mb-8">
 <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-sm transition-all group-hover:scale-110 ${cfg.bg} ${cfg.color}`}>
 <Icon size={32} />
 </div>
 <div className="flex gap-2">
 <button
 onClick={(e) => { e.stopPropagation(); setEditingWarehouse(row); setIsFormOpen(true); }}
 className="p-2.5 bg-app-bg text-app-text-faint hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
 >
 <Edit3 size={18} />
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
 className="p-2.5 bg-app-bg text-app-text-faint hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
 >
 <Trash2 size={18} />
 </button>
 </div>
 </div>

 <div className="mb-6">
 <div className="text-[10px] font-black text-stone-300 uppercase tracking-[0.3em] mb-2 font-mono flex items-center gap-2">
 <span className="w-3 h-[1px] bg-stone-200" />
 {row.code || `LOC-${row.id?.toString().padStart(3, '0')}`}
 </div>
 <h3 className="text-2xl font-black text-app-text mb-2 truncate group-hover:text-indigo-600 transition-colors">{row.name}</h3>
 <div className="flex items-center gap-2 text-xs text-app-text-muted font-bold uppercase tracking-tight mb-1">
 <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
 {row.parent_name && (
 <>
 <MapPin size={12} className="text-indigo-400" />
 <span className="truncate">{row.parent_name}</span>
 </>
 )}
 </div>
 {(row.city || row.phone) && (
 <div className="flex items-center gap-3 text-[11px] text-app-text-faint mt-2">
 {row.city && <span className="flex items-center gap-1"><MapPin size={11} />{row.city}</span>}
 {row.phone && <span className="flex items-center gap-1"><Phone size={11} />{row.phone}</span>}
 </div>
 )}
 </div>

 <div className="pt-6 border-t border-stone-50 flex justify-between items-center">
 <div>
 <div className="text-[9px] text-app-text-faint font-black uppercase tracking-widest mb-1">Inventory</div>
 <div className="flex items-baseline gap-1">
 <span className="text-3xl font-black text-app-text">{row.inventory_count || 0}</span>
 <span className="text-[10px] font-black text-stone-300 uppercase">SKUs</span>
 </div>
 </div>
 {row.can_sell ? (
 <div className="px-3 py-1.5 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-emerald-500/30 tracking-widest">
 Point of Sale
 </div>
 ) : (
 <div className="px-3 py-1.5 bg-app-bg text-app-text-faint text-[9px] font-black uppercase rounded-lg border border-app-border tracking-widest">
 No Sales
 </div>
 )}
 </div>
 </div>
 )
 }

 return (
 <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 md:p-8">
 {/* Infrastructure Intelligence */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
 <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-white overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-5 flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-surface text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
 <Building2 size={24} />
 </div>
 <div>
 <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Branches</p>
 <h2 className="text-2xl font-black text-app-text mt-0.5 tracking-tighter">{branchCount}</h2>
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-5 flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-surface text-app-text-muted flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
 <Layers size={24} />
 </div>
 <div>
 <p className="text-[10px] font-black text-app-text-faint uppercase tracking-widest">All Locations</p>
 <h2 className="text-2xl font-black text-app-text mt-0.5 tracking-tighter">{totalNodes}</h2>
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white overflow-hidden group hover:shadow-md transition-all">
 <CardContent className="p-5 flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-app-surface text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
 <Store size={24} />
 </div>
 <div>
 <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Retail Points</p>
 <h2 className="text-2xl font-black text-app-text mt-0.5 tracking-tighter">{retailActive}</h2>
 </div>
 </CardContent>
 </Card>

 <Card className="rounded-[2rem] border-0 shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden group hover:shadow-xl transition-all">
 <CardContent className="p-5 flex items-center gap-4">
 <div className="w-12 h-12 rounded-2xl bg-white/10 text-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm backdrop-blur-sm">
 <BarChart3 size={24} />
 </div>
 <div>
 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Global SKUs</p>
 <h2 className="text-2xl font-black text-white mt-0.5 tracking-tighter">{globalSKUCount}</h2>
 </div>
 </CardContent>
 </Card>
 </div>

 <TypicalListView
 title="Location & Branch"
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
 onAdd={() => { setEditingWarehouse(null); setIsFormOpen(true); }}
 addLabel="ADD LOCATION"
 viewMode="grid"
 renderCard={renderCard}
 actions={{
 onEdit: (r) => { setEditingWarehouse(r); setIsFormOpen(true); },
 onDelete: (r) => setDeleteTarget(r)
 }}
 >
 <TypicalFilter />
 </TypicalListView>

 {isFormOpen && (
 <WarehouseModal
 warehouse={editingWarehouse}
 onClose={() => setIsFormOpen(false)}
 parentOptions={parentOptions}
 />
 )}

 <ConfirmDialog
 open={deleteTarget !== null}
 onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
 onConfirm={handleDelete}
 title="Remove Location?"
 description="This will permanently remove this location and all associated data. This action cannot be undone."
 confirmText="Confirm Remove"
 variant="danger"
 />
 </div>
 )
}
