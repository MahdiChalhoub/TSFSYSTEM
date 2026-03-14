'use client'
import { useState, useMemo } from 'react'
import {
    ChevronRight, ChevronDown, CheckCircle2, Undo2, Library,
    Zap, FileText, ShieldCheck, Globe, BookOpen, Scale, Building2,
    TrendingUp, ArrowRight, Layers, Info, X
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
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

/* ════════════════════════════════════════════════════════════ */
/*  Main Component                                              */
/* ════════════════════════════════════════════════════════════ */

export default function CoaTemplatesLibrary({ templates, currentAccounts = [] }: { templates: Record<string, any>; currentAccounts?: any[] }) {
    const [activeTemplate, setActiveTemplate] = useState<string | null>(null)
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()

    // COA status
    const hasBalances = currentAccounts.some(a => Math.abs(a.balance ?? 0) > 0.0001)
    const hasSubAccounts = currentAccounts.some(a => a.parentId || a.parent_id || a.parent)
    const hasData = hasBalances || hasSubAccounts
    const coaIsEmpty = currentAccounts.length === 0

    const [importTarget, setImportTarget] = useState<{ key: string; step: 'confirm' | 'has-data' } | null>(null)

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

    return (
        <div className="space-y-8 fade-in-up">
            {/* ── Current COA Status Banner ── */}
            <div
                className="rounded-2xl p-5 flex items-center gap-5 border"
                style={{
                    background: coaIsEmpty
                        ? 'linear-gradient(135deg, var(--app-warning)08, var(--app-warning)15)'
                        : 'linear-gradient(135deg, var(--app-success)08, var(--app-success)15)',
                    borderColor: coaIsEmpty ? 'var(--app-warning)30' : 'var(--app-success)30',
                }}
            >
                <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                        background: coaIsEmpty ? 'var(--app-warning)20' : 'var(--app-success)20',
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
                    style={{ background: 'var(--app-info)06', borderColor: 'var(--app-info)20' }}
                >
                    <div className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
                        style={{ background: 'var(--app-info)15', color: 'var(--app-info)' }}>BS</div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-app-foreground">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ background: 'var(--app-info)15', color: 'var(--app-info)' }}>Assets</span>
                        <span className="text-app-muted-foreground">=</span>
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ background: 'var(--app-error)15', color: 'var(--app-error)' }}>Liabilities</span>
                        <span className="text-app-muted-foreground">+</span>
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ background: '#8b5cf620', color: '#8b5cf6' }}>Equity</span>
                    </div>
                </div>
                <div
                    className="rounded-xl p-4 flex items-center gap-4 border"
                    style={{ background: 'var(--app-warning)06', borderColor: 'var(--app-warning)20' }}
                >
                    <div className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
                        style={{ background: 'var(--app-warning)15', color: 'var(--app-warning)' }}>P&L</div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-app-foreground">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ background: 'var(--app-success)15', color: 'var(--app-success)' }}>Revenue</span>
                        <span className="text-app-muted-foreground">−</span>
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold" style={{ background: 'var(--app-warning)15', color: 'var(--app-warning)' }}>Expenses</span>
                        <span className="text-app-muted-foreground">=</span>
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold italic" style={{ background: 'var(--app-success)15', color: 'var(--app-success)' }}>Net Profit</span>
                    </div>
                </div>
            </div>

            {/* ── Template Cards Grid ── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-app-foreground">Available Standards</h2>
                    <span className="text-xs text-app-muted-foreground font-medium">{templateKeys.length} templates</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {templateKeys.map(key => {
                        const meta = TEMPLATE_META[key] || { icon: FileText, accent: 'var(--app-info)', region: 'Custom', desc: key }
                        const Icon = meta.icon
                        const stats = countAccounts(templates[key])
                        const isActive = activeTemplate === key

                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTemplate(isActive ? null : key)}
                                className="text-left rounded-2xl border transition-all duration-300 overflow-hidden group"
                                style={{
                                    background: isActive
                                        ? `linear-gradient(135deg, ${meta.accent}08, ${meta.accent}15)`
                                        : 'var(--app-surface)',
                                    borderColor: isActive ? `${meta.accent}50` : 'var(--app-border)',
                                    boxShadow: isActive ? `0 0 0 1px ${meta.accent}30, 0 8px 32px ${meta.accent}10` : 'none',
                                }}
                            >
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-4">
                                        <div
                                            className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                                            style={{ background: `${meta.accent}15` }}
                                        >
                                            <Icon size={20} style={{ color: meta.accent }} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isActive && <CheckCircle2 size={18} style={{ color: meta.accent }} />}
                                            <span
                                                className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                                                style={{ background: `${meta.accent}12`, color: meta.accent }}
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
                                                    style={{ background: `${TYPE_COLORS[type] || 'var(--app-surface-2)'}15`, color: TYPE_COLORS[type] || 'var(--app-muted-foreground)' }}
                                                >{ct}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── Active Template Detail View ── */}
            {activeTemplate && templates[activeTemplate] && (
                <div className="rounded-2xl border border-app-border bg-app-surface overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    {/* Detail header */}
                    <div className="p-5 border-b border-app-border flex items-center justify-between"
                        style={{ background: `${(TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)')}06` }}>
                        <div className="flex items-center gap-4">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: `${(TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)')}15` }}
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

                    {/* Type distribution bar */}
                    {(() => {
                        const stats = countAccounts(templates[activeTemplate])
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
                    })()}

                    {/* Tree viewer */}
                    <div className="max-h-[600px] overflow-y-auto custom-scrollbar p-4">
                        <div className="space-y-0.5">
                            {templates[activeTemplate].map((item: Record<string, any>, i: number) => (
                                <TemplateNode key={i} item={item} level={0} accent={TEMPLATE_META[activeTemplate]?.accent || 'var(--app-info)'} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Empty state ── */}
            {!activeTemplate && (
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
        </div>
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
                    background: isRoot ? `${accent}06` : 'transparent',
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
                                    ? 'var(--app-info)12' : 'var(--app-warning)12',
                                color: ['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type)
                                    ? 'var(--app-info)' : 'var(--app-warning)',
                            }}
                        >
                            {['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type) ? 'BS' : 'P&L'}
                        </span>
                        <span
                            className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase"
                            style={{
                                background: `${TYPE_COLORS[item.type] || 'var(--app-surface-2)'}12`,
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