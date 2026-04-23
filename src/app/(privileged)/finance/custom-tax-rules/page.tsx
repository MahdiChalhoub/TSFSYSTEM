'use client'
/**
 * Custom Tax Rules — Management Page
 * ====================================
 * Tax Engine · Configuration Layer
 * Dajingo Pro V2 Design Language
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { erpFetch } from '@/lib/erp-api'
import {
    Plus, Search, Loader2, X, Maximize2, Minimize2,
    ListChecks, Zap, Layers, Sparkles
} from 'lucide-react'
import { TemplateBanner } from '../_components/TemplateBanner'
import type { TemplateData } from '../_components/TemplateBanner'
import { RuleRow } from './_components/RuleRow'
import { RuleEditor } from './_components/RuleEditor'
import { CTRPresetCard } from './_components/PresetCard'

type CTR = Record<string, any>

/* ═══════════ Main Page ═══════════ */
export default function CustomTaxRulesPage() {
    const [items, setItems] = useState<CTR[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const [editing, setEditing] = useState<CTR | null | 'new'>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    const [templateData, setTemplateData] = useState<TemplateData | null>(null)
    const [templateLoading, setTemplateLoading] = useState(true)
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    useEffect(() => { load(); loadTemplates() }, [])
    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
    }, [])

    async function load() {
        try { setLoading(true); const d = await erpFetch('finance/custom-tax-rules/'); setItems(Array.isArray(d) ? d : d?.results || []) }
        catch (e) { console.error(e) } finally { setLoading(false) }
    }

    async function loadTemplates() {
        try {
            setTemplateLoading(true)
            const data = await erpFetch('finance/custom-tax-rules/available-templates/')
            setTemplateData(data)
        } catch (error) {
            console.error('Failed to load templates:', error)
            setTemplateData(null)
        } finally { setTemplateLoading(false) }
    }

    async function handleImportPreset(presetName: string) {
        if (!templateData?.country_code) return
        try {
            await erpFetch('finance/custom-tax-rules/import-from-template/', {
                method: 'POST',
                body: JSON.stringify({ country_code: templateData.country_code, preset_names: [presetName] }),
            })
            toast.success('Template imported successfully')
            await Promise.all([load(), loadTemplates()])
        } catch (error) { console.error('Import failed:', error); toast.error('Failed to import template') }
    }

    async function handleImportAll() {
        if (!templateData?.country_code) return
        try {
            await erpFetch('finance/custom-tax-rules/import-from-template/', {
                method: 'POST',
                body: JSON.stringify({ country_code: templateData.country_code, preset_names: [] }),
            })
            toast.success('All templates imported successfully')
            await Promise.all([load(), loadTemplates()])
        } catch (error) { console.error('Import all failed:', error); toast.error('Failed to import templates') }
    }

    async function handleSave(data: CTR) {
        try {
            if (data.id) {
                await erpFetch(`finance/custom-tax-rules/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
                toast.success('Rule updated')
            } else {
                await erpFetch('finance/custom-tax-rules/', { method: 'POST', body: JSON.stringify(data) })
                toast.success('Rule created')
            }
            setEditing(null); load()
        } catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to save rule') }
    }

    async function handleDelete() {
        if (!deleteTarget) return
        try { await erpFetch(`finance/custom-tax-rules/${deleteTarget}/`, { method: 'DELETE' }); toast.success('Rule deleted'); load() }
        catch (e: any) { console.error(e); toast.error(e?.message || 'Failed to delete rule') }
        setDeleteTarget(null)
    }

    const filtered = useMemo(() => {
        if (!searchQuery.trim()) return items
        const q = searchQuery.toLowerCase()
        return items.filter(i => i.name?.toLowerCase().includes(q) || i.transaction_type?.toLowerCase().includes(q) || i.compound_group?.toLowerCase().includes(q))
    }, [items, searchQuery])

    const pendingImports = templateData?.presets?.filter(p => !p.already_imported)?.length || 0

    const kpis = [
        { label: 'Rules', value: items.length, icon: <ListChecks size={11} />, color: 'var(--app-primary)' },
        { label: 'Active', value: items.filter(i => i.is_active).length, icon: <Zap size={11} />, color: 'var(--app-success, #22c55e)' },
        { label: 'Compound', value: items.filter(i => i.compound_group).length, icon: <Layers size={11} />, color: 'var(--app-info, #3b82f6)' },
        { label: 'Templates', value: pendingImports > 0 ? `${pendingImports} pending` : '✓ Synced', icon: <Sparkles size={11} />, color: pendingImports > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' },
    ]

    if (editing) {
        return <RuleEditor item={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
    }

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
                {!focusMode && (
                    <>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <ListChecks size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Custom Tax Rules</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        Tax Engine · Configuration · {templateData?.country_name || 'Loading...'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button onClick={() => setEditing('new')}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                    <Plus size={14} /> New Rule
                                </button>
                                <button onClick={() => setFocusMode(true)}
                                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                            {kpis.map(s => (
                                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums truncate">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
                <div className="flex items-center gap-2">
                    {focusMode && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><ListChecks size={14} style={{ color: '#fff' }} /></div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Custom Tax Rules</span>
                        </div>
                    )}
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search rules... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                    </div>
                    {focusMode && <>
                        <button onClick={() => setEditing('new')} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg"><Plus size={12} /></button>
                        <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all"><Minimize2 size={13} /></button>
                    </>}
                    {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0" style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)' }}><X size={13} /></button>}
                </div>
            </div>

            {/* Template Banner */}
            {!focusMode && !templateLoading && templateData && templateData.presets && templateData.presets.length > 0 && (
                <TemplateBanner
                    templateData={templateData}
                    onImportPreset={handleImportPreset}
                    onImportAll={handleImportAll}
                    entityLabel="Tax Rule Templates"
                    renderPresetCard={(preset, importing) => (
                        <CTRPresetCard key={preset.name} preset={preset} onImport={handleImportPreset} importing={importing} />
                    )}
                />
            )}

            {/* Table */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Rule</div>
                    <div className="hidden sm:block w-20 flex-shrink-0">Rate</div>
                    <div className="hidden md:block w-16 flex-shrink-0 text-center">Order</div>
                    <div className="hidden md:block w-20 flex-shrink-0">Status</div>
                    <div className="w-16 flex-shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
                    ) : filtered.length > 0 ? (
                        filtered.map(item => <RuleRow key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => setDeleteTarget(item.id)} />)
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <ListChecks size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="text-sm font-bold text-app-muted-foreground">No custom tax rules</p>
                            <p className="text-[11px] text-app-muted-foreground mt-1">
                                {searchQuery ? 'Try a different search.' : 'Create bespoke taxes like Eco Tax, Tourism Levy, etc.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog open={deleteTarget !== null} onOpenChange={o => { if (!o) setDeleteTarget(null) }}
                onConfirm={handleDelete} title="Delete Custom Tax Rule?"
                description="This will permanently remove this tax rule. This cannot be undone." variant="danger" />
        </div>
    )
}
