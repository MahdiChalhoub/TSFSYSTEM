'use client'

import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { PurchaseReturn } from '@/types/erp'
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    RotateCcw, CheckCircle2, Truck, Search,
    Filter, Calendar, ChevronRight, User, PackageX,
    Hash, RefreshCw, ArrowUpRight, ShieldCheck, Building
} from "lucide-react"
import Link from "next/link"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Pending Processing', color: 'bg-amber-50 text-amber-700 border-amber-100' },
    COMPLETED: { label: 'Completed (Destocked)', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    CANCELLED: { label: 'Cancelled', color: 'bg-rose-50 text-rose-700 border-rose-100' },
}

export default function PurchaseReturnsPage() {
    const { fmt } = useCurrency()
    const [returns, setReturns] = useState<PurchaseReturn[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadReturns() }, [])

    async function loadReturns() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('purchase-returns/')
            setReturns(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load vendor debit stream")
        } finally {
            setLoading(false)
        }
    }

    async function completeReturn(id: number) {
        toast.loading("Initiating vendor destock sequence...")
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            await erpFetch(`purchase-returns/${id}/complete/`, { method: 'POST' })
            toast.dismiss()
            toast.success("Vendor return completed successfully")
            loadReturns()
        } catch (e: unknown) {
            toast.dismiss()
            toast.error((e instanceof Error ? e.message : String(e)) || "Processing failed")
        }
    }

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'id',
            label: 'Debit ID',
            render: (ret) => <span className="font-black text-gray-900 leading-tight">PRET-{ret.id}</span>
        },
        {
            key: 'original_order',
            label: 'Source PO',
            render: (ret) => (
                <Link href={`/purchases/${ret.original_order}`} className="flex items-center gap-1.5 group/link">
                    <div className="w-6 h-6 rounded bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400 group-hover/link:text-indigo-600 group-hover/link:bg-indigo-50 transition-colors">
                        <Hash size={10} />
                    </div>
                    <span className="text-xs font-bold text-indigo-600 group-hover/link:underline">
                        PO #{ret.original_order}
                    </span>
                </Link>
            )
        },
        {
            key: 'supplier_name',
            label: 'Vendor Entity',
            render: (ret) => (
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-center text-stone-400">
                        <Building size={14} />
                    </div>
                    <span className="text-sm font-semibold text-gray-700 tracking-tight">{ret.supplier_name || 'Legacy Vendor'}</span>
                </div>
            )
        },
        {
            key: 'status',
            label: 'Lifecycle Status',
            render: (ret) => (
                <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[ret.status ?? '']?.color || 'bg-stone-50 text-stone-500'}`}>
                    {STATUS_CONFIG[ret.status ?? '']?.label || ret.status}
                </Badge>
            )
        },
        {
            key: 'total_amount',
            label: 'Debit Exposure',
            align: 'right',
            render: (ret) => (
                <span className="font-black text-gray-900 tracking-tighter">{fmt(parseFloat(String(ret.total_amount || 0)))}</span>
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
                            className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-sm shadow-blue-100 gap-1.5"
                            onClick={() => completeReturn(ret.id)}
                        >
                            <Truck size={13} /> Ship Out
                        </Button>
                    )}
                    <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-stone-300 hover:text-blue-600 hover:bg-blue-50">
                        <Link href={`/purchases/returns/${ret.id}`}>
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
                        <div className="w-14 h-14 rounded-[1.5rem] bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                            <Truck size={28} className="text-white" />
                        </div>
                        Vendor <span className="text-blue-600">Debit</span> Ledger
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Outbound Restitution & Supplier Claims</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={loadReturns} variant="ghost" className="h-12 w-12 p-0 rounded-2xl text-stone-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all">
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-50">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Supply Guard Active</span>
                    </div>
                </div>
            </header>

            <TypicalListView
                title="Vendor Restitution Flow"
                data={returns}
                loading={loading}
                getRowId={(ret) => ret.id}
                columns={columns}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                pageSize={25}
                headerExtra={
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[10px] font-black uppercase px-3 h-6">
                            Verified Claims Only
                        </Badge>
                    </div>
                }
            />
        </div>
    )
}
