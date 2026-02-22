'use client'

import { useState, useEffect, useTransition } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getExpiryAlerts, scanForExpiry, acknowledgeAlert } from "@/app/actions/inventory/expiry-alerts"
import { Badge } from '@/components/ui/badge'
import {
    Clock, Skull, AlertTriangle, ShieldCheck,
    RefreshCw, Trash2, Tag, ArrowRightLeft,
    Calendar, Package, MapPin
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCurrency } from '@/lib/utils/currency'

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    EXPIRED: { label: 'Expired', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200', icon: Skull },
    CRITICAL: { label: 'Critical (0-30d)', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: AlertTriangle },
    WARNING: { label: 'Warning (30-60d)', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
}

export function ExpiryAlertsClient({ initialData }: { initialData: any }) {
    const { fmt } = useCurrency()
    const settings = useListViewSettings('inv_expiry_alerts', {
        columns: ['batch', 'timeline', 'risk'],
        pageSize: 25,
        sortKey: 'timeline',
        sortDir: 'asc',
    })
    const [data, setData] = useState<any[]>(initialData?.alerts || [])
    const [loading, setLoading] = useState(false)
    const [isPending, startTransition] = useTransition()

    const loadData = async (severity?: string) => {
        setLoading(true)
        try {
            const res = await getExpiryAlerts(severity)
            setData(res?.alerts || [])
        } catch {
            toast.error("Cloud batch sync failed")
        } finally {
            setLoading(false)
        }
    }

    const handleAcknowledge = (id: number) => {
        startTransition(async () => {
            try {
                await acknowledgeAlert(id)
                toast.success("Batch risk acknowledged")
                loadData()
            } catch {
                toast.error("Failed to update status")
            }
        })
    }

    const columns = [
        {
            key: 'batch',
            label: 'Batch / Lot Info',
            alwaysVisible: true,
            render: (row: any) => (
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${(SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.WARNING).bg} border`}>
                        {(() => {
                            const Icon = (SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.WARNING).icon
                            return <Icon size={16} className={(SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.WARNING).color} />
                        })()}
                    </div>
                    <div>
                        <div className="font-bold text-gray-900">{row.product_name}</div>
                        <div className="text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1">
                            <Package size={10} /> {row.batch_number || 'No Lot #'}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: 'timeline',
            label: 'Expiry Timeline',
            render: (row: any) => (
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-700">{row.expiry_date}</span>
                    </div>
                    <Badge variant="outline" className={`text-[9px] uppercase font-black px-1.5 py-0 border-0 ${row.days_until_expiry <= 0 ? 'text-rose-600' :
                        row.days_until_expiry <= 30 ? 'text-orange-600' : 'text-amber-600'
                        }`}>
                        {row.days_until_expiry <= 0 ? 'OVERDUE' : `${row.days_until_expiry} DAYS REMAINING`}
                    </Badge>
                </div>
            )
        },
        {
            key: 'risk',
            label: 'At Risk Value',
            align: 'right' as const,
            render: (row: any) => (
                <div className="text-right">
                    <div className="text-sm font-black text-rose-600">{fmt(row.value_at_risk)}</div>
                    <div className="text-[9px] text-gray-400 font-bold uppercase">{row.quantity_at_risk} Units</div>
                </div>
            )
        }
    ]

    return (
        <TypicalListView
            title="Batch Expiry Timeline"
            data={data}
            loading={loading}
            getRowId={r => r.id}
            columns={columns}
            visibleColumns={settings.visibleColumns}
            onToggleColumn={settings.toggleColumn}
            pageSize={settings.pageSize}
            onPageSizeChange={settings.setPageSize}
            sortKey={settings.sortKey}
            sortDir={settings.sortDir}
            onSort={settings.setSort}
            addLabel="SCAN BATCH LIFECYCLES"
            onAdd={() => startTransition(async () => { await scanForExpiry(); loadData() })}
            headerExtras={
                <div className="flex items-center gap-2 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-amber-700 tracking-widest">Global Expiry Tracking Active</span>
                </div>
            }
            expandable={{
                renderActions: (row) => (
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-rose-100 text-rose-600 hover:bg-rose-50 font-black text-[10px] gap-2"
                            onClick={() => toast.info("Linked to Strategy: Disposal Manifest")}
                        >
                            <Trash2 size={14} /> DISPOSAL STRATEGY
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-black text-[10px] gap-2"
                            onClick={() => toast.info("Linked to Strategy: Clearance Sale")}
                        >
                            <Tag size={14} /> CLEARANCE CAMPAIGN
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-[10px] font-bold text-gray-400"
                            onClick={() => handleAcknowledge(row.id)}
                            disabled={isPending || row.is_acknowledged}
                        >
                            {row.is_acknowledged ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE RISK'}
                        </Button>
                    </div>
                ),
                getDetails: (row) => [
                    { label: 'Warehouse', value: row.warehouse || 'Global Storage' },
                    { label: 'Status', value: row.is_acknowledged ? 'Risk Managed' : 'Pending Review' }
                ]
            }}
            lifecycle={{
                getStatus: r => {
                    const cfg = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.WARNING
                    return { label: cfg.label, variant: r.severity === 'EXPIRED' ? 'danger' : r.severity === 'CRITICAL' ? 'warning' : 'default' }
                }
            }}
        >
            <TypicalFilter
                search={{
                    placeholder: "Search batch or product...",
                    value: "",
                    onChange: () => { }
                }}
                filters={[
                    {
                        key: 'severity', label: 'Urgency Level', type: 'select', options: [
                            { value: 'EXPIRED', label: 'Expired' },
                            { value: 'CRITICAL', label: 'Critical' },
                            { value: 'WARNING', label: 'Warning' }
                        ]
                    }
                ]}
                onChange={(k, v) => loadData(v as string)}
            />
        </TypicalListView>
    )
}
