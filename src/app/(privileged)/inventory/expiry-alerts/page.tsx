// @ts-nocheck
'use client'

import { useState, useEffect, useMemo } from "react"
import type { ExpiryAlertResponse } from '@/types/erp'
import { getExpiryAlerts, scanForExpiry, acknowledgeAlert } from "@/app/actions/inventory/expiry-alerts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    AlertTriangle, Skull, Clock, Shield, RefreshCw,
    Search, CheckCircle2, Package, DollarSign, Boxes
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

const SEVERITY_CONFIG: Record<string, { color: string, bg: string, icon: Record<string, any>, label: string }> = {
    EXPIRED: { color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: Skull, label: 'Expired' },
    CRITICAL: { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: AlertTriangle, label: 'Critical (0-30 days)' },
    WARNING: { color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', icon: Clock, label: 'Warning (30-60 days)' },
}

export default function ExpiryAlertsPage() {
    const [data, setData] = useState<ExpiryAlertResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [scanning, setScanning] = useState(false)
    const [activeFilter, setActiveFilter] = useState<string | null>(null)
    const [showAcknowledged, setShowAcknowledged] = useState(false)

    useEffect(() => { loadData() }, [])

    async function loadData(severity?: string) {
        setLoading(true)
        try {
            const result = await getExpiryAlerts(severity, showAcknowledged)
            setData(result)
        } catch {
            toast.error("Failed to load expiry alerts")
        } finally {
            setLoading(false)
        }
    }

    async function handleScan() {
        setScanning(true)
        try {
            const result = await scanForExpiry()
            toast.success(result.message)
            await loadData(activeFilter || undefined)
        } catch {
            toast.error("Scan failed")
        } finally {
            setScanning(false)
        }
    }

    async function handleAcknowledge(alertId: number) {
        try {
            await acknowledgeAlert(alertId)
            toast.success("Alert acknowledged")
            await loadData(activeFilter || undefined)
        } catch {
            toast.error("Failed to acknowledge")
        }
    }

    function handleFilter(severity: string | null) {
        setActiveFilter(severity)
        loadData(severity || undefined)
    }

    const alerts = data?.alerts || []
    const stats = data?.stats || { expired: 0, critical: 0, warning: 0, total_value: 0, total_quantity: 0 }
    const totalAlerts = stats.expired + stats.critical + stats.warning

    if (loading && !data) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-app-foreground">Expiry Alerts</h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Monitor product batches nearing or past expiration</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={showAcknowledged}
                            onChange={e => { setShowAcknowledged(e.target.checked); loadData(activeFilter || undefined) }}
                            className="rounded"
                        />
                        Show Acknowledged
                    </label>
                    <Button
                        onClick={handleScan}
                        disabled={scanning}
                        variant="outline"
                        className="gap-2"
                    >
                        <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
                        Scan Now
                    </Button>
                </div>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-5 gap-4">
                {/* Total */}
                <Card
                    className={`cursor-pointer transition-all ${!activeFilter ? 'ring-2 ring-gray-900' : 'hover:shadow-md'}`}
                    onClick={() => handleFilter(null)}
                >
                    <CardContent className="py-4 text-center">
                        <Shield size={24} className="mx-auto mb-2 text-app-muted-foreground" />
                        <p className="text-3xl font-bold text-app-foreground">{totalAlerts}</p>
                        <p className="text-xs text-app-muted-foreground uppercase font-medium">Total Active</p>
                    </CardContent>
                </Card>

                {/* Expired */}
                <Card
                    className={`cursor-pointer transition-all border-l-4 border-l-red-500 ${activeFilter === 'EXPIRED' ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
                    onClick={() => handleFilter('EXPIRED')}
                >
                    <CardContent className="py-4 text-center">
                        <Skull size={24} className="mx-auto mb-2 text-red-500" />
                        <p className="text-3xl font-bold text-red-600">{stats.expired}</p>
                        <p className="text-xs text-red-500 uppercase font-medium">Expired</p>
                    </CardContent>
                </Card>

                {/* Critical */}
                <Card
                    className={`cursor-pointer transition-all border-l-4 border-l-orange-500 ${activeFilter === 'CRITICAL' ? 'ring-2 ring-orange-500' : 'hover:shadow-md'}`}
                    onClick={() => handleFilter('CRITICAL')}
                >
                    <CardContent className="py-4 text-center">
                        <AlertTriangle size={24} className="mx-auto mb-2 text-orange-500" />
                        <p className="text-3xl font-bold text-orange-600">{stats.critical}</p>
                        <p className="text-xs text-orange-500 uppercase font-medium">Critical</p>
                    </CardContent>
                </Card>

                {/* Warning */}
                <Card
                    className={`cursor-pointer transition-all border-l-4 border-l-yellow-500 ${activeFilter === 'WARNING' ? 'ring-2 ring-yellow-500' : 'hover:shadow-md'}`}
                    onClick={() => handleFilter('WARNING')}
                >
                    <CardContent className="py-4 text-center">
                        <Clock size={24} className="mx-auto mb-2 text-yellow-500" />
                        <p className="text-3xl font-bold text-yellow-600">{stats.warning}</p>
                        <p className="text-xs text-yellow-500 uppercase font-medium">Warning</p>
                    </CardContent>
                </Card>

                {/* Value at Risk */}
                <Card className="bg-gradient-to-br from-red-50 to-orange-50">
                    <CardContent className="py-4 text-center">
                        <DollarSign size={24} className="mx-auto mb-2 text-red-400" />
                        <p className="text-xl font-bold text-red-700">{fmt(stats.total_value)}</p>
                        <p className="text-xs text-red-400 uppercase font-medium">Value at Risk</p>
                        <p className="text-[10px] text-red-300 mt-1">{stats.total_quantity} units</p>
                    </CardContent>
                </Card>
            </div>

            {/* Alerts Table */}
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <AlertTriangle size={18} className="text-app-muted-foreground" />
                        Alert Details
                        {loading && <RefreshCw size={14} className="animate-spin text-app-faint" />}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {alerts.length === 0 ? (
                        <div className="text-center py-16 text-app-muted-foreground">
                            <CheckCircle2 size={48} className="mx-auto mb-3 text-emerald-300" />
                            <p className="text-lg font-medium text-emerald-500">All Clear!</p>
                            <p className="text-sm">No expiry alerts found. Click "Scan Now" to check for new alerts.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-app-surface/50">
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Expiry Date</TableHead>
                                    <TableHead className="text-right">Days Left</TableHead>
                                    <TableHead className="text-right">Qty at Risk</TableHead>
                                    <TableHead className="text-right">Value at Risk</TableHead>
                                    <TableHead>Warehouse</TableHead>
                                    <TableHead className="text-center">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {alerts.map((a: Record<string, any>) => {
                                    const cfg = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.WARNING
                                    const Icon = cfg.icon
                                    return (
                                        <TableRow key={a.id} className={`hover:bg-app-surface/50 ${a.is_acknowledged ? 'opacity-50' : ''}`}>
                                            <TableCell>
                                                <Badge className={`${cfg.bg} ${cfg.color} gap-1`}>
                                                    <Icon size={12} />
                                                    {a.severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-medium">{a.product_name}</TableCell>
                                            <TableCell className="font-mono text-sm">{a.batch_number}</TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground">
                                                {a.expiry_date || '—'}
                                            </TableCell>
                                            <TableCell className={`text-right font-bold ${a.days_until_expiry <= 0 ? 'text-red-600' :
                                                a.days_until_expiry <= 30 ? 'text-orange-600' : 'text-yellow-600'
                                                }`}>
                                                {a.days_until_expiry <= 0 ? `${Math.abs(a.days_until_expiry)} overdue` : `${a.days_until_expiry}d`}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {new Intl.NumberFormat('fr-FR').format(a.quantity_at_risk)}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-red-600">
                                                {fmt(a.value_at_risk)}
                                            </TableCell>
                                            <TableCell className="text-sm text-app-muted-foreground">{a.warehouse || '—'}</TableCell>
                                            <TableCell className="text-center">
                                                {!a.is_acknowledged ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleAcknowledge(a.id)}
                                                        className="text-xs gap-1 hover:bg-emerald-50 hover:text-emerald-700"
                                                    >
                                                        <CheckCircle2 size={14} />
                                                        Ack
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-emerald-500">✓ Acknowledged</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
