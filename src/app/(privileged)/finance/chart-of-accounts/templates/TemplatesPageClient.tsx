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
import { useRouter } from 'next/navigation'
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
    const [activeView, setActiveView] = useState<'gallery' | 'compare' | 'migration'>('gallery')
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
    const [compareTemplates, setCompareTemplates] = useState<string[]>([])
    const [focusMode, setFocusMode] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isPending, setIsPending] = useState(false)
    const [importTarget, setImportTarget] = useState<{ key: string; step: 'confirm' | 'reset' } | null>(null)
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

    const handleImport = async (key: string) => setImportTarget({ key, step: 'confirm' })
    const handleConfirmImport = async (reset: boolean) => {
        if (!importTarget) return
        const key = importTarget.key
        setImportTarget(null)
        setIsPending(true)
        try {
            await importChartOfAccountsTemplate(key as any, { reset })
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
        <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>

            {/* ── Page Header ── */}
            {!focusMode ? (
                <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
                    <div className="flex items-center gap-3">
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
            ) : (
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                            <Library size={14} className="text-white" />
                        </div>
                        <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Standards Library</span>
                        <span className="text-[10px] font-bold text-app-muted-foreground">{filteredTemplates.length}/{templates.length}</span>
                    </div>
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search templates... (Ctrl+K)"
                            className="w-full pl-9 pr-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                    </div>
                    <button onClick={() => setFocusMode(false)}
                        className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                        <Minimize2 size={13} />
                    </button>
                </div>
            )}

            {/* ── KPI Strip ── */}
            {!focusMode && (
                <div className="mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
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

            {/* ── Search ── */}
            {!focusMode && (
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by name, region, key... (Ctrl+K)"
                            className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                    </div>
                </div>
            )}

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
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
                        migrationMaps={migrationMaps} />
                )}
            </div>

            {/* ── Import Dialogs ── */}
            <ConfirmDialog open={importTarget?.step === 'confirm'}
                onOpenChange={(open) => { if (!open) setImportTarget(null) }}
                onConfirm={() => { if (importTarget) setImportTarget({ ...importTarget, step: 'reset' }) }}
                title={`Import ${importTarget?.key?.replace(/_/g, ' ') ?? ''}?`}
                description="This will add accounts from this template to your Chart of Accounts."
                confirmText="Continue" variant="warning" />
            <ConfirmDialog open={importTarget?.step === 'reset'}
                onOpenChange={(open) => { if (!open) { handleConfirmImport(false) } }}
                onConfirm={() => handleConfirmImport(true)}
                title="Clean Reset?" description="Delete ALL existing accounts first? Only works if zero transactions exist."
                confirmText="Clean Reset" cancelText="Keep Existing" variant="danger" />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
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
// Migration View — Template-to-Template Mapping
// ══════════════════════════════════════════════════════════════════
function MigrationView({
    templates, templatesMap, migrationMaps,
}: {
    templates: TemplateInfo[]; templatesMap: Record<string, any>
    migrationMaps: Record<string, Record<string, string>>
}) {
    const [sourceKey, setSourceKey] = useState<string>('')
    const [targetKey, setTargetKey] = useState<string>('')
    const [migSearch, setMigSearch] = useState('')

    const mapKey = sourceKey && targetKey ? `${sourceKey}→${targetKey}` : ''
    const currentMap = mapKey ? migrationMaps[mapKey] || {} : {}
    const hasMap = Object.keys(currentMap).length > 0

    // Available targets for selected source
    const availableTargets = useMemo(() => {
        if (!sourceKey) return []
        return templates.filter(t => t.key !== sourceKey && migrationMaps[`${sourceKey}→${t.key}`])
    }, [sourceKey, templates, migrationMaps])

    // Filter map entries
    const filteredEntries = useMemo(() => {
        const entries = Object.entries(currentMap)
        if (!migSearch) return entries
        const q = migSearch.toLowerCase()
        return entries.filter(([src, tgt]) => src.toLowerCase().includes(q) || tgt.toLowerCase().includes(q))
    }, [currentMap, migSearch])

    const sourceAccent = ACCENT_MAP[sourceKey] || 'var(--app-primary)'
    const targetAccent = ACCENT_MAP[targetKey] || 'var(--app-info, #3b82f6)'

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

                {hasMap && (
                    <div className="flex items-center gap-2 pt-4">
                        <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider px-2.5 py-1.5 rounded-lg"
                            style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                color: 'var(--app-success, #22c55e)' }}>
                            {Object.keys(currentMap).length} mappings
                        </span>
                    </div>
                )}
            </div>

            {!sourceKey || !targetKey ? (
                <EmptyState icon={ArrowRightLeft} text="Select source and target templates"
                    subtitle="See how accounts map between different accounting standards." />
            ) : !hasMap ? (
                <EmptyState icon={ArrowRightLeft} text="No migration map available"
                    subtitle={`No pre-built mapping exists from ${sourceKey} to ${targetKey}.`} />
            ) : (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--app-border)' }}>
                    {/* Map header */}
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
                        <div className="w-20 flex-shrink-0">Source Code</div>
                        <div className="flex-1 min-w-0">Source Account</div>
                        <div className="w-8 flex-shrink-0 text-center">→</div>
                        <div className="w-20 flex-shrink-0">Target Code</div>
                        <div className="flex-1 min-w-0">Target Account</div>
                    </div>

                    {/* Mapping rows */}
                    <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                        {filteredEntries.map(([srcCode, tgtCode], i) => {
                            // Resolve account names from template accounts
                            const srcName = findAccountName(templatesMap[sourceKey]?.accounts, srcCode)
                            const tgtName = findAccountName(templatesMap[targetKey]?.accounts, tgtCode)

                            return (
                                <div key={i} className="flex items-center gap-2 px-4 py-2 transition-all hover:bg-app-surface/40"
                                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                    <div className="w-20 flex-shrink-0">
                                        <span className="text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded"
                                            style={{ background: `color-mix(in srgb, ${sourceAccent} 8%, transparent)`, color: sourceAccent }}>
                                            {srcCode}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-medium text-app-foreground truncate block">{srcName}</span>
                                    </div>
                                    <div className="w-8 flex-shrink-0 text-center">
                                        <ArrowRight size={12} className="text-app-muted-foreground mx-auto" />
                                    </div>
                                    <div className="w-20 flex-shrink-0">
                                        <span className="text-[11px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded"
                                            style={{ background: `color-mix(in srgb, ${targetAccent} 8%, transparent)`, color: targetAccent }}>
                                            {tgtCode}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[11px] font-medium text-app-foreground truncate block">{tgtName}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 text-center" style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                        <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            {filteredEntries.length} of {Object.keys(currentMap).length} mappings shown
                        </span>
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
