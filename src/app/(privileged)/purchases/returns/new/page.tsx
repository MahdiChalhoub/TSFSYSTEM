// @ts-nocheck
'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { erpFetch } from "@/lib/erp-api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { ArrowLeft, Truck, AlertCircle, CheckCircle, Package, Loader2 } from "lucide-react"
import Link from "next/link"

function CreatePurchaseReturnForm() {
    const { fmt } = useCurrency()
    const searchParams = useSearchParams()
    const router = useRouter()
    const orderId = searchParams.get('order_id')

    const [order, setOrder] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [returnItems, setReturnItems] = useState<Record<number, number>>({})
    const [reason, setReason] = useState("")
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        if (orderId) loadOrder()
        else { toast.error("No Order ID provided"); setLoading(false) }
    }, [orderId])

    async function loadOrder() {
        try {
            const data = await erpFetch(`purchase-orders/${orderId}/`)
            setOrder(data)
            const initial: Record<number, number> = {}
            data.lines?.forEach((l: any) => { initial[l.id] = 0 })
            setReturnItems(initial)
        } catch { toast.error("Failed to load purchase details") }
        setLoading(false)
    }

    const handleQtyChange = (lineId: number, qty: number, max: number) => {
        setReturnItems(prev => ({ ...prev, [lineId]: Math.max(0, Math.min(qty, max)) }))
    }

    const total = order?.lines?.reduce((sum: number, l: any) =>
        sum + (returnItems[l.id] || 0) * parseFloat(l.unit_price || 0), 0
    ) || 0

    const handleSubmit = async () => {
        const lines = Object.entries(returnItems)
            .filter(([_, qty]) => qty > 0)
            .map(([lineId, qty]) => {
                const l = order?.lines?.find((x: any) => x.id === Number(lineId))
                return { product_id: l?.product || l?.product_id, quantity: qty, unit_price: l?.unit_price }
            })
        if (!lines.length) { toast.error("Select at least one item"); return }

        setSubmitting(true)
        try {
            await erpFetch('purchase-returns/', {
                method: 'POST',
                body: JSON.stringify({ original_order: order?.id, reason, lines })
            })
            toast.success("Purchase return created")
            router.push('/purchases/returns')
        } catch (e: any) { toast.error(e?.message || "Failed to create return") }
        setSubmitting(false)
    }

    if (loading) return (
        <main className="layout-container-padding max-w-4xl mx-auto py-10">
            <div className="flex flex-col items-center gap-4 py-20">
                <Loader2 size={32} className="animate-spin theme-text-muted" />
                <p className="text-sm theme-text-muted">Loading purchase order...</p>
            </div>
        </main>
    )

    if (!order) return (
        <main className="layout-container-padding max-w-4xl mx-auto py-10">
            <Card className="border shadow-sm">
                <CardContent className="p-12 text-center">
                    <AlertCircle size={48} className="mx-auto theme-text-muted mb-4 opacity-30" />
                    <p className="text-sm theme-text-muted">Purchase order not found</p>
                    <Link href="/purchases" className="text-blue-500 text-sm font-bold mt-2 inline-block hover:underline">← Back</Link>
                </CardContent>
            </Card>
        </main>
    )

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-5xl mx-auto space-y-[var(--layout-section-spacing)]">

                <Link href={`/purchases/${orderId}`} className="inline-flex items-center gap-2 text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px] md:min-h-[auto]">
                    <ArrowLeft size={16} /> Back to Purchase Detail
                </Link>

                <header className="flex items-center gap-3 md:gap-4">
                    <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shadow-sm">
                        <Truck size={24} className="text-orange-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight theme-text">
                            Return for <span className="text-orange-500">{order.ref_code || order.po_number || `#${orderId}`}</span>
                        </h1>
                        <p className="text-xs theme-text-muted mt-0.5">Select items and quantities to return to supplier</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-[var(--layout-element-gap)]">
                    {/* Lines */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="border shadow-sm">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs font-black uppercase tracking-wider theme-text-muted flex items-center gap-2">
                                    <Package size={14} className="text-orange-500" /> Select Items to Return
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {/* Desktop Table */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-[10px] font-black uppercase tracking-wider theme-text-muted">
                                                <th className="text-left py-3 px-2">Product</th>
                                                <th className="text-center py-3 px-2">Received</th>
                                                <th className="text-center py-3 px-2 w-32">Return Qty</th>
                                                <th className="text-right py-3 px-2">Unit Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {order.lines?.map((line: any) => (
                                                <tr key={line.id} className="border-b last:border-0">
                                                    <td className="py-3 px-2">
                                                        <div className="font-bold theme-text">{line.product_name || line.product?.name || '—'}</div>
                                                        {line.product?.sku && <div className="text-xs theme-text-muted font-mono">{line.product.sku}</div>}
                                                    </td>
                                                    <td className="py-3 px-2 text-center theme-text-muted font-bold">{line.qty_received || line.quantity_received || 0}</td>
                                                    <td className="py-3 px-2">
                                                        <Input type="number" min={0} max={line.qty_received || line.quantity_received || 0}
                                                            className="text-center font-black min-h-[44px] md:min-h-[36px]"
                                                            value={returnItems[line.id] || 0}
                                                            onChange={e => handleQtyChange(line.id, parseFloat(e.target.value) || 0, line.qty_received || line.quantity_received || 0)} />
                                                    </td>
                                                    <td className="py-3 px-2 text-right theme-text font-medium">{fmt(parseFloat(line.unit_price || 0))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Mobile Cards */}
                                <div className="md:hidden space-y-3">
                                    {order.lines?.map((line: any) => (
                                        <div key={line.id} className="p-3 rounded-xl theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                            <div className="font-bold theme-text text-sm mb-1">{line.product_name || line.product?.name || '—'}</div>
                                            <div className="flex justify-between text-xs theme-text-muted mb-2">
                                                <span>Received: {line.qty_received || line.quantity_received || 0}</span>
                                                <span>{fmt(parseFloat(line.unit_price || 0))} ea</span>
                                            </div>
                                            <Label className="text-xs font-bold mb-1 block">Return Qty</Label>
                                            <Input type="number" min={0} max={line.qty_received || line.quantity_received || 0}
                                                className="text-center font-black min-h-[48px]"
                                                value={returnItems[line.id] || 0}
                                                onChange={e => handleQtyChange(line.id, parseFloat(e.target.value) || 0, line.qty_received || line.quantity_received || 0)} />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border shadow-sm">
                            <CardContent className="p-4 md:p-5 space-y-3">
                                <Label className="text-xs font-black uppercase tracking-wider theme-text-muted">Return Reason</Label>
                                <textarea
                                    className="w-full h-24 p-3 rounded-xl text-sm theme-surface theme-text resize-none min-h-[96px]"
                                    style={{ border: '1px solid var(--theme-border)' }}
                                    placeholder="Reason for return, RMN number, or special instructions..."
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Summary Sidebar */}
                    <div className="space-y-4">
                        <Card className="border shadow-sm">
                            <CardContent className="p-5 space-y-4">
                                <h3 className="text-xs font-black theme-text-muted uppercase tracking-wider">Return Summary</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="theme-text-muted">Items to Return</span>
                                        <span className="font-bold theme-text">{Object.values(returnItems).filter(q => q > 0).length} lines</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="theme-text-muted">Total Qty</span>
                                        <span className="font-bold theme-text">{Object.values(returnItems).reduce((s, q) => s + q, 0)}</span>
                                    </div>
                                </div>
                                <div className="pt-4 border-t" style={{ borderColor: 'var(--theme-border)' }}>
                                    <p className="text-[10px] font-black theme-text-muted uppercase tracking-wider mb-1">Debit Value</p>
                                    <p className="text-3xl font-black text-orange-500 tracking-tight">{fmt(total)}</p>
                                </div>

                                <Button className="w-full min-h-[52px] bg-blue-500 hover:bg-blue-600 text-white font-bold text-sm"
                                    onClick={handleSubmit} disabled={submitting || total === 0}>
                                    {submitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                                    {submitting ? 'Processing...' : 'Create Return'}
                                </Button>
                            </CardContent>
                        </Card>

                        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-sm text-blue-600 dark:text-blue-400" style={{ border: '1px solid var(--theme-border)' }}>
                            <AlertCircle size={14} className="inline mr-1.5" />
                            Starting a return marks items as <strong>Pending Ship-out</strong>. Stock is removed when you click <strong>Complete</strong> in the Returns list.
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}

export default function NewPurchaseReturnPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center theme-text-muted">Loading return wizard...</div>}>
            <CreatePurchaseReturnForm />
        </Suspense>
    )
}
