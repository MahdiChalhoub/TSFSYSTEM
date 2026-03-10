// @ts-nocheck
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    fetchPurchaseOrder, submitPO, approvePO, rejectPO, sendToSupplier,
    cancelPO, completePO, revertToDraft, markInvoiced, recordSupplierDeclaration, receivePOLine, deletePO
} from '@/app/actions/pos/purchases'
import { searchProductsSimple } from '@/app/actions/inventory/product-actions'
import { toast } from 'sonner'
import Link from 'next/link'
import {
    ArrowLeft, Building2, Calendar, Truck, FileText, Send, CheckCircle, XCircle,
    Loader2, MapPin, Phone, Mail, Clock, Ban, PackageCheck, Shield, RotateCcw,
    Trash2, Receipt, Flag, Package, User, CreditCard, Hash, Eye, DollarSign
} from 'lucide-react'

/* ═══ Shared Styles ═══ */
const card = 'rounded-2xl border border-app-border bg-app-surface/80 backdrop-blur-sm shadow-sm'
const thCls = 'py-2.5 px-2 text-center border-l border-app-border/30 first:border-l-0'
const thText = 'text-[9px] font-black uppercase tracking-wider text-app-foreground/80'
const subText = 'text-[7px] font-semibold text-app-muted-foreground/60 mt-0.5 normal-case'

/* ═══ Status ═══ */
const STATUS: Record<string, { label: string; g: string; actions: string[] }> = {
    DRAFT: { label: 'Draft', g: 'from-gray-400 to-gray-500', actions: ['submit', 'cancel', 'delete'] },
    SUBMITTED: { label: 'Pending Approval', g: 'from-amber-400 to-amber-500', actions: ['approve', 'reject', 'revert_to_draft'] },
    APPROVED: { label: 'Approved', g: 'from-blue-400 to-blue-500', actions: ['send_to_supplier', 'revert_to_draft', 'cancel'] },
    REJECTED: { label: 'Rejected', g: 'from-rose-400 to-rose-500', actions: ['revert_to_draft'] },
    ORDERED: { label: 'Ordered', g: 'from-indigo-400 to-indigo-500', actions: ['receive', 'record_declaration', 'cancel'] },
    SENT: { label: 'Sent to Supplier', g: 'from-cyan-400 to-cyan-500', actions: ['receive', 'record_declaration', 'cancel'] },
    CONFIRMED: { label: 'Supplier Confirmed', g: 'from-teal-400 to-teal-500', actions: ['receive', 'record_declaration', 'cancel'] },
    IN_TRANSIT: { label: 'In Transit', g: 'from-orange-400 to-orange-500', actions: ['receive', 'record_declaration'] },
    PARTIALLY_RECEIVED: { label: 'Partially Received', g: 'from-amber-400 to-amber-500', actions: ['receive', 'mark_invoiced', 'complete'] },
    RECEIVED: { label: 'Fully Received', g: 'from-emerald-400 to-emerald-500', actions: ['mark_invoiced', 'complete'] },
    INVOICED: { label: 'Invoiced', g: 'from-purple-400 to-purple-500', actions: ['complete'] },
    COMPLETED: { label: 'Completed', g: 'from-emerald-500 to-emerald-600', actions: [] },
    CANCELLED: { label: 'Cancelled', g: 'from-rose-400 to-rose-500', actions: ['revert_to_draft'] },
}

/* ═══ Sub-Components ═══ */
function SafetyBadge({ tag }: { tag: string }) {
    const c: Record<string, { bg: string; t: string; l: string }> = {
        SAFE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', t: 'text-emerald-600', l: '✓ SAFE' },
        CAUTION: { bg: 'bg-amber-100 dark:bg-amber-900/30', t: 'text-amber-600', l: '⚠ CAUTION' },
        RISKY: { bg: 'bg-rose-100 dark:bg-rose-900/30', t: 'text-rose-600', l: '✕ RISKY' },
    }
    const cfg = c[tag] || c.SAFE
    return <span className={`${cfg.bg} ${cfg.t} text-[7px] font-black px-1.5 py-0.5 rounded-full`}>{cfg.l}</span>
}

function KpiChip({ icon, label, value, sub }: { icon: string; label: string; value: any; sub?: string }) {
    return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-app-background/60 border border-app-border/50">
            <span className="text-base">{icon}</span>
            <div>
                <div className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-wider">{label}</div>
                <div className="text-xs font-black text-app-foreground leading-tight">{value}</div>
                {sub && <div className="text-[9px] text-app-muted-foreground">{sub}</div>}
            </div>
        </div>
    )
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: any; icon?: any }) {
    if (!value) return null
    return (
        <div className="flex items-center justify-between py-2 border-b border-app-border/30 last:border-0">
            <span className="text-xs text-app-muted-foreground flex items-center gap-1.5">{Icon && <Icon size={12} />} {label}</span>
            <span className="text-xs font-bold text-app-foreground">{value}</span>
        </div>
    )
}

function Stat({ label, value, className = 'text-app-foreground' }: { label: string; value: any; className?: string }) {
    return (
        <div className="text-center p-1.5 rounded-lg bg-app-surface/50">
            <div className="text-app-muted-foreground/60 text-[6px] font-bold uppercase tracking-wider">{label}</div>
            <div className={`font-black text-[10px] ${className} truncate`}>{value}</div>
        </div>
    )
}

/* ═══ Main Page ═══ */
export default function PurchaseOrderDetailPage() {
    const params = useParams()
    const router = useRouter()
    const [po, setPo] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [act, setAct] = useState<string | null>(null)
    const [intel, setIntel] = useState<Record<number, any>>({}) // productId → analytics

    // Dialog states
    const [dlg, setDlg] = useState<string | null>(null)
    const [rejectReason, setRejectReason] = useState('')
    const [receiveLineId, setReceiveLineId] = useState<number | null>(null)
    const [receiveQty, setReceiveQty] = useState('')
    const [declNumber, setDeclNumber] = useState('')
    const [declDate, setDeclDate] = useState('')
    const [invNumber, setInvNumber] = useState('')
    const [invDate, setInvDate] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try { setPo(await fetchPurchaseOrder(params.id as string)) }
        catch { toast.error('Failed to load purchase order') }
        setLoading(false)
    }, [params.id])

    useEffect(() => { load() }, [load])

    // Fetch intelligence data for each product in the PO
    useEffect(() => {
        if (!po?.lines?.length) return
        const productIds = po.lines.map((l: any) => l.product?.id || l.product_id).filter(Boolean)
        if (!productIds.length) return
        // Fetch analytics for each product
        const fetchIntel = async () => {
            const map: Record<number, any> = {}
            for (const pid of productIds) {
                try {
                    const results = await searchProductsSimple(String(pid))
                    const match = results?.find?.((r: any) => r.id === pid) || results?.[0]
                    if (match) map[pid] = match
                } catch { /* skip */ }
            }
            setIntel(map)
        }
        fetchIntel()
    }, [po])

    async function handleAction(action: string) {
        if (!po) return
        if (action === 'delete') {
            if (!confirm('Permanently delete this PO?')) return
            setAct('delete')
            try { await deletePO(po.id); toast.success('Deleted'); router.push('/purchases/purchase-orders'); return }
            catch (e: any) { toast.error(e?.message || 'Failed') }
            setAct(null); return
        }
        setAct(action)
        try {
            const fn: any = { submit: submitPO, approve: approvePO, send_to_supplier: sendToSupplier, cancel: cancelPO, complete: completePO, revert_to_draft: revertToDraft }
            if (fn[action]) await fn[action](po.id)
            toast.success(`PO ${action.replace(/_/g, ' ')} done`)
            await load()
        } catch (e: any) { toast.error(e?.message || `Failed`) }
        setAct(null)
    }

    async function handleReject() {
        if (!po) return; setAct('reject')
        try { await rejectPO(po.id, rejectReason); toast.success('Rejected'); setDlg(null); setRejectReason(''); await load() }
        catch (e: any) { toast.error(e?.message || 'Failed') }
        setAct(null)
    }

    async function handleReceive() {
        if (!po || !receiveLineId) return; setAct('receive')
        try { await receivePOLine(po.id, { line_id: receiveLineId, quantity_received: Number(receiveQty) }); toast.success('Received'); setDlg(null); setReceiveLineId(null); setReceiveQty(''); await load() }
        catch (e: any) { toast.error(e?.message || 'Failed') }
        setAct(null)
    }

    async function handleDeclaration() {
        if (!po) return; setAct('record_declaration')
        try { await recordSupplierDeclaration(po.id, { declaration_number: declNumber, declaration_date: declDate }); toast.success('Declaration recorded'); setDlg(null); setDeclNumber(''); setDeclDate(''); await load() }
        catch (e: any) { toast.error(e?.message || 'Failed') }
        setAct(null)
    }

    async function handleInvoice() {
        if (!po) return; setAct('mark_invoiced')
        try { await markInvoiced(po.id, { invoice_number: invNumber, invoice_date: invDate }); toast.success('Invoiced'); setDlg(null); setInvNumber(''); setInvDate(''); await load() }
        catch (e: any) { toast.error(e?.message || 'Failed') }
        setAct(null)
    }

    const st = po ? STATUS[po.status] || { label: po.status, g: 'from-gray-400 to-gray-500', actions: [] } : null
    const actions = st?.actions || []

    if (loading) return <main className="layout-container-padding max-w-[1600px] mx-auto py-10"><div className="flex flex-col items-center gap-4 py-20"><Loader2 size={32} className="animate-spin text-app-muted-foreground" /><p className="text-sm text-app-muted-foreground">Loading...</p></div></main>
    if (!po) return <main className="layout-container-padding max-w-[1600px] mx-auto py-10"><div className={`${card} p-12 text-center`}><XCircle size={48} className="mx-auto text-rose-400 mb-4" /><h2 className="text-xl font-bold text-app-foreground mb-2">Not Found</h2><Link href="/purchases/purchase-orders" className="text-sm underline text-app-muted-foreground">← Back</Link></div></main>

    const lines = po.lines || []
    const totalReceived = lines.reduce((s: number, l: any) => s + Number(l.quantity_received || 0), 0)
    const totalOrdered = lines.reduce((s: number, l: any) => s + Number(l.quantity_ordered || 0), 0)
    const recPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0
    const supplier = po.supplier?.name || po.supplier_name || po.supplier_display || '—'

    const ActionBtn = ({ a, label, icon: I, cls }: any) => {
        if (!actions.includes(a)) return null
        const onClick = a === 'reject' ? () => setDlg('reject') : a === 'receive' ? () => setDlg('receive')
            : a === 'record_declaration' ? () => setDlg('declaration') : a === 'mark_invoiced' ? () => setDlg('invoice') : () => handleAction(a)
        return <button onClick={onClick} disabled={!!act} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${cls}`}>
            {act === a ? <Loader2 size={14} className="animate-spin" /> : <I size={14} />} {label}</button>
    }

    return (
        <main className="animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-5">
                <Link href="/purchases/purchase-orders" className="inline-flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-foreground transition-colors py-2"><ArrowLeft size={14} /> Back to Purchase Orders</Link>

                {/* ═══ HEADER ═══ */}
                <div className={`${card} overflow-hidden`}>
                    <div className={`h-1.5 bg-gradient-to-r ${st?.g}`} />
                    <div className="p-5 md:p-6">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-3 flex-wrap mb-1.5">
                                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">{po.po_number || `PO-${po.id}`}</h1>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r ${st?.g}`}>{st?.label}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-app-muted-foreground flex-wrap">
                                    <span className="flex items-center gap-1"><Building2 size={12} />{supplier}</span>
                                    {po.order_date && <span className="flex items-center gap-1"><Calendar size={12} />{po.order_date}</span>}
                                    {po.expected_delivery && <span className="flex items-center gap-1"><Truck size={12} />ETA: {po.expected_delivery}</span>}
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <div className="text-3xl md:text-4xl font-black tracking-tight text-app-foreground">{Number(po.total_amount || 0).toLocaleString()}</div>
                                {(po.subtotal || po.tax_amount) && <div className="text-[10px] text-app-muted-foreground mt-1 space-x-3">
                                    {po.subtotal && <span>Sub: {Number(po.subtotal).toLocaleString()}</span>}
                                    {po.tax_amount && <span>Tax: {Number(po.tax_amount).toLocaleString()}</span>}
                                </div>}
                            </div>
                        </div>
                        {actions.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-app-border/50">
                                <ActionBtn a="submit" label="Submit" icon={Send} cls="bg-blue-500 hover:bg-blue-600 text-white" />
                                <ActionBtn a="approve" label="Approve" icon={CheckCircle} cls="bg-emerald-500 hover:bg-emerald-600 text-white" />
                                <ActionBtn a="reject" label="Reject" icon={XCircle} cls="bg-rose-500 hover:bg-rose-600 text-white" />
                                <ActionBtn a="send_to_supplier" label="Send to Supplier" icon={Send} cls="bg-cyan-500 hover:bg-cyan-600 text-white" />
                                <ActionBtn a="receive" label="Receive" icon={PackageCheck} cls="bg-emerald-600 hover:bg-emerald-700 text-white" />
                                <ActionBtn a="record_declaration" label="Declaration" icon={Shield} cls="border border-emerald-300 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400" />
                                <ActionBtn a="mark_invoiced" label="Log Invoice" icon={Receipt} cls="bg-purple-500 hover:bg-purple-600 text-white" />
                                <ActionBtn a="complete" label="Complete" icon={Flag} cls="bg-emerald-600 hover:bg-emerald-700 text-white" />
                                <div className="flex-1" />
                                <ActionBtn a="revert_to_draft" label="Revert" icon={RotateCcw} cls="border border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400" />
                                <ActionBtn a="cancel" label="Cancel" icon={Ban} cls="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20" />
                                <ActionBtn a="delete" label="Delete" icon={Trash2} cls="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20" />
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ KPI CHIPS ═══ */}
                <div className="flex flex-wrap gap-3">
                    <KpiChip icon="📦" label="Lines" value={lines.length} />
                    <KpiChip icon="🔢" label="Total Qty" value={totalOrdered} sub={`${totalReceived} received`} />
                    <KpiChip icon="📊" label="Received" value={`${recPct}%`} sub={recPct >= 100 ? 'Complete' : 'In progress'} />
                    <KpiChip icon="💰" label="Amount" value={Number(po.total_amount || 0).toLocaleString()} />
                    {po.payment_term_name && <KpiChip icon="💳" label="Payment" value={po.payment_term_name} />}
                </div>

                {/* ═══ PROGRESS BAR ═══ */}
                {totalOrdered > 0 && <div className={`${card} p-4`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-app-muted-foreground">Receiving Progress</span>
                        <span className="text-sm font-black text-app-foreground">{recPct}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden bg-app-background">
                        <div className={`h-full rounded-full transition-all duration-700 ${recPct >= 100 ? 'bg-emerald-500' : recPct > 0 ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: `${Math.min(recPct, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mt-1.5">{totalReceived} of {totalOrdered} items received</p>
                </div>}

                {/* ═══ INTELLIGENCE GRID ═══ */}
                <div className={`${card} overflow-hidden`}>
                    <div className="p-4 border-b border-app-border/50 flex items-center justify-between">
                        <h2 className="text-xs font-black uppercase tracking-wider text-app-muted-foreground flex items-center gap-2"><Package size={14} className="text-blue-500" /> Order Lines — Intelligence Grid ({lines.length})</h2>
                        {Object.keys(intel).length > 0 && <span className="text-[9px] font-bold text-emerald-500">✓ Analytics loaded</span>}
                    </div>

                    {/* Desktop Full Intelligence Table */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="w-full text-[10px]">
                            <thead>
                                <tr className="bg-gradient-to-r from-app-background/80 to-app-background/40 border-b-2 border-app-border/60">
                                    <th className={`${thCls} !text-left !pl-4 min-w-[180px]`}><div className={thText}>Product</div></th>
                                    <th className={thCls} style={{ width: 85 }}><div className={thText}>Qty</div><div className={subText}>ordered · received</div></th>
                                    <th className={thCls} style={{ width: 85 }}><div className={thText}>Stock</div><div className={subText}>on location · total</div></th>
                                    <th className={thCls} style={{ width: 80 }}><div className={thText}>Purchases</div><div className={subText}>status</div></th>
                                    <th className={thCls} style={{ width: 80 }}><div className={thText}>Sales/Day</div><div className={subText}>monthly avg</div></th>
                                    <th className={thCls} style={{ width: 90 }}><div className={thText}>Score</div><div className={subText}>financial · adj</div></th>
                                    <th className={thCls} style={{ width: 85 }}><div className={thText}>Purchase $</div><div className={subText}>sales $</div></th>
                                    <th className={thCls} style={{ width: 80 }}><div className={thText}>Cost</div><div className={subText}>selling</div></th>
                                    <th className={thCls} style={{ width: 110 }}><div className={thText}>Best Supplier</div><div className={subText}>best price</div></th>
                                    <th className={thCls} style={{ width: 90 }}><div className={thText}>Expiry</div><div className={subText}>safety</div></th>
                                    <th className={thCls} style={{ width: 70 }}><div className={thText}>Subtotal</div></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-app-border/30">
                                {lines.map((line: any, i: number) => {
                                    const pid = line.product?.id || line.product_id
                                    const d = intel[pid] || {}
                                    const received = Number(line.quantity_received || 0)
                                    const ordered = Number(line.quantity_ordered || 0)
                                    const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
                                    const isComplete = pct >= 100
                                    const stockHere = d.stock_on_location ?? d.stockLevel ?? d.stock ?? '—'
                                    const totalStock = d.total_stock ?? stockHere
                                    const daily = d.avg_daily_sales ?? d.daily_sales ?? 0
                                    const monthly = d.monthly_average ?? (Number(daily) * 30)
                                    const fs = d.financial_score ?? d.sales_performance_score ?? '—'
                                    const adj = d.adjustment_score ?? d.adjustment_risk_score ?? '—'
                                    const totalPurch = d.total_purchased ?? '—'
                                    const totalSold = d.total_sold ?? '—'
                                    const cost = d.cost_price ?? line.unit_price ?? 0
                                    const sell = d.selling_price_ht ?? d.selling_price ?? '—'
                                    const bestSup = d.best_supplier_name || '—'
                                    const bestPr = d.best_supplier_price ?? '—'
                                    const expTrack = d.is_expiry_tracked ?? false
                                    const safeTag = d.safety_tag ?? 'SAFE'
                                    const avgExp = d.avg_available_expiry_days ?? 0
                                    const dtsAll = d.days_to_sell_all ?? 0
                                    const purchCount = d.purchase_count ?? '—'
                                    const prodStatus = (d.is_active !== false) ? 'Available' : 'Unavailable'
                                    const stockColor = Number(stockHere) <= 0 ? 'text-rose-500' : Number(stockHere) < Number(monthly) ? 'text-amber-500' : 'text-emerald-600'
                                    const fsColor = Number(fs) >= 100 ? 'text-emerald-600' : Number(fs) >= 50 ? 'text-amber-500' : 'text-app-foreground'

                                    return (
                                        <tr key={line.id} className="hover:bg-app-background/30 transition-colors group">
                                            <td className="py-2.5 px-4">
                                                <div className="font-bold text-[11px] text-app-foreground truncate max-w-[200px]">{line.product?.name || line.product_name || '—'}</div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {(line.product?.sku || line.product?.barcode) && <span className="text-[9px] text-app-muted-foreground font-mono">{line.product?.sku || line.product?.barcode}</span>}
                                                    {d.category_name && <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-md bg-app-primary/10 text-app-primary">{d.category_name}</span>}
                                                </div>
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                <div className="font-black text-xs text-app-foreground">{ordered}</div>
                                                <div className={`text-[9px] font-bold ${isComplete ? 'text-emerald-500' : received > 0 ? 'text-amber-500' : 'text-app-muted-foreground'}`}>{received} rec</div>
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                <div className={`text-xs font-black ${stockColor}`}>{stockHere}</div>
                                                <div className="text-[8px] text-app-muted-foreground">{totalStock} total</div>
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                <div className="font-bold text-xs text-app-foreground">{purchCount}</div>
                                                <div className={`text-[8px] font-bold ${prodStatus === 'Available' ? 'text-emerald-500' : 'text-rose-500'}`}>{prodStatus}</div>
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                <div className="font-bold text-xs text-app-foreground">{Number(daily).toFixed(1)}</div>
                                                <div className="text-[8px] text-app-muted-foreground">{Number(monthly).toFixed(0)}/mo</div>
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                <div className={`font-black text-xs ${fsColor}`}>{fs}</div>
                                                <div className={`text-[8px] font-bold ${Number(adj) >= 500 ? 'text-rose-500' : 'text-app-muted-foreground'}`}>{adj}</div>
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                <div className="font-bold text-[10px] text-app-foreground">{Number(totalPurch).toLocaleString()}</div>
                                                <div className="text-[8px] text-app-muted-foreground">{Number(totalSold).toLocaleString()}</div>
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                <div className="font-bold text-[10px] text-app-foreground">{Number(cost).toLocaleString()}</div>
                                                <div className="text-[8px] text-app-muted-foreground">{Number(sell).toLocaleString()}</div>
                                            </td>
                                            <td className="py-2 px-2 border-l border-app-border/20">
                                                <div className="font-bold text-[10px] text-app-foreground truncate max-w-[100px]">{bestSup}</div>
                                                <div className="text-[9px] text-app-muted-foreground">{bestPr !== '—' ? Number(bestPr).toLocaleString() : '—'}</div>
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                {expTrack ? <>
                                                    <SafetyBadge tag={safeTag} />
                                                    {avgExp > 0 && <div className="text-[7px] text-app-muted-foreground mt-0.5">{avgExp}d shelf</div>}
                                                    {dtsAll > 0 && <div className="text-[7px] text-app-muted-foreground">{dtsAll}d to sell</div>}
                                                </> : <span className="text-[8px] text-app-muted-foreground/50">N/A</span>}
                                            </td>
                                            <td className="py-2 px-2 text-center border-l border-app-border/20">
                                                <div className="font-black text-[11px] text-app-foreground">{Number(line.subtotal || 0).toLocaleString()}</div>
                                                {!isComplete && actions.includes('receive') && (
                                                    <button onClick={() => { setReceiveLineId(line.id); setReceiveQty(''); setDlg('receive') }}
                                                        className="text-[7px] font-bold text-emerald-500 hover:underline mt-0.5 opacity-0 group-hover:opacity-100 transition-all">
                                                        ↓ Receive
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="lg:hidden p-3 space-y-3">
                        {lines.map((line: any) => {
                            const pid = line.product?.id || line.product_id
                            const d = intel[pid] || {}
                            const received = Number(line.quantity_received || 0)
                            const ordered = Number(line.quantity_ordered || 0)
                            const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
                            const isComplete = pct >= 100
                            return (
                                <div key={line.id} className="bg-app-background/40 rounded-xl border border-app-border/40 overflow-hidden p-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs text-app-foreground">{line.product?.name || line.product_name || '—'}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {line.product?.sku && <span className="text-[8px] text-app-muted-foreground font-mono">{line.product.sku}</span>}
                                                {d.is_expiry_tracked && <SafetyBadge tag={d.safety_tag || 'SAFE'} />}
                                            </div>
                                        </div>
                                        <div className="text-sm font-black text-app-foreground ml-2">{Number(line.subtotal || 0).toLocaleString()}</div>
                                    </div>
                                    <div className="grid grid-cols-4 gap-1 mb-2">
                                        <Stat label="Ordered" value={ordered} />
                                        <Stat label="Received" value={received} className={isComplete ? 'text-emerald-500' : received > 0 ? 'text-amber-500' : 'text-app-foreground'} />
                                        <Stat label="Stock" value={d.stock_on_location ?? '—'} />
                                        <Stat label="Sales/d" value={Number(d.avg_daily_sales || 0).toFixed(1)} />
                                    </div>
                                    <div className="grid grid-cols-4 gap-1 mb-2">
                                        <Stat label="Purchases" value={d.purchase_count ?? '—'} />
                                        <Stat label="Score" value={d.financial_score ?? '—'} />
                                        <Stat label="Cost" value={Number(d.cost_price || line.unit_price || 0).toLocaleString()} />
                                        <Stat label="Best Price" value={d.best_supplier_price ? Number(d.best_supplier_price).toLocaleString() : '—'} />
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden bg-app-background">
                                        <div className={`h-full rounded-full ${isComplete ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : ''}`} style={{ width: `${pct}%` }} />
                                    </div>
                                    {!isComplete && actions.includes('receive') && (
                                        <button onClick={() => { setReceiveLineId(line.id); setReceiveQty(''); setDlg('receive') }}
                                            className="w-full mt-2 py-2 rounded-lg text-[10px] font-bold text-emerald-500 border border-emerald-200 dark:border-emerald-800">↓ Receive</button>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {lines.length === 0 && <div className="p-8 text-center text-sm text-app-muted-foreground">No order lines</div>}
                </div>

                {/* ═══ INFO CARDS ═══ */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`${card} p-4`}>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-3 flex items-center gap-1.5"><FileText size={12} className="text-blue-500" /> Order Details</h3>
                        <InfoRow label="PO Number" value={po.po_number} icon={Hash} />
                        <InfoRow label="Type" value={po.purchase_sub_type} />
                        <InfoRow label="Supplier" value={supplier} icon={Building2} />
                        <InfoRow label="Site" value={po.site_name} icon={MapPin} />
                        <InfoRow label="Warehouse" value={po.warehouse_name} icon={Package} />
                        <InfoRow label="Payment Terms" value={po.payment_term_name} icon={CreditCard} />
                        <InfoRow label="Scope" value={po.scope} icon={Eye} />
                    </div>
                    <div className={`${card} p-4`}>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-3 flex items-center gap-1.5"><Truck size={12} className="text-indigo-500" /> People & Logistics</h3>
                        <InfoRow label="Created By" value={po.created_by} icon={User} />
                        <InfoRow label="Assigned To" value={po.assigned_to_name} icon={User} />
                        <InfoRow label="Driver" value={po.driver_name} icon={Truck} />
                        <InfoRow label="Declaration #" value={po.supplier_declaration_number} icon={Shield} />
                        <InfoRow label="Invoice #" value={po.invoice_number} icon={Receipt} />
                    </div>
                    <div className={`${card} p-4`}>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-3 flex items-center gap-1.5"><Calendar size={12} className="text-emerald-500" /> Dates</h3>
                        <InfoRow label="Order Date" value={po.order_date} icon={Calendar} />
                        <InfoRow label="Expected Delivery" value={po.expected_delivery} icon={Truck} />
                        <InfoRow label="Created" value={po.created_at ? new Date(po.created_at).toLocaleDateString('fr-FR') : null} icon={Clock} />
                        <InfoRow label="Updated" value={po.updated_at ? new Date(po.updated_at).toLocaleDateString('fr-FR') : null} icon={Clock} />
                    </div>
                </div>

                {/* Notes */}
                {po.notes && <div className={`${card} p-4`}><h3 className="text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-2 flex items-center gap-1.5"><FileText size={12} /> Notes</h3><p className="text-sm text-app-muted-foreground leading-relaxed whitespace-pre-wrap">{po.notes}</p></div>}

                {/* Quick Links */}
                <div className={`${card} p-4`}>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-3">🔗 Quick Actions</h3>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/purchases/receipts" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-app-foreground border border-app-border hover:bg-app-background transition-colors"><PackageCheck size={12} /> Goods Receipts</Link>
                        <Link href="/purchases/returns/new" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-app-foreground border border-app-border hover:bg-app-background transition-colors"><RotateCcw size={12} /> Create Return</Link>
                    </div>
                </div>

                {/* Supplier Contact */}
                {po.supplier && <div className={`${card} p-4`}>
                    <h3 className="text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-3 flex items-center gap-1.5"><Building2 size={12} className="text-indigo-500" /> Supplier Contact</h3>
                    <div className="flex flex-wrap gap-6 text-sm">
                        <span className="font-bold text-app-foreground">{po.supplier.name}</span>
                        {po.supplier.phone && <span className="flex items-center gap-1.5 text-app-muted-foreground"><Phone size={12} />{po.supplier.phone}</span>}
                        {po.supplier.email && <span className="flex items-center gap-1.5 text-app-muted-foreground"><Mail size={12} />{po.supplier.email}</span>}
                        {po.supplier.address && <span className="flex items-center gap-1.5 text-app-muted-foreground"><MapPin size={12} />{po.supplier.address}</span>}
                    </div>
                </div>}
            </div>

            {/* ═══ DIALOGS ═══ */}
            {dlg === 'receive' && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setDlg(null)}>
                <div className={`w-full md:max-w-md ${card} rounded-t-2xl md:rounded-2xl p-6 shadow-2xl`} onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-black text-app-foreground mb-4 flex items-center gap-2"><PackageCheck size={20} className="text-emerald-500" /> Receive Goods</h3>
                    {!receiveLineId ? <div className="space-y-2"><p className="text-sm text-app-muted-foreground">Select a line:</p>
                        {po?.lines?.filter((l: any) => Number(l.quantity_received || 0) < Number(l.quantity_ordered)).map((l: any) => (
                            <button key={l.id} onClick={() => setReceiveLineId(l.id)} className="w-full text-left p-3 rounded-xl bg-app-background/60 flex justify-between items-center border border-app-border/50 hover:border-emerald-300 transition-colors">
                                <span className="font-bold text-app-foreground text-sm">{l.product?.name || l.product_name || '—'}</span>
                                <span className="text-xs text-app-muted-foreground">{Number(l.quantity_received || 0)}/{l.quantity_ordered}</span>
                            </button>
                        ))}
                    </div> : <div className="space-y-3"><label className="text-sm font-bold text-app-foreground">Quantity</label>
                        <input type="number" value={receiveQty} onChange={e => setReceiveQty(e.target.value)} autoFocus className="w-full px-4 py-3 rounded-xl bg-app-background border border-app-border text-sm outline-none focus:ring-2 focus:ring-emerald-500/30" />
                    </div>}
                    <div className="flex gap-3 mt-6">
                        <button className="flex-1 py-3 rounded-xl border border-app-border text-sm font-bold hover:bg-app-background" onClick={() => { setDlg(null); setReceiveLineId(null) }}>Cancel</button>
                        {receiveLineId && <button className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold disabled:opacity-50" onClick={handleReceive} disabled={!receiveQty || act === 'receive'}>Confirm</button>}
                    </div>
                </div>
            </div>}

            {dlg === 'reject' && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setDlg(null)}>
                <div className={`w-full md:max-w-md ${card} rounded-t-2xl md:rounded-2xl p-6 shadow-2xl`} onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-black text-app-foreground mb-4 flex items-center gap-2"><XCircle size={20} className="text-rose-500" /> Reject</h3>
                    <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason" autoFocus className="w-full px-4 py-3 rounded-xl bg-app-background border border-app-border text-sm outline-none focus:ring-2 focus:ring-rose-500/30" />
                    <div className="flex gap-3 mt-6">
                        <button className="flex-1 py-3 rounded-xl border border-app-border text-sm font-bold hover:bg-app-background" onClick={() => setDlg(null)}>Cancel</button>
                        <button className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold disabled:opacity-50" onClick={handleReject} disabled={act === 'reject'}>Reject</button>
                    </div>
                </div>
            </div>}

            {dlg === 'declaration' && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setDlg(null)}>
                <div className={`w-full md:max-w-md ${card} rounded-t-2xl md:rounded-2xl p-6 shadow-2xl`} onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-black text-app-foreground mb-4 flex items-center gap-2"><Shield size={20} className="text-indigo-500" /> Supplier Declaration</h3>
                    <div className="space-y-3">
                        <div><label className="text-sm font-bold">Declaration #</label><input value={declNumber} onChange={e => setDeclNumber(e.target.value)} placeholder="D-2026-xxxxx" className="w-full mt-1 px-4 py-3 rounded-xl bg-app-background border border-app-border text-sm outline-none" /></div>
                        <div><label className="text-sm font-bold">Date</label><input type="date" value={declDate} onChange={e => setDeclDate(e.target.value)} className="w-full mt-1 px-4 py-3 rounded-xl bg-app-background border border-app-border text-sm outline-none" /></div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button className="flex-1 py-3 rounded-xl border border-app-border text-sm font-bold hover:bg-app-background" onClick={() => setDlg(null)}>Cancel</button>
                        <button className="flex-1 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold disabled:opacity-50" onClick={handleDeclaration} disabled={!declNumber || act === 'record_declaration'}>Save</button>
                    </div>
                </div>
            </div>}

            {dlg === 'invoice' && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setDlg(null)}>
                <div className={`w-full md:max-w-md ${card} rounded-t-2xl md:rounded-2xl p-6 shadow-2xl`} onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-black text-app-foreground mb-4 flex items-center gap-2"><Receipt size={20} className="text-purple-500" /> Mark as Invoiced</h3>
                    <div className="space-y-3">
                        <div><label className="text-sm font-bold">Invoice #</label><input value={invNumber} onChange={e => setInvNumber(e.target.value)} placeholder="INV-2026-xxxxx" className="w-full mt-1 px-4 py-3 rounded-xl bg-app-background border border-app-border text-sm outline-none" /></div>
                        <div><label className="text-sm font-bold">Date</label><input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} className="w-full mt-1 px-4 py-3 rounded-xl bg-app-background border border-app-border text-sm outline-none" /></div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button className="flex-1 py-3 rounded-xl border border-app-border text-sm font-bold hover:bg-app-background" onClick={() => setDlg(null)}>Cancel</button>
                        <button className="flex-1 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold disabled:opacity-50" onClick={handleInvoice} disabled={act === 'mark_invoiced'}>Confirm</button>
                    </div>
                </div>
            </div>}
        </main>
    )
}
