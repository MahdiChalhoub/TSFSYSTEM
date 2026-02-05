'use client'

/**
 * MCP Tools - Configuration Page
 * ===============================
 * Define and manage tools that AI can use.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
    ArrowLeft, Plus, Trash2, Edit2, RefreshCw, Save, Wand2,
    Wrench, Database, ShoppingCart, DollarSign, Users, Box
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getMCPTools, createMCPTool, updateMCPTool,
    deleteMCPTool, registerDefaultTools
} from '@/app/actions/saas/mcp'

interface Tool {
    id: number
    name: string
    description: string
    category: string
    internal_endpoint: string
    http_method: string
    parameters_schema: object
    required_permissions: string[]
    is_active: boolean
    requires_confirmation: boolean
}

const CATEGORIES = [
    { value: 'inventory', label: 'Inventory', icon: Box },
    { value: 'finance', label: 'Finance', icon: DollarSign },
    { value: 'pos', label: 'Point of Sale', icon: ShoppingCart },
    { value: 'crm', label: 'CRM', icon: Users },
    { value: 'hr', label: 'Human Resources', icon: Users },
    { value: 'system', label: 'System', icon: Database },
    { value: 'custom', label: 'Custom', icon: Wrench },
]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const emptyTool = {
    name: '',
    description: '',
    category: 'custom',
    internal_endpoint: '',
    http_method: 'GET',
    parameters_schema: {},
    required_permissions: [],
    is_active: true,
    requires_confirmation: false
}

export default function MCPToolsPage() {
    const [tools, setTools] = useState<Tool[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingTool, setEditingTool] = useState<Tool | null>(null)
    const [formData, setFormData] = useState(emptyTool)
    const [saving, setSaving] = useState(false)
    const [schemaText, setSchemaText] = useState('{}')
    const [generating, setGenerating] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const data = await getMCPTools()
            setTools(data)
        } catch {
            toast.error('Failed to load tools')
        } finally {
            setLoading(false)
        }
    }

    function handleEdit(tool: Tool) {
        setEditingTool(tool)
        setFormData({
            name: tool.name,
            description: tool.description,
            category: tool.category,
            internal_endpoint: tool.internal_endpoint,
            http_method: tool.http_method,
            parameters_schema: tool.parameters_schema,
            required_permissions: tool.required_permissions,
            is_active: tool.is_active,
            requires_confirmation: tool.requires_confirmation
        })
        setSchemaText(JSON.stringify(tool.parameters_schema, null, 2))
        setIsDialogOpen(true)
    }

    function handleNew() {
        setEditingTool(null)
        setFormData(emptyTool)
        setSchemaText('{}')
        setIsDialogOpen(true)
    }

    async function handleSave() {
        if (!formData.name || !formData.internal_endpoint) {
            toast.error('Name and endpoint are required')
            return
        }

        // Parse schema
        let schema = {}
        try {
            schema = JSON.parse(schemaText)
        } catch {
            toast.error('Invalid JSON schema')
            return
        }

        setSaving(true)
        try {
            const data = { ...formData, parameters_schema: schema }

            if (editingTool) {
                const res = await updateMCPTool(editingTool.id, data)
                if (!res.success) throw new Error(res.error)
                toast.success('Tool updated')
            } else {
                const res = await createMCPTool(data)
                if (!res.success) throw new Error(res.error)
                toast.success('Tool created')
            }
            setIsDialogOpen(false)
            await loadData()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    async function handleDelete(id: number) {
        if (!confirm('Delete this tool?')) return

        try {
            const res = await deleteMCPTool(id)
            if (!res.success) throw new Error(res.error)
            toast.success('Tool deleted')
            await loadData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleRegisterDefaults() {
        if (!confirm('This will register default tools for your organization. Continue?')) return

        setGenerating(true)
        try {
            const res = await registerDefaultTools()
            if (!res.success) throw new Error(res.error)
            toast.success('Default tools registered')
            await loadData()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setGenerating(false)
        }
    }

    const getCategoryIcon = (category: string) => {
        const cat = CATEGORIES.find(c => c.value === category)
        const Icon = cat?.icon || Wrench
        return <Icon size={16} />
    }

    const getCategoryLabel = (category: string) => {
        return CATEGORIES.find(c => c.value === category)?.label || category
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div>
                    <Link href="/saas/mcp" className="text-gray-400 hover:text-gray-600 flex items-center gap-2 mb-4 text-sm font-medium">
                        <ArrowLeft size={16} />
                        Back to MCP Dashboard
                    </Link>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-2xl bg-blue-100 text-blue-600">
                            <Wrench size={28} />
                        </div>
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">MCP Tools</h2>
                    <p className="text-gray-500 mt-2 font-medium">
                        {tools.length} tool{tools.length !== 1 ? 's' : ''} available to AI
                    </p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <Button
                        onClick={handleRegisterDefaults}
                        disabled={generating || loading}
                        variant="outline"
                        className="rounded-2xl px-6 py-5 font-bold text-amber-600 border-amber-200 hover:bg-amber-50"
                    >
                        <Wand2 size={18} className={generating ? 'animate-spin' : ''} />
                        {generating ? 'Registering...' : 'Register Defaults'}
                    </Button>
                    <Button
                        onClick={loadData}
                        disabled={loading}
                        variant="outline"
                        className="rounded-2xl px-6 py-5 font-bold"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </Button>
                    <Button
                        onClick={handleNew}
                        className="rounded-2xl px-6 py-5 font-bold bg-blue-600 hover:bg-blue-500"
                    >
                        <Plus size={18} />
                        Add Tool
                    </Button>
                </div>
            </div>

            {/* Tool Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingTool ? 'Edit Tool' : 'Add MCP Tool'}</DialogTitle>
                        <DialogDescription>
                            Define a tool that AI can use to interact with your system.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tool Name</Label>
                                <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="get_products"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(v) => setFormData({ ...formData, category: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Get list of products from inventory"
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label>Internal Endpoint</Label>
                                <Input
                                    value={formData.internal_endpoint}
                                    onChange={(e) => setFormData({ ...formData, internal_endpoint: e.target.value })}
                                    placeholder="inventory/products/"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>HTTP Method</Label>
                                <Select
                                    value={formData.http_method}
                                    onValueChange={(v) => setFormData({ ...formData, http_method: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HTTP_METHODS.map((m) => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Parameters Schema (JSON)</Label>
                            <Textarea
                                value={schemaText}
                                onChange={(e) => setSchemaText(e.target.value)}
                                placeholder='{"type": "object", "properties": {...}}'
                                rows={6}
                                className="font-mono text-sm"
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50">
                            <div>
                                <p className="font-medium text-gray-900">Requires Confirmation</p>
                                <p className="text-sm text-gray-500">Ask user before executing</p>
                            </div>
                            <Switch
                                checked={formData.requires_confirmation}
                                onCheckedChange={(v) => setFormData({ ...formData, requires_confirmation: v })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500">
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Tool'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Tools Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : tools.length === 0 ? (
                <Card className="rounded-3xl shadow-xl border-gray-100">
                    <CardContent className="p-0">
                        <div className="text-center py-20 text-gray-400">
                            <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No tools configured</p>
                            <p className="text-sm mt-1">Register default tools or create custom ones</p>
                            <div className="flex gap-3 justify-center mt-4">
                                <Button onClick={handleRegisterDefaults} className="bg-amber-500 hover:bg-amber-400">
                                    <Wand2 size={16} />
                                    Register Defaults
                                </Button>
                                <Button onClick={handleNew} variant="outline">
                                    <Plus size={16} />
                                    Add Custom Tool
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tools.map((tool) => (
                        <Card key={tool.id} className="rounded-2xl shadow-lg border-gray-100 hover:shadow-xl transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                                            {getCategoryIcon(tool.category)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{tool.name}</h3>
                                            <p className="text-xs text-gray-500">{getCategoryLabel(tool.category)}</p>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={`text-xs ${tool.http_method === 'GET' ? 'text-green-600 border-green-200' :
                                            tool.http_method === 'POST' ? 'text-blue-600 border-blue-200' :
                                                tool.http_method === 'DELETE' ? 'text-red-600 border-red-200' :
                                                    'text-amber-600 border-amber-200'
                                        }`}>
                                        {tool.http_method}
                                    </Badge>
                                </div>

                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                    {tool.description}
                                </p>

                                <div className="p-2 rounded-lg bg-gray-50 mb-3">
                                    <code className="text-xs text-gray-600">{tool.internal_endpoint}</code>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1">
                                        {!tool.is_active && (
                                            <Badge variant="outline" className="text-xs text-gray-400">Inactive</Badge>
                                        )}
                                        {tool.requires_confirmation && (
                                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">Confirm</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEdit(tool)}
                                        >
                                            <Edit2 size={14} />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(tool.id)}
                                            className="text-red-500 hover:text-red-600"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
