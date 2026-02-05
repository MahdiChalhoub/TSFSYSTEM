'use client'

/**
 * MCP AI Providers - Configuration Page
 * ======================================
 * Add and manage AI providers (OpenAI, Claude, Gemini, etc.)
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
    ArrowLeft, Plus, Trash2, Edit2, RefreshCw, Save, Star,
    Cloud, CheckCircle, XCircle, Zap, Eye, EyeOff
} from 'lucide-react'
import { toast } from 'sonner'
import {
    getMCPProviders, createMCPProvider, updateMCPProvider,
    deleteMCPProvider, testMCPProvider, setDefaultProvider
} from '@/app/actions/saas/mcp'

interface Provider {
    id: number
    name: string
    provider_type: string
    api_base_url: string
    model_name: string
    max_tokens: number
    temperature: number
    timeout_seconds: number
    is_active: boolean
    is_default: boolean
    last_tested_at: string | null
    last_test_success: boolean
}

const PROVIDER_TYPES = [
    { value: 'openai', label: 'OpenAI', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { value: 'anthropic', label: 'Anthropic (Claude)', models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'] },
    { value: 'google', label: 'Google (Gemini)', models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
    { value: 'azure', label: 'Azure OpenAI', models: ['gpt-4', 'gpt-35-turbo'] },
    { value: 'ollama', label: 'Ollama (Local)', models: ['llama2', 'mistral', 'codellama'] },
    { value: 'custom', label: 'Custom API', models: [] },
]

const emptyProvider = {
    name: '',
    provider_type: 'openai',
    api_key: '',
    api_base_url: '',
    model_name: 'gpt-4',
    max_tokens: 4096,
    temperature: 0.7,
    timeout_seconds: 30
}

export default function MCPProvidersPage() {
    const [providers, setProviders] = useState<Provider[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
    const [formData, setFormData] = useState(emptyProvider)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState<number | null>(null)
    const [showApiKey, setShowApiKey] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            const data = await getMCPProviders()
            setProviders(data)
        } catch {
            toast.error('Failed to load providers')
        } finally {
            setLoading(false)
        }
    }

    function handleEdit(provider: Provider) {
        setEditingProvider(provider)
        setFormData({
            name: provider.name,
            provider_type: provider.provider_type,
            api_key: '', // Don't show existing key
            api_base_url: provider.api_base_url || '',
            model_name: provider.model_name,
            max_tokens: provider.max_tokens,
            temperature: provider.temperature,
            timeout_seconds: provider.timeout_seconds
        })
        setIsDialogOpen(true)
    }

    function handleNew() {
        setEditingProvider(null)
        setFormData(emptyProvider)
        setIsDialogOpen(true)
    }

    async function handleSave() {
        if (!formData.name || !formData.provider_type) {
            toast.error('Name and provider type are required')
            return
        }

        setSaving(true)
        try {
            if (editingProvider) {
                const res = await updateMCPProvider(editingProvider.id, formData)
                if (!res.success) throw new Error(res.error)
                toast.success('Provider updated')
            } else {
                const res = await createMCPProvider(formData)
                if (!res.success) throw new Error(res.error)
                toast.success('Provider created')
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
        if (!confirm('Delete this provider?')) return

        try {
            const res = await deleteMCPProvider(id)
            if (!res.success) throw new Error(res.error)
            toast.success('Provider deleted')
            await loadData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    async function handleTest(id: number) {
        setTesting(id)
        try {
            const res = await testMCPProvider(id)
            if (res.success) {
                toast.success('Connection successful!')
            } else {
                toast.error(res.message || 'Connection failed')
            }
            await loadData()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setTesting(null)
        }
    }

    async function handleSetDefault(id: number) {
        try {
            const res = await setDefaultProvider(id)
            if (!res.success) throw new Error(res.error)
            toast.success('Default provider updated')
            await loadData()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    const getProviderLabel = (type: string) => {
        return PROVIDER_TYPES.find(p => p.value === type)?.label || type
    }

    const getModelsForType = (type: string) => {
        return PROVIDER_TYPES.find(p => p.value === type)?.models || []
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
                        <div className="p-3 rounded-2xl bg-purple-100 text-purple-600">
                            <Cloud size={28} />
                        </div>
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">AI Providers</h2>
                    <p className="text-gray-500 mt-2 font-medium">
                        {providers.length} provider{providers.length !== 1 ? 's' : ''} configured
                    </p>
                </div>
                <div className="flex gap-3">
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
                        className="rounded-2xl px-6 py-5 font-bold bg-purple-600 hover:bg-purple-500"
                    >
                        <Plus size={18} />
                        Add Provider
                    </Button>
                </div>
            </div>

            {/* Provider Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add AI Provider'}</DialogTitle>
                        <DialogDescription>
                            Configure an AI provider for MCP integration.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="My OpenAI Provider"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Provider Type</Label>
                            <Select
                                value={formData.provider_type}
                                onValueChange={(v) => setFormData({
                                    ...formData,
                                    provider_type: v,
                                    model_name: getModelsForType(v)[0] || ''
                                })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROVIDER_TYPES.map((p) => (
                                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <div className="relative">
                                <Input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={formData.api_key}
                                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                    placeholder={editingProvider ? '••••••••••••' : 'sk-...'}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-1 top-1"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                >
                                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                </Button>
                            </div>
                        </div>

                        {(formData.provider_type === 'azure' || formData.provider_type === 'ollama' || formData.provider_type === 'custom') && (
                            <div className="space-y-2">
                                <Label>API Base URL</Label>
                                <Input
                                    value={formData.api_base_url}
                                    onChange={(e) => setFormData({ ...formData, api_base_url: e.target.value })}
                                    placeholder={formData.provider_type === 'ollama' ? 'http://localhost:11434' : 'https://your-endpoint.com'}
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Model</Label>
                            {getModelsForType(formData.provider_type).length > 0 ? (
                                <Select
                                    value={formData.model_name}
                                    onValueChange={(v) => setFormData({ ...formData, model_name: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getModelsForType(formData.provider_type).map((m) => (
                                            <SelectItem key={m} value={m}>{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    value={formData.model_name}
                                    onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
                                    placeholder="model-name"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Max Tokens</Label>
                                <Input
                                    type="number"
                                    value={formData.max_tokens}
                                    onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) || 4096 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Temperature</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="2"
                                    value={formData.temperature}
                                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) || 0.7 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Timeout (s)</Label>
                                <Input
                                    type="number"
                                    value={formData.timeout_seconds}
                                    onChange={(e) => setFormData({ ...formData, timeout_seconds: parseInt(e.target.value) || 30 })}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-500">
                            <Save size={16} />
                            {saving ? 'Saving...' : 'Save Provider'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Providers Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
                </div>
            ) : providers.length === 0 ? (
                <Card className="rounded-3xl shadow-xl border-gray-100">
                    <CardContent className="p-0">
                        <div className="text-center py-20 text-gray-400">
                            <Cloud className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p className="font-medium">No AI providers configured</p>
                            <p className="text-sm mt-1">Add a provider to enable AI integration</p>
                            <Button onClick={handleNew} className="mt-4 bg-purple-600 hover:bg-purple-500">
                                <Plus size={16} />
                                Add Your First Provider
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {providers.map((provider) => (
                        <Card key={provider.id} className="rounded-2xl shadow-lg border-gray-100 hover:shadow-xl transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-gray-900">{provider.name}</h3>
                                            {provider.is_default && (
                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                                    <Star size={12} className="mr-1" />
                                                    Default
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500">
                                            {getProviderLabel(provider.provider_type)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {provider.last_tested_at && (
                                            provider.last_test_success ? (
                                                <CheckCircle size={18} className="text-green-500" />
                                            ) : (
                                                <XCircle size={18} className="text-red-500" />
                                            )
                                        )}
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-gray-50 mb-4">
                                    <p className="text-sm font-mono text-gray-600">{provider.model_name}</p>
                                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                                        <span>Max: {provider.max_tokens}</span>
                                        <span>Temp: {provider.temperature}</span>
                                    </div>
                                </div>

                                <div className="flex gap-2 flex-wrap">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleTest(provider.id)}
                                        disabled={testing === provider.id}
                                        className="flex-1"
                                    >
                                        <Zap size={14} className={testing === provider.id ? 'animate-pulse' : ''} />
                                        {testing === provider.id ? 'Testing...' : 'Test'}
                                    </Button>
                                    {!provider.is_default && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleSetDefault(provider.id)}
                                        >
                                            <Star size={14} />
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleEdit(provider)}
                                    >
                                        <Edit2 size={14} />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(provider.id)}
                                        className="text-red-500 hover:text-red-600"
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
