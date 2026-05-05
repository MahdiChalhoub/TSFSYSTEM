'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { SalesOrder } from '@/types/erp'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import {
 History, Printer, User, Search,
 Filter, Hash,
 ArrowUpRight, RefreshCw,
 DollarSign, Activity, AlertCircle,
 MoreHorizontal, Eye, Edit3, Trash2, Truck, Clipboard,
 Package, CreditCard, Undo2, Link2, MessageSquare, Mail, BookOpen
} from "lucide-react"
import {
 DropdownMenu, DropdownMenuContent, DropdownMenuItem,
 DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { deleteOrder, lockOrder, verifyOrder } from "../actions"
import {
 confirmOrder, markDelivered, markPartial,
 markPaid, generateInvoice, cancelOrder
} from "../workflow-actions"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
 STATUS_CONFIG, TYPE_CONFIG,
 ORDER_STATUS_CONFIG, DELIVERY_STATUS_CONFIG,
 PAYMENT_STATUS_CONFIG, INVOICE_STATUS_CONFIG,
 type OrderStatus, type DeliveryStatus, type PaymentStatus, type InvoiceStatus
} from '@/types/sales'
import { SalesKpiCard } from '@/components/modules/sales/SalesKpiCard'
import { ConfirmOrderDialog } from '@/components/modules/sales/ConfirmOrderDialog'
import { useAdmin } from '@/context/AdminContext'
export default function OrderHistoryPage() {
 const { viewScope } = useAdmin()
 const { fmt } = useCurrency()
 const [orders, setOrders] = useState<SalesOrder[]>([])
 const [loading, setLoading] = useState(true)
 const [searchQuery, setSearchQuery] = useState('')
 const settings = useListViewSettings('sales_history', {
 columns: [
 'actions', 'created_at', 'invoice_number', 'contact_name',
 'order_status', 'delivery_status', 'payment_status', 'invoice_status',
 'total_amount', 'total_paid', 'amount_due',
 'is_locked'
 ],
 pageSize: 25, sortKey: 'created_at', sortDir: 'desc'
 })

 const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
 const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
 const [confirmOrderTargetId, setConfirmOrderTargetId] = useState<number | null>(null)

 const handleOpenConfirmOrder = (orderId: number) => {
 setConfirmOrderTargetId(orderId)
 }

 const executeConfirmWorkflow = async (warehouseId: string | null) => {
 if (!confirmOrderTargetId) return
 toast.loading('Confirming order...')
 try {
 const mod = await import('../workflow-actions')
 const result = await mod.triggerOrderWorkflow(confirmOrderTargetId, {
 action: 'confirm',
 warehouse_id: warehouseId ? warehouseId : undefined
 })
 toast.dismiss()
 if (result.success) {
 toast.success('✓ Order confirmed')
 loadOrders()
 } else {
 toast.error(result.error || 'Confirmation failed')
 }
 } catch (e: any) {
 toast.dismiss()
 toast.error(e?.message || 'Confirmation failed')
 } finally {
 setConfirmOrderTargetId(null)
 }
 }

 const handleDelete = async (id: number) => {
 toast.promise(deleteOrder(id), {
 loading: 'Suppression en cours...',
 success: () => {
 loadOrders()
 return 'Facture supprimée avec succès'
 },
 error: 'Échec de la suppression'
 })
 setConfirmDeleteId(null)
 }

 const toggleLock = async (id: number, current: boolean) => {
 const res = await lockOrder(id, !current)
 if (res.success) {
 toast.success(!current ? 'Transaction verrouillée' : 'Transaction déverrouillée')
 loadOrders()
 }
 }

 const toggleVerify = async (id: number, current: boolean) => {
 const res = await verifyOrder(id, !current)
 if (res.success) {
 toast.success(!current ? 'Transaction vérifiée' : 'Transaction non-vérifiée')
 loadOrders()
 }
 }
 useEffect(() => { loadOrders() }, [viewScope])
 async function loadOrders() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 // FORCE CACHE BUST AND EXPLICIT SCOPE: Next.js aggressively caches GET requests.
 // When switching between Internal/Official, the URL must be unique or cache must be disabled.
 const data = await erpFetch(`pos/orders/?type=SALE&scope=${viewScope}`, { cache: 'no-store' })
 setOrders(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load transaction history")
 } finally {
 setLoading(false)
 }
 }
 async function downloadInvoice(orderId: number, ref: string) {
 toast.loading(`Generating invoice for #${ref}...`)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const blob = await erpFetch(`pos/${orderId}/invoice-pdf/`)
 if (!(blob instanceof Blob)) throw new Error("Invalid sequence response")
 const url = window.URL.createObjectURL(blob)
 const a = document.createElement('a')
 a.href = url
 a.download = `Invoice_${ref || orderId}.pdf`
 document.body.appendChild(a)
 a.click()
 window.URL.revokeObjectURL(url)
 document.body.removeChild(a)
 toast.dismiss()
 toast.success("Document dispatched successfully")
 } catch (e) {
 toast.dismiss()
 toast.error("Dispatch sequence failed")
 console.error(e)
 }
 }

 async function handleWorkflow(orderId: number, action: string, label: string) {
 toast.loading(`${label}...`)
 try {
 const mod = await import('../workflow-actions')
 const result = await mod.triggerOrderWorkflow(orderId, { action: action as any })
 toast.dismiss()
 if (result.success) {
 toast.success(`✓ ${label}`)
 loadOrders()
 } else {
 toast.error(result.error || 'Action failed')
 }
 } catch (e: any) {
 toast.dismiss()
 toast.error(e?.message || 'Action failed')
 }
 }
 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'actions',
 label: 'Action',
 align: 'center',
 render: (order) => (
 <div className="flex items-center justify-center gap-2">
 <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-app-info hover:bg-app-info-bg" asChild title="View in Ledger (DR/CR)">
 <Link href={`/finance/ledger?q=${order.invoice_number || order.ref_code || order.id}`}>
 <BookOpen size={16} />
 </Link>
 </Button>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg hover:bg-app-surface-2">
 <MoreHorizontal size={16} />
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56 rounded-xl border-app-border shadow-xl">
 <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-app-muted-foreground px-3 py-2">
 Management de Vente
 </DropdownMenuLabel>
 <DropdownMenuItem asChild className="focus:bg-app-info-bg focus:text-app-info cursor-pointer py-2.5">
 <Link href={`/sales/${order.id}`} className="flex items-center gap-2 w-full">
 <Eye size={14} /> Voir
 </Link>
 </DropdownMenuItem>
 <DropdownMenuItem className="focus:bg-app-bg cursor-pointer py-2.5">
 <Edit3 size={14} className="mr-2" /> Modifier
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => setConfirmDeleteId(order.id)} className="focus:bg-app-error-bg focus:text-app-error cursor-pointer py-2.5">
 <Trash2 size={14} className="mr-2" /> Effacer
 </DropdownMenuItem>

 <DropdownMenuSeparator />

 {/* ── Workflow Transitions ────────────────── */}
 <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-app-muted-foreground px-3 py-1">
 Workflow
 </DropdownMenuLabel>

 {(!order.order_status || order.order_status === 'DRAFT') && (
 <DropdownMenuItem
 onClick={() => handleOpenConfirmOrder(order.id)}
 className="focus:bg-app-info-bg focus:text-app-info cursor-pointer py-2.5"
 >
 <Package size={14} className="mr-2" /> Confirm Order
 </DropdownMenuItem>
 )}

 {order.delivery_status === 'PENDING' && (
 <DropdownMenuItem
 onClick={() => handleWorkflow(order.id, 'deliver', 'Marking as delivered')}
 className="focus:bg-app-success-bg focus:text-app-success cursor-pointer py-2.5"
 >
 <Truck size={14} className="mr-2" /> Mark Delivered
 </DropdownMenuItem>
 )}

 {order.payment_status === 'UNPAID' && (
 <DropdownMenuItem
 onClick={() => handleWorkflow(order.id, 'pay', 'Recording payment')}
 className="focus:bg-app-success-bg focus:text-app-success cursor-pointer py-2.5"
 >
 <CreditCard size={14} className="mr-2" /> Mark Paid
 </DropdownMenuItem>
 )}

 {order.invoice_status === 'NOT_GENERATED' && (
 <DropdownMenuItem
 onClick={() => handleWorkflow(order.id, 'generate_invoice', 'Generating invoice')}
 className="focus:bg-app-info-bg focus:text-app-info cursor-pointer py-2.5"
 >
 <Clipboard size={14} className="mr-2" /> Generate Invoice
 </DropdownMenuItem>
 )}

 {!['CANCELLED', 'CLOSED'].includes(order.order_status) && (
 <DropdownMenuItem
 onClick={() => handleWorkflow(order.id, 'cancel', 'Cancelling order')}
 className="focus:bg-app-error-bg focus:text-app-error cursor-pointer py-2.5 text-app-error"
 >
 <AlertCircle size={14} className="mr-2" /> Cancel Order
 </DropdownMenuItem>
 )}

 <DropdownMenuSeparator />

 <DropdownMenuItem onClick={() => downloadInvoice(order.id, order.ref_code || order.id)} className="focus:bg-app-bg cursor-pointer py-2.5 text-app-info font-semibold">
 <Printer size={14} className="mr-2" /> La facture d'impression
 </DropdownMenuItem>
 <DropdownMenuItem className="focus:bg-app-bg cursor-pointer py-2.5">
 <Clipboard size={14} className="mr-2" /> Bordereau
 </DropdownMenuItem>
 <DropdownMenuItem className="focus:bg-app-bg cursor-pointer py-2.5">
 <Package size={14} className="mr-2" /> Bon de livraison
 </DropdownMenuItem>

 <DropdownMenuSeparator />

 <DropdownMenuItem className="focus:bg-app-bg cursor-pointer py-2.5">
 <CreditCard size={14} className="mr-2" /> Voir les paiements
 </DropdownMenuItem>
 <DropdownMenuItem className="focus:bg-app-bg cursor-pointer py-2.5">
 <Undo2 size={14} className="mr-2" /> Vente Retour
 </DropdownMenuItem>

 <DropdownMenuSeparator />

 <DropdownMenuItem className="focus:bg-app-bg cursor-pointer py-2.5">
 <Link2 size={14} className="mr-2" /> Afficher l'URL de la facture
 </DropdownMenuItem>

 <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-app-muted-foreground px-3 pt-4 pb-2">
 Notifications
 </DropdownMenuLabel>
 <DropdownMenuItem className="focus:bg-app-bg cursor-pointer py-2.5">
 <MessageSquare size={14} className="mr-2 text-app-success" /> WhatsApp Notification
 </DropdownMenuItem>
 <DropdownMenuItem className="focus:bg-app-bg cursor-pointer py-2.5">
 <Mail size={14} className="mr-2 text-indigo-400" /> Email Notification
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 )
 },
 {
 key: 'created_at',
 label: 'Date',
 sortable: true,
 render: (order) => (
 <div className="flex flex-col">
 <span className="text-xs font-bold text-app-foreground">
 {order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '—'}
 </span>
 <span className="text-[10px] text-app-muted-foreground font-medium tracking-tight">
 {order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
 </span>
 </div>
 )
 },
 {
 key: 'invoice_number',
 label: 'Facture n°.',
 sortable: true,
 render: (order) => (
 <span className="font-black text-app-foreground leading-tight">#{order.invoice_number || order.ref_code || order.id}</span>
 )
 },
 {
 key: 'contact_name',
 label: 'Nom du client',
 sortable: true,
 render: (order) => (
 <div className="flex flex-col">
 <span className="text-sm font-semibold text-app-foreground tracking-tight">{order.contact_name || 'Walking Customer'}</span>
 <span className="text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">
 {order.contact_phone || ''}
 </span>
 </div>
 )
 },
 {
 key: 'contact_phone',
 label: 'Numéro de contact',
 render: (order) => (
 <span className="text-xs text-app-muted-foreground">{order.contact_phone || '—'}</span>
 )
 },
 {
 key: 'site_name',
 label: 'Emplacement',
 render: (order) => (
 <span className="text-xs font-medium text-app-muted-foreground">{order.site_name || 'Global'}</span>
 )
 },
 {
 key: 'order_status',
 label: 'Order Status',
 render: (order) => {
 const cfg = ORDER_STATUS_CONFIG[order.order_status as OrderStatus]
 ?? { label: order.order_status ?? '—', color: 'bg-app-surface-2 text-app-muted-foreground' };
 return <Badge variant="outline" className={`${cfg.color} text-[9px] font-black uppercase tracking-widest`}>{cfg.label}</Badge>
 }
 },
 {
 key: 'delivery_status',
 label: 'Delivery',
 render: (order) => {
 const cfg = DELIVERY_STATUS_CONFIG[order.delivery_status as DeliveryStatus]
 ?? { label: order.delivery_status ?? '—', color: 'bg-app-surface-2 text-app-muted-foreground' };
 return <Badge variant="outline" className={`${cfg.color} text-[9px] font-black uppercase tracking-widest`}>{cfg.label}</Badge>
 }
 },
 {
 key: 'payment_status',
 label: 'Payment',
 render: (order) => {
 // Prefer new payment_status axis; fall back to derived value
 if (order.payment_status) {
 const cfg = PAYMENT_STATUS_CONFIG[order.payment_status as PaymentStatus]
 ?? { label: order.payment_status, color: 'bg-app-surface-2 text-app-muted-foreground' };
 return <Badge variant="outline" className={`${cfg.color} text-[9px] font-black uppercase tracking-widest`}>{cfg.label}</Badge>
 }
 // Legacy fallback: derive from total_paid
 const paid = parseFloat(String(order.total_paid || 0))
 const total = parseFloat(String(order.total_amount || 0))
 if (paid >= total && total > 0) return <Badge variant="outline" className="bg-app-success-bg text-app-success border-emerald-100 text-[9px] font-black uppercase tracking-widest">Payé</Badge>
 if (paid > 0) return <Badge variant="outline" className="bg-app-warning-bg text-app-warning border-amber-100 text-[9px] font-black uppercase tracking-widest">Partiel</Badge>
 return <Badge variant="outline" className="bg-app-error-bg text-app-error border-rose-100 text-[9px] font-black uppercase tracking-widest">Dû</Badge>
 }
 },
 {
 key: 'invoice_status',
 label: 'Invoice',
 render: (order) => {
 const cfg = INVOICE_STATUS_CONFIG[order.invoice_status as InvoiceStatus]
 ?? { label: order.invoice_status ?? '—', color: 'bg-app-surface-2 text-app-muted-foreground' };
 return <Badge variant="outline" className={`${cfg.color} text-[9px] font-black uppercase tracking-widest`}>{cfg.label}</Badge>
 }
 },
 {
 key: 'payment_method',
 label: 'Mode de paiement',
 render: (order) => (
 <Badge variant="secondary" className="bg-app-surface-2 text-app-muted-foreground border-0 text-[8px] font-black uppercase tracking-tighter">
 {order.payment_method || 'CASH'}
 </Badge>
 )
 },
 {
 key: 'total_amount',
 label: 'Montant total',
 align: 'right',
 sortable: true,
 render: (order) => (
 <span className="font-black text-app-foreground tracking-tighter">{fmt(parseFloat(String(order.total_amount ?? 0)))}</span>
 )
 },
 {
 key: 'total_paid',
 label: 'Total payé',
 align: 'right',
 render: (order) => (
 <span className="font-bold text-app-success tracking-tighter">{fmt(parseFloat(String(order.total_paid ?? 0)))}</span>
 )
 },
 {
 key: 'amount_due',
 label: 'Vente due',
 align: 'right',
 render: (order) => {
 const due = parseFloat(String(order.total_amount ?? 0)) - parseFloat(String(order.total_paid ?? 0))
 return <span className={`font-black tracking-tighter ${due > 0 ? 'text-app-error' : 'text-app-muted-foreground'}`}>{fmt(due)}</span>
 }
 },
 {
 key: 'return_due',
 label: 'Vente retour dû',
 align: 'right',
 render: (order) => (
 <span className="text-xs font-bold text-app-muted-foreground">{fmt(parseFloat(String(order.return_due || 0)))}</span>
 )
 },
 {
 key: 'shipping_status',
 label: "Statut d'envoi",
 render: (order) => (
 <Badge className="bg-app-bg text-app-muted-foreground border border-app-border text-[9px] font-bold uppercase">
 {order.shipping_status || '—'}
 </Badge>
 )
 },
 {
 key: 'total_items',
 label: 'Articles au total',
 align: 'center',
 render: (order) => (
 <span className="text-xs font-bold text-app-foreground">{order.total_items || 0}</span>
 )
 },
 {
 key: 'type',
 label: 'Types de services',
 render: (order) => (
 <span className="text-[10px] font-black text-app-info uppercase tracking-widest">{order.type}</span>
 )
 },
 {
 key: 'user_name',
 label: 'Ajouté par',
 render: (order) => (
 <div className="flex items-center gap-1.5">
 <User size={12} className="text-app-muted-foreground" />
 <span className="text-xs text-app-muted-foreground font-medium">{order.user_name || 'System'}</span>
 </div>
 )
 },
 {
 key: 'notes',
 label: 'Note de vente',
 render: (order) => (
 <p className="text-[10px] text-app-muted-foreground italic truncate max-w-[120px]" title={order.notes}>
 {order.notes || '—'}
 </p>
 )
 },
 {
 key: 'staff_notes',
 label: 'Note du personnel',
 render: (order) => (
 <p className="text-[10px] text-app-warning/60 truncate max-w-[120px]">
 {order.staff_notes || '—'}
 </p>
 )
 },
 {
 key: 'is_locked',
 label: 'Locked',
 align: 'center',
 render: (order) => (
 <button
 onClick={() => toggleLock(order.id, order.is_locked)}
 className="transition-transform active:scale-95"
 >
 {order.is_locked ? <Badge className="bg-stone-900 text-app-foreground border-0 text-[8px] h-4">YES</Badge> : <span className="text-[8px] text-stone-200">NO</span>}
 </button>
 )
 },
 {
 key: 'is_verified',
 label: 'Verified',
 align: 'center',
 render: (order) => (
 <button
 onClick={() => toggleVerify(order.id, order.is_verified)}
 className="transition-transform active:scale-95"
 >
 {order.is_verified ? <Badge className="bg-app-info text-app-foreground border-0 text-[8px] h-4">YES</Badge> : <span className="text-[8px] text-stone-200">NO</span>}
 </button>
 )
 }
 ], [fmt])
 const filteredOrders = useMemo(() => {
 return orders.filter(o =>
 !searchQuery ||
 (o.ref_code || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
 (o.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
 (o.contact_name || "").toLowerCase().includes(searchQuery.toLowerCase())
 )
 }, [orders, searchQuery])
 const stats = useMemo(() => {
 const vol = filteredOrders.reduce((acc, o) => acc + parseFloat(String(o.total_amount || 0)), 0)
 const exposure = filteredOrders.filter(o => o.status !== 'CANCELLED').reduce((acc, o) => acc + parseFloat(String(o.total_amount || 0)), 0)
 return { volume: vol, exposure, count: filteredOrders.length }
 }, [filteredOrders])
 return (
 <div className="w-full min-h-screen p-8 space-y-8 animate-in fade-in duration-500 bg-stone-50/30">
 <header className="flex justify-between items-end mb-10">
 <div>
 <div className="flex items-center gap-3 mb-2">
 <Badge className="bg-app-info-bg text-app-info border-indigo-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
 Node: POS Registry
 </Badge>
 <span className="text-[10px] font-bold text-app-faint uppercase tracking-widest flex items-center gap-1">
 <Activity size={12} /> Transaction Stream
 </span>
 </div>
 <h1 className="page-header-title flex items-center gap-4">
 <div className="w-16 h-16 rounded-[1.8rem] bg-stone-900 flex items-center justify-center shadow-2xl shadow-stone-200">
 <History size={32} className="text-app-foreground" />
 </div>
 Transaction <span className="text-app-info">History</span>
 </h1>
 </div>
 <div className="flex items-center gap-3">
 <Button onClick={loadOrders} variant="outline" className="h-12 w-12 p-0 rounded-2xl border-app-border text-app-muted-foreground hover:text-app-info hover:bg-app-bg transition-all">
 <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
 </Button>
 <Button asChild className="h-12 px-6 rounded-2xl bg-app-info hover:bg-app-info text-app-foreground font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all">
 <Link href="/sales">
 <ArrowUpRight size={18} /> Terminal
 </Link>
 </Button>
 </div>
 </header>
 {/* KPI Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <SalesKpiCard
 icon={<Activity size={24} />}
 badge="VOLUME"
 label="Total Transaction Vol"
 value={fmt(stats.volume)}
 />
 <SalesKpiCard
 icon={<DollarSign size={24} />}
 badge="EXPOSURE"
 label="Net Realized Exposure"
 value={fmt(stats.exposure)}
 variant="dark"
 />
 <SalesKpiCard
 icon={<Hash size={24} />}
 badge="COUNT"
 label="Transaction Count"
 value={`${stats.count}`}
 />
 </div>
 <TypicalListView
 title="Registre Opérationnel des Ventes"
 data={filteredOrders}
 loading={loading}
 getRowId={(o) => o.id}
 columns={columns}
 selection={{
 selectedIds,
 onSelectionChange: setSelectedIds
 }}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 renderExpanded={(order) => (
 <div className="p-6 bg-stone-50/50 rounded-2xl mx-10 mb-4 border border-app-border animate-in slide-in-from-top-2 duration-300">
 <h4 className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-4 px-2">Détails des Articles</h4>
 <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden shadow-sm">
 <table className="w-full text-left text-xs">
 <thead className="bg-app-bg text-app-muted-foreground font-bold">
 <tr>
 <th className="px-4 py-3">Produit</th>
 <th className="px-4 py-3 text-center">Quantité</th>
 <th className="px-4 py-3 text-right">Prix Unit.</th>
 <th className="px-4 py-3 text-right">Total</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-app-border">
 {order.lines?.map((line: any, i: number) => (
 <tr key={i} className="hover:bg-stone-50/50 transition-colors">
 <td className="px-4 py-3 font-semibold text-app-muted-foreground">{line.product_name || `Produit #${line.product}`}</td>
 <td className="px-4 py-3 text-center font-bold text-app-muted-foreground">{line.quantity}</td>
 <td className="px-4 py-3 text-right text-app-muted-foreground">{fmt(parseFloat(line.unit_price))}</td>
 <td className="px-4 py-3 text-right font-black text-app-foreground">{fmt(parseFloat(line.subtotal))}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 className="rounded-[2.5rem] border-0 shadow-2xl shadow-stone-200/50 overflow-hidden bg-app-surface"
 headerExtra={
 <div className="flex items-center gap-3">
 <div className="relative w-80">
 <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
 <Input
 placeholder="Rechercher par n° facture, client..."
 value={searchQuery}
 onChange={e => setSearchQuery(e.target.value)}
 className="pl-10 h-12 rounded-[1rem] text-sm border-0 bg-app-surface-2 focus-visible:ring-app-info/30 transition-all focus:bg-app-surface focus:shadow-sm"
 />
 </div>
 <Button variant="outline" className="h-12 rounded-[1rem] border-app-border text-app-muted-foreground gap-2 font-bold px-5 hover:bg-app-surface hover:shadow-sm">
 <Filter size={14} /> Filtres Avancés
 </Button>
 </div>
 }
 />

 <ConfirmDialog
 open={confirmDeleteId !== null}
 onOpenChange={(open) => !open && setConfirmDeleteId(null)}
 title="Supprimer la Facture ?"
 description="Cette action est irréversible. La facture et ses données associées seront supprimées du registre."
 onConfirm={() => { if (confirmDeleteId) handleDelete(confirmDeleteId) }}
 confirmText="Supprimer Définitivement"
 cancelText="Annuler"
 variant="danger"
 />

 <ConfirmOrderDialog
 open={confirmOrderTargetId !== null}
 onOpenChange={(open) => !open && setConfirmOrderTargetId(null)}
 onConfirm={executeConfirmWorkflow}
 defaultWarehouseId={(orders.find(o => o.id === confirmOrderTargetId)?.site as any)?.id || orders.find(o => o.id === confirmOrderTargetId)?.site_id}
 />
 </div>
 )
}
