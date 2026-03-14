// @ts-nocheck
'use client'
/**
 * MCP AI Providers — V2 Dajingo Pro Redesign
 * ============================================
 * Premium provider management with glassmorphism cards,
 * gradient accents, and professional connection testing.
 */
import { useEffect, useState } from 'react'
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
    Plus, Trash2, Edit2, RefreshCw, Save, Star,
    Cloud, CheckCircle, XCircle, Zap, Eye, EyeOff,
    Cpu, Server, Shield, Activity
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
    { value: 'openai', label: 'OpenAI', color: '#10A37F', models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { value: 'anthropic', label: 'Anthropic', color: '#D4A06A', models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'] },
    { value: 'google', label: 'Google Gemini', color: '#4285F4', models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
    { value: 'azure', label: 'Azure OpenAI', color: '#0078D4', models: ['gpt-4', 'gpt-35-turbo'] },
    { value: 'ollama', label: 'Ollama (Local)', color: '#6366F1', models: ['llama2', 'mistral', 'codellama'] },
    { value: 'custom', label: 'Custom API', color: '#8B5CF6', models: [] },
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
    const [deleteProviderId, setDeleteProviderId] = useState<number | null>(null)

    useEffect(() => { loadData() }, [])

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
            api_key: '',
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
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        } finally {
            setSaving(false)
        }
    }

    async function confirmDeleteProvider() {
        if (deleteProviderId === null) return
        try {
            const res = await deleteMCPProvider(deleteProviderId)
            if (!res.success) throw new Error(res.error)
            toast.success('Provider deleted')
            await loadData()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        }
        setDeleteProviderId(null)
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
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
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
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        }
    }

    const getProviderMeta = (type: string) => PROVIDER_TYPES.find(p => p.value === type) || PROVIDER_TYPES[5]
    const getModelsForType = (type: string) => PROVIDER_TYPES.find(p => p.value === type)?.models || []
    const activeCount = providers.filter(p => p.is_active).length
    const defaultProvider = providers.find(p => p.is_default)

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
                            <Cloud className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                                AI Providers
                            </h1>
                            <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                                {providers.length} provider{providers.length !== 1 ? 's' : ''} configured
                                {activeCount > 0 && <> · <span style={{ color: 'var(--app-success)' }}>{activeCount} active</span></>}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            onClick={loadData}
                            disabled={loading}
                            variant="outline"
                            className="rounded-xl px-4 h-11 font-bold"
                            style={{ borderColor: 'var(--app-border)' }}
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </Button>
                        <Button
                            onClick={handleNew}
                            className="rounded-xl px-5 h-11 font-bold text-white"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 14px var(--app-primary-glow)',
                            }}
                        >
                            <Plus size={16} className="mr-2" />
                            Add Provider
                        </Button>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                    {[
                        { label: 'Total Providers', value: providers.length, icon: Server },
                        { label: 'Active', value: activeCount, icon: Activity },
                        { label: 'Default', value: defaultProvider?.name || 'None', icon: Star },
                        { label: 'Verified', value: providers.filter(p => p.last_test_success).length, icon: Shield },
                    ].map((stat, i) => (
                        <div
                            key={i}
                            className="rounded-xl p-3"
                            style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <stat.icon size={14} style={{ color: 'var(--app-text-muted)' }} />
                                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>
                                    {stat.label}
                                </span>
                            </div>
                            <p className="text-lg font-black truncate" style={{ color: 'var(--app-text)' }}>
                                {stat.value}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Provider Dialog ──────────────────────────────────── */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <DialogHeader>
                        <DialogTitle style={{ color: 'var(--app-text)' }}>
                            {editingProvider ? 'Edit Provider' : 'Add AI Provider'}
                        </DialogTitle>
                        <DialogDescription style={{ color: 'var(--app-text-muted)' }}>
                            Configure an AI provider for intelligent analysis.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label style={{ color: 'var(--app-text)' }}>Name</Label>
                            <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="My OpenAI Provider"
                                className="rounded-xl"
                                style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label style={{ color: 'var(--app-text)' }}>Provider Type</Label>
                            <Select
                                value={formData.provider_type}
                                onValueChange={(v) => setFormData({
                                    ...formData,
                                    provider_type: v,
                                    model_name: getModelsForType(v)[0] || ''
                                })}
                            >
                                <SelectTrigger className="rounded-xl" style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PROVIDER_TYPES.map((p) => (
                                        <SelectItem key={p.value} value={p.value}>
                                            <span className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                {p.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label style={{ color: 'var(--app-text)' }}>API Key</Label>
                            <div className="relative">
                                <Input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={formData.api_key}
                                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                                    placeholder={editingProvider ? '••••••••••••' : 'sk-...'}
                                    className="rounded-xl pr-10"
                                    style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
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
                                <Label style={{ color: 'var(--app-text)' }}>API Base URL</Label>
                                <Input
                                    value={formData.api_base_url}
                                    onChange={(e) => setFormData({ ...formData, api_base_url: e.target.value })}
                                    placeholder={formData.provider_type === 'ollama' ? 'http://localhost:11434' : 'https://your-endpoint.com'}
                                    className="rounded-xl"
                                    style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label style={{ color: 'var(--app-text)' }}>Model</Label>
                            {getModelsForType(formData.provider_type).length > 0 ? (
                                <Select
                                    value={formData.model_name}
                                    onValueChange={(v) => setFormData({ ...formData, model_name: v })}
                                >
                                    <SelectTrigger className="rounded-xl" style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)' }}>
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
                                    className="rounded-xl"
                                    style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Max Tokens', key: 'max_tokens', type: 'number', step: undefined },
                                { label: 'Temperature', key: 'temperature', type: 'number', step: '0.1' },
                                { label: 'Timeout (s)', key: 'timeout_seconds', type: 'number', step: undefined },
                            ].map(field => (
                                <div key={field.key} className="space-y-2">
                                    <Label className="text-xs" style={{ color: 'var(--app-text-muted)' }}>{field.label}</Label>
                                    <Input
                                        type={field.type}
                                        step={field.step}
                                        value={(formData as any)[field.key]}
                                        onChange={(e) => setFormData({ ...formData, [field.key]: parseFloat(e.target.value) || 0 })}
                                        className="rounded-xl"
                                        style={{ background: 'var(--app-bg)', borderColor: 'var(--app-border)', color: 'var(--app-text)' }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="rounded-xl text-white"
                            style={{ background: 'var(--app-primary)' }}
                        >
                            <Save size={16} className="mr-2" />
                            {saving ? 'Saving...' : 'Save Provider'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Providers Grid ───────────────────────────────────── */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--app-primary)' }} />
                        <p className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>Loading providers...</p>
                    </div>
                </div>
            ) : providers.length === 0 ? (
                <div
                    className="rounded-[28px] p-12 text-center"
                    style={{
                        background: 'var(--app-surface)',
                        border: '2px dashed var(--app-border)',
                    }}
                >
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                        style={{ background: 'var(--app-primary-light)' }}
                    >
                        <Cloud className="w-8 h-8" style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <h3 className="text-xl font-black mb-2" style={{ color: 'var(--app-text)' }}>
                        No AI Providers Configured
                    </h3>
                    <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: 'var(--app-text-muted)' }}>
                        Connect your first AI provider to unlock intelligent analysis, automated insights, and smart recommendations.
                    </p>
                    <Button
                        onClick={handleNew}
                        className="rounded-xl px-6 h-11 font-bold text-white"
                        style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}
                    >
                        <Plus size={16} className="mr-2" />
                        Add Your First Provider
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {providers.map((provider) => {
                        const meta = getProviderMeta(provider.provider_type)
                        return (
                            <div
                                key={provider.id}
                                className="rounded-[20px] overflow-hidden transition-all duration-300 hover:translate-y-[-2px] group"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: '1px solid var(--app-border)',
                                    boxShadow: 'var(--app-shadow-md)',
                                }}
                            >
                                {/* Color accent bar */}
                                <div className="h-1" style={{ background: meta.color }} />

                                <div className="p-5">
                                    {/* Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                style={{ background: `${meta.color}18` }}
                                            >
                                                <Cpu size={20} style={{ color: meta.color }} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-[15px]" style={{ color: 'var(--app-text)' }}>
                                                        {provider.name}
                                                    </h3>
                                                    {provider.is_default && (
                                                        <Badge className="text-[9px] font-black uppercase px-1.5 py-0"
                                                            style={{ background: 'var(--app-warning-light)', color: 'var(--app-warning)', border: '1px solid var(--app-warning)' }}>
                                                            Default
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-xs font-medium" style={{ color: 'var(--app-text-muted)' }}>
                                                    {meta.label}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Connection status */}
                                        {provider.last_tested_at && (
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${provider.last_test_success ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                                {provider.last_test_success ? (
                                                    <CheckCircle size={16} className="text-emerald-500" />
                                                ) : (
                                                    <XCircle size={16} className="text-red-500" />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Model info */}
                                    <div
                                        className="rounded-xl p-3 mb-4"
                                        style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}
                                    >
                                        <p className="text-sm font-mono font-bold" style={{ color: 'var(--app-text)' }}>
                                            {provider.model_name}
                                        </p>
                                        <div className="flex gap-4 mt-1.5">
                                            {[
                                                { label: 'Max Tokens', value: provider.max_tokens.toLocaleString() },
                                                { label: 'Temperature', value: provider.temperature },
                                                { label: 'Timeout', value: `${provider.timeout_seconds}s` },
                                            ].map(item => (
                                                <span key={item.label} className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                                                    <span className="font-bold">{item.label}:</span> {item.value}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleTest(provider.id)}
                                            disabled={testing === provider.id}
                                            className="flex-1 rounded-xl h-9 text-xs font-bold"
                                            style={{ borderColor: 'var(--app-border)' }}
                                        >
                                            <Zap size={13} className={testing === provider.id ? 'animate-pulse mr-1.5' : 'mr-1.5'} />
                                            {testing === provider.id ? 'Testing...' : 'Test'}
                                        </Button>
                                        {!provider.is_default && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleSetDefault(provider.id)}
                                                className="rounded-xl h-9 px-3"
                                                style={{ borderColor: 'var(--app-border)' }}
                                                title="Set as default"
                                            >
                                                <Star size={13} />
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleEdit(provider)}
                                            className="rounded-xl h-9 px-3"
                                        >
                                            <Edit2 size={13} />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setDeleteProviderId(provider.id)}
                                            className="rounded-xl h-9 px-3 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                        >
                                            <Trash2 size={13} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            <ConfirmDialog
                open={deleteProviderId !== null}
                onOpenChange={(open) => { if (!open) setDeleteProviderId(null) }}
                onConfirm={confirmDeleteProvider}
                title="Delete Provider?"
                description="This AI provider configuration will be permanently removed."
                variant="danger"
            />
        </div>
    )
}
