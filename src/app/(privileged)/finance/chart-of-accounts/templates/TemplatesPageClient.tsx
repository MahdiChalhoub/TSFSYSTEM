'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
    Library, GitMerge, Search, Globe, Landmark, BookOpen,
    ChevronRight, ChevronDown, CheckCircle2, Zap, FileText,
    ShieldCheck, Maximize2, Minimize2, ChevronLeft,
    Layers, Hash, Tag, TreePine, ArrowRight, Loader2,
    MapPin, Flag, BarChart3, GitBranch, ArrowRightLeft,
    BookMarked, Scale, Building2, Workflow,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ── Icon resolver ──────────────────────────────────────────
const ICON_MAP: Record<string, any> = {
    Globe, Landmark, BookOpen, FileText, Flag, MapPin, Library, Layers, Scale, Building2,
}
function resolveIcon(name?: string) {
    return (name && ICON_MAP[name]) || Globe
}

// ── Accent color map ───────────────────────────────
const ACCENT_MAP: Record<string, string> = {
    IFRS_COA: 'var(--app-info, #3b82f6)',
    USA_GAAP: '#8b5cf6',
    FRENCH_PCG: 'var(--app-primary)',
    SYSCOHADA_REVISED: 'var(--app-warning, #f59e0b)',
    LEBANESE_PCN: 'var(--app-error, #ef4444)',
}

interface TemplateInfo {
    key: string; name: string; region: string; description: string
    icon: string; accent_color: string; is_system: boolean; is_custom: boolean
    account_count: number; posting_rule_count: number
    version?: string; last_updated?: string
}

interface Props {
    templates: TemplateInfo[]
    templatesMap: Record<string, any>
    migrationMaps: Record<string, Record<string, string>>
}

export default function TemplatesPageClient({ templates, templatesMap, migrationMaps }: Props) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const cameFromCOA = searchParams.get('from') === 'coa'
    const [activeView, setActiveView] = useState<'gallery' | 'compare' | 'migration'>('gallery')
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
    const [compareTemplates, setCompareTemplates] = useState<string[]>([])
    const [focusMode, setFocusMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isPending, setIsPending] = useState(false)
    const [importTarget, setImportTarget] = useState<string | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    const filteredTemplates = useMemo(() => {
        if (!searchQuery) return templates
        const q = searchQuery.toLowerCase()
        return templates.filter(t =>
            t.name.toLowerCase().includes(q) ||
            t.key.toLowerCase().includes(q) ||
            t.region.toLowerCase().includes(q)
        )
    }, [templates, searchQuery])

    const totalAccounts = templates.reduce((sum, t) => sum + (t.account_count || 0), 0)
    const totalRules = templates.reduce((sum, t) => sum + (t.posting_rule_count || 0), 0)

    const [migrationTarget, setMigrationTarget] = useState<{ from: string; to: string } | null>(null)
    const [coaStatus, setCoaStatus] = useState<any>(null)

    const handleImport = async (key: string) => {
        // Check if there's existing data that needs migration
        try {
            const { getCOAStatus } = await import('@/app/actions/finance/coa-templates')
            const status = await getCOAStatus()
            setCoaStatus(status)

            if (status.has_data && status.current_template && status.current_template !== key) {
                // Different template with journal data → redirect to migration
                setMigrationTarget({ from: status.current_template, to: key })
                setActiveView('migration')
                toast.info(`Migration required: ${status.current_template.replace(/_/g, ' ')} → ${key.replace(/_/g, ' ')}`, {
                    description: `${status.journal_entry_count} journal entries need account remapping`,
                })
                return
            }
            // Same template re-import, or no data → direct import
            setImportTarget(key)
        } catch {
            setImportTarget(key)
        }
    }
    const handleConfirmImport = async () => {
        if (!importTarget) return
        const key = importTarget
        setImportTarget(null)
        setIsPending(true)
        try {
            await importChartOfAccountsTemplate(key as any, { reset: true })
            toast.success(`Successfully imported ${key.replace(/_/g, ' ')}`)
            router.push('/finance/chart-of-accounts')
        } catch (e: unknown) {
            toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsPending(false)
        }
    }

    const toggleCompare = (key: string) => {
        setCompareTemplates(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        )
    }

    // ── KPI Data ──
    const kpis = [
        { label: 'Templates', value: templates.length, icon: <Library size={14} />, color: 'var(--app-primary)' },
        { label: 'Total Accounts', value: totalAccounts.toLocaleString(), icon: <TreePine size={14} />, color: 'var(--app-info, #3b82f6)' },
        { label: 'Posting Rules', value: totalRules.toLocaleString(), icon: <GitBranch size={14} />, color: '#8b5cf6' },
        { label: 'Migrations', value: Object.keys(migrationMaps).length, icon: <ArrowRightLeft size={14} />, color: 'var(--app-warning, #f59e0b)' },
        { label: 'System', value: templates.filter(t => t.is_system).length, icon: <ShieldCheck size={14} />, color: 'var(--app-success, #22c55e)' },
    ]

    const TABS = [
        { id: 'gallery' as const, label: 'Gallery', icon: Library },
        { id: 'compare' as const, label: 'Compare', icon: GitMerge },
        { id: 'migration' as const, label: 'Migration', icon: ArrowRightLeft },
    ]

    return (
        <div className="flex flex-col p-4 md:p-6 animate-in fade-in duration-300 overflow-hidden"
            style={{ height: 'calc(100dvh - 6rem)' }}>

            {/* ── Page Header (hidden in focus mode) ── */}
            {!focusMode && (
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {cameFromCOA && (
                            <button
                                onClick={() => router.push('/finance/chart-of-accounts')}
                                className="flex items-center gap-1 text-[11px] font-bold px-2 py-1.5 rounded-xl border transition-all mr-1"
                                style={{
                                    color: 'var(--app-muted-foreground)',
                                    borderColor: 'var(--app-border)',
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--app-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--app-foreground)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--app-muted-foreground)' }}
                            >
                                <ChevronLeft size={14} /> Back
                            </button>
                        )}
                        <div className="page-header-icon bg-app-primary"
                            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Library size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                                Accounting Standards Library
                            </h1>
                            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {templates.length} Templates · Compare, Migrate & Import
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 p-1 rounded-xl"
                            style={{ background: 'var(--app-surface-2, var(--app-surface))' }}>
                            {TABS.map(tab => {
                                const Icon = tab.icon
                                return (
                                    <button key={tab.id} onClick={() => setActiveView(tab.id)}
                                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                                        style={{
                                            background: activeView === tab.id ? 'var(--app-primary)' : 'transparent',
                                            color: activeView === tab.id ? '#fff' : 'var(--app-muted-foreground)',
                                        }}>
                                        <Icon size={13} /> {tab.label}
                                    </button>
                                )
                            })}
                        </div>
                        <button onClick={() => setFocusMode(true)}
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Maximize2 size={13} />
                        </button>
                    </div>
                </div>
            )}

            {/* ── KPI Strip (hidden in focus mode) ── */}
            {!focusMode && (
                <div className="mb-4 flex-shrink-0" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {kpis.map(s => (
                        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                {s.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Toolbar (search + tabs in focus, just search in normal) ── */}
            <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                {focusMode && (
                    <>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                                <Library size={14} className="text-white" />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Standards Library</span>
                        </div>
                        <div className="flex items-center gap-1 p-0.5 rounded-lg flex-shrink-0"
                            style={{ background: 'var(--app-surface)' }}>
                            {TABS.map(tab => {
                                const Icon = tab.icon
                                return (
                                    <button key={tab.id} onClick={() => setActiveView(tab.id)}
                                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md transition-all"
                                        style={{
                                            background: activeView === tab.id ? 'var(--app-primary)' : 'transparent',
                                            color: activeView === tab.id ? '#fff' : 'var(--app-muted-foreground)',
                                        }}>
                                        <Icon size={11} /> {tab.label}
                                    </button>
                                )
                            })}
                        </div>
                    </>
                )}
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search by name, region, key... (Ctrl+K)"
                        className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" />
                </div>
                {focusMode && (
                    <button onClick={() => setFocusMode(false)}
                        className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                )}
            </div>

            {/* ── Content (stretches to fill all space between toolbar and footer) ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-2xl"
                style={{ border: '1px solid var(--app-border)' }}>
                {activeView === 'gallery' && (
                    <GalleryView templates={filteredTemplates} templatesMap={templatesMap}
                        selectedTemplate={selectedTemplate} onSelect={setSelectedTemplate}
                        onImport={handleImport} isPending={isPending} />
                )}
                {activeView === 'compare' && (
                    <CompareView templates={filteredTemplates} templatesMap={templatesMap}
                        compareTemplates={compareTemplates} onToggle={toggleCompare}
                        onImport={handleImport} isPending={isPending} />
                )}
                {activeView === 'migration' && (
                    <MigrationView templates={templates} templatesMap={templatesMap}
                        migrationMaps={migrationMaps}
                        autoMigration={migrationTarget}
                        accountBalances={coaStatus?.accounts || []}
                        onApplyImport={async (key) => {
                            setIsPending(true)
                            try {
                                await importChartOfAccountsTemplate(key as any, { reset: true })
                                toast.success(`Migration complete → ${key.replace(/_/g, ' ')}`)
                                router.push('/finance/chart-of-accounts')
                            } catch (e: unknown) {
                                toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
                            } finally {
                                setIsPending(false)
                            }
                        }}
                        isPending={isPending}
                    />
                )}
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 py-2.5 mt-0 rounded-b-2xl"
                style={{
                    background: 'var(--app-surface)',
                    borderTop: '1px solid var(--app-border)',
                    borderLeft: '1px solid var(--app-border)',
                    borderRight: '1px solid var(--app-border)',
                    borderBottom: '1px solid var(--app-border)',
                    marginTop: '-1px',
                    borderBottomLeftRadius: '1rem',
                    borderBottomRightRadius: '1rem',
                }}>
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase tracking-widest"
                        style={{ color: 'var(--app-foreground)' }}>
                        {filteredTemplates.length} of {templates.length} templates
                    </span>
                    <span className="text-[10px] font-bold tabular-nums"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        {totalAccounts.toLocaleString()} accounts
                    </span>
                    <span className="text-[10px] font-bold tabular-nums"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        {totalRules.toLocaleString()} posting rules
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{
                            color: 'var(--app-primary)',
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                        }}>
                        {activeView === 'gallery' ? 'Gallery' : activeView === 'compare' ? 'Compare' : 'Migration'} View
                    </span>
                </div>
            </div>

            {/* ── Import Dialog ── */}
            <ConfirmDialog open={importTarget !== null}
                onOpenChange={(open) => { if (!open) setImportTarget(null) }}
                onConfirm={handleConfirmImport}
                title={`Import ${importTarget?.replace(/_/g, ' ') ?? ''}?`}
                description="This will replace your current Chart of Accounts with this template. Existing accounts will be removed (or deactivated if journal entries exist). Posting rules will be auto-synced."
                confirmText="Replace & Import" variant="danger" />
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════
// Gallery View — Card Grid with Detail sidebar
// ══════════════════════════════════════════════════════════════════
function GalleryView({
    templates, templatesMap, selectedTemplate, onSelect, onImport, isPending,
}: {
    templates: TemplateInfo[]; templatesMap: Record<string, any>
    selectedTemplate: string | null; onSelect: (key: string | null) => void
    onImport: (key: string) => void; isPending: boolean
}) {
    if (templates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <Library size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                <p className="text-sm font-bold text-app-muted-foreground">No templates found</p>
                <p className="text-[11px] text-app-muted-foreground mt-1">
                    Run <code className="font-mono bg-app-surface px-1 rounded">python manage.py seed_coa_templates</code>
                </p>
            </div>
        )
    }

    if (selectedTemplate && templatesMap[selectedTemplate]) {
        return (
            <div className="flex gap-4 h-full animate-in fade-in duration-200">
                {/* Left sidebar */}
                <div className="w-64 flex-shrink-0 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {templates.map(t => {
                        const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                        const isActive = selectedTemplate === t.key
                        return (
                            <button key={t.key} onClick={() => onSelect(t.key)}
                                className="w-full text-left p-3 rounded-xl transition-all"
                                style={{
                                    background: isActive ? `color-mix(in srgb, ${accent} 8%, var(--app-surface))` : 'var(--app-surface)',
                                    border: `1px solid ${isActive ? `color-mix(in srgb, ${accent} 30%, transparent)` : 'var(--app-border)'}`,
                                    borderLeft: isActive ? `3px solid ${accent}` : undefined,
                                }}>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}>
                                        {(() => { const I = resolveIcon(t.icon); return <I size={14} /> })()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[12px] font-bold text-app-foreground truncate">{t.name}</div>
                                        <div className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider">{t.region}</div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
                {/* Right detail */}
                <TemplateDetail
                    template={templates.find(t => t.key === selectedTemplate)!}
                    detail={templatesMap[selectedTemplate]}
                    onClose={() => onSelect(null)}
                    onImport={onImport} isPending={isPending}
                />
            </div>
        )
    }

    // Default card grid
    return (
        <div className="p-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {templates.map(t => {
                const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                return (
                    <button key={t.key} onClick={() => onSelect(t.key)}
                        className="text-left rounded-2xl transition-all hover:scale-[1.01] group overflow-hidden"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="p-4 pb-3" style={{
                            background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, var(--app-surface)), var(--app-surface))`,
                            borderBottom: '1px solid var(--app-border)',
                        }}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent,
                                            boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 20%, transparent)` }}>
                                        {(() => { const I = resolveIcon(t.icon); return <I size={20} /> })()}
                                    </div>
                                    <div>
                                        <h3 className="text-[14px] font-black text-app-foreground">{t.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <MapPin size={10} style={{ color: accent }} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>{t.region}</span>
                                        </div>
                                    </div>
                                </div>
                                {t.is_system && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                            color: 'var(--app-success, #22c55e)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)' }}>
                                        System
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-4 pt-3">
                            <p className="text-[11px] font-medium text-app-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
                                {t.description || 'Standard accounting template'}
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <TreePine size={12} style={{ color: accent }} />
                                    <span className="text-[11px] font-bold text-app-foreground tabular-nums">{t.account_count}</span>
                                    <span className="text-[10px] font-bold text-app-muted-foreground">accounts</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Workflow size={12} className="text-app-muted-foreground" />
                                    <span className="text-[11px] font-bold text-app-foreground tabular-nums">{t.posting_rule_count}</span>
                                    <span className="text-[10px] font-bold text-app-muted-foreground">rules</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-end mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1" style={{ color: accent }}>
                                    View Details <ArrowRight size={12} />
                                </span>
                            </div>
                        </div>
                    </button>
                )
            })}
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════
// Template Detail — Tabs: Accounts / Posting Rules
// ══════════════════════════════════════════════════════════════════
function TemplateDetail({
    template, detail, onClose, onImport, isPending,
}: {
    template: TemplateInfo; detail: any
    onClose: () => void; onImport: (key: string) => void; isPending: boolean
}) {
    const [expandAll, setExpandAll] = useState(false)
    const [detailTab, setDetailTab] = useState<'accounts' | 'rules'>('accounts')
    const [ruleSearch, setRuleSearch] = useState('')
    const accent = ACCENT_MAP[template.key] || template.accent_color || 'var(--app-primary)'
    const accounts = detail?.accounts || []
    const postingRules: any[] = detail?.posting_rules || []

    // Group rules by module
    const groupedRules = useMemo(() => {
        const q = ruleSearch.toLowerCase()
        const filtered = q
            ? postingRules.filter(r => r.event_code.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || r.account_code.toLowerCase().includes(q))
            : postingRules
        const groups: Record<string, any[]> = {}
        for (const r of filtered) {
            const mod = r.module || 'general'
            if (!groups[mod]) groups[mod] = []
            groups[mod].push(r)
        }
        return groups
    }, [postingRules, ruleSearch])

    return (
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden animate-in slide-in-from-right-4 duration-300"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

            {/* Header */}
            <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between"
                style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 6%, var(--app-surface)), var(--app-surface))`,
                    borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-3">
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <ChevronLeft size={16} />
                    </button>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: accent, boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 30%, transparent)` }}>
                        {(() => { const I = resolveIcon(template.icon); return <I size={16} className="text-white" /> })()}
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-app-foreground">{template.name}</h3>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">
                            {template.region} · {accounts.length} accts · {postingRules.length} rules
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button disabled={isPending} onClick={() => onImport(template.key)}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-white px-3 py-1.5 rounded-xl transition-all hover:brightness-110"
                        style={{ background: accent, boxShadow: `0 2px 8px color-mix(in srgb, ${accent} 25%, transparent)` }}>
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        <span className="hidden sm:inline">Import</span>
                    </button>
                </div>
            </div>

            {/* Detail Tabs */}
            <div className="flex-shrink-0 flex items-center gap-1 px-4 py-2"
                style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                <button onClick={() => setDetailTab('accounts')}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: detailTab === 'accounts' ? `color-mix(in srgb, ${accent} 10%, transparent)` : 'transparent',
                        color: detailTab === 'accounts' ? accent : 'var(--app-muted-foreground)' }}>
                    <TreePine size={13} /> Accounts ({accounts.length})
                </button>
                <button onClick={() => setDetailTab('rules')}
                    className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={{ background: detailTab === 'rules' ? `color-mix(in srgb, ${accent} 10%, transparent)` : 'transparent',
                        color: detailTab === 'rules' ? accent : 'var(--app-muted-foreground)' }}>
                    <Workflow size={13} /> Posting Rules ({postingRules.length})
                </button>
                {detailTab === 'accounts' && (
                    <button onClick={() => setExpandAll(!expandAll)}
                        className="ml-auto flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg transition-all">
                        <Layers size={12} /> {expandAll ? 'Collapse' : 'Expand'}
                    </button>
                )}
                {detailTab === 'rules' && (
                    <div className="ml-auto relative">
                        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input type="text" value={ruleSearch} onChange={e => setRuleSearch(e.target.value)}
                            placeholder="Filter rules..."
                            className="pl-7 pr-2 py-1 text-[11px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground outline-none w-40" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {detailTab === 'accounts' ? (
                    accounts.length > 0 ? (
                        <div>
                            {accounts.map((item: any, i: number) => (
                                <AccountTreeNode key={i} item={item} level={0} accent={accent} expandAll={expandAll} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState icon={FileText} text="No accounts in this template" />
                    )
                ) : (
                    <PostingRulesPanel groupedRules={groupedRules} accent={accent} />
                )}
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════
// Posting Rules Panel
// ══════════════════════════════════════════════════════════════════
function PostingRulesPanel({ groupedRules, accent }: { groupedRules: Record<string, any[]>; accent: string }) {
    const [openModules, setOpenModules] = useState<Set<string>>(new Set(Object.keys(groupedRules)))

    const toggleModule = (mod: string) => {
        setOpenModules(prev => {
            const next = new Set(prev)
            next.has(mod) ? next.delete(mod) : next.add(mod)
            return next
        })
    }

    if (Object.keys(groupedRules).length === 0) {
        return <EmptyState icon={Workflow} text="No posting rules match your search" />
    }

    return (
        <div className="p-3 space-y-2">
            {Object.entries(groupedRules).sort(([a], [b]) => a.localeCompare(b)).map(([mod, rules]) => (
                <div key={mod} className="rounded-xl overflow-hidden"
                    style={{ border: '1px solid var(--app-border)' }}>
                    {/* Module header */}
                    <button onClick={() => toggleModule(mod)}
                        className="w-full flex items-center gap-2 px-3 py-2 transition-all"
                        style={{ background: `color-mix(in srgb, ${accent} 4%, var(--app-surface))` }}>
                        <div className="w-5 text-app-muted-foreground">
                            {openModules.has(mod) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </div>
                        <BookMarked size={13} style={{ color: accent }} />
                        <span className="text-[12px] font-bold text-app-foreground uppercase">{mod}</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground ml-auto">{rules.length} rules</span>
                    </button>
                    {/* Rules list */}
                    {openModules.has(mod) && (
                        <div className="animate-in fade-in duration-150">
                            {/* Column header */}
                            <div className="flex items-center gap-2 px-3 py-1.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-wider"
                                style={{ background: 'var(--app-surface)', borderTop: '1px solid var(--app-border)' }}>
                                <div className="flex-1 min-w-0">Event Code</div>
                                <div className="w-16 flex-shrink-0 text-center">Account</div>
                                <div className="flex-1 min-w-0 hidden md:block">Description</div>
                            </div>
                            {rules.map((r: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 transition-all hover:bg-app-surface/40"
                                    style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-mono font-bold text-app-foreground">{r.event_code}</span>
                                    </div>
                                    <div className="w-16 flex-shrink-0 text-center">
                                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded tabular-nums"
                                            style={{ background: `color-mix(in srgb, ${accent} 8%, transparent)`, color: accent }}>
                                            {r.account_code}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0 hidden md:block">
                                        <span className="text-[11px] font-medium text-app-muted-foreground truncate block">
                                            {r.description || '—'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════
// Account Tree Node
// ══════════════════════════════════════════════════════════════════
function AccountTreeNode({ item, level, accent, expandAll }: { item: any; level: number; accent: string; expandAll: boolean }) {
    const [open, setOpen] = useState(level < 1)
    const hasChildren = item.children && item.children.length > 0
    const isRoot = level === 0
    useEffect(() => { setOpen(expandAll || level < 1) }, [expandAll, level])

    const typeColor: Record<string, string> = {
        ASSET: 'var(--app-info, #3b82f6)', LIABILITY: 'var(--app-error, #ef4444)',
        EQUITY: '#8b5cf6', INCOME: 'var(--app-success, #22c55e)', EXPENSE: 'var(--app-warning, #f59e0b)',
    }
    const tc = typeColor[item.type] || 'var(--app-muted-foreground)'
    const reportTag = ['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type) ? 'BS' : 'P&L'
    const rc = reportTag === 'BS' ? 'var(--app-info, #3b82f6)' : 'var(--app-warning, #f59e0b)'

    return (
        <div>
            <div onClick={() => hasChildren && setOpen(!open)}
                className={`group flex items-center gap-2 transition-all duration-150 border-b hover:bg-app-surface/40 ${hasChildren ? 'cursor-pointer' : ''}`}
                style={{
                    paddingLeft: isRoot ? '12px' : `${12 + level * 20}px`,
                    paddingRight: '12px', paddingTop: isRoot ? '8px' : '5px', paddingBottom: isRoot ? '8px' : '5px',
                    background: isRoot ? `color-mix(in srgb, ${accent} 4%, var(--app-surface))` : undefined,
                    borderLeft: isRoot ? `3px solid ${accent}` : '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                    marginLeft: !isRoot ? `${12 + (level - 1) * 20 + 10}px` : undefined,
                }}>
                <div className="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0"
                    style={{ color: hasChildren ? 'var(--app-muted-foreground)' : 'var(--app-border)' }}>
                    {hasChildren ? (open ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: tc }} />
                    )}
                </div>
                <span className="w-16 flex-shrink-0 font-mono text-[11px] font-bold tabular-nums"
                    style={{ color: isRoot ? accent : 'var(--app-muted-foreground)' }}>{item.code}</span>
                <span className={`flex-1 min-w-0 truncate text-[13px] ${isRoot ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                    {item.name}
                </span>
                {item.type && (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:block"
                        style={{ background: `color-mix(in srgb, ${tc} 10%, transparent)`, color: tc,
                            border: `1px solid color-mix(in srgb, ${tc} 20%, transparent)` }}>
                        {item.type}
                    </span>
                )}
                {item.type && (
                    <span className="text-[8px] font-black px-1 rounded flex-shrink-0 hidden md:block"
                        style={{ background: `color-mix(in srgb, ${rc} 10%, transparent)`, color: rc }}>
                        [{reportTag}]
                    </span>
                )}
            </div>
            {hasChildren && open && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {item.children.map((child: any, i: number) => (
                        <AccountTreeNode key={i} item={child} level={level + 1} accent={accent} expandAll={expandAll} />
                    ))}
                </div>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════
// Compare View — Side by Side with Posting Rules
// ══════════════════════════════════════════════════════════════════
function CompareView({
    templates, templatesMap, compareTemplates, onToggle, onImport, isPending,
}: {
    templates: TemplateInfo[]; templatesMap: Record<string, any>
    compareTemplates: string[]; onToggle: (key: string) => void
    onImport: (key: string) => void; isPending: boolean
}) {
    const [compareTab, setCompareTab] = useState<'accounts' | 'rules'>('accounts')

    return (
        <div>
            {/* Selection bar */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 no-scrollbar">
                {templates.map(t => {
                    const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                    const isSelected = compareTemplates.includes(t.key)
                    return (
                        <button key={t.key} onClick={() => onToggle(t.key)}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all"
                            style={{
                                background: isSelected ? `color-mix(in srgb, ${accent} 8%, var(--app-surface))` : 'var(--app-surface)',
                                border: `1px solid ${isSelected ? `color-mix(in srgb, ${accent} 40%, transparent)` : 'var(--app-border)'}`,
                            }}>
                            {isSelected ? <CheckCircle2 size={14} style={{ color: accent }} /> : <Library size={14} className="text-app-muted-foreground" />}
                            <span className="text-[12px] font-bold whitespace-nowrap"
                                style={{ color: isSelected ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {t.name}
                            </span>
                            <span className="text-[10px] font-bold tabular-nums text-app-muted-foreground">{t.account_count}</span>
                        </button>
                    )
                })}
            </div>

            {compareTemplates.length === 0 ? (
                <EmptyState icon={GitMerge} text="Select two or more templates to compare" subtitle="Choose standards from the bar above." />
            ) : (
                <>
                    {/* Compare subtabs */}
                    <div className="flex items-center gap-1 mb-3 p-1 rounded-xl w-fit"
                        style={{ background: 'var(--app-surface-2, var(--app-surface))' }}>
                        <button onClick={() => setCompareTab('accounts')}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: compareTab === 'accounts' ? 'var(--app-primary)' : 'transparent',
                                color: compareTab === 'accounts' ? '#fff' : 'var(--app-muted-foreground)' }}>
                            <TreePine size={13} /> Account Trees
                        </button>
                        <button onClick={() => setCompareTab('rules')}
                            className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                            style={{ background: compareTab === 'rules' ? 'var(--app-primary)' : 'transparent',
                                color: compareTab === 'rules' ? '#fff' : 'var(--app-muted-foreground)' }}>
                            <Workflow size={13} /> Posting Rules
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(compareTemplates.length, 4)}, 1fr)`, gap: '12px' }}>
                        {compareTemplates.map(key => {
                            const t = templates.find(tpl => tpl.key === key)
                            const detail = templatesMap[key]
                            const accent = ACCENT_MAP[key] || t?.accent_color || 'var(--app-primary)'
                            const accounts = detail?.accounts || []
                            const rules: any[] = detail?.posting_rules || []

                            // Group rules by module
                            const groupedRules: Record<string, any[]> = {}
                            for (const r of rules) {
                                const mod = r.module || 'general'
                                if (!groupedRules[mod]) groupedRules[mod] = []
                                groupedRules[mod].push(r)
                            }

                            return (
                                <div key={key} className="rounded-2xl overflow-hidden flex flex-col"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="p-4 flex justify-between items-start"
                                        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, var(--app-surface)), var(--app-surface))`,
                                            borderBottom: '1px solid var(--app-border)' }}>
                                        <div>
                                            <h3 className="text-[13px] font-black text-app-foreground">{t?.name || key}</h3>
                                            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-0.5">
                                                {t?.region} · {compareTab === 'accounts' ? `${accounts.length} accts` : `${rules.length} rules`}
                                            </p>
                                        </div>
                                        <button disabled={isPending} onClick={() => onImport(key)}
                                            className="flex items-center gap-1 text-[10px] font-bold text-white px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
                                            style={{ background: accent }}>
                                            <Zap size={12} /> Import
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                                        {compareTab === 'accounts' ? (
                                            accounts.map((item: any, i: number) => (
                                                <AccountTreeNode key={i} item={item} level={0} accent={accent} expandAll={false} />
                                            ))
                                        ) : (
                                            <PostingRulesPanel groupedRules={groupedRules} accent={accent} />
                                        )}
                                    </div>
                                    <div className="p-3 text-center" style={{ borderTop: '1px solid var(--app-border)' }}>
                                        <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                            {compareTab === 'accounts' ? `${accounts.length} root classes` : `${rules.length} posting rules`}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════
// Migration View — Full Auto-Mapper (Merge N:1 + Split 1:N)
// ══════════════════════════════════════════════════════════════════

type FlatAccount = { code: string; name: string; type: string; subType?: string }

// Flatten hierarchical accounts tree into a flat array
function flattenAccounts(accounts: any[], parentType?: string): FlatAccount[] {
    const result: FlatAccount[] = []
    for (const acct of accounts) {
        result.push({ code: acct.code, name: acct.name, type: acct.type || parentType || '', subType: acct.subType })
        if (acct.children) {
            result.push(...flattenAccounts(acct.children, acct.type || parentType))
        }
    }
    return result
}

// Normalize name for fuzzy matching
function normalizeName(name: string): string {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

// Word-overlap similarity (0..1)
function wordSimilarity(a: string, b: string): number {
    const wa = new Set(normalizeName(a).split(' ').filter(Boolean))
    const wb = new Set(normalizeName(b).split(' ').filter(Boolean))
    if (wa.size === 0 || wb.size === 0) return 0
    let overlap = 0
    for (const w of wa) { if (wb.has(w)) overlap++ }
    return overlap / Math.max(wa.size, wb.size)
}

type MappingTarget = { code: string; name: string; type: string; pct: number }
type MappingEntry = {
    srcCode: string; srcName: string; srcType: string
    targets: MappingTarget[]
    matchLevel: 'HINT' | 'CODE' | 'NAME' | 'MERGE' | 'SPLIT'
    isMerge: boolean  // N:1 — this target already used by another source
    isSplit: boolean  // 1:N — this source maps to multiple targets
}

function MigrationView({
    templates, templatesMap, migrationMaps, autoMigration, onApplyImport, isPending, accountBalances,
}: {
    templates: TemplateInfo[]; templatesMap: Record<string, any>
    migrationMaps: Record<string, Record<string, string>>
    autoMigration?: { from: string; to: string } | null
    onApplyImport?: (targetKey: string) => Promise<void>
    isPending?: boolean
    accountBalances?: { code: string; name: string; type: string; balance: number }[]
}) {
    const [sourceKey, setSourceKey] = useState<string>(autoMigration?.from || '')
    const [targetKey, setTargetKey] = useState<string>(autoMigration?.to || '')
    const [migSearch, setMigSearch] = useState('')
    const [filterLevel, setFilterLevel] = useState<string>('ALL')

    // Auto-select when autoMigration prop changes
    useEffect(() => {
        if (autoMigration) {
            setSourceKey(autoMigration.from)
            setTargetKey(autoMigration.to)
        }
    }, [autoMigration])

    const availableTargets = useMemo(() => {
        if (!sourceKey) return []
        return templates.filter(t => t.key !== sourceKey)
    }, [sourceKey, templates])

    // Build balance lookup from real DB data
    const balanceMap = useMemo(() => {
        const map: Record<string, number> = {}
        for (const acc of accountBalances || []) {
            map[acc.code] = acc.balance
        }
        return map
    }, [accountBalances])

    // ── Build full auto-mapping with ZERO unmapped ──
    const fullMapping = useMemo((): MappingEntry[] => {
        if (!sourceKey || !targetKey) return []
        const srcAccounts = flattenAccounts(templatesMap[sourceKey]?.accounts || [])
        const tgtAccounts = flattenAccounts(templatesMap[targetKey]?.accounts || [])
        const hints = migrationMaps[`${sourceKey}→${targetKey}`] || {}

        // Build target indexes
        const tgtByCode: Record<string, FlatAccount> = {}
        const tgtByNorm: Record<string, FlatAccount[]> = {}
        const tgtByType: Record<string, FlatAccount[]> = {}
        for (const t of tgtAccounts) {
            tgtByCode[t.code] = t
            const norm = normalizeName(t.name)
            if (!tgtByNorm[norm]) tgtByNorm[norm] = []
            tgtByNorm[norm].push(t)
            if (!tgtByType[t.type]) tgtByType[t.type] = []
            tgtByType[t.type].push(t)
        }

        // Track how many sources map to each target (for merge detection)
        const targetUsageCount: Record<string, number> = {}
        const usedTargets = new Set<string>()

        // ── Pass 1: Unique 1:1 matches (HINT, CODE, NAME) ──
        const pass1: { src: FlatAccount; match: FlatAccount | null; level: MappingEntry['matchLevel'] }[] = []

        for (const src of srcAccounts) {
            let match: FlatAccount | null = null
            let level: MappingEntry['matchLevel'] = 'MERGE' // will be resolved in pass 2

            // Level 1: JSON hint override
            if (hints[src.code]) {
                const hintTarget = tgtByCode[hints[src.code]]
                if (hintTarget) { match = hintTarget; level = 'HINT' }
            }

            // Level 2: Exact code match
            if (!match && tgtByCode[src.code]) {
                const candidate = tgtByCode[src.code]
                if (candidate.type === src.type || !candidate.type || !src.type) {
                    match = candidate; level = 'CODE'
                }
            }

            // Level 3: Normalized name match
            if (!match) {
                const srcNorm = normalizeName(src.name)
                const candidates = tgtByNorm[srcNorm] || []
                const sameType = candidates.find(c => c.type === src.type && !usedTargets.has(c.code))
                const anyUnused = candidates.find(c => !usedTargets.has(c.code))
                const anyUsed = candidates.find(c => c.type === src.type) || candidates[0]
                const chosen = sameType || anyUnused || anyUsed
                if (chosen) { match = chosen; level = 'NAME' }
            }

            if (match) {
                usedTargets.add(match.code)
                targetUsageCount[match.code] = (targetUsageCount[match.code] || 0) + 1
            }

            pass1.push({ src, match, level })
        }

        // ── Pass 2: Resolve remaining unmapped via MERGE or SPLIT ──
        const result: MappingEntry[] = []

        for (const { src, match, level } of pass1) {
            if (match) {
                // Detected N:1 merge if multiple sources point to same target
                const isMerge = (targetUsageCount[match.code] || 0) > 1
                result.push({
                    srcCode: src.code, srcName: src.name, srcType: src.type,
                    targets: [{ code: match.code, name: match.name, type: match.type, pct: 100 }],
                    matchLevel: isMerge ? 'MERGE' : level,
                    isMerge, isSplit: false,
                })
            } else {
                // ── SPLIT: Find multiple target accounts of same type via word similarity ──
                const candidates = (tgtByType[src.type] || [])
                    .map(c => ({ ...c, sim: wordSimilarity(src.name, c.name) }))
                    .sort((a, b) => b.sim - a.sim)

                if (candidates.length >= 2) {
                    // Take top 2-3 by similarity, split equally
                    const top = candidates.slice(0, Math.min(3, candidates.length)).filter(c => c.sim > 0)
                    if (top.length === 0) {
                        // No word similarity — just pick first of same type
                        const fallback = candidates[0]
                        targetUsageCount[fallback.code] = (targetUsageCount[fallback.code] || 0) + 1
                        result.push({
                            srcCode: src.code, srcName: src.name, srcType: src.type,
                            targets: [{ code: fallback.code, name: fallback.name, type: fallback.type, pct: 100 }],
                            matchLevel: 'MERGE', isMerge: true, isSplit: false,
                        })
                    } else if (top.length === 1) {
                        const t = top[0]
                        targetUsageCount[t.code] = (targetUsageCount[t.code] || 0) + 1
                        result.push({
                            srcCode: src.code, srcName: src.name, srcType: src.type,
                            targets: [{ code: t.code, name: t.name, type: t.type, pct: 100 }],
                            matchLevel: 'MERGE', isMerge: true, isSplit: false,
                        })
                    } else {
                        // Real split: distribute evenly
                        const pct = Math.round(100 / top.length)
                        const targets: MappingTarget[] = top.map((t, idx) => {
                            targetUsageCount[t.code] = (targetUsageCount[t.code] || 0) + 1
                            return { code: t.code, name: t.name, type: t.type, pct: idx === top.length - 1 ? (100 - pct * (top.length - 1)) : pct }
                        })
                        result.push({
                            srcCode: src.code, srcName: src.name, srcType: src.type,
                            targets, matchLevel: 'SPLIT', isMerge: false, isSplit: true,
                        })
                    }
                } else if (candidates.length === 1) {
                    const t = candidates[0]
                    targetUsageCount[t.code] = (targetUsageCount[t.code] || 0) + 1
                    result.push({
                        srcCode: src.code, srcName: src.name, srcType: src.type,
                        targets: [{ code: t.code, name: t.name, type: t.type, pct: 100 }],
                        matchLevel: 'MERGE', isMerge: true, isSplit: false,
                    })
                } else {
                    // Absolute last resort: pick ANY unused or least-used target
                    const allByUsage = tgtAccounts
                        .map(t => ({ ...t, usage: targetUsageCount[t.code] || 0 }))
                        .sort((a, b) => a.usage - b.usage)
                    const fallback = allByUsage[0]
                    if (fallback) {
                        targetUsageCount[fallback.code] = (targetUsageCount[fallback.code] || 0) + 1
                        result.push({
                            srcCode: src.code, srcName: src.name, srcType: src.type,
                            targets: [{ code: fallback.code, name: fallback.name, type: fallback.type, pct: 100 }],
                            matchLevel: 'MERGE', isMerge: true, isSplit: false,
                        })
                    }
                }
            }
        }

        return result
    }, [sourceKey, targetKey, templatesMap, migrationMaps])

    // Filter entries
    const filteredEntries = useMemo(() => {
        let entries = fullMapping
        if (filterLevel !== 'ALL') {
            entries = entries.filter(e => e.matchLevel === filterLevel)
        }
        if (migSearch) {
            const q = migSearch.toLowerCase()
            entries = entries.filter(e =>
                e.srcCode.toLowerCase().includes(q) || e.srcName.toLowerCase().includes(q) ||
                e.targets.some(t => t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
            )
        }
        return entries
    }, [fullMapping, filterLevel, migSearch])

    // Stats
    const stats = useMemo(() => {
        const byLevel: Record<string, number> = {}
        for (const e of fullMapping) {
            byLevel[e.matchLevel] = (byLevel[e.matchLevel] || 0) + 1
        }
        return byLevel
    }, [fullMapping])

    const sourceAccent = ACCENT_MAP[sourceKey] || 'var(--app-primary)'
    const targetAccent = ACCENT_MAP[targetKey] || 'var(--app-info, #3b82f6)'

    const LEVEL_COLORS: Record<string, string> = {
        HINT: 'var(--app-success, #22c55e)',
        CODE: 'var(--app-info, #3b82f6)',
        NAME: '#8b5cf6',
        MERGE: 'var(--app-warning, #f59e0b)',
        SPLIT: '#ec4899',
    }

    const LEVEL_LABELS: Record<string, string> = {
        HINT: 'Override', CODE: 'Exact Code', NAME: 'Name Match',
        MERGE: 'N→1 Merge', SPLIT: '1→N Split',
    }

    return (
        <div>
            {/* Source/Target selectors */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                        Source Template
                    </label>
                    <select value={sourceKey} onChange={e => { setSourceKey(e.target.value); setTargetKey('') }}
                        className="w-full text-[12px] font-bold px-3 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none">
                        <option value="">Select source...</option>
                        {templates.map(t => <option key={t.key} value={t.key}>{t.name} ({t.region})</option>)}
                    </select>
                </div>
                <div className="flex items-center pt-4">
                    <ArrowRightLeft size={20} className="text-app-muted-foreground" />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">
                        Target Template
                    </label>
                    <select value={targetKey} onChange={e => setTargetKey(e.target.value)}
                        disabled={!sourceKey}
                        className="w-full text-[12px] font-bold px-3 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none disabled:opacity-40">
                        <option value="">Select target...</option>
                        {availableTargets.map(t => <option key={t.key} value={t.key}>{t.name} ({t.region})</option>)}
                    </select>
                </div>
            </div>

            {!sourceKey || !targetKey ? (
                <EmptyState icon={ArrowRightLeft} text="Select source and target templates"
                    subtitle="Full auto-mapping with merge & split — zero unmapped accounts." />
            ) : (
                <div>
                    {/* Stats strip */}
                    <div className="mb-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '6px' }}>
                        <button onClick={() => setFilterLevel('ALL')}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                            style={{
                                background: filterLevel === 'ALL' ? 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))' : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: filterLevel === 'ALL' ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground">All</div>
                            <div className="text-sm font-black text-app-foreground tabular-nums ml-auto">{fullMapping.length}</div>
                        </button>
                        {(['HINT', 'CODE', 'NAME', 'MERGE', 'SPLIT'] as const).map(level => (
                            <button key={level} onClick={() => setFilterLevel(filterLevel === level ? 'ALL' : level)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                style={{
                                    background: filterLevel === level ? `color-mix(in srgb, ${LEVEL_COLORS[level]} 8%, var(--app-surface))` : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                    border: filterLevel === level ? `1px solid color-mix(in srgb, ${LEVEL_COLORS[level]} 30%, transparent)` : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                }}>
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: LEVEL_COLORS[level] }} />
                                <div className="text-[9px] font-bold uppercase tracking-wider text-app-muted-foreground">{LEVEL_LABELS[level]}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums ml-auto">{stats[level] || 0}</div>
                            </button>
                        ))}
                    </div>

                    {/* Mapping table */}
                    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3"
                            style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                                borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${sourceAccent} 15%, transparent)`, color: sourceAccent }}>
                                        {(() => { const t = templates.find(t => t.key === sourceKey); const I = resolveIcon(t?.icon); return <I size={13} /> })()}
                                    </div>
                                    <span className="text-[12px] font-bold text-app-foreground">{templates.find(t => t.key === sourceKey)?.name}</span>
                                </div>
                                <ArrowRight size={16} className="text-app-muted-foreground" />
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${targetAccent} 15%, transparent)`, color: targetAccent }}>
                                        {(() => { const t = templates.find(t => t.key === targetKey); const I = resolveIcon(t?.icon); return <I size={13} /> })()}
                                    </div>
                                    <span className="text-[12px] font-bold text-app-foreground">{templates.find(t => t.key === targetKey)?.name}</span>
                                </div>
                            </div>
                            <div className="relative">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input type="text" value={migSearch} onChange={e => setMigSearch(e.target.value)}
                                    placeholder="Filter mappings..."
                                    className="pl-7 pr-2 py-1 text-[11px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground outline-none w-44" />
                            </div>
                        </div>

                        {/* Column headers */}
                        <div className="flex items-center gap-2 px-4 py-1.5 text-[9px] font-black text-app-muted-foreground uppercase tracking-wider"
                            style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                            <div className="w-16 flex-shrink-0">Source</div>
                            <div className="flex-1 min-w-0">Source Account</div>
                            <div className="w-20 flex-shrink-0 text-right">Balance</div>
                            <div className="w-16 flex-shrink-0 text-center">Strategy</div>
                            <div className="w-16 flex-shrink-0">Target</div>
                            <div className="flex-1 min-w-0">Target Account</div>
                            <div className="w-10 flex-shrink-0 text-center hidden sm:block">%</div>
                        </div>

                        {/* Rows — grouped rendering */}
                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                            {(() => {
                                // Build display items: group MERGE entries by target, keep others as-is
                                type DisplayItem =
                                    | { kind: '1:1'; entry: MappingEntry }
                                    | { kind: 'split'; entry: MappingEntry }
                                    | { kind: 'merge-group'; targetCode: string; targetName: string; sources: MappingEntry[] }

                                const items: DisplayItem[] = []
                                const mergeGroups = new Map<string, MappingEntry[]>()
                                const mergeGroupOrder: string[] = []

                                for (const entry of filteredEntries) {
                                    if (entry.isSplit && entry.targets.length > 1) {
                                        items.push({ kind: 'split', entry })
                                    } else if (entry.isMerge) {
                                        const tgtCode = entry.targets[0]?.code || ''
                                        if (!mergeGroups.has(tgtCode)) {
                                            mergeGroups.set(tgtCode, [])
                                            mergeGroupOrder.push(tgtCode)
                                        }
                                        mergeGroups.get(tgtCode)!.push(entry)
                                    } else {
                                        items.push({ kind: '1:1', entry })
                                    }
                                }

                                // Insert merge groups in order of first appearance
                                const allItems: DisplayItem[] = []
                                let mergeInserted = new Set<string>()
                                let entryIdx = 0

                                for (const entry of filteredEntries) {
                                    if (entry.isSplit && entry.targets.length > 1) {
                                        allItems.push({ kind: 'split', entry })
                                    } else if (entry.isMerge) {
                                        const tgtCode = entry.targets[0]?.code || ''
                                        if (!mergeInserted.has(tgtCode)) {
                                            mergeInserted.add(tgtCode)
                                            const sources = mergeGroups.get(tgtCode) || []
                                            const tgt = sources[0]?.targets[0]
                                            allItems.push({ kind: 'merge-group', targetCode: tgt?.code || '', targetName: tgt?.name || '', sources })
                                        }
                                    } else {
                                        allItems.push({ kind: '1:1', entry })
                                    }
                                }

                                const mergeColor = LEVEL_COLORS['MERGE'] || 'var(--app-warning, #f59e0b)'

                                return allItems.map((item, i) => {
                                    // ── MERGE GROUP: Target header → indented source sub-rows ──
                                    if (item.kind === 'merge-group') {
                                        const { targetCode, targetName, sources } = item
                                        return (
                                            <div key={`mg-${targetCode}-${i}`}>
                                                {/* Target header row */}
                                                <div className="flex items-center gap-2 px-4 py-2 transition-all"
                                                    style={{
                                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)',
                                                        background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 5%, var(--app-surface))',
                                                    }}>
                                                    <div className="w-16 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider"
                                                            style={{ color: mergeColor }}>
                                                            {sources.length} accounts merge into ↓
                                                        </span>
                                                    </div>
                                                    <div className="w-20 flex-shrink-0" />
                                                    <div className="w-16 flex-shrink-0 text-center">
                                                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                            style={{ background: `color-mix(in srgb, ${mergeColor} 12%, transparent)`, color: mergeColor,
                                                                border: `1px solid color-mix(in srgb, ${mergeColor} 25%, transparent)` }}>
                                                            MERGE {sources.length}→1
                                                        </span>
                                                    </div>
                                                    <div className="w-16 flex-shrink-0">
                                                        <span className="text-[11px] font-mono font-black tabular-nums px-1 py-0.5 rounded"
                                                            style={{ background: `color-mix(in srgb, ${targetAccent} 12%, transparent)`, color: targetAccent }}>
                                                            {targetCode}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[11px] font-black text-app-foreground truncate block">{targetName}</span>
                                                    </div>
                                                    <div className="w-10 flex-shrink-0 text-center hidden sm:block">
                                                        <span className="text-[10px] font-black tabular-nums"
                                                            style={{ color: mergeColor }}>100%</span>
                                                    </div>
                                                </div>
                                                {/* Source sub-rows */}
                                                {sources.map((src, j) => (
                                                    <div key={`mg-${targetCode}-${j}`}
                                                        className="flex items-center gap-2 pl-6 pr-4 py-1 transition-all hover:bg-app-surface/40"
                                                        style={{
                                                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)',
                                                            borderLeft: `3px solid ${mergeColor}`,
                                                            marginLeft: '8px',
                                                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 2%, transparent)',
                                                        }}>
                                                        <div className="w-16 flex-shrink-0">
                                                            <span className="text-[11px] font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                                                style={{ background: `color-mix(in srgb, ${sourceAccent} 8%, transparent)`, color: sourceAccent }}>
                                                                {src.srcCode}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[11px] font-medium text-app-foreground truncate block">{src.srcName}</span>
                                                        </div>
                                                        <div className="w-20 flex-shrink-0 text-right">
                                                            {(() => { const bal = balanceMap[src.srcCode]; return bal !== undefined && bal !== 0 ? (
                                                                <span className="text-[10px] font-black tabular-nums" style={{ color: bal > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-danger, #ef4444)' }}>
                                                                    {bal.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                                </span>
                                                            ) : <span className="text-[10px] text-app-muted-foreground">—</span> })()}
                                                        </div>
                                                        <div className="w-16 flex-shrink-0 text-center">
                                                            <span className="text-[9px] font-bold" style={{ color: mergeColor }}>├─</span>
                                                        </div>
                                                        <div className="w-16 flex-shrink-0">
                                                            <span className="text-[10px] font-mono font-bold tabular-nums text-app-muted-foreground">{targetCode}</span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10px] text-app-muted-foreground truncate block italic">{targetName}</span>
                                                        </div>
                                                        <div className="w-10 flex-shrink-0 text-center hidden sm:block">
                                                            <span className="text-[10px] font-bold tabular-nums text-app-muted-foreground">100%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }

                                    // ── SPLIT row ──
                                    if (item.kind === 'split') {
                                        const entry = item.entry
                                        return (
                                            <div key={`sp-${i}`}>
                                                <div className="flex items-center gap-2 px-4 py-1.5 transition-all"
                                                    style={{
                                                        borderBottom: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)',
                                                        background: 'color-mix(in srgb, #ec4899 3%, var(--app-surface))',
                                                    }}>
                                                    <div className="w-16 flex-shrink-0">
                                                        <span className="text-[11px] font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                                            style={{ background: `color-mix(in srgb, ${sourceAccent} 8%, transparent)`, color: sourceAccent }}>
                                                            {entry.srcCode}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[11px] font-bold text-app-foreground truncate block">{entry.srcName}</span>
                                                    </div>
                                                    <div className="w-20 flex-shrink-0 text-right">
                                                        {(() => { const bal = balanceMap[entry.srcCode]; return bal !== undefined && bal !== 0 ? (
                                                            <span className="text-[10px] font-black tabular-nums" style={{ color: bal > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-danger, #ef4444)' }}>
                                                                {bal.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                            </span>
                                                        ) : <span className="text-[10px] text-app-muted-foreground">—</span> })()}
                                                    </div>
                                                    <div className="w-16 flex-shrink-0 text-center">
                                                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                            style={{ background: 'color-mix(in srgb, #ec4899 10%, transparent)', color: '#ec4899',
                                                                border: '1px solid color-mix(in srgb, #ec4899 20%, transparent)' }}>
                                                            SPLIT 1→{entry.targets.length}
                                                        </span>
                                                    </div>
                                                    <div className="w-16 flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-[10px] font-bold text-app-muted-foreground italic">
                                                            Split across {entry.targets.length} accounts ↓
                                                        </span>
                                                    </div>
                                                    <div className="w-10 flex-shrink-0 hidden sm:block" />
                                                </div>
                                                {entry.targets.map((tgt, j) => (
                                                    <div key={`sp-${i}-${j}`}
                                                        className="flex items-center gap-2 pl-6 pr-4 py-1 transition-all hover:bg-app-surface/40"
                                                        style={{
                                                            borderBottom: '1px solid color-mix(in srgb, var(--app-border) 20%, transparent)',
                                                            borderLeft: '3px solid #ec4899',
                                                            marginLeft: '8px',
                                                        }}>
                                                        <div className="w-16 flex-shrink-0" />
                                                        <div className="flex-1 min-w-0" />
                                                        <div className="w-20 flex-shrink-0" />
                                                        <div className="w-16 flex-shrink-0 text-center">
                                                            <span className="text-[9px] font-bold" style={{ color: '#ec4899' }}>├─</span>
                                                        </div>
                                                        <div className="w-16 flex-shrink-0">
                                                            <span className="text-[11px] font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                                                style={{ background: `color-mix(in srgb, ${targetAccent} 8%, transparent)`, color: targetAccent }}>
                                                                {tgt.code}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[11px] font-medium text-app-foreground truncate block">{tgt.name}</span>
                                                        </div>
                                                        <div className="w-10 flex-shrink-0 text-center hidden sm:block">
                                                            <span className="text-[10px] font-black tabular-nums px-1 py-0.5 rounded"
                                                                style={{ background: 'color-mix(in srgb, #ec4899 10%, transparent)', color: '#ec4899' }}>
                                                                {tgt.pct}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    }

                                    // ── Standard 1:1 row ──
                                    const entry = item.entry
                                    const levelColor = LEVEL_COLORS[entry.matchLevel] || 'var(--app-muted-foreground)'
                                    const tgt = entry.targets[0]
                                    return (
                                        <div key={`s-${i}`} className="flex items-center gap-2 px-4 py-1.5 transition-all hover:bg-app-surface/40"
                                            style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                            <div className="w-16 flex-shrink-0">
                                                <span className="text-[11px] font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                                    style={{ background: `color-mix(in srgb, ${sourceAccent} 8%, transparent)`, color: sourceAccent }}>
                                                    {entry.srcCode}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[11px] font-medium text-app-foreground truncate block">{entry.srcName}</span>
                                            </div>
                                            <div className="w-20 flex-shrink-0 text-right">
                                                {(() => { const bal = balanceMap[entry.srcCode]; return bal !== undefined && bal !== 0 ? (
                                                    <span className="text-[10px] font-black tabular-nums" style={{ color: bal > 0 ? 'var(--app-success, #22c55e)' : bal < 0 ? 'var(--app-danger, #ef4444)' : 'var(--app-muted-foreground)' }}>
                                                        {bal.toLocaleString('en', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </span>
                                                ) : <span className="text-[10px] text-app-muted-foreground">—</span> })()}
                                            </div>
                                            <div className="w-16 flex-shrink-0 text-center">
                                                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: `color-mix(in srgb, ${levelColor} 10%, transparent)`,
                                                        color: levelColor,
                                                        border: `1px solid color-mix(in srgb, ${levelColor} 20%, transparent)`,
                                                    }}>
                                                    {entry.matchLevel}
                                                </span>
                                            </div>
                                            <div className="w-16 flex-shrink-0">
                                                {tgt ? (
                                                    <span className="text-[11px] font-mono font-bold tabular-nums px-1 py-0.5 rounded"
                                                        style={{ background: `color-mix(in srgb, ${targetAccent} 8%, transparent)`, color: targetAccent }}>
                                                        {tgt.code}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-app-muted-foreground">—</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-[11px] font-medium text-app-foreground truncate block">
                                                    {tgt?.name || '—'}
                                                </span>
                                            </div>
                                            <div className="w-10 flex-shrink-0 text-center hidden sm:block">
                                                <span className="text-[10px] font-bold tabular-nums text-app-muted-foreground">100%</span>
                                            </div>
                                        </div>
                                    )
                                })
                            })()}
                        </div>

                        {/* Footer with Apply */}
                        <div className="px-4 py-3 flex items-center justify-between"
                            style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                    {filteredEntries.length} of {fullMapping.length} mappings
                                </span>
                                {(stats['MERGE'] || 0) > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                        style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                            color: 'var(--app-warning, #f59e0b)' }}>
                                        {stats['MERGE']} merges
                                    </span>
                                )}
                                {(stats['SPLIT'] || 0) > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                        style={{ background: 'color-mix(in srgb, #ec4899 10%, transparent)', color: '#ec4899' }}>
                                        {stats['SPLIT']} splits
                                    </span>
                                )}
                                <span className="text-[11px] font-black tabular-nums px-2 py-0.5 rounded"
                                    style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                        color: 'var(--app-success, #22c55e)' }}>
                                    100% mapped
                                </span>
                            </div>
                            {onApplyImport && targetKey && (
                                <button
                                    onClick={() => onApplyImport(targetKey)}
                                    disabled={isPending || fullMapping.length === 0}
                                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all"
                                    style={{
                                        background: isPending ? 'var(--app-muted)' : 'var(--app-success, #22c55e)',
                                        color: 'white',
                                        opacity: isPending || fullMapping.length === 0 ? 0.5 : 1,
                                        cursor: isPending ? 'wait' : 'pointer',
                                    }}>
                                    {isPending ? (
                                        <><Loader2 size={14} className="animate-spin" /> Migrating...</>
                                    ) : (
                                        <><Zap size={14} /> Apply Migration &amp; Import</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Helper: Find account name by code in hierarchical tree ──
function findAccountName(accounts: any[] | undefined, code: string): string {
    if (!accounts) return code
    for (const acct of accounts) {
        if (acct.code === code) return acct.name
        if (acct.children) {
            const found = findAccountName(acct.children, code)
            if (found !== code) return found
        }
    }
    return code
}

// ── Empty State ──
function EmptyState({ icon: Icon, text, subtitle }: { icon: any; text: string; subtitle?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <Icon size={36} className="text-app-muted-foreground mb-3 opacity-40" />
            <p className="text-sm font-bold text-app-muted-foreground">{text}</p>
            {subtitle && <p className="text-[11px] text-app-muted-foreground mt-1">{subtitle}</p>}
        </div>
    )
}
