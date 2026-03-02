'use client'

import { useCurrency } from '@/lib/utils/currency'

import { useState, useEffect, useMemo } from "react"
import type { DeliveryZone } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
 MapPin, Plus, DollarSign, Clock, Layers, Edit2, Trash2, X, Check
} from "lucide-react"

export default function DeliveryZonesPage() {
 const { fmt } = useCurrency()
 const [zones, setZones] = useState<DeliveryZone[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [editId, setEditId] = useState<number | null>(null)
 const [form, setForm] = useState({ name: '', description: '', base_fee: '0', estimated_days: '1', is_active: true })

 useEffect(() => { loadData() }, [])

 async function loadData() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch('pos/delivery-zones/')
 setZones(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load zones")
 } finally {
 setLoading(false)
 }
 }

 function startEdit(zone: Record<string, any>) {
 setEditId(zone.id)
 setForm({
 name: zone.name || '',
 description: zone.description || '',
 base_fee: String(zone.base_fee || 0),
 estimated_days: String(zone.estimated_days || 1),
 is_active: zone.is_active !== false,
 })
 setShowForm(true)
 }

 function startCreate() {
 setEditId(null)
 setForm({ name: '', description: '', base_fee: '0', estimated_days: '1', is_active: true })
 setShowForm(true)
 }

 async function handleSave() {
 if (!form.name.trim()) { toast.error("Name is required"); return }
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const payload = {
 name: form.name,
 description: form.description,
 base_fee: form.base_fee,
 estimated_days: parseInt(form.estimated_days) || 1,
 is_active: form.is_active,
 }
 if (editId) {
 await erpFetch(`pos/delivery-zones/${editId}/`, { method: 'PATCH', body: JSON.stringify(payload) })
 toast.success("Zone updated")
 } else {
 await erpFetch('pos/delivery-zones/', { method: 'POST', body: JSON.stringify(payload) })
 toast.success("Zone created")
 }
 setShowForm(false)
 await loadData()
 } catch {
 toast.error("Failed to save zone")
 }
 }

 const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

 async function handleDelete() {
 if (deleteTarget === null) return
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 await erpFetch(`pos/delivery-zones/${deleteTarget}/`, { method: 'DELETE' })
 toast.success("Zone deleted")
 await loadData()
 } catch {
 toast.error("Failed to delete zone")
 }
 setDeleteTarget(null)
 }

 const activeZones = zones.filter(z => z.is_active !== false).length
 const avgFee = zones.length > 0 ? zones.reduce((s, z) => s + parseFloat(String(z.base_fee || 0)), 0) / zones.length : 0

 if (loading) {
 return (
 <div className="page-container">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>
 <Skeleton className="h-96" />
 </div>
 )
 }

 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex items-center justify-between">
 <div>
 <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
 <MapPin size={28} className="text-white" />
 </div>
 Delivery <span className="text-emerald-600">Zones</span>
 </h1>
 <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">Coverage Areas & Delivery Zones</p>
 </div>
 <button onClick={startCreate}
 className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
 <Plus size={18} /> Add Zone
 </button>
 </header>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <Layers size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Total Zones</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-text">{zones.length}</p>
 <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">{activeZones} Active</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <DollarSign size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Avg Base Fee</p>
 <p className="text-xl font-black mt-1 tracking-tighter text-indigo-700">{fmt(avgFee)}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
 <Clock size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-text-faint">Avg Transit</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-blue-700">
 {zones.length > 0 ? (zones.reduce((s, z) => s + (z.estimated_days || 0), 0) / zones.length).toFixed(1) : '0'}
 </p>
 <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">Days Est.</p>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Create/Edit Form */}
 {showForm && (
 <Card className="rounded-[2.5rem] border-0 shadow-md bg-app-surface overflow-hidden">
 <CardHeader className="p-8 border-b border-stone-50 flex flex-row items-center justify-between">
 <div>
 <CardTitle className="text-xl font-black tracking-tight text-app-text">
 {editId ? 'Edit Zone' : 'New Zone'}
 </CardTitle>
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-text-faint mt-1">Coverage Settings</p>
 </div>
 <button onClick={() => setShowForm(false)} className="w-10 h-10 rounded-2xl hover:bg-app-bg flex items-center justify-center text-stone-300 hover:text-app-text transition-all"><X size={20} /></button>
 </CardHeader>
 <CardContent className="p-8">
 <div className="grid grid-cols-2 gap-6">
 <div>
 <label className="text-[10px] font-black uppercase text-app-text-faint mb-1.5 block">Zone Designation *</label>
 <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Abidjan Nord" className="h-10 rounded-xl bg-app-bg border-app-border" />
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-text-faint mb-1.5 block">Description</label>
 <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Zone description" className="h-10 rounded-xl bg-app-bg border-app-border" />
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-text-faint mb-1.5 block">Base Fee</label>
 <Input type="number" value={form.base_fee} onChange={e => setForm({ ...form, base_fee: e.target.value })} className="h-10 rounded-xl font-black text-sm" />
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-text-faint mb-1.5 block">Estimated Days</label>
 <Input type="number" value={form.estimated_days} onChange={e => setForm({ ...form, estimated_days: e.target.value })} className="h-10 rounded-xl font-black text-sm" />
 </div>
 </div>
 <div className="flex items-center gap-4 mt-8 pt-6 border-t border-stone-50">
 <div className="flex items-center gap-3 bg-app-bg p-3 rounded-2xl border border-app-border">
 <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" />
 <label className="text-[10px] font-black uppercase text-stone-700 tracking-wider">Zone Status: LIVE</label>
 </div>
 <div className="ml-auto flex gap-3">
 <button onClick={() => setShowForm(false)}
 className="h-11 px-6 rounded-2xl font-black text-app-text-faint uppercase tracking-widest text-[10px] hover:bg-app-bg transition-all">
 Abandon
 </button>
 <button onClick={handleSave}
 className="h-11 px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-100 flex items-center gap-2 transition-all hover:scale-[1.02]">
 <Check size={16} /> {editId ? 'Commit Changes' : 'Initialize Zone'}
 </button>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Zone Cards */}
 {zones.length === 0 ? (
 <Card className="rounded-[2.5rem] border-0 shadow-sm">
 <CardContent className="text-center py-20 text-app-text-faint">
 <MapPin size={48} className="mx-auto mb-4 opacity-20" />
 <p className="font-black text-stone-300 uppercase tracking-widest text-xs">No delivery zones configured</p>
 <button onClick={startCreate} className="mt-4 text-emerald-600 text-xs font-black uppercase tracking-widest hover:underline">Create your first zone</button>
 </CardContent>
 </Card>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
 {zones.map(z => (
 <Card key={z.id} className={`rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${z.is_active === false ? 'opacity-50' : ''}`}>
 <CardContent className="p-6">
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
 <MapPin size={18} />
 </div>
 <div>
 <p className="font-black text-sm text-app-text uppercase tracking-tight">{z.name}</p>
 {z.description && <p className="text-[10px] font-medium text-app-text-faint">{z.description}</p>}
 </div>
 </div>
 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 <button onClick={() => startEdit(z)}
 className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-300 hover:text-blue-600 hover:bg-blue-50 transition-all">
 <Edit2 size={14} />
 </button>
 <button onClick={() => setDeleteTarget(z.id)}
 className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-300 hover:text-rose-600 hover:bg-rose-50 transition-all">
 <Trash2 size={14} />
 </button>
 </div>
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="bg-app-bg rounded-2xl p-3 text-center">
 <p className="text-[9px] font-black uppercase tracking-widest text-app-text-faint">Base Fee</p>
 <p className="font-black text-sm text-emerald-600 mt-1">{fmt(parseFloat(String(z.base_fee || 0)))}</p>
 </div>
 <div className="bg-app-bg rounded-2xl p-3 text-center">
 <p className="text-[9px] font-black uppercase tracking-widest text-app-text-faint">Est. Transit</p>
 <p className="font-black text-sm text-blue-600 mt-1">{z.estimated_days || 1} day(s)</p>
 </div>
 </div>
 <div className="mt-4 flex items-center">
 <Badge className={`text-[9px] font-black uppercase tracking-widest border ${z.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-app-bg text-app-text-faint border-app-border'}`}>
 {z.is_active !== false ? 'Live' : 'Inactive'}
 </Badge>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}

 <ConfirmDialog
 open={deleteTarget !== null}
 onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
 onConfirm={handleDelete}
 title="Delete Delivery Zone?"
 description="This will permanently remove this delivery zone."
 confirmText="Delete"
 variant="danger"
 />
 </div>
 )
}
