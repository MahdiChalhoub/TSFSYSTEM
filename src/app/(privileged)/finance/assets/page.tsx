'use client'

import { useState, useEffect, useTransition } from "react"
import type { Asset, FinancialAccount, DepreciationScheduleItem } from '@/types/erp'
import { getAssets, getAssetSchedule, createAsset, postDepreciation, AssetInput } from "@/app/actions/finance/assets"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { getFinancialSettings, FinancialSettingsState } from "@/app/actions/finance/settings"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { AssetTag } from "@/components/finance/assets/asset-tag"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { simulateDepreciation, ProjectedPoint } from "@/lib/finance/depreciation-sim"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
 Landmark, Plus, Search, TrendingDown, Package, CheckCircle2,
 AlertTriangle, XCircle, Eye, Calendar, X, QrCode, Wrench, ShieldCheck,
 Activity
} from "lucide-react"

export default function AssetsPage() {
 const [assets, setAssets] = useState<Asset[]>([])
 const [accounts, setAccounts] = useState<FinancialAccount[]>([])
 const [settings, setSettings] = useState<FinancialSettingsState | null>(null)
 const [loading, setLoading] = useState(true)
 const [dialogOpen, setDialogOpen] = useState(false)
 const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
 const [tagPreviewAsset, setTagPreviewAsset] = useState<Asset | null>(null)
 const [schedule, setSchedule] = useState<DepreciationScheduleItem[]>([])
 const [searchQuery, setSearchQuery] = useState("")
 const [isPending, startTransition] = useTransition()
 const [printing, setPrinting] = useState(false)
 const [selectedMethod, setSelectedMethod] = useState("LINEAR")

 // Live Preview Form State
 const [previewCost, setPreviewCost] = useState(0)
 const [previewLife, setPreviewLife] = useState(5)
 const [previewResidual, setPreviewResidual] = useState(0)
 const [previewCapacity, setPreviewCapacity] = useState(100)
 const [projection, setProjection] = useState<ProjectedPoint[]>([])

 useEffect(() => {
 if (previewCost > 0 && previewLife > 0) {
 const data = simulateDepreciation(
 selectedMethod,
 previewCost,
 previewLife,
 previewResidual,
 previewCapacity
 )
 setProjection(data)
 }
 }, [previewCost, previewLife, previewResidual, previewCapacity, selectedMethod])

 useEffect(() => { loadData() }, [])

 async function loadData() {
 try {
 const [a, accs, s] = await Promise.all([
 getAssets(),
 getFinancialAccounts(),
 getFinancialSettings()
 ])
 setAssets(Array.isArray(a) ? a : [])
 setAccounts(Array.isArray(accs) ? accs : [])
 setSettings(s)
 } catch {
 setAssets([]); setAccounts([])
 toast.error("Failed to load assets")
 } finally {
 setLoading(false)
 }
 }

 async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
 e.preventDefault()
 const fd = new FormData(e.currentTarget)
 const data: AssetInput = {
 name: fd.get("name") as string,
 description: fd.get("description") as string,
 category: fd.get("category") as string,
 purchase_value: Number(fd.get("purchase_value")),
 purchase_date: fd.get("purchase_date") as string,
 useful_life_years: Number(fd.get("useful_life_years")),
 residual_value: Number(fd.get("residual_value") || 0),
 depreciation_method: fd.get("depreciation_method") as string,
 source_account_id: Number(fd.get("source_account_id")),
 total_production_capacity: fd.get("total_production_capacity") ? Number(fd.get("total_production_capacity")) : undefined,
 production_unit_name: fd.get("production_unit_name") as string || undefined,
 }

 startTransition(async () => {
 try {
 await createAsset(data)
 setDialogOpen(false)
 toast.success("Asset acquired successfully")
 loadData()
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)) || "Failed to create asset")
 }
 })
 }

 async function viewSchedule(asset: Asset) {
 setSelectedAsset(asset)
 try {
 const s = await getAssetSchedule(asset.id)
 setSchedule(Array.isArray(s) ? s : [])
 } catch {
 setSchedule([])
 toast.error("Failed to load schedule")
 }
 }

 async function handleDepreciate(assetId: number, scheduleId: number) {
 startTransition(async () => {
 try {
 await postDepreciation(assetId, scheduleId)
 toast.success("Depreciation posted")
 if (selectedAsset) viewSchedule(selectedAsset)
 loadData()
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)) || "Failed to post depreciation")
 }
 })
 }

 async function handlePrintTag(asset: Asset) {
 setPrinting(true)
 const tagElement = document.getElementById(`asset-tag-preview-${asset.id}`)
 if (!tagElement) {
 setPrinting(false)
 return
 }

 try {
 const canvas = await html2canvas(tagElement, {
 scale: 4,
 useCORS: true,
 backgroundColor: null,
 logging: false
 })
 const imgData = canvas.toDataURL('image/png')
 const pdf = new jsPDF({
 orientation: 'landscape',
 unit: 'px',
 format: [canvas.width / 4, canvas.height / 4]
 })
 pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 4, canvas.height / 4)
 pdf.save(`Asset_Tag_${asset.id}.pdf`)
 toast.success("Print-ready tag generated")
 } catch (err) {
 toast.error("Failed to generate tag PDF")
 } finally {
 setPrinting(false)
 }
 }

 const categories = ["VEHICLE", "EQUIPMENT", "IT", "FURNITURE", "BUILDING", "LAND", "OTHER"]

 const filteredAssets = assets.filter(a =>
 !searchQuery ||
 (a.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
 (a.category || "").toLowerCase().includes(searchQuery.toLowerCase())
 )

 const totalPurchase = assets.reduce((s, a) => s + Number(a.purchase_value || 0), 0)
 const totalBook = assets.reduce((s, a) => s + Number(a.book_value || 0), 0)
 const fullyDepreciated = assets.filter(a => a.status === "FULLY_DEPRECIATED").length

 const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
 ACTIVE: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
 FULLY_DEPRECIATED: { icon: AlertTriangle, color: "text-app-text-muted", bg: "bg-app-surface-2 border-app-border" },
 DISPOSED: { icon: XCircle, color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
 }

 if (loading) {
 return (
 <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
 <div className="flex justify-between items-center">
 <div><Skeleton className="h-10 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
 <Skeleton className="h-10 w-36" />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
 </div>
 <Skeleton className="h-96 rounded-2xl" />
 </div>
 )
 }

 return (
 <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
 {/* Header */}
 <div className="flex justify-between items-center">
 <div>
 <div className="flex items-center gap-3">
 <h1 className="page-header-title text-app-text font-serif tracking-tight">Fixed Assets</h1>
 {settings?.assetTrackingMode && (
 <Badge className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2 ${settings.assetTrackingMode === 'ENTERPRISE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
 settings.assetTrackingMode === 'PROFESSIONAL' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
 'bg-app-bg text-app-text-muted border-app-border'
 }`}>
 <ShieldCheck size={12} className="mr-1.5" /> {settings.assetTrackingMode} Tracking
 </Badge>
 )}
 </div>
 <p className="text-app-text-muted font-medium mt-1">Track assets, depreciation schedules, and book values</p>
 </div>
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogTrigger asChild>
 <Button className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-all">
 <Plus size={16} /> Acquire Asset
 </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-4xl bg-app-bg border-app-border">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"><Landmark size={20} /> Acquire New Asset</DialogTitle>
 <DialogDescription>Register a fixed asset and configure its depreciation schedule.</DialogDescription>
 </DialogHeader>
 <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 pt-2">
 {/* Left: Form Controls */}
 <form onSubmit={handleCreate} className="lg:col-span-3 grid grid-cols-1 gap-4 bg-app-surface p-5 rounded-3xl border border-app-border shadow-sm overflow-y-auto max-h-[65vh] custom-scrollbar">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Asset Name *</label>
 <Input name="name" required placeholder="Delivery Truck" className="rounded-xl bg-stone-50/50 border-app-border" />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Asset Category *</label>
 <select name="category" required className="w-full px-3 py-2 border rounded-xl bg-stone-50/50 border-app-border text-sm outline-none focus:ring-2 focus:ring-black/5">
 {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Depreciation Method</label>
 <select
 name="depreciation_method"
 onChange={(e) => setSelectedMethod(e.target.value)}
 className="w-full px-3 py-2 border rounded-xl bg-stone-50/50 border-app-border text-sm outline-none focus:ring-2 focus:ring-black/5"
 >
 {(!settings?.allowedDepreciationMethods || settings.allowedDepreciationMethods.includes('LINEAR')) && (
 <option value="LINEAR">Linear (Straight-Line)</option>
 )}
 {settings?.allowedDepreciationMethods?.includes('DECLINING') && (
 <option value="DECLINING">Declining Balance (1.5x)</option>
 )}
 {settings?.allowedDepreciationMethods?.includes('DOUBLE_DECLINING') && (
 <option value="DOUBLE_DECLINING">Double-Declining (2x)</option>
 )}
 {settings?.allowedDepreciationMethods?.includes('PRODUCTION') && (
 <option value="PRODUCTION">Units of Production</option>
 )}
 </select>
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Purchase Value *</label>
 <Input
 name="purchase_value"
 type="number" step="0.01" min="0.01" required
 onChange={(e) => setPreviewCost(Number(e.target.value))}
 placeholder="50,000.00"
 className="rounded-xl border-emerald-200 bg-emerald-50/10 focus:ring-emerald-500/10"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Purchase Date *</label>
 <Input name="purchase_date" type="date" required className="rounded-xl bg-stone-50/50 border-app-border" />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Useful Life (Years) *</label>
 <Input
 name="useful_life_years"
 type="number" min="1" max="50" required
 defaultValue={previewLife}
 onChange={(e) => setPreviewLife(Number(e.target.value))}
 placeholder="5"
 className="rounded-xl bg-stone-50/50 border-app-border"
 />
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Residual Value</label>
 <Input
 name="residual_value"
 type="number" step="0.01" min="0" defaultValue="0"
 onChange={(e) => setPreviewResidual(Number(e.target.value))}
 placeholder="5,000.00"
 className="rounded-xl bg-stone-50/50 border-app-border"
 />
 </div>

 {selectedMethod === 'PRODUCTION' && (
 <>
 <div className="space-y-1.5 animate-in slide-in-from-top-2">
 <label className="text-xs font-bold text-indigo-500 uppercase tracking-tighter ml-1 italic">Total Capacity *</label>
 <Input
 name="total_production_capacity"
 type="number" min="1" required
 onChange={(e) => setPreviewCapacity(Number(e.target.value))}
 placeholder="100,000"
 className="rounded-xl border-indigo-200 bg-indigo-50/20"
 />
 </div>
 <div className="space-y-1.5 animate-in slide-in-from-top-2">
 <label className="text-xs font-bold text-indigo-500 uppercase tracking-tighter ml-1 italic">Unit Name *</label>
 <Input name="production_unit_name" required placeholder="Miles / Hours" className="rounded-xl border-indigo-200 bg-indigo-50/20" />
 </div>
 </>
 )}

 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Source Account</label>
 <select name="source_account_id" className="w-full px-3 py-2 border rounded-xl bg-stone-50/50 border-app-border text-sm outline-none focus:ring-2 focus:ring-black/5">
 <option value="">Select account...</option>
 {accounts.map((a: Record<string, any>) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
 </select>
 </div>
 </div>
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase tracking-tighter ml-1">Acquisition Description</label>
 <Input name="description" placeholder="Optional description..." className="rounded-xl bg-stone-50/50 border-app-border" />
 </div>
 <div className="flex justify-end gap-2 pt-3 border-t mt-2">
 <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl px-6 h-11 text-app-text-faint font-bold uppercase text-[10px] tracking-widest border-app-border hover:bg-app-bg">Cancel</Button>
 <Button type="submit" disabled={isPending} className="rounded-xl px-8 h-11 gap-2 shadow-lg shadow-black/10 bg-black hover:bg-stone-800 transition-all text-[10px] font-black uppercase tracking-widest text-white">
 {isPending ? "Acquiring..." : <><Landmark size={14} /> Finish Acquisition</>}
 </Button>
 </div>
 </form>

 {/* Right: Projection Preview */}
 <div className="lg:col-span-2 space-y-4">
 <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm h-full flex flex-col">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-2">
 <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
 <TrendingDown size={14} />
 </div>
 <h4 className="text-[10px] font-black text-app-text uppercase tracking-[0.2em] leading-none">Book Value Projection</h4>
 </div>
 <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border-emerald-100">Dynamic UI</Badge>
 </div>

 {previewCost > 0 ? (
 <div className="flex-1 flex flex-col justify-between">
 <div className="h-56 w-full">
 <ResponsiveContainer width="100%" height="100%">
 <AreaChart data={projection}>
 <defs>
 <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
 <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
 <XAxis
 dataKey="period"
 axisLine={false}
 tickLine={false}
 tick={{ fontSize: 9, fontWeight: 700, fill: '#a8a29e' }}
 />
 <YAxis hide domain={[0, 'auto']} />
 <Tooltip
 content={({ active, payload }) => {
 if (active && payload && payload.length) {
 return (
 <div className="bg-black/90 text-white p-3 rounded-2xl text-[10px] shadow-2xl backdrop-blur-md border border-white/10 scale-110">
 <p className="font-black uppercase tracking-widest opacity-50 mb-1 text-[8px]">Year {payload[0].payload.period}</p>
 <p className="font-black flex justify-between gap-6 text-sm">
 Value: <span className="text-emerald-400 font-serif">${Number(payload[0].value).toLocaleString()}</span>
 </p>
 </div>
 );
 }
 return null;
 }}
 />
 <Area
 type="monotone"
 dataKey="bookValue"
 stroke="#4f46e5"
 strokeWidth={4}
 fillOpacity={1}
 fill="url(#colorValue)"
 animationDuration={2000}
 />
 </AreaChart>
 </ResponsiveContainer>
 </div>

 <div className="grid grid-cols-2 gap-4 mt-6">
 <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100 flex flex-col">
 <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total Savings</span>
 <span className="text-lg font-black text-app-text tracking-tighter">
 ${(previewCost - previewResidual).toLocaleString()}
 </span>
 </div>
 <div className="p-4 bg-stone-50/50 rounded-2xl border border-app-border flex flex-col">
 <span className="text-[9px] font-black text-app-text-faint uppercase tracking-widest mb-1">Floor Value</span>
 <span className="text-lg font-black text-app-text tracking-tighter">
 ${previewResidual.toLocaleString()}
 </span>
 </div>
 </div>
 </div>
 ) : (
 <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-stone-50/50 rounded-[2.5rem] border-4 border-dashed border-app-border">
 <div className="w-16 h-16 rounded-full bg-app-surface flex items-center justify-center mb-4 shadow-xl border border-stone-50">
 <Activity size={24} className="text-indigo-200 animate-pulse" />
 </div>
 <p className="text-[10px] font-black text-app-text-faint uppercase tracking-[0.3em]">Initialize Tracking</p>
 <p className="text-[9px] text-app-text-faint mt-2 uppercase font-bold tracking-tight leading-relaxed max-w-[15ch]">
 Enter acquisition cost to generate value projection
 </p>
 </div>
 )}
 </div>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </div>

 {/* Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-stone-50 to-stone-100">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-app-text-faint uppercase tracking-wider">Total Assets</p>
 <p className="text-3xl font-bold text-app-text mt-1">{assets.length}</p>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-stone-200/60 flex items-center justify-center">
 <Package size={22} className="text-app-text-muted" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Purchase Value</p>
 <p className="text-3xl font-bold text-indigo-900 mt-1">{totalPurchase.toLocaleString()}</p>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-indigo-200/60 flex items-center justify-center">
 <Landmark size={22} className="text-indigo-500" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Book Value</p>
 <p className="text-3xl font-bold text-emerald-900 mt-1">{totalBook.toLocaleString()}</p>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
 <TrendingDown size={22} className="text-emerald-500" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Fully Depreciated</p>
 <p className="text-3xl font-bold text-amber-900 mt-1">{fullyDepreciated}</p>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-amber-200/60 flex items-center justify-center">
 <AlertTriangle size={22} className="text-amber-500" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Assets Table */}
 <Card className="rounded-2xl shadow-sm overflow-hidden">
 <div className="px-5 py-3 border-b flex items-center justify-between bg-stone-50/50">
 <h2 className="font-semibold text-app-text flex items-center gap-2"><Package size={16} /> Asset Register</h2>
 <div className="relative w-64">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" />
 <Input
 placeholder="Search name or category..."
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 className="pl-9 rounded-xl text-sm h-9 bg-app-surface"
 />
 </div>
 </div>
 <Table>
 <TableHeader>
 <TableRow className="bg-stone-50/30">
 <TableHead className="text-xs font-bold uppercase text-app-text-faint">Name</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint">Category</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint">Method</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-right">Purchase</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-right">Book Value</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-center">Depreciation</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-center">Status</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filteredAssets.map((asset: Record<string, any>) => {
 const depTotal = Number(asset.purchase_value) - Number(asset.residual_value || 0)
 const depPct = depTotal > 0 ? Math.round((Number(asset.accumulated_depreciation) / depTotal) * 100) : 100
 const sc = statusConfig[asset.status] || statusConfig.ACTIVE
 const StatusIcon = sc.icon
 return (
 <TableRow key={asset.id} className="hover:bg-stone-50/50 transition-colors">
 <TableCell className="font-semibold text-app-text">{asset.name}</TableCell>
 <TableCell>
 <Badge variant="outline" className="rounded-lg text-[11px] border-app-border text-app-text-muted">
 {(asset.category || "").replace(/_/g, " ")}
 </Badge>
 </TableCell>
 <TableCell className="text-sm text-app-text-muted">{asset.depreciation_method}</TableCell>
 <TableCell className="text-right text-sm">{Number(asset.purchase_value).toLocaleString()}</TableCell>
 <TableCell className="text-right font-semibold text-app-text">{Number(asset.book_value).toLocaleString()}</TableCell>
 <TableCell>
 <div className="flex items-center gap-2 justify-center">
 <div className="w-20 h-2.5 bg-app-surface-2 rounded-full overflow-hidden">
 <div
 className={`h-full rounded-full transition-all ${depPct >= 100 ? "bg-stone-400" : depPct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
 style={{ width: `${Math.min(depPct, 100)}%` }}
 />
 </div>
 <span className="text-xs font-semibold text-app-text-faint w-9">{depPct}%</span>
 </div>
 </TableCell>
 <TableCell className="text-center">
 <Badge variant="outline" className={`gap-1 rounded-lg border ${sc.bg} ${sc.color} font-semibold text-[11px]`}>
 <StatusIcon size={12} /> {(asset.status || "").replace(/_/g, " ")}
 </Badge>
 </TableCell>
 <TableCell className="text-right space-x-2">
 {settings?.enableAssetQR && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => setTagPreviewAsset(asset as Asset)}
 className="rounded-xl gap-1 h-8 text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
 >
 <QrCode size={12} /> QR
 </Button>
 )}
 {settings?.enableAssetMaintenance && (
 <Button
 size="sm"
 variant="outline"
 className="rounded-xl gap-1 h-8 text-xs font-semibold border-amber-200 text-amber-700 hover:bg-amber-50"
 >
 <Wrench size={12} /> Service
 </Button>
 )}
 <Button
 size="sm"
 variant="outline"
 onClick={() => viewSchedule(asset)}
 className="rounded-xl gap-1 h-8 text-xs font-semibold"
 >
 <Eye size={12} /> Schedule
 </Button>
 </TableCell>
 </TableRow>
 )
 })}
 {filteredAssets.length === 0 && (
 <TableRow>
 <TableCell colSpan={8} className="py-16 text-center">
 <div className="flex flex-col items-center gap-3">
 <div className="w-16 h-16 rounded-full bg-app-surface-2 flex items-center justify-center">
 <Landmark size={28} className="text-stone-300" />
 </div>
 <div>
 <p className="font-semibold text-app-text-muted">No assets found</p>
 <p className="text-sm text-app-text-faint mt-1">Acquire your first fixed asset to get started</p>
 </div>
 <Button variant="outline" onClick={() => setDialogOpen(true)} className="rounded-xl gap-2 mt-2">
 <Plus size={14} /> Acquire Asset
 </Button>
 </div>
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </Card>

 {/* Depreciation Schedule Panel */}
 {selectedAsset && (
 <Card className="rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
 <div className="px-5 py-4 border-b flex justify-between items-center bg-gradient-to-r from-stone-50 to-amber-50/30">
 <div>
 <h2 className="font-semibold text-app-text flex items-center gap-2">
 <Calendar size={16} /> Depreciation Schedule: {selectedAsset.name}
 </h2>
 <p className="text-sm text-app-text-faint mt-0.5">
 Life: {selectedAsset.useful_life_years} years • Method: {selectedAsset.depreciation_method}
 </p>
 </div>
 <Button variant="ghost" size="sm" onClick={() => setSelectedAsset(null)} className="rounded-xl gap-1">
 <X size={14} /> Close
 </Button>
 </div>
 <div className="overflow-x-auto max-h-96">
 <Table>
 <TableHeader>
 <TableRow className="bg-stone-50/30 sticky top-0">
 <TableHead className="text-xs font-bold uppercase text-app-text-faint">Period</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-right">Amount</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-center">Status</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-right">Action</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {schedule.map((line: Record<string, any>) => (
 <TableRow key={line.id} className="hover:bg-stone-50/50 transition-colors">
 <TableCell className="text-sm text-app-text-muted">{line.period_date}</TableCell>
 <TableCell className="text-right text-sm font-semibold">{Number(line.amount).toLocaleString()}</TableCell>
 <TableCell className="text-center">
 <Badge variant="outline" className={`gap-1 rounded-lg border font-semibold text-[11px] ${line.is_posted ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
 {line.is_posted ? <><CheckCircle2 size={12} /> Posted</> : <><TrendingDown size={12} /> Pending</>}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 {!line.is_posted && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => handleDepreciate(selectedAsset.id, line.id)}
 disabled={isPending}
 className="rounded-xl gap-1 h-7 text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50"
 >
 <TrendingDown size={12} /> Post
 </Button>
 )}
 </TableCell>
 </TableRow>
 ))}
 {schedule.length === 0 && (
 <TableRow>
 <TableCell colSpan={4} className="py-8 text-center text-app-text-faint">
 No depreciation schedule available.
 </TableCell>
 </TableRow>
 )}
 </TableBody>
 </Table>
 </div>
 </Card>
 )}
 {/* Asset Tag Preview Modal */}
 <Dialog open={!!tagPreviewAsset} onOpenChange={(open) => !open && setTagPreviewAsset(null)}>
 <DialogContent className="sm:max-w-md bg-app-bg border-app-border">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"><QrCode size={20} className="text-indigo-600" /> Physical Asset Tag</DialogTitle>
 <DialogDescription>Generate a print-ready sticker for physical asset identification.</DialogDescription>
 </DialogHeader>

 <div className="flex flex-col items-center py-6">
 <div id={tagPreviewAsset ? `asset-tag-preview-${tagPreviewAsset.id}` : ''}>
 {tagPreviewAsset && <AssetTag asset={tagPreviewAsset} size="md" />}
 </div>

 <div className="mt-8 grid grid-cols-2 gap-4 w-full">
 <div className="p-4 bg-app-surface rounded-2xl border border-app-border shadow-sm flex flex-col items-center text-center">
 <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mb-2">
 <ShieldCheck size={18} />
 </div>
 <h4 className="text-[10px] font-black uppercase text-app-text">High-Res PDF</h4>
 <p className="text-[8px] text-app-text-faint font-bold uppercase mt-1">Sticker Sheet Optimized</p>
 </div>
 <div className="p-4 bg-app-surface rounded-2xl border border-app-border shadow-sm flex flex-col items-center text-center">
 <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 mb-2">
 <QrCode size={18} />
 </div>
 <h4 className="text-[10px] font-black uppercase text-app-text">Audit Ready</h4>
 <p className="text-[8px] text-app-text-faint font-bold uppercase mt-1">Global Mobile Sync</p>
 </div>
 </div>
 </div>

 <div className="flex gap-3 pt-4 border-t border-app-border">
 <Button variant="outline" onClick={() => setTagPreviewAsset(null)} className="flex-1 rounded-xl">Cancel</Button>
 <Button
 onClick={() => tagPreviewAsset && handlePrintTag(tagPreviewAsset)}
 disabled={printing}
 className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 gap-2"
 >
 {printing ? 'Generating...' : <><Calendar size={14} /> Download Tag</>}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 </div>
 )
}
