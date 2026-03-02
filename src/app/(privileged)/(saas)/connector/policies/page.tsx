'use client'

/**
 * Connector Policies Configuration
 * ==================================
 * Configure fallback behaviors for different module states.
 * Features:
 * - Filter by source module, target module, actions
 * - Visual route display (Source → Target)
 * - Color-coded state actions
 * - Auto-generate default policies
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from '@/components/ui/select'
import {
 Dialog,
 DialogContent,
 DialogDescription,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog'
import {
 ArrowLeft, Plus, Trash2, Edit2, RefreshCw, Settings, Save, Wand2,
 ArrowRight, Filter, X
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
 getConnectorPolicies,
 createConnectorPolicy,
 updateConnectorPolicy,
 deleteConnectorPolicy,
 getAvailableModules,
 autoGeneratePolicies
} from '@/app/actions/saas/connector'

interface Policy {
 id: number
 source_module: string
 target_module: string
 target_endpoint: string
 when_missing_read: string
 when_missing_write: string
 when_disabled_read: string
 when_disabled_write: string
 when_unauthorized_read: string
 when_unauthorized_write: string
 cache_ttl_seconds: number
 buffer_ttl_seconds: number
 max_buffer_size: number
 priority: number
 is_active: boolean
}

interface ModuleInfo {
 code: string
 name: string
 is_core: boolean
}

const READ_ACTIONS = [
 { value: 'forward', label: 'Forward (default)' },
 { value: 'wait', label: 'Wait for availability' },
 { value: 'empty', label: 'Return empty' },
 { value: 'cached', label: 'Return cached' },
 { value: 'mock', label: 'Return mock data' },
 { value: 'error', label: 'Throw error' },
]

const WRITE_ACTIONS = [
 { value: 'forward', label: 'Forward (default)' },
 { value: 'buffer', label: 'Buffer for replay' },
 { value: 'redirect', label: 'Redirect to fallback' },
 { value: 'drop', label: 'Drop silently' },
 { value: 'queue', label: 'Queue as event' },
 { value: 'error', label: 'Throw error' },
]

const emptyPolicy = {
 source_module: '*',
 target_module: '',
 target_endpoint: '*',
 when_missing_read: 'empty',
 when_missing_write: 'buffer',
 when_disabled_read: 'empty',
 when_disabled_write: 'drop',
 when_unauthorized_read: 'empty',
 when_unauthorized_write: 'drop',
 cache_ttl_seconds: 300,
 buffer_ttl_seconds: 86400,
 max_buffer_size: 100,
 priority: 0
}

export default function ConnectorPoliciesPage() {
 const [policies, setPolicies] = useState<Policy[]>([])
 const [filteredPolicies, setFilteredPolicies] = useState<Policy[]>([])
 const [modules, setModules] = useState<ModuleInfo[]>([])
 const [loading, setLoading] = useState(true)
 const [isDialogOpen, setIsDialogOpen] = useState(false)
 const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
 const [formData, setFormData] = useState(emptyPolicy)
 const [saving, setSaving] = useState(false)
 const [generating, setGenerating] = useState(false)
 const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
 const [showAutoGenConfirm, setShowAutoGenConfirm] = useState(false)

 // Filters
 const [filterSource, setFilterSource] = useState<string>('')
 const [filterTarget, setFilterTarget] = useState<string>('')
 const [filterAction, setFilterAction] = useState<string>('')
 const [showFilters, setShowFilters] = useState(false)

 useEffect(() => {
 loadData()
 }, [])

 useEffect(() => {
 applyFilters()
 }, [policies, filterSource, filterTarget, filterAction])

 async function loadData() {
 setLoading(true)
 try {
 const [policiesData, modulesData] = await Promise.all([
 getConnectorPolicies(),
 getAvailableModules()
 ])
 setPolicies(policiesData)
 setModules([
 { code: '*', name: 'All Modules (Global)', is_core: true },
 ...modulesData.filter((m: ModuleInfo) => m.code !== '*')
 ])
 } catch {
 toast.error('Failed to load data')
 } finally {
 setLoading(false)
 }
 }

 function applyFilters() {
 let result = [...policies]

 if (filterSource) {
 result = result.filter(p => p.source_module === filterSource)
 }
 if (filterTarget) {
 result = result.filter(p => p.target_module === filterTarget)
 }
 if (filterAction) {
 result = result.filter(p =>
 p.when_missing_read === filterAction ||
 p.when_missing_write === filterAction ||
 p.when_disabled_read === filterAction ||
 p.when_disabled_write === filterAction ||
 p.when_unauthorized_read === filterAction ||
 p.when_unauthorized_write === filterAction
 )
 }

 setFilteredPolicies(result)
 }

 function clearFilters() {
 setFilterSource('')
 setFilterTarget('')
 setFilterAction('')
 }

 function handleEdit(policy: Policy) {
 setEditingPolicy(policy)
 setFormData({
 source_module: policy.source_module || '*',
 target_module: policy.target_module,
 target_endpoint: policy.target_endpoint,
 when_missing_read: policy.when_missing_read,
 when_missing_write: policy.when_missing_write,
 when_disabled_read: policy.when_disabled_read,
 when_disabled_write: policy.when_disabled_write,
 when_unauthorized_read: policy.when_unauthorized_read,
 when_unauthorized_write: policy.when_unauthorized_write,
 cache_ttl_seconds: policy.cache_ttl_seconds,
 buffer_ttl_seconds: policy.buffer_ttl_seconds,
 max_buffer_size: policy.max_buffer_size,
 priority: policy.priority
 })
 setIsDialogOpen(true)
 }

 function handleNew() {
 setEditingPolicy(null)
 setFormData(emptyPolicy)
 setIsDialogOpen(true)
 }

 async function handleSave() {
 if (!formData.target_module) {
 toast.error('Target module is required')
 return
 }

 setSaving(true)
 try {
 if (editingPolicy) {
 const res = await updateConnectorPolicy(editingPolicy.id, formData)
 if (!res.success) throw new Error(res.error)
 toast.success('Policy updated')
 } else {
 const res = await createConnectorPolicy(formData)
 if (!res.success) throw new Error(res.error)
 toast.success('Policy created')
 }
 setIsDialogOpen(false)
 await loadData()
 } catch (e: unknown) {
 toast.error((e instanceof Error ? e.message : String(e)))
 } finally {
 setSaving(false)
 }
 }

 async function handleDelete(id: number) {

 try {
 const res = await deleteConnectorPolicy(id)
 if (!res.success) throw new Error(res.error)
 toast.success('Policy deleted')
 await loadData()
 } catch (e: unknown) {
 toast.error((e instanceof Error ? e.message : String(e)))
 }
 }

 async function handleAutoGenerate() {

 setGenerating(true)
 try {
 const res = await autoGeneratePolicies()
 if (!res.success) throw new Error(res.error)
 toast.success(res.message)
 await loadData()
 } catch (e: unknown) {
 toast.error((e instanceof Error ? e.message : String(e)))
 } finally {
 setGenerating(false)
 }
 }

 const getModuleName = (code: string) => {
 const mod = modules.find(m => m.code === code)
 return mod?.name || code
 }

 const getActionColor = (action: string) => {
 const colors: Record<string, string> = {
 'forward': 'bg-green-100 text-green-700 border-green-200',
 'empty': 'bg-app-surface-2 text-gray-700 border-app-border',
 'buffer': 'bg-blue-100 text-blue-700 border-blue-200',
 'cached': 'bg-purple-100 text-purple-700 border-purple-200',
 'drop': 'bg-orange-100 text-orange-700 border-orange-200',
 'error': 'bg-red-100 text-red-700 border-red-200',
 'wait': 'bg-yellow-100 text-yellow-700 border-yellow-200',
 'mock': 'bg-pink-100 text-pink-700 border-pink-200',
 }
 return colors[action] || 'bg-app-surface-2 text-gray-700 border-app-border'
 }

 const hasActiveFilters = filterSource || filterTarget || filterAction

 return (
 <div className="space-y-6 animate-in fade-in duration-500">
 {/* Header */}
 <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
 <div>
 <Link href="/connector" className="text-app-text-faint hover:text-app-text-muted flex items-center gap-2 mb-4 text-sm font-medium">
 <ArrowLeft size={16} />
 Back to Connector Dashboard
 </Link>
 <div className="flex items-center gap-3 mb-2">
 <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-600">
 <Settings size={28} />
 </div>
 </div>
 <h2 className="text-3xl font-black text-app-text tracking-tight">Routing Policies</h2>
 <p className="text-app-text-muted mt-2 font-medium">
 {filteredPolicies.length} policies {hasActiveFilters ? '(filtered)' : ''}
 </p>
 </div>
 <div className="flex gap-3 flex-wrap">
 <Button
 onClick={() => setShowFilters(!showFilters)}
 variant="outline"
 className={`rounded-2xl px-6 py-5 font-bold ${hasActiveFilters ? 'bg-indigo-50 border-indigo-200' : ''}`}
 >
 <Filter size={18} />
 Filters {hasActiveFilters && `(${[filterSource, filterTarget, filterAction].filter(Boolean).length})`}
 </Button>
 <Button
 onClick={() => setShowAutoGenConfirm(true)}
 disabled={generating || loading}
 variant="outline"
 className="rounded-2xl px-6 py-5 font-bold text-amber-600 border-amber-200 hover:bg-amber-50"
 >
 <Wand2 size={18} className={generating ? 'animate-spin' : ''} />
 {generating ? 'Generating...' : 'Auto-Generate'}
 </Button>
 <Button
 onClick={() => loadData()}
 disabled={loading}
 variant="outline"
 className="rounded-2xl px-6 py-5 font-bold"
 >
 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
 </Button>
 <Button
 onClick={handleNew}
 className="rounded-2xl px-6 py-5 font-bold bg-indigo-600 hover:bg-indigo-500"
 >
 <Plus size={18} />
 New Policy
 </Button>
 </div>
 </div>

 {/* Filters Panel */}
 {showFilters && (
 <Card className="rounded-2xl border-indigo-100 bg-indigo-50/50">
 <CardContent className="p-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="font-bold text-indigo-700">Filter Policies</h3>
 {hasActiveFilters && (
 <Button variant="ghost" size="sm" onClick={clearFilters} className="text-indigo-600">
 <X size={14} /> Clear All
 </Button>
 )}
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="space-y-2">
 <Label className="text-indigo-700">Source Module (Requester)</Label>
 <Select value={filterSource} onValueChange={setFilterSource}>
 <SelectTrigger>
 <SelectValue placeholder="Any source" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="">Any source</SelectItem>
 {modules.map((m) => (
 <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-indigo-700">Target Module (Destination)</Label>
 <Select value={filterTarget} onValueChange={setFilterTarget}>
 <SelectTrigger>
 <SelectValue placeholder="Any target" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="">Any target</SelectItem>
 {modules.map((m) => (
 <SelectItem key={m.code} value={m.code}>{m.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-indigo-700">Action Type</Label>
 <Select value={filterAction} onValueChange={setFilterAction}>
 <SelectTrigger>
 <SelectValue placeholder="Any action" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="">Any action</SelectItem>
 <SelectItem value="empty">Return empty</SelectItem>
 <SelectItem value="buffer">Buffer for replay</SelectItem>
 <SelectItem value="drop">Drop silently</SelectItem>
 <SelectItem value="error">Throw error</SelectItem>
 <SelectItem value="cached">Return cached</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 </CardContent>
 </Card>
 )}

 {/* Policy Dialog */}
 <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Create Policy'}</DialogTitle>
 <DialogDescription>
 Configure how the Connector handles requests when the target module is unavailable.
 </DialogDescription>
 </DialogHeader>

 <div className="space-y-6 py-4">
 {/* Source & Target Modules */}
 <div className="grid grid-cols-5 gap-4 items-end">
 <div className="col-span-2 space-y-2">
 <Label>Source Module (Requester)</Label>
 <Select
 value={formData.source_module}
 onValueChange={(v) => setFormData({ ...formData, source_module: v })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select source module" />
 </SelectTrigger>
 <SelectContent>
 {modules.map((m) => (
 <SelectItem key={m.code} value={m.code}>
 {m.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="flex items-center justify-center">
 <ArrowRight size={24} className="text-gray-300" />
 </div>
 <div className="col-span-2 space-y-2">
 <Label>Target Module (Destination)</Label>
 <Select
 value={formData.target_module}
 onValueChange={(v) => setFormData({ ...formData, target_module: v })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Select target module" />
 </SelectTrigger>
 <SelectContent>
 {modules.map((m) => (
 <SelectItem key={m.code} value={m.code}>
 {m.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>

 {/* Target Endpoint */}
 <div className="space-y-2">
 <Label>Target Endpoint Pattern</Label>
 <Input
 value={formData.target_endpoint}
 onChange={(e) => setFormData({ ...formData, target_endpoint: e.target.value })}
 placeholder="* (all), products/, categories/*"
 />
 <p className="text-xs text-app-text-faint">Use * for all endpoints, or specify a path pattern</p>
 </div>

 {/* MISSING State */}
 <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-4">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-amber-500" />
 <span className="font-bold text-amber-700">When MISSING (module not installed)</span>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-amber-700">READ Action</Label>
 <Select
 value={formData.when_missing_read}
 onValueChange={(v) => setFormData({ ...formData, when_missing_read: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {READ_ACTIONS.map((a) => (
 <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-amber-700">WRITE Action</Label>
 <Select
 value={formData.when_missing_write}
 onValueChange={(v) => setFormData({ ...formData, when_missing_write: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {WRITE_ACTIONS.map((a) => (
 <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>

 {/* DISABLED State */}
 <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-4">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-blue-500" />
 <span className="font-bold text-blue-700">When DISABLED (module turned off for tenant)</span>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-blue-700">READ Action</Label>
 <Select
 value={formData.when_disabled_read}
 onValueChange={(v) => setFormData({ ...formData, when_disabled_read: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {READ_ACTIONS.map((a) => (
 <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-blue-700">WRITE Action</Label>
 <Select
 value={formData.when_disabled_write}
 onValueChange={(v) => setFormData({ ...formData, when_disabled_write: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {WRITE_ACTIONS.map((a) => (
 <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>

 {/* UNAUTHORIZED State */}
 <div className="p-4 rounded-xl bg-red-50 border border-red-100 space-y-4">
 <div className="flex items-center gap-2">
 <div className="w-3 h-3 rounded-full bg-red-500" />
 <span className="font-bold text-red-700">When UNAUTHORIZED (no permission)</span>
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-red-700">READ Action</Label>
 <Select
 value={formData.when_unauthorized_read}
 onValueChange={(v) => setFormData({ ...formData, when_unauthorized_read: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {READ_ACTIONS.map((a) => (
 <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-red-700">WRITE Action</Label>
 <Select
 value={formData.when_unauthorized_write}
 onValueChange={(v) => setFormData({ ...formData, when_unauthorized_write: v })}
 >
 <SelectTrigger>
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {WRITE_ACTIONS.map((a) => (
 <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 </div>
 </div>

 {/* Settings */}
 <div className="grid grid-cols-4 gap-4">
 <div className="space-y-2">
 <Label>Cache TTL (sec)</Label>
 <Input
 type="number"
 value={formData.cache_ttl_seconds}
 onChange={(e) => setFormData({ ...formData, cache_ttl_seconds: parseInt(e.target.value) || 0 })}
 />
 </div>
 <div className="space-y-2">
 <Label>Buffer TTL (sec)</Label>
 <Input
 type="number"
 value={formData.buffer_ttl_seconds}
 onChange={(e) => setFormData({ ...formData, buffer_ttl_seconds: parseInt(e.target.value) || 0 })}
 />
 </div>
 <div className="space-y-2">
 <Label>Max Buffer Size</Label>
 <Input
 type="number"
 value={formData.max_buffer_size}
 onChange={(e) => setFormData({ ...formData, max_buffer_size: parseInt(e.target.value) || 0 })}
 />
 </div>
 <div className="space-y-2">
 <Label>Priority</Label>
 <Input
 type="number"
 value={formData.priority}
 onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
 />
 </div>
 </div>
 </div>

 <DialogFooter>
 <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
 <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500">
 <Save size={16} />
 {saving ? 'Saving...' : 'Save Policy'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>

 {/* Policies Grid - Better visualization */}
 <div className="grid gap-4">
 {loading ? (
 <div className="flex items-center justify-center py-20">
 <RefreshCw className="w-8 h-8 animate-spin text-app-text-faint" />
 </div>
 ) : filteredPolicies.length === 0 ? (
 <Card className="rounded-3xl shadow-xl border-app-border">
 <CardContent className="p-0">
 <div className="text-center py-20 text-app-text-faint">
 <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
 <p className="font-medium">{hasActiveFilters ? 'No policies match filters' : 'No policies configured'}</p>
 <p className="text-sm mt-1">
 {hasActiveFilters
 ? 'Try adjusting your filters'
 : 'Click "Auto-Generate" to create default policies'
 }
 </p>
 {!hasActiveFilters && (
 <Button
 onClick={() => setShowAutoGenConfirm(true)}
 className="mt-4 bg-amber-500 hover:bg-amber-400"
 >
 <Wand2 size={16} />
 Auto-Generate Default Policies
 </Button>
 )}
 </div>
 </CardContent>
 </Card>
 ) : (
 filteredPolicies.map((policy) => (
 <Card key={policy.id} className="rounded-2xl shadow-lg border-app-border hover:shadow-xl transition-shadow">
 <CardContent className="p-4">
 <div className="flex items-start justify-between gap-4">
 {/* Route Display */}
 <div className="flex-1">
 {/* Source → Target */}
 <div className="flex items-center gap-3 mb-3">
 <Badge variant="outline" className="px-3 py-1 text-sm font-bold bg-app-bg">
 {getModuleName(policy.source_module || '*')}
 </Badge>
 <ArrowRight size={20} className="text-indigo-400" />
 <Badge variant="outline" className="px-3 py-1 text-sm font-bold bg-indigo-50 text-indigo-700 border-indigo-200">
 {getModuleName(policy.target_module)}
 </Badge>
 <span className="text-xs text-app-text-faint font-mono">{policy.target_endpoint}</span>
 </div>

 {/* State Actions Grid */}
 <div className="grid grid-cols-3 gap-3">
 {/* MISSING */}
 <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
 <div className="flex items-center gap-2 mb-2">
 <div className="w-2 h-2 rounded-full bg-amber-500" />
 <span className="text-xs font-bold text-amber-700">MISSING</span>
 </div>
 <div className="flex gap-1">
 <Badge variant="outline" className={`text-xs ${getActionColor(policy.when_missing_read)}`}>
 R: {policy.when_missing_read}
 </Badge>
 <Badge variant="outline" className={`text-xs ${getActionColor(policy.when_missing_write)}`}>
 W: {policy.when_missing_write}
 </Badge>
 </div>
 </div>

 {/* DISABLED */}
 <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
 <div className="flex items-center gap-2 mb-2">
 <div className="w-2 h-2 rounded-full bg-blue-500" />
 <span className="text-xs font-bold text-blue-700">DISABLED</span>
 </div>
 <div className="flex gap-1">
 <Badge variant="outline" className={`text-xs ${getActionColor(policy.when_disabled_read)}`}>
 R: {policy.when_disabled_read}
 </Badge>
 <Badge variant="outline" className={`text-xs ${getActionColor(policy.when_disabled_write)}`}>
 W: {policy.when_disabled_write}
 </Badge>
 </div>
 </div>

 {/* UNAUTHORIZED */}
 <div className="p-3 rounded-xl bg-red-50 border border-red-100">
 <div className="flex items-center gap-2 mb-2">
 <div className="w-2 h-2 rounded-full bg-red-500" />
 <span className="text-xs font-bold text-red-700">UNAUTHORIZED</span>
 </div>
 <div className="flex gap-1">
 <Badge variant="outline" className={`text-xs ${getActionColor(policy.when_unauthorized_read)}`}>
 R: {policy.when_unauthorized_read}
 </Badge>
 <Badge variant="outline" className={`text-xs ${getActionColor(policy.when_unauthorized_write)}`}>
 W: {policy.when_unauthorized_write}
 </Badge>
 </div>
 </div>
 </div>
 </div>

 {/* Actions */}
 <div className="flex flex-col gap-2">
 <Badge variant="outline" className="text-xs text-app-text-muted">
 Priority: {policy.priority}
 </Badge>
 <div className="flex gap-1">
 <Button
 size="sm"
 variant="ghost"
 onClick={() => handleEdit(policy)}
 className="text-app-text-muted hover:text-indigo-600"
 >
 <Edit2 size={16} />
 </Button>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => setPendingDeleteId(policy.id)}
 className="text-app-text-muted hover:text-red-600"
 >
 <Trash2 size={16} />
 </Button>
 </div>
 </div>
 </div>
 </CardContent>
 </Card>
 ))
 )}
 </div>

 <ConfirmDialog
 open={pendingDeleteId !== null}
 onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
 onConfirm={() => {
 if (pendingDeleteId) handleDelete(pendingDeleteId)
 setPendingDeleteId(null)
 }}
 title="Delete Policy"
 description="Are you sure you want to delete this routing policy? This action cannot be undone."
 confirmText="Delete"
 variant="danger"
 />

 <ConfirmDialog
 open={showAutoGenConfirm}
 onOpenChange={(open) => { if (!open) setShowAutoGenConfirm(false) }}
 onConfirm={() => {
 handleAutoGenerate()
 setShowAutoGenConfirm(false)
 }}
 title="Auto-Generate Policies"
 description="This will create default policies for all modules that don't have one. Existing policies will not be modified."
 confirmText="Generate"
 variant="warning"
 />

 {/* Legend */}
 <div className="p-4 bg-app-bg rounded-2xl border border-app-border">
 <h4 className="font-bold text-gray-700 mb-3">Action Legend</h4>
 <div className="flex flex-wrap gap-2">
 <Badge variant="outline" className={getActionColor('forward')}>forward</Badge>
 <Badge variant="outline" className={getActionColor('empty')}>empty</Badge>
 <Badge variant="outline" className={getActionColor('buffer')}>buffer</Badge>
 <Badge variant="outline" className={getActionColor('cached')}>cached</Badge>
 <Badge variant="outline" className={getActionColor('drop')}>drop</Badge>
 <Badge variant="outline" className={getActionColor('error')}>error</Badge>
 </div>
 </div>
 </div>
 )
}
