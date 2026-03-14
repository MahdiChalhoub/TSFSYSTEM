// @ts-nocheck
'use client'

/**
 * MCP Tools — V2 Dajingo Pro Redesign
 * ====================================
 * Premium tool registry with grouped categories,
 * HTTP method badges, and professional management.
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
    Dialog, DialogContent, DialogDescription, DialogHeader,
    DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
    Plus, Trash2, Edit2, RefreshCw, Save, Wand2,
    Wrench, Database, ShoppingCart, DollarSign, Users, Box,
    Code, Terminal, Shield, Search
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
    { value: 'inventory', label: 'Inventory', icon: Box, color: '#6366F1' },
    { value: 'finance', label: 'Finance', icon: DollarSign, color: '#10B981' },
    { value: 'pos', label: 'Point of Sale', icon: ShoppingCart, color: '#F59E0B' },
    { value: 'crm', label: 'CRM', icon: Users, color: '#3B82F6' },
    { value: 'hr', label: 'Human Resources', icon: Users, color: '#EC4899' },
    { value: 'system', label: 'System', icon: Database, color: '#8B5CF6' },
    { value: 'custom', label: 'Custom', icon: Wrench, color: '#6B7280' },
]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const METHOD_COLORS: Record<string, string> = {
    GET: '#10B981', POST: '#3B82F6', PUT: '#F59E0B', PATCH: '#8B5CF6', DELETE: '#EF4444',
}

const emptyTool = {
    name: '', description: '', category: 'custom', internal_endpoint: '',
    http_method: 'GET', parameters_schema: {}, required_permissions: [],
    is_active: true, requires_confirmation: false
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
    const [deleteToolId, setDeleteToolId] = useState<number | null>(null)
    const [showRegisterDefaults, setShowRegisterDefaults] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => { loadData() }, [])

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
            name: tool.name, description: tool.description, category: tool.category,
            internal_endpoint: tool.internal_endpoint, http_method: tool.http_method,
            parameters_schema: tool.parameters_schema, required_permissions: tool.required_permissions,
            is_active: tool.is_active, requires_confirmation: tool.requires_confirmation
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
        let schema = {}
        try { schema = JSON.parse(schemaText) } catch { toast.error('Invalid JSON schema'); return }
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
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setSaving(false)
        }
    }

    async function confirmDelete() {
        if (deleteToolId === null) return
        try {
            const res = await deleteMCPTool(deleteToolId)
            if (!res.success) throw new Error(res.error)
            toast.success('Tool deleted')
            await loadData()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        }
        setDeleteToolId(null)
    }

    async function confirmRegisterDefaults() {
        setShowRegisterDefaults(false)
        setGenerating(true)
        try {
            const res = await registerDefaultTools()
            if (!res.success) throw new Error(res.error)
            toast.success('Default tools registered')
            await loadData()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setGenerating(false)
        }
    }

    const getCategoryMeta = (category: string) => CATEGORIES.find(c => c.value === category) || CATEGORIES[6]
    const activeCount = tools.filter(t => t.is_active).length
    const filteredTools = tools.filter(t =>
        !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ── Page Header ──────────────────────────────────────── */}
            <div
                className="rounded-[28px] p-6 md:p-8"
                style={{
                    background: 'linear-gradient(135deg, var(--app-surface) 0%, var(--app-surface-2) 100%)',
                    border: '1px solid var(--app-border)',
                    boxShadow: 'var(--app-shadow-lg)',
                }}
            >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                            style={{
                                background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary-hover))',
                                boxShadow: '0 8px 24px var(--app-primary-glow)',
                            }}
                        >
                            <Terminal className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                                Tool Registry
                            </h1>
                            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                                {tools.length} tool{tools.length !== 1 ? 's' : ''} registered
                                {activeCount > 0 && <> · <span style={{ color: 'var(--app-success)' }}>{activeCount} active</span></>}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 flex-wrap">
                        <Button
                            onClick={() => setShowRegisterDefaults(true)}
                            disabled={generating || loading}
                            variant="outline"
                            className="rounded-xl px-4 h-11 font-bold"
                            style={{ borderColor: 'var(--app-warning)', color: 'var(--app-warning)' }}
                        >
                            <Wand2 size={16} className={`mr-2 ${generating ? 'animate-spin' : ''}`} />
                            {generating ? 'Registering...' : 'Register Defaults'}
                        </Button>
                        <Button
                            onClick={loadData} disabled={loading} variant="outline"
                            className="rounded-xl px-4 h-11 font-bold"
                            style={{ borderColor: 'var(--app-border)' }}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                        <Button
                            onClick={handleNew}
                            className="rounded-xl px-5 h-11 font-bold text-white"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}
                        >
                            <Plus size={16} className="mr-2" />
                            Add Tool
                        </Button>
                    </div>
                </div>

                {/* Quick Stats + Search */}
                <div className="mt-6 flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-text-muted)' }} />
                        <Input
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search tools..."
                            className="pl-10 rounded-xl h-10"
                            style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                        />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {CATEGORIES.filter(c => tools.some(t => t.category === c.value)).map(cat => {
                            const count = tools.filter(t => t.category === cat.value).length
                            return (
                                <div
                                    key={cat.value}
                                    className="rounded-lg px-3 py-1.5 flex items-center gap-1.5"
                                    style={{ background: `${cat.color}12`, border: `1px solid ${cat.color}30` }}
                                >
                                    <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                                    <span className="text-[11px] font-bold" style={{ color: cat.color }}>{cat.label}</span>
                                    <span className="text-[10px] font-black ml-0.5" style={{ color: cat.color }}>{count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* ── Tool Dialog ──────────────────────────────────────── */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"
                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <DialogHeader>
                        <DialogTitle style={{ color: 'var(--app-text)' }}>
                            {editingTool ? 'Edit Tool' : 'Add MCP Tool'}
                        </DialogTitle>
                        <DialogDescription style={{ color: 'var(--app-text-muted)' }}>
                            Define a tool that AI can use to interact with your system.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label style={{ color: 'var(--app-text)' }}>Tool Name</Label>
                                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="get_products" className="rounded-xl"
                                    style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                            </div>
                            <div className="space-y-2">
                                <Label style={{ color: 'var(--app-text)' }}>Category</Label>
                                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                                    <SelectTrigger className="rounded-xl" style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.map(c => (
                                            <SelectItem key={c.value} value={c.value}>
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                                                    {c.label}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label style={{ color: 'var(--app-text)' }}>Description</Label>
                            <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Get list of products from inventory" rows={2} className="rounded-xl"
                                style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-2 space-y-2">
                                <Label style={{ color: 'var(--app-text)' }}>Internal Endpoint</Label>
                                <Input value={formData.internal_endpoint}
                                    onChange={e => setFormData({ ...formData, internal_endpoint: e.target.value })}
                                    placeholder="inventory/products/" className="rounded-xl font-mono text-sm"
                                    style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                            </div>
                            <div className="space-y-2">
                                <Label style={{ color: 'var(--app-text)' }}>Method</Label>
                                <Select value={formData.http_method} onValueChange={v => setFormData({ ...formData, http_method: v })}>
                                    <SelectTrigger className="rounded-xl" style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HTTP_METHODS.map(m => (
                                            <SelectItem key={m} value={m}>
                                                <span className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full" style={{ background: METHOD_COLORS[m] }} />
                                                    {m}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label style={{ color: 'var(--app-text)' }}>Parameters Schema (JSON)</Label>
                            <Textarea value={schemaText} onChange={e => setSchemaText(e.target.value)}
                                placeholder='{"type": "object", "properties": {...}}' rows={6}
                                className="rounded-xl font-mono text-sm"
                                style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }} />
                        </div>
                        <div className="flex items-center justify-between p-4 rounded-xl"
                            style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                            <div>
                                <p className="font-bold text-sm" style={{ color: 'var(--app-text)' }}>Requires Confirmation</p>
                                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Ask user before executing</p>
                            </div>
                            <Switch checked={formData.requires_confirmation}
                                onCheckedChange={v => setFormData({ ...formData, requires_confirmation: v })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="rounded-xl text-white"
                            style={{ background: 'var(--app-primary)' }}>
                            <Save size={16} className="mr-2" />
                            {saving ? 'Saving...' : 'Save Tool'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Tools Grid ───────────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--app-primary)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>Loading tools...</p>
                    </div>
                </div>
            ) : filteredTools.length === 0 ? (
                <div className="rounded-[28px] p-12 text-center"
                    style={{ background: 'var(--app-surface)', border: '2px dashed var(--app-border)' }}>
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                        style={{ background: 'var(--app-primary-light)' }}>
                        <Terminal className="w-8 h-8" style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <h3 className="text-xl font-black mb-2" style={{ color: 'var(--app-text)' }}>
                        {searchQuery ? 'No Matching Tools' : 'No Tools Registered'}
                    </h3>
                    <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--app-text-muted)' }}>
                        {searchQuery ? 'Try a different search query.' : 'Register default tools or create custom ones to enable AI automation.'}
                    </p>
                    {!searchQuery && (
                        <div className="flex gap-3 justify-center">
                            <Button onClick={() => setShowRegisterDefaults(true)} className="rounded-xl px-6 h-11 font-bold text-white"
                                style={{ background: 'var(--app-warning)' }}>
                                <Wand2 size={16} className="mr-2" /> Register Defaults
                            </Button>
                            <Button onClick={handleNew} variant="outline" className="rounded-xl px-6 h-11 font-bold"
                                style={{ borderColor: 'var(--app-border)' }}>
                                <Plus size={16} className="mr-2" /> Add Custom
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredTools.map(tool => {
                        const meta = getCategoryMeta(tool.category)
                        const methodColor = METHOD_COLORS[tool.http_method] || '#6B7280'
                        return (
                            <div
                                key={tool.id}
                                className="rounded-[20px] overflow-hidden transition-all duration-300 hover:translate-y-[-2px]"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '1px solid var(--app-border)',
                                    boxShadow: 'var(--app-shadow-md)',
                                    opacity: tool.is_active ? 1 : 0.6,
                                }}
                            >
                                <div className="h-1" style={{ background: meta.color }} />
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                style={{ background: `${meta.color}15` }}>
                                                <Code size={18} style={{ color: meta.color }} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-[14px] font-mono" style={{ color: 'var(--app-text)' }}>{tool.name}</h3>
                                                <p className="text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>{meta.label}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md"
                                            style={{ background: `${methodColor}15`, color: methodColor, border: `1px solid ${methodColor}30` }}>
                                            {tool.http_method}
                                        </span>
                                    </div>
                                    <p className="text-xs line-clamp-2 mb-3" style={{ color: 'var(--app-text-muted)' }}>
                                        {tool.description || 'No description'}
                                    </p>
                                    <div className="rounded-lg p-2 mb-3 font-mono text-[11px] truncate"
                                        style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}>
                                        {tool.internal_endpoint}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex gap-1.5">
                                            {!tool.is_active && (
                                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md"
                                                    style={{ background: 'var(--app-surface-2)', color: 'var(--app-text-muted)' }}>
                                                    Inactive
                                                </span>
                                            )}
                                            {tool.requires_confirmation && (
                                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md"
                                                    style={{ background: 'var(--app-warning-light)', color: 'var(--app-warning)' }}>
                                                    <Shield size={9} className="inline mr-0.5" /> Confirm
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="ghost" onClick={() => handleEdit(tool)} className="rounded-lg h-8 px-2">
                                                <Edit2 size={13} />
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setDeleteToolId(tool.id)}
                                                className="rounded-lg h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-500/10">
                                                <Trash2 size={13} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <ConfirmDialog open={deleteToolId !== null} onOpenChange={open => { if (!open) setDeleteToolId(null) }}
                onConfirm={confirmDelete} title="Delete Tool?" description="This MCP tool will be permanently removed." variant="danger" />
            <ConfirmDialog open={showRegisterDefaults} onOpenChange={setShowRegisterDefaults}
                onConfirm={confirmRegisterDefaults} title="Register Default Tools?"
                description="This will register default tools for your organization." confirmText="Register" variant="warning" />
        </div>
    )
}
