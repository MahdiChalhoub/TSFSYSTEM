'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { SalesOrder } from '@/types/erp'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import Link from "next/link"
import {
    History, FileText, Printer, User, Search,
    Filter, Calendar, ChevronRight, Hash,
    ArrowUpRight, ArrowDownRight, RefreshCw,
    Download
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"

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

export default function OrderHistoryPage() {
    const { fmt } = useCurrency()
    const [orders, setOrders] = useState<SalesOrder[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadOrders() }, [])

    async function loadOrders() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('pos/orders/')
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
            key: 'ref_code',
            label: 'Transaction ID',
            sortable: true,
            render: (order) => (
                <div className="flex flex-col">
                    <span className="font-black text-gray-900 leading-tight">#{order.ref_code || order.id}</span>
                    <span className="text-[10px] font-mono text-indigo-500 font-bold uppercase tracking-tighter">
                        {order.invoice_number || 'NO INVOICE SEQ'}
                    </span>
                </div>
            )
        },
        {
            key: 'created_at',
            label: 'Posting Date',
            sortable: true,
            render: (order) => (
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-600">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '—'}
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium tracking-tight">
                        {order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                </div>
            )
        },
        {
            key: 'type',
            label: 'Type',
            sortable: true,
            render: (order) => (
                <span className={`text-[10px] font-black uppercase tracking-[0.1em] ${TYPE_CONFIG[order.type ?? '']?.color || ''}`}>
                    {order.type}
                </span>
            )
        },
        {
            key: 'contact_name',
            label: 'Consignee',
            sortable: true,
            render: (order) => (
                <div className="flex items-center gap-2.5 group/contact">
                    <div className="w-8 h-8 rounded-xl bg-stone-50 text-stone-400 flex items-center justify-center group-hover/contact:bg-indigo-50 group-hover/contact:text-indigo-600 transition-colors border border-stone-100">
                        <User size={14} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 tracking-tight">{order.contact_name || 'Walking Customer'}</span>
                </div>
            )
        },
        {
            key: 'status',
            label: 'Lifecycle',
            sortable: true,
            render: (order) => (
                <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[order.status ?? '']?.color || 'bg-stone-50 text-stone-500'}`}>
                    {STATUS_CONFIG[order.status ?? '']?.label || order.status}
                </Badge>
            )
        },
        {
            key: 'total_amount',
            label: 'Net Exposure',
            align: 'right',
            sortable: true,
            render: (order) => (
                <span className="font-black text-gray-900 tracking-tighter">{fmt(parseFloat(String(order.total_amount ?? 0)))}</span>
            )
        },
        {
            key: 'actions',
            label: '',
            align: 'right',
            render: (order) => (
                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-0 translate-x-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadInvoice(order.id, String(order.ref_code || order.id))}
                        className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"
                        title="Dispatch Invoice PDF"
                    >
                        <FileText size={15} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                    >
                        <Printer size={15} />
                    </Button>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-stone-400 hover:text-indigo-600">
                        <Link href={`/sales/${order.id}`}>
                            <ChevronRight size={18} />
                        </Link>
                    </Button>
                </div>
            )
        }
    ], [fmt])

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <History size={28} className="text-white" />
                        </div>
                        Transaction <span className="text-indigo-600">Dispatch</span> Ledger
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Global Audit & Fulfillment Log</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={loadOrders} variant="ghost" className="h-12 w-12 p-0 rounded-2xl text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <Button asChild className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                        <Link href="/sales">
                            <ArrowUpRight size={18} /> Direct Terminal
                        </Link>
                    </Button>
                </div>
            </header>

            <TypicalListView
                title="Operational Transaction Stream"
                data={orders}
                loading={loading}
                getRowId={(o) => o.id}
                columns={columns}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                pageSize={25}
                headerExtra={
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-stone-50 text-stone-400 border-stone-100 text-[10px] font-black uppercase px-3 h-6">
                            Live Ledger Active
                        </Badge>
                    </div>
                }
            />
        </div>
    )
}
