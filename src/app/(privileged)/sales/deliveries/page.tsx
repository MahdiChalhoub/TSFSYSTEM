'use client'

import { useState, useEffect, useMemo } from "react"
import type { DeliveryOrder } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Truck, Package, Clock, CheckCircle2, XCircle, AlertTriangle,
    Search, MapPin, Phone, Navigation, Ban
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; icon: any }> = {
    PENDING: { label: 'Pending', bg: 'bg-app-surface-2 text-app-foreground', icon: Clock },
    PREPARING: { label: 'Preparing', bg: 'bg-app-info-bg text-app-info', icon: Package },
    IN_TRANSIT: { label: 'In Transit', bg: 'bg-app-warning-bg text-app-warning', icon: Truck },
    DELIVERED: { label: 'Delivered', bg: 'bg-app-success-bg text-app-success', icon: CheckCircle2 },
    FAILED: { label: 'Failed', bg: 'bg-app-error-bg text-app-error', icon: XCircle },
    CANCELLED: { label: 'Cancelled', bg: 'bg-app-surface-2 text-app-muted-foreground', icon: Ban },
}

export default function DeliveryOrdersPage() {
    const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<number | null>(null)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('pos/deliveries/')
            setDeliveries(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load deliveries")
        } finally {
            setLoading(false)
        }
    }

    async function doAction(id: number, action: string, body?: Record<string, any>) {
        setActionLoading(id)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            await erpFetch(`pos/deliveries/${id}/${action}/`, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
            toast.success(`Delivery ${action} successful`)
            await loadData()
        } catch {
            toast.error(`Failed to ${action}`)
        } finally {
            setActionLoading(null)
        }
    }

    const filtered = useMemo(() => {
        let list = deliveries
        if (statusFilter) list = list.filter(d => d.status === statusFilter)
        if (search) {
            const s = search.toLowerCase()
            list = list.filter(d =>
                (d.order_ref || '').toLowerCase().includes(s) ||
                (d.recipient_name || '').toLowerCase().includes(s) ||
                (d.contact_name || '').toLowerCase().includes(s) ||
                (d.tracking_code || '').toLowerCase().includes(s) ||
                (d.city || '').toLowerCase().includes(s) ||
                (d.driver_name || '').toLowerCase().includes(s)
            )
        }
        return list
    }, [deliveries, search, statusFilter])

    const pending = deliveries.filter(d => d.status === 'PENDING' || d.status === 'PREPARING').length
    const inTransit = deliveries.filter(d => d.status === 'IN_TRANSIT').length
    const delivered = deliveries.filter(d => d.status === 'DELIVERED').length
    const totalFees = deliveries.reduce((s, d) => s + parseFloat(String(d.delivery_fee || 0)), 0)

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}</div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-app-foreground flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-app-info flex items-center justify-center">
                            <Truck size={20} className="text-white" />
                        </div>
                        Delivery Management
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Track and manage order deliveries & shipments</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <Input placeholder="Search deliveries..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4">
                <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-r from-indigo-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Truck size={24} className="text-app-info" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Total Deliveries</p>
                                <p className="text-2xl font-bold">{deliveries.length}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Clock size={24} className="text-app-warning" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Pending / Preparing</p>
                                <p className="text-2xl font-bold text-app-warning">{pending}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Navigation size={24} className="text-app-info" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">In Transit</p>
                                <p className="text-2xl font-bold text-app-info">{inTransit}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 size={24} className="text-app-success" />
                            <div>
                                <p className="text-xs text-app-muted-foreground uppercase">Delivered</p>
                                <p className="text-2xl font-bold text-app-success">{delivered}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Status Filter Tags */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={() => setStatusFilter(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${!statusFilter ? 'bg-app-bg text-white' : 'bg-app-surface-2 text-app-muted-foreground hover:bg-app-surface-2'
                        }`}
                >
                    All ({deliveries.length})
                </button>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const count = deliveries.filter(d => d.status === key).length
                    if (count === 0) return null
                    return (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(statusFilter === key ? null : key)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${statusFilter === key ? 'bg-app-bg text-white' : `${cfg.bg} hover:opacity-80`
                                }`}
                        >
                            {cfg.label} ({count})
                        </button>
                    )
                })}
                <div className="ml-auto text-xs text-app-muted-foreground">
                    Total fees: <span className="font-bold text-app-foreground">{fmt(totalFees)}</span>
                </div>
            </div>

            {/* Delivery Table */}
            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-app-muted-foreground">
                            <Truck size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No deliveries found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/50">
                                    <TableHead>ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Order</TableHead>
                                    <TableHead>Recipient</TableHead>
                                    <TableHead>Zone</TableHead>
                                    <TableHead>Driver</TableHead>
                                    <TableHead>Tracking</TableHead>
                                    <TableHead className="text-right">Fee</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((d: Record<string, any>) => {
                                    const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDING
                                    const Icon = cfg.icon
                                    const isLoading = actionLoading === d.id
                                    return (
                                        <TableRow key={d.id} className="hover:bg-app-surface/50">
                                            <TableCell className="font-mono text-xs font-bold">DEL-{d.id}</TableCell>
                                            <TableCell>
                                                <Badge className={`${cfg.bg} gap-1`}>
                                                    <Icon size={12} />
                                                    {cfg.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{d.order_ref || `ORD-${d.order}`}</TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-sm font-medium">{d.recipient_name || d.contact_name || '\u2014'}</p>
                                                    {d.city && <p className="text-[10px] text-app-muted-foreground flex items-center gap-1"><MapPin size={8} />{d.city}</p>}
                                                    {d.phone && <p className="text-[10px] text-app-muted-foreground flex items-center gap-1"><Phone size={8} />{d.phone}</p>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs">{d.zone_name || '\u2014'}</TableCell>
                                            <TableCell className="text-xs">{d.driver_name || '\u2014'}</TableCell>
                                            <TableCell className="font-mono text-xs">{d.tracking_code || '\u2014'}</TableCell>
                                            <TableCell className="text-right font-bold">{fmt(parseFloat(d.delivery_fee || 0))}</TableCell>
                                            <TableCell className="text-xs text-app-muted-foreground">
                                                {d.created_at ? new Date(d.created_at).toLocaleDateString('fr-FR') : '\u2014'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {(d.status === 'PENDING' || d.status === 'PREPARING') && (
                                                        <button
                                                            onClick={() => doAction(d.id, 'dispatch')}
                                                            disabled={isLoading}
                                                            className="px-2 py-1 bg-app-info-bg text-app-info rounded text-[10px] font-bold hover:bg-blue-200 transition-all disabled:opacity-50"
                                                        >
                                                            Dispatch
                                                        </button>
                                                    )}
                                                    {d.status === 'IN_TRANSIT' && (
                                                        <button
                                                            onClick={() => doAction(d.id, 'deliver')}
                                                            disabled={isLoading}
                                                            className="px-2 py-1 bg-app-success-bg text-app-success rounded text-[10px] font-bold hover:bg-green-200 transition-all disabled:opacity-50"
                                                        >
                                                            Deliver
                                                        </button>
                                                    )}
                                                    {d.status !== 'DELIVERED' && d.status !== 'CANCELLED' && d.status !== 'FAILED' && (
                                                        <>
                                                            <button
                                                                onClick={() => doAction(d.id, 'fail', { reason: 'Marked as failed' })}
                                                                disabled={isLoading}
                                                                className="px-2 py-1 bg-app-error-bg text-app-error rounded text-[10px] font-bold hover:bg-red-200 transition-all disabled:opacity-50"
                                                            >
                                                                Fail
                                                            </button>
                                                            <button
                                                                onClick={() => doAction(d.id, 'cancel')}
                                                                disabled={isLoading}
                                                                className="px-2 py-1 bg-app-surface-2 text-app-muted-foreground rounded text-[10px] font-bold hover:bg-app-surface-2 transition-all disabled:opacity-50"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </>
                                                    )}
                                                    {(d.status === 'DELIVERED' || d.status === 'CANCELLED' || d.status === 'FAILED') && (
                                                        <span className="text-[10px] text-app-muted-foreground italic">Final</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Delivery Timeline */}
            {deliveries.filter(d => d.dispatched_at || d.delivered_at).length > 0 && (
                <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm">Recent Delivery Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {deliveries
                                .filter(d => d.delivered_at || d.dispatched_at)
                                .sort((a, b) => new Date(b.delivered_at || b.dispatched_at || '').getTime() - new Date(a.delivered_at || a.dispatched_at || '').getTime())
                                .slice(0, 10)
                                .map(d => (
                                    <div key={`timeline-${d.id}`} className="flex items-center gap-3 text-sm">
                                        <div className={`w-2 h-2 rounded-full ${d.status === 'DELIVERED' ? 'bg-app-success' : d.status === 'IN_TRANSIT' ? 'bg-app-info' : 'bg-gray-400'}`} />
                                        <span className="font-mono text-xs text-app-muted-foreground w-14">DEL-{d.id}</span>
                                        <span className="font-medium">{d.recipient_name || d.contact_name || 'Unknown'}</span>
                                        <span className="text-app-muted-foreground">{'\u2192'}</span>
                                        <Badge className={STATUS_CONFIG[d.status ?? '']?.bg || 'bg-app-surface-2'}>{STATUS_CONFIG[d.status ?? '']?.label || d.status}</Badge>
                                        <span className="ml-auto text-xs text-app-muted-foreground">
                                            {new Date(d.delivered_at || d.dispatched_at || '').toLocaleString('fr-FR')}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
