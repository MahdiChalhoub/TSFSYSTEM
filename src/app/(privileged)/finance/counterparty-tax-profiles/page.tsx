'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import {
    Plus, Search, Users, Check, Loader2,
    Maximize2, Minimize2, Activity, Sparkles
} from 'lucide-react'
import { TemplateBanner } from '../_components/TemplateBanner'
import type { TemplateData } from '../_components/TemplateBanner'
import { ProfileRow } from './_components/ProfileRow'
import { CTPPresetCard } from './_components/PresetCard'

type Profile = Record<string, any>

/* ═══════════════════════════════════════════════════════════
 *  MAIN PAGE
 * ═══════════════════════════════════════════════════════════ */
export default function CounterpartyTaxProfilesListPage() {
    const router = useRouter()
    const [items, setItems] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)

    const [templateData, setTemplateData] = useState<TemplateData | null>(null)
    const [templateLoading, setTemplateLoading] = useState(true)

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
        try {
            await erpFetch('finance/counterparty-tax-profiles/import-from-template/', {
                method: 'POST',
                body: JSON.stringify({ country_code: templateData.country_code, preset_names: [presetName] }),
            })
            toast.success('Template imported successfully')
            await Promise.all([loadData(), loadTemplates()])
        } catch (error) { console.error('Import failed:', error); toast.error('Failed to import template') }
    }

    async function handleImportAll() {
        if (!templateData?.country_code) return
        try {
            await erpFetch('finance/counterparty-tax-profiles/import-from-template/', {
                method: 'POST',
                body: JSON.stringify({ country_code: templateData.country_code, preset_names: [] }),
            })
            toast.success('All templates imported successfully')
            await Promise.all([loadData(), loadTemplates()])
        } catch (error) { console.error('Import all failed:', error); toast.error('Failed to import templates') }
    }

    const { filtered, stats } = useMemo(() => {
        let f = items
        if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); f = f.filter(i => i.name?.toLowerCase().includes(q) || i.country_code?.toLowerCase().includes(q)) }
        return { filtered: f, stats: { total: items.length, filtered: f.length, vatCount: items.filter(i => i.vat_registered).length, presetCount: items.filter(i => i.is_system_preset).length } }
    }, [items, searchQuery])

    const pendingImports = templateData?.presets?.filter(p => !p.already_imported)?.length || 0

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
                    </div>
                </>)}
            </div>

            {/* Template Banner */}
            {!focusMode && !templateLoading && templateData && templateData.presets && templateData.presets.length > 0 && (
                <TemplateBanner
                    templateData={templateData}
                    onImportPreset={handleImportPreset}
                    onImportAll={handleImportAll}
                    entityLabel="Profile Templates"
                    renderPresetCard={(preset, importing) => (
                        <CTPPresetCard key={preset.name} preset={preset} onImport={handleImportPreset} importing={importing} />
                    )}
                />
            )}

            {/* Table */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-7 flex-shrink-0" /><div className="flex-1 min-w-0">Profile</div><div className="hidden sm:block w-16 flex-shrink-0">Country</div><div className="hidden sm:block w-16 flex-shrink-0">VAT</div><div className="hidden md:block w-14 flex-shrink-0">RC</div><div className="hidden md:block w-14 flex-shrink-0">WHT</div><div className="hidden lg:block w-28 flex-shrink-0">Scopes</div><div className="w-16 flex-shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {loading ? <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
                        : filtered.length > 0 ? filtered.map(item => <ProfileRow key={item.id} item={item} onView={id => router.push(`/finance/counterparty-tax-profiles/${id}`)} />)
                            : <div className="flex flex-col items-center justify-center py-20 px-4 text-center"><Users size={36} className="text-app-muted-foreground mb-3 opacity-40" /><p className="text-sm font-bold text-app-muted-foreground">No profiles found</p><p className="text-[11px] text-app-muted-foreground mt-1">{searchQuery ? 'Try a different search term.' : 'Create your first counterparty tax profile.'}</p></div>}
                </div>
            </div>
        </div>
    )
}
