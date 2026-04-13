'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
    Library, GitMerge, Search, Globe, Landmark, BookOpen,
    ChevronRight, ChevronDown, CheckCircle2, Zap, FileText,
    ShieldCheck, Maximize2, Minimize2, ChevronLeft,
    Layers, Hash, Tag, TreePine, ArrowRight, Loader2,
    MapPin, Flag, BarChart3, GitBranch,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ── Icon resolver ──────────────────────────────────────────
const ICON_MAP: Record<string, any> = {
    Globe, Landmark, BookOpen, FileText, Flag, MapPin, Library,
}
function resolveIcon(name?: string) {
    return (name && ICON_MAP[name]) || Globe
}

// ── Accent color map for templates ───────────────────────
const ACCENT_MAP: Record<string, string> = {
    IFRS_COA: 'var(--app-info, #3b82f6)',
    USA_GAAP: '#8b5cf6',
    FRENCH_PCG: 'var(--app-primary)',
    SYSCOHADA_REVISED: 'var(--app-warning, #f59e0b)',
    LEBANESE_PCN: 'var(--app-error, #ef4444)',
}

interface TemplateInfo {
    key: string
    name: string
    region: string
    description: string
    icon: string
    accent_color: string
    is_system: boolean
    is_custom: boolean
    account_count: number
    posting_rule_count: number
}

interface Props {
    templates: TemplateInfo[]
    templatesMap: Record<string, any>
}

export default function TemplatesPageClient({ templates, templatesMap }: Props) {
    const router = useRouter()
    const [activeView, setActiveView] = useState<'gallery' | 'compare'>('gallery')
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
        { label: 'System', value: templates.filter(t => t.is_system).length, icon: <ShieldCheck size={14} />, color: 'var(--app-success, #22c55e)' },
        { label: 'Custom', value: templates.filter(t => t.is_custom).length, icon: <Tag size={14} />, color: 'var(--app-warning, #f59e0b)' },
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
                                {templates.length} Templates · Compare & Import Standards
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* View switcher */}
                        <div className="flex items-center gap-1 p-1 rounded-xl"
                            style={{ background: 'var(--app-surface-2, var(--app-surface))' }}>
                            <button
                                onClick={() => setActiveView('gallery')}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                                style={{
                                    background: activeView === 'gallery' ? 'var(--app-primary)' : 'transparent',
                                    color: activeView === 'gallery' ? '#fff' : 'var(--app-muted-foreground)',
                                }}>
                                <Library size={13} /> Gallery
                            </button>
                            <button
                                onClick={() => setActiveView('compare')}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                                style={{
                                    background: activeView === 'compare' ? 'var(--app-primary)' : 'transparent',
                                    color: activeView === 'compare' ? '#fff' : 'var(--app-muted-foreground)',
                                }}>
                                <GitMerge size={13} /> Compare
                            </button>
                        </div>
                        <button
                            onClick={() => setFocusMode(true)}
                            className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                            <Maximize2 size={13} />
                        </button>
                    </div>
                </div>
            ) : (
                // Focus mode header
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
                        <div key={s.label}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                {s.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider"
                                    style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Search (non-focus mode) ── */}
            {!focusMode && (
                <div className="flex items-center gap-2 mb-4">
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by name, region, key... (Ctrl+K)"
                            className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                    </div>
                    {activeView === 'compare' && compareTemplates.length > 0 && (
                        <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">
                            {compareTemplates.length} selected
                        </span>
                    )}
                </div>
            )}

            {/* ── Content ── */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {activeView === 'gallery' ? (
                    <GalleryView
                        templates={filteredTemplates}
                        templatesMap={templatesMap}
                        selectedTemplate={selectedTemplate}
                        onSelect={setSelectedTemplate}
                        onImport={handleImport}
                        isPending={isPending}
                    />
                ) : (
                    <CompareView
                        templates={filteredTemplates}
                        templatesMap={templatesMap}
                        compareTemplates={compareTemplates}
                        onToggle={toggleCompare}
                        onImport={handleImport}
                        isPending={isPending}
                    />
                )}
            </div>

            {/* ── Import Dialogs ── */}
            <ConfirmDialog
                open={importTarget?.step === 'confirm'}
                onOpenChange={(open) => { if (!open) setImportTarget(null) }}
                onConfirm={() => {
                    if (importTarget) setImportTarget({ ...importTarget, step: 'reset' })
                }}
                title={`Import ${importTarget?.key?.replace(/_/g, ' ') ?? ''}?`}
                description="This will add accounts from this template to your Chart of Accounts. You'll be asked about a clean reset next."
                confirmText="Continue"
                variant="warning"
            />
            <ConfirmDialog
                open={importTarget?.step === 'reset'}
                onOpenChange={(open) => { if (!open) { handleConfirmImport(false) } }}
                onConfirm={() => handleConfirmImport(true)}
                title="Clean Reset?"
                description="Perform a Clean Reset? This deletes ALL existing accounts first — only works if zero transactions exist. Press Cancel to keep existing accounts."
                confirmText="Clean Reset"
                cancelText="Keep Existing"
                variant="danger"
            />
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════
// Gallery View — Card Grid
// ══════════════════════════════════════════════════════════════════
function GalleryView({
    templates, templatesMap, selectedTemplate, onSelect, onImport, isPending,
}: {
    templates: TemplateInfo[]
    templatesMap: Record<string, any>
    selectedTemplate: string | null
    onSelect: (key: string | null) => void
    onImport: (key: string) => void
    isPending: boolean
}) {
    if (templates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                <Library size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                <p className="text-sm font-bold text-app-muted-foreground">No templates found</p>
                <p className="text-[11px] text-app-muted-foreground mt-1">
                    Run <code className="font-mono bg-app-surface px-1 rounded">python manage.py seed_coa_templates</code> to load standards.
                </p>
            </div>
        )
    }

    // If a template is selected, show split view
    if (selectedTemplate && templatesMap[selectedTemplate]) {
        return (
            <div className="flex gap-4 h-full animate-in fade-in duration-200">
                {/* Left: Card list */}
                <div className="w-72 flex-shrink-0 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {templates.map(t => {
                        const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                        const isActive = selectedTemplate === t.key
                        return (
                            <button key={t.key} onClick={() => onSelect(t.key)}
                                className="w-full text-left p-3 rounded-xl transition-all"
                                style={{
                                    background: isActive
                                        ? `color-mix(in srgb, ${accent} 8%, var(--app-surface))`
                                        : 'var(--app-surface)',
                                    border: `1px solid ${isActive
                                        ? `color-mix(in srgb, ${accent} 30%, transparent)`
                                        : 'var(--app-border)'}`,
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

                {/* Right: Detail view */}
                <TemplateDetail
                    template={templates.find(t => t.key === selectedTemplate)!}
                    detail={templatesMap[selectedTemplate]}
                    onClose={() => onSelect(null)}
                    onImport={onImport}
                    isPending={isPending}
                />
            </div>
        )
    }

    // Default: Card grid
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {templates.map(t => {
                const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                return (
                    <button key={t.key} onClick={() => onSelect(t.key)}
                        className="text-left rounded-2xl transition-all hover:scale-[1.01] group overflow-hidden"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                        }}>
                        {/* Card header with accent */}
                        <div className="p-4 pb-3" style={{
                            background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, var(--app-surface)), var(--app-surface))`,
                            borderBottom: '1px solid var(--app-border)',
                        }}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                        style={{
                                            background: `color-mix(in srgb, ${accent} 15%, transparent)`,
                                            color: accent,
                                            boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 20%, transparent)`,
                                        }}>
                                        {(() => { const I = resolveIcon(t.icon); return <I size={20} /> })()}
                                    </div>
                                    <div>
                                        <h3 className="text-[14px] font-black text-app-foreground">{t.name}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <MapPin size={10} style={{ color: accent }} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: accent }}>
                                                {t.region}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {t.is_system && (
                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                                            color: 'var(--app-success, #22c55e)',
                                            border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)',
                                        }}>
                                        System
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Card body */}
                        <div className="p-4 pt-3">
                            <p className="text-[11px] font-medium text-app-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">
                                {t.description || 'Standard accounting template'}
                            </p>

                            {/* Stats */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <TreePine size={12} style={{ color: accent }} />
                                    <span className="text-[11px] font-bold text-app-foreground tabular-nums">
                                        {t.account_count || 0}
                                    </span>
                                    <span className="text-[10px] font-bold text-app-muted-foreground">accounts</span>
                                </div>
                                {t.posting_rule_count > 0 && (
                                    <div className="flex items-center gap-1.5">
                                        <GitBranch size={12} className="text-app-muted-foreground" />
                                        <span className="text-[11px] font-bold text-app-foreground tabular-nums">
                                            {t.posting_rule_count}
                                        </span>
                                        <span className="text-[10px] font-bold text-app-muted-foreground">rules</span>
                                    </div>
                                )}
                            </div>

                            {/* Action hint */}
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
// Template Detail — Full Account Tree
// ══════════════════════════════════════════════════════════════════
function TemplateDetail({
    template, detail, onClose, onImport, isPending,
}: {
    template: TemplateInfo
    detail: any
    onClose: () => void
    onImport: (key: string) => void
    isPending: boolean
}) {
    const [expandAll, setExpandAll] = useState(false)
    const accent = ACCENT_MAP[template.key] || template.accent_color || 'var(--app-primary)'
    const accounts = detail?.accounts || []

    return (
        <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden animate-in slide-in-from-right-4 duration-300"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

            {/* Detail Header */}
            <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between"
                style={{
                    background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 6%, var(--app-surface)), var(--app-surface))`,
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div className="flex items-center gap-3">
                    <button onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <ChevronLeft size={16} />
                    </button>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{
                            background: accent,
                            boxShadow: `0 4px 12px color-mix(in srgb, ${accent} 30%, transparent)`,
                        }}>
                        {(() => { const I = resolveIcon(template.icon); return <I size={16} className="text-white" /> })()}
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-app-foreground">{template.name}</h3>
                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">
                            {template.region} · {accounts.length} accounts
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setExpandAll(!expandAll)}
                        className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                        <Layers size={13} />
                        <span className="hidden md:inline">{expandAll ? 'Collapse' : 'Expand'}</span>
                    </button>
                    <button
                        disabled={isPending}
                        onClick={() => onImport(template.key)}
                        className="flex items-center gap-1.5 text-[11px] font-bold text-white px-3 py-1.5 rounded-xl transition-all hover:brightness-110"
                        style={{
                            background: accent,
                            boxShadow: `0 2px 8px color-mix(in srgb, ${accent} 25%, transparent)`,
                        }}>
                        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                        <span className="hidden sm:inline">Import</span>
                    </button>
                </div>
            </div>

            {/* Financial Logic Strip */}
            <div className="flex-shrink-0 flex items-center gap-4 px-5 py-2"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', borderBottom: '1px solid var(--app-border)' }}>
                <div className="flex items-center gap-2 text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">
                    <ShieldCheck size={12} style={{ color: accent }} />
                    <span>Balance Sheet</span>
                    <span className="text-[9px] font-mono px-1 rounded"
                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
                        A = L + E
                    </span>
                </div>
                <div className="w-px h-4" style={{ background: 'var(--app-border)' }} />
                <div className="flex items-center gap-2 text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">
                    <BarChart3 size={12} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                    <span>P&L</span>
                    <span className="text-[9px] font-mono px-1 rounded"
                        style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                        R - E = NP
                    </span>
                </div>
            </div>

            {/* Column Headers */}
            <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"
                style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }}>
                <div className="w-5 flex-shrink-0" />
                <div className="w-16 flex-shrink-0">Code</div>
                <div className="flex-1 min-w-0">Account Name</div>
                <div className="w-20 text-center flex-shrink-0 hidden sm:block">Type</div>
                <div className="w-16 text-center flex-shrink-0 hidden md:block">Report</div>
            </div>

            {/* Account Tree */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {Array.isArray(accounts) && accounts.length > 0 ? (
                    <div>
                        {accounts.map((item: any, i: number) => (
                            <AccountTreeNode key={i} item={item} level={0} accent={accent} expandAll={expandAll} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <FileText size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                        <p className="text-sm font-bold text-app-muted-foreground">No accounts in this template</p>
                    </div>
                )}
            </div>
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

    // Sync with expandAll toggle
    useEffect(() => { setOpen(expandAll || level < 1) }, [expandAll, level])

    const typeColor = {
        ASSET: 'var(--app-info, #3b82f6)',
        LIABILITY: 'var(--app-error, #ef4444)',
        EQUITY: '#8b5cf6',
        INCOME: 'var(--app-success, #22c55e)',
        EXPENSE: 'var(--app-warning, #f59e0b)',
    }[item.type] || 'var(--app-muted-foreground)'

    const reportTag = ['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type) ? 'BS' : 'P&L'
    const reportColor = reportTag === 'BS' ? 'var(--app-info, #3b82f6)' : 'var(--app-warning, #f59e0b)'

    return (
        <div>
            <div
                onClick={() => hasChildren && setOpen(!open)}
                className={`group flex items-center gap-2 transition-all duration-150 border-b hover:bg-app-surface/40 ${hasChildren ? 'cursor-pointer' : ''}`}
                style={{
                    paddingLeft: isRoot ? '12px' : `${12 + level * 20}px`,
                    paddingRight: '12px',
                    paddingTop: isRoot ? '8px' : '5px',
                    paddingBottom: isRoot ? '8px' : '5px',
                    background: isRoot ? `color-mix(in srgb, ${accent} 4%, var(--app-surface))` : undefined,
                    borderLeft: isRoot ? `3px solid ${accent}` : '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                    marginLeft: !isRoot ? `${12 + (level - 1) * 20 + 10}px` : undefined,
                }}>
                {/* Toggle */}
                <div className="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0"
                    style={{ color: hasChildren ? 'var(--app-muted-foreground)' : 'var(--app-border)' }}>
                    {hasChildren ? (
                        open ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: typeColor }} />
                    )}
                </div>

                {/* Code */}
                <span className="w-16 flex-shrink-0 font-mono text-[11px] font-bold tabular-nums"
                    style={{ color: isRoot ? accent : 'var(--app-muted-foreground)' }}>
                    {item.code}
                </span>

                {/* Name */}
                <span className={`flex-1 min-w-0 truncate text-[13px] ${isRoot ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                    {item.name}
                </span>

                {/* Type badge */}
                {item.type && (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 hidden sm:block"
                        style={{
                            background: `color-mix(in srgb, ${typeColor} 10%, transparent)`,
                            color: typeColor,
                            border: `1px solid color-mix(in srgb, ${typeColor} 20%, transparent)`,
                        }}>
                        {item.type}
                    </span>
                )}

                {/* Report tag */}
                {item.type && (
                    <span className="text-[8px] font-black px-1 rounded flex-shrink-0 hidden md:block"
                        style={{
                            background: `color-mix(in srgb, ${reportColor} 10%, transparent)`,
                            color: reportColor,
                        }}>
                        [{reportTag}]
                    </span>
                )}
            </div>

            {/* Children */}
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
// Compare View — Side by Side
// ══════════════════════════════════════════════════════════════════
function CompareView({
    templates, templatesMap, compareTemplates, onToggle, onImport, isPending,
}: {
    templates: TemplateInfo[]
    templatesMap: Record<string, any>
    compareTemplates: string[]
    onToggle: (key: string) => void
    onImport: (key: string) => void
    isPending: boolean
}) {
    return (
        <div>
            {/* Selection bar */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 no-scrollbar">
                {templates.map(t => {
                    const accent = ACCENT_MAP[t.key] || t.accent_color || 'var(--app-primary)'
                    const isSelected = compareTemplates.includes(t.key)
                    return (
                        <button key={t.key} onClick={() => onToggle(t.key)}
                            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all"
                            style={{
                                background: isSelected
                                    ? `color-mix(in srgb, ${accent} 8%, var(--app-surface))`
                                    : 'var(--app-surface)',
                                border: `1px solid ${isSelected
                                    ? `color-mix(in srgb, ${accent} 40%, transparent)`
                                    : 'var(--app-border)'}`,
                            }}>
                            {isSelected ? <CheckCircle2 size={14} style={{ color: accent }} /> : <Library size={14} className="text-app-muted-foreground" />}
                            <span className="text-[12px] font-bold whitespace-nowrap"
                                style={{ color: isSelected ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {t.name}
                            </span>
                            <span className="text-[10px] font-bold tabular-nums"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                {t.account_count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {compareTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <GitMerge size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                    <p className="text-sm font-bold text-app-muted-foreground">Select templates to compare</p>
                    <p className="text-[11px] text-app-muted-foreground mt-1">
                        Choose two or more standards from the bar above.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(compareTemplates.length, 4)}, 1fr)`, gap: '12px' }}>
                    {compareTemplates.map(key => {
                        const t = templates.find(tpl => tpl.key === key)
                        const detail = templatesMap[key]
                        const accent = ACCENT_MAP[key] || t?.accent_color || 'var(--app-primary)'
                        const accounts = detail?.accounts || []

                        return (
                            <div key={key} className="rounded-2xl overflow-hidden flex flex-col"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                {/* Header */}
                                <div className="p-4 flex justify-between items-start"
                                    style={{
                                        background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 8%, var(--app-surface)), var(--app-surface))`,
                                        borderBottom: '1px solid var(--app-border)',
                                    }}>
                                    <div>
                                        <h3 className="text-[13px] font-black text-app-foreground">{t?.name || key}</h3>
                                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider mt-0.5">
                                            {t?.region} · {accounts.length} accounts
                                        </p>
                                    </div>
                                    <button
                                        disabled={isPending}
                                        onClick={() => onImport(key)}
                                        className="flex items-center gap-1 text-[10px] font-bold text-white px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
                                        style={{ background: accent }}>
                                        <Zap size={12} /> Import
                                    </button>
                                </div>

                                {/* Tree */}
                                <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
                                    {accounts.map((item: any, i: number) => (
                                        <AccountTreeNode key={i} item={item} level={0} accent={accent} expandAll={false} />
                                    ))}
                                </div>

                                {/* Footer */}
                                <div className="p-3 text-center"
                                    style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {accounts.length} root classes
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
