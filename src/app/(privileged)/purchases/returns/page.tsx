'use client'

import { useCurrency } from '@/lib/utils/currency'

import { useState, useEffect } from "react"
import type { PurchaseReturn } from '@/types/erp'
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    RotateCcw, CheckCircle2, Truck, Search,
    Filter, Calendar, ChevronRight, User, PackageX
} from "lucide-react"
import Link from "next/link"

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Pending Processing', color: 'bg-amber-100 text-amber-700' },
    COMPLETED: { label: 'Completed (Destocked)', color: 'bg-emerald-100 text-emerald-700' },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
}

export default function PurchaseReturnsPage() {
    const [returns, setReturns] = useState<PurchaseReturn[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadReturns() }, [])

    async function loadReturns() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('purchase-returns/')
            setReturns(Array.isArray(data) ? data : data.results || [])
        } catch { toast.error("Failed to load purchase returns") }
        finally { setLoading(false) }
    }

    async function completeReturn(id: number) {
        toast.loading("Completing return & removing stock...")
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            await erpFetch(`purchase-returns/${id}/complete/`, { method: 'POST' })
            toast.dismiss()
            toast.success("Return completed. Inventory reduced.")
            loadReturns()
        } catch (e: unknown) {
            toast.dismiss()
            toast.error((e instanceof Error ? e.message : String(e)) || "Completion failed")
        }
    }

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-100">
                            <Truck size={20} className="text-white" />
                        </div>
                        Supplier Returns
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage outbound returns to suppliers and track stock reductions</p>
                </div>
            </header>

            <Card className="shadow-sm border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">PRET ID</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">PO Link</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Supplier</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Debit Value</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {returns.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-20 text-gray-400 italic">No supplier returns found</TableCell></TableRow>
                        ) : (
                            returns.map(ret => (
                                <TableRow key={ret.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="font-bold font-mono">PRET-{ret.id}</TableCell>
                                    <TableCell className="font-medium text-indigo-600">
                                        <Link href={`/purchases/${ret.original_order}`} className="hover:underline">
                                            PO #{ret.original_order}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-sm font-semibold text-gray-700">{ret.supplier_name || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-black text-gray-900">{fmt(parseFloat(String(ret.total_amount || 0)))}</TableCell>
                                    <TableCell>
                                        <Badge className={`text-[10px] font-bold uppercase tracking-tighter ${STATUS_CONFIG[ret.status ?? '']?.color}`}>
                                            {STATUS_CONFIG[ret.status ?? '']?.label || ret.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {ret.status === 'PENDING' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-600 hover:text-white transition-all font-bold text-[10px] uppercase"
                                                        onClick={() => completeReturn(ret.id)}
                                                    >
                                                        <CheckCircle2 size={14} className="mr-1" /> Ship Out
                                                    </Button>
                                                </>
                                            )}
                                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><ChevronRight size={16} /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
}
