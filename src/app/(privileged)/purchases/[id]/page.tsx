// @ts-nocheck
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    fetchPurchaseOrder, submitPO, approvePO, rejectPO, sendToSupplier,
    cancelPO, completePO, revertToDraft, markInvoiced, recordSupplierDeclaration, receivePOLine
} from '@/app/actions/pos/purchases'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import Link from 'next/link'
import {
    ArrowLeft, Package, Building2, Calendar, Truck, FileText, BookOpen,
    Send, CheckCircle, XCircle, ClipboardCheck, Receipt, Flag, Loader2,
    ChevronDown, ChevronUp, MapPin, Phone, Mail, Hash, Clock, Ban,
    PackageCheck, Printer, AlertTriangle, Shield, RotateCcw, Eye
} from 'lucide-react'

type PO = {
    id: number
    po_number?: string
    supplier?: { id: number; name: string; phone?: string; email?: string; address?: string }
    supplier_name?: string
    supplier_display?: string
    status: string
    priority?: string
    order_date?: string
    expected_delivery?: string
    total_amount: number
    subtotal?: number
    tax_amount?: number
    discount_amount?: number
    notes?: string
    purchase_sub_type?: string
    created_at?: string
    updated_at?: string
    created_by?: string
    lines?: POLine[]
    supplier_declaration_number?: string
    supplier_declaration_date?: string
    invoice_number?: string
    invoice_date?: string
}

type POLine = {
    id: number
    product?: { id: number; name: string; sku?: string }
    product_name?: string
    quantity_ordered: number
    quantity_received?: number
    unit_price: number
    subtotal: number
    tax_rate?: number
    discount?: number
}

const STATUS_CONFIG: Record<string, { label: string; class: string; actions: string[] }> = {
    DRAFT: { label: 'Draft', class: 'bg-app-surface text-gray-600 bg-app-surface dark:text-gray-300', actions: ['submit', 'cancel'] },
    SUBMITTED: { label: 'Pending Approval', class: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', actions: ['approve', 'reject', 'revert_to_draft'] },
    APPROVED: { label: 'Approved', class: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', actions: ['send_to_supplier', 'revert_to_draft', 'cancel'] },
    REJECTED: { label: 'Rejected', class: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400', actions: ['revert_to_draft'] },
    ORDERED: { label: 'Ordered', class: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400', actions: ['receive', 'record_declaration', 'cancel'] },
    SENT: { label: 'Sent to Supplier', class: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400', actions: ['receive', 'record_declaration', 'cancel'] },
    CONFIRMED: { label: 'Supplier Confirmed', class: 'bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400', actions: ['receive', 'record_declaration', 'cancel'] },
    IN_TRANSIT: { label: 'In Transit', class: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', actions: ['receive', 'record_declaration'] },
    PARTIALLY_RECEIVED: { label: 'Partially Received', class: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400', actions: ['receive', 'mark_invoiced', 'complete'] },
    RECEIVED: { label: 'Fully Received', class: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400', actions: ['mark_invoiced', 'complete'] },
    INVOICED: { label: 'Invoiced', class: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', actions: ['complete'] },
    COMPLETED: { label: 'Completed', class: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', actions: [] },
    CANCELLED: { label: 'Cancelled', class: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400', actions: ['revert_to_draft'] },
}

const PRIORITY_BADGE: Record<string, string> = {
    LOW: 'bg-app-surface theme-text-muted',
    NORMAL: 'bg-blue-50 text-blue-500',
    HIGH: 'bg-amber-50 text-amber-500',
    URGENT: 'bg-rose-50 text-rose-500',
}

export default function PurchaseOrderDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [po, setPo] = useState<PO | null>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showReceiveDialog, setShowReceiveDialog] = useState(false)
    const [showDeclarationDialog, setShowDeclarationDialog] = useState(false)
    const [showInvoiceDialog, setShowInvoiceDialog] = useState(false)
    const [showRejectDialog, setShowRejectDialog] = useState(false)
    const [rejectReason, setRejectReason] = useState('')
    const [expandedSections, setExpandedSections] = useState({ lines: true, supplier: false, timeline: false })

    // Receive dialog state
    const [receiveLineId, setReceiveLineId] = useState<number | null>(null)
    const [receiveQty, setReceiveQty] = useState('')

    // Declaration dialog state
    const [declNumber, setDeclNumber] = useState('')
    const [declDate, setDeclDate] = useState('')

    // Invoice dialog state
    const [invNumber, setInvNumber] = useState('')
    const [invDate, setInvDate] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchPurchaseOrder(params.id as string)
            setPo(data)
        } catch { toast.error('Failed to load purchase order') }
        setLoading(false)
    }, [params.id])

    useEffect(() => { load() }, [load])

    const toggleSection = (key: keyof typeof expandedSections) =>
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }))

    async function handleAction(action: string) {
        if (!po) return
        setActionLoading(action)
        try {
            switch (action) {
                case 'submit': await submitPO(po.id); break
                case 'approve': await approvePO(po.id); break
                case 'send_to_supplier': await sendToSupplier(po.id); break
                case 'cancel': await cancelPO(po.id); break
                case 'complete': await completePO(po.id); break
                case 'revert_to_draft': await revertToDraft(po.id); break
                default: break
            }
            toast.success(`PO ${action.replace('_', ' ')} successful`)
            await load()
        } catch (e: any) {
            toast.error(e?.message || `Failed to ${action.replace('_', ' ')}`)
        }
        setActionLoading(null)
    }

    async function handleReject() {
        if (!po) return
        setActionLoading('reject')
        try {
            await rejectPO(po.id, rejectReason)
            toast.success('PO rejected')
            setShowRejectDialog(false)
            setRejectReason('')
            await load()
        } catch (e: any) { toast.error(e?.message || 'Failed to reject') }
        setActionLoading(null)
    }

    async function handleReceiveLine() {
        if (!po || !receiveLineId) return
        setActionLoading('receive')
        try {
            await receivePOLine(po.id, { line_id: receiveLineId, quantity_received: Number(receiveQty) })
            toast.success('Line received')
            setShowReceiveDialog(false)
            setReceiveLineId(null)
            setReceiveQty('')
            await load()
        } catch (e: any) { toast.error(e?.message || 'Failed to receive') }
        setActionLoading(null)
    }

    async function handleRecordDeclaration() {
        if (!po) return
        setActionLoading('record_declaration')
        try {
            await recordSupplierDeclaration(po.id, { declaration_number: declNumber, declaration_date: declDate })
            toast.success('Supplier declaration recorded')
            setShowDeclarationDialog(false)
            setDeclNumber('')
            setDeclDate('')
            await load()
        } catch (e: any) { toast.error(e?.message || 'Failed to record declaration') }
        setActionLoading(null)
    }

    async function handleMarkInvoiced() {
        if (!po) return
        setActionLoading('mark_invoiced')
        try {
            await markInvoiced(po.id, { invoice_number: invNumber, invoice_date: invDate })
            toast.success('PO marked as invoiced')
            setShowInvoiceDialog(false)
            setInvNumber('')
            setInvDate('')
            await load()
        } catch (e: any) { toast.error(e?.message || 'Failed to mark invoiced') }
        setActionLoading(null)
    }

    const status = po ? STATUS_CONFIG[po.status] || { label: po.status, class: 'bg-app-surface theme-text-muted', actions: [] } : null
    const availableActions = status?.actions || []

    if (loading) {
        return (
            <main className="layout-container-padding max-w-[1200px] mx-auto py-10">
                <div className="flex flex-col items-center gap-4 py-20">
                    <Loader2 size={32} className="animate-spin theme-text-muted" />
                    <p className="text-sm theme-text-muted font-medium">Loading purchase order...</p>
                </div>
            </main>
        )
    }

    if (!po) {
        return (
            <main className="layout-container-padding max-w-[1200px] mx-auto py-10">
                <Card className="border shadow-sm">
                    <CardContent className="p-12 text-center">
                        <XCircle size={48} className="mx-auto text-rose-400 mb-4" />
                        <h2 className="text-xl font-bold theme-text mb-2">Purchase Order Not Found</h2>
                        <p className="theme-text-muted text-sm mb-6">The requested PO could not be loaded.</p>
                        <Button variant="outline" onClick={() => router.push('/purchases')}>
                            <ArrowLeft size={14} className="mr-2" /> Back to Purchases
                        </Button>
                    </CardContent>
                </Card>
            </main>
        )
    }

    const totalReceived = po.lines?.reduce((s, l) => s + Number(l.quantity_received || 0), 0) || 0
    const totalOrdered = po.lines?.reduce((s, l) => s + Number(l.quantity_ordered || 0), 0) || 0
    const receivePct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1200px] mx-auto space-y-[var(--layout-section-spacing)]">

                {/* ── Back Link ── */}
                <Link href="/purchases" className="inline-flex items-center gap-2 text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px] md:min-h-[auto]">
                    <ArrowLeft size={16} /> Back to Procurement Center
                </Link>

                {/* ── Main Header Card ── */}
                <Card className="border shadow-sm overflow-hidden">
                    <CardHeader className="pb-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 flex-wrap mb-2">
                                    <CardTitle className="text-2xl md:text-3xl font-black theme-text">
                                        {po.po_number || `PO-${po.id}`}
                                    </CardTitle>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${status?.class}`}>
                                        {status?.label}
                                    </span>
                                    {po.priority && (
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${PRIORITY_BADGE[po.priority] || ''}`}>
                                            {po.priority}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-sm theme-text-muted flex-wrap">
                                    <span className="flex items-center gap-1.5"><Building2 size={14} />{po.supplier?.name || po.supplier_name || po.supplier_display || '—'}</span>
                                    {po.order_date && <span className="flex items-center gap-1.5"><Calendar size={14} />Ordered: {po.order_date}</span>}
                                    {po.expected_delivery && <span className="flex items-center gap-1.5"><Truck size={14} />ETA: {po.expected_delivery}</span>}
                                </div>
                            </div>

                            <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                                <div className="text-3xl md:text-4xl font-black theme-text tracking-tight">
                                    {Number(po.total_amount || 0).toLocaleString()}
                                </div>
                                {(po.subtotal || po.tax_amount || po.discount_amount) && (
                                    <div className="text-xs theme-text-muted space-y-0.5 text-right">
                                        {po.subtotal && <div>Subtotal: {Number(po.subtotal).toLocaleString()}</div>}
                                        {po.tax_amount && <div>Tax: {Number(po.tax_amount).toLocaleString()}</div>}
                                        {po.discount_amount && <div>Discount: -{Number(po.discount_amount).toLocaleString()}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardHeader>

                    {/* ── Workflow Actions Bar ── */}
                    {availableActions.length > 0 && (
                        <div className="px-[var(--layout-container-padding)] pb-4 border-t border-app-border pt-4 mt-2 flex flex-wrap gap-2 items-center" role="toolbar" aria-label="Purchase order actions">
                            {availableActions.includes('submit') && (
                                <Button size="sm" onClick={() => handleAction('submit')} disabled={!!actionLoading}
                                    className="min-h-[44px] md:min-h-[36px] bg-blue-500 hover:bg-blue-600 text-white font-bold px-4">
                                    {actionLoading === 'submit' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                                    Submit for Approval
                                </Button>
                            )}
                            {availableActions.includes('approve') && (
                                <Button size="sm" onClick={() => handleAction('approve')} disabled={!!actionLoading}
                                    className="min-h-[44px] md:min-h-[36px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-4">
                                    {actionLoading === 'approve' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <CheckCircle size={16} className="mr-2" />}
                                    Approve Order
                                </Button>
                            )}
                            {availableActions.includes('reject') && (
                                <Button size="sm" variant="destructive" onClick={() => setShowRejectDialog(true)} disabled={!!actionLoading}
                                    className="min-h-[44px] md:min-h-[36px] font-bold px-4">
                                    <XCircle size={16} className="mr-2" /> Reject
                                </Button>
                            )}
                            {availableActions.includes('send_to_supplier') && (
                                <Button size="sm" onClick={() => handleAction('send_to_supplier')} disabled={!!actionLoading}
                                    className="min-h-[44px] md:min-h-[36px] bg-cyan-500 hover:bg-cyan-600 text-white font-bold px-4">
                                    {actionLoading === 'send_to_supplier' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Send size={16} className="mr-2" />}
                                    Send to Supplier
                                </Button>
                            )}

                            {/* Operational Actions */}
                            {!po.is_legacy && (
                                <>
                                    {availableActions.includes('receive') && (
                                        <Button size="sm" onClick={() => setShowReceiveDialog(true)} disabled={!!actionLoading}
                                            className="min-h-[44px] md:min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 ml-auto">
                                            <PackageCheck size={16} className="mr-2" /> Receive Goods
                                        </Button>
                                    )}
                                    {availableActions.includes('record_declaration') && (
                                        <Button size="sm" variant="outline" onClick={() => setShowDeclarationDialog(true)} disabled={!!actionLoading}
                                            className="min-h-[44px] md:min-h-[36px] font-bold px-4 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100">
                                            <Shield size={16} className="mr-2" /> Supplier Declaration
                                        </Button>
                                    )}
                                    {availableActions.includes('mark_invoiced') && (
                                        <Button size="sm" onClick={() => setShowInvoiceDialog(true)} disabled={!!actionLoading}
                                            className="min-h-[44px] md:min-h-[36px] bg-purple-600 hover:bg-purple-700 text-white font-bold px-4">
                                            <Receipt size={16} className="mr-2" /> Log Invoice
                                        </Button>
                                    )}
                                </>
                            )}

                            {/* Complete and Cancel actions */}
                            {availableActions.includes('complete') && (
                                <Button size="sm" onClick={() => handleAction('complete')} disabled={!!actionLoading}
                                    className="min-h-[44px] md:min-h-[36px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4">
                                    {actionLoading === 'complete' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Flag size={16} className="mr-2" />}
                                    Complete PO
                                </Button>
                            )}
                            {availableActions.includes('revert_to_draft') && (
                                <Button size="sm" variant="outline" onClick={() => handleAction('revert_to_draft')} disabled={!!actionLoading}
                                    className="min-h-[44px] md:min-h-[36px] font-bold px-4 border-amber-300 text-amber-600 hover:bg-amber-50">
                                    {actionLoading === 'revert_to_draft' ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RotateCcw size={16} className="mr-2" />}
                                    Revert to Draft
                                </Button>
                            )}
                            {availableActions.includes('cancel') && (
                                <Button size="sm" variant="ghost" onClick={() => handleAction('cancel')} disabled={!!actionLoading}
                                    className="min-h-[44px] md:min-h-[36px] text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-bold px-4">
                                    <Ban size={16} className="mr-2" /> Cancel
                                </Button>
                            )}
                        </div>
                    )}
                </Card>

                {/* ── Receipt Progress ── */}
                {totalOrdered > 0 && (
                    <Card className="border shadow-sm">
                        <CardContent className="p-4 md:p-5">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-black theme-text-muted uppercase tracking-wider">Receiving Progress</span>
                                <span className="text-sm font-black theme-text">{receivePct}%</span>
                            </div>
                            <div className="h-3 rounded-full overflow-hidden bg-app-surface bg-app-surface">
                                <div className={`h-full rounded-full transition-all duration-700 ${receivePct >= 100 ? 'bg-emerald-500' : receivePct > 0 ? 'bg-blue-500' : 'bg-gray-200'}`}
                                    style={{ width: `${receivePct}%` }} />
                            </div>
                            <p className="text-xs theme-text-muted mt-2">
                                {totalReceived} of {totalOrdered} items received
                            </p>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-[var(--layout-element-gap)]">
                    {/* ── Order Lines (2/3 width on desktop) ── */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="border shadow-sm">
                            <CardHeader className="cursor-pointer" onClick={() => toggleSection('lines')}>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider theme-text-muted flex items-center gap-2">
                                        <Package size={16} className="text-blue-500" />
                                        Order Lines ({po.lines?.length || 0})
                                    </CardTitle>
                                    {expandedSections.lines ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </CardHeader>
                            {expandedSections.lines && (
                                <CardContent className="space-y-2">
                                    {/* Desktop Table */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b text-[10px] font-black uppercase tracking-wider theme-text-muted">
                                                    <th className="text-left py-3 px-2">#</th>
                                                    <th className="text-left py-3 px-2">Product</th>
                                                    <th className="text-right py-3 px-2">Qty</th>
                                                    <th className="text-right py-3 px-2">Unit Price</th>
                                                    <th className="text-right py-3 px-2">Received</th>
                                                    <th className="text-right py-3 px-2">Subtotal</th>
                                                    <th className="text-right py-3 px-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {po.lines?.map((line, i) => {
                                                    const received = Number(line.quantity_received || 0)
                                                    const ordered = Number(line.quantity_ordered || 0)
                                                    const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
                                                    const isComplete = pct >= 100
                                                    return (
                                                        <tr key={line.id} className="border-b last:border-0 hover:bg-app-surface-hover dark:hover:bg-gray-900/20">
                                                            <td className="py-3 px-2 theme-text-muted">{i + 1}</td>
                                                            <td className="py-3 px-2">
                                                                <div className="font-bold theme-text">{line.product?.name || line.product_name || '—'}</div>
                                                                {line.product?.sku && <div className="text-xs theme-text-muted font-mono">{line.product.sku}</div>}
                                                            </td>
                                                            <td className="py-3 px-2 text-right theme-text font-bold">{ordered}</td>
                                                            <td className="py-3 px-2 text-right theme-text-muted">{Number(line.unit_price || 0).toLocaleString()}</td>
                                                            <td className="py-3 px-2 text-right">
                                                                <span className={`font-bold ${isComplete ? 'text-emerald-500' : received > 0 ? 'text-amber-500' : 'theme-text-muted'}`}>
                                                                    {received}/{ordered}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-2 text-right font-black theme-text">{Number(line.subtotal || 0).toLocaleString()}</td>
                                                            <td className="py-3 px-2 text-right">
                                                                {!isComplete && availableActions.includes('receive') && (
                                                                    <Button size="sm" variant="ghost" className="h-8 text-xs text-emerald-500 hover:text-emerald-600"
                                                                        onClick={() => { setReceiveLineId(line.id); setReceiveQty(''); setShowReceiveDialog(true) }}>
                                                                        <PackageCheck size={12} className="mr-1" /> Receive
                                                                    </Button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Mobile Cards */}
                                    <div className="md:hidden space-y-2">
                                        {po.lines?.map((line, i) => {
                                            const received = Number(line.quantity_received || 0)
                                            const ordered = Number(line.quantity_ordered || 0)
                                            const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
                                            const isComplete = pct >= 100
                                            return (
                                                <div key={line.id} className="p-3 rounded-xl theme-surface" style={{ border: '1px solid var(--theme-border)' }}>
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                                            <Package size={14} className="text-blue-500" />
                                                        </div>
                                                        <div className="flex-1 min-w-0 space-y-1.5">
                                                            <div className="font-bold theme-text text-sm">{line.product?.name || line.product_name || '—'}</div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="theme-text-muted">{ordered} × {Number(line.unit_price || 0).toLocaleString()}</span>
                                                                <span className="font-black theme-text">{Number(line.subtotal || 0).toLocaleString()}</span>
                                                            </div>
                                                            {ordered > 0 && (
                                                                <div>
                                                                    <div className="flex justify-between text-[10px] font-bold theme-text-muted mb-1">
                                                                        <span>Received: {received}/{ordered}</span>
                                                                        <span>{pct}%</span>
                                                                    </div>
                                                                    <div className="h-1.5 rounded-full overflow-hidden bg-app-surface bg-app-surface">
                                                                        <div className={`h-full rounded-full ${isComplete ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-gray-200'}`} style={{ width: `${pct}%` }} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {!isComplete && availableActions.includes('receive') && (
                                                                <Button size="sm" variant="outline" className="w-full mt-2 min-h-[44px] text-emerald-500"
                                                                    onClick={() => { setReceiveLineId(line.id); setReceiveQty(''); setShowReceiveDialog(true) }}>
                                                                    <PackageCheck size={12} className="mr-1" /> Receive
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {(!po.lines || po.lines.length === 0) && (
                                        <div className="text-center py-8 theme-text-muted text-sm">No order lines</div>
                                    )}
                                </CardContent>
                            )}
                        </Card>
                    </div>

                    {/* ── Sidebar (1/3 width on desktop) ── */}
                    <div className="space-y-4">
                        {/* Supplier Info */}
                        <Card className="border shadow-sm">
                            <CardHeader className="cursor-pointer pb-3" onClick={() => toggleSection('supplier')}>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-black uppercase tracking-wider theme-text-muted flex items-center gap-2">
                                        <Building2 size={16} className="text-indigo-500" /> Supplier
                                    </CardTitle>
                                    {expandedSections.supplier ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                            </CardHeader>
                            <CardContent className={expandedSections.supplier ? '' : 'pb-4'}>
                                <p className="font-bold theme-text">{po.supplier?.name || po.supplier_name || po.supplier_display || '—'}</p>
                                {expandedSections.supplier && po.supplier && (
                                    <div className="mt-3 space-y-2 text-sm theme-text-muted">
                                        {po.supplier.phone && <div className="flex items-center gap-2"><Phone size={12} />{po.supplier.phone}</div>}
                                        {po.supplier.email && <div className="flex items-center gap-2"><Mail size={12} />{po.supplier.email}</div>}
                                        {po.supplier.address && <div className="flex items-center gap-2"><MapPin size={12} />{po.supplier.address}</div>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Metadata */}
                        <Card className="border shadow-sm">
                            <CardContent className="p-4 space-y-3">
                                <h3 className="text-xs font-black theme-text-muted uppercase tracking-wider mb-2">Details</h3>
                                {po.purchase_sub_type && (
                                    <div className="flex justify-between text-sm"><span className="theme-text-muted">Type</span><span className="font-bold theme-text">{po.purchase_sub_type}</span></div>
                                )}
                                {po.created_at && (
                                    <div className="flex justify-between text-sm"><span className="theme-text-muted">Created</span><span className="font-bold theme-text">{new Date(po.created_at).toLocaleDateString('fr-FR')}</span></div>
                                )}
                                {po.updated_at && (
                                    <div className="flex justify-between text-sm"><span className="theme-text-muted">Updated</span><span className="font-bold theme-text">{new Date(po.updated_at).toLocaleDateString('fr-FR')}</span></div>
                                )}
                                {po.supplier_declaration_number && (
                                    <div className="flex justify-between text-sm"><span className="theme-text-muted">Declaration #</span><span className="font-bold theme-text">{po.supplier_declaration_number}</span></div>
                                )}
                                {po.invoice_number && (
                                    <div className="flex justify-between text-sm"><span className="theme-text-muted">Invoice #</span><span className="font-bold theme-text">{po.invoice_number}</span></div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Notes */}
                        {po.notes && (
                            <Card className="border shadow-sm">
                                <CardContent className="p-4">
                                    <h3 className="text-xs font-black theme-text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <FileText size={12} /> Notes
                                    </h3>
                                    <p className="text-sm theme-text-muted leading-relaxed">{po.notes}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Quick Links */}
                        <Card className="border shadow-sm">
                            <CardContent className="p-4">
                                <h3 className="text-xs font-black theme-text-muted uppercase tracking-wider mb-3">Quick Links</h3>
                                <div className="flex flex-wrap gap-3">
                                    <Link href="/purchases/receipts" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px]" style={{ border: '1px solid var(--theme-border)' }}>
                                        <PackageCheck size={14} /> Goods Receipts
                                    </Link>
                                    <Link href="/purchases/returns/new" className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold theme-text-muted hover:theme-text transition-colors min-h-[44px]" style={{ border: '1px solid var(--theme-border)' }}>
                                        <RotateCcw size={14} /> Create Return
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* ── Dialogs ── */}

            {/* Receive Dialog */}
            {showReceiveDialog && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowReceiveDialog(false)}>
                    <div className="w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black theme-text mb-4 flex items-center gap-2"><PackageCheck size={20} className="text-emerald-500" /> Receive Goods</h3>
                        <div className="space-y-4">
                            {!receiveLineId ? (
                                <div className="space-y-2">
                                    <p className="text-sm theme-text-muted">Select a line to receive:</p>
                                    {po?.lines?.filter(l => (Number(l.quantity_received || 0)) < Number(l.quantity_ordered)).map(line => (
                                        <button key={line.id} onClick={() => setReceiveLineId(line.id)}
                                            className="w-full text-left p-3 rounded-xl theme-surface flex justify-between items-center min-h-[52px]"
                                            style={{ border: '1px solid var(--theme-border)' }}>
                                            <span className="font-bold theme-text text-sm">{line.product?.name || line.product_name || '—'}</span>
                                            <span className="text-xs theme-text-muted">{Number(line.quantity_received || 0)}/{line.quantity_ordered}</span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Label className="text-sm font-bold">Quantity Received</Label>
                                    <Input type="number" value={receiveQty} onChange={e => setReceiveQty(e.target.value)} placeholder="Enter quantity" className="min-h-[48px]" autoFocus />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => { setShowReceiveDialog(false); setReceiveLineId(null) }}>Cancel</Button>
                            {receiveLineId && (
                                <Button className="flex-1 min-h-[48px] bg-emerald-500 hover:bg-emerald-600 text-white" onClick={handleReceiveLine} disabled={!receiveQty || actionLoading === 'receive'}>
                                    {actionLoading === 'receive' ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Confirm Receipt
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Dialog */}
            {showRejectDialog && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowRejectDialog(false)}>
                    <div className="w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black theme-text mb-4 flex items-center gap-2"><XCircle size={20} className="text-rose-500" /> Reject Purchase Order</h3>
                        <div className="space-y-3">
                            <Label className="text-sm font-bold">Reason for Rejection</Label>
                            <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter reason" className="min-h-[48px]" autoFocus />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
                            <Button variant="destructive" className="flex-1 min-h-[48px]" onClick={handleReject} disabled={actionLoading === 'reject'}>
                                {actionLoading === 'reject' ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Reject
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Declaration Dialog */}
            {showDeclarationDialog && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowDeclarationDialog(false)}>
                    <div className="w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black theme-text mb-4 flex items-center gap-2"><Shield size={20} className="text-indigo-500" /> Record Supplier Declaration</h3>
                        <div className="space-y-3">
                            <div><Label className="text-sm font-bold">Declaration Number</Label><Input value={declNumber} onChange={e => setDeclNumber(e.target.value)} placeholder="D-2026-xxxxx" className="mt-1 min-h-[48px]" /></div>
                            <div><Label className="text-sm font-bold">Declaration Date</Label><Input type="date" value={declDate} onChange={e => setDeclDate(e.target.value)} className="mt-1 min-h-[48px]" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => setShowDeclarationDialog(false)}>Cancel</Button>
                            <Button className="flex-1 min-h-[48px] bg-indigo-500 hover:bg-indigo-600 text-white" onClick={handleRecordDeclaration} disabled={!declNumber || actionLoading === 'record_declaration'}>
                                {actionLoading === 'record_declaration' ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Save
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Invoice Dialog */}
            {showInvoiceDialog && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setShowInvoiceDialog(false)}>
                    <div className="w-full md:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl md:rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-black theme-text mb-4 flex items-center gap-2"><Receipt size={20} className="text-purple-500" /> Mark as Invoiced</h3>
                        <div className="space-y-3">
                            <div><Label className="text-sm font-bold">Invoice Number</Label><Input value={invNumber} onChange={e => setInvNumber(e.target.value)} placeholder="INV-2026-xxxxx" className="mt-1 min-h-[48px]" /></div>
                            <div><Label className="text-sm font-bold">Invoice Date</Label><Input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} className="mt-1 min-h-[48px]" /></div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <Button variant="outline" className="flex-1 min-h-[48px]" onClick={() => setShowInvoiceDialog(false)}>Cancel</Button>
                            <Button className="flex-1 min-h-[48px] bg-purple-500 hover:bg-purple-600 text-white" onClick={handleMarkInvoiced} disabled={actionLoading === 'mark_invoiced'}>
                                {actionLoading === 'mark_invoiced' ? <Loader2 size={14} className="animate-spin mr-2" /> : null} Confirm
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}
