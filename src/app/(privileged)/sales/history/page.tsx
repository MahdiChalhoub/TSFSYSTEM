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
    Download, TrendingUp, DollarSign, Activity, AlertCircle
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { Card, CardContent } from "@/components/ui/card"

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
    const [searchQuery, setSearchQuery] = useState('')
    const settings = useListViewSettings('sales_history', {
        columns: ['ref_code', 'created_at', 'type', 'contact_name', 'status', 'total_amount', 'actions'],
        pageSize: 25, sortKey: 'created_at', sortDir: 'desc'
    })

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
                <div className="flex items-center justify-end gap-1.5 transition-all">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => downloadInvoice(order.id, String(order.ref_code || order.id))}
                        className="h-8 w-8 rounded-lg text-stone-400 hover:text-indigo-600 hover:bg-indigo-50"
                        title="Dispatch Invoice PDF"
                    >
                        <FileText size={15} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-stone-400 hover:text-emerald-600 hover:bg-emerald-50"
                    >
                        <Printer size={15} />
                    </Button>
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-stone-300 hover:text-indigo-600">
                        <Link href={`/sales/${order.id}`}>
                            <ChevronRight size={18} />
                        </Link>
                    </Button>
                </div>
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
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
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
                title="Operational Transaction Stream"
                data={filteredOrders}
                loading={loading}
                getRowId={(o) => o.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="rounded-[2.5rem] border-0 shadow-sm overflow-hidden bg-white"
                headerExtra={
                    <div className="flex items-center gap-3">
                        <div className="relative w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                            <Input
                                placeholder="Search transactions..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 h-11 rounded-xl text-sm border-0 bg-stone-100 focus-visible:ring-indigo-500/30"
                            />
                        </div>
                        <Button variant="outline" className="h-11 rounded-xl border-stone-100 text-stone-400 gap-2">
                            <Filter size={14} /> Filter
                        </Button>
                    </div>
                }
            />
        </div>
    )
}
