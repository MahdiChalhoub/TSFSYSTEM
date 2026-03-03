'use client'
import { useState, useEffect, useMemo } from 'react'
import { erpFetch } from '@/lib/erp-api'
import { Percent, Plus, Star, Trash2, RefreshCw, CheckCircle, XCircle, Edit2, Save, X, Info, TrendingUp, LayoutGrid } from 'lucide-react'
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
type TaxGroup = {
 id: number
 name: string
 rate: number
 description?: string
 is_default: boolean
 tax_type?: string
}
type FormState = { name: string; rate: string; description: string; tax_type: string }
const EMPTY_FORM: FormState = { name: '', rate: '', description: '', tax_type: 'STANDARD' }
const TAX_TYPES = ['STANDARD', 'REDUCED', 'ZERO', 'EXEMPT', 'REVERSE_CHARGE']
export default function TaxGroupsPage() {
 const [groups, setGroups] = useState<TaxGroup[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [editing, setEditing] = useState<TaxGroup | null>(null)
 const [form, setForm] = useState<FormState>(EMPTY_FORM)
 const [saving, setSaving] = useState(false)
 const [settingDefault, setSettingDefault] = useState<number | null>(null)
 const [deleting, setDeleting] = useState<number | null>(null)
 const settings = useListViewSettings('fin_tax_groups', {
 columns: ['name', 'rate', 'description', 'actions'],
 pageSize: 25, sortKey: 'name', sortDir: 'asc'
 })
 useEffect(() => { load() }, [])
 async function load() {
 setLoading(true)
 try {
 const data = await erpFetch('finance/tax-groups/')
 setGroups(Array.isArray(data) ? data : (data?.results ?? []))
 } catch {
 setGroups([])
 toast.error("Failed to load tax groups")
 } finally {
 setLoading(false)
 }
 }
 function startEdit(tg: TaxGroup) {
 setEditing(tg)
 setForm({ name: tg.name, rate: String(tg.rate), description: tg.description || '', tax_type: tg.tax_type || 'STANDARD' })
 setShowForm(true)
 window.scrollTo({ top: 0, behavior: 'smooth' })
 }
 function startCreate() {
 setEditing(null)
 setForm(EMPTY_FORM)
 setShowForm(true)
 window.scrollTo({ top: 0, behavior: 'smooth' })
 }
 function cancelForm() {
 setShowForm(false)
 setEditing(null)
 setForm(EMPTY_FORM)
 }
 async function handleSave() {
 if (!form.name || !form.rate) return
 setSaving(true)
 try {
 const body = { name: form.name, rate: parseFloat(form.rate), description: form.description, tax_type: form.tax_type }
 if (editing) {
 await erpFetch(`finance/tax-groups/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(body) })
 toast.success('Tax group updated')
 } else {
 await erpFetch('finance/tax-groups/', { method: 'POST', body: JSON.stringify(body) })
 toast.success('Tax group created')
 }
 cancelForm()
 load()
 } catch {
 toast.error('Save failed')
 } finally {
 setSaving(false)
 }
 }
 async function handleSetDefault(id: number) {
 setSettingDefault(id)
 try {
 await erpFetch('finance/tax-groups/set_default/', { method: 'POST', body: JSON.stringify({ tax_group_id: id }) })
 toast.success('Default tax group updated')
 load()
 } catch {
 toast.error('Failed to set default')
 } finally {
 setSettingDefault(null)
 }
 }
 async function handleDelete(id: number) {
 setDeleting(id)
 try {
 await erpFetch(`finance/tax-groups/${id}/`, { method: 'DELETE' })
 toast.success('Tax group deleted')
 load()
 } catch {
 toast.error('Delete failed — may be in use')
 } finally {
 setDeleting(null)
 }
 }
 const stats = useMemo(() => {
 const total = groups.length
 const avg = total ? (groups.reduce((s, g) => s + Number(g.rate || 0), 0) / total) : 0
 const def = groups.find(g => g.is_default)?.name || 'None'
 return { total, avg, def }
 }, [groups])
 const columns: ColumnDef<TaxGroup>[] = useMemo(() => [
 {
 key: 'name',
 label: 'Tax Group Configuration',
 sortable: true,
 render: (tg) => (
 <div className="flex items-center gap-4">
 <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center bg-app-background border border-app-border shrink-0 shadow-inner">
 <span className="text-sm font-black text-app-warning">{Number(tg.rate).toFixed(0)}</span>
 <span className="text-[10px] text-app-muted-foreground font-bold">%</span>
 </div>
 <div className="flex flex-col">
 <div className="flex items-center gap-2">
 <span className="font-bold text-app-foreground text-sm">{tg.name}</span>
 {tg.is_default && (
 <Badge className="bg-app-warning-bg text-app-warning border-app-warning text-[9px] font-black uppercase px-2 h-4 rounded-lg flex items-center gap-1">
 <Star size={8} fill="currentColor" /> Default
 </Badge>
 )}
 </div>
 <span className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest">{tg.tax_type?.replace('_', ' ') || 'STANDARD'}</span>
 </div>
 </div>
 )
 },
 {
 key: 'rate',
 label: 'Rate (%)',
 align: 'right',
 sortable: true,
 render: (tg) => <span className="font-mono text-sm font-black text-app-warning">{Number(tg.rate).toFixed(2)}%</span>
 },
 {
 key: 'description',
 label: 'Applicability',
 render: (tg) => <span className="text-xs text-app-muted-foreground font-medium truncate max-w-[200px] inline-block">{tg.description || 'No description'}</span>
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (tg) => (
 <div className="flex items-center justify-end gap-1">
 {!tg.is_default && (
 <Button
 size="sm"
 variant="ghost"
 onClick={() => handleSetDefault(tg.id)}
 disabled={settingDefault === tg.id}
 className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest text-app-warning hover:bg-app-warning-bg hover:text-app-warning transition-all"
 >
 {settingDefault === tg.id ? '...' : 'Set Default'}
 </Button>
 )}
 <Button
 size="sm"
 variant="ghost"
 onClick={() => startEdit(tg)}
 className="rounded-xl h-8 w-8 p-0 text-app-muted-foreground hover:text-app-primary"
 >
 <Edit2 size={14} />
 </Button>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => handleDelete(tg.id)}
 disabled={deleting === tg.id || tg.is_default}
 className="rounded-xl h-8 w-8 p-0 text-app-muted-foreground hover:text-app-error disabled:opacity-30"
 >
 {deleting === tg.id ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
 </Button>
 </div>
 )
 }
 ], [settingDefault, deleting])
 if (loading && groups.length === 0) {
 return (
 <div className="page-container animate-in fade-in duration-700">
 <div className="flex justify-between items-center mb-8">
 <div><Skeleton className="h-14 w-80 rounded-2xl" /><Skeleton className="h-6 w-64 mt-3 rounded-lg" /></div>
 <Skeleton className="h-14 w-48 rounded-2xl" />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
 {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
 </div>
 <Skeleton className="h-[50vh] rounded-[2rem]" />
 </div>
 )
 }
 return (
 <div className="page-container animate-in fade-in duration-700 pb-32">
 {/* Standard Header */}
 <header className="flex justify-between items-end">
 <div>
 <div className="flex items-center gap-3 mb-4">
 <Badge variant="outline" className="bg-app-primary-light text-app-primary border-app-success/30 font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-full">
 Financial Configuration
 </Badge>
 <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] flex items-center gap-2">
 <TrendingUp size={14} className="text-app-primary" /> Regulatory Compliance
 </span>
 </div>
 <h1 className="page-header-title flex items-center gap-6">
 <div className="w-20 h-20 rounded-[2rem] bg-app-success flex items-center justify-center shadow-2xl shadow-app-primary/20 group hover:rotate-12 transition-transform duration-500">
 <Percent size={40} className="text-app-foreground fill-white/20" />
 </div>
 Tax <span className="text-app-success">Policies</span>
 </h1>
 <p className="page-header-subtitle">
 Create and manage tax groups, set rates, and enforce fiscal standards across your organization.
 </p>
 </div>
 <div className="flex items-center gap-3">
 <Button onClick={load} variant="outline" className="h-14 w-14 rounded-2xl border-app-border bg-app-surface shadow-xl shadow-app-border/20 p-0 text-app-muted-foreground hover:text-app-primary transition-all">
 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
 </Button>
 <Button onClick={startCreate} className="h-14 px-8 rounded-2xl bg-app-primary hover:bg-app-success text-app-foreground font-black uppercase tracking-widest text-[11px] shadow-xl shadow-app-primary/20 gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] border-b-4 border-b-emerald-800">
 <Plus size={18} /> Register Policy
 </Button>
 </div>
 </header>
 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="rounded-[2rem] border-0 shadow-xl shadow-app-border/20 bg-app-surface overflow-hidden group hover:-translate-y-1 transition-all duration-500">
 <CardContent className="p-8 flex items-center gap-6">
 <div className="w-16 h-16 rounded-2xl bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 ring-1 ring-emerald-100">
 <LayoutGrid size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground">Configured Protocols</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.total}</p>
 <div className="flex items-center gap-2 mt-1">
 <div className="w-1.5 h-1.5 rounded-full bg-app-primary animate-pulse" />
 <p className="text-[10px] text-app-primary font-bold uppercase tracking-widest">Active Rules</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-[2rem] border-0 shadow-xl shadow-app-border/20 bg-app-surface overflow-hidden group hover:-translate-y-1 transition-all duration-500">
 <CardContent className="p-8 flex items-center gap-6">
 <div className="w-16 h-16 rounded-2xl bg-app-info-bg text-app-info flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 ring-1 ring-blue-100">
 <TrendingUp size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground">Mean Tax Pressure</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{stats.avg.toFixed(1)}%</p>
 <p className="text-[10px] text-app-info font-bold uppercase tracking-widest mt-1 italic">Weighted Average</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-[2rem] border-0 shadow-xl shadow-app-border/20 bg-app-surface overflow-hidden group hover:-translate-y-1 transition-all duration-500">
 <CardContent className="p-8 flex items-center gap-6">
 <div className="w-16 h-16 rounded-2xl bg-app-primary text-app-foreground flex items-center justify-center group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 shadow-lg shadow-emerald-200">
 <Star size={32} className="fill-white" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground">Authoritative Node</p>
 <p className="text-xl font-black mt-1 tracking-tight text-app-foreground truncate">{stats.def}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase tracking-widest mt-1">Primary Assignment</p>
 </div>
 </CardContent>
 </Card>
 </div>
 {/* Create/Edit Form */}
 {showForm && (
 <div className="animate-in slide-in-from-top-8 duration-700">
 <Card className="card-premium overflow-hidden border-2 border-app-success/30 shadow-2xl shadow-app-primary/20">
 <div className="px-8 py-6 border-b border-app-border bg-app-primary-light/30 flex items-center justify-between">
 <div>
 <h3 className="text-xl font-black tracking-tight text-app-foreground flex items-center gap-3">
 <div className="w-10 h-10 rounded-xl bg-app-surface flex items-center justify-center shadow-sm">
 <Edit2 size={20} className="text-app-primary" />
 </div>
 {editing ? 'Edit Tax Group' : 'Create Tax Group'}
 </h3>
 <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mt-1 ml-13">Settings</p>
 </div>
 <Button variant="ghost" onClick={cancelForm} className="h-12 w-12 rounded-2xl p-0 text-app-muted-foreground hover:text-app-error hover:bg-app-error-bg transition-all">
 <X size={20} />
 </Button>
 </div>
 <div className="p-8 grid grid-cols-1 md:grid-cols-4 gap-8">
 <div className="space-y-2">
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest ml-1">Name</label>
 <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="VAT 20%" className="rounded-xl h-12 bg-app-background border-app-border focus:bg-app-surface focus:ring-app-primary/10" />
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest ml-1">Percentage Rate</label>
 <div className="relative">
 <Input type="number" step="0.01" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="20.0" className="rounded-xl h-12 bg-app-background border-app-border focus:bg-app-surface pr-10" />
 <Percent size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 </div>
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest ml-1">Logic Type</label>
 <select value={form.tax_type} onChange={e => setForm(f => ({ ...f, tax_type: e.target.value }))} className="w-full h-12 px-4 border border-app-border rounded-xl bg-app-background text-sm font-bold shadow-sm outline-none focus:bg-app-surface focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary transition-all">
 {TAX_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
 </select>
 </div>
 <div className="space-y-2">
 <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest ml-1">Applicability Logic</label>
 <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details..." className="rounded-xl h-12 bg-app-background border-app-border focus:bg-app-surface" />
 </div>
 </div>
 <div className="px-8 py-6 border-t border-app-border flex justify-end gap-4 bg-app-surface-2/30">
 <Button variant="ghost" onClick={cancelForm} className="rounded-xl font-black text-[11px] uppercase tracking-widest h-12 px-6">Discard</Button>
 <Button onClick={handleSave} disabled={saving || !form.name || !form.rate} className="rounded-xl bg-app-surface hover:bg-app-background text-app-foreground font-black text-[11px] uppercase tracking-widest h-12 px-10 shadow-2xl shadow-app-border/20 border-b-4 border-b-black transition-all hover:scale-105 active:scale-95 flex items-center gap-3">
 {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
 {editing ? 'Save Changes' : 'Create'}
 </Button>
 </div>
 </Card>
 </div>
 )}
 <TypicalListView
 title="Tax Groups"
 data={groups}
 loading={loading}
 getRowId={(tg) => tg.id}
 columns={columns}
 className="card-premium overflow-hidden border-0 shadow-2xl shadow-app-border/20"
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 />
 </div>
 )
}
