'use client'

import { useState, useEffect, Suspense } from "react"
import type { SalesOrder } from '@/types/erp'
import { useSearchParams, useRouter } from "next/navigation"
import { erpFetch } from "@/lib/erp-api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ArrowLeft, RotateCcw, AlertCircle, ShoppingBag, CheckCircle2 } from "lucide-react"
import Link from "next/link"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

function CreateReturnForm() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const orderId = searchParams.get('order_id')

    const [order, setOrder] = useState<SalesOrder | null>(null)
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
            const data = await erpFetch(`orders/${orderId}/`)
            setOrder(data)
            // Initialize return quantities to 0
            const initialQtys: Record<number, number> = {}
            data.lines.forEach((l: Record<string, any>) => {
                initialQtys[l.id] = 0
            })
            setReturnItems(initialQtys)
        } catch {
            toast.error("Failed to load order details")
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
                    product_id: line?.product,
                    quantity: qty,
                    unit_price: line?.unit_price,
                    reason: reason || "Customer return"
                }
            })

        if (lines.length === 0) {
            toast.error("Please select at least one item to return")
            return
        }

        setSubmitting(true)
        try {
            await erpFetch('sales-returns/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    original_order: order?.id,
                    reason: reason,
                    lines: lines
                })
            })
            toast.success("Return request created successfully")
            router.push('/sales/returns')
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)) || "Failed to create return")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return <div className="p-10 space-y-6"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>
    if (!order) return <div className="p-20 text-center"><AlertCircle className="mx-auto mb-4 text-app-faint" size={48} /><p>Order not found</p></div>

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex items-center justify-between">
                <div>
                    <Link href={`/sales/${orderId}`} className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-error mb-4 transition-all">
                        <ArrowLeft size={14} /> Back to Sale Detail
                    </Link>
                    <h1 className="text-4xl font-black text-app-foreground tracking-tighter flex items-center gap-3">
                        <RotateCcw size={32} className="text-app-error" />
                        Return Items from <span className="text-app-error">{order.ref_code || `#${orderId}`}</span>
                    </h1>
                </div>
            </header>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden">
                        <div className="p-6 bg-app-surface border-b border-app-border font-bold text-[10px] uppercase tracking-widest text-app-muted-foreground">
                            Select Items & Quantities
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="text-center">Sold</TableHead>
                                    <TableHead className="text-center w-32">Return Qty</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order?.lines?.map((line: Record<string, any>) => (
                                    <TableRow key={line.id}>
                                        <TableCell>
                                            <div className="font-bold text-app-foreground">{line.product_name}</div>
                                            <div className="text-[10px] text-app-muted-foreground uppercase font-mono">Original Line ID: {line.id}</div>
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-app-muted-foreground">{line.quantity}</TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={line.quantity}
                                                className="text-center font-black rounded-xl border-app-border"
                                                value={returnItems[line.id] || 0}
                                                onChange={(e) => handleQtyChange(line.id, parseInt(e.target.value), line.quantity)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-app-foreground">{fmt(parseFloat(line.unit_price))}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>

                    <Card className="border-none shadow-xl rounded-[2rem] p-6 space-y-4">
                        <h3 className="font-bold text-xs uppercase tracking-widest text-app-muted-foreground">Return Reason</h3>
                        <textarea
                            className="w-full h-32 p-4 rounded-2xl border border-app-border bg-app-surface/50 focus:ring-2 focus:ring-rose-200 focus:border-app-error transition-all outline-none text-sm"
                            placeholder="Why is the customer returning these items? (e.g. Defective, Wrong Item, Customer Choice)"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-app-bg text-white p-8 rounded-[2.5rem] shadow-2xl border-none">
                        <div className="space-y-6">
                            <div>
                                <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-4">Refund Summary</div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-800">
                                    <span className="text-sm text-app-muted-foreground">Items to Return</span>
                                    <span className="font-bold">{Object.values(returnItems).filter(q => q > 0).length} Lines</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-gray-800">
                                    <span className="text-sm text-app-muted-foreground">Total Calculation</span>
                                    <span className="font-mono text-xs">{fmt(calculateTotals())}</span>
                                </div>
                            </div>

                            <div className="pt-4">
                                <div className="text-[10px] font-black text-app-error uppercase tracking-widest mb-1 text-right">Refund Total</div>
                                <div className="text-5xl font-black text-white text-right tracking-tighter">
                                    {fmt(calculateTotals())}
                                </div>
                            </div>

                            <Button
                                className="w-full h-16 rounded-2xl bg-app-error hover:bg-app-error text-white font-black text-lg shadow-lg shadow-rose-900/20 flex items-center gap-3 transition-all active:scale-[0.98]"
                                onClick={handleSubmit}
                                disabled={submitting || calculateTotals() === 0}
                            >
                                {submitting ? "Processing..." : (
                                    <>
                                        <CheckCircle2 size={24} />
                                        Confirm Return
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>

                    <div className="p-6 bg-app-warning-bg rounded-[2rem] border border-amber-100">
                        <div className="flex items-center gap-2 text-app-warning mb-2 font-black text-[10px] uppercase tracking-widest">
                            <AlertCircle size={16} /> Attention
                        </div>
                        <p className="text-xs text-app-warning leading-relaxed font-medium">
                            Confirmed returns will be moved to **Pending Review**. Stock will only be restored once the return is approved.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function NewSalesReturnPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center">Loading return wizard...</div>}>
            <CreateReturnForm />
        </Suspense>
    )
}
