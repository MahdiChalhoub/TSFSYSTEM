'use client'

/**
 * MCP AI Providers — Configuration Page (Dajingo Pro redesign)
 * =============================================================
 * Add and manage AI providers (OpenAI, Anthropic, Gemini, Azure,
 * Ollama, Custom). Inline form rather than modal — matches the COA /
 * Categories pattern and avoids the modal-on-modal friction.
 *
 * All visuals conform to design-language.md: page-header-icon, KPI
 * strip, search bar with Ctrl+K, auto-fit grids, theme tokens only.
 */

import { useEffect, useRef, useState } from 'react'
import {
    ArrowLeft, Plus, Trash2, Edit2, RefreshCw, Save, Star, Cloud,
    CheckCircle, XCircle, Zap, Eye, EyeOff, Search, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    getMCPProviders, createMCPProvider, updateMCPProvider,
    deleteMCPProvider, testMCPProvider, setDefaultProvider,
} from '@/app/actions/saas/mcp'
import {
    ModulePage, PageHeader, KPIStrip, EmptyState, Loading,
    GhostButton, PrimaryButton, StatusPill,
} from '../_design'

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
    { value: 'openai',    label: 'OpenAI',             models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
    { value: 'anthropic', label: 'Anthropic (Claude)', models: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'] },
    { value: 'google',    label: 'Google (Gemini)',    models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
    { value: 'azure',     label: 'Azure OpenAI',       models: ['gpt-4', 'gpt-35-turbo'] },
    { value: 'ollama',    label: 'Ollama (Local)',     models: ['llama2', 'mistral', 'codellama'] },
    { value: 'custom',    label: 'Custom API',         models: [] },
]

const emptyProvider = {
    name: '', provider_type: 'anthropic', api_key: '', api_base_url: '',
    model_name: 'claude-sonnet-4-6', max_tokens: 4096, temperature: 0.7, timeout_seconds: 30,
}

export default function MCPProvidersPage() {
    const [providers, setProviders] = useState<Provider[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Provider | null>(null)
    const [form, setForm] = useState(emptyProvider)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState<number | null>(null)
    const [showApiKey, setShowApiKey] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
    const [search, setSearch] = useState('')
    const searchRef = useRef<HTMLInputElement>(null)

    useEffect(() => { loadData() }, [])

    // Ctrl+K focuses search — mandatory per design-language §5.
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', h)
        return () => window.removeEventListener('keydown', h)
    }, [])

    async function loadData() {
        setLoading(true)
        try {
            setProviders(await getMCPProviders())
        } catch {
            toast.error('Failed to load providers')
        } finally {
            setLoading(false)
        }
    }

    function startEdit(p: Provider) {
        setEditing(p)
        setForm({
            name: p.name, provider_type: p.provider_type, api_key: '',
            api_base_url: p.api_base_url || '', model_name: p.model_name,
            max_tokens: p.max_tokens, temperature: p.temperature,
            timeout_seconds: p.timeout_seconds,
        })
        setShowForm(true)
    }

    function startNew() {
        setEditing(null)
        setForm(emptyProvider)
        setShowForm(true)
    }

    async function handleSave() {
        if (!form.name || !form.provider_type) {
            toast.error('Name and provider type are required'); return
        }
        setSaving(true)
        try {
            const res = editing
                ? await updateMCPProvider(editing.id, form as any)
                : await createMCPProvider(form as any)
            if (!res.success) throw new Error((res as any).error)
            toast.success(editing ? 'Provider updated' : 'Provider created')
            setShowForm(false)
            await loadData()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e))
        } finally {
            setSaving(false)
        }
    }

    async function confirmDeleteAction() {
        if (confirmDelete === null) return
        try {
            const res = await deleteMCPProvider(confirmDelete)
            if (!res.success) throw new Error((res as any).error)
            toast.success('Provider deleted')
            await loadData()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e))
        }
        setConfirmDelete(null)
    }

    async function handleTest(id: number) {
        setTesting(id)
        try {
            const res = await testMCPProvider(id)
            if (res.success) toast.success('Connection successful!')
            else toast.error((res as any).message || 'Connection failed')
            await loadData()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e))
        } finally {
            setTesting(null)
        }
    }

    async function handleSetDefault(id: number) {
        try {
            const res = await setDefaultProvider(id)
            if (!res.success) throw new Error((res as any).error)
            toast.success('Default provider updated')
            await loadData()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e))
        }
    }

    const getLabel = (t: string) => PROVIDER_TYPES.find(p => p.value === t)?.label || t
    const getModels = (t: string) => PROVIDER_TYPES.find(p => p.value === t)?.models || []

    const filtered = providers.filter(p =>
        !search || p.name.toLowerCase().includes(search.toLowerCase())
            || p.provider_type.toLowerCase().includes(search.toLowerCase())
            || p.model_name.toLowerCase().includes(search.toLowerCase())
    )

    const activeCount  = providers.filter(p => p.is_active).length
    const defaultCount = providers.filter(p => p.is_default).length
    const testedCount  = providers.filter(p => p.last_tested_at && p.last_test_success).length

    const kpis = [
        { label: 'Providers', value: providers.length,                     icon: <Cloud size={14} />,        color: 'var(--app-primary)' },
        { label: 'Active',    value: activeCount,                          icon: <CheckCircle size={14} />,  color: 'var(--app-success, #22c55e)' },
        { label: 'Default',   value: defaultCount,                         icon: <Star size={14} />,         color: 'var(--app-warning, #f59e0b)' },
        { label: 'Tested OK', value: testedCount,                          icon: <Zap size={14} />,          color: 'var(--app-info, #3b82f6)' },
    ]

    return (
        <ModulePage>
            <PageHeader
                icon={<Cloud size={20} className="text-white" />}
                title="AI Providers"
                subtitle={`${providers.length} provider${providers.length === 1 ? '' : 's'} configured`}
                actions={
                    <>
                        <GhostButton icon={<ArrowLeft size={13} />} label="Back" href="/mcp" />
                        <GhostButton icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />} label="Refresh" onClick={loadData} disabled={loading} />
                        <PrimaryButton icon={<Plus size={14} />} label="Add Provider" onClick={startNew} />
                    </>
                }
            />

            <KPIStrip items={kpis} />

            {/* Search bar */}
            <div className="mb-3 flex-shrink-0">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, type, model... (Ctrl+K)"
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Inline form (not a modal — matches COA-style §12) */}
            {showForm && (
                <div className="flex-shrink-0 mb-3 p-4 border rounded-2xl animate-in slide-in-from-top-2 duration-200"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                        borderColor: 'var(--app-border)',
                        borderLeft: '3px solid var(--app-primary)',
                    }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="uppercase">
                            {editing ? 'Edit Provider' : 'Add AI Provider'}
                        </h3>
                        <button onClick={() => setShowForm(false)} className="p-1 hover:bg-app-border/50 rounded-lg transition-colors">
                            <X size={14} className="text-app-muted-foreground" />
                        </button>
                    </div>

                    <form onSubmit={e => { e.preventDefault(); handleSave() }}
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', alignItems: 'end' }}>
                        <FormField label="Name">
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="My Anthropic Provider"
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary" />
                        </FormField>

                        <FormField label="Provider Type">
                            <select value={form.provider_type}
                                onChange={e => setForm({ ...form, provider_type: e.target.value, model_name: getModels(e.target.value)[0] || '' })}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary">
                                {PROVIDER_TYPES.map(p => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="API Key">
                            <div className="relative">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={form.api_key}
                                    onChange={e => setForm({ ...form, api_key: e.target.value })}
                                    placeholder={editing ? '•••••••••• (leave blank to keep)' : 'sk-...'}
                                    className="w-full text-[12px] font-mono font-bold px-2.5 py-2 pr-9 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary" />
                                <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-app-border/50 text-app-muted-foreground transition-colors">
                                    {showApiKey ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                            </div>
                        </FormField>

                        {(form.provider_type === 'azure' || form.provider_type === 'ollama' || form.provider_type === 'custom') && (
                            <FormField label="API Base URL">
                                <input value={form.api_base_url}
                                    onChange={e => setForm({ ...form, api_base_url: e.target.value })}
                                    placeholder={form.provider_type === 'ollama' ? 'http://localhost:11434' : 'https://your-endpoint.com'}
                                    className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary" />
                            </FormField>
                        )}

                        <FormField label="Model">
                            {getModels(form.provider_type).length > 0 ? (
                                <select value={form.model_name}
                                    onChange={e => setForm({ ...form, model_name: e.target.value })}
                                    className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary">
                                    {getModels(form.provider_type).map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            ) : (
                                <input value={form.model_name}
                                    onChange={e => setForm({ ...form, model_name: e.target.value })}
                                    placeholder="model-name"
                                    className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary" />
                            )}
                        </FormField>

                        <FormField label="Max Tokens">
                            <input type="number" value={form.max_tokens}
                                onChange={e => setForm({ ...form, max_tokens: parseInt(e.target.value) || 4096 })}
                                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary" />
                        </FormField>

                        <FormField label="Temperature">
                            <input type="number" step="0.1" min="0" max="2" value={form.temperature}
                                onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) || 0.7 })}
                                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary" />
                        </FormField>

                        <FormField label="Timeout (s)">
                            <input type="number" value={form.timeout_seconds}
                                onChange={e => setForm({ ...form, timeout_seconds: parseInt(e.target.value) || 30 })}
                                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary" />
                        </FormField>
                    </form>

                    <div className="flex gap-1.5 mt-3 justify-end">
                        <GhostButton icon={<X size={13} />} label="Cancel" onClick={() => setShowForm(false)} />
                        <PrimaryButton icon={<Save size={13} />} label={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={saving} />
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <Loading />
                ) : filtered.length === 0 ? (
                    <EmptyState
                        icon={<Cloud size={36} />}
                        title={search ? 'No matching providers' : 'No AI providers configured'}
                        description={search ? 'Try a different search term.' : 'Add a provider to enable AI integration across the platform.'}
                        action={!search && <PrimaryButton icon={<Plus size={13} />} label="Add Your First Provider" onClick={startNew} />} />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                        {filtered.map(p => (
                            <ProviderCard key={p.id}
                                provider={p}
                                providerLabel={getLabel(p.provider_type)}
                                onTest={() => handleTest(p.id)}
                                testing={testing === p.id}
                                onSetDefault={() => handleSetDefault(p.id)}
                                onEdit={() => startEdit(p)}
                                onDelete={() => setConfirmDelete(p.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={confirmDelete !== null}
                onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
                onConfirm={confirmDeleteAction}
                title="Delete Provider?"
                description="This AI provider configuration will be permanently removed."
                variant="danger"
            />
        </ModulePage>
    )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                {label}
            </label>
            {children}
        </div>
    )
}

function ProviderCard({
    provider, providerLabel, onTest, testing, onSetDefault, onEdit, onDelete,
}: {
    provider: Provider
    providerLabel: string
    onTest: () => void
    testing: boolean
    onSetDefault: () => void
    onEdit: () => void
    onDelete: () => void
}) {
    return (
        <div className="rounded-xl p-3 transition-all"
            style={{
                background: provider.is_default
                    ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, var(--app-surface))'
                    : 'var(--app-surface)',
                border: `1px solid ${provider.is_default
                    ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)'
                    : 'var(--app-border)'}`,
            }}>
            <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="truncate">{provider.name}</h3>
                        {provider.is_default && <StatusPill label="Default" color="var(--app-warning, #f59e0b)" icon={<Star size={9} />} />}
                        {!provider.is_active && <StatusPill label="Inactive" color="var(--app-muted-foreground)" />}
                    </div>
                    <p className="text-[11px] font-medium text-app-muted-foreground mt-0.5">{providerLabel}</p>
                </div>
                {provider.last_tested_at && (
                    provider.last_test_success
                        ? <CheckCircle size={14} className="flex-shrink-0" style={{ color: 'var(--app-success, #22c55e)' }} />
                        : <XCircle size={14} className="flex-shrink-0" style={{ color: 'var(--app-error, #ef4444)' }} />
                )}
            </div>

            <div className="rounded-lg px-2.5 py-2 mb-2"
                style={{ background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }}>
                <p className="text-[11px] font-mono font-bold text-app-foreground truncate">{provider.model_name}</p>
                <div className="flex gap-3 mt-1 text-[10px] text-app-muted-foreground font-medium">
                    <span>Max: <span className="tabular-nums font-bold">{provider.max_tokens.toLocaleString()}</span></span>
                    <span>Temp: <span className="tabular-nums font-bold">{provider.temperature}</span></span>
                </div>
            </div>

            <div className="flex gap-1 flex-wrap">
                <button onClick={onTest} disabled={testing}
                    className="flex-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                    style={{
                        borderColor: 'color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)',
                        color: 'var(--app-info, #3b82f6)',
                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)',
                    }}>
                    <Zap size={11} className={testing ? 'animate-pulse' : ''} />
                    {testing ? 'Testing…' : 'Test'}
                </button>
                {!provider.is_default && (
                    <button onClick={onSetDefault} title="Set as default"
                        className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                        <Star size={11} />
                    </button>
                )}
                <button onClick={onEdit} title="Edit"
                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                    <Edit2 size={11} />
                </button>
                <button onClick={onDelete} title="Delete"
                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg border transition-all"
                    style={{
                        borderColor: 'color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)',
                        color: 'var(--app-error, #ef4444)',
                    }}>
                    <Trash2 size={11} />
                </button>
            </div>
        </div>
    )
}
