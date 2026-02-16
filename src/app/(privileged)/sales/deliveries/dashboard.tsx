'use client'

import { useState } from 'react'
import {
    Truck, MapPin, Package, Check, X, Clock, Send, AlertTriangle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    dispatchDelivery, deliverDelivery, failDelivery, cancelDelivery
} from '@/app/actions/deliveries'

interface Delivery {
    id: number; order: number; order_ref: string | null
    zone_name: string | null; contact_name: string | null
    status: string; recipient_name: string | null
    address_line1: string | null; city: string | null; phone: string | null
    tracking_code: string | null; delivery_fee: number
    driver_name: string | null; notes: string | null
    scheduled_date: string | null; dispatched_at: string | null
    delivered_at: string | null; created_at: string
}

interface Zone { id: number; name: string; base_fee: number; estimated_days: number }

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-700', icon: Clock },
    PREPARING: { label: 'Preparing', color: 'bg-blue-100 text-blue-700', icon: Package },
    IN_TRANSIT: { label: 'In Transit', color: 'bg-amber-100 text-amber-700', icon: Truck },
    DELIVERED: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700', icon: Check },
    FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-200 text-gray-500', icon: X },
}

export default function DeliveryDashboard({
    initialDeliveries, zones,
}: {
    initialDeliveries: Delivery[]
    zones: Zone[]
}) {
    const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries)
    const [filter, setFilter] = useState<string>('ALL')
    const [loading, setLoading] = useState(false)

    const statusCounts = deliveries.reduce((acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const filtered = filter === 'ALL'
        ? deliveries
        : deliveries.filter(d => d.status === filter)

    const refreshDelivery = async (id: number) => {
        const { getDelivery } = await import('@/app/actions/deliveries')
        const updated = await getDelivery(id)
        setDeliveries(prev => prev.map(d => d.id === id ? updated : d))
    }

    const handleAction = async (id: number, action: 'dispatch' | 'deliver' | 'fail' | 'cancel') => {
        setLoading(true)
        try {
            const fns = { dispatch: dispatchDelivery, deliver: deliverDelivery, fail: (i: number) => failDelivery(i), cancel: cancelDelivery }
            await fns[action](id)
            await refreshDelivery(id)
        } catch { /* ignore */ }
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon
                    return (
                        <button
                            key={key}
                            onClick={() => setFilter(filter === key ? 'ALL' : key)}
                            className={`p-3 rounded-xl border transition-all ${filter === key ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Icon size={14} className="text-gray-400" />
                                <span className="text-xs text-gray-500">{cfg.label}</span>
                            </div>
                            <p className="text-lg font-bold">{statusCounts[key] || 0}</p>
                        </button>
                    )
                })}
            </div>

            {/* Delivery List */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                        {filter === 'ALL' ? 'All Deliveries' : STATUS_CONFIG[filter]?.label || filter}
                        <Badge className="ml-2 bg-gray-100 text-gray-600">{filtered.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {filtered.length === 0 ? (
                        <p className="text-center text-gray-400 py-12">No deliveries</p>
                    ) : (
                        <div className="space-y-2">
                            {filtered.map(d => {
                                const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDING
                                return (
                                    <div key={d.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cfg.color}`}>
                                            <cfg.icon size={18} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">DEL-{d.id}</span>
                                                {d.order_ref && <span className="text-xs text-gray-400">→ {d.order_ref}</span>}
                                                <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                                {d.recipient_name && <span className="flex items-center gap-1"><MapPin size={10} />{d.recipient_name}</span>}
                                                {d.city && <span>{d.city}</span>}
                                                {d.zone_name && <span>Zone: {d.zone_name}</span>}
                                                {d.driver_name && <span>Driver: {d.driver_name}</span>}
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex gap-1 shrink-0">
                                            {['PENDING', 'PREPARING'].includes(d.status) && (
                                                <button onClick={() => handleAction(d.id, 'dispatch')} disabled={loading}
                                                    className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-200 disabled:opacity-40">
                                                    <Send size={12} className="inline mr-1" />Dispatch
                                                </button>
                                            )}
                                            {d.status === 'IN_TRANSIT' && (
                                                <>
                                                    <button onClick={() => handleAction(d.id, 'deliver')} disabled={loading}
                                                        className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-200 disabled:opacity-40">
                                                        <Check size={12} className="inline mr-1" />Delivered
                                                    </button>
                                                    <button onClick={() => handleAction(d.id, 'fail')} disabled={loading}
                                                        className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 disabled:opacity-40">
                                                        <AlertTriangle size={12} className="inline mr-1" />Failed
                                                    </button>
                                                </>
                                            )}
                                            {!['DELIVERED', 'CANCELLED'].includes(d.status) && (
                                                <button onClick={() => handleAction(d.id, 'cancel')} disabled={loading}
                                                    className="px-3 py-1.5 bg-gray-100 text-gray-500 text-xs font-bold rounded-lg hover:bg-gray-200 disabled:opacity-40">
                                                    <X size={12} className="inline mr-1" />Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Zones */}
            {zones.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Delivery Zones</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {zones.map(z => (
                                <div key={z.id} className="p-3 bg-gray-50 rounded-xl">
                                    <p className="text-sm font-medium">{z.name}</p>
                                    <div className="flex gap-3 text-xs text-gray-400 mt-1">
                                        <span>Fee: {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(z.base_fee)}</span>
                                        <span>{z.estimated_days} day{z.estimated_days > 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
