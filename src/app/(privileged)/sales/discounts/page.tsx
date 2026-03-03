// @ts-nocheck
'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { DiscountRule, UsageLog, Category, Brand } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
 Tag, Plus, Percent, DollarSign, Package, Layers, Calendar,
 History, Edit2, Trash2, X, Check, Power, AlertCircle, ShoppingCart,
 Activity, ShieldCheck,
 Tags, RefreshCw, Zap, TrendingUp,
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
 PERCENTAGE: { label: 'Percentage Off', icon: Percent, color: 'text-app-info', bg: 'bg-app-info-bg' },
 FIXED: { label: 'Fixed Amount', icon: DollarSign, color: 'text-app-primary', bg: 'bg-app-primary-light' },
 BUY_X_GET_Y: { label: 'Buy X Get Y', icon: Plus, color: 'text-purple-600', bg: 'bg-purple-50' },
}
const SCOPE_CONFIG: Record<string, { label: string; icon: any }> = {
 ORDER: { label: 'Entire Order', icon: ShoppingCart },
 PRODUCT: { label: 'Specific Product', icon: Package },
 CATEGORY: { label: 'Category', icon: Layers },
 BRAND: { label: 'Brand', icon: Tag },
}
export default function DiscountRulesPage() {
 const { fmt } = useCurrency()
 const [rules, setRules] = useState<DiscountRule[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [editId, setEditId] = useState<number | null>(null)
 const settings = useListViewSettings('sales_discounts', {
 columns: ['name', 'discount_type', 'value', 'scope', 'times_used', 'status', 'actions'],
 pageSize: 25, sortKey: 'name', sortDir: 'asc'
 })
 const [usageRuleId, setUsageRuleId] = useState<number | null>(null)
 const [usageLogs, setUsageLogs] = useState<UsageLog[]>([])
 const [loadingLogs, setLoadingLogs] = useState(false)
 // Lookup data
 const [products, setProducts] = useState<Record<string, any>[]>([])
 const [categories, setCategories] = useState<Category[]>([])
 const [brands, setBrands] = useState<Brand[]>([])
 const [form, setForm] = useState({
 name: '', code: '', discount_type: 'PERCENTAGE', scope: 'ORDER',
 value: '0', max_discount: '', min_order_amount: '', min_quantity: '',
 product: '', category: '', brand: '',
 is_active: true, auto_apply: false,
 start_date: '', end_date: '', usage_limit: '', priority: '0'
 })
 useEffect(() => { loadData(); loadLookups() }, [])
 async function loadData() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch('pos/discount-rules/')
 setRules(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load discounts")
 } finally {
 setLoading(false)
 }
 }
 async function loadLookups() {
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const [p, c, b] = await Promise.all([
 erpFetch('inventory/products/'),
 erpFetch('inventory/categories/'),
 erpFetch('inventory/brands/')
 ])
 setProducts(Array.isArray(p) ? p : p.results || [])
 setCategories(Array.isArray(c) ? c : c.results || [])
 setBrands(Array.isArray(b) ? b : b.results || [])
 } catch (e) { console.error("Lookup load failed", e) }
 }
 async function viewUsage(id: number) {
 setUsageRuleId(id)
 setLoadingLogs(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch(`pos/discount-rules/${id}/usage-log/`)
 setUsageLogs(data)
 } catch { toast.error("Failed to load redemption logs") }
 finally { setLoadingLogs(false) }
 }
 async function toggleRule(id: number) {
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 await erpFetch(`pos/discount-rules/${id}/toggle/`, { method: 'POST' })
 toast.success("Rule status synchronized")
 await loadData()
 } catch { toast.error("Failed to toggle rule") }
 }
 function startEdit(rule: Record<string, any>) {
 setEditId(rule.id)
 setForm({
 name: rule.name || '',
 code: rule.code || '',
 discount_type: rule.discount_type || 'PERCENTAGE',
 scope: rule.scope || 'ORDER',
 value: String(rule.value || 0),
 max_discount: rule.max_discount ? String(rule.max_discount) : '',
 min_order_amount: rule.min_order_amount ? String(rule.min_order_amount) : '',
 min_quantity: rule.min_quantity ? String(rule.min_quantity) : '',
 product: rule.product ? String(rule.product) : '',
 category: rule.category ? String(rule.category) : '',
 brand: rule.brand ? String(rule.brand) : '',
 is_active: rule.is_active !== false,
 auto_apply: rule.auto_apply === true,
 start_date: rule.start_date || '',
 end_date: rule.end_date || '',
 usage_limit: rule.usage_limit ? String(rule.usage_limit) : '',
 priority: String(rule.priority || 0)
 })
 setShowForm(true)
 }
 function startCreate() {
 setEditId(null)
 setForm({
 name: '', code: '', discount_type: 'PERCENTAGE', scope: 'ORDER',
 value: '0', max_discount: '', min_order_amount: '', min_quantity: '',
 product: '', category: '', brand: '',
 is_active: true, auto_apply: false,
 start_date: '', end_date: '', usage_limit: '', priority: '0'
 })
 setShowForm(true)
 }
 async function handleSave() {
 if (!form.name.trim()) { toast.error("Rule designation is required"); return }
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const payload = {
 ...form,
 value: parseFloat(form.value) || 0,
 max_discount: form.max_discount ? parseFloat(form.max_discount) : null,
 min_order_amount: form.min_order_amount ? parseFloat(form.min_order_amount) : null,
 min_quantity: form.min_quantity ? parseInt(form.min_quantity) : null,
 product: form.scope === 'PRODUCT' ? parseInt(form.product) : null,
 category: form.scope === 'CATEGORY' ? parseInt(form.category) : null,
 brand: form.scope === 'BRAND' ? parseInt(form.brand) : null,
 usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
 priority: parseInt(form.priority) || 0,
 start_date: form.start_date || null,
 end_date: form.end_date || null,
 }
 if (editId) {
 await erpFetch(`pos/discount-rules/${editId}/`, { method: 'PATCH', body: JSON.stringify(payload) })
 toast.success("Rule configuration updated")
 } else {
 await erpFetch('pos/discount-rules/', { method: 'POST', body: JSON.stringify(payload) })
 toast.success("New rule deployed")
 }
 setShowForm(false)
 await loadData()
 } catch { toast.error("Failed to commit rule configuration") }
 }
 const [deleteTarget, setDeleteTarget] = useState<number | null>(null)
 async function handleDelete() {
 if (deleteTarget === null) return
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 await erpFetch(`pos/discount-rules/${deleteTarget}/`, { method: 'DELETE' })
 toast.success("Discount deleted")
 await loadData()
 } catch { toast.error("Failed to delete rule") }
 setDeleteTarget(null)
 }
 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'name',
 label: 'Rule Configuration',
 render: (rule) => (
 <div className="app-page flex flex-col">
 <span className="font-black text-app-foreground leading-tight">{rule.name}</span>
 <span className="text-[10px] font-mono text-app-primary font-bold uppercase tracking-widest">{rule.code || 'NO TRIGGER CODE'}</span>
 </div>
 )
 },
 {
 key: 'discount_type',
 label: 'Benefit Type',
 render: (rule) => {
 const cfg = TYPE_CONFIG[rule.discount_type] || TYPE_CONFIG.PERCENTAGE
 const Icon = cfg.icon
 return (
 <div className="flex items-center gap-2">
 <div className={`w-7 h-7 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center`}>
 <Icon size={14} />
 </div>
 <span className="text-xs font-bold text-app-muted-foreground">{cfg.label}</span>
 </div>
 )
 }
 },
 {
 key: 'value',
 label: 'Discount Value',
 render: (rule) => (
 <span className="text-sm font-black text-app-foreground tracking-tighter">
 {rule.discount_type === 'PERCENTAGE' ? `${rule.value}%` :
 rule.discount_type === 'FIXED' ? fmt(parseFloat(String(rule.value ?? 0))) :
 `Buy ${rule.value} Get 1`}
 </span>
 )
 },
 {
 key: 'scope',
 label: 'Economic Scope',
 render: (rule) => {
 const scope = SCOPE_CONFIG[rule.scope] || SCOPE_CONFIG.ORDER
 const Icon = scope.icon
 return (
 <div className="flex items-center gap-1.5">
 <Icon size={12} className="text-app-muted-foreground" />
 <span className="text-[11px] font-medium text-app-muted-foreground">
 {scope.label}
 {rule.scope === 'PRODUCT' && `: ${rule.product_name || '... '}`}
 {rule.scope === 'CATEGORY' && `: ${rule.category_name || '... '}`}
 </span>
 </div>
 )
 }
 },
 {
 key: 'times_used',
 label: 'Utilization',
 render: (rule) => (
 <div className="flex flex-col">
 <div className="text-xs font-bold text-app-foreground">{rule.times_used ?? 0} <span className="text-app-muted-foreground font-medium">/ {rule.usage_limit || '\u221E'}</span></div>
 <div className="mt-1 h-1 w-20 bg-app-surface-2 rounded-full overflow-hidden">
 <div className="h-full bg-app-primary rounded-full" style={{ width: rule.usage_limit ? `${(rule.times_used / rule.usage_limit) * 100}%` : '5%' }} />
 </div>
 </div>
 )
 },
 {
 key: 'status',
 label: 'Lifecycle',
 render: (rule) => (
 <div className="flex gap-1.5 items-center">
 {rule.is_active ? (
 <Badge className="bg-app-primary-light text-app-success border-app-success/30 text-[9px] font-black uppercase tracking-widest">Live</Badge>
 ) : (
 <Badge className="bg-app-background text-app-muted-foreground border-app-border text-[9px] font-black uppercase tracking-widest">Paused</Badge>
 )}
 {rule.auto_apply && <Badge className="bg-app-warning-bg text-app-warning border-app-warning/30 text-[9px] font-black uppercase tracking-widest">Auto</Badge>}
 </div>
 )
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (rule) => (
 <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
 <Button variant="ghost" size="icon" onClick={() => viewUsage(rule.id)} className="h-7 w-7 rounded-lg text-app-muted-foreground hover:text-app-primary hover:bg-app-primary/5" title="Redemption Logs">
 <History size={14} />
 </Button>
 <Button variant="ghost" size="icon" onClick={() => toggleRule(rule.id)} className="h-7 w-7 rounded-lg text-app-muted-foreground hover:text-app-warning hover:bg-app-warning-bg" title="Toggle Status">
 <Power size={14} />
 </Button>
 <Button variant="ghost" size="icon" onClick={() => startEdit(rule)} className="h-7 w-7 rounded-lg text-app-muted-foreground hover:text-app-info hover:bg-app-info-bg">
 <Edit2 size={14} />
 </Button>
 <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(rule.id)} className="h-7 w-7 rounded-lg text-app-muted-foreground hover:text-rose-600 hover:bg-rose-50">
 <Trash2 size={14} />
 </Button>
 </div>
 )
 }
 ], [fmt])
 if (loading && rules.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-4 gap-6">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Tag size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Sales</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Discount <span className="text-app-primary">Engine</span>
          </h1>
        </div>
      </div>
    </header>
 {/* Tactical KPIs */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary/5 text-app-primary flex items-center justify-center">
 <Zap size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Live Rules</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{rules.filter(r => r.is_active).length}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase mt-1">Active Promos</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary-light text-app-primary flex items-center justify-center">
 <TrendingUp size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Total Redemptions</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{rules.reduce((s, r) => s + (Number(r.times_used) || 0), 0)}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase mt-1">Customer Savings</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-info-bg text-app-info flex items-center justify-center">
 <Activity size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Auto-Apply</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{rules.filter(r => r.auto_apply).length}</p>
 <p className="text-[10px] text-app-info font-bold uppercase mt-1">Passive Incentives</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-warning-bg text-app-warning flex items-center justify-center">
 <Calendar size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Scheduled</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{rules.filter(r => r.start_date || r.end_date).length}</p>
 <p className="text-[10px] text-app-warning font-bold uppercase mt-1">Planned Events</p>
 </div>
 </CardContent>
 </Card>
 </div>
 {/* Rule Form Overlay */}
 {showForm && (
 <div className="fixed inset-0 bg-app-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
 <Card className="w-full max-w-4xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-app-surface">
 <CardHeader className="p-8 border-b border-stone-50 flex flex-row items-center justify-between">
 <div>
 <CardTitle className="text-2xl font-black tracking-tight text-app-foreground">
 {editId ? 'Edit Rule' : 'New Rule'}
 </CardTitle>
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground mt-1">Promotion Settings</p>
 </div>
 <Button onClick={() => setShowForm(false)} variant="ghost" size="icon" className="rounded-2xl hover:bg-app-background text-app-muted-foreground hover:text-app-foreground">
 <X size={24} />
 </Button>
 </CardHeader>
 <CardContent className="p-8 overflow-y-auto max-h-[70vh]">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
 {/* Section 1: Core Identity */}
 <div className="space-y-6">
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-app-foreground font-black text-xs uppercase tracking-widest">
 <Tag size={14} className="text-app-warning" /> Identity
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Rule Designation *</label>
 <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Black Friday 40% Off" className="h-10 rounded-xl bg-app-background border-app-border" />
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Trigger Code</label>
 <Input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="BF2024" className="h-10 rounded-xl font-mono text-sm uppercase" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Benefit Logic</label>
 <Select value={form.discount_type} onValueChange={v => setForm({ ...form, discount_type: v })}>
 <SelectTrigger className="h-10 rounded-xl bg-app-background border-app-border text-xs font-bold"><SelectValue /></SelectTrigger>
 <SelectContent className="rounded-2xl border-app-border shadow-xl">
 {Object.entries(TYPE_CONFIG).map(([k, c]) => (
 <SelectItem key={k} value={k} className="text-xs font-bold">{c.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Value</label>
 <Input type="number" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="h-10 rounded-xl font-black text-sm" />
 </div>
 </div>
 </div>
 </div>
 {/* Section 2: Application Scope */}
 <div className="space-y-6">
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-app-foreground font-black text-xs uppercase tracking-widest">
 <Layers size={14} className="text-app-info" /> Scope & Bounds
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Rule Domain</label>
 <Select value={form.scope} onValueChange={v => setForm({ ...form, scope: v })}>
 <SelectTrigger className="h-10 rounded-xl bg-app-background border-app-border text-xs font-bold"><SelectValue /></SelectTrigger>
 <SelectContent className="rounded-2xl border-app-border shadow-xl">
 {Object.entries(SCOPE_CONFIG).map(([k, c]) => (
 <SelectItem key={k} value={k} className="text-xs font-bold">{c.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Priority SEQ</label>
 <Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="h-10 rounded-xl" />
 </div>
 </div>
 {form.scope === 'PRODUCT' && (
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Target Entity</label>
 <Select value={form.product} onValueChange={v => setForm({ ...form, product: v })}>
 <SelectTrigger className="h-10 rounded-xl bg-app-background border-app-border text-xs font-bold"><SelectValue placeholder="Select entity..." /></SelectTrigger>
 <SelectContent className="rounded-2xl border-app-border shadow-xl max-h-60">
 {products.map(p => <SelectItem key={String(p.id)} value={String(p.id)} className="text-xs font-medium">{String(p.name)}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 )}
 {/* (Other scopes similarly logicized ...) */}
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Threshold Amnt</label>
 <Input type="number" value={form.min_order_amount} onChange={e => setForm({ ...form, min_order_amount: e.target.value })} placeholder="Any" className="h-10 rounded-xl" />
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Threshold Qty</label>
 <Input type="number" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} placeholder="Any" className="h-10 rounded-xl" />
 </div>
 </div>
 </div>
 </div>
 {/* Section 3: Dates & Logic */}
 <div className="space-y-6">
 <div className="space-y-4">
 <div className="flex items-center gap-2 text-app-foreground font-black text-xs uppercase tracking-widest">
 <Calendar size={14} className="text-app-primary" /> Date Range
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Activation</label>
 <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="h-10 rounded-xl text-xs" />
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Expiry</label>
 <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="h-10 rounded-xl text-xs" />
 </div>
 </div>
 <div>
 <label className="text-[10px] font-black uppercase text-app-muted-foreground mb-1.5 block">Global Usage Cap</label>
 <Input type="number" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: e.target.value })} placeholder="Infinite" className="h-10 rounded-xl" />
 </div>
 <div className="pt-4 flex flex-col gap-3">
 <div className="flex items-center gap-3 bg-app-background p-3 rounded-2xl border border-app-border">
 <input type="checkbox" id="is_active" className="w-4 h-4 rounded text-app-warning focus:ring-amber-500" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
 <label htmlFor="is_active" className="text-[10px] font-black uppercase text-app-muted-foreground tracking-wider">Active</label>
 </div>
 <div className="flex items-center gap-3 bg-app-background p-3 rounded-2xl border border-app-border">
 <input type="checkbox" id="auto_apply" className="w-4 h-4 rounded text-app-info focus:ring-blue-500" checked={form.auto_apply} onChange={e => setForm({ ...form, auto_apply: e.target.checked })} />
 <label htmlFor="auto_apply" className="text-[10px] font-black uppercase text-app-muted-foreground tracking-wider">Autonomous Deployment</label>
 </div>
 </div>
 </div>
 </div>
 </div>
 <div className="flex justify-end gap-3 mt-12 pt-8 border-t border-stone-50">
 <Button onClick={() => setShowForm(false)} variant="ghost" className="h-12 px-8 rounded-2xl font-black text-app-muted-foreground uppercase tracking-widest text-[10px]">Abandon</Button>
 <Button onClick={handleSave} className="h-12 px-10 rounded-2xl bg-app-warning hover:bg-app-warning text-app-foreground font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-100 gap-2 transition-all hover:scale-[1.02]">
 <Check size={18} /> {editId ? 'Commit Changes' : 'Initialize Rule'}
 </Button>
 </div>
 </CardContent>
 </Card>
 </div>
 )}
 <TypicalListView
 title="Discount Rules"
 data={rules}
 loading={loading}
 getRowId={(r) => r.id}
 columns={columns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 headerExtra={
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2 bg-app-warning-bg px-4 py-1.5 rounded-2xl border border-app-warning/30 text-app-warning">
 <ShieldCheck size={14} className="text-app-warning" />
 <span className="text-[10px] font-black uppercase tracking-widest">Promotion Logic Active</span>
 </div>
 </div>
 }
 />
 {/* Redemption Logs Sidebar */}
 {usageRuleId && (
 <div className="fixed inset-0 bg-app-surface/40 backdrop-blur-sm z-[60] flex justify-end">
 <div className="w-[500px] bg-app-surface h-full shadow-2xl p-0 flex flex-col animate-in slide-in-from-right duration-500">
 <header className="p-8 border-b border-stone-50 flex items-center justify-between">
 <div>
 <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
 <History className="text-app-primary" /> Redemption <span className="text-app-primary">Audit</span>
 </h2>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mt-1">Transaction Linkage Monitor</p>
 </div>
 <Button onClick={() => setUsageRuleId(null)} variant="ghost" size="icon" className="rounded-2xl text-app-muted-foreground hover:text-app-foreground">
 <X size={24} />
 </Button>
 </header>
 <div className="flex-1 overflow-y-auto p-8">
 {loadingLogs ? (
 <div className="space-y-6">
 {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
 </div>
 ) : usageLogs.length === 0 ? (
 <div className="text-center py-20">
 <Activity size={48} className="mx-auto text-stone-200 mb-4" />
 <p className="text-sm font-bold text-app-muted-foreground">Neutral Data: No transactions found</p>
 </div>
 ) : (
 <div className="space-y-4">
 {usageLogs.map(log => (
 <div key={log.id} className="p-5 border border-app-border rounded-[2rem] hover:bg-app-background hover:border-app-primary/30 transition-all group/log">
 <div className="flex items-center justify-between">
 <div className="space-y-1">
 <p className="text-sm font-black text-app-foreground group-hover/log:text-app-primary transition-colors">Order #{String(log.order_ref || log.order)}</p>
 <p className="text-[10px] font-mono text-app-muted-foreground font-bold uppercase tracking-tight">
 {new Date(String(log.applied_at || '')).toLocaleString('fr-FR')}
 </p>
 </div>
 <div className="text-right">
 <p className="text-lg font-black text-rose-600">-{fmt(parseFloat(String(log.discount_amount ?? 0)))}</p>
 <p className="text-[9px] font-black text-app-primary uppercase tracking-widest mt-1">By: {String(log.applied_by_name || 'System Auto')}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 )}
 <ConfirmDialog
 open={deleteTarget !== null}
 onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
 onConfirm={handleDelete}
 title="Delete Rule?"
 description="This will permanently delete this discount rule and all associated records."
 confirmText="Delete"
 variant="danger"
 />
 </div>
 )
}
