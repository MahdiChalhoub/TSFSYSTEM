'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { SalesOrder } from '@/types/erp'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import {
    History, FileText, Printer, User, Search,
    Filter, Calendar, ChevronRight, Hash,
    ArrowUpRight, ArrowDownRight, RefreshCw,
    Download, TrendingUp, DollarSign, Activity, AlertCircle,
    MoreHorizontal, Eye, Edit3, Trash2, Truck, Clipboard,
    Package, CreditCard, Undo2, Link2, MessageSquare, Mail
} from "lucide-react"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Card, CardContent } from "@/components/ui/card"
import { deleteOrder, lockOrder, verifyOrder } from "../actions"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'bg-stone-100 text-stone-600' },
    PENDING: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    COMPLETED: { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    INVOICED: { label: 'Invoiced', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
}
const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    SALE: { label: 'Sale', color: 'text-indigo-600' },
    PURCHASE: { label: 'Purchase', color: 'text-emerald-600' },
    RETURN: { label: 'Return', color: 'text-rose-600' },
}
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
            'payment_status', 'total_amount', 'total_paid', 'amount_due',
            'shipping_status', 'is_locked'
        ],
        pageSize: 25, sortKey: 'created_at', sortDir: 'desc'
    })

    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set())
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

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
        toast.loading(`Synchronizing invoice engine for #${ref}...`)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const blob = await erpFetch(`pos/${orderId}/invoice-pdf/`)
            if (!(blob instanceof Blob)) {
                throw new Error("Invalid sequence response")
            }
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
    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'actions',
            label: 'Action',
            align: 'center',
            render: (order) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg hover:bg-stone-100">
                            <MoreHorizontal size={16} />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-xl border-stone-100 shadow-xl">
                        <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-stone-400 px-3 py-2">
                            Management de Vente
                        </DropdownMenuLabel>
                        <DropdownMenuItem asChild className="focus:bg-indigo-50 focus:text-indigo-600 cursor-pointer py-2.5">
                            <Link href={`/sales/${order.id}`} className="flex items-center gap-2 w-full">
                                <Eye size={14} /> Voir
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <Edit3 size={14} className="mr-2" /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setConfirmDeleteId(order.id)} className="focus:bg-rose-50 focus:text-rose-600 cursor-pointer py-2.5">
                            <Trash2 size={14} className="mr-2" /> Effacer
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <Truck size={14} className="mr-2" /> Modifier l'expédition
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem onClick={() => downloadInvoice(order.id, order.ref_code || order.id)} className="focus:bg-stone-50 cursor-pointer py-2.5 text-indigo-600 font-semibold">
                            <Printer size={14} className="mr-2" /> La facture d'impression
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <Clipboard size={14} className="mr-2" /> Bordereau
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <Package size={14} className="mr-2" /> Bon de livraison
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <CreditCard size={14} className="mr-2" /> Voir les paiements
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <Undo2 size={14} className="mr-2" /> Vente Retour
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <Link2 size={14} className="mr-2" /> Afficher l'URL de la facture
                        </DropdownMenuItem>

                        <DropdownMenuLabel className="text-[10px] uppercase font-black tracking-widest text-stone-400 px-3 pt-4 pb-2">
                            Notifications
                        </DropdownMenuLabel>
                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <MessageSquare size={14} className="mr-2 text-emerald-500" /> WhatsApp Notification
                        </DropdownMenuItem>
                        <DropdownMenuItem className="focus:bg-stone-50 cursor-pointer py-2.5">
                            <Mail size={14} className="mr-2 text-indigo-400" /> Email Notification
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
        {
            key: 'created_at',
            label: 'Date',
            sortable: true,
            render: (order) => (
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-700">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '—'}
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium tracking-tight">
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
                <span className="font-black text-gray-900 leading-tight">#{order.invoice_number || order.ref_code || order.id}</span>
            )
        },
        {
            key: 'contact_name',
            label: 'Nom du client',
            sortable: true,
            render: (order) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-gray-700 tracking-tight">{order.contact_name || 'Walking Customer'}</span>
                    <span className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter">
                        {order.contact_phone || ''}
                    </span>
                </div>
            )
        },
        {
            key: 'contact_phone',
            label: 'Numéro de contact',
            render: (order) => (
                <span className="text-xs text-stone-500">{order.contact_phone || '—'}</span>
            )
        },
        {
            key: 'site_name',
            label: 'Emplacement',
            render: (order) => (
                <span className="text-xs font-medium text-stone-600">{order.site_name || 'Global'}</span>
            )
        },
        {
            key: 'payment_status',
            label: 'Statut de paiement',
            render: (order) => {
                const paid = parseFloat(String(order.total_paid || 0))
                const total = parseFloat(String(order.total_amount || 0))
                if (paid >= total && total > 0) return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black uppercase tracking-widest">Payé</Badge>
                if (paid > 0) return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] font-black uppercase tracking-widest">Partiel</Badge>
                return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 text-[9px] font-black uppercase tracking-widest">Dû</Badge>
            }
        },
        {
            key: 'payment_method',
            label: 'Mode de paiement',
            render: (order) => (
                <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-0 text-[8px] font-black uppercase tracking-tighter">
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
                <span className="font-black text-gray-900 tracking-tighter">{fmt(parseFloat(String(order.total_amount ?? 0)))}</span>
            )
        },
        {
            key: 'total_paid',
            label: 'Total payé',
            align: 'right',
            render: (order) => (
                <span className="font-bold text-emerald-600 tracking-tighter">{fmt(parseFloat(String(order.total_paid ?? 0)))}</span>
            )
        },
        {
            key: 'amount_due',
            label: 'Vente due',
            align: 'right',
            render: (order) => {
                const due = parseFloat(String(order.total_amount ?? 0)) - parseFloat(String(order.total_paid ?? 0))
                return <span className={`font-black tracking-tighter ${due > 0 ? 'text-rose-600' : 'text-stone-300'}`}>{fmt(due)}</span>
            }
        },
        {
            key: 'return_due',
            label: 'Vente retour dû',
            align: 'right',
            render: (order) => (
                <span className="text-xs font-bold text-stone-400">{fmt(parseFloat(String(order.return_due || 0)))}</span>
            )
        },
        {
            key: 'shipping_status',
            label: "Statut d'envoi",
            render: (order) => (
                <Badge className="bg-stone-50 text-stone-600 border border-stone-100 text-[9px] font-bold uppercase">
                    {order.shipping_status || '—'}
                </Badge>
            )
        },
        {
            key: 'total_items',
            label: 'Articles au total',
            align: 'center',
            render: (order) => (
                <span className="text-xs font-bold text-gray-900">{order.total_items || 0}</span>
            )
        },
        {
            key: 'type',
            label: 'Types de services',
            render: (order) => (
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{order.type}</span>
            )
        },
        {
            key: 'user_name',
            label: 'Ajouté par',
            render: (order) => (
                <div className="flex items-center gap-1.5">
                    <User size={12} className="text-stone-300" />
                    <span className="text-xs text-stone-500 font-medium">{order.user_name || 'System'}</span>
                </div>
            )
        },
        {
            key: 'notes',
            label: 'Note de vente',
            render: (order) => (
                <p className="text-[10px] text-stone-400 italic truncate max-w-[120px]" title={order.notes}>
                    {order.notes || '—'}
                </p>
            )
        },
        {
            key: 'staff_notes',
            label: 'Note du personnel',
            render: (order) => (
                <p className="text-[10px] text-amber-600/60 truncate max-w-[120px]">
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
                    {order.is_locked ? <Badge className="bg-stone-900 text-white border-0 text-[8px] h-4">YES</Badge> : <span className="text-[8px] text-stone-200">NO</span>}
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
                    {order.is_verified ? <Badge className="bg-indigo-600 text-white border-0 text-[8px] h-4">YES</Badge> : <span className="text-[8px] text-stone-200">NO</span>}
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
                        <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100 font-black text-[10px] uppercase tracking-widest px-3 py-1">
                            Node: POS Registry
                        </Badge>
                        <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-1">
                            <Activity size={12} /> Transaction Stream
                        </span>
                    </div>
                    <h1 className="text-5xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-16 h-16 rounded-[1.8rem] bg-stone-900 flex items-center justify-center shadow-2xl shadow-stone-200">
                            <History size={32} className="text-white" />
                        </div>
                        Transaction <span className="text-indigo-600">History</span>
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={loadOrders} variant="outline" className="h-12 w-12 p-0 rounded-2xl border-stone-100 text-stone-400 hover:text-indigo-600 hover:bg-stone-50 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <Button asChild className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all">
                        <Link href="/sales">
                            <ArrowUpRight size={18} /> Terminal
                        </Link>
                    </Button>
                </div>
            </header>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <Activity size={24} />
                            </div>
                            <Badge variant="outline" className="bg-indigo-50 border-0 font-black text-[10px]">
                                VOLUME
                            </Badge>
                        </div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Total Transaction Vol</p>
                        <h2 className="text-3xl font-black text-gray-900 mt-1">{fmt(stats.volume)}</h2>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-stone-900 overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-white">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center">
                                <DollarSign size={24} />
                            </div>
                            <Badge variant="outline" className="bg-white/10 text-white border-0 font-black text-[10px]">
                                EXPOSURE
                            </Badge>
                        </div>
                        <p className="text-[11px] font-black text-stone-400 uppercase tracking-widest">Net Realized Exposure</p>
                        <h2 className="text-3xl font-black text-white mt-1">{fmt(stats.exposure)}</h2>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    <CardContent className="p-7">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                <Hash size={24} />
                            </div>
                            <Badge variant="outline" className="bg-amber-50 border-0 font-black text-[10px]">
                                COUNT
                            </Badge>
                        </div>
                        <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Transaction Count</p>
                        <h2 className="text-3xl font-black text-gray-900 mt-1">{stats.count} <span className="text-xs text-stone-300 font-bold ml-1">Entries</span></h2>
                    </CardContent>
                </Card>
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
                    <div className="p-6 bg-stone-50/50 rounded-2xl mx-10 mb-4 border border-stone-100 animate-in slide-in-from-top-2 duration-300">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-4 px-2">Détails des Articles</h4>
                        <div className="bg-white rounded-xl border border-stone-100 overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-stone-50 text-stone-400 font-bold">
                                    <tr>
                                        <th className="px-4 py-3">Produit</th>
                                        <th className="px-4 py-3 text-center">Quantité</th>
                                        <th className="px-4 py-3 text-right">Prix Unit.</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {order.lines?.map((line: any, i: number) => (
                                        <tr key={i} className="hover:bg-stone-50/50 transition-colors">
                                            <td className="px-4 py-3 font-semibold text-stone-700">{line.product_name || `Produit #${line.product}`}</td>
                                            <td className="px-4 py-3 text-center font-bold text-stone-500">{line.quantity}</td>
                                            <td className="px-4 py-3 text-right text-stone-500">{fmt(parseFloat(line.unit_price))}</td>
                                            <td className="px-4 py-3 text-right font-black text-stone-900">{fmt(parseFloat(line.subtotal))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                className="rounded-[2.5rem] border-0 shadow-2xl shadow-stone-200/50 overflow-hidden bg-white"
                headerExtra={
                    <div className="flex items-center gap-3">
                        <div className="relative w-80">
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Rechercher par n° facture, client..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 h-12 rounded-[1rem] text-sm border-0 bg-stone-100 focus-visible:ring-indigo-500/30 transition-all focus:bg-white focus:shadow-sm"
                            />
                        </div>
                        <Button variant="outline" className="h-12 rounded-[1rem] border-stone-100 text-stone-500 gap-2 font-bold px-5 hover:bg-white hover:shadow-sm">
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
        </div>
    )
}
