// @ts-nocheck
'use client'

import { useState, useEffect, useTransition, useMemo, useCallback } from "react"
import {
 getDataQuality, getProductsForMaintenance, getMaintenanceFilterOptions,
 bulkUpdateProducts, generateBarcodes, type ProductUpdate
} from "@/app/actions/inventory/data-quality"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
 Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
 Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
 Search, Barcode, AlertTriangle, CheckCircle2, Package2, Tag,
 Layers, DollarSign, Percent, Save, Loader2, ScanBarcode,
 Wrench, ArrowLeft, RefreshCw, Filter
} from "lucide-react"
import Link from "next/link"

// ─── Types ───────────────────────────────────────────────────────
interface Product {
 id: number
 sku: string
 name: string
 barcode: string | null
 category: number | null
 category_name?: string
 brand: number | null
 brand_name?: string
 unit: number | null
 unit_name?: string
 parfum: number | null
 tva_rate: number
 cost_price_ht: number
 cost_price_ttc: number
 selling_price_ht: number
 selling_price_ttc: number
 size: number | null
}

interface DataQuality {
 total_products: number
 missing_barcode: number
 missing_category: number
 missing_brand: number
 zero_tva: number
 zero_cost_price: number
 zero_selling_price: number
 missing_name: number
}

interface FilterOpts {
 categories: { id: number; name: string }[]
 brands: { id: number; name: string }[]
 units: { id: number; name: string }[]
}

type IssueFilter = 'all' | 'missing_barcode' | 'missing_category' | 'missing_brand' | 'zero_tva' | 'zero_price'

// ─── Page ────────────────────────────────────────────────────────
export default function DataQualityPage() {
 const [quality, setQuality] = useState<DataQuality | null>(null)
 const [products, setProducts] = useState<Product[]>([])
 const [filterOpts, setFilterOpts] = useState<FilterOpts | null>(null)
 const [loading, setLoading] = useState(true)
 const [isPending, startTransition] = useTransition()
 const [search, setSearch] = useState("")
 const [issueFilter, setIssueFilter] = useState<IssueFilter>("all")
 const [selected, setSelected] = useState<Set<number>>(new Set())
 const [pendingEdits, setPendingEdits] = useState<Map<number, Partial<ProductUpdate>>>(new Map())
 const [editDialog, setEditDialog] = useState<Product | null>(null)
 const [barcodeResult, setBarcodeResult] = useState<{ generated: number } | null>(null)

 // ─── Fetch ───
 const reload = useCallback(() => {
 startTransition(async () => {
 const [q, p, f] = await Promise.all([
 getDataQuality(),
 getProductsForMaintenance(),
 getMaintenanceFilterOptions()
 ])
 setQuality(q)
 setProducts(Array.isArray(p) ? p : p?.results || [])
 setFilterOpts({
 categories: Array.isArray(f.categories) ? f.categories : f.categories?.results || [],
 brands: Array.isArray(f.brands) ? f.brands : f.brands?.results || [],
 units: Array.isArray(f.units) ? f.units : f.units?.results || [],
 })
 setLoading(false)
 })
 }, [])
 useEffect(() => { reload() }, [reload])

 // ─── Filter ───
 const filtered = useMemo(() => {
 let list = products
 if (search) {
 const s = search.toLowerCase()
 list = list.filter(p =>
 p.name?.toLowerCase().includes(s) ||
 p.sku?.toLowerCase().includes(s) ||
 p.barcode?.toLowerCase().includes(s)
 )
 }
 switch (issueFilter) {
 case 'missing_barcode': list = list.filter(p => !p.barcode); break
 case 'missing_category': list = list.filter(p => !p.category); break
 case 'missing_brand': list = list.filter(p => !p.brand); break
 case 'zero_tva': list = list.filter(p => Number(p.tva_rate) === 0); break
 case 'zero_price': list = list.filter(p => Number(p.selling_price_ht) === 0 && Number(p.selling_price_ttc) === 0); break
 }
 return list
 }, [products, search, issueFilter])

 // ─── Inline Edit ───
 const setEdit = (productId: number, field: string, value: Record<string, any>) => {
 setPendingEdits(prev => {
 const next = new Map(prev)
 const existing = next.get(productId) || {}
 next.set(productId, { ...existing, id: productId, [field]: value })
 return next
 })
 }

 const getEditValue = (productId: number, field: string, original: Record<string, any>) => {
 const edit = pendingEdits.get(productId)
 if (edit && field in edit) return (edit as any)[field]
 return original
 }

 const hasEdits = pendingEdits.size > 0

 // ─── Save ───
 const handleSave = () => {
 const updates = Array.from(pendingEdits.values()) as ProductUpdate[]
 if (updates.length === 0) return
 startTransition(async () => {
 await bulkUpdateProducts(updates)
 setPendingEdits(new Map())
 reload()
 })
 }

 // ─── Generate Barcodes ───
 const handleGenerateBarcodes = (selectedOnly: boolean) => {
 const ids = selectedOnly ? Array.from(selected) : undefined
 startTransition(async () => {
 const result = await generateBarcodes(ids)
 setBarcodeResult(result)
 setSelected(new Set())
 reload()
 })
 }

 // ─── Selection ───
 const toggleSelect = (id: number) => {
 setSelected(prev => {
 const next = new Set(prev)
 if (next.has(id)) next.delete(id); else next.add(id)
 return next
 })
 }
 const toggleSelectAll = () => {
 if (selected.size === filtered.length) setSelected(new Set())
 else setSelected(new Set(filtered.map(p => p.id)))
 }

 // ─── Data Quality Issues per product ───
 const getIssues = (p: Product) => {
 const issues: string[] = []
 if (!p.barcode) issues.push('barcode')
 if (!p.category) issues.push('category')
 if (!p.brand) issues.push('brand')
 if (Number(p.tva_rate) === 0) issues.push('tva')
 if (Number(p.selling_price_ht) === 0 && Number(p.selling_price_ttc) === 0) issues.push('price')
 return issues
 }

 if (loading) {
 return <div className="app-page flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
 }

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
 <div className="flex items-center gap-3">
 <Link href="/inventory/maintenance" className="p-2 rounded-lg hover:bg-accent">
 <ArrowLeft className="w-4 h-4" />
 </Link>
 <div>
 <h1 className="page-header-title tracking-tighter flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
 <Wrench className="w-7 h-7 text-app-foreground" />
 </div>
 Product Data <span className="text-orange-600">Quality</span>
 </h1>
 <p className="text-app-muted-foreground text-sm mt-2">
 Find and fix missing data — barcodes, categories, prices, TVA, and more
 </p>
 </div>
 </div>
 <div className="flex gap-2">
 <Button variant="outline" onClick={reload} disabled={isPending}>
 <RefreshCw className={`w-4 h-4 mr-2 ${isPending ? 'animate-spin' : ''}`} /> Refresh
 </Button>
 {hasEdits && (
 <Button onClick={handleSave} disabled={isPending} className="bg-app-success hover:bg-app-success">
 <Save className="w-4 h-4 mr-2" /> Save {pendingEdits.size} Changes
 </Button>
 )}
 </div>
 </div>

 {/* KPI Cards */}
 {quality && (
 <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
 <KPICard icon={<Package2 className="w-4 h-4" />} label="Total Products" value={quality.total_products} color="blue" />
 <KPICard
 icon={<Barcode className="w-4 h-4" />} label="No Barcode" value={quality.missing_barcode}
 color={quality.missing_barcode > 0 ? "red" : "green"} clickable
 onClick={() => setIssueFilter(issueFilter === 'missing_barcode' ? 'all' : 'missing_barcode')}
 active={issueFilter === 'missing_barcode'}
 />
 <KPICard
 icon={<Layers className="w-4 h-4" />} label="No Category" value={quality.missing_category}
 color={quality.missing_category > 0 ? "yellow" : "green"} clickable
 onClick={() => setIssueFilter(issueFilter === 'missing_category' ? 'all' : 'missing_category')}
 active={issueFilter === 'missing_category'}
 />
 <KPICard
 icon={<Tag className="w-4 h-4" />} label="No Brand" value={quality.missing_brand}
 color={quality.missing_brand > 0 ? "yellow" : "green"} clickable
 onClick={() => setIssueFilter(issueFilter === 'missing_brand' ? 'all' : 'missing_brand')}
 active={issueFilter === 'missing_brand'}
 />
 <KPICard
 icon={<Percent className="w-4 h-4" />} label="Zero TVA" value={quality.zero_tva}
 color={quality.zero_tva > 0 ? "orange" : "green"} clickable
 onClick={() => setIssueFilter(issueFilter === 'zero_tva' ? 'all' : 'zero_tva')}
 active={issueFilter === 'zero_tva'}
 />
 <KPICard
 icon={<DollarSign className="w-4 h-4" />} label="No Cost" value={quality.zero_cost_price}
 color={quality.zero_cost_price > 0 ? "red" : "green"}
 />
 <KPICard
 icon={<DollarSign className="w-4 h-4" />} label="No Sell Price" value={quality.zero_selling_price}
 color={quality.zero_selling_price > 0 ? "red" : "green"} clickable
 onClick={() => setIssueFilter(issueFilter === 'zero_price' ? 'all' : 'zero_price')}
 active={issueFilter === 'zero_price'}
 />
 </div>
 )}

 {/* Action Bar */}
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
 <Input placeholder="Search by name, SKU, barcode..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
 </div>

 {/* Barcode Generation */}
 {quality && quality.missing_barcode > 0 && (
 <div className="flex gap-2">
 {selected.size > 0 && (
 <Button variant="outline" size="sm" onClick={() => handleGenerateBarcodes(true)} disabled={isPending}>
 <ScanBarcode className="w-3.5 h-3.5 mr-1" /> Generate ({selected.size})
 </Button>
 )}
 <Button variant="outline" size="sm" onClick={() => handleGenerateBarcodes(false)} disabled={isPending}>
 <ScanBarcode className="w-3.5 h-3.5 mr-1" /> Generate All Missing ({quality.missing_barcode})
 </Button>
 </div>
 )}
 </div>

 {/* Filter Badges */}
 {issueFilter !== 'all' && (
 <div className="flex items-center gap-2">
 <Filter className="w-4 h-4 text-muted-foreground" />
 <Badge variant="secondary" className="cursor-pointer" onClick={() => setIssueFilter('all')}>
 Filtering: {issueFilter.replace('_', ' ')} ✕
 </Badge>
 <span className="text-sm text-muted-foreground">{filtered.length} products</span>
 </div>
 )}

 {/* Products Table */}
 <Card>
 <CardContent className="p-0">
 <div className="overflow-x-auto">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead className="w-10">
 <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} />
 </TableHead>
 <TableHead>SKU</TableHead>
 <TableHead className="min-w-[200px]">Name</TableHead>
 <TableHead className="min-w-[140px]">Barcode</TableHead>
 <TableHead>Category</TableHead>
 <TableHead>Brand</TableHead>
 <TableHead className="min-w-[80px]">TVA %</TableHead>
 <TableHead className="min-w-[100px]">Cost HT</TableHead>
 <TableHead className="min-w-[100px]">Sell HT</TableHead>
 <TableHead className="min-w-[100px]">Sell TTC</TableHead>
 <TableHead className="text-center">Issues</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.length === 0 ? (
 <TableRow>
 <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
 {issueFilter !== 'all' ? 'No products with this issue — great!' : 'No products found'}
 </TableCell>
 </TableRow>
 ) : filtered.slice(0, 100).map(p => {
 const issues = getIssues(p)
 const isEdited = pendingEdits.has(p.id)
 return (
 <TableRow key={p.id} className={isEdited ? "bg-app-warning-bg/50 dark:bg-yellow-950/10" : ""}>
 <TableCell>
 <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
 </TableCell>
 <TableCell className="font-mono text-xs text-muted-foreground">{p.sku}</TableCell>
 <TableCell>
 <Input
 className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent"
 value={getEditValue(p.id, 'name', p.name)}
 onChange={e => setEdit(p.id, 'name', e.target.value)}
 />
 </TableCell>
 <TableCell>
 {p.barcode ? (
 <span className="font-mono text-xs">{p.barcode}</span>
 ) : (
 <Badge variant="outline" className="text-app-error border-app-error text-xs">
 <AlertTriangle className="w-3 h-3 mr-1" /> Missing
 </Badge>
 )}
 </TableCell>
 <TableCell>
 <Select
 value={String(getEditValue(p.id, 'category', p.category) || '')}
 onValueChange={v => setEdit(p.id, 'category', v ? Number(v) : null)}
 >
 <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
 <SelectValue placeholder="—" />
 </SelectTrigger>
 <SelectContent>
 {filterOpts?.categories.map(c => (
 <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell>
 <Select
 value={String(getEditValue(p.id, 'brand', p.brand) || '')}
 onValueChange={v => setEdit(p.id, 'brand', v ? Number(v) : null)}
 >
 <SelectTrigger className="h-8 text-xs border-transparent hover:border-input bg-transparent">
 <SelectValue placeholder="—" />
 </SelectTrigger>
 <SelectContent>
 {filterOpts?.brands.map(b => (
 <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </TableCell>
 <TableCell>
 <Input
 type="number"
 className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent w-20 font-mono"
 value={getEditValue(p.id, 'tva_rate', Number(p.tva_rate))}
 onChange={e => setEdit(p.id, 'tva_rate', parseFloat(e.target.value) || 0)}
 />
 </TableCell>
 <TableCell>
 <Input
 type="number"
 className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent w-24 font-mono"
 value={getEditValue(p.id, 'cost_price_ht', Number(p.cost_price_ht))}
 onChange={e => setEdit(p.id, 'cost_price_ht', parseFloat(e.target.value) || 0)}
 />
 </TableCell>
 <TableCell>
 <Input
 type="number"
 className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent w-24 font-mono"
 value={getEditValue(p.id, 'selling_price_ht', Number(p.selling_price_ht))}
 onChange={e => setEdit(p.id, 'selling_price_ht', parseFloat(e.target.value) || 0)}
 />
 </TableCell>
 <TableCell>
 <Input
 type="number"
 className="h-8 text-sm border-transparent hover:border-input focus:border-input bg-transparent w-24 font-mono"
 value={getEditValue(p.id, 'selling_price_ttc', Number(p.selling_price_ttc))}
 onChange={e => setEdit(p.id, 'selling_price_ttc', parseFloat(e.target.value) || 0)}
 />
 </TableCell>
 <TableCell className="text-center">
 {issues.length === 0 ? (
 <CheckCircle2 className="w-4 h-4 text-app-success mx-auto" />
 ) : (
 <div className="flex items-center justify-center gap-1">
 <AlertTriangle className="w-3.5 h-3.5 text-app-warning" />
 <span className="text-xs text-app-warning">{issues.length}</span>
 </div>
 )}
 </TableCell>
 </TableRow>
 )
 })}
 </TableBody>
 </Table>
 </div>
 {filtered.length > 100 && (
 <div className="p-3 text-center text-sm text-muted-foreground border-t">
 Showing first 100 of {filtered.length} products. Use search or filters to narrow down.
 </div>
 )}
 </CardContent>
 </Card>

 {/* Barcode Result Dialog */}
 <Dialog open={!!barcodeResult} onOpenChange={() => setBarcodeResult(null)}>
 <DialogContent className="max-w-sm">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <ScanBarcode className="w-5 h-5 text-app-success" /> Barcodes Generated
 </DialogTitle>
 <DialogDescription>
 Successfully generated {barcodeResult?.generated} EAN-13 barcodes.
 </DialogDescription>
 </DialogHeader>
 <DialogFooter>
 <Button onClick={() => setBarcodeResult(null)}>Done</Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 )
}

// ─── KPI Card ────────────────────────────────────────────────────
function KPICard({ icon, label, value, color, clickable, onClick, active }: {
 icon: React.ReactNode; label: string; value: number; color: string
 clickable?: boolean; onClick?: () => void; active?: boolean
}) {
 const colorMap: Record<string, string> = {
 blue: 'bg-app-info-bg text-app-info border-app-info',
 red: 'bg-app-error-bg text-app-error border-app-error',
 yellow: 'bg-app-warning-bg text-app-warning border-app-warning',
 orange: 'bg-orange-50 text-orange-600 border-orange-200',
 green: 'bg-app-success-bg text-app-success border-app-success',
 }
 return (
 <Card
 className={`${clickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${active ? 'ring-2 ring-primary ring-offset-1' : ''}`}
 onClick={clickable ? onClick : undefined}
 >
 <CardContent className="flex items-center gap-2 p-3">
 <div className={`p-1.5 rounded-lg ${colorMap[color] || colorMap.blue}`}>{icon}</div>
 <div className="min-w-0">
 <p className="text-[10px] text-muted-foreground truncate">{label}</p>
 <p className="text-lg font-bold leading-none">{value}</p>
 </div>
 </CardContent>
 </Card>
 )
}
