'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { SalesReturn } from '@/types/erp'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    RotateCcw, CheckCircle2, XCircle, Search,
    Filter, Calendar, ChevronRight, User, FileText,
    Hash, RefreshCw, Undo2, ArrowLeftRight, ShieldCheck
} from "lucide-react"
import Link from "next/link"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Pending Review', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    APPROVED: { label: 'Approved & Restocked', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    COMPLETED: { label: 'Completed', color: 'bg-blue-50 text-blue-700 border-blue-100' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
}

export default function SalesReturnsPage() {
    const { fmt } = useCurrency()
    const [returns, setReturns] = useState<SalesReturn[]>([])
    const [loading, setLoading] = useState(true)
    const settings = useListViewSettings('sales_returns', {
        columns: ['id', 'original_order_ref', 'customer_name', 'status', 'total_refund', 'actions'],
        pageSize: 25, sortKey: 'id', sortDir: 'desc'
    })

    useEffect(() => { loadReturns() }, [])

    async function loadReturns() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('sales-returns/')
            setReturns(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load restitution stream")
        } finally {
            setLoading(false)
        }
    }

    async function approveReturn(id: number) {
        toast.loading("Initiating inventory restitution...")
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            await erpFetch(`sales-returns/${id}/approve/`, { method: 'POST' })
            toast.dismiss()
            toast.success("Restock sequence completed")
            loadReturns()
        } catch (e: unknown) {
            toast.dismiss()
            toast.error((e instanceof Error ? e.message : String(e)) || "Restitution failed")
        }
    }

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'id',
            label: 'Restitution ID',
            render: (ret) => <span className="font-black text-gray-900 leading-tight">RET-{ret.id}</span>
        },
        {
            key: 'original_order_ref',
            label: 'Root Order',
            render: (ret) => (
                <Link href={`/sales/${ret.original_order}`} className="flex items-center gap-1.5 group/link">
                    <span className="font-mono text-xs font-bold text-indigo-600 group-hover/link:underline">
                        {ret.original_order_ref || `#${ret.original_order}`}
                    </span>
                    <FileText size={10} className="text-stone-300 group-hover/link:text-indigo-400 transition-colors" />
                </Link>
            )
        },
        {
            key: 'customer_name',
            label: 'Consignee',
            render: (ret) => (
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400">
                        <User size={12} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{ret.customer_name || 'N/A'}</span>
                </div>
            )
        },
        {
            key: 'status',
            label: 'Lifecycle',
            render: (ret) => (
                <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[ret.status ?? '']?.color || 'bg-stone-50 text-stone-500'}`}>
                    {STATUS_CONFIG[ret.status ?? '']?.label || ret.status}
                </Badge>
            )
        },
        {
            key: 'total_refund',
            label: 'Refund Value',
            align: 'right',
            render: (ret) => (
                <span className="font-black text-gray-900 tracking-tighter">{fmt(parseFloat(String(ret.total_refund || 0)))}</span>
            )
        },
        {
            key: 'actions',
            label: '',
            align: 'right',
            render: (ret) => (
                <div className="flex items-center justify-end gap-1.5">
                    {ret.status === 'PENDING' && (
                        <Button
                            size="sm"
                            className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm shadow-emerald-100 gap-1.5"
                            onClick={() => approveReturn(ret.id)}
                        >
                            <CheckCircle2 size={13} /> Restock
                        </Button>
                    )}
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-stone-300 hover:text-indigo-600 hover:bg-indigo-50">
                        <Link href={`/sales/returns/${ret.id}`}>
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
                    <h1 className="page-header-title  tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-200">
                            <RotateCcw size={28} className="text-white" />
                        </div>
                        Revenue <span className="text-amber-500">Restitution</span> Control
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Inventory Recovery & Credit Operations</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={loadReturns} variant="ghost" className="h-12 w-12 p-0 rounded-2xl text-stone-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Restitution Guard Active</span>
                    </div>
                </div>
            </header>

            <TypicalListView
                title="Monetary Restitution Flow"
                data={returns}
                loading={loading}
                getRowId={(ret) => ret.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                headerExtra={
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-100 text-[10px] font-black uppercase px-3 h-6">
                            Verified Returns Only
                        </Badge>
                    </div>
                }
            />
        </div>
    )
}
