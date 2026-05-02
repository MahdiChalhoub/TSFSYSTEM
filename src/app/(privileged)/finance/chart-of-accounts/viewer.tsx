'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import {
    Plus, RefreshCcw, Library, Zap, Eye, EyeOff, X,
    Search, BookOpen, Settings2, Maximize2, Minimize2, Pencil
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { toast } from 'sonner'
import { runTimed } from '@/lib/perf-timing'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { PageTour } from '@/components/ui/PageTour'
import { useTranslation } from '@/hooks/use-translation'
import '@/lib/tours/definitions/finance-chart-of-accounts'

import { KPIStrip } from './_components/KPIStrip'
import { AccountNode } from './_components/AccountNode'
import { AccountForm } from './_components/AccountForm'
import { RecalculateBalancesDialog } from './_components/RecalculateBalancesDialog'
import { useBranchScope } from '@/context/BranchContext'

export function ChartOfAccountsViewer({ accounts }: {
    accounts: Record<string, any>[]
}) {
    const router = useRouter()
    const { t } = useTranslation()
    const { branchId } = useBranchScope()
    const isBranchScoped = branchId != null
    const [isPending, startTransition] = useTransition()
    const [searchQuery, setSearchQuery] = useState('')
    const [showInactive, setShowInactive] = useState(false)
    const [focusMode, setFocusMode] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [preselectedParentId, setPreselectedParentId] = useState<number | undefined>(undefined)
    const [editingAccount, setEditingAccount] = useState<Record<string, any> | null>(null)
    const [pendingAction, setPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'; id?: number } | null>(null)
    const [recalcOpen, setRecalcOpen] = useState(false)
    /** Scope filter — narrows the tree to one of the three scope_mode buckets.
     *  null = show everything. Set by the chip row directly under the KPIs. */
    const [scopeFilter, setScopeFilter] = useState<null | 'tenant_wide' | 'branch_split' | 'branch_located'>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    // Keyboard shortcuts
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
            // Escape exits focus mode — universal "back out" key, no
            // browser conflict (the previous Ctrl+Q is captured by the
            // browser as "quit" on many systems and never reached here).
            // Guard against the search input handling its own escape.
            if (e.key === 'Escape') {
                const target = e.target as HTMLElement | null
                const inEditable = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
                if (!inEditable) {
                    setFocusMode(prev => prev ? false : prev)
                }
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // KPI stats
    const stats = useMemo(() => {
        const active = accounts.filter(a => a.isActive)
        const byType = (type: string) => active.filter(a => a.type === type)
        return [
            { label: t('finance.coa.kpi_total'),       value: active.length,                color: 'var(--app-primary)', icon: <BookOpen size={14} />, filterKey: null },
            { label: t('finance.coa.kpi_assets'),      value: byType('ASSET').length,       color: 'var(--app-info)',    icon: <BookOpen size={14} />, filterKey: 'ASSET' },
            { label: t('finance.coa.kpi_liabilities'), value: byType('LIABILITY').length,   color: 'var(--app-error)',   icon: <BookOpen size={14} />, filterKey: 'LIABILITY' },
            { label: t('finance.coa.kpi_equity'),      value: byType('EQUITY').length,      color: 'var(--app-info)',    icon: <BookOpen size={14} />, filterKey: 'EQUITY' },
            { label: t('finance.coa.kpi_income'),      value: byType('INCOME').length,      color: 'var(--app-success)', icon: <BookOpen size={14} />, filterKey: 'INCOME' },
            { label: t('finance.coa.kpi_expenses'),    value: byType('EXPENSE').length,     color: 'var(--app-warning)', icon: <BookOpen size={14} />, filterKey: 'EXPENSE' },
        ]
        // eslint-disable-next-line react-hooks/exhaustive-deps -- locale change forces full reload
    }, [accounts])

    // Mirror of the backend ChartOfAccount.scope_mode property + the
    // AccountNode fallback — keep all three in lockstep.
    const deriveScope = (a: Record<string, any>): 'tenant_wide' | 'branch_split' | 'branch_located' => {
        const role = String(a.system_role || '').toUpperCase()
        if (role === 'INVENTORY' || role === 'INVENTORY_ASSET' || role === 'WIP') return 'branch_located'
        if (['AR_CONTROL','AP_CONTROL','CASH_ACCOUNT','BANK_ACCOUNT','TAX_PAYABLE','TAX_RECEIVABLE',
             'RETAINED_EARNINGS','P_L_SUMMARY','OPENING_BALANCE_OFFSET','RECEIVABLE','PAYABLE',
             'CAPITAL','WITHDRAWAL','LOAN','WITHHOLDING','ACCUM_DEPRECIATION'].includes(role)) {
            return 'tenant_wide'
        }
        if (['REVENUE','REVENUE_CONTROL','COGS','COGS_CONTROL','EXPENSE','DISCOUNT_GIVEN',
             'DISCOUNT_RECEIVED','FX_GAIN','FX_LOSS','DEPRECIATION_EXP','BAD_DEBT',
             'DELIVERY_FEES','VAT_INPUT','VAT_OUTPUT','GRNI'].includes(role)) {
            return 'branch_split'
        }
        // SYSCOHADA / code patterns (class 3 = stocks → branch-located).
        const syscoCode = String(a.syscohadaCode || a.syscohada_code || '')
        if (syscoCode) {
            const first = syscoCode[0]
            if (first === '3') return 'branch_located'
            if (first === '6' || first === '7') return 'branch_split'
        }
        const code = String(a.code || '')
        if (a.type === 'ASSET' && /^3\d/.test(code)) return 'branch_located'
        // Name keyword sniff for inventory-shaped accounts without role/code.
        const name = String(a.name || '').toLowerCase()
        if (a.type === 'ASSET' && /\b(stock|inventory|inventaire|marchandise|matiere|matière|wip|work[-\s]in[-\s]progress|en[-\s]cours)\b/.test(name)) {
            return 'branch_located'
        }
        if (a.type === 'INCOME' || a.type === 'EXPENSE') return 'branch_split'
        if (a.type === 'LIABILITY' || a.type === 'EQUITY') return 'tenant_wide'
        return 'tenant_wide'
    }
    const scopeOf = (a: Record<string, any>) => (a.scope_mode as string) || deriveScope(a)

    // Counts for the scope-filter chips — recomputed when accounts change.
    const scopeCounts = useMemo(() => {
        const active = accounts.filter(a => a.isActive)
        return {
            all: active.length,
            tenant_wide: active.filter(a => scopeOf(a) === 'tenant_wide').length,
            branch_split: active.filter(a => scopeOf(a) === 'branch_split').length,
            branch_located: active.filter(a => scopeOf(a) === 'branch_located').length,
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accounts])

    // Filter + build tree
    const tree = useMemo(() => {
        let filtered = showInactive ? accounts : accounts.filter(a => a.isActive)
        if (typeFilter) filtered = filtered.filter(a => a.type === typeFilter)
        if (scopeFilter) filtered = filtered.filter(a => scopeOf(a) === scopeFilter)
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(a =>
                a.name.toLowerCase().includes(q) ||
                a.code.toLowerCase().includes(q) ||
                (a.syscohadaCode?.toLowerCase().includes(q))
            )
        }
        const map: Record<string, any> = {}
        filtered.forEach(a => { map[a.id] = { ...a, children: [] } })
        const roots: Record<string, any>[] = []
        filtered.forEach(a => {
            // Attach to parent IF the parent survived the filter; otherwise
            // promote to root so the row remains visible. Without this,
            // applying a filter (e.g., "Branch-located") would silently
            // drop every child whose parent didn't match — the count chip
            // would say 13 but the tree would show 0.
            if (a.parentId && map[a.parentId]) {
                map[a.parentId].children.push(map[a.id])
            } else {
                roots.push(map[a.id])
            }
        })
        return roots
    }, [accounts, showInactive, searchQuery, typeFilter, scopeFilter])

    // Handlers
    async function handleCreate(formData: FormData) {
        const data = {
            code: formData.get('code') as string,
            name: formData.get('name') as string,
            type: formData.get('type') as string,
            subType: formData.get('subType') as string,
            parentId: formData.get('parentId') ? parseInt(formData.get('parentId') as string) : undefined,
            syscohadaCode: formData.get('syscohadaCode') as string,
            isInternal: formData.get('isInternal') === 'on',
            currency: (formData.get('currency') as string) || undefined,
            revaluationRequired: formData.get('revaluationRequired') === 'on',
            monetaryClassification: (formData.get('monetaryClassification') as 'MONETARY' | 'NON_MONETARY' | 'INCOME_EXPENSE') || undefined,
        }
        startTransition(async () => {
            const { createAccount } = await import('@/app/actions/finance/accounts')
            try {
                await runTimed('finance.coa:create-account', () => createAccount(data))
                setIsAdding(false); setPreselectedParentId(undefined)
                router.refresh(); toast.success(t('finance.coa.toast_created'))
            } catch (e: any) { toast.error(e.message || t('finance.coa.error')) }
        })
    }

    async function handleUpdate(formData: FormData) {
        if (!editingAccount) return
        const data = {
            code: formData.get('code') as string,
            name: formData.get('name') as string,
            type: formData.get('type') as string,
            subType: formData.get('subType') as string,
            parentId: formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null,
            syscohadaCode: formData.get('syscohadaCode') as string,
            isActive: true,
            isInternal: formData.get('isInternal') === 'on',
            currency: (formData.get('currency') as string) || undefined,
            revaluationRequired: formData.get('revaluationRequired') === 'on',
            monetaryClassification: (formData.get('monetaryClassification') as 'MONETARY' | 'NON_MONETARY' | 'INCOME_EXPENSE') || undefined,
        }
        startTransition(async () => {
            const { updateChartOfAccount } = await import('@/app/actions/finance/accounts')
            try {
                await runTimed(
                    'finance.coa:update-account',
                    () => updateChartOfAccount(editingAccount.id, data),
                )
                setEditingAccount(null); router.refresh(); toast.success(t('finance.coa.toast_updated'))
            } catch (e: any) { toast.error(e.message || t('finance.coa.error')) }
        })
    }

    const handleConfirmAction = () => {
        if (!pendingAction) return
        startTransition(async () => {
            if (pendingAction.type === 'reactivate' && pendingAction.id) {
                const { reactivateChartOfAccount } = await import('@/app/actions/finance/accounts')
                try { await reactivateChartOfAccount(pendingAction.id); router.refresh() }
                catch (e: any) { toast.error(e.message || t('finance.coa.error')) }
            } else if (pendingAction.type === 'recalculate') {
                await recalculateAccountBalances()
                router.refresh(); toast.success(t('finance.coa.toast_recalculated'))
            }
        })
        setPendingAction(null)
    }

    const footerStats = useMemo(() => {
        const active = accounts.filter(a => a.isActive)
        return {
            totalBalance: active.reduce((s, a) => s + (Number(a.balance) || 0), 0),
            withBalance: active.filter(a => Number(a.balance) !== 0).length,
            totalActive: active.length
        }
    }, [accounts])

    return (
        <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 6rem)' }}>
            {!focusMode && (
                <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary">
                            <BookOpen size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">{t('finance.coa.title')}</h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">{accounts.length} {t('finance.coa.accounts')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button data-tour="posting-rules-btn" onClick={() => router.push('/finance/settings/posting-rules?from=coa')} className="toolbar-btn text-app-success border-app-success/30 bg-app-success/10"><Settings2 size={13} /> {t('finance.coa.nav_posting_rules')}</button>
                        <button data-tour="migration-btn" onClick={() => router.push('/finance/chart-of-accounts/migrate?from=coa')} className="toolbar-btn text-app-warning border-app-warning/30 bg-app-warning/10"><Zap size={13} /> {t('finance.coa.nav_migration')}</button>
                        <button data-tour="templates-btn" onClick={() => router.push('/finance/chart-of-accounts/templates?from=coa')} className="toolbar-btn text-app-muted-foreground"><Library size={13} /> {t('finance.coa.nav_templates')}</button>
                        <button data-tour="audit-btn" onClick={() => setRecalcOpen(true)} className="toolbar-btn text-app-muted-foreground"><RefreshCcw size={13} /> {t('finance.coa.nav_audit')}</button>
                        <button data-tour="add-account-btn" onClick={() => setIsAdding(true)} className="toolbar-btn-primary"><Plus size={14} /> {t('finance.coa.new_account')}</button>
                        <PageTour tourId="finance-chart-of-accounts" />
                        <button onClick={() => setFocusMode(p => !p)} className="p-1.5 rounded-xl border border-app-border text-app-muted-foreground">{focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
                    </div>
                </div>
            )}

            {/* Branch-scope explainer banner — surfaces only when a branch
                is selected, so users understand which balances filter and
                which don't. Avoids the silent-bug class where AR/AP/Equity
                look unchanged and the user wonders if the filter broke. */}
            {!focusMode && isBranchScoped && (
                <div className="mx-4 md:mx-6 mb-3 rounded-xl px-3 py-2 flex items-start gap-2"
                    style={{
                        background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)',
                    }}>
                    <span className="text-[14px] flex-shrink-0 mt-0.5">⚠️</span>
                    <div className="text-tp-xs leading-snug" style={{ color: 'var(--app-foreground)' }}>
                        <strong className="font-bold">Branch filter active.</strong>{' '}
                        Some balances change with branch (Revenue, COGS, Expense, Inventory)
                        — others stay tenant-wide on purpose (AR, AP, Bank, Equity).
                        Each row shows a chip indicating its scope behavior.
                    </div>
                </div>
            )}

            {!focusMode && <KPIStrip stats={stats} typeFilter={typeFilter} setTypeFilter={setTypeFilter} />}

            {/* Search row + inline scope filter chips. Chips share the row
                with the search input so the toolbar stays one line.
                Focus mode keeps the row but the chips are hidden — ditto
                the inactive button — so the page is maximally compact. */}
            <div data-tour="search-bar" className="flex items-center gap-2 mb-3 flex-shrink-0 px-4 md:px-6 flex-wrap">
                <div className="flex-1 relative min-w-[200px]">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('finance.coa.search_placeholder')} className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-app-border bg-app-surface/50 outline-none" />
                </div>

                {/* Scope filter chips — same line as search. Visible in
                    focus mode too, since filtering is the whole point of
                    focus mode (you want to drill into a subset). */}
                {([
                    { key: null,             label: 'All',      count: scopeCounts.all,            color: 'var(--app-muted-foreground)', emoji: null },
                    { key: 'tenant_wide',    label: 'Tenant',   count: scopeCounts.tenant_wide,    color: 'var(--app-muted-foreground)', emoji: '🌐' },
                    { key: 'branch_split',   label: 'Split',    count: scopeCounts.branch_split,   color: 'var(--app-info, #3b82f6)',    emoji: '🏢' },
                    { key: 'branch_located', label: 'Located',  count: scopeCounts.branch_located, color: 'var(--app-warning, #f59e0b)', emoji: '📦' },
                ] as const).map(chip => {
                    const active = scopeFilter === chip.key
                    return (
                        <button
                            key={chip.key ?? 'all'}
                            onClick={() => setScopeFilter(chip.key as any)}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-tp-xs font-bold transition-all flex-shrink-0"
                            style={{
                                background: active ? `color-mix(in srgb, ${chip.color} 12%, transparent)` : 'transparent',
                                border: `1px solid ${active
                                    ? `color-mix(in srgb, ${chip.color} 35%, transparent)`
                                    : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                color: active ? chip.color : 'var(--app-muted-foreground)',
                            }}
                            title={
                                chip.key === 'tenant_wide' ? 'Tenant-wide — Balances do NOT change with branch filter (AR/AP/Bank/Equity).'
                                : chip.key === 'branch_split' ? 'Branch-split — Balances filter to the selected branch (Revenue/Expense/COGS).'
                                : chip.key === 'branch_located' ? 'Branch-located — Balances reflect only the selected branch (Inventory/WIP).'
                                : 'Show every account regardless of scope behavior.'
                            }
                        >
                            {chip.emoji && <span className="leading-none">{chip.emoji}</span>}
                            <span>{chip.label}</span>
                            <span className="text-tp-xxs font-bold tabular-nums px-1 rounded"
                                style={{
                                    background: active
                                        ? `color-mix(in srgb, ${chip.color} 18%, transparent)`
                                        : 'color-mix(in srgb, var(--app-border) 35%, transparent)',
                                }}>
                                {chip.count}
                            </span>
                        </button>
                    )
                })}

                <button onClick={() => setShowInactive(p => !p)} className={`toolbar-btn ${showInactive ? 'text-app-warning border-app-warning/30 bg-app-warning/10' : 'text-app-muted-foreground'}`}>
                    {showInactive ? <Eye size={13} /> : <EyeOff size={13} />} <span className="hidden sm:inline">{t('finance.coa.inactive')}</span>
                </button>

                {/* Exit-focus-mode button — icon-only. Tooltip names the
                    shortcut (Esc) so the user can discover it on hover. */}
                {focusMode && (
                    <button
                        onClick={() => setFocusMode(false)}
                        title="Exit focus mode (Esc)"
                        className="flex items-center justify-center w-8 h-8 rounded-lg transition-all flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 35%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                        <Minimize2 size={13} />
                    </button>
                )}
            </div>

            {isAdding && (
                <div className="animate-in slide-in-from-top-2 duration-200 mb-3 mx-4 md:mx-6 p-4 border border-app-border bg-app-primary/5 rounded-2xl border-l-[3px] border-l-app-primary">
                    <AccountForm accounts={accounts} isPending={isPending} onSubmit={handleCreate} preselectedParentId={preselectedParentId} onCancel={() => setIsAdding(false)} />
                </div>
            )}

            <div data-tour="account-tree" className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col mx-4 md:mx-6 mb-2 border border-app-border bg-app-surface/30">
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 border-b border-app-border/50 text-tp-xs font-bold uppercase tracking-wider text-app-muted-foreground bg-app-surface/60">
                    <div className="w-5 flex-shrink-0" /><div className="w-7 flex-shrink-0" /><div className="flex-1">{t('finance.coa.col_account')}</div><div className="w-36 hidden lg:block text-app-success">{t('finance.coa.col_syscohada')}</div><div className="w-24 hidden sm:block">{t('finance.coa.col_type')}</div><div className="w-24 hidden md:block text-center" title="Branch-scope behavior — Tenant-wide (AR/AP/Equity) · Branch-split (Revenue/Expense/COGS) · Branch-located (Inventory/WIP)">SCOPE</div><div className="w-28 text-right">{t('finance.coa.col_balance')}</div><div className="w-16 flex-shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {tree.map(node => <AccountNode key={node.id} node={node} level={0} accounts={accounts} onEdit={setEditingAccount} onAddChild={(id) => { setPreselectedParentId(id); setIsAdding(true) }} onReactivate={(id) => setPendingAction({ type: 'reactivate', title: t('finance.coa.confirm_reactivate_title'), description: t('finance.coa.confirm_reactivate_desc'), variant: 'warning', id })} />)}
                </div>
                <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-tp-sm font-bold border-t border-app-border/50 bg-app-surface/70 text-app-muted-foreground">
                    <div>{footerStats.totalActive} {t('finance.coa.active')} · {footerStats.withBalance} {t('finance.coa.with_balance')}</div>
                    <div className="font-bold text-app-foreground">{t('finance.coa.net')}: {footerStats.totalBalance.toLocaleString('en', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            {editingAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={e => e.target === e.currentTarget && setEditingAccount(null)}>
                    <div className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden bg-app-surface border border-app-border p-5 shadow-2xl animate-in zoom-in-95 duration-200">
                        <AccountForm accounts={accounts} isPending={isPending} onSubmit={handleUpdate} initialData={editingAccount} onCancel={() => setEditingAccount(null)} title={t('finance.coa.edit_account')} />
                    </div>
                </div>
            )}
            <ConfirmDialog open={!!pendingAction} onOpenChange={(o) => { if (!o) setPendingAction(null) }} title={pendingAction?.title || ''} description={pendingAction?.description || ''} onConfirm={handleConfirmAction} variant={pendingAction?.variant || 'info'} />
            <RecalculateBalancesDialog
                open={recalcOpen}
                onOpenChange={setRecalcOpen}
                onConfirm={async () => {
                    try {
                        await recalculateAccountBalances()
                        setRecalcOpen(false)
                        router.refresh()
                        toast.success(t('finance.coa.toast_recalculated'))
                    } catch (e: any) {
                        toast.error(e?.message || t('finance.coa.toast_recalc_failed'))
                    }
                }}
            />
            <style jsx>{`
                .toolbar-btn { display: flex; items-center: centerbox; gap: 0.375rem; font-size: 0.6875rem; font-weight: 700; border: 1px solid var(--app-border); padding: 0.375rem 0.625rem; border-radius: 0.75rem; transition: all 0.2s; }
                .toolbar-btn:hover { background: var(--app-surface); color: var(--app-foreground); }
                .toolbar-btn-primary { display: flex; items-center: centerbox; gap: 0.375rem; font-size: 0.6875rem; font-weight: 700; padding: 0.375rem 0.75rem; border-radius: 0.75rem; background: var(--app-primary); color: #fff; box-shadow: 0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent); transition: all 0.2s; }
                .toolbar-btn-primary:hover { transform: translateY(-1px); filter: brightness(1.1); }
            `}</style>
        </div>
    )
}
