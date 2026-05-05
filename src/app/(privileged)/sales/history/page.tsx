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
    History as HistoryIcon
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'bg-app-surface-2 text-app-muted-foreground' },
    PENDING: { label: 'Pending', color: 'bg-app-warning-bg text-app-warning' },
    COMPLETED: { label: 'Completed', color: 'bg-app-success-bg text-app-success' },
    INVOICED: { label: 'Invoiced', color: 'bg-app-info-bg text-app-info' },
    CANCELLED: { label: 'Cancelled', color: 'bg-app-error-bg text-app-error' },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    SALE: { label: 'Sale', color: 'text-app-success' },
    PURCHASE: { label: 'Purchase', color: 'text-app-info' },
    RETURN: { label: 'Return', color: 'text-app-error' },
}

export default function OrderHistoryPage() {
    const [orders, setOrders] = useState<SalesOrder[]>([])
    const [loading, setLoading] = useState(true)
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
                    <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-app-info flex items-center justify-center shadow-lg shadow-indigo-200">
                            <HistoryIcon size={20} className="text-white" />
                        </div>
                        Transaction History
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Review historical sales, purchases, and download official invoices</p>
                </div>
            </header>

            {/* Filter Bar */}
            <Card className="shadow-sm border-app-border">
                <CardContent className="p-4 flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" size={18} />
                        <Input
                            placeholder="Search Ref, Invoice #..."
                            className="pl-10 h-11 bg-app-surface/50 border-app-border"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>

                    <Select value={filters.type} onValueChange={v => setFilters({ ...filters, type: v })}>
                        <SelectTrigger className="w-40 h-11 bg-app-surface/50 border-app-border">
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
                        <SelectTrigger className="w-40 h-11 bg-app-surface/50 border-app-border">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Status</SelectItem>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <button className="h-11 px-6 bg-app-info-bg text-app-info rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-app-info-bg transition-colors">
                        <Calendar size={18} /> Date Range
                    </button>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="shadow-sm border-app-border overflow-hidden">
                <Table>
                    <TableHeader className="bg-app-surface/50">
                        <TableRow>
                            <TableHead className="font-bold text-app-muted-foreground uppercase text-[10px] tracking-wider">Order Reference</TableHead>
                            <TableHead className="font-bold text-app-muted-foreground uppercase text-[10px] tracking-wider">Date & Time</TableHead>
                            <TableHead className="font-bold text-app-muted-foreground uppercase text-[10px] tracking-wider">Type</TableHead>
                            <TableHead className="font-bold text-app-muted-foreground uppercase text-[10px] tracking-wider">Contact</TableHead>
                            <TableHead className="font-bold text-app-muted-foreground uppercase text-[10px] tracking-wider">Status</TableHead>
                            <TableHead className="font-bold text-app-muted-foreground uppercase text-[10px] tracking-wider text-right">Amount</TableHead>
                            <TableHead className="font-bold text-app-muted-foreground uppercase text-[10px] tracking-wider text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-20 text-app-muted-foreground italic">No transactions found matching filters</TableCell>
                            </TableRow>
                        ) : (
                            filtered.map(order => (
                                <TableRow key={order.id} className="group hover:bg-app-surface/50 transition-colors">
                                    <TableCell>
                                        <div className="font-bold text-app-foreground">#{order.ref_code || order.id}</div>
                                        <div className="text-[10px] font-mono text-app-info uppercase font-bold tracking-tighter">
                                            {order.invoice_number || 'No Invoice #'}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-medium text-app-muted-foreground">
                                            {order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                                        </div>
                                        <div className="text-[10px] text-app-muted-foreground">
                                            {order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className={`text-xs font-black uppercase tracking-widest ${TYPE_CONFIG[order.type ?? '']?.color || ''}`}>
                                            {order.type}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-app-surface-2 flex items-center justify-center text-app-muted-foreground group-hover:bg-app-info-bg group-hover:text-app-info transition-colors">
                                                <User size={14} />
                                            </div>
                                            <span className="text-sm font-medium text-app-foreground">{order.contact_name || 'Walking Customer'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-tighter ${STATUS_CONFIG[order.status ?? '']?.color || ''}`}>
                                            {STATUS_CONFIG[order.status ?? '']?.label || order.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="font-black text-app-foreground">{fmt(parseFloat(String(order.total_amount ?? 0)))}</div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => downloadInvoice(order.id, String(order.ref_code || order.id))}
                                                className="p-2 bg-app-info-bg text-app-info rounded-lg hover:bg-app-info hover:text-white transition-all shadow-sm"
                                                title="Download Invoice PDF"
                                            >
                                                <FileText size={18} />
                                            </button>
                                            <button className="p-2 bg-app-success-bg text-app-success rounded-lg hover:bg-app-success hover:text-white transition-all shadow-sm">
                                                <Printer size={18} />
                                            </button>
                                            <Link
                                                href={`/sales/${order.id}`}
                                                className="p-2 bg-app-surface text-app-muted-foreground rounded-lg hover:bg-app-surface-2 transition-all"
                                            >
                                                <ChevronRight size={18} />
                                            </Link>
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
