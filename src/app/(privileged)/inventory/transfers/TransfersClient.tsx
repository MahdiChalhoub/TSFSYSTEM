'use client'

import { useState, useEffect, useTransition } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getTransferOrders, lockTransferOrder, unlockTransferOrder } from '@/app/actions/inventory/transfer-orders'
import { Badge } from '@/components/ui/badge'
import { Truck, ArrowRightLeft, Package, Clock, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'

export function TransfersClient() {
    const { fmt } = useCurrency()
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()

    const loadData = async () => {
        setLoading(true)
        try {
            const res = await getTransferOrders()
            // Execution layer showing active movements
            setData(Array.isArray(res) ? res : res?.results || [])
        } catch {
            toast.error("Logistics engine sync failed")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { loadData() }, [])

    const columns = [
        {
            key: 'reference',
            label: 'Transit ID',
            alwaysVisible: true,
            render: (row: any) => <span className="font-mono font-bold text-gray-900">TRF-{row.reference || row.id}</span>
        },
        {
            key: 'date',
            label: 'Transit Date',
            render: (row: any) => <span className="text-gray-500">{new Date(row.date).toLocaleDateString()}</span>
        },
        {
            key: 'route',
            label: 'Terminal Route',
            render: (row: any) => (
                <div className="flex items-center gap-2 text-xs font-black">
                    <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[10px] rounded-lg">{row.from_warehouse_name || 'SRC'}</Badge>
                    <ArrowRightLeft size={10} className="text-gray-300" />
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] rounded-lg">{row.to_warehouse_name || 'DEST'}</Badge>
                </div>
            )
        },
        {
            key: 'volume',
            label: 'Load Volume',
            align: 'right' as const,
            render: (row: any) => <span className="font-black text-gray-900">{row.total_qty_transferred || 0} U</span>
        },
        {
            key: 'driver',
            label: 'Personnel',
            render: (row: any) => <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Truck size={12} className="text-gray-300" />{row.driver || 'Unassigned'}</span>
        }
    ]

    return (
        <TypicalListView
            title="Active Stock Transfers (Execution)"
            data={data}
            loading={loading}
            getRowId={r => r.id}
            columns={columns}
            addLabel="INITIATE MOVEMENT"
            onAdd={() => toast.info("Execute movements from the Logistics Manifest")}
            headerExtras={
                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">Real-World Logistics Active</span>
                </div>
            }
            lifecycle={{
                getStatus: r => {
                    const m: Record<string, any> = {
                        OPEN: { label: 'Operational Draft', variant: 'warning' },
                        LOCKED: { label: 'In Transit', variant: 'info' },
                        VERIFIED: { label: 'Docked / Completed', variant: 'success' },
                        CANCELED: { label: 'Aborted', variant: 'danger' }
                    }
                    return m[r.lifecycle_status || 'OPEN'] || { label: r.lifecycle_status, variant: 'default' }
                },
                getLocked: r => r.lifecycle_status !== 'OPEN',
                onLockToggle: (row) => {
                    if (row.lifecycle_status !== 'OPEN') {
                        toast.error("Locked transit documents require higher authorization to revert")
                        return
                    }
                    startTransition(async () => {
                        try {
                            await lockTransferOrder(row.id)
                            toast.success("Transit manifest locked and initiated")
                            loadData()
                        } catch {
                            toast.error("Failed to initiate transit")
                        }
                    })
                }
            }}
        >
            <TypicalFilter
                search={{
                    placeholder: "Search Route or Driver...",
                    value: "",
                    onChange: () => { }
                }}
            />
        </TypicalListView>
    )
}
