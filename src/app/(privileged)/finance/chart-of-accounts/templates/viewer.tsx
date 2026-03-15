'use client'
import { useState, useMemo, useEffect } from 'react'
import {
    ChevronRight, ChevronDown, CheckCircle2, Undo2, Library,
    Zap, FileText, ShieldCheck, Globe, BookOpen, Scale, Building2,
    TrendingUp, ArrowRight, Layers, Info, X, GitCompareArrows, Columns2,
    Plus, Copy, Trash2, Map
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importChartOfAccountsTemplate, getDBTemplatePostingRules, createCustomTemplate, deleteCustomTemplate, type DBTemplatePostingRule } from '@/app/actions/finance/coa-templates'
import MigrationMapBuilder from './migration-map-builder'
import { applyAutoDetect } from '@/app/actions/finance/posting-rules'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/* ── Template metadata ─────────────────────────────────────── */
const TEMPLATE_META: Record<string, { icon: any; accent: string; region: string; desc: string }> = {
    IFRS_COA: {
        icon: Globe, accent: 'var(--app-info)', region: 'International',
        desc: 'Universal standard for global enterprises'
    },
    LEBANESE_PCN: {
        icon: Building2, accent: 'var(--app-success)', region: 'Lebanon',
        desc: 'Plan Comptable National Libanais'
    },
    FRENCH_PCG: {
        icon: BookOpen, accent: 'var(--app-warning)', region: 'France',
        desc: 'Plan Comptable Général (France)'
    },
    USA_GAAP: {
        icon: Scale, accent: '#6366f1', region: 'United States',
        desc: 'Generally Accepted Accounting Principles'
    },
    SYSCOHADA_REVISED: {
        icon: Layers, accent: 'var(--app-error)', region: 'West Africa (OHADA)',
        desc: 'Système Comptable OHADA Révisé'
    },
}

/* ── Count tree items recursively ──────────────────────────── */
function countAccounts(items: any[]): { total: number; byType: Record<string, number> } {
    let total = 0
    const byType: Record<string, number> = {}
    function walk(list: any[]) {
        for (const item of list) {
            total++
            byType[item.type] = (byType[item.type] || 0) + 1
            if (item.children) walk(item.children)
        }
    }
    walk(items)
    return { total, byType }
}

const TYPE_COLORS: Record<string, string> = {
    ASSET: 'var(--app-info)',
    LIABILITY: 'var(--app-error)',
    EQUITY: '#8b5cf6',
    INCOME: 'var(--app-success)',
    EXPENSE: 'var(--app-warning)',
}

const ALL_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']

/* ════════════════════════════════════════════════════════════ */
/*  Main Component                                              */
/* ════════════════════════════════════════════════════════════ */

export default function CoaTemplatesLibrary({ templates, currentAccounts = [] }: { templates: Record<string, any>; currentAccounts?: any[] }) {
    const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
    const [compareMode, setCompareMode] = useState(false)
    const [compareSelection, setCompareSelection] = useState<string[]>([])
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    // COA status
    const hasBalances = currentAccounts.some(a => Math.abs(a.balance ?? 0) > 0.0001)
    const hasSubAccounts = currentAccounts.some(a => a.parentId || a.parent_id || a.parent)
    const hasData = hasBalances || hasSubAccounts
    const coaIsEmpty = currentAccounts.length === 0

    const [importTarget, setImportTarget] = useState<{ key: string; step: 'confirm' | 'has-data' } | null>(null)
    const [detailTab, setDetailTab] = useState<'tree' | 'rules' | 'mappings'>('tree')
    const [postingRules, setPostingRules] = useState<DBTemplatePostingRule[]>([])
    const [loadingRules, setLoadingRules] = useState(false)

    // Custom template creation
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [createForm, setCreateForm] = useState({ name: '', key: '', region: 'Custom', description: '', cloneFrom: '' })
    const [isCreating, setIsCreating] = useState(false)

    const handleCreateTemplate = async () => {
        if (!createForm.name || !createForm.key) return
        setIsCreating(true)
        try {
            // If cloning, get the source template's accounts
            let accounts: any[] = []
            if (createForm.cloneFrom && templates[createForm.cloneFrom]) {
                accounts = templates[createForm.cloneFrom]
            }
            await createCustomTemplate({
                key: createForm.key.toUpperCase().replace(/\s+/g, '_'),
                name: createForm.name,
                region: createForm.region,
                description: createForm.description,
                accounts,
            })
            toast.success(`Custom template "${createForm.name}" created!`)
            setShowCreateDialog(false)
            setCreateForm({ name: '', key: '', region: 'Custom', description: '', cloneFrom: '' })
            router.refresh()
        } catch (e: unknown) {
            toast.error('Failed: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsCreating(false)
        }
    }

    const handleDeleteTemplate = async (key: string) => {
        try {
            await deleteCustomTemplate(key)
            toast.success(`Template "${key}" deleted`)
            setActiveTemplate(null)
            router.refresh()
        } catch (e: unknown) {
            toast.error('Failed: ' + (e instanceof Error ? e.message : String(e)))
        }
    }

    // Fetch posting rules when a template is selected
    useEffect(() => {
        if (activeTemplate && detailTab === 'rules') {
            setLoadingRules(true)
            getDBTemplatePostingRules(activeTemplate).then((res: any) => {
                setPostingRules(res.rules || [])
            }).catch(() => setPostingRules([])).finally(() => setLoadingRules(false))
        }
    }, [activeTemplate, detailTab])

    const handleImport = (key: string) => {
        if (hasData) {
            setImportTarget({ key, step: 'has-data' })
        } else {
            setImportTarget({ key, step: 'confirm' })
        }
    }

    const handleConfirmImport = async (reset: boolean) => {
        if (!importTarget) return
        const key = importTarget.key
        setImportTarget(null)
        setIsPending(true)
        try {
            await importChartOfAccountsTemplate(key as any, { reset })
            try { await applyAutoDetect(70) } catch { /* non-critical */ }
            toast.success(`Successfully imported ${key.replace(/_/g, ' ')} — Posting rules auto-configured.`)
            router.push('/finance/settings/posting-rules')
        } catch (e: unknown) {
            toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsPending(false)
        }
    }

    const templateKeys = Object.keys(templates)

    const handleCardClick = (key: string) => {
        if (compareMode) {
            setCompareSelection(prev => {
                if (prev.includes(key)) return prev.filter(k => k !== key)
                if (prev.length >= 2) return [prev[1], key] // Replace oldest
                return [...prev, key]
            })
        } else {
            setActiveTemplate(activeTemplate === key ? null : key)
        }
    }

    const exitCompare = () => {
        setCompareMode(false)
        setCompareSelection([])
    }

    return (
        <div className="space-y-8 fade-in-up">
            {/* ── Current COA Status Banner ── */}
            <div
                className="rounded-2xl p-5 flex items-center gap-5 border"
                style={{
                    background: coaIsEmpty
                        ? 'color-mix(in srgb, var(--app-warning) 8%, transparent)'
                        : 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                    borderColor: coaIsEmpty
                        ? 'color-mix(in srgb, var(--app-warning) 25%, transparent)'
                        : 'color-mix(in srgb, var(--app-success) 25%, transparent)',
                }}
            >
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                        background: coaIsEmpty
                            ? 'color-mix(in srgb, var(--app-warning) 15%, transparent)'
                            : 'color-mix(in srgb, var(--app-success) 15%, transparent)',
                    }}
                >
                    {coaIsEmpty
                        ? <Info size={22} style={{ color: 'var(--app-warning)' }} />
                        : <ShieldCheck size={22} style={{ color: 'var(--app-success)' }} />
                    }
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-app-foreground">
                        {coaIsEmpty ? 'No Chart of Accounts configured' : `Active COA: ${currentAccounts.length} accounts`}
                    </h3>
                    <p className="text-xs text-app-muted-foreground mt-0.5">
                        {coaIsEmpty
                            ? 'Select a template below to get started. This will create your accounts and configure posting rules automatically.'
                            : hasData
                                ? 'Your COA has existing data. Use the Migration Tool to safely change standards.'
                                : 'You can re-import a different template — your current empty accounts will be replaced.'
                        }
                    </p>
                </div>
                {!coaIsEmpty && (
                    <div className="flex gap-3">
                        {Object.entries(
                            currentAccounts.reduce((acc: Record<string, number>, a) => {
                                acc[a.type] = (acc[a.type] || 0) + 1
                                return acc
                            }, {})
                        ).map(([type, count]) => (
                            <div key={type} className="text-center">
                                <div className="text-lg font-black" style={{ color: TYPE_COLORS[type] }}>{count as number}</div>
                                <div className="text-[9px] font-bold uppercase tracking-wider text-app-muted-foreground">{type}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Financial Logic Guide ── */}
            <div className="grid grid-cols-2 gap-4">
                <div
                    className="rounded-xl p-4 flex items-center gap-4 border"
                    style={{
                        background: 'color-mix(in srgb, var(--app-info) 4%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--app-info) 15%, transparent)',
                    }}
                >
                    <div className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
                        style={{
                            background: 'color-mix(in srgb, var(--app-info) 12%, transparent)',
                            color: 'var(--app-info)',
                        }}>BS</div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-app-foreground">
                        <TypeBadge color="var(--app-info)">Assets</TypeBadge>
                        <span className="text-app-muted-foreground">=</span>
                        <TypeBadge color="var(--app-error)">Liabilities</TypeBadge>
                        <span className="text-app-muted-foreground">+</span>
                        <TypeBadge color="#8b5cf6">Equity</TypeBadge>
                    </div>
                </div>
                <div
                    className="rounded-xl p-4 flex items-center gap-4 border"
                    style={{
                        background: 'color-mix(in srgb, var(--app-warning) 4%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--app-warning) 15%, transparent)',
                    }}
                >
                    <div className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
                        style={{
                            background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)',
                            color: 'var(--app-warning)',
                        }}>P&L</div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-app-foreground">
                        <TypeBadge color="var(--app-success)">Revenue</TypeBadge>
                        <span className="text-app-muted-foreground">−</span>
                        <TypeBadge color="var(--app-warning)">Expenses</TypeBadge>
                        <span className="text-app-muted-foreground">=</span>
                        <TypeBadge color="var(--app-success)">Net Profit</TypeBadge>
                    </div>
                </div>
            </div>

            {/* ── Template Cards Grid ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-app-foreground">Available Standards</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-app-muted-foreground font-medium">{templateKeys.length} templates</span>
                        <button
                            onClick={() => {
                                if (compareMode) { exitCompare() } else {
                                    setCompareMode(true)
                                    setActiveTemplate(null)
                                    setCompareSelection([])
                                }
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border"
                            style={{
                                background: compareMode
                                    ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                    : 'var(--app-surface)',
                                color: compareMode ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                borderColor: compareMode
                                    ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)'
                                    : 'var(--app-border)',
                            }}
                        >
                            <GitCompareArrows size={14} />
                            {compareMode ? 'Exit Compare' : 'Compare Standards'}
                        </button>
                    </div>
                </div>

                {/* Compare mode instruction */}
                {compareMode && compareSelection.length < 2 && (
                    <div
                        className="mb-4 p-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in duration-200"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                            color: 'var(--app-primary)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                        }}
                    >
                        <Columns2 size={14} />
                        Select {compareSelection.length === 0 ? '2 templates' : '1 more template'} to compare side-by-side
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {templateKeys.map(key => {
                        const meta = TEMPLATE_META[key] || { icon: FileText, accent: 'var(--app-info)', region: 'Custom', desc: key }
                        const Icon = meta.icon
                        const stats = countAccounts(templates[key])
                        const isActive = compareMode ? compareSelection.includes(key) : activeTemplate === key
                        const compareIndex = compareSelection.indexOf(key)

                        return (
                            <button
                                key={key}
                                onClick={() => handleCardClick(key)}
                                className="text-left rounded-2xl border transition-all duration-300 overflow-hidden group relative"
                                style={{
                                    background: isActive
                                        ? `color-mix(in srgb, ${meta.accent} 8%, var(--app-surface))`
                                        : 'var(--app-surface)',
                                    borderColor: isActive
                                        ? `color-mix(in srgb, ${meta.accent} 40%, transparent)`
                                        : 'var(--app-border)',
                                    boxShadow: isActive
                                        ? `0 0 0 1px color-mix(in srgb, ${meta.accent} 20%, transparent), 0 8px 24px color-mix(in srgb, ${meta.accent} 8%, transparent)`
                                        : 'none',
                                }}
                            >
                                {/* Compare selection badge */}
                                {compareMode && isActive && (
                                    <div
                                        className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white z-10"
                                        style={{ background: meta.accent }}
                                    >
                                        {compareIndex + 1}
                                    </div>
                                )}
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div
                                            className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                            style={{ background: `color-mix(in srgb, ${meta.accent} 12%, transparent)` }}
                                        >
                                            <Icon size={20} style={{ color: meta.accent }} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!compareMode && isActive && <CheckCircle2 size={18} style={{ color: meta.accent }} />}
                                            <span
                                                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                                                style={{
                                                    background: `color-mix(in srgb, ${meta.accent} 10%, transparent)`,
                                                    color: meta.accent,
                                                }}
                                            >
                                                {meta.region}
                                            </span>
                                        </div>
                                    </div>
                                    <h3 className="text-base font-bold text-app-foreground mb-0.5">
                                        {key.replace(/_/g, ' ')}
                                    </h3>
                                    <p className="text-xs text-app-muted-foreground mb-4">{meta.desc}</p>

                                    {/* Stats row */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5">
                                            <Layers size={12} className="text-app-muted-foreground" />
                                            <span className="text-xs font-bold text-app-foreground">{stats.total}</span>
                                            <span className="text-[10px] text-app-muted-foreground">accounts</span>
                                        </div>
                                        <div className="h-3 w-px bg-app-border" />
                                        <div className="flex gap-1.5">
                                            {Object.entries(stats.byType).map(([type, ct]) => (
                                                <span key={type}
                                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                    style={{
                                                        background: `color-mix(in srgb, ${TYPE_COLORS[type] || 'var(--app-surface-2)'} 12%, transparent)`,
                                                        color: TYPE_COLORS[type] || 'var(--app-muted-foreground)',
                                                    }}
                                                >{ct}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}

                    {/* ── Create Custom Template Card ── */}
                    {!compareMode && (
                        <button
                            onClick={() => setShowCreateDialog(true)}
                            className="rounded-2xl border-2 border-dashed transition-all duration-300 hover:border-solid flex flex-col items-center justify-center gap-3 min-h-[160px] group"
                            style={{
                                borderColor: 'color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                background: 'color-mix(in srgb, var(--app-primary) 3%, transparent)',
                            }}
                        >
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}
                            >
                                <Plus size={22} style={{ color: 'var(--app-primary)' }} />
                            </div>
                            <div className="text-center">
                                <div className="text-sm font-bold" style={{ color: 'var(--app-primary)' }}>Create Custom Template</div>
                                <div className="text-[10px] text-app-muted-foreground mt-0.5">Build from scratch or clone existing</div>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════
                  COMPARE VIEW — Side-by-Side
               ═══════════════════════════════════════════════════════════ */}
            {compareMode && compareSelection.length === 2 && (
                <ComparePanel
                    templates={templates}
                    keys={compareSelection}
                    onClose={exitCompare}
                    onImport={handleImport}
                    isPending={isPending}
                />
            )}

            {/* ── Active Template Detail View (normal mode) ── */}
            {!compareMode && activeTemplate && templates[activeTemplate] && (
                <div className="rounded-2xl border border-app-border bg-app-surface overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    {/* Detail header */}
                    <div className="p-5 border-b border-app-border flex items-center justify-between"
                        style={{ background: `color-mix(in srgb, ${(TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)')} 4%, var(--app-surface))` }}>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: `color-mix(in srgb, ${(TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)')} 12%, transparent)` }}
                            >
                                {(() => {
                                    const Icon = TEMPLATE_META[activeTemplate]?.icon || FileText
                                    return <Icon size={18} style={{ color: TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)' }} />
                                })()}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-app-foreground">
                                    {activeTemplate.replace(/_/g, ' ')}
                                </h3>
                                <p className="text-xs text-app-muted-foreground">
                                    {countAccounts(templates[activeTemplate]).total} accounts • {templates[activeTemplate].length} root classes
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                disabled={isPending}
                                onClick={() => handleImport(activeTemplate)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow-md"
                                style={{
                                    background: TEMPLATE_META[activeTemplate]?.accent || 'var(--app-primary)',
                                    color: '#fff',
                                }}
                            >
                                <Zap size={14} />
                                {isPending ? 'Importing…' : 'Import This Standard'}
                                <ArrowRight size={14} />
                            </button>
                            <button
                                onClick={() => setActiveTemplate(null)}
                                className="p-2 hover:bg-app-surface-2 rounded-lg transition-colors"
                            >
                                <X size={18} className="text-app-muted-foreground" />
                            </button>
                        </div>
                    </div>

                    {/* ── Tab Bar ── */}
                    <div className="flex border-b border-app-border" style={{ background: 'var(--app-surface)' }}>
                        {['tree', 'rules', 'mappings'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setDetailTab(tab as 'tree' | 'rules' | 'mappings')}
                                className="px-5 py-2.5 text-xs font-bold transition-all relative"
                                style={{
                                    color: detailTab === tab ? (TEMPLATE_META[activeTemplate]?.accent || 'var(--app-primary)') : 'var(--app-muted-foreground)',
                                }}
                            >
                                {tab === 'tree' ? '📂 Account Tree' : tab === 'rules' ? '⚙️ Posting Rules' : '🗺️ Migration Maps'}
                                {detailTab === tab && (
                                    <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full" style={{ background: TEMPLATE_META[activeTemplate]?.accent || 'var(--app-primary)' }} />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab Content ── */}
                    {detailTab === 'tree' ? (
                        <>
                            {/* Type distribution bar */}
                            <DistributionBar items={templates[activeTemplate]} />

                            {/* Tree viewer */}
                            <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-4">
                                <div className="space-y-0.5">
                                    {templates[activeTemplate].map((item: Record<string, any>, i: number) => (
                                        <TemplateNode key={i} item={item} level={0} accent={TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)'} />
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : detailTab === 'rules' ? (
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-4">
                            {loadingRules ? (
                                <div className="py-16 text-center text-sm text-app-muted-foreground">Loading posting rules…</div>
                            ) : postingRules.length === 0 ? (
                                <div className="py-16 text-center">
                                    <div className="text-sm text-app-muted-foreground mb-2">No posting rules found for this template</div>
                                    <div className="text-xs text-app-muted-foreground">
                                        Run <code className="px-1.5 py-0.5 rounded bg-app-surface-2 text-app-foreground font-mono text-[10px]">python manage.py seed_coa_templates</code> on the server to populate.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="text-xs font-bold text-app-foreground">{postingRules.length} posting rules</div>
                                        <div className="text-[10px] text-app-muted-foreground">
                                            These rules will be applied when you import this template
                                        </div>
                                    </div>
                                    {Object.entries(
                                        postingRules.reduce<Record<string, DBTemplatePostingRule[]>>((groups, rule) => {
                                            const mod = rule.module || 'other'
                                                ; (groups[mod] ??= []).push(rule)
                                            return groups
                                        }, {})
                                    ).map(([mod, rules]) => (
                                        <div key={mod}>
                                            <div
                                                className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-2 inline-block"
                                                style={{
                                                    background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                                                    color: 'var(--app-primary)',
                                                }}
                                            >{mod}</div>
                                            <div className="space-y-1">
                                                {rules.map(rule => (
                                                    <div
                                                        key={rule.event_code}
                                                        className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-app-surface-2 transition-colors group"
                                                    >
                                                        <code className="text-[11px] font-mono font-bold text-app-foreground min-w-[260px]">
                                                            {rule.event_code}
                                                        </code>
                                                        <ArrowRight size={12} className="text-app-muted-foreground shrink-0" />
                                                        <span
                                                            className="text-[11px] font-black px-2 py-0.5 rounded"
                                                            style={{
                                                                background: `color-mix(in srgb, ${TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)'} 10%, transparent)`,
                                                                color: TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)',
                                                            }}
                                                        >{rule.account_code}</span>
                                                        <span className="text-[10px] text-app-muted-foreground ml-auto">
                                                            {rule.description}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <MigrationMapBuilder
                            templates={templates}
                            templateKeys={Object.keys(templates)}
                        />
                    )}
                </div>
            )}

            {/* ── Empty state ── */}
            {!compareMode && !activeTemplate && (
                <div className="py-16 flex flex-col items-center justify-center text-app-muted-foreground fade-in-up">
                    <Library size={48} className="mb-4 opacity-15" />
                    <p className="text-sm font-medium">Select a template above to preview its account structure</p>
                </div>
            )}

            {/* ── Dialogs ── */}
            <ConfirmDialog
                open={importTarget?.step === 'has-data'}
                onOpenChange={(open) => { if (!open) setImportTarget(null) }}
                onConfirm={() => {
                    setImportTarget(null)
                    router.push('/finance/chart-of-accounts/migrate')
                }}
                title="Your COA has existing data"
                description="Your chart of accounts has balances or sub-accounts. You must use the Migration Tool to safely transfer your data to the new standard. Importing directly would risk losing your financial history."
                confirmText="Open Migration Tool"
                cancelText="Cancel"
                variant="warning"
            />
            <ConfirmDialog
                open={importTarget?.step === 'confirm'}
                onOpenChange={(open) => { if (!open) setImportTarget(null) }}
                onConfirm={() => handleConfirmImport(true)}
                title={`Import ${importTarget?.key?.replace(/_/g, ' ') ?? ''}?`}
                description={coaIsEmpty
                    ? "This will create your chart of accounts from the selected template. No existing data will be affected."
                    : "This will replace your current (empty) accounts with the selected template and configure posting rules automatically."
                }
                confirmText="Import Template"
                variant="info"
            />

            {/* ── Create Custom Template Dialog ── */}
            {showCreateDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreateDialog(false)} />
                    <div
                        className="relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
                        style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}
                                >
                                    <Plus size={18} style={{ color: 'var(--app-primary)' }} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-app-foreground">Create Custom Template</h3>
                                    <p className="text-xs text-app-muted-foreground">Build your own chart of accounts standard</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCreateDialog(false)} className="p-2 hover:bg-app-surface-2 rounded-lg">
                                <X size={18} className="text-app-muted-foreground" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Name */}
                            <div>
                                <label className="text-xs font-bold text-app-foreground block mb-1">Template Name *</label>
                                <input
                                    value={createForm.name}
                                    onChange={(e) => {
                                        const name = e.target.value
                                        setCreateForm(f => ({
                                            ...f,
                                            name,
                                            key: name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_'),
                                        }))
                                    }}
                                    placeholder="e.g. My Company COA"
                                    className="w-full px-3 py-2 rounded-lg border text-sm bg-app-surface text-app-foreground"
                                    style={{ borderColor: 'var(--app-border)' }}
                                />
                            </div>

                            {/* Key (auto-generated) */}
                            <div>
                                <label className="text-xs font-bold text-app-foreground block mb-1">
                                    Template Key
                                    <span className="font-normal text-app-muted-foreground ml-1">(auto-generated)</span>
                                </label>
                                <input
                                    value={createForm.key}
                                    onChange={(e) => setCreateForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                                    className="w-full px-3 py-2 rounded-lg border text-sm bg-app-surface-2 text-app-muted-foreground font-mono"
                                    style={{ borderColor: 'var(--app-border)' }}
                                />
                            </div>

                            {/* Region */}
                            <div>
                                <label className="text-xs font-bold text-app-foreground block mb-1">Region</label>
                                <input
                                    value={createForm.region}
                                    onChange={(e) => setCreateForm(f => ({ ...f, region: e.target.value }))}
                                    placeholder="e.g. Custom, Middle East, Africa"
                                    className="w-full px-3 py-2 rounded-lg border text-sm bg-app-surface text-app-foreground"
                                    style={{ borderColor: 'var(--app-border)' }}
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-bold text-app-foreground block mb-1">Description</label>
                                <textarea
                                    value={createForm.description}
                                    onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Brief description of this template..."
                                    rows={2}
                                    className="w-full px-3 py-2 rounded-lg border text-sm bg-app-surface text-app-foreground resize-none"
                                    style={{ borderColor: 'var(--app-border)' }}
                                />
                            </div>

                            {/* Clone from */}
                            <div>
                                <label className="text-xs font-bold text-app-foreground block mb-1">
                                    <Copy size={12} className="inline mr-1" />
                                    Clone From
                                    <span className="font-normal text-app-muted-foreground ml-1">(optional)</span>
                                </label>
                                <select
                                    value={createForm.cloneFrom}
                                    onChange={(e) => setCreateForm(f => ({ ...f, cloneFrom: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg border text-sm bg-app-surface text-app-foreground"
                                    style={{ borderColor: 'var(--app-border)' }}
                                >
                                    <option value="">Start from scratch</option>
                                    {templateKeys.map(k => (
                                        <option key={k} value={k}>{k.replace(/_/g, ' ')} ({countAccounts(templates[k]).total} accounts)</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
                            <button
                                onClick={() => setShowCreateDialog(false)}
                                className="px-4 py-2 rounded-lg text-xs font-bold text-app-muted-foreground hover:bg-app-surface-2 transition-colors"
                            >Cancel</button>
                            <button
                                onClick={handleCreateTemplate}
                                disabled={!createForm.name || !createForm.key || isCreating}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                                style={{ background: 'var(--app-primary)' }}
                            >
                                <Plus size={14} />
                                {isCreating ? 'Creating…' : 'Create Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}


/* ════════════════════════════════════════════════════════════ */
/*  Compare Panel — Side-by-Side                                */
/* ════════════════════════════════════════════════════════════ */
function ComparePanel({
    templates, keys, onClose, onImport, isPending,
}: {
    templates: Record<string, any>
    keys: string[]
    onClose: () => void
    onImport: (key: string) => void
    isPending: boolean
}) {
    const [keyA, keyB] = keys
    const metaA = TEMPLATE_META[keyA] || { icon: FileText, accent: 'var(--app-info)', region: 'Custom', desc: keyA }
    const metaB = TEMPLATE_META[keyB] || { icon: FileText, accent: 'var(--app-info)', region: 'Custom', desc: keyB }
    const statsA = countAccounts(templates[keyA])
    const statsB = countAccounts(templates[keyB])
    const IconA = metaA.icon
    const IconB = metaB.icon

    return (
        <div className="rounded-2xl border border-app-border bg-app-surface overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* Compare Header */}
            <div className="p-4 border-b border-app-border flex items-center justify-between"
                style={{ background: 'var(--app-background)' }}>
                <div className="flex items-center gap-3">
                    <GitCompareArrows size={18} className="text-app-muted-foreground" />
                    <span className="text-sm font-bold text-app-foreground">Comparing Standards</span>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-app-surface-2 rounded-lg transition-colors">
                    <X size={16} className="text-app-muted-foreground" />
                </button>
            </div>

            {/* ── Stats Comparison Table ────────────────────────────── */}
            <div className="border-b border-app-border">
                <div className="grid grid-cols-[1fr_100px_1fr]">
                    {/* Header A */}
                    <div
                        className="p-4 flex items-center gap-3 border-b"
                        style={{
                            background: `color-mix(in srgb, ${metaA.accent} 6%, transparent)`,
                            borderColor: 'var(--app-border)',
                        }}
                    >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: `color-mix(in srgb, ${metaA.accent} 12%, transparent)` }}>
                            <IconA size={16} style={{ color: metaA.accent }} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-app-foreground">{keyA.replace(/_/g, ' ')}</div>
                            <div className="text-[10px] text-app-muted-foreground">{metaA.region}</div>
                        </div>
                    </div>

                    {/* Middle label */}
                    <div className="p-4 flex items-center justify-center border-b border-x border-app-border">
                        <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">vs</span>
                    </div>

                    {/* Header B */}
                    <div
                        className="p-4 flex items-center gap-3 border-b"
                        style={{
                            background: `color-mix(in srgb, ${metaB.accent} 6%, transparent)`,
                            borderColor: 'var(--app-border)',
                        }}
                    >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                            style={{ background: `color-mix(in srgb, ${metaB.accent} 12%, transparent)` }}>
                            <IconB size={16} style={{ color: metaB.accent }} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-app-foreground">{keyB.replace(/_/g, ' ')}</div>
                            <div className="text-[10px] text-app-muted-foreground">{metaB.region}</div>
                        </div>
                    </div>

                    {/* Stat rows */}
                    {[
                        { label: 'Total Accounts', a: statsA.total, b: statsB.total },
                        { label: 'Root Classes', a: templates[keyA].length, b: templates[keyB].length },
                        ...ALL_TYPES.map(type => ({
                            label: type.charAt(0) + type.slice(1).toLowerCase(),
                            a: statsA.byType[type] || 0,
                            b: statsB.byType[type] || 0,
                            color: TYPE_COLORS[type],
                        })),
                    ].map((row, i) => (
                        <CompareRow key={i} {...row} />
                    ))}
                </div>

                {/* Import buttons */}
                <div className="grid grid-cols-[1fr_100px_1fr] border-t border-app-border">
                    <div className="p-3 flex justify-center">
                        <button
                            disabled={isPending}
                            onClick={() => onImport(keyA)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all text-white"
                            style={{ background: metaA.accent }}
                        >
                            <Zap size={12} /> Import {keyA.replace(/_/g, ' ').split(' ').slice(0, 2).join(' ')}
                        </button>
                    </div>
                    <div className="border-x border-app-border" />
                    <div className="p-3 flex justify-center">
                        <button
                            disabled={isPending}
                            onClick={() => onImport(keyB)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all text-white"
                            style={{ background: metaB.accent }}
                        >
                            <Zap size={12} /> Import {keyB.replace(/_/g, ' ').split(' ').slice(0, 2).join(' ')}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Side-by-Side Trees ───────────────────────────────── */}
            <div className="grid grid-cols-2 divide-x divide-app-border">
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-4">
                    <div className="space-y-0.5">
                        {templates[keyA].map((item: Record<string, any>, i: number) => (
                            <TemplateNode key={i} item={item} level={0} accent={metaA.accent} />
                        ))}
                    </div>
                </div>
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-4">
                    <div className="space-y-0.5">
                        {templates[keyB].map((item: Record<string, any>, i: number) => (
                            <TemplateNode key={i} item={item} level={0} accent={metaB.accent} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}


/* ── Compare row ─────────────────────────────────────────── */
function CompareRow({ label, a, b, color }: { label: string; a: number; b: number; color?: string }) {
    const diff = a - b
    const maxVal = Math.max(a, b, 1)
    return (
        <>
            <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="text-sm font-bold tabular-nums text-app-foreground">{a}</div>
                <div
                    className="h-1.5 rounded-full"
                    style={{
                        width: `${(a / maxVal) * 60}%`,
                        background: color || 'var(--app-primary)',
                        opacity: 0.6,
                        minWidth: a > 0 ? '4px' : 0,
                    }}
                />
            </div>
            <div className="px-2 py-2.5 flex flex-col items-center justify-center border-x border-app-border">
                <span className="text-[10px] font-bold text-app-muted-foreground">{label}</span>
                {diff !== 0 && (
                    <span className="text-[9px] font-black" style={{ color: diff > 0 ? 'var(--app-success)' : 'var(--app-error)' }}>
                        {diff > 0 ? `+${diff}` : diff}
                    </span>
                )}
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between flex-row-reverse">
                <div className="text-sm font-bold tabular-nums text-app-foreground">{b}</div>
                <div
                    className="h-1.5 rounded-full"
                    style={{
                        width: `${(b / maxVal) * 60}%`,
                        background: color || 'var(--app-primary)',
                        opacity: 0.6,
                        minWidth: b > 0 ? '4px' : 0,
                    }}
                />
            </div>
        </>
    )
}


/* ── Distribution Bar ──────────────────────────────────────── */
function DistributionBar({ items }: { items: any[] }) {
    const stats = countAccounts(items)
    return (
        <div className="px-5 py-3 border-b border-app-border bg-app-background flex items-center gap-4">
            <span className="text-[10px] font-bold uppercase text-app-muted-foreground tracking-widest">Distribution</span>
            <div className="flex-1 h-2 rounded-full bg-app-surface-2 overflow-hidden flex">
                {Object.entries(stats.byType).map(([type, ct]) => (
                    <div key={type}
                        style={{
                            width: `${(ct / stats.total) * 100}%`,
                            background: TYPE_COLORS[type] || 'var(--app-surface-2)',
                        }}
                        title={`${type}: ${ct}`}
                    />
                ))}
            </div>
            <div className="flex gap-3">
                {Object.entries(stats.byType).map(([type, ct]) => (
                    <div key={type} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[type] }} />
                        <span className="text-[10px] font-bold text-app-muted-foreground">{type} ({ct})</span>
                    </div>
                ))}
            </div>
        </div>
    )
}


/* ── TypeBadge helper ────────────────────────────────────── */
function TypeBadge({ color, children }: { color: string; children: React.ReactNode }) {
    return (
        <span className="px-2 py-1 rounded-md text-[10px] font-bold"
            style={{
                background: `color-mix(in srgb, ${color} 12%, transparent)`,
                color,
            }}>
            {children}
        </span>
    )
}


/* ════════════════════════════════════════════════════════════ */
/*  Tree Node Component                                         */
/* ════════════════════════════════════════════════════════════ */

function TemplateNode({ item, level = 0, accent }: { item: Record<string, any>; level: number; accent: string }) {
    const [open, setOpen] = useState(level < 1)
    const hasChildren = item.children && item.children.length > 0
    const isRoot = level === 0
    const childCount = hasChildren ? item.children.length : 0

    return (
        <div>
            <button
                onClick={() => hasChildren && setOpen(!open)}
                className="w-full flex items-center gap-2 py-2 px-3 rounded-lg transition-all group"
                style={{
                    paddingLeft: `${level * 20 + 12}px`,
                    background: isRoot ? `color-mix(in srgb, ${accent} 4%, transparent)` : 'transparent',
                    borderLeft: isRoot ? `3px solid ${accent}` : 'none',
                }}
            >
                {/* Expand/collapse */}
                <div className="w-4 flex justify-center shrink-0">
                    {hasChildren && (
                        open
                            ? <ChevronDown size={13} className="text-app-muted-foreground" />
                            : <ChevronRight size={13} className="text-app-muted-foreground" />
                    )}
                </div>

                {/* Code */}
                <span
                    className="text-[11px] font-mono font-bold shrink-0 min-w-[52px] text-left"
                    style={{ color: isRoot ? accent : 'var(--app-muted-foreground)' }}
                >
                    {item.code}
                </span>

                {/* Name */}
                <span className={`text-xs text-left flex-1 truncate ${isRoot ? 'font-bold text-app-foreground' : 'font-medium text-app-muted-foreground group-hover:text-app-foreground transition-colors'}`}>
                    {item.name}
                </span>

                {/* Child count for parents */}
                {hasChildren && (
                    <span className="text-[9px] font-bold text-app-muted-foreground px-1.5 py-0.5 rounded-full bg-app-surface-2">
                        {childCount}
                    </span>
                )}

                {/* Type badge */}
                {item.type && (
                    <div className="flex items-center gap-1 shrink-0">
                        <span
                            className="text-[8px] font-black px-1.5 py-0.5 rounded"
                            style={{
                                background: ['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type)
                                    ? 'color-mix(in srgb, var(--app-info) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--app-warning) 10%, transparent)',
                                color: ['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type)
                                    ? 'var(--app-info)' : 'var(--app-warning)',
                            }}
                        >
                            {['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type) ? 'BS' : 'P&L'}
                        </span>
                        <span
                            className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase"
                            style={{
                                background: `color-mix(in srgb, ${TYPE_COLORS[item.type] || 'var(--app-surface-2)'} 10%, transparent)`,
                                color: TYPE_COLORS[item.type] || 'var(--app-muted-foreground)',
                            }}
                        >
                            {item.type}
                        </span>
                    </div>
                )}
            </button>

            {/* Children */}
            {hasChildren && open && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                    {item.children.map((child: Record<string, any>, i: number) => (
                        <TemplateNode key={i} item={child} level={level + 1} accent={accent} />
                    ))}
                </div>
            )}
        </div>
    )
}