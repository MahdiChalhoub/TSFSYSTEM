'use client'
import { useState } from 'react'
import { ChevronRight, ChevronDown, CheckCircle2, LayoutGrid, Columns, Undo2, Library, Zap, FileText, ShieldCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { importChartOfAccountsTemplate } from '@/app/actions/finance/coa-templates'
import { applySmartPostingRules } from '@/app/actions/finance/posting-rules'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
export default function CoaTemplatesLibrary({ templates, currentAccounts = [] }: { templates: Record<string, any>, currentAccounts?: any[] }) {
    const [selectedTemplates, setSelectedTemplates] = useState<string[]>([])
    const [isPending, setIsPending] = useState(false)
    const router = useRouter()
    const toggleTemplate = (key: string) => {
        if (selectedTemplates.includes(key)) {
            setSelectedTemplates(selectedTemplates.filter(k => k !== key))
        } else {
            setSelectedTemplates([...selectedTemplates, key])
        }
    }

    // Determine if the current COA has data (balances or sub-accounts)
    const hasBalances = currentAccounts.some(a => Math.abs(a.balance ?? 0) > 0.0001)
    const hasSubAccounts = currentAccounts.some(a => a.parentId || a.parent_id || a.parent)
    const hasData = hasBalances || hasSubAccounts
    const coaIsEmpty = currentAccounts.length === 0

    const [importTarget, setImportTarget] = useState<{ key: string; step: 'confirm' | 'reset' | 'has-data' } | null>(null)
    const handleImport = async (key: string) => {
        if (hasData) {
            // COA has data — show warning and redirect to migration tool
            setImportTarget({ key, step: 'has-data' })
        } else {
            // COA is empty or has no data — clean import directly
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
            // Auto-apply smart posting rules after clean import
            // (safe because old accounts are gone after reset)
            try { await applySmartPostingRules() } catch { /* non-critical */ }
            toast.success(`Successfully imported ${key.replace('_', ' ')} — Posting rules auto-configured.`)
            router.push('/finance/settings/posting-rules')
        } catch (e: unknown) {
            toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsPending(false)
        }
    }
    return (
        <div className="min-h-screen bg-app-background pb-20">
            {/* Header */}
            <div className="bg-app-surface border-b border-app-border sticky top-0 z-30">
                <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-app-surface-2 rounded-full transition-colors">
                            <Undo2 size={20} className="text-app-muted-foreground" />
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-app-foreground font-serif">Accounting Standards Library</h1>
                            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Compare and select your operational layout</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-app-surface-2 p-1 rounded-lg flex gap-1">
                            <button className="p-2 bg-app-surface shadow-sm rounded-md text-app-foreground">
                                <Columns size={18} />
                            </button>
                            <button disabled className="p-2 text-app-muted-foreground hover:text-app-muted-foreground">
                                <LayoutGrid size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {/* Financial Logic Guide */}
            <div className="max-w-[1600px] mx-auto px-8 py-6">
                <div className="bg-app-success rounded-3xl p-6 text-app-foreground flex flex-wrap items-center gap-8 shadow-lg">
                    <div className="flex items-center gap-3 border-r border-app-success/30 pr-8">
                        <ShieldCheck className="text-app-primary" size={32} />
                        <div>
                            <h4 className="font-bold text-sm">Financial Integrity Guide</h4>
                            <p className="text-[10px] text-app-success uppercase tracking-widest">How your reports are calculated</p>
                        </div>
                    </div>
                    <div className="flex gap-6">
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-app-primary uppercase">Balance Sheet [BS]</span>
                            <div className="flex items-center gap-2 text-xs font-medium">
                                <span className="p-1 bg-app-success rounded">Assets</span>
                                <span>=</span>
                                <span className="p-1 bg-app-success rounded">Liabilities</span>
                                <span>+</span>
                                <span className="p-1 bg-app-success rounded">Equity</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[10px] font-bold text-app-warning uppercase">Profit & Loss [P&L]</span>
                            <div className="flex items-center gap-2 text-xs font-medium">
                                <span className="p-1 bg-app-warning rounded">Revenue</span>
                                <span>-</span>
                                <span className="p-1 bg-app-warning rounded">Expenses</span>
                                <span>=</span>
                                <span className="p-1 bg-app-warning/50 border border-app-warning/30 rounded text-amber-200 italic font-bold">Net Profit</span>
                            </div>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-4 text-[10px] text-app-success font-bold uppercase tracking-widest bg-app-success/10 px-4 py-2 rounded-full">
                        <span className="flex items-center gap-1"><CheckCircle2 size={12} /> Auto-Rollup Logic</span>
                        <span className="opacity-30">|</span>
                        <span className="flex items-center gap-1"><FileText size={12} /> Double Entry (GAAP/IFRS)</span>
                    </div>
                </div>
            </div>
            <div className="max-w-[1600px] mx-auto p-8 pt-0">
                {/* Selection Bar */}
                <div className="flex gap-4 mb-8 overflow-x-auto pb-4 no-scrollbar">
                    {Object.keys(templates).map(key => (
                        <button
                            key={key}
                            onClick={() => toggleTemplate(key)}
                            className={`flex-shrink-0 px-6 py-3 rounded-2xl border transition-all flex items-center gap-3 ${selectedTemplates.includes(key)
                                ? 'bg-app-surface border-app-border text-app-foreground shadow-xl shadow-stone-200'
                                : 'bg-app-surface border-app-border text-app-muted-foreground hover:border-app-border'
                                }`}
                        >
                            {selectedTemplates.includes(key) ? <CheckCircle2 size={16} className="text-app-primary" /> : <Library size={16} />}
                            <span className="font-bold text-sm whitespace-nowrap">{key.replace('_', ' ')}</span>
                        </button>
                    ))}
                </div>
                {selectedTemplates.length === 0 ? (
                    <div className="h-[60vh] flex flex-col items-center justify-center text-app-muted-foreground">
                        <Library size={64} className="mb-4 opacity-20" />
                        <h2 className="text-xl font-medium">Select standards to compare</h2>
                        <p className="text-sm">Choose one or more templates from the library above.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in slide-in-from-bottom-4 duration-500">
                        {selectedTemplates.map(key => (
                            <div key={key} className="bg-app-surface rounded-3xl border border-app-border shadow-sm flex flex-col overflow-hidden">
                                <div className="p-6 border-b border-app-border flex justify-between items-start bg-app-surface/50">
                                    <div>
                                        <h3 className="font-bold text-app-foreground text-lg">{key.replace('_', ' ')}</h3>
                                        <p className="text-[10px] font-bold text-app-muted-foreground uppercase mt-1 tracking-tight">Official Standard Structure</p>
                                    </div>
                                    <button
                                        disabled={isPending}
                                        onClick={() => handleImport(key)}
                                        className="bg-app-primary text-app-foreground px-4 py-2 rounded-xl text-xs font-bold hover:bg-app-success transition-all flex items-center gap-2 shadow-sm"
                                    >
                                        <Zap size={14} /> Import
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 max-h-[600px] custom-scrollbar">
                                    <div className="space-y-1">
                                        {templates[key].map((item: Record<string, any>, i: number) => (
                                            <TemplateComparisonNode key={i} item={item} />
                                        ))}
                                    </div>
                                </div>
                                <div className="p-4 bg-app-background border-t border-app-border text-center">
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        Total Root Classes: {templates[key].length}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* Dialog 1: COA has data — redirect to migration */}
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
            {/* Dialog 2: COA is empty — confirm import */}
            <ConfirmDialog
                open={importTarget?.step === 'confirm'}
                onOpenChange={(open) => { if (!open) setImportTarget(null) }}
                onConfirm={() => handleConfirmImport(true)}
                title={`Import ${importTarget?.key?.replace('_', ' ') ?? ''}?`}
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
function TemplateComparisonNode({ item, level = 0 }: Record<string, any>) {
    const [open, setOpen] = useState(level < 1) // Open top level by default
    const hasChildren = item.children && item.children.length > 0
    return (
        <div className="flex flex-col">
            <button
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-2 py-1.5 hover:bg-app-background rounded px-2 transition-colors group ${level === 0 ? 'bg-app-surface/80 mb-1' : ''}`}
                style={{ paddingLeft: `${level === 0 ? 8 : level * 16 + 8}px` }}
            >
                <div className="w-4 flex justify-center">
                    {hasChildren && (
                        open ? <ChevronDown size={12} className="text-app-muted-foreground" /> : <ChevronRight size={12} className="text-app-muted-foreground" />
                    )}
                </div>
                <span className={`text-[10px] font-mono font-bold w-12 text-left ${level === 0 ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>
                    {item.code}
                </span>
                <span className={`text-xs text-left flex-1 truncate ${level === 0 ? 'font-bold text-app-foreground' : 'font-medium text-app-muted-foreground'}`}>
                    {item.name}
                </span>
                {/* Report Mapping Badge */}
                {item.type && (
                    <div className="flex items-center gap-1.5 mr-2">
                        {['ASSET', 'LIABILITY', 'EQUITY'].includes(item.type) ? (
                            <span className="text-[8px] font-black bg-app-info-bg text-app-info px-1 rounded" title="Goes to Balance Sheet">[BS]</span>
                        ) : (
                            <span className="text-[8px] font-black bg-app-warning-bg text-app-warning px-1 rounded" title="Goes to Profit & Loss">[P&L]</span>
                        )}
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${item.type === 'ASSET' ? 'bg-app-info-bg text-app-info border border-app-info/30' :
                            item.type === 'LIABILITY' ? 'bg-app-error-bg text-app-error border border-app-error/30' :
                                item.type === 'EQUITY' ? 'bg-app-surface-2 text-app-muted-foreground' :
                                    item.type === 'INCOME' ? 'bg-app-primary-light text-app-primary border border-app-success/30' :
                                        'bg-app-warning-bg text-app-warning border border-app-warning/30'
                            }`}>
                            {item.type}
                        </span>
                    </div>
                )}
            </button>
            {hasChildren && open && (
                <div className="flex flex-col">
                    {item.children.map((child: Record<string, any>, i: number) => (
                        <TemplateComparisonNode key={i} item={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    )
}