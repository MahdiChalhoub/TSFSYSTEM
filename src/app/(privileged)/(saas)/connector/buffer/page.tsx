// @ts-nocheck
'use client'

/**
 * Connector Buffer Management
 * =============================
 * View and manage buffered requests awaiting replay.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import {
 ArrowLeft, RefreshCw, Database, Play, Clock,
 CheckCircle2, XCircle, AlertTriangle, Search
} from 'lucide-react'
import { toast } from 'sonner'
import {
 getBufferedRequests,
 retryBufferedRequest,
 replayAllBuffered,
 cleanupExpiredBuffers
} from '@/app/actions/saas/connector'

interface BufferedRequest {
 id: number
 target_module: string
 target_endpoint: string
 source_module: string
 organization: number
 organization_name: string
 method: string
 payload: Record<string, unknown>
 status: 'pending' | 'replayed' | 'expired' | 'failed'
 retry_count: number
 max_retries: number
 created_at: string
 expires_at: string
 replayed_at: string | null
 last_error: string | null
 is_expired: boolean
 can_retry: boolean
}

const statusColors = {
 pending: 'bg-app-warning',
 replayed: 'bg-app-primary',
 expired: 'bg-app-border',
 failed: 'bg-app-error'
}

const statusIcons = {
 pending: Clock,
 replayed: CheckCircle2,
 expired: AlertTriangle,
 failed: XCircle
}

export default function ConnectorBufferPage() {
 const [buffers, setBuffers] = useState<BufferedRequest[]>([])
 const [loading, setLoading] = useState(true)
 const [retrying, setRetrying] = useState<number | null>(null)
 const [filterStatus, setFilterStatus] = useState<string>('all')
 const [filterModule, setFilterModule] = useState<string>('')

 useEffect(() => {
 loadBuffers()
 }, [filterStatus, filterModule])

 async function loadBuffers() {
 setLoading(true)
 try {
 const filters: { status?: string; module?: string } = {}
 if (filterStatus !== 'all') filters.status = filterStatus
 if (filterModule) filters.module = filterModule

 const data = await getBufferedRequests(filters)
 setBuffers(data)
 } catch {
 toast.error('Failed to load buffers')
 } finally {
 setLoading(false)
 }
 }

 async function handleRetry(id: number) {
 setRetrying(id)
 try {
 const res = await retryBufferedRequest(id)
 if (res.success) {
 toast.success('Request replayed successfully')
 await loadBuffers()
 } else {
 toast.error(res.error)
 }
 } catch {
 toast.error('Retry failed')
 } finally {
 setRetrying(null)
 }
 }

 async function handleCleanup() {
 try {
 const res = await cleanupExpiredBuffers()
 if (res.success) {
 toast.success(`Cleaned up ${res.data?.expired_count || 0} expired buffers`)
 await loadBuffers()
 } else {
 toast.error(res.error)
 }
 } catch {
 toast.error('Cleanup failed')
 }
 }

 const pendingCount = buffers.filter(b => b.status === 'pending').length
 const replayedCount = buffers.filter(b => b.status === 'replayed').length
 const failedCount = buffers.filter(b => b.status === 'failed').length
 const expiredCount = buffers.filter(b => b.status === 'expired').length

 return (
 <div className="app-page space-y-6 animate-in fade-in duration-500">
 {/* Header */}
 <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
 <div>
 <Link href="/connector" className="text-app-muted-foreground hover:text-app-muted-foreground flex items-center gap-2 mb-4 text-sm font-medium">
 <ArrowLeft size={16} />
 Back to Connector Dashboard
 </Link>
 <div className="flex items-center gap-3 mb-2">
 <div className="p-3 rounded-2xl bg-app-warning-bg text-app-warning">
 <Database size={28} />
 </div>
 </div>
 <h2 className="text-3xl font-black text-app-foreground tracking-tight">Buffer Queue</h2>
 <p className="text-app-muted-foreground mt-2 font-medium">Buffered write requests awaiting module availability</p>
 </div>
 <div className="flex gap-3">
 <Button
 onClick={handleCleanup}
 variant="outline"
 className="rounded-2xl px-6 py-5 font-bold text-app-warning border-app-warning hover:bg-app-warning-bg"
 >
 <AlertTriangle size={18} />
 Cleanup Expired
 </Button>
 <Button
 onClick={() => loadBuffers()}
 disabled={loading}
 variant="outline"
 className="rounded-2xl px-6 py-5 font-bold"
 >
 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
 Refresh
 </Button>
 </div>
 </div>

 {/* Stats Row */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card className="rounded-2xl border-app-warning/30 bg-app-warning-bg">
 <CardContent className="p-4 flex items-center gap-4">
 <Clock className="text-app-warning" size={24} />
 <div>
 <div className="text-2xl font-black text-app-warning">{pendingCount}</div>
 <div className="text-xs text-app-warning font-medium">Pending</div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-app-success/30 bg-app-primary-light">
 <CardContent className="p-4 flex items-center gap-4">
 <CheckCircle2 className="text-app-primary" size={24} />
 <div>
 <div className="text-2xl font-black text-app-primary">{replayedCount}</div>
 <div className="text-xs text-app-primary font-medium">Replayed</div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-app-error/30 bg-app-error-bg">
 <CardContent className="p-4 flex items-center gap-4">
 <XCircle className="text-app-error" size={24} />
 <div>
 <div className="text-2xl font-black text-app-error">{failedCount}</div>
 <div className="text-xs text-app-error font-medium">Failed</div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-app-border bg-app-background">
 <CardContent className="p-4 flex items-center gap-4">
 <AlertTriangle className="text-app-muted-foreground" size={24} />
 <div>
 <div className="text-2xl font-black text-app-muted-foreground">{expiredCount}</div>
 <div className="text-xs text-app-muted-foreground font-medium">Expired</div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Filters */}
 <Card className="rounded-2xl border-app-border">
 <CardContent className="p-4 flex flex-wrap gap-4 items-center">
 <div className="flex items-center gap-2">
 <Search size={18} className="text-app-muted-foreground" />
 <span className="text-sm font-medium text-app-muted-foreground">Filters:</span>
 </div>
 <Select value={filterStatus} onValueChange={setFilterStatus}>
 <SelectTrigger className="w-[150px]">
 <SelectValue placeholder="Status" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">All Statuses</SelectItem>
 <SelectItem value="pending">Pending</SelectItem>
 <SelectItem value="replayed">Replayed</SelectItem>
 <SelectItem value="failed">Failed</SelectItem>
 <SelectItem value="expired">Expired</SelectItem>
 </SelectContent>
 </Select>
 <Input
 placeholder="Filter by module..."
 value={filterModule}
 onChange={(e) => setFilterModule(e.target.value)}
 className="w-[200px]"
 />
 </CardContent>
 </Card>

 {/* Buffer List */}
 <Card className="rounded-3xl shadow-xl border-app-border">
 <CardContent className="p-0">
 {loading ? (
 <div className="flex items-center justify-center py-20">
 <RefreshCw className="w-8 h-8 animate-spin text-app-muted-foreground" />
 </div>
 ) : buffers.length === 0 ? (
 <div className="text-center py-20 text-app-muted-foreground">
 <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
 <p className="font-medium">No buffered requests</p>
 <p className="text-sm mt-1">Requests are buffered when target modules are unavailable</p>
 </div>
 ) : (
 <div className="divide-y divide-gray-50">
 {buffers.map((buffer) => {
 const StatusIcon = statusIcons[buffer.status]
 return (
 <div key={buffer.id} className="p-6 hover:bg-app-surface-2/50 transition-colors">
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <div className={`w-2 h-2 rounded-full ${statusColors[buffer.status]}`} />
 <span className="font-bold text-app-foreground">
 {buffer.source_module} → {buffer.target_module}
 </span>
 <Badge variant="outline" className="font-mono text-xs">
 {buffer.method}
 </Badge>
 <Badge
 className={`${statusColors[buffer.status]} text-app-foreground border-0 text-[10px] font-bold`}
 >
 {buffer.status.toUpperCase()}
 </Badge>
 </div>
 <div className="text-sm text-app-muted-foreground font-mono mb-2">
 {buffer.target_endpoint}
 </div>
 <div className="flex flex-wrap gap-4 text-xs text-app-muted-foreground">
 <span>Org: {buffer.organization_name || buffer.organization}</span>
 <span>Created: {new Date(buffer.created_at).toLocaleString()}</span>
 <span>Expires: {new Date(buffer.expires_at).toLocaleString()}</span>
 <span>Retries: {buffer.retry_count}/{buffer.max_retries}</span>
 </div>
 {buffer.last_error && (
 <div className="mt-2 p-2 rounded bg-app-error-bg text-app-error text-xs font-mono">
 {buffer.last_error}
 </div>
 )}
 </div>
 <div className="flex gap-2">
 {buffer.status === 'pending' && buffer.can_retry && (
 <Button
 size="sm"
 onClick={() => handleRetry(buffer.id)}
 disabled={retrying === buffer.id}
 className="bg-app-primary hover:bg-app-primary rounded-xl"
 >
 <Play size={14} />
 {retrying === buffer.id ? 'Retrying...' : 'Retry Now'}
 </Button>
 )}
 </div>
 </div>
 {/* Payload Preview */}
 <details className="mt-3">
 <summary className="text-xs text-app-muted-foreground cursor-pointer hover:text-app-muted-foreground">
 View Payload
 </summary>
 <pre className="mt-2 p-3 rounded-xl bg-app-surface-2 text-xs font-mono text-app-muted-foreground overflow-x-auto">
 {JSON.stringify(buffer.payload, null, 2)}
 </pre>
 </details>
 </div>
 )
 })}
 </div>
 )}
 </CardContent>
 </Card>
 </div>
 )
}
