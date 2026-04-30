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
import '@/lib/tours/definitions/finance-chart-of-accounts'

import { KPIStrip } from './_components/KPIStrip'
import { AccountNode } from './_components/AccountNode'
import { AccountForm } from './_components/AccountForm'
import { RecalculateBalancesDialog } from './_components/RecalculateBalancesDialog'

export function ChartOfAccountsViewer({ accounts }: {
    accounts: Record<string, any>[]
}) {
    const router = useRouter()
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

    // KPI stats
    const stats = useMemo(() => {
        const active = accounts.filter(a => a.isActive)
        const byType = (t: string) => active.filter(a => a.type === t)
        return [
            { label: 'Total Accounts', value: active.length, color: 'var(--app-primary)', icon: <BookOpen size={14} />, filterKey: null },
            { label: 'Assets', value: byType('ASSET').length, color: 'var(--app-info)', icon: <BookOpen size={14} />, filterKey: 'ASSET' },
            { label: 'Liabilities', value: byType('LIABILITY').length, color: 'var(--app-error)', icon: <BookOpen size={14} />, filterKey: 'LIABILITY' },
            { label: 'Equity', value: byType('EQUITY').length, color: 'var(--app-info)', icon: <BookOpen size={14} />, filterKey: 'EQUITY' },
            { label: 'Income', value: byType('INCOME').length, color: 'var(--app-success)', icon: <BookOpen size={14} />, filterKey: 'INCOME' },
            { label: 'Expenses', value: byType('EXPENSE').length, color: 'var(--app-warning)', icon: <BookOpen size={14} />, filterKey: 'EXPENSE' },
        ]
    }, [accounts])

    // Filter + build tree
    const tree = useMemo(() => {
        let filtered = showInactive ? accounts : accounts.filter(a => a.isActive)
        if (typeFilter) filtered = filtered.filter(a => a.type === typeFilter)
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
            if (a.parentId && map[a.parentId]) map[a.parentId].children.push(map[a.id])
            else if (!a.parentId) roots.push(map[a.id])
        })
        return roots
    }, [accounts, showInactive, searchQuery, typeFilter])

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
                router.refresh(); toast.success('Account created.')
            } catch (e: any) { toast.error(e.message || 'Error') }
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
                setEditingAccount(null); router.refresh(); toast.success('Account updated.')
            } catch (e: any) { toast.error(e.message || 'Error') }
        })
    }

    const handleConfirmAction = () => {
        if (!pendingAction) return
        startTransition(async () => {
            if (pendingAction.type === 'reactivate' && pendingAction.id) {
                const { reactivateChartOfAccount } = await import('@/app/actions/finance/accounts')
                try { await reactivateChartOfAccount(pendingAction.id); router.refresh() }
                catch (e: any) { toast.error(e.message || 'Error') }
            } else if (pendingAction.type === 'recalculate') {
                await recalculateAccountBalances()
                router.refresh(); toast.success('Balances recalculated.')
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
                            <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">Chart of Accounts</h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">{accounts.length} Accounts</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button data-tour="posting-rules-btn" onClick={() => router.push('/finance/settings/posting-rules?from=coa')} className="toolbar-btn text-app-success border-app-success/30 bg-app-success/10"><Settings2 size={13} /> Posting Rules</button>
                        <button data-tour="migration-btn" onClick={() => router.push('/finance/chart-of-accounts/migrate?from=coa')} className="toolbar-btn text-app-warning border-app-warning/30 bg-app-warning/10"><Zap size={13} /> Migration</button>
                        <button data-tour="templates-btn" onClick={() => router.push('/finance/chart-of-accounts/templates?from=coa')} className="toolbar-btn text-app-muted-foreground"><Library size={13} /> Templates</button>
                        <button data-tour="audit-btn" onClick={() => setRecalcOpen(true)} className="toolbar-btn text-app-muted-foreground"><RefreshCcw size={13} /> Audit</button>
                        <button data-tour="add-account-btn" onClick={() => setIsAdding(true)} className="toolbar-btn-primary"><Plus size={14} /> New Account</button>
                        <PageTour tourId="finance-chart-of-accounts" />
                        <button onClick={() => setFocusMode(p => !p)} className="p-1.5 rounded-xl border border-app-border text-app-muted-foreground">{focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
                    </div>
                </div>
            )}

            {!focusMode && <KPIStrip stats={stats} typeFilter={typeFilter} setTypeFilter={setTypeFilter} />}

            <div data-tour="search-bar" className="flex items-center gap-2 mb-3 flex-shrink-0 px-4 md:px-6">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                    <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-app-border bg-app-surface/50 outline-none" />
                </div>
                <button onClick={() => setShowInactive(p => !p)} className={`toolbar-btn ${showInactive ? 'text-app-warning border-app-warning/30 bg-app-warning/10' : 'text-app-muted-foreground'}`}>{showInactive ? <Eye size={13} /> : <EyeOff size={13} />} <span className="hidden sm:inline">Inactive</span></button>
            </div>

            {isAdding && (
                <div className="animate-in slide-in-from-top-2 duration-200 mb-3 mx-4 md:mx-6 p-4 border border-app-border bg-app-primary/5 rounded-2xl border-l-[3px] border-l-app-primary">
                    <AccountForm accounts={accounts} isPending={isPending} onSubmit={handleCreate} preselectedParentId={preselectedParentId} onCancel={() => setIsAdding(false)} />
                </div>
            )}

            <div data-tour="account-tree" className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col mx-4 md:mx-6 mb-2 border border-app-border bg-app-surface/30">
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 border-b border-app-border/50 text-tp-xs font-bold uppercase tracking-wider text-app-muted-foreground bg-app-surface/60">
                    <div className="w-5 flex-shrink-0" /><div className="w-7 flex-shrink-0" /><div className="flex-1">Account</div><div className="w-36 hidden lg:block text-app-success">SYSCOHADA</div><div className="w-24 hidden sm:block">Type</div><div className="w-28 text-right">Balance</div><div className="w-16 flex-shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain">
                    {tree.map(node => <AccountNode key={node.id} node={node} level={0} accounts={accounts} onEdit={setEditingAccount} onAddChild={(id) => { setPreselectedParentId(id); setIsAdding(true) }} onReactivate={(id) => setPendingAction({ type: 'reactivate', title: 'Reactivate?', description: 'Restore account.', variant: 'warning', id })} />)}
                </div>
                <div className="flex-shrink-0 flex items-center justify-between px-4 md:px-6 py-2 text-tp-sm font-bold border-t border-app-border/50 bg-app-surface/70 text-app-muted-foreground">
                    <div>{footerStats.totalActive} active · {footerStats.withBalance} with balance</div>
                    <div className="font-bold text-app-foreground">Net: {footerStats.totalBalance.toLocaleString('en', { minimumFractionDigits: 2 })}</div>
                </div>
            </div>

            {editingAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={e => e.target === e.currentTarget && setEditingAccount(null)}>
                    <div className="w-full max-w-xl mx-4 rounded-2xl overflow-hidden bg-app-surface border border-app-border p-5 shadow-2xl animate-in zoom-in-95 duration-200">
                        <AccountForm accounts={accounts} isPending={isPending} onSubmit={handleUpdate} initialData={editingAccount} onCancel={() => setEditingAccount(null)} title="Edit Account" />
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
                        toast.success('Balances recalculated.')
                    } catch (e: any) {
                        toast.error(e?.message || 'Recalculate failed — closed periods protect themselves; nothing changed.')
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
