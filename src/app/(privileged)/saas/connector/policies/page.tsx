'use client'

/**
 * Connector Policies Configuration
 * ==================================
 * Configure fallback behaviors for different module states.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    ArrowLeft, Plus, Trash2, Edit2, RefreshCw, Settings, Save
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getConnectorPolicies,
    createConnectorPolicy,
    updateConnectorPolicy,
    deleteConnectorPolicy
} from '@/app/actions/saas/connector'

interface Policy {
    id: number
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
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)
    const [formData, setFormData] = useState(emptyPolicy)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadPolicies()
    }, [])

    async function loadPolicies() {
        setLoading(true)
        try {
            const data = await getConnectorPolicies()
            setPolicies(data)
        } catch {
            toast.error('Failed to load policies')
        } finally {
            setLoading(false)
        }
    }

    function handleEdit(policy: Policy) {
        setEditingPolicy(policy)
        setFormData({
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
            await loadPolicies()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this policy?')) return

        try {
            const res = await deleteConnectorPolicy(id)
            if (!res.success) throw new Error(res.error)
            toast.success('Policy deleted')
            await loadPolicies()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <Link href="/saas/connector" className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-4 text-sm font-medium">
                        <ArrowLeft size={16} />
                        Back to Connector Dashboard
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-2xl bg-indigo-100 text-indigo-600">
                            <Settings size={28} />
                        </div>
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Routing Policies</h2>
                    <p className="text-gray-500 mt-2 font-medium">Define fallback behaviors for module states</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={() => loadPolicies()}
                        disabled={loading}
                        variant="outline"
                        className="rounded-2xl px-6 py-5 font-bold"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh
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
                        {/* Target */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Target Module</Label>
                                <Input
                                    value={formData.target_module}
                                    onChange={(e) => setFormData({ ...formData, target_module: e.target.value })}
                                    placeholder="inventory, finance, * (all)"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Target Endpoint</Label>
                                <Input
                                    value={formData.target_endpoint}
                                    onChange={(e) => setFormData({ ...formData, target_endpoint: e.target.value })}
                                    placeholder="products/, * (all)"
                                />
                            </div>
                        </div>

                        {/* MISSING State */}
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <span className="font-bold text-amber-700">When MISSING</span>
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
                                <span className="font-bold text-blue-700">When DISABLED</span>
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
                                <span className="font-bold text-red-700">When UNAUTHORIZED</span>
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

            {/* Policies Table */}
            <Card className="rounded-3xl shadow-xl border-gray-100">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                        </div>
                    ) : policies.length === 0 ? (
                        <div className="text-center py-20 text-gray-400">
                            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No policies configured</p>
                            <p className="text-sm mt-1">Create a policy to define fallback behaviors</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="text-left p-4 font-bold text-gray-600 text-sm">Target</th>
                                        <th className="text-left p-4 font-bold text-gray-600 text-sm">MISSING</th>
                                        <th className="text-left p-4 font-bold text-gray-600 text-sm">DISABLED</th>
                                        <th className="text-left p-4 font-bold text-gray-600 text-sm">UNAUTHORIZED</th>
                                        <th className="text-left p-4 font-bold text-gray-600 text-sm">Priority</th>
                                        <th className="text-right p-4 font-bold text-gray-600 text-sm">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {policies.map((policy) => (
                                        <tr key={policy.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900">{policy.target_module}</div>
                                                <div className="text-xs text-gray-400 font-mono">{policy.target_endpoint}</div>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline" className="font-mono text-amber-600 border-amber-200 bg-amber-50">
                                                    R:{policy.when_missing_read} W:{policy.when_missing_write}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline" className="font-mono text-blue-600 border-blue-200 bg-blue-50">
                                                    R:{policy.when_disabled_read} W:{policy.when_disabled_write}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                <Badge variant="outline" className="font-mono text-red-600 border-red-200 bg-red-50">
                                                    R:{policy.when_unauthorized_read} W:{policy.when_unauthorized_write}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-mono text-gray-600">{policy.priority}</span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleEdit(policy)}
                                                        className="text-gray-500 hover:text-indigo-600"
                                                    >
                                                        <Edit2 size={16} />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleDelete(policy.id)}
                                                        className="text-gray-500 hover:text-red-600"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
