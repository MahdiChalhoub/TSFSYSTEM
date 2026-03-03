'use client'
import { useCurrency } from '@/lib/utils/currency'
import { useState, useEffect, useMemo } from "react"
import type { DeliveryOrder } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 Truck, Package, Clock, CheckCircle2, XCircle, AlertTriangle,
 Search, MapPin, Phone, Navigation, Ban, RefreshCw,
 ChevronRight, ExternalLink, ShieldCheck, Activity, User
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
const STATUS_CONFIG: Record<string, { label: string; bg: string; icon: any; color: string }> = {
 PENDING: { label: 'Pending', bg: 'bg-app-background', icon: Clock, color: 'text-app-muted-foreground border-app-border' },
 PREPARING: { label: 'Preparing', bg: 'bg-app-info-bg', icon: Package, color: 'text-app-info border-app-info/30' },
 IN_TRANSIT: { label: 'In Transit', bg: 'bg-app-warning-bg', icon: Navigation, color: 'text-app-warning border-app-warning/30' },
 DELIVERED: { label: 'Delivered', bg: 'bg-app-primary-light', icon: CheckCircle2, color: 'text-app-primary border-app-success/30' },
 FAILED: { label: 'Failed', bg: 'bg-rose-50', icon: XCircle, color: 'text-rose-600 border-rose-100' },
 CANCELLED: { label: 'Cancelled', bg: 'bg-app-surface-2', icon: Ban, color: 'text-app-muted-foreground border-app-border' },
}
export default function DeliveryOrdersPage() {
 const { fmt } = useCurrency()
 const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([])
 const [loading, setLoading] = useState(true)
 const [statusFilter, setStatusFilter] = useState<string | null>(null)
 const [actionLoading, setActionLoading] = useState<number | null>(null)
 const settings = useListViewSettings('sales_deliveries', {
 columns: ['id', 'status', 'order_ref', 'recipient_name', 'zone_name', 'driver_name', 'tracking_code', 'delivery_fee', 'actions'],
 pageSize: 15, sortKey: 'id', sortDir: 'desc'
 })
 useEffect(() => { loadData() }, [])
 async function loadData() {
 setLoading(true)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 const data = await erpFetch('pos/deliveries/')
 setDeliveries(Array.isArray(data) ? data : data.results || [])
 } catch {
 toast.error("Failed to load delivery stream")
 } finally {
 setLoading(false)
 }
 }
 async function doAction(id: number, action: string, body?: Record<string, any>) {
 setActionLoading(id)
 try {
 const { erpFetch } = await import("@/lib/erp-api")
 await erpFetch(`pos/deliveries/${id}/${action}/`, { method: 'POST', body: body ? JSON.stringify(body) : undefined })
 toast.success(`Logistics ${action} successful`)
 await loadData()
 } catch {
 toast.error(`Dispatch sequence failed for ${action}`)
 } finally {
 setActionLoading(null)
 }
 }
 const filteredDeliveries = useMemo(() => {
 if (!statusFilter) return deliveries
 return deliveries.filter(d => d.status === statusFilter)
 }, [deliveries, statusFilter])
 const columns: ColumnDef<any>[] = useMemo(() => [
 {
 key: 'id',
 label: 'Waybill ID',
 width: '120px',
 render: (d) => <span className="font-mono text-[10px] font-black tracking-widest text-app-info bg-app-info-bg px-2 py-0.5 rounded-lg border border-app-info/30">DEL-{d.id}</span>
 },
 {
 key: 'status',
 label: 'Lifecycle',
 render: (d) => {
 const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.PENDING
 const Icon = cfg.icon
 return (
 <Badge variant="outline" className={`gap-1.5 text-[9px] font-black uppercase tracking-widest border ${cfg.bg} ${cfg.color}`}>
 <Icon size={12} />
 {cfg.label}
 </Badge>
 )
 }
 },
 {
 key: 'order_ref',
 label: 'Terminal Order',
 render: (d) => <span className="font-mono text-xs font-bold text-app-muted-foreground">{d.order_ref || `ORD-${d.order}`}</span>
 },
 {
 key: 'recipient_name',
 label: 'Consignee',
 render: (d) => (
 <div className="app-page flex flex-col">
 <span className="text-sm font-semibold text-app-foreground leading-tight">{d.recipient_name || d.contact_name || '—'}</span>
 <span className="text-[10px] text-app-muted-foreground flex items-center gap-1 mt-0.5">
 <MapPin size={10} className="text-app-muted-foreground" />
 {d.city || 'Standard Zone'}
 </span>
 </div>
 )
 },
 {
 key: 'zone_name',
 label: 'Logistics Zone',
 render: (d) => <span className="text-xs font-medium text-app-muted-foreground italic">{d.zone_name || 'Global'}</span>
 },
 {
 key: 'driver_name',
 label: 'Fleet Driver',
 render: (d) => (
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 rounded-lg bg-app-background border border-app-border flex items-center justify-center text-app-muted-foreground">
 <User size={12} />
 </div>
 <span className="text-xs font-bold text-app-muted-foreground">{d.driver_name || 'Unassigned'}</span>
 </div>
 )
 },
 {
 key: 'tracking_code',
 label: 'Tracking SEQ',
 render: (d) => <span className="font-mono text-[10px] text-app-primary font-bold">{d.tracking_code || '—'}</span>
 },
 {
 key: 'delivery_fee',
 label: 'Fulfillment Fee',
 align: 'right',
 render: (d) => <span className="font-black text-app-foreground tracking-tighter">{fmt(parseFloat(d.delivery_fee || 0))}</span>
 },
 {
 key: 'actions',
 label: '',
 align: 'right',
 render: (d) => {
 const isLoading = actionLoading === d.id
 return (
 <div className="flex gap-1.5 justify-end">
 {(d.status === 'PENDING' || d.status === 'PREPARING') && (
 <Button
 size="sm"
 onClick={() => doAction(d.id, 'dispatch')}
 disabled={isLoading}
 className="h-7 px-3 bg-app-info hover:bg-app-info text-app-foreground text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm"
 >
 Dispatch
 </Button>
 )}
 {d.status === 'IN_TRANSIT' && (
 <Button
 size="sm"
 onClick={() => doAction(d.id, 'deliver')}
 disabled={isLoading}
 className="h-7 px-3 bg-app-primary hover:bg-app-success text-app-foreground text-[9px] font-black uppercase tracking-widest rounded-lg transition-all shadow-sm"
 >
 Deliver
 </Button>
 )}
 {d.status !== 'DELIVERED' && d.status !== 'CANCELLED' && d.status !== 'FAILED' && (
 <Button
 size="sm"
 variant="ghost"
 onClick={() => doAction(d.id, 'cancel')}
 disabled={isLoading}
 className="h-7 w-7 p-0 rounded-lg text-app-muted-foreground hover:text-rose-600 hover:bg-rose-50"
 >
 <Ban size={14} />
 </Button>
 )}
 </div>
 )
 }
 }
 ], [fmt, actionLoading])
 const stats = useMemo(() => ({
 pending: deliveries.filter(d => ['PENDING', 'PREPARING'].includes(d.status ?? '')).length,
 inTransit: deliveries.filter(d => d.status === 'IN_TRANSIT').length,
 delivered: deliveries.filter(d => d.status === 'DELIVERED').length,
 totalFees: deliveries.reduce((s, d) => s + parseFloat(String(d.delivery_fee || 0)), 0)
 }), [deliveries])
 if (loading && deliveries.length === 0) {
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <Skeleton className="h-10 w-64" />
 <div className="grid grid-cols-4 gap-6">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
 <Skeleton className="h-96 rounded-3xl" />
 </div>
 )
 }
 return (
 <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <Truck size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Sales</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Delivery <span className="text-app-primary">Control</span>
          </h1>
        </div>
      </div>
    </header>
 {/* Tactical KPIs */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary/5 text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <Truck size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Shipment Volume</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-foreground">{deliveries.length}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase mt-1">Total Tracked</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-warning-bg text-app-warning flex items-center justify-center group-hover:scale-110 transition-transform">
 <Clock size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Queue & Prep</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-warning">{stats.pending}</p>
 <p className="text-[10px] text-app-warning font-bold uppercase mt-1">Awaiting Dispatch</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-info-bg text-app-info flex items-center justify-center group-hover:scale-110 transition-transform">
 <Navigation size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">In Transit</p>
 <p className="text-3xl font-black mt-1 tracking-tighter text-app-info">{stats.inTransit}</p>
 <p className="text-[10px] text-app-info font-bold uppercase mt-1">Live Freight</p>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-3xl border-0 shadow-sm bg-app-surface overflow-hidden group">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="w-16 h-16 rounded-[1.5rem] bg-app-primary-light text-app-primary flex items-center justify-center group-hover:scale-110 transition-transform">
 <Activity size={32} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Fulfillment Value</p>
 <p className="text-xl font-black mt-1 tracking-tight text-app-success">{fmt(stats.totalFees)}</p>
 <p className="text-[10px] text-app-primary font-bold uppercase mt-1">Aggregate Fees</p>
 </div>
 </CardContent>
 </Card>
 </div>
 <TypicalListView
 title="Logistics Manifest Stream"
 data={filteredDeliveries}
 loading={loading}
 getRowId={(d) => d.id}
 columns={columns}
 visibleColumns={settings.visibleColumns}
 onToggleColumn={settings.toggleColumn}
 pageSize={settings.pageSize}
 onPageSizeChange={settings.setPageSize}
 sortKey={settings.sortKey}
 sortDir={settings.sortDir}
 onSort={settings.setSort}
 className="rounded-3xl border-0 shadow-sm overflow-hidden"
 headerExtra={
 <div className="flex items-center gap-1 bg-app-surface-2 p-1 rounded-2xl">
 <Button
 variant={!statusFilter ? 'secondary' : 'ghost'}
 size="sm"
 onClick={() => setStatusFilter(null)}
 className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!statusFilter ? 'bg-app-surface shadow-sm text-app-info' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}
 >
 All Channel
 </Button>
 {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
 const count = deliveries.filter(d => d.status === key).length
 if (count === 0) return null
 return (
 <Button
 key={key}
 variant={statusFilter === key ? 'secondary' : 'ghost'}
 size="sm"
 onClick={() => setStatusFilter(key)}
 className={`h-8 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === key ? 'bg-app-surface shadow-sm text-app-info' : 'text-app-muted-foreground hover:text-app-muted-foreground'}`}
 >
 {cfg.label}
 </Button>
 )
 })}
 </div>
 }
 />
 {/* Logistics Timeline */}
 <Card className="rounded-[2.5rem] border-0 shadow-sm bg-app-surface overflow-hidden mt-8">
 <CardHeader className="p-8 border-b border-stone-50 flex flex-row items-center justify-between">
 <div>
 <CardTitle className="text-xl font-black tracking-tight text-app-foreground flex items-center gap-2">
 <Activity size={20} className="text-app-info" />
 Recent Operations Activity
 </CardTitle>
 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground mt-1">Real-time Fulfillment Sequence</p>
 </div>
 </CardHeader>
 <CardContent className="p-8">
 <div className="space-y-4">
 {deliveries
 .filter(d => d.delivered_at || d.dispatched_at)
 .sort((a, b) => new Date(b.delivered_at || b.dispatched_at || '').getTime() - new Date(a.delivered_at || a.dispatched_at || '').getTime())
 .slice(0, 8)
 .map(d => (
 <div key={`timeline-${d.id}`} className="flex items-center gap-4 group/item">
 <div className={`w-3 h-3 rounded-full border-2 ${d.status === 'DELIVERED' ? 'bg-app-primary border-app-success/30' : 'bg-app-info border-app-info/30'} animate-pulse`} />
 <span className="font-mono text-[10px] font-black text-app-muted-foreground w-16">DEL-{d.id}</span>
 <span className="font-bold text-app-foreground flex-1">{d.recipient_name || d.contact_name || 'Legacy Entity'}</span>
 <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-widest border ${STATUS_CONFIG[d.status ?? '']?.bg || 'bg-app-background'} ${STATUS_CONFIG[d.status ?? '']?.color || 'text-app-muted-foreground'}`}>
 {STATUS_CONFIG[d.status ?? '']?.label || d.status}
 </Badge>
 <span className="text-[10px] font-bold text-app-muted-foreground">
 {new Date(d.delivered_at || d.dispatched_at || '').toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
 </span>
 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity">
 <ExternalLink size={14} className="text-app-muted-foreground" />
 </Button>
 </div>
 ))}
 </div>
 </CardContent>
 </Card>
 </div>
 )
}
