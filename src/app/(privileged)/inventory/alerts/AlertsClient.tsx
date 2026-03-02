'use client'

import { useState, useEffect, useTransition } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { erpFetch } from '@/lib/erp-api'
import { Badge } from '@/components/ui/badge'
import {
 AlertTriangle, Bell, ShieldAlert, XCircle,
 TrendingDown, RefreshCw, Package, Clock,
 ChevronRight, Play, MessageSquarePlus
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { createTransferOrder } from '@/app/actions/inventory/transfer-orders'

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
 INFO: { label: 'Info', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: Bell },
 WARNING: { label: 'Warning', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: AlertTriangle },
 CRITICAL: { label: 'Critical', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: ShieldAlert },
 EMERGENCY: { label: 'Emergency', color: 'text-rose-800', bg: 'bg-rose-100 border-rose-200', icon: XCircle },
}

export function AlertsClient({ initialAlerts }: { initialAlerts: any[] }) {
 const router = useRouter()
 const settings = useListViewSettings('inv_alerts', {
 columns: ['product', 'levels', 'created_at'],
 pageSize: 25,
 sortKey: 'created_at',
 sortDir: 'desc',
 })
 const [data, setData] = useState<any[]>(initialAlerts || [])
 const [loading, setLoading] = useState(false)
 const [isPending, startTransition] = useTransition()

 const loadData = async () => {
 setLoading(true)
 try {
 const res = await fetch('/api/proxy?path=stock-alerts/').then(r => r.json())
 setData(res || [])
 } catch {
 toast.error("Failed to update")
 } finally {
 setLoading(false)
 }
 }

 const handleQuickRestock = (alert: any) => {
 startTransition(async () => {
 try {
 // Bridge to the Strategy Layer
 // Create a draft Logistics Strategy (Transfer Order)
 const payload = {
 date: new Date().toISOString().split('T')[0],
 from_warehouse: alert.suggested_source_id || 1, // Fallback to main
 to_warehouse: alert.warehouse_id || 1,
 reason: `Low Stock Alert Auto-Response: ${alert.product_name}`,
 notes: `System generated strategy to resolve ${alert.severity} alert.`
 }
 const res = await createTransferOrder(payload)
 toast.success("Logistics Strategy Created! Redirecting...")
 router.push('/inventory/transfer-orders')
 } catch (e: any) {
 toast.error(e.message || "Failed to generate strategy")
 }
 })
 }

 const columns = [
 {
 key: 'product',
 label: 'Asset / Product',
 alwaysVisible: true,
 render: (row: any) => (
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-xl ${(SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.INFO).bg} border`}>
 {(() => {
 const Icon = (SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.INFO).icon
 return <Icon size={16} className={(SEVERITY_CONFIG[row.severity] || SEVERITY_CONFIG.INFO).color} />
 })()}
 </div>
 <div>
 <div className="font-bold text-app-text">{row.product_display || row.product_name || `ID: ${row.product}`}</div>
 <div className="text-[10px] text-app-text-faint font-black uppercase tracking-widest">{row.alert_type}</div>
 </div>
 </div>
 )
 },
 {
 key: 'levels',
 label: 'Health Metrics',
 render: (row: any) => (
 <div className="flex items-center gap-4">
 <div className="text-center">
 <div className="text-[9px] font-black text-app-text-faint uppercase tracking-tighter">Current</div>
 <div className="text-sm font-black text-app-text">{row.current_quantity ?? 0}</div>
 </div>
 <div className="w-px h-6 bg-app-surface-2" />
 <div className="text-center">
 <div className="text-[9px] font-black text-app-text-faint uppercase tracking-tighter">Threshold</div>
 <div className="text-sm font-black text-rose-500">{row.threshold ?? 0}</div>
 </div>
 </div>
 )
 },
 {
 key: 'created_at',
 label: 'Urgency Age',
 render: (row: any) => (
 <div className="flex items-center gap-1.5 text-app-text-faint">
 <Clock size={12} />
 <span className="text-xs font-medium">{new Date(row.created_at).toLocaleDateString()}</span>
 </div>
 )
 }
 ]

 return (
 <TypicalListView
 title="Stock Health Feed"
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
 addLabel="RUN GLOBAL SCAN"
 onAdd={() => toast.promise(loadData(), { loading: 'Scanning...', success: 'Scan complete', error: 'Scan failed' })}
 headerExtras={
 <div className="flex gap-2">
 <Badge variant="outline" className="bg-rose-50 text-rose-600 border-rose-100 font-black text-[10px]">
 {data.filter(a => a.severity === 'CRITICAL').length} CRITICAL
 </Badge>
 </div>
 }
 expandable={{
 columns: columns, // Fix type error: required property
 renderActions: (row) => (
 <div className="flex gap-2">
 <Button
 size="sm"
 variant="outline"
 className="h-8 border-indigo-100 text-indigo-600 hover:bg-indigo-50 font-black text-[10px] gap-2"
 onClick={() => handleQuickRestock(row)}
 disabled={isPending}
 >
 <MessageSquarePlus size={14} /> NEW WAREHOUSE ANALYTIC STRATEGY
 </Button>
 <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold text-app-text-faint">ACKNOWLEDGE ALERT</Button>
 </div>
 ),
 getDetails: (row) => [
 { label: 'Analytic Source', value: 'Warehouse Analytics (Stock vs Needs)' },
 { label: 'Suggested Action', value: 'Promotion to Logistics Strategy' },
 { label: 'Message', value: row.message || 'No additional context' }
 ]
 }}
 lifecycle={{
 getStatus: r => {
 const cfg = SEVERITY_CONFIG[r.severity] || SEVERITY_CONFIG.INFO
 return { label: cfg.label, variant: r.severity === 'CRITICAL' || r.severity === 'EMERGENCY' ? 'danger' : r.severity === 'WARNING' ? 'warning' : 'default' }
 }
 }}
 >
 <TypicalFilter
 search={{
 placeholder: "Search product health...",
 value: "",
 onChange: () => { }
 }}
 />
 </TypicalListView>
 )
}
