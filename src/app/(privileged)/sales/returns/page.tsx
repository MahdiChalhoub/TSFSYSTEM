'use client'

import { useState, useEffect } from "react"
import type { SalesReturn } from '@/types/erp'
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    RotateCcw, CheckCircle2, XCircle, Search,
    Filter, Calendar, ChevronRight, User, FileText
} from "lucide-react"
import Link from "next/link"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700' },
    APPROVED: { label: 'Approved & Restocked', color: 'bg-emerald-100 text-emerald-700' },
    COMPLETED: { label: 'Completed', color: 'bg-blue-100 text-blue-700' },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
}

export default function SalesReturnsPage() {
    const [returns, setReturns] = useState<SalesReturn[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadReturns() }, [])

    async function loadReturns() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('sales-returns/')
            setReturns(Array.isArray(data) ? data : data.results || [])
        } catch { toast.error("Failed to load sales returns") }
        finally { setLoading(false) }
    }

    async function approveReturn(id: number) {
        toast.loading("Approving return & restocking...")
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            await erpFetch(`sales-returns/${id}/approve/`, { method: 'POST' })
            toast.dismiss()
            toast.success("Return approved. Inventory updated.")
            loadReturns()
        } catch (e: any) {
            toast.dismiss()
            toast.error(e.message || "Approval failed")
        }
    }

    if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96" /></div>

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tighter flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-100">
                            <RotateCcw size={20} className="text-white" />
                        </div>
                        Customer Returns
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage product returns, approval workflows, and restock levels</p>
                </div>
            </header>

            <Card className="shadow-sm border-gray-200 overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Return ID</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Original Order</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Customer</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Refund Amount</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest">Status</TableHead>
                            <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {returns.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-20 text-gray-400 italic">No returns found</TableCell></TableRow>
                        ) : (
                            returns.map(ret => (
                                <TableRow key={ret.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="font-bold font-mono">RET-{ret.id}</TableCell>
                                    <TableCell className="font-medium text-indigo-600">
                                        <Link href={`/sales/${ret.original_order}`} className="hover:underline">
                                            {ret.original_order_ref || `#${ret.original_order}`}
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-sm font-semibold text-gray-700">{ret.customer_name || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-black text-gray-900">{fmt(parseFloat(ret.total_refund || 0))}</TableCell>
                                    <TableCell>
                                        <Badge className={`text-[10px] font-bold uppercase tracking-tighter ${STATUS_CONFIG[ret.status]?.color}`}>
                                            {STATUS_CONFIG[ret.status]?.label || ret.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {ret.status === 'PENDING' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-600 hover:text-white transition-all font-bold text-[10px] uppercase"
                                                        onClick={() => approveReturn(ret.id)}
                                                    >
                                                        <CheckCircle2 size={14} className="mr-1" /> Approve
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
