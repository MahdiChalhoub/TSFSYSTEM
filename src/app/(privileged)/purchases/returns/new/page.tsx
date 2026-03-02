'use client'

import { useCurrency } from '@/lib/utils/currency'

import { useState, useEffect, Suspense } from "react"
import type { PurchaseOrder } from '@/types/erp'
import { useSearchParams, useRouter } from "next/navigation"
import { erpFetch } from "@/lib/erp-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ArrowLeft, Truck, AlertCircle, ShoppingBag, CheckCircle2 } from "lucide-react"
import Link from "next/link"

function CreatePurchaseReturnForm() {
 const { fmt } = useCurrency()
 const searchParams = useSearchParams()
 const router = useRouter()
 const orderId = searchParams.get('order_id')

 const [order, setOrder] = useState<PurchaseOrder | null>(null)
 const [loading, setLoading] = useState(true)
 const [returnItems, setReturnItems] = useState<Record<number, number>>({})
 const [reason, setReason] = useState("")
 const [submitting, setSubmitting] = useState(false)

 useEffect(() => {
 if (orderId) loadOrder()
 else {
 toast.error("No Order ID provided")
 setLoading(false)
 }
 }, [orderId])

 async function loadOrder() {
 try {
 const data = await erpFetch(`purchase/${orderId}/`)
 setOrder(data)
 const initialQtys: Record<number, number> = {}
 data.lines.forEach((l: Record<string, any>) => {
 initialQtys[l.id] = 0
 })
 setReturnItems(initialQtys)
 } catch {
 toast.error("Failed to load purchase details")
 } finally {
 setLoading(false)
 }
 }

 const handleQtyChange = (lineId: number, qty: number, max: number) => {
 const val = Math.max(0, Math.min(qty, max))
 setReturnItems(prev => ({ ...prev, [lineId]: val }))
 }

 const calculateTotals = () => {
 let total = 0
 if (!order) return 0
 order.lines?.forEach((l: Record<string, any>) => {
 const qty = returnItems[l.id] || 0
 total += qty * parseFloat(l.unit_price)
 })
 return total
 }

 const handleSubmit = async () => {
 const lines = Object.entries(returnItems)
 .filter(([_, qty]) => qty > 0)
 .map(([lineId, qty]) => {
 const line = order?.lines?.find((l: Record<string, any>) => l.id === Number(lineId))
 return {
 product_id: line?.product || line?.product_id,
 quantity: qty,
 unit_price: line?.unit_price
 }
 })

 if (lines.length === 0) {
 toast.error("Please select at least one item to return")
 return
 }

 setSubmitting(true)
 try {
 await erpFetch('purchase-returns/', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 original_order: order?.id,
 reason: reason,
 lines: lines
 })
 })
 toast.success("Purchase return request created")
 router.push('/purchases/returns')
 } catch (e: unknown) {
 toast.error((e instanceof Error ? e.message : String(e)) || "Failed to create return")
 } finally {
 setSubmitting(false)
 }
 }

 if (loading) return <div className="p-10 space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>
 if (!order) return <div className="p-20 text-center"><AlertCircle className="mx-auto mb-4 text-gray-300" size={48} /><p>Purchase Order not found</p></div>

 return (
 <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
 <header className="flex items-center justify-between">
 <div>
 <Link href={`/purchases/${orderId}`} className="flex items-center gap-2 text-xs font-bold text-app-text-faint hover:text-blue-500 mb-4 transition-all">
 <ArrowLeft size={14} /> Back to Purchase Detail
 </Link>
 <h1 className="page-header-title tracking-tighter flex items-center gap-3">
 <Truck size={32} className="text-blue-500" />
 Supplier Return for <span className="text-blue-500">{order.ref_code || `#${orderId}`}</span>
 </h1>
 </div>
 </header>

 <div className="grid lg:grid-cols-3 gap-8">
 <div className="lg:col-span-2 space-y-6">
 <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden">
 <div className="p-6 bg-app-bg border-b border-app-border font-bold text-[10px] uppercase tracking-widest text-app-text-faint">
 Select Items to Ship Back
 </div>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Product</TableHead>
 <TableHead className="text-center">Received</TableHead>
 <TableHead className="text-center w-32">Return Qty</TableHead>
 <TableHead className="text-right">Unit Cost</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {order?.lines?.map((line: Record<string, any>) => (
 <TableRow key={line.id}>
 <TableCell>
 <div className="font-bold text-app-text">{line.product_name}</div>
 <div className="text-[10px] text-app-text-faint uppercase font-mono">Line ID: {line.id}</div>
 </TableCell>
 <TableCell className="text-center font-bold text-app-text-muted">{line.qty_received}</TableCell>
 <TableCell>
 <Input
 type="number"
 min={0}
 max={parseFloat(line.qty_received)}
 className="text-center font-black rounded-xl border-app-border"
 value={returnItems[line.id] || 0}
 onChange={(e) => handleQtyChange(line.id, parseFloat(e.target.value), parseFloat(line.qty_received))}
 />
 </TableCell>
 <TableCell className="text-right font-medium text-app-text">{fmt(parseFloat(line.unit_price))}</TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </Card>

 <Card className="border-none shadow-xl rounded-[2rem] p-6 space-y-4">
 <h3 className="font-bold text-xs uppercase tracking-widest text-app-text-faint">Return Instructions / Reason</h3>
 <textarea
 className="w-full h-32 p-4 rounded-2xl border border-app-border bg-gray-50/50 focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all outline-none text-sm"
 placeholder="Reason for return, RMN number, or special instructions for the supplier..."
 value={reason}
 onChange={(e) => setReason(e.target.value)}
 />
 </Card>
 </div>

 <div className="space-y-6">
 <Card className="bg-gray-900 text-white p-8 rounded-[2.5rem] shadow-2xl border-none">
 <div className="space-y-6">
 <div>
 <div className="text-[10px] font-black text-app-text-muted uppercase tracking-widest mb-4">Debit Summary</div>
 <div className="flex justify-between items-center py-2 border-b border-gray-800">
 <span className="text-sm text-app-text-faint">Items to Return</span>
 <span className="font-bold">{Object.values(returnItems).filter(q => q > 0).length} Lines</span>
 </div>
 <div className="flex justify-between items-center py-2 border-b border-gray-800">
 <span className="text-sm text-app-text-faint">Debit Value</span>
 <span className="font-mono text-xs">{fmt(calculateTotals())}</span>
 </div>
 </div>

 <div className="pt-4">
 <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1 text-right">Estimated Debit</div>
 <div className="text-5xl font-black text-white text-right tracking-tighter">
 {fmt(calculateTotals())}
 </div>
 </div>

 <Button
 className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-900/20 flex items-center gap-3 transition-all active:scale-[0.98]"
 onClick={handleSubmit}
 disabled={submitting || calculateTotals() === 0}
 >
 {submitting ? "Processing..." : (
 <>
 <CheckCircle2 size={24} />
 Initialize Ship-back
 </>
 )}
 </Button>
 </div>
 </Card>

 <div className="p-6 bg-blue-50 rounded-[2rem] border border-blue-100">
 <div className="flex items-center gap-2 text-blue-600 mb-2 font-black text-[10px] uppercase tracking-widest">
 <AlertCircle size={16} /> Destination
 </div>
 <p className="text-xs text-blue-700 leading-relaxed font-medium">
 Starting a return will mark items as **Pending Ship-out**. Stock will be removed from your warehouse once you click **Complete** in the Return Registry.
 </p>
 </div>
 </div>
 </div>
 </div>
 )
}

export default function NewPurchaseReturnPage() {
 return (
 <Suspense fallback={<div className="p-20 text-center">Loading return wizard...</div>}>
 <CreatePurchaseReturnForm />
 </Suspense>
 )
}
