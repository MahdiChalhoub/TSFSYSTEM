'use client'

/**
 * MCP Tools — Configuration (Dajingo Pro redesign)
 * =================================================
 * Define + manage tools the AI can call. Inline form, theme tokens
 * only, conformant to design-language.md.
 */

import { useEffect, useRef, useState } from 'react'
import {
    ArrowLeft, Plus, Trash2, Edit2, RefreshCw, Save, Wand2,
    Wrench, Database, ShoppingCart, DollarSign, Users, Box,
    Search, X, ShieldAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    getMCPTools, createMCPTool, updateMCPTool, deleteMCPTool, registerDefaultTools,
} from '@/app/actions/saas/mcp'
import {
    ModulePage, PageHeader, KPIStrip, EmptyState, Loading,
    GhostButton, PrimaryButton, StatusPill,
} from '../_design'

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
    { value: 'inventory', label: 'Inventory',       icon: Box,          color: 'var(--app-success, #22c55e)' },
    { value: 'finance',   label: 'Finance',         icon: DollarSign,   color: 'var(--app-warning, #f59e0b)' },
    { value: 'pos',       label: 'Point of Sale',   icon: ShoppingCart, color: 'var(--app-info, #3b82f6)' },
    { value: 'crm',       label: 'CRM',             icon: Users,        color: 'var(--app-primary)' },
    { value: 'hr',        label: 'Human Resources', icon: Users,        color: '#8b5cf6' },
    { value: 'system',    label: 'System',          icon: Database,     color: 'var(--app-muted-foreground)' },
    { value: 'custom',    label: 'Custom',          icon: Wrench,       color: 'var(--app-foreground)' },
]

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const emptyTool = {
    name: '', description: '', category: 'custom', internal_endpoint: '',
    http_method: 'GET', parameters_schema: {}, required_permissions: [] as string[],
    is_active: true, requires_confirmation: false,
}

export default function MCPToolsPage() {
    const [tools, setTools] = useState<Tool[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Tool | null>(null)
    const [form, setForm] = useState(emptyTool)
    const [saving, setSaving] = useState(false)
    const [schemaText, setSchemaText] = useState('{}')
    const [registering, setRegistering] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
    const [search, setSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState<string | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    useEffect(() => { loadData() }, [])
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
            setTools(await getMCPTools())
        } catch {
            toast.error('Failed to load tools')
        } finally {
            setLoading(false)
        }
    }

    function startEdit(t: Tool) {
        setEditing(t)
        setForm({ ...emptyTool, ...t, parameters_schema: t.parameters_schema || {} })
        setSchemaText(JSON.stringify(t.parameters_schema || {}, null, 2))
        setShowForm(true)
    }
    function startNew() {
        setEditing(null)
        setForm(emptyTool)
        setSchemaText('{}')
        setShowForm(true)
    }

    async function handleSave() {
        if (!form.name) { toast.error('Name is required'); return }
        let parsed = {}
        try { parsed = JSON.parse(schemaText) } catch { toast.error('Invalid JSON in parameters schema'); return }
        setSaving(true)
        try {
            const payload = { ...form, parameters_schema: parsed }
            const res = editing
                ? await updateMCPTool(editing.id, payload as any)
                : await createMCPTool(payload as any)
            if (!res.success) throw new Error((res as any).error)
            toast.success(editing ? 'Tool updated' : 'Tool created')
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
            const res = await deleteMCPTool(confirmDelete)
            if (!res.success) throw new Error((res as any).error)
            toast.success('Tool deleted')
            await loadData()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e))
        }
        setConfirmDelete(null)
    }

    async function handleRegisterDefaults() {
        setRegistering(true)
        try {
            const res = await registerDefaultTools()
            if (res.success) toast.success('Default tools registered')
            else toast.error((res as any).error || 'Failed to register defaults')
            await loadData()
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : String(e))
        } finally {
            setRegistering(false)
        }
    }

    const catMeta = (c: string) => CATEGORIES.find(x => x.value === c) || CATEGORIES[CATEGORIES.length - 1]
    const filtered = tools.filter(t => {
        if (activeCategory && t.category !== activeCategory) return false
        if (!search) return true
        const q = search.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.internal_endpoint.toLowerCase().includes(q)
    })

    const kpis = [
        { label: 'Tools', value: tools.length, icon: <Wrench size={14} />, color: 'var(--app-primary)', filterKey: null as string | null },
        ...CATEGORIES.slice(0, 4).map(c => ({
            label: c.label,
            value: tools.filter(t => t.category === c.value).length,
            icon: <c.icon size={14} />,
            color: c.color,
            isActive: activeCategory === c.value,
            onClick: () => setActiveCategory(prev => prev === c.value ? null : c.value),
        })),
    ]

    return (
        <ModulePage>
            <PageHeader
                icon={<Wrench size={20} className="text-white" />}
                title="MCP Tools"
                subtitle={`${tools.length} tool${tools.length === 1 ? '' : 's'} exposed to AI`}
                actions={
                    <>
                        <GhostButton icon={<ArrowLeft size={13} />} label="Back" href="/mcp" />
                        <GhostButton icon={<Wand2 size={13} className={registering ? 'animate-spin' : ''} />} label="Register Defaults" onClick={handleRegisterDefaults} disabled={registering} />
                        <GhostButton icon={<RefreshCw size={13} className={loading ? 'animate-spin' : ''} />} label="Refresh" onClick={loadData} disabled={loading} />
                        <PrimaryButton icon={<Plus size={14} />} label="New Tool" onClick={startNew} />
                    </>
                }
            />

            <KPIStrip items={kpis} />

            {/* Active filter pill */}
            {activeCategory && (
                <div className="mb-3 flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground">Filtered by:</span>
                    <button onClick={() => setActiveCategory(null)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                        {catMeta(activeCategory).label}
                        <X size={10} />
                    </button>
                </div>
            )}

            {/* Search */}
            <div className="mb-3 flex-shrink-0 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by name, description, endpoint... (Ctrl+K)"
                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                />
            </div>

            {/* Inline form */}
            {showForm && (
                <div className="flex-shrink-0 mb-3 p-4 border rounded-2xl animate-in slide-in-from-top-2 duration-200"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                        borderColor: 'var(--app-border)',
                        borderLeft: '3px solid var(--app-primary)',
                    }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[12px] font-black text-app-foreground uppercase tracking-wider">
                            {editing ? 'Edit Tool' : 'Add MCP Tool'}
                        </h3>
                        <button onClick={() => setShowForm(false)} className="p-1 hover:bg-app-border/50 rounded-lg transition-colors">
                            <X size={14} className="text-app-muted-foreground" />
                        </button>
                    </div>

                    <form onSubmit={e => { e.preventDefault(); handleSave() }}
                        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', alignItems: 'end' }}>
                        <Field label="Name">
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary"
                                placeholder="get_products" />
                        </Field>
                        <Field label="Category">
                            <select value={form.category}
                                onChange={e => setForm({ ...form, category: e.target.value })}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary">
                                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </Field>
                        <Field label="HTTP Method">
                            <select value={form.http_method}
                                onChange={e => setForm({ ...form, http_method: e.target.value })}
                                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary">
                                {HTTP_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </Field>
                        <Field label="Internal Endpoint">
                            <input value={form.internal_endpoint}
                                onChange={e => setForm({ ...form, internal_endpoint: e.target.value })}
                                className="w-full text-[12px] font-mono font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary"
                                placeholder="inventory/products/" />
                        </Field>
                    </form>

                    <Field label="Description" className="mt-2">
                        <textarea value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            className="w-full text-[12px] font-medium px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary resize-y"
                            rows={2} placeholder="Tool description shown to the AI." />
                    </Field>

                    <Field label="Parameters Schema (JSON)" className="mt-2">
                        <textarea value={schemaText}
                            onChange={e => setSchemaText(e.target.value)}
                            className="w-full text-[11px] font-mono px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:border-app-primary resize-y custom-scrollbar"
                            rows={5} spellCheck={false} />
                    </Field>

                    <div className="flex flex-wrap gap-3 mt-3 items-center">
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-app-foreground">
                            <input type="checkbox" checked={form.is_active}
                                onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                            Active
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-[11px] font-bold text-app-foreground">
                            <input type="checkbox" checked={form.requires_confirmation}
                                onChange={e => setForm({ ...form, requires_confirmation: e.target.checked })} />
                            Require confirmation before AI runs this
                        </label>
                        <div className="flex-1" />
                        <GhostButton icon={<X size={13} />} label="Cancel" onClick={() => setShowForm(false)} />
                        <PrimaryButton icon={<Save size={13} />} label={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={saving} />
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {loading ? <Loading /> : filtered.length === 0 ? (
                    <EmptyState icon={<Wrench size={36} />}
                        title={search || activeCategory ? 'No matching tools' : 'No tools registered'}
                        description={search || activeCategory ? 'Try a different filter or search.' : 'Click "Register Defaults" to seed the standard ERP tool catalogue, or add your own.'}
                        action={!(search || activeCategory) && (
                            <div className="flex gap-2">
                                <GhostButton icon={<Wand2 size={13} />} label="Register Defaults" onClick={handleRegisterDefaults} disabled={registering} />
                                <PrimaryButton icon={<Plus size={13} />} label="Add Tool" onClick={startNew} />
                            </div>
                        )} />
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                        {filtered.map(t => {
                            const cat = catMeta(t.category)
                            const Icon = cat.icon
                            return (
                                <div key={t.id} className="rounded-xl p-3 transition-all"
                                    style={{
                                        background: 'var(--app-surface)',
                                        border: `1px solid ${t.is_active ? 'var(--app-border)' : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                        opacity: t.is_active ? 1 : 0.65,
                                    }}>
                                    <div className="flex items-start gap-2 mb-2">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: `color-mix(in srgb, ${cat.color} 12%, transparent)`, color: cat.color }}>
                                            <Icon size={14} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="text-[13px] font-black text-app-foreground truncate font-mono">{t.name}</h3>
                                                <StatusPill label={cat.label} color={cat.color} />
                                                {t.requires_confirmation && (
                                                    <StatusPill label="Confirm" color="var(--app-warning, #f59e0b)" icon={<ShieldAlert size={9} />} />
                                                )}
                                                {!t.is_active && <StatusPill label="Inactive" color="var(--app-muted-foreground)" />}
                                            </div>
                                            <p className="text-[11px] font-medium text-app-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                                        </div>
                                    </div>
                                    <div className="rounded-lg px-2.5 py-1.5 mb-2 flex items-center gap-2"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 20%, transparent)' }}>
                                        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                                            {t.http_method}
                                        </span>
                                        <code className="text-[11px] font-mono font-bold text-app-foreground truncate">{t.internal_endpoint}</code>
                                    </div>
                                    <div className="flex gap-1 justify-end">
                                        <button onClick={() => startEdit(t)} title="Edit"
                                            className="text-[11px] font-bold px-2 py-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all">
                                            <Edit2 size={11} />
                                        </button>
                                        <button onClick={() => setConfirmDelete(t.id)} title="Delete"
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
                        })}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={confirmDelete !== null}
                onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
                onConfirm={confirmDeleteAction}
                title="Delete Tool?"
                description="The AI will no longer be able to call this tool."
                variant="danger"
            />
        </ModulePage>
    )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={className}>
            <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                {label}
            </label>
            {children}
        </div>
    )
}
