'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import {
    Plus, Search, Users, Check, X, Loader2, Globe,
    Maximize2, Minimize2, Eye, Pencil, Layers, Activity,
    ChevronRight, Download, ArrowDownCircle, CheckCircle2,
    Sparkles, FileText
} from 'lucide-react'

type Profile = Record<string, any>

type TemplatePreset = {
    name: string
    vat_registered?: boolean
    reverse_charge?: boolean
    required_documents?: any[]
    allowed_scopes?: string[]
    already_imported?: boolean
    [key: string]: any
}

type TemplateData = {
    country_code: string | null
    country_name: string | null
    currency_code?: string
    presets: TemplatePreset[]
    total?: number
    imported?: number
}

/* ═══════════ Preset Card ═══════════ */
function PresetCard({ preset, onImport, importing }: {
    preset: TemplatePreset; onImport: (name: string) => void; importing: boolean
}) {
    const isImported = preset.already_imported
    return (
        <div className="relative flex flex-col gap-2 px-4 py-3 rounded-xl transition-all duration-200"
            style={{
                background: isImported
                    ? 'color-mix(in srgb, var(--app-success, #22c55e) 4%, var(--app-surface))'
                    : 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                border: isImported
                    ? '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)'
                    : '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                opacity: isImported ? 0.75 : 1,
            }}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                            background: isImported ? 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)' : 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: isImported ? 'var(--app-success, #22c55e)' : 'var(--app-primary)',
                        }}>
                        {isImported ? <CheckCircle2 size={13} /> : <FileText size={13} />}
                    </div>
                    <span className="text-[12px] font-bold text-app-foreground truncate">{preset.name}</span>
                </div>
                {isImported ? (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)' }}>Imported</span>
                ) : (
                    <button onClick={() => onImport(preset.name)} disabled={importing}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex-shrink-0 hover:brightness-110"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: importing ? 0.6 : 1 }}>
                        {importing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                        Import
                    </button>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '4px' }}>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">VAT</span>
                    <span className="text-[10px] font-bold flex items-center gap-1"
                        style={preset.vat_registered ? { color: 'var(--app-success, #22c55e)' } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                        {preset.vat_registered ? <><Check size={9} />Yes</> : 'No'}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">RC</span>
                    <span className="text-[10px] font-bold"
                        style={preset.reverse_charge ? { color: 'var(--app-warning, #f59e0b)' } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                        {preset.reverse_charge ? 'Yes' : 'No'}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Docs</span>
                    <span className="text-[10px] font-bold text-app-foreground">{preset.required_documents?.length || 0}</span>
                </div>
            </div>
        </div>
    )
}

/* ═══════════ Profile Row ═══════════ */
function ProfileRow({ item, onView }: { item: Profile; onView: (id: number) => void }) {
    return (
        <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5"
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
            onClick={() => onView(item.id)}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: item.is_system_preset ? 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                    color: item.is_system_preset ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                }}>
                <Users size={13} />
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                <span className="truncate text-[13px] font-bold text-app-foreground">{item.name}</span>
                {item.is_system_preset && (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }}>Preset</span>
                )}
            </div>
            <div className="hidden sm:flex w-16 items-center gap-1 flex-shrink-0">
                <Globe size={12} className="text-app-muted-foreground" />
                <span className="font-mono text-[11px] font-bold text-app-foreground">{item.country_code}</span>
            </div>
            <div className="hidden sm:flex w-16 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={item.vat_registered ? { color: 'var(--app-success, #22c55e)', background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)' } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                    {item.vat_registered ? <><Check size={10} />VAT</> : '—'}
                </span>
            </div>
            <div className="hidden md:flex w-14 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={item.reverse_charge ? { color: 'var(--app-warning, #f59e0b)', background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)' } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                    {item.reverse_charge ? 'RC' : '—'}
                </span>
            </div>
            <div className="hidden md:flex w-14 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={item.airsi_subject ? { color: '#8b5cf6', background: 'color-mix(in srgb, #8b5cf6 8%, transparent)' } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                    {item.airsi_subject ? 'WHT' : '—'}
                </span>
            </div>
            <div className="hidden lg:flex w-28 gap-1 flex-shrink-0 flex-wrap">
                {(item.allowed_scopes || []).map((s: string) => (
                    <span key={s} className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
                        style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>{s}</span>
                ))}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); onView(item.id) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="View"><Eye size={12} /></button>
                <button onClick={e => { e.stopPropagation(); onView(item.id) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit"><Pencil size={12} /></button>
            </div>
        </div>
    )
}

/* ═══════════ Main Page ═══════════ */
export default function CounterpartyTaxProfilesListPage() {
    const router = useRouter()
    const [items, setItems] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    // Template state
    const [templateData, setTemplateData] = useState<TemplateData | null>(null)
    const [templateLoading, setTemplateLoading] = useState(true)
    const [templateCollapsed, setTemplateCollapsed] = useState(false)
    const [importingPreset, setImportingPreset] = useState<string | null>(null)
    const [importingAll, setImportingAll] = useState(false)

    useEffect(() => { loadData(); loadTemplates() }, [])
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(prev => !prev) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    async function loadData() {
        try { setLoading(true); const data = await erpFetch('finance/counterparty-tax-profiles/'); setItems(Array.isArray(data) ? data : (data?.results || [])) }
        catch (error) { console.error('Failed to load:', error) } finally { setLoading(false) }
    }

    async function loadTemplates() {
        try {
            setTemplateLoading(true)
            const data = await erpFetch('finance/counterparty-tax-profiles/available-templates/')
            setTemplateData(data)
        } catch (error) {
            console.error('Failed to load templates:', error)
            setTemplateData(null)
        } finally { setTemplateLoading(false) }
    }

    async function handleImportPreset(presetName: string) {
        if (!templateData?.country_code) return
        setImportingPreset(presetName)
        try {
            await erpFetch('finance/counterparty-tax-profiles/import-from-template/', {
                method: 'POST',
                body: JSON.stringify({ country_code: templateData.country_code, preset_names: [presetName] }),
            })
            await Promise.all([loadData(), loadTemplates()])
        } catch (error) { console.error('Import failed:', error) }
        finally { setImportingPreset(null) }
    }

    async function handleImportAll() {
        if (!templateData?.country_code) return
        setImportingAll(true)
        try {
            await erpFetch('finance/counterparty-tax-profiles/import-from-template/', {
                method: 'POST',
                body: JSON.stringify({ country_code: templateData.country_code, preset_names: [] }),
            })
            await Promise.all([loadData(), loadTemplates()])
        } catch (error) { console.error('Import all failed:', error) }
        finally { setImportingAll(false) }
    }

    const { filtered, stats } = useMemo(() => {
        let f = items
        if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); f = f.filter(i => i.name?.toLowerCase().includes(q) || i.country_code?.toLowerCase().includes(q)) }
        return { filtered: f, stats: { total: items.length, filtered: f.length, vatCount: items.filter(i => i.vat_registered).length, presetCount: items.filter(i => i.is_system_preset).length } }
    }, [items, searchQuery])

    const pendingImports = templateData?.presets?.filter(p => !p.already_imported)?.length || 0
    const allImported = templateData?.presets && templateData.presets.length > 0 && pendingImports === 0

    const kpis = [
        { label: 'Profiles', value: stats.total, icon: <Users size={11} />, color: 'var(--app-primary)' },
        { label: 'VAT Reg.', value: stats.vatCount, icon: <Check size={11} />, color: 'var(--app-success, #22c55e)' },
        { label: 'Presets', value: stats.presetCount, icon: <Activity size={11} />, color: 'var(--app-info, #3b82f6)' },
        { label: 'Templates', value: pendingImports > 0 ? `${pendingImports} pending` : '✓ Synced', icon: <Sparkles size={11} />, color: pendingImports > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' },
    ]

    return (
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center"><Users size={14} className="text-white" /></div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Profiles</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{stats.filtered}/{stats.total}</span>
                        </div>
                        <div className="flex-1 relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" /><input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" /></div>
                        <button onClick={() => router.push('/finance/counterparty-tax-profiles/new')} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0"><Plus size={12} /><span className="hidden sm:inline">New</span></button>
                        <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0"><Minimize2 size={13} /></button>
                    </div>
                ) : (<>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}><Users size={20} className="text-white" /></div>
                            <div>
                                <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Counterparty Tax Profiles</h1>
                                <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                    {stats.total} Profiles · {templateData?.country_name || 'Loading...'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <button onClick={() => router.push('/finance/counterparty-tax-profiles/new')} className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all" style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}><Plus size={14} /><span className="hidden sm:inline">New Profile</span></button>
                            <button onClick={() => setFocusMode(true)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"><Maximize2 size={13} /></button>
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        {kpis.map(s => (<div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div><div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div></div></div>))}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" /><input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search profiles by name, country... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" /></div>
                        {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0" style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}><X size={13} /></button>}
                    </div>
                </>)}
            </div>

            {/* ═══════ Country Template Banner ═══════ */}
            {!focusMode && !templateLoading && templateData && templateData.presets && templateData.presets.length > 0 && (
                <div className="flex-shrink-0 mb-3 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
                    style={{
                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, var(--app-surface))',
                        border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, var(--app-border))',
                        borderLeft: '3px solid var(--app-info, #3b82f6)',
                    }}>
                    <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                        onClick={() => setTemplateCollapsed(!templateCollapsed)}>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{
                                    background: allImported ? 'var(--app-success, #22c55e)' : 'var(--app-info, #3b82f6)',
                                    boxShadow: allImported ? '0 4px 12px color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)' : '0 4px 12px color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)',
                                }}>
                                {allImported ? <CheckCircle2 size={15} className="text-white" /> : <Globe size={15} className="text-white" />}
                            </div>
                            <div>
                                <h3 className="text-[12px] font-black text-app-foreground">{templateData.country_name} Profile Templates</h3>
                                <p className="text-[10px] font-bold text-app-muted-foreground">
                                    {allImported ? `All ${templateData.presets.length} profiles synced` : `${pendingImports} of ${templateData.presets.length} profiles available`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!allImported && !templateCollapsed && (
                                <button onClick={(e) => { e.stopPropagation(); handleImportAll() }} disabled={importingAll}
                                    className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
                                    style={{ background: 'var(--app-info, #3b82f6)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)', opacity: importingAll ? 0.6 : 1 }}>
                                    {importingAll ? <Loader2 size={11} className="animate-spin" /> : <ArrowDownCircle size={11} />}
                                    Import All
                                </button>
                            )}
                            <button className="p-1 text-app-muted-foreground hover:text-app-foreground transition-colors">
                                <ChevronRight size={14} className={`transition-transform duration-200 ${templateCollapsed ? '' : 'rotate-90'}`} />
                            </button>
                        </div>
                    </div>
                    {!templateCollapsed && (
                        <div className="px-4 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                                {templateData.presets.map(preset => (
                                    <PresetCard key={preset.name} preset={preset} onImport={handleImportPreset} importing={importingPreset === preset.name} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════ Table ═══════ */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-7 flex-shrink-0" /><div className="flex-1 min-w-0">Profile</div><div className="hidden sm:block w-16 flex-shrink-0">Country</div><div className="hidden sm:block w-16 flex-shrink-0">VAT</div><div className="hidden md:block w-14 flex-shrink-0">RC</div><div className="hidden md:block w-14 flex-shrink-0">WHT</div><div className="hidden lg:block w-28 flex-shrink-0">Scopes</div><div className="w-16 flex-shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {loading ? <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
                        : filtered.length > 0 ? filtered.map(item => <ProfileRow key={item.id} item={item} onView={id => router.push(`/finance/counterparty-tax-profiles/${id}`)} />)
                            : <div className="flex flex-col items-center justify-center py-20 px-4 text-center"><Users size={36} className="text-app-muted-foreground mb-3 opacity-40" /><p className="text-sm font-bold text-app-muted-foreground">No profiles found</p><p className="text-[11px] text-app-muted-foreground mt-1">{searchQuery ? 'Try a different search term.' : templateData?.presets?.some(p => !p.already_imported) ? 'Import templates from above to get started.' : 'Create your first counterparty tax profile.'}</p></div>}
                </div>
            </div>
        </div>
    )
}
