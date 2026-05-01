'use client'

import { useState, useTransition, type ComponentType } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { getExpiryAlerts, scanForExpiry, acknowledgeAlert } from "@/app/actions/inventory/expiry-alerts"
import { Badge } from '@/components/ui/badge'
import {
 Clock, Skull, AlertTriangle,
 Trash2, Tag,
 Calendar, Package
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useCurrency } from '@/lib/utils/currency'

type IconComponent = ComponentType<{ size?: number; className?: string }>

type ExpiryAlert = {
 id: number
 product_name?: string
 batch_number?: string
 expiry_date?: string
 days_until_expiry?: number
 value_at_risk?: number
 quantity_at_risk?: number
 severity?: string
 warehouse?: string
 is_acknowledged?: boolean
}

type InitialExpiryData = {
 alerts?: ExpiryAlert[]
 [key: string]: unknown
} | null | undefined

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: IconComponent }> = {
 EXPIRED: { label: 'Expired', color: 'text-app-error', bg: 'bg-app-error-bg border-app-error', icon: Skull },
 CRITICAL: { label: 'Critical (0-30d)', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: AlertTriangle },
 WARNING: { label: 'Warning (30-60d)', color: 'text-app-warning', bg: 'bg-app-warning-bg border-app-warning', icon: Clock },
}

export function ExpiryAlertsClient({ initialData }: { initialData: InitialExpiryData }) {
 const { fmt } = useCurrency()
 const settings = useListViewSettings('inv_expiry_alerts', {
 columns: ['batch', 'timeline', 'risk'],
 pageSize: 25,
 sortKey: 'timeline',
 sortDir: 'asc',
 })
 const [data, setData] = useState<ExpiryAlert[]>(initialData?.alerts || [])
 const [loading, setLoading] = useState(false)
 const [isPending, startTransition] = useTransition()

 const loadData = async (severity?: string) => {
 setLoading(true)
 try {
 const res = await getExpiryAlerts(severity) as { alerts?: ExpiryAlert[] } | null | undefined
 setData(res?.alerts || [])
 } catch {
 toast.error("Failed to load alerts")
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
 render: (row: ExpiryAlert) =>(
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-xl ${(SEVERITY_CONFIG[row.severity || 'WARNING'] || SEVERITY_CONFIG.WARNING).bg} border`}>
 {(() => {
 const cfg = SEVERITY_CONFIG[row.severity || 'WARNING'] || SEVERITY_CONFIG.WARNING
 const Icon = cfg.icon
 return <Icon size={16} className={cfg.color} />
 })()}
 </div>
 <div>
 <div className="font-bold text-app-foreground">{row.product_name}</div>
 <div className="text-[10px] text-app-muted-foreground font-black uppercase tracking-widest flex items-center gap-1">
 <Package size={10} /> {row.batch_number || 'No Lot #'}
 </div>
 </div>
 </div>
 )
 },
 {
 key: 'timeline',
 label: 'Expiry Timeline',
 render: (row: ExpiryAlert) =>(
 <div className="flex flex-col gap-1">
 <div className="flex items-center gap-2">
 <Calendar size={12} className="text-app-muted-foreground" />
 <span className="text-xs font-bold text-app-muted-foreground">{row.expiry_date}</span>
 </div>
 <Badge variant="outline" className={`text-[9px] uppercase font-black px-1.5 py-0 border-0 ${(row.days_until_expiry ?? 0) <= 0 ? 'text-app-error' :
 (row.days_until_expiry ?? 0) <= 30 ? 'text-app-warning' : 'text-app-warning'
 }`}>
 {(row.days_until_expiry ?? 0) <= 0 ? 'OVERDUE' : `${row.days_until_expiry} DAYS REMAINING`}
 </Badge>
 </div>
 )
 },
 {
 key: 'risk',
 label: 'At Risk Value',
 align: 'right' as const,
 render: (row: ExpiryAlert) =>(
 <div className="text-right">
 <div className="text-sm font-black text-app-error">{fmt(row.value_at_risk ?? 0)}</div>
 <div className="text-[9px] text-app-muted-foreground font-bold uppercase">{row.quantity_at_risk} Units</div>
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
 <div className="flex items-center gap-2 bg-app-warning-bg px-3 py-1 rounded-full border border-app-warning/30">
 <div className="w-1.5 h-1.5 bg-app-warning rounded-full animate-pulse" />
 <span className="text-[9px] font-black uppercase text-app-warning tracking-widest">Global Expiry Tracking Active</span>
 </div>
 }
 expandable={{
 columns: [
 { key: 'label', label: 'Detail' },
 { key: 'value', label: 'Value' },
 ],
 renderActions: (_detail, row: ExpiryAlert) => (
 <div className="flex gap-2">
 <Button
 size="sm"
 variant="outline"
 className="h-8 border-rose-100 text-app-error hover:bg-app-error-bg font-black text-[10px] gap-2"
 onClick={() => toast.info("Linked to Strategy: Disposal Manifest")}
 >
 <Trash2 size={14} /> DISPOSAL STRATEGY
 </Button>
 <Button
 size="sm"
 variant="outline"
 className="h-8 border-app-primary/30 text-app-primary hover:bg-app-primary/5 font-black text-[10px] gap-2"
 onClick={() => toast.info("Linked to Strategy: Clearance Sale")}
 >
 <Tag size={14} /> CLEARANCE CAMPAIGN
 </Button>
 <Button
 size="sm"
 variant="ghost"
 className="h-8 text-[10px] font-bold text-app-muted-foreground"
 onClick={() => handleAcknowledge(row.id)}
 disabled={isPending || row.is_acknowledged}
 >
 {row.is_acknowledged ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE RISK'}
 </Button>
 </div>
 ),
 getDetails: (row: ExpiryAlert) => [
 { label: 'Warehouse', value: row.warehouse || 'Global Storage' },
 { label: 'Status', value: row.is_acknowledged ? 'Risk Managed' : 'Pending Review' }
 ]
 }}
 lifecycle={{
 getStatus: (r: ExpiryAlert) => {
 const cfg = SEVERITY_CONFIG[r.severity || 'WARNING'] || SEVERITY_CONFIG.WARNING
 return { label: cfg.label, variant: (r.severity === 'EXPIRED' ? 'danger' : r.severity === 'CRITICAL' ? 'warning' : 'default') as 'danger' | 'warning' | 'default' }
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
