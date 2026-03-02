'use client'

import { useCurrency } from '@/lib/utils/currency'

import { useState, useEffect, useMemo, useRef } from "react"
import type { Product } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 Printer, Tag, Search, CheckSquare, Barcode, Package
} from "lucide-react"

export default function LabelPrintingPage() {
 const { fmt } = useCurrency()
 const [products, setProducts] = useState<Product[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [selected, setSelected] = useState<Set<number>>(new Set())
 const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium')
 const printRef = useRef<HTMLDivElement>(null)

 useEffect(() => { loadData() }, [])

 async function loadData() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch('inventory/products/')
 setProducts(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load products")
 } finally {
 setLoading(false)
 }
 }

 const filtered = useMemo(() => {
 if (!search) return products
 const s = search.toLowerCase()
 return products.filter(p =>
 (p.name || '').toLowerCase().includes(s) ||
 (p.sku || '').toLowerCase().includes(s) ||
 (p.barcode || '').toLowerCase().includes(s)
 )
 }, [products, search])

 function toggleSelect(id: number) {
 setSelected(prev => {
 const next = new Set(prev)
 next.has(id) ? next.delete(id) : next.add(id)
 return next
 })
 }

 function selectAll() {
 if (selected.size === filtered.length) {
 setSelected(new Set())
 } else {
 setSelected(new Set(filtered.map(p => p.id)))
 }
 }

 function handlePrint() {
 if (selected.size === 0) { toast.error("Select at least one product"); return }
 const printWindow = window.open('', '_blank')
 if (!printWindow) { toast.error("Pop-up blocked"); return }

 const selectedProducts = products.filter(p => selected.has(p.id))
 const sizeStyles = {
 small: { w: '40mm', h: '25mm', font: '7px', barcodeH: '20px' },
 medium: { w: '60mm', h: '35mm', font: '9px', barcodeH: '28px' },
 large: { w: '80mm', h: '50mm', font: '11px', barcodeH: '36px' },
 }
 const s = sizeStyles[labelSize]

 printWindow.document.write(`
 <html><head><title>Print Labels</title>
 <style>
 @page { margin: 5mm; }
 * { margin: 0; padding: 0; box-sizing: border-box; }
 body { font-family: 'Courier New', monospace; }
 .labels { display: flex; flex-wrap: wrap; gap: 3mm; }
 .label {
 width: ${s.w}; height: ${s.h};
 border: 1px solid #ccc; border-radius: 2mm;
 padding: 2mm; display: flex; flex-direction: column;
 justify-content: space-between; font-size: ${s.font};
 page-break-inside: avoid;
 }
 .label .name { font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
 .label .sku { color: #666; font-size: 0.85em; }
 .label .barcode { text-align: center; font-family: 'Libre Barcode 128', 'Courier New', monospace;
 font-size: ${s.barcodeH}; letter-spacing: 2px; }
 .label .price { text-align: right; font-weight: bold; font-size: 1.1em; }
 .label .bottom { display: flex; justify-content: space-between; align-items: flex-end; }
 </style>
 <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
 </head><body>
 <div class="labels">
 ${selectedProducts.map(p => `
 <div class="label">
 <div class="name">${p.name || 'Unknown'}</div>
 <div class="sku">SKU: ${p.sku || '\u2014'}</div>
 <div class="barcode">${p.barcode || p.sku || '000000'}</div>
 <div class="bottom">
 <span class="sku">${p.barcode || '\u2014'}</span>
 <span class="price">${fmt(parseFloat(p.selling_price_ttc || p.cost_price || 0))}</span>
 </div>
 </div>
 `).join('')}
 </div>
 <script>
 document.fonts.ready.then(() => { setTimeout(() => { window.print(); }, 500); });
 <\/script>
 </body></html>
 `)
 printWindow.document.close()
 toast.success(`Printing ${selected.size} label(s)`)
 }

 if (loading) {
 return (
 <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
 <Skeleton className="h-96" />
 </div>
 )
 }

 const withBarcode = products.filter(p => p.barcode).length
 const withoutBarcode = products.length - withBarcode

 return (
 <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
 <header className="flex items-center justify-between">
 <div>
 <h1 className="page-header-title tracking-tighter flex items-center gap-4">
 <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-200">
 <Tag size={28} className="text-white" />
 </div>
 Label <span className="text-orange-600">Printing</span>
 </h1>
 <p className="text-sm text-app-text-muted mt-2">Select products and print barcode labels</p>
 </div>
 <div className="relative w-56">
 <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-text-faint" />
 <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
 </div>
 </header>

 {/* KPI Row */}
 <div className="grid grid-cols-4 gap-4">
 <Card className="border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <Package size={24} className="text-orange-500" />
 <div>
 <p className="text-xs text-app-text-muted uppercase">Total Products</p>
 <p className="text-2xl font-bold">{products.length}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <Barcode size={24} className="text-green-500" />
 <div>
 <p className="text-xs text-app-text-muted uppercase">With Barcode</p>
 <p className="text-2xl font-bold text-green-700">{withBarcode}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <Tag size={24} className="text-amber-500" />
 <div>
 <p className="text-xs text-app-text-muted uppercase">Without Barcode</p>
 <p className="text-2xl font-bold text-amber-700">{withoutBarcode}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
 <CardContent className="py-4">
 <div className="flex items-center gap-3">
 <CheckSquare size={24} className="text-blue-500" />
 <div>
 <p className="text-xs text-app-text-muted uppercase">Selected</p>
 <p className="text-2xl font-bold text-blue-700">{selected.size}</p>
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Print Controls */}
 <Card>
 <CardContent className="py-3 flex items-center gap-4">
 <div className="flex items-center gap-2">
 <span className="text-xs font-medium text-app-text-muted">Label Size:</span>
 {(['small', 'medium', 'large'] as const).map(size => (
 <button
 key={size}
 onClick={() => setLabelSize(size)}
 className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${labelSize === size ? 'bg-gray-900 text-white' : 'bg-app-surface-2 text-app-text-muted hover:bg-gray-200'
 }`}
 >
 {size.charAt(0).toUpperCase() + size.slice(1)}
 </button>
 ))}
 </div>
 <div className="ml-auto flex items-center gap-2">
 <button onClick={selectAll}
 className="px-3 py-1.5 bg-app-surface-2 text-app-text-muted rounded-lg text-xs font-medium hover:bg-gray-200 transition-all">
 {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
 </button>
 <button onClick={handlePrint}
 className="px-4 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition-all flex items-center gap-2 disabled:opacity-50"
 disabled={selected.size === 0}
 >
 <Printer size={14} /> Print {selected.size > 0 ? `(${selected.size})` : ''}
 </button>
 </div>
 </CardContent>
 </Card>

 {/* Product Selection Table */}
 <Card>
 <CardContent className="p-0">
 {filtered.length === 0 ? (
 <div className="text-center py-16 text-app-text-faint">
 <Package size={48} className="mx-auto mb-3 opacity-30" />
 <p>No products found</p>
 </div>
 ) : (
 <Table>
 <TableHeader>
 <TableRow className="bg-gray-50/50">
 <TableHead className="w-10">
 <input type="checkbox"
 checked={selected.size > 0 && selected.size === filtered.length}
 onChange={selectAll}
 className="rounded" />
 </TableHead>
 <TableHead>Product</TableHead>
 <TableHead>SKU</TableHead>
 <TableHead>Barcode</TableHead>
 <TableHead>Category</TableHead>
 <TableHead className="text-right">Price TTC</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.slice(0, 100).map((p: Record<string, any>) => (
 <TableRow
 key={p.id}
 className={`cursor-pointer transition-all ${selected.has(p.id) ? 'bg-orange-50' : 'hover:bg-gray-50/50'}`}
 onClick={() => toggleSelect(p.id)}
 >
 <TableCell>
 <input type="checkbox"
 checked={selected.has(p.id)}
 onChange={() => toggleSelect(p.id)}
 onClick={e => e.stopPropagation()}
 className="rounded" />
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-2">
 <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
 <span className="text-xs font-bold text-orange-600">
 {(p.name || '?').charAt(0)}
 </span>
 </div>
 <span className="font-medium text-sm">{p.name}</span>
 </div>
 </TableCell>
 <TableCell className="font-mono text-xs text-app-text-muted">{p.sku}</TableCell>
 <TableCell>
 {p.barcode ? (
 <span className="font-mono text-xs">{p.barcode}</span>
 ) : (
 <Badge className="bg-amber-100 text-amber-600 text-[10px]">No barcode</Badge>
 )}
 </TableCell>
 <TableCell className="text-xs text-app-text-muted">{p.category_name || '\u2014'}</TableCell>
 <TableCell className="text-right font-bold">{fmt(parseFloat(p.selling_price_ttc || 0))}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 )}
 </CardContent>
 </Card>

 {/* Label Preview */}
 {selected.size > 0 && (
 <Card>
 <CardHeader className="py-3">
 <CardTitle className="text-sm">Label Preview</CardTitle>
 </CardHeader>
 <CardContent>
 <div className="flex flex-wrap gap-3" ref={printRef}>
 {products.filter(p => selected.has(p.id)).slice(0, 8).map(p => (
 <div key={p.id}
 className="border border-dashed border-app-border rounded-lg p-3 flex flex-col gap-1"
 style={{ width: labelSize === 'small' ? '150px' : labelSize === 'medium' ? '200px' : '260px' }}
 >
 <p className="font-bold text-xs truncate">{p.name}</p>
 <p className="text-[10px] text-app-text-faint">SKU: {p.sku}</p>
 <p className="text-center font-mono text-lg tracking-widest my-1 text-gray-700">
 {(p.barcode || p.sku || '000000').split('').join(' ')}
 </p>
 <div className="flex justify-between items-end">
 <span className="text-[10px] text-app-text-faint">{p.barcode || '\u2014'}</span>
 <span className="font-bold text-sm">{fmt(parseFloat(p.selling_price_ttc || 0))}</span>
 </div>
 </div>
 ))}
 {selected.size > 8 && (
 <div className="flex items-center justify-center border border-dashed border-app-border rounded-lg p-3 text-app-text-faint text-xs" style={{ width: '200px' }}>
 +{selected.size - 8} more
 </div>
 )}
 </div>
 </CardContent>
 </Card>
 )}
 </div>
 )
}
