'use client'

import { useState, useMemo, useCallback, useTransition } from 'react'
import {
    BookOpen, Plus, Wallet, TrendingDown, TrendingUp, BarChart3, Scale,
    Eye, EyeOff, RefreshCcw, Settings2, Library, FileText,
    Pencil, Power, Copy, Eye as EyeIcon,
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

export function MobileCOAClient({ accounts }: { accounts: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [sheetNode, setSheetNode] = useState<any | null>(null)
    const [actionNode, setActionNode] = useState<any | null>(null)
    const [showInactive, setShowInactive] = useState(false)
    const [typeFilter, setTypeFilter] = useState<string | null>(null)

    const stats = useMemo(() => {
        const byType = (t: string) => accounts.filter((a: any) => a.type === t)
        const active = accounts.filter((a: any) => a.isActive !== false)
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

    const openSheet = useCallback((n: any) => setSheetNode(n), [])
    const openActionMenu = useCallback((n: any) => setActionNode(n), [])

    const handleEdit = useCallback((n: any) => {
        router.push(`/finance/chart-of-accounts/${n.id}?edit=1`)
    }, [router])

    const handleAddChild = useCallback((parentId: number) => {
        router.push(`/finance/chart-of-accounts?add=1&parent=${parentId}`)
    }, [router])

    const handleReactivate = useCallback((n: any) => {
        startTransition(async () => {
            try {
                await reactivateChartOfAccount(n.id)
                toast.success(`"${n.name}" reactivated`)
                router.refresh()
            } catch (e: any) {
                toast.error(e?.message || 'Failed to reactivate')
            }
        })
    }, [router])

    const handleRecalc = useCallback((_n: any) => {
        // recalculateAccountBalances is a global (journal-wide) op
        startTransition(async () => {
            try {
                await recalculateAccountBalances()
                toast.success('Balances recalculated')
                router.refresh()
            } catch (e: any) {
                toast.error(e?.message || 'Recalc failed')
            }
        })
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
                    navigator.clipboard?.writeText(actionNode.code)
                    toast.success('Code copied')
                } catch { toast.error('Copy failed') }
            } },
        ] as any
    }, [actionNode, openSheet, handleAddChild, handleRecalc, handleEdit, handleReactivate, router])

    // Build tree with filters
    const tree = useMemo(() => {
        let filtered = showInactive ? accounts : accounts.filter((a: any) => a.isActive !== false)
        if (typeFilter) filtered = filtered.filter((a: any) => a.type === typeFilter)

        const map: Record<string, any> = {}
        filtered.forEach(a => { map[a.id] = { ...a, children: [] } })
        const roots: any[] = []
        filtered.forEach(a => {
            const pid = a.parentId ?? a.parent
            if (pid && map[pid]) map[pid].children.push(map[a.id])
            else if (!pid) roots.push(map[a.id])
        })
        return roots
    }, [accounts, showInactive, typeFilter])

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
                    { label: 'Equity', value: stats.byType.EQUITY, icon: <Scale size={13} />, color: '#8b5cf6' },
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
                        const filtered = accounts.filter((a: any) => {
                            if (!showInactive && a.isActive === false) return false
                            if (typeFilter && a.type !== typeFilter) return false
                            return a.name?.toLowerCase().includes(q)
                                || a.code?.toLowerCase().includes(q)
                                || a.syscohadaCode?.toLowerCase().includes(q)
                        })
                        const map: Record<string, any> = {}
                        filtered.forEach(a => { map[a.id] = { ...a, children: [] } })
                        const roots: any[] = []
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
                        {/* Type-filter chip rail */}
                        <div className="flex gap-1.5 overflow-x-auto mb-2 pb-1" style={{ scrollbarWidth: 'none' }}>
                            {[
                                { key: null, label: 'All', color: 'var(--app-primary)' },
                                { key: 'ASSET', label: 'Assets', color: 'var(--app-info, #3B82F6)' },
                                { key: 'LIABILITY', label: 'Liabilities', color: 'var(--app-error, #EF4444)' },
                                { key: 'EQUITY', label: 'Equity', color: '#8b5cf6' },
                                { key: 'INCOME', label: 'Income', color: 'var(--app-success, #10B981)' },
                                { key: 'EXPENSE', label: 'Expenses', color: 'var(--app-warning, #F59E0B)' },
                            ].map(f => {
                                const active = typeFilter === f.key
                                return (
                                    <button
                                        key={f.label}
                                        onClick={() => setTypeFilter(active ? null : f.key)}
                                        className="flex-shrink-0 font-black uppercase tracking-widest rounded-full px-3 py-1.5 active:scale-95 transition-transform"
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

                        {treeFiltered.map((node: any) => (
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
