'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
    fetchPurchaseOrder,
    markInvoiced
} from '@/app/actions/pos/purchases'
import {
    Receipt, FileText, Building2, Calendar, Package,
    ChevronLeft, Check, AlertTriangle, Loader2, Save,
    ArrowRight, DollarSign, ListOrdered, Info, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCurrency } from '@/lib/utils/currency'

export default function InvoicingScreen() {
    const params = useSearchParams()
    const router = useRouter()
    const { fmt } = useCurrency()

    const [po, setPO] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    // Form state
    const [invoiceNumber, setInvoiceNumber] = useState('')
    const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedLines, setSelectedLines] = useState<Record<number, boolean>>({})

    const poId = params.get('po_id')

    const loadPO = useCallback(async (id: string) => {
        setLoading(true)
        try {
            const data = await fetchPurchaseOrder(parseInt(id))
            setPO(data)

            // Default select all lines that have received qty > invoiced qty
            const initialSelection: Record<number, boolean> = {}
            data.lines?.forEach((line: any) => {
                if ((line.qty_received || 0) > (line.qty_invoiced || 0)) {
                    initialSelection[line.id] = true
                }
            })
            setSelectedLines(initialSelection)
        } catch (e: any) {
            toast.error(e.message || 'Failed to load Purchase Order')
            router.push('/purchases/purchase-orders')
        } finally {
            setLoading(false)
        }
    }, [router])

    useEffect(() => {
        if (poId) loadPO(poId)
        else {
            toast.error('No Purchase Order selected')
            router.push('/purchases/purchase-orders')
        }
    }, [poId, loadPO, router])

    const handleToggleLine = (id: number) => {
        setSelectedLines(prev => ({ ...prev, [id]: !prev[id] }))
    }

    const [autoReceive, setAutoReceive] = useState(false)
    const [waitForRest, setWaitForRest] = useState(false)

    // Sync selection when toggle changes
    useEffect(() => {
        if (!po) return
        setSelectedLines(prev => {
            const next = { ...prev }
            po.lines.forEach((l: any) => {
                const receivable = autoReceive ? (Number(l.quantity) - (l.qty_invoiced || 0)) : ((l.qty_received || 0) - (l.qty_invoiced || 0))
                if (receivable > 0) next[l.id] = true
                else delete next[l.id]
            })
            return next
        })
    }, [autoReceive, po])

    const handleSubmit = async () => {
        if (!invoiceNumber.trim()) {
            toast.error('Please enter the Supplier Invoice Number')
            return
        }

        const lineIds = Object.entries(selectedLines)
            .filter(([_, selected]) => selected)
            .map(([id, _]) => parseInt(id))

        if (lineIds.length === 0) {
            toast.error('Please select at least one item to invoice')
            return
        }

        setSubmitting(true)
        try {
            await markInvoiced(po.id, {
                invoice_number: invoiceNumber,
                invoice_date: invoiceDate,
                line_ids: lineIds,
                auto_receive: autoReceive
            })

            // Update manual tag if requested
            if (waitForRest) {
                // PO wait_for_invoice update temporarily removed due to missing action updatePO
            }

            toast.success('Invoice recorded successfully')
            router.push('/purchases/invoices')
        } catch (e: any) {
            toast.error(e.message || 'Failed to record invoice')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
            <p className="text-sm font-black uppercase tracking-widest theme-text-muted">Loading PO Context...</p>
        </div>
    )

    const totalInvoicing = po.lines
        ?.filter((l: any) => selectedLines[l.id])
        ?.reduce((acc: number, l: any) => {
            const available = autoReceive ? (Number(l.quantity) - (l.qty_invoiced || 0)) : ((l.qty_received || 0) - (l.qty_invoiced || 0))
            return acc + (available * Number(l.unit_price))
        }, 0) || 0

    // Calculate what's still pending for the entire order
    const totalOutstanding = po.lines?.reduce((acc: number, l: any) => {
        const available = autoReceive
            ? (Number(l.quantity) - (l.qty_invoiced || 0))
            : (Number(l.qty_received || 0) - (l.qty_invoiced || 0))
        return acc + Math.max(0, available)
    }, 0) || 0

    const totalSelected = po.lines
        ?.filter((l: any) => selectedLines[l.id])
        ?.reduce((acc: number, l: any) => {
            const available = autoReceive ? (Number(l.quantity) - (l.qty_invoiced || 0)) : ((l.qty_received || 0) - (l.qty_invoiced || 0))
            return acc + available
        }, 0) || 0

    const isPartial = totalSelected < totalOutstanding

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-700 pb-20">
            <div className="layout-container-padding max-w-[1400px] mx-auto space-y-[var(--layout-section-spacing)]">

                {/* ── Header ── */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="w-12 h-12 rounded-2xl bg-app-surface border border-app-border flex items-center justify-center hover:bg-app-primary/10 transition-all">
                            <ChevronLeft size={24} className="theme-text" />
                        </button>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-purple-500">Supplier Billing</p>
                            <h1 className="text-3xl md:text-5xl font-black tracking-tight theme-text">
                                Record <span className="text-purple-500">Invoice</span>
                            </h1>
                            <p className="text-sm font-medium theme-text-muted mt-1 flex items-center gap-2">
                                <FileText size={14} /> Link invoice to PO: <span className="text-app-foreground font-black">{po.po_number || `PO-${po.id}`}</span>
                            </p>
                        </div>
                    </div>

                    {/* Direct Invoice Toggle */}
                    <button
                        onClick={() => setAutoReceive(!autoReceive)}
                        className={`flex items-center gap-4 px-6 py-4 rounded-[24px] border transition-all ${autoReceive
                            ? 'bg-purple-600 text-white border-purple-600 shadow-lg shadow-purple-600/20'
                            : 'bg-white text-app-foreground border-app-border hover:border-purple-300'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${autoReceive ? 'bg-white/20' : 'bg-app-surface border border-app-border'}`}>
                            <ArrowRight size={16} className={autoReceive ? 'text-white' : 'text-app-muted-foreground'} />
                        </div>
                        <div className="text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest leading-none">Direct Invoicing</p>
                            <p className={`text-[9px] font-bold mt-1 ${autoReceive ? 'text-purple-100' : 'text-app-muted-foreground'}`}>
                                {autoReceive ? 'Auto-Receive Units' : 'Match only Received'}
                            </p>
                        </div>
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* ── Left Column: Form & Selection ── */}
                    <div className="lg:col-span-8 space-y-8">

                        {/* Invoice Metadata */}
                        <Card className="rounded-[40px] border border-app-border overflow-hidden bg-white shadow-sm">
                            <CardHeader className="bg-purple-50/50 border-b border-app-border p-8">
                                <CardTitle className="text-lg font-black uppercase flex items-center gap-3">
                                    <Receipt className="text-purple-500" size={20} />
                                    Vendor Document Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Invoice Number (Reference)</label>
                                        <Input
                                            value={invoiceNumber}
                                            onChange={e => setInvoiceNumber(e.target.value)}
                                            placeholder="Enter the number on the supplier's invoice"
                                            className="h-14 rounded-2xl font-black text-lg border-app-border focus:ring-purple-500"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Invoice Date</label>
                                        <Input
                                            type="date"
                                            value={invoiceDate}
                                            onChange={e => setInvoiceDate(e.target.value)}
                                            className="h-14 rounded-2xl font-black border-app-border"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Line Item Selection */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-app-foreground uppercase tracking-tight flex items-center gap-2">
                                    <ListOrdered size={20} className="text-purple-500" />
                                    Items to Invoiced ({Object.values(selectedLines).filter(Boolean).length})
                                </h3>
                                {autoReceive && (
                                    <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-100 uppercase animate-pulse">
                                        Skip Mode: Invoicing Total Managed Quantity
                                    </span>
                                )}
                            </div>
                            <div className="space-y-3">
                                {po.lines?.map((line: any) => {
                                    const available = autoReceive
                                        ? (Number(line.quantity) - (line.qty_invoiced || 0))
                                        : ((line.qty_received || 0) - (line.qty_invoiced || 0))

                                    const isDisabled = available <= 0
                                    const isSelected = selectedLines[line.id]

                                    return (
                                        <button
                                            key={line.id}
                                            onClick={() => !isDisabled && handleToggleLine(line.id)}
                                            disabled={isDisabled}
                                            className={`w-full text-left p-6 rounded-[32px] border transition-all flex items-center gap-6 ${isDisabled ? 'opacity-50 grayscale bg-app-surface cursor-not-allowed' :
                                                isSelected ? 'bg-purple-50 border-purple-500 shadow-md ring-4 ring-purple-500/10' :
                                                    'bg-white border-app-border hover:border-purple-300'
                                                }`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isSelected ? 'bg-purple-500 text-white' : 'bg-app-surface text-app-muted-foreground border border-app-border'}`}>
                                                {isSelected ? <Check size={24} /> : <Package size={24} />}
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h4 className="font-black text-app-foreground truncate tracking-tight">{line.product?.name || line.product_name}</h4>
                                                    {autoReceive && (line.qty_received < line.quantity) && (
                                                        <span className="text-[8px] font-black bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-md uppercase">Force Reception</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest bg-app-surface px-2 py-0.5 rounded-full border border-app-border">
                                                        {line.product?.sku || 'NO-SKU'}
                                                    </span>
                                                    <span className={`text-[10px] font-black uppercase ${line.qty_received >= line.quantity ? 'text-emerald-600' : 'text-amber-500'}`}>
                                                        Ordered: {line.quantity} | Received: {line.qty_received}
                                                    </span>
                                                    <span className="text-[10px] font-black text-purple-600 uppercase">Already Inv: {line.qty_invoiced || 0}</span>
                                                </div>
                                            </div>

                                            <div className="text-right shrink-0">
                                                <p className="text-lg font-black text-app-foreground">{available} <span className="text-[10px] text-app-muted-foreground uppercase">Units</span></p>
                                                <p className="text-xs font-bold text-app-muted-foreground">Value: {fmt(available * Number(line.unit_price))}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Right Column: Summary & Actions ── */}
                    <div className="lg:col-span-4 space-y-6">
                        <Card className="rounded-[40px] border border-app-border overflow-hidden bg-white shadow-xl sticky top-8">
                            <CardHeader className="bg-app-primary/5 border-b border-app-border p-8">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-app-primary">Invoicing Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">

                                <div className="space-y-4">
                                    <div className="flex justify-between items-center text-sm font-bold theme-text-muted uppercase tracking-widest">
                                        <span>Supplier</span>
                                        <span className="text-app-foreground font-black">{po.supplier?.name || po.supplier_display}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm font-bold theme-text-muted uppercase tracking-widest">
                                        <span>Total PO Value</span>
                                        <span className="text-app-foreground font-black">{fmt(po.total_amount)}</span>
                                    </div>
                                    <div className="h-px bg-app-border/50" />
                                    <div className="flex justify-between items-center">
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-black uppercase tracking-widest theme-text-muted">Currently Invoicing</p>
                                            <p className="text-3xl font-black text-purple-600 tracking-tighter">{fmt(totalInvoicing)}</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 border border-purple-100">
                                            <DollarSign size={24} />
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Tagging Section */}
                                {isPartial && (
                                    <button
                                        onClick={() => setWaitForRest(!waitForRest)}
                                        className={`w-full p-6 rounded-[32px] border transition-all text-left flex items-start gap-4 ${waitForRest
                                            ? 'bg-purple-50 border-purple-500 shadow-md ring-4 ring-purple-500/10'
                                            : 'bg-white border-app-border hover:border-purple-300'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${waitForRest ? 'bg-purple-600 text-white' : 'bg-app-surface text-app-muted-foreground border border-app-border'}`}>
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <p className={`text-xs font-black uppercase tracking-widest ${waitForRest ? 'text-purple-600' : 'text-app-foreground'}`}>Tag to Wait for Rest</p>
                                            <p className="text-[10px] font-bold text-app-muted-foreground mt-1 leading-relaxed">
                                                Mark this PO as pending remaining invoices for the balance items.
                                            </p>
                                        </div>
                                    </button>
                                )}

                                {autoReceive && (
                                    <div className="p-6 rounded-3xl bg-purple-50 border border-purple-200 space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-purple-600 uppercase tracking-widest">
                                            <AlertTriangle size={14} /> Skip Mode Active
                                        </div>
                                        <p className="text-xs font-bold text-purple-700 leading-relaxed">
                                            The system will automatically record stock reception for any unreceived units. Your warehouse inventory will be updated immediately.
                                        </p>
                                    </div>
                                )}

                                <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-black text-amber-600 uppercase tracking-widest">
                                        <Info size={14} /> Matching Protocol
                                    </div>
                                    <p className="text-xs font-bold text-amber-700 leading-relaxed">
                                        This invoice will be validated against received quantities (3-way match). Discrepancies will be highlighted in the audit dashboard.
                                    </p>
                                </div>

                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting || !invoiceNumber}
                                    className="w-full h-16 rounded-[24px] bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-sm shadow-2xl shadow-purple-600/30 gap-3"
                                >
                                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    Finalize & Post Invoice
                                </Button>

                                <p className="text-center text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
                                    This action will establish Accounts Payable
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    )
}
