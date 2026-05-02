'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    BookOpen, Plus, Wallet, TrendingDown, TrendingUp, BarChart3, Scale,
    Eye, EyeOff, RefreshCcw, Settings2, Library, FileText,
    Pencil, Power, Copy, Eye as EyeIcon, X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { reactivateChartOfAccount } from '@/app/actions/finance/accounts'
import { MobileMasterPage } from '@/components/mobile/MobileMasterPage'
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet'
import { MobileActionSheet } from '@/components/mobile/MobileActionSheet'
import { MobileAccountRow } from './MobileAccountRow'
import { MobileAccountDetailSheet } from './MobileAccountDetailSheet'
import { PageTour } from '@/components/ui/PageTour'
import '@/lib/tours/definitions/finance-chart-of-accounts-mobile'
import { RecalculateBalancesDialog } from '../_components/RecalculateBalancesDialog'
import { useBranchScope } from '@/context/BranchContext'

// Loose COA-account shape — backend sends a denormalized DRF tree.
type COAAccount = {
    id: number;
    name?: string;
    code?: string;
    syscohadaCode?: string;
    type?: string;
    isActive?: boolean;
    parentId?: number | null;
    parent?: number | null;
    [key: string]: unknown;
};
type COATreeNode = COAAccount & { children: COATreeNode[] };

export function MobileCOAClient({ accounts, orgCurrencies = [] }: {
    accounts: COAAccount[]
    /** Forwarded from the page → COAGateway → here. Currently unused on
     *  mobile (account create/edit happens on the desktop form), but
     *  accepted so the prop signature lines up between desktop + mobile. */
    orgCurrencies?: Record<string, any>[]
}) {
    void orgCurrencies // reserved for future mobile create/edit form
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [sheetNode, setSheetNode] = useState<COATreeNode | COAAccount | null>(null)
    const [actionNode, setActionNode] = useState<COATreeNode | COAAccount | null>(null)
    const [showInactive, setShowInactive] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string | null>(null)
    const [scopeFilter, setScopeFilter] = useState<null | 'tenant_wide' | 'branch_split' | 'branch_located'>(null)
    const [recalcOpen, setRecalcOpen] = useState(false)
    const { branchId } = useBranchScope()
    const isBranchScoped = branchId != null
    /** Dismissable session-scoped banner state — same key as the desktop. */
    const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false
        return sessionStorage.getItem('coa.branch_banner_dismissed') === '1'
    })
    const dismissBanner = () => {
        setBannerDismissed(true)
        try { sessionStorage.setItem('coa.branch_banner_dismissed', '1') } catch { /* private mode */ }
    }

    // Mirror of backend ChartOfAccount.scope_mode (matches MobileAccountRow / desktop).
    const deriveScope = (a: any): 'tenant_wide' | 'branch_split' | 'branch_located' => {
        const role = String(a.system_role || '').toUpperCase()
        if (['INVENTORY','INVENTORY_ASSET','WIP'].includes(role)) return 'branch_located'
        if (['REVENUE','REVENUE_CONTROL','COGS','COGS_CONTROL','EXPENSE','DISCOUNT_GIVEN','DISCOUNT_RECEIVED','FX_GAIN','FX_LOSS','DEPRECIATION_EXP','BAD_DEBT','DELIVERY_FEES','VAT_INPUT','VAT_OUTPUT','GRNI'].includes(role)) return 'branch_split'
        const sysco = String(a.syscohadaCode || a.syscohada_code || '')
        if (sysco) {
            if (sysco[0] === '3') return 'branch_located'
            if (sysco[0] === '6' || sysco[0] === '7') return 'branch_split'
        }
        const code = String(a.code || '')
        if (a.type === 'ASSET' && /^3\d/.test(code)) return 'branch_located'
        const name = String(a.name || '').toLowerCase()
        if (a.type === 'ASSET' && /\b(stock|inventory|inventaire|marchandise|matiere|matière|wip)\b/.test(name)) return 'branch_located'
        if (a.type === 'INCOME' || a.type === 'EXPENSE') return 'branch_split'
        return 'tenant_wide'
    }
    const scopeOf = (a: any) => (a.scope_mode as string) || deriveScope(a)

    const stats = useMemo(() => {
        const byType = (t: string) => accounts.filter((a) => a.type === t)
        const active = accounts.filter((a) => a.isActive !== false)
        return {
            total: accounts.length,
            active: active.length,
            inactive: accounts.length - active.length,
            byType: {
                ASSET: byType('ASSET').length,
                LIABILITY: byType('LIABILITY').length,
                EQUITY: byType('EQUITY').length,
                INCOME: byType('INCOME').length,
                EXPENSE: byType('EXPENSE').length,
            },
        }
    }, [accounts])

    const openSheet = useCallback((n: COATreeNode | COAAccount) => setSheetNode(n), [])
    const openActionMenu = useCallback((n: COATreeNode | COAAccount) => setActionNode(n), [])

    const handleEdit = useCallback((n: COATreeNode | COAAccount) => {
        router.push(`/finance/chart-of-accounts/${n.id}?edit=1`)
    }, [router])

    const handleAddChild = useCallback((parentId: number) => {
        router.push(`/finance/chart-of-accounts?add=1&parent=${parentId}`)
    }, [router])

    const handleReactivate = useCallback((n: COATreeNode | COAAccount) => {
        startTransition(async () => {
            try {
                await reactivateChartOfAccount(n.id)
                toast.success(`"${n.name}" reactivated`)
                router.refresh()
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : null
                toast.error(msg || 'Failed to reactivate')
            }
        })
    }, [router])

    // Open the structured warning dialog instead of running the recalc silently.
    // The dialog explains that closed periods are protected and that the action
    // is global (journal-wide). Mobile users now see the same safeguards as desktop.
    const handleRecalc = useCallback((_n: COATreeNode | COAAccount) => {
        setRecalcOpen(true)
        setActionNode(null)   // dismiss the per-account action sheet behind the dialog
    }, [])

    const runRecalc = useCallback(async () => {
        try {
            await recalculateAccountBalances()
            setRecalcOpen(false)
            toast.success('Balances recalculated')
            router.refresh()
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : null
            toast.error(msg || 'Recalc failed — closed periods protect themselves; nothing changed.')
        }
    }, [router])

    const actionItems = useMemo(() => {
        if (!actionNode) return []
        const isInactive = actionNode.isActive === false
        return [
            { key: 'view', label: 'Details', hint: 'Info & balance', icon: <EyeIcon size={16} />, variant: 'grid' as const, onClick: () => openSheet(actionNode) },
            { key: 'statement', label: 'Statement', hint: 'Full page', icon: <BookOpen size={16} />, variant: 'grid' as const, onClick: () => router.push(`/finance/chart-of-accounts/${actionNode.id}`) },
            { key: 'add', label: 'Add sub', hint: 'Create child', icon: <Plus size={16} />, variant: 'grid' as const, onClick: () => handleAddChild(actionNode.id) },
            { key: 'recalc', label: 'Recalc', hint: 'Balances', icon: <RefreshCcw size={16} />, variant: 'grid' as const, onClick: () => handleRecalc(actionNode) },
            { key: 'edit', label: 'Edit', icon: <Pencil size={16} />, onClick: () => handleEdit(actionNode) },
            ...(isInactive
                ? [{ key: 'reactivate', label: 'Reactivate', icon: <Power size={16} />, onClick: () => handleReactivate(actionNode) }]
                : []),
            { key: 'copy', label: 'Copy code', hint: actionNode.code, icon: <Copy size={16} />, onClick: () => {
                try {
                    navigator.clipboard?.writeText(String(actionNode.code ?? ''))
                    toast.success('Code copied')
                } catch { toast.error('Copy failed') }
            } },
        ]
    }, [actionNode, openSheet, handleAddChild, handleRecalc, handleEdit, handleReactivate, router])

    // Build tree with filters
    const tree = useMemo(() => {
        let filtered = showInactive ? accounts : accounts.filter((a) => a.isActive !== false)
        if (typeFilter) filtered = filtered.filter((a) => a.type === typeFilter)
        if (scopeFilter) filtered = filtered.filter((a: any) => scopeOf(a) === scopeFilter)

        const map: Record<string, COATreeNode> = {}
        filtered.forEach(a => { map[a.id] = { ...a, children: [] } })
        const roots: COATreeNode[] = []
        filtered.forEach(a => {
            const pid = a.parentId ?? a.parent
            // Orphan-promote: keep matching rows visible even when parent
            // got filtered out (otherwise the count chip would lie).
            if (pid && map[pid]) map[pid].children.push(map[a.id])
            else roots.push(map[a.id])
        })
        return roots
        // eslint-disable-next-line react-hooks/exhaustive-deps -- scopeOf is stable
    }, [accounts, showInactive, typeFilter, scopeFilter])

    const scopeCounts = useMemo(() => {
        const active = accounts.filter((a) => a.isActive !== false)
        return {
            all: active.length,
            tenant_wide: active.filter((a: any) => scopeOf(a) === 'tenant_wide').length,
            branch_split: active.filter((a: any) => scopeOf(a) === 'branch_split').length,
            branch_located: active.filter((a: any) => scopeOf(a) === 'branch_located').length,
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accounts])

    return (
        <MobileMasterPage
            config={{
                title: 'Chart of Accounts',
                subtitle: `${stats.total} accounts · ${stats.active} active`,
                icon: <BookOpen size={20} />,
                iconColor: 'var(--app-primary)',
                tourId: 'finance-chart-of-accounts-mobile',
                searchPlaceholder: 'Search by code, name, SYSCOHADA…',
                primaryAction: {
                    label: 'New Account',
                    icon: <Plus size={16} strokeWidth={2.6} />,
                    onClick: () => router.push('/finance/chart-of-accounts?add=1'),
                },
                secondaryActions: [
                    { label: 'Templates', icon: <Library size={14} />, href: '/finance/chart-of-accounts/templates' },
                    { label: 'Posting Rules', icon: <Settings2 size={14} />, href: '/finance/settings/posting-rules' },
                    { label: 'Migration Tool', icon: <FileText size={14} />, href: '/finance/chart-of-accounts/migrate' },
                    {
                        label: showInactive ? 'Hide Inactive' : 'Show Inactive',
                        icon: showInactive ? <EyeOff size={14} /> : <Eye size={14} />,
                        onClick: () => setShowInactive(s => !s),
                    },
                ],
                kpis: [
                    { label: 'Total', value: stats.total, icon: <Library size={13} />, color: 'var(--app-primary)' },
                    { label: 'Assets', value: stats.byType.ASSET, icon: <Wallet size={13} />, color: 'var(--app-info, #3B82F6)' },
                    { label: 'Liabilities', value: stats.byType.LIABILITY, icon: <TrendingDown size={13} />, color: 'var(--app-error, #EF4444)' },
                    { label: 'Equity', value: stats.byType.EQUITY, icon: <Scale size={13} />, color: 'var(--app-info)' },
                    { label: 'Income', value: stats.byType.INCOME, icon: <TrendingUp size={13} />, color: 'var(--app-success, #10B981)' },
                    { label: 'Expenses', value: stats.byType.EXPENSE, icon: <BarChart3 size={13} />, color: 'var(--app-warning, #F59E0B)' },
                ],
                footerLeft: (
                    <>
                        <span>{stats.total} accounts</span>
                        <span style={{ color: 'var(--app-border)' }}>·</span>
                        <span>{stats.active} active</span>
                        {stats.inactive > 0 && (
                            <>
                                <span style={{ color: 'var(--app-border)' }}>·</span>
                                <span style={{ color: 'var(--app-muted-foreground)' }}>{stats.inactive} inactive</span>
                            </>
                        )}
                    </>
                ),
                onRefresh: async () => {
                    router.refresh()
                    await new Promise(r => setTimeout(r, 600))
                },
            }}
            modals={
                <>
                    <MobileActionSheet
                        open={actionNode !== null}
                        onClose={() => setActionNode(null)}
                        title={actionNode?.name}
                        subtitle={actionNode ? `${actionNode.code} · Long-press menu` : undefined}
                        items={actionItems}
                    />
                    <PageTour tourId="finance-chart-of-accounts-mobile" renderButton={false} />
                    <RecalculateBalancesDialog
                        open={recalcOpen}
                        onOpenChange={setRecalcOpen}
                        onConfirm={runRecalc}
                    />
                </>
            }
            sheet={
                <MobileBottomSheet
                    open={sheetNode !== null}
                    onClose={() => setSheetNode(null)}
                    initialSnap="peek">
                    {sheetNode && (
                        <MobileAccountDetailSheet
                            node={sheetNode}
                            onEdit={(n) => { setSheetNode(null); handleEdit(n) }}
                            onAddChild={(pid) => { setSheetNode(null); handleAddChild(pid) }}
                            onReactivate={(n) => { setSheetNode(null); handleReactivate(n) }}
                            onRecalc={(n) => handleRecalc(n)}
                            onClose={() => setSheetNode(null)}
                        />
                    )}
                </MobileBottomSheet>
            }>
            {({ searchQuery, expandAll, expandKey }) => {
                const q = searchQuery.trim().toLowerCase()
                const treeFiltered = q
                    ? (() => {
                        const filtered = accounts.filter((a) => {
                            if (!showInactive && a.isActive === false) return false
                            if (typeFilter && a.type !== typeFilter) return false
                            return a.name?.toLowerCase().includes(q)
                                || a.code?.toLowerCase().includes(q)
                                || a.syscohadaCode?.toLowerCase().includes(q)
                        })
                        const map: Record<string, COATreeNode> = {}
                        filtered.forEach(a => { map[a.id] = { ...a, children: [] } })
                        const roots: COATreeNode[] = []
                        filtered.forEach(a => {
                            const pid = a.parentId ?? a.parent
                            if (pid && map[pid]) map[pid].children.push(map[a.id])
                            else if (!pid) roots.push(map[a.id])
                        })
                        return roots
                    })()
                    : tree

                if (treeFiltered.length === 0) {
                    return (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <BookOpen size={40} className="text-app-muted-foreground mb-3 opacity-40" />
                            <p className="font-bold text-app-muted-foreground mb-1"
                                style={{ fontSize: 'var(--tp-lg)' }}>
                                {q ? 'No matching accounts' : 'No accounts yet'}
                            </p>
                            <p className="text-app-muted-foreground mb-5 max-w-xs"
                                style={{ fontSize: 'var(--tp-md)' }}>
                                {q ? 'Try a different search term.' : 'Tap + to create a new account.'}
                            </p>
                        </div>
                    )
                }

                return (
                    <>
                        {/* Branch-scope banner — compact, dismissable. */}
                        {isBranchScoped && !bannerDismissed && (
                            <div className="mb-2 rounded-lg px-2 py-1 flex items-center gap-2"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 22%, transparent)',
                                }}>
                                <span style={{ fontSize: 11, lineHeight: 1 }}>⚠️</span>
                                <span className="flex-1 truncate"
                                    style={{ fontSize: 'var(--tp-xxs)', color: 'var(--app-foreground)' }}>
                                    <strong className="font-bold">Branch active</strong>
                                    <span className="text-app-muted-foreground"> — chip per row</span>
                                </span>
                                <button onClick={dismissBanner}
                                    title="Dismiss"
                                    aria-label="Dismiss"
                                    className="flex items-center justify-center rounded-md flex-shrink-0 active:scale-90 transition-transform"
                                    style={{
                                        width: 20, height: 20,
                                        color: 'var(--app-muted-foreground)',
                                    }}>
                                    <X size={12} />
                                </button>
                            </div>
                        )}

                        {/* Scope-filter chip rail — tenant / split / located. */}
                        <div data-tour="scope-filter-rail" className="flex gap-1.5 overflow-x-auto mb-2 pb-1" style={{ scrollbarWidth: 'none' }}>
                            {([
                                { key: null,             label: 'All',      count: scopeCounts.all,            color: 'var(--app-primary)',          emoji: null },
                                { key: 'tenant_wide',    label: 'Tenant',   count: scopeCounts.tenant_wide,    color: 'var(--app-foreground)',       emoji: '🌐' },
                                { key: 'branch_split',   label: 'Split',    count: scopeCounts.branch_split,   color: 'var(--app-info, #3b82f6)',    emoji: '🏢' },
                                { key: 'branch_located', label: 'Located',  count: scopeCounts.branch_located, color: 'var(--app-warning, #f59e0b)', emoji: '📦' },
                            ] as const).map(f => {
                                const active = scopeFilter === f.key
                                return (
                                    <button
                                        key={f.label}
                                        onClick={() => setScopeFilter(active ? null : (f.key as any))}
                                        className="flex-shrink-0 inline-flex items-center gap-1 font-bold uppercase tracking-wide rounded-full px-3 py-1.5 active:scale-95 transition-transform"
                                        style={{
                                            fontSize: 'var(--tp-xxs)',
                                            background: active
                                                ? `color-mix(in srgb, ${f.color} 14%, transparent)`
                                                : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                            color: active ? f.color : 'var(--app-muted-foreground)',
                                            border: `1px solid ${active ? `color-mix(in srgb, ${f.color} 40%, transparent)` : 'color-mix(in srgb, var(--app-border) 45%, transparent)'}`,
                                        }}>
                                        {f.emoji && <span style={{ fontSize: 12, lineHeight: 1 }}>{f.emoji}</span>}
                                        <span>{f.label}</span>
                                        <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.85 }}>{f.count}</span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Type-filter chip rail */}
                        <div className="flex gap-1.5 overflow-x-auto mb-2 pb-1" style={{ scrollbarWidth: 'none' }}>
                            {[
                                { key: null, label: 'All', color: 'var(--app-primary)' },
                                { key: 'ASSET', label: 'Assets', color: 'var(--app-info, #3B82F6)' },
                                { key: 'LIABILITY', label: 'Liabilities', color: 'var(--app-error, #EF4444)' },
                                { key: 'EQUITY', label: 'Equity', color: 'var(--app-info)' },
                                { key: 'INCOME', label: 'Income', color: 'var(--app-success, #10B981)' },
                                { key: 'EXPENSE', label: 'Expenses', color: 'var(--app-warning, #F59E0B)' },
                            ].map(f => {
                                const active = typeFilter === f.key
                                return (
                                    <button
                                        key={f.label}
                                        onClick={() => setTypeFilter(active ? null : f.key)}
                                        className="flex-shrink-0 font-bold uppercase tracking-wide rounded-full px-3 py-1.5 active:scale-95 transition-transform"
                                        style={{
                                            fontSize: 'var(--tp-xxs)',
                                            background: active
                                                ? `color-mix(in srgb, ${f.color} 18%, transparent)`
                                                : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                                            color: active ? f.color : 'var(--app-muted-foreground)',
                                            border: `1px solid ${active ? `color-mix(in srgb, ${f.color} 40%, transparent)` : 'color-mix(in srgb, var(--app-border) 45%, transparent)'}`,
                                        }}>
                                        {f.label}
                                    </button>
                                )
                            })}
                        </div>

                        {treeFiltered.map((node) => (
                            <MobileAccountRow
                                key={`${node.id}-${expandKey}`}
                                node={node}
                                level={0}
                                searchQuery={searchQuery}
                                forceExpanded={expandAll}
                                selected={sheetNode?.id === node.id}
                                onOpenSheet={openSheet}
                                onEdit={handleEdit}
                                onLongPress={openActionMenu}
                                onReactivate={handleReactivate}
                            />
                        ))}
                    </>
                )
            }}
        </MobileMasterPage>
    )
}
