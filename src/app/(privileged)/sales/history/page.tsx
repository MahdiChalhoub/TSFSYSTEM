'use client'

import { useState, useEffect } from "react"
import type { SalesOrder } from '@/types/erp'
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"
import {
    ShoppingCart, Download, Printer, FileText, Search,
    Filter, Calendar, ChevronRight, User, Hash, MoreVertical,
    History as HistoryIcon, Lock, Unlock, ShieldCheck, CheckCircle2, Clock
} from "lucide-react"
import { lockOrder, unlockOrder, verifyOrder, confirmOrder, getOrderHistory } from "@/app/actions/pos/orders"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
    PENDING: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
    COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
    INVOICED: { label: 'Invoiced', color: 'bg-blue-100 text-blue-700' },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    SALE: { label: 'Sale', color: 'text-emerald-600' },
    PURCHASE: { label: 'Purchase', color: 'text-blue-600' },
    RETURN: { label: 'Return', color: 'text-rose-600' },
}

interface TransactionHistory {
    action: string;
    comment?: string;
    performed_by: string;
    performed_at: string;
}

const LIFECYCLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    OPEN: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: Clock },
    LOCKED: { label: 'Locked', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Lock },
    VERIFIED: { label: 'Verified', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: ShieldCheck },
    CONFIRMED: { label: 'Confirmed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
}

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<SalesOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, setIsPending] = useState(false)
    const [commentOpen, setCommentOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [historyData, setHistoryData] = useState<TransactionHistory[]>([])
    const [selectedOrder, setSelectedOrder] = useState<any>(null)
    const [filters, setFilters] = useState({
        search: '',
        type: 'ALL',
        status: 'ALL'
    })

    useEffect(() => { loadOrders() }, [])

    async function loadOrders() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('pos/orders/')
            setOrders(Array.isArray(data) ? data : data.results || [])
        } catch { toast.error("Failed to load order history") }
        finally { setLoading(false) }
    }

    async function downloadInvoice(orderId: number, ref: string) {
        toast.loading(`Generating PDF for Order #${ref}...`)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const blob = await erpFetch(`pos/${orderId}/invoice-pdf/`)

            if (!(blob instanceof Blob)) {
                throw new Error("Invalid response format")
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
            toast.success("Invoice downloaded successfully")
        } catch (e) {
            toast.dismiss()
            toast.error("Failed to download invoice")
            console.error(e)
        }
    }

    // ── Lifecycle Handlers ──────────────────────
    async function handleLock(id: number) {
        setIsPending(true)
        try { await lockOrder(id); toast.success("Order locked"); loadOrders() }
        catch (err: any) { toast.error(err.message || "Failed to lock") }
        finally { setIsPending(false) }
    }
    async function handleUnlock(id: number, comment: string) {
        setIsPending(true)
        try { await unlockOrder(id, comment); toast.success("Order unlocked"); setCommentOpen(false); loadOrders() }
        catch (err: any) { toast.error(err.message || "Failed to unlock") }
        finally { setIsPending(false) }
    }
    async function handleVerify(id: number) {
        setIsPending(true)
        try { await verifyOrder(id); toast.success("Order verified"); loadOrders() }
        catch (err: any) { toast.error(err.message || "Failed to verify") }
        finally { setIsPending(false) }
    }
    async function handleConfirm(id: number) {
        setIsPending(true)
        try { await confirmOrder(id); toast.success("Order confirmed"); loadOrders() }
        catch (err: any) { toast.error(err.message || "Failed to confirm") }
        finally { setIsPending(false) }
    }
    async function showHistory(id: number) {
        try {
            const history = await getOrderHistory(id)
            setHistoryData(history)
            setHistoryOpen(true)
        } catch { toast.error("Failed to load history") }
    }

    const filtered = orders.filter(o => {
        const matchesSearch = !filters.search ||
            o.ref_code?.toLowerCase().includes(filters.search.toLowerCase()) ||
            o.invoice_number?.toLowerCase().includes(filters.search.toLowerCase())
        const matchesType = filters.type === 'ALL' || o.type === filters.type
        const matchesStatus = filters.status === 'ALL' || o.status === filters.status
        return matchesSearch && matchesType && matchesStatus
    })

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <HistoryIcon size={20} className="text-white" />
                        </div>
                        Transaction History
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Review historical sales, purchases, and download official invoices</p>
                </div>
            </header>

            {/* Filter Bar */}
            <Card className="shadow-sm border-gray-200">
                <CardContent className="p-4 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <Input
                            placeholder="Search Ref, Invoice #..."
                            className="pl-10 h-11 bg-gray-50/50 border-gray-200"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>

                    <Select value={filters.type} onValueChange={v => setFilters({ ...filters, type: v })}>
                        <SelectTrigger className="w-40 h-11 bg-gray-50/50 border-gray-200">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Types</SelectItem>
                            <SelectItem value="SALE">Sales</SelectItem>
                            <SelectItem value="PURCHASE">Purchases</SelectItem>
                            <SelectItem value="RETURN">Returns</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={filters.status} onValueChange={v => setFilters({ ...filters, status: v })}>
                        <SelectTrigger className="w-40 h-11 bg-gray-50/50 border-gray-200">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <button className="h-11 px-6 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-indigo-100 transition-colors">
                        <Calendar size={18} /> Date Range
                    </button>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="shadow-sm border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-wider">Order Reference</TableHead>
                            <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-wider">Date & Time</TableHead>
                            <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-wider">Type</TableHead>
                            <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-wider">Contact</TableHead>
                            <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-wider">Status</TableHead>
                            <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-wider text-right">Amount</TableHead>
                            <TableHead className="font-bold text-gray-400 uppercase text-[10px] tracking-wider text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-20 text-gray-400 italic">No transactions found matching filters</TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((order: SalesOrder) => (
                                <TableRow key={order.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <TableCell>
                                        <div className="font-bold text-gray-900">#{order.ref_code || order.id}</div>
                                        <div className="text-[10px] font-mono text-indigo-500 uppercase font-bold tracking-tighter">
                                            {order.invoice_number || 'No Invoice #'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium text-gray-600">
                                            {order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className={`text-xs font-black uppercase tracking-widest ${TYPE_CONFIG[order.type || '']?.color || ''}`}>
                                            {order.type}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                                <User size={14} />
                                            </div>
                                            <span className="text-sm font-medium text-gray-700">{order.contact_name || 'Walking Customer'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-tighter ${STATUS_CONFIG[order.status || '']?.color || ''}`}>
                                                {STATUS_CONFIG[order.status || '']?.label || order.status}
                                            </Badge>
                                            {order.lifecycle_status && order.lifecycle_status !== 'OPEN' && (
                                                <Badge variant="outline" className={`gap-1 rounded-lg border ${LIFECYCLE_CONFIG[order.lifecycle_status]?.bg || 'bg-gray-50'} ${LIFECYCLE_CONFIG[order.lifecycle_status]?.color || 'text-gray-500'} font-bold text-[9px] uppercase`}>
                                                    {order.lifecycle_status as string}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="font-black text-gray-900">{fmt(parseFloat(String(order.total_amount ?? 0)))}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Standard Actions */}
                                            <button
                                                onClick={() => downloadInvoice(order.id, String(order.ref_code || order.id))}
                                                className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                title="Download Invoice PDF"
                                            >
                                                <FileText size={16} />
                                            </button>

                                            {/* Lifecycle Actions */}
                                            {order.lifecycle_status === 'OPEN' && (
                                                <button
                                                    onClick={() => handleLock(order.id)}
                                                    disabled={isPending}
                                                    className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                                                    title="Lock"
                                                >
                                                    <Lock size={16} />
                                                </button>
                                            )}
                                            {order.lifecycle_status === 'LOCKED' && (
                                                <>
                                                    <button
                                                        onClick={() => { setSelectedOrder(order); setCommentOpen(true) }}
                                                        disabled={isPending}
                                                        className="p-1.5 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-600 hover:text-white transition-all shadow-sm"
                                                        title="Unlock"
                                                    >
                                                        <Unlock size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleVerify(order.id)}
                                                        disabled={isPending}
                                                        className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-600 hover:text-white transition-all shadow-sm"
                                                        title="Verify"
                                                    >
                                                        <ShieldCheck size={16} />
                                                    </button>
                                                </>
                                            )}
                                            {order.lifecycle_status === 'VERIFIED' && (
                                                <button
                                                    onClick={() => handleConfirm(order.id)}
                                                    disabled={isPending}
                                                    className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                    title="Confirm"
                                                >
                                                    <CheckCircle2 size={16} />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => showHistory(order.id)}
                                                className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-200 transition-all"
                                                title="Lifecycle History"
                                            >
                                                <HistoryIcon size={16} />
                                            </button>

                                            <Link
                                                href={`/sales/${order.id}`}
                                                className="p-1.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-200 transition-all"
                                            >
                                                <ChevronRight size={16} />
                                            </Link>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* ─── Unlock Comment Dialog ────────────────────────── */}
            <Dialog open={commentOpen} onOpenChange={setCommentOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Unlock size={18} /> Unlock Order</DialogTitle>
                        <DialogDescription>Provide a reason for unlocking this order.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleUnlock(selectedOrder.id, fd.get('comment') as string) }} className="space-y-4">
                        <Input name="comment" required placeholder="Reason for unlocking..." className="rounded-xl h-11" />
                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setCommentOpen(false)} className="h-10 px-4 border rounded-lg text-sm font-bold">Cancel</button>
                            <button type="submit" disabled={isPending} className="h-10 px-4 bg-indigo-600 text-white rounded-lg text-sm font-bold disabled:opacity-50">Unlock</button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ─── History Dialog ───────────────────────────────── */}
            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><HistoryIcon size={18} /> Lifecycle History</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-80 overflow-y-auto space-y-2 mt-4">
                        {historyData.length === 0 && <p className="text-center text-gray-400 py-4">No history records.</p>}
                        {historyData.map((h, i) => (
                            <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                                <p className="text-sm font-bold text-gray-800">{h.action}</p>
                                {h.comment && <p className="text-xs text-gray-500 mt-1 italic">"{h.comment}"</p>}
                                <p className="text-[10px] text-gray-400 mt-2 font-medium">
                                    By {h.performed_by || 'Unknown'} on {new Date(h.performed_at).toLocaleString('fr-FR')}
                                </p>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
