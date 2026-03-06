'use client'

import { useState, useEffect, useMemo } from "react"
import { useCurrency } from '@/lib/utils/currency'
import type { ChartOfAccount, JournalEntry } from '@/types/erp'
import { toast } from "sonner"
import { DollarSign, BarChart3, AlertTriangle, Percent, Receipt, RefreshCw } from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { useAdmin } from "@/context/AdminContext"

export default function ExpenseTrackerPage() {
    const { viewScope } = useAdmin()
    const { fmt } = useCurrency()
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
    const [journals, setJournals] = useState<JournalEntry[]>([])
    const [loading, setLoading] = useState(true)
    const settings = useListViewSettings('fin_expenses', {
        columns: ['code', 'name', 'absBalance', 'pct', 'journalCount'],
        pageSize: 25, sortKey: 'absBalance', sortDir: 'desc'
    })

    useEffect(() => { loadData() }, [viewScope])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const [accts, jrnls] = await Promise.all([
                erpFetch('coa/'),
                erpFetch('finance/journal/'),
            ])
            setAccounts((Array.isArray(accts) ? accts : accts.results || []).filter((a: Record<string, any>) => a.type === 'EXPENSE'))
            setJournals(Array.isArray(jrnls) ? jrnls : jrnls.results || [])
        } catch {
            toast.error("Failed to load expense data")
        } finally {
            setLoading(false)
        }
    }

    const enriched = useMemo(() => {
        return accounts.map(a => {
            const entries = journals.filter(j =>
                String(j.account) === String(a.id) || String(j.account_id) === String(a.id) ||
                String(j.credit_account) === String(a.id) || String(j.debit_account) === String(a.id)
            )
            const bal = Math.abs(parseFloat(String(a.balance || 0)))
            return { ...a, journalCount: entries.length, absBalance: bal }
        }).sort((a, b) => b.absBalance - a.absBalance)
    }, [accounts, journals])

    const totalExpense = enriched.reduce((s, a) => s + a.absBalance, 0)
    const topAccount = enriched[0]
    const accountsWithActivity = enriched.filter(a => a.journalCount > 0).length
    const top3Pct = enriched.length >= 3
        ? ((enriched[0].absBalance + enriched[1].absBalance + enriched[2].absBalance) / totalExpense * 100)
        : 100

    const kpis = [
        {
            label: 'Total Expenses', value: fmt(totalExpense), sub: `${accounts.length} accounts tracked`,
            icon: DollarSign, accent: 'var(--app-error)', accentBg: 'var(--app-error)',
        },
        {
            label: 'Expense Accounts', value: String(accounts.length), sub: `${accountsWithActivity} with activity`,
            icon: BarChart3, accent: 'var(--app-info)', accentBg: 'var(--app-info)',
        },
        {
            label: 'Top Account', value: topAccount?.name || '—', sub: topAccount ? fmt(topAccount.absBalance) : 'No data',
            icon: AlertTriangle, accent: 'var(--app-warning)', accentBg: 'var(--app-warning)',
        },
        {
            label: 'Top 3 Concentration', value: `${top3Pct.toFixed(0)}%`, sub: 'of total spend',
            icon: Percent, accent: 'var(--app-primary)', accentBg: 'var(--app-primary)/10',
        },
    ]

    const columns: ColumnDef<any>[] = useMemo(() => [
        { key: 'code', label: 'Code', sortable: true, render: (a) => <span className="font-mono text-xs theme-text-muted">{a.code}</span> },
        { key: 'name', label: 'Account Name', sortable: true, render: (a) => <span className="font-semibold text-sm theme-text">{a.name}</span> },
        {
            key: 'absBalance', label: 'Balance', align: 'right', sortable: true,
            render: (a) => <span className="font-bold" style={{ color: 'var(--app-error)' }}>{fmt(a.absBalance)}</span>
        },
        {
            key: 'pct', label: '% of Expenses', align: 'right',
            render: (a) => {
                const pct = totalExpense > 0 ? (a.absBalance / totalExpense * 100) : 0
                return (
                    <div className="app-page flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--theme-surface-hover)' }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--app-error)' }} />
                        </div>
                        <span className="text-xs theme-text-muted w-10 text-right font-mono">{pct.toFixed(1)}%</span>
                    </div>
                )
            }
        },
        { key: 'journalCount', label: 'Journal Entries', align: 'right', sortable: true },
    ], [fmt, totalExpense])

    return (
        <div className="app-page min-h-screen layout-container-padding space-y-[var(--layout-section-spacing)] max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex items-center justify-between gap-4 fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 layout-card-radius flex items-center justify-center shrink-0 bg-app-error/10 border border-app-error/20">
                        <Receipt size={32} className="text-app-error" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest theme-text-muted">Finance</p>
                        <h1 className="text-4xl font-black tracking-tight theme-text italic">
                            Expense <span className="text-app-error">Accounts</span>
                        </h1>
                    </div>
                </div>
                <button onClick={loadData} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 layout-card-radius text-sm font-bold theme-surface border theme-border theme-text-muted transition-all" style={{
                        background: 'var(--theme-surface)',
                        borderColor: 'var(--theme-border)'
                    }}>
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
            </header>

            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[var(--layout-element-gap)]">
                {kpis.map((kpi, i) => (
                    <div key={i} className="layout-card layout-card-radius border-0 shadow-sm theme-surface">
                        <div className="flex items-center gap-4 layout-card-padding">
                            <div className="w-12 h-12 layout-card-radius flex items-center justify-center shrink-0"
                                style={{ background: kpi.accentBg + "18", border: "1px solid " + kpi.accentBg + "30" }}>
                                <kpi.icon size={22} style={{ color: kpi.accent }} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-widest theme-text-muted">{kpi.label}</p>
                                <p className="text-xl font-black tracking-tight truncate mt-0.5 theme-text">{kpi.value}</p>
                                <p className="text-[10px] font-bold mt-0.5 truncate theme-text-muted">{kpi.sub}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Distribution Chart */}
            <div className="layout-card layout-card-radius border-0 shadow-sm theme-surface layout-card-padding">
                <h2 className="text-sm font-black uppercase tracking-widest mb-5 theme-text-muted">
                    Expense Distribution — Top 8 Accounts
                </h2>
                <div className="space-y-[var(--layout-element-gap)]">
                    {enriched.filter(a => a.absBalance > 0).slice(0, 8).map((a: Record<string, any>) => {
                        const pct = totalExpense > 0 ? (a.absBalance / totalExpense * 100) : 0
                        return (
                            <div key={a.id} className="flex items-center gap-4">
                                <div className="w-16 font-mono text-[10px] font-bold uppercase truncate theme-text-muted">{a.code}</div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-end mb-1.5">
                                        <span className="text-xs font-semibold theme-text-muted">{a.name}</span>
                                        <span className="text-xs font-bold theme-text">{fmt(a.absBalance)}</span>
                                    </div>
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--theme-surface-hover)' }}>
                                        <div className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${pct}%`, background: 'linear-gradient(to right, var(--app-error), color-mix(in srgb, var(--app-error) 60%, transparent))' }} />
                                    </div>
                                </div>
                                <div className="w-12 text-right">
                                    <span className="text-[10px] font-black px-1.5 py-0.5 layout-card-radius theme-text-muted" style={{ background: 'var(--theme-surface-hover)' }}>
                                        {pct.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        )
                    })}
                    {enriched.filter(a => a.absBalance > 0).length === 0 && (
                        <p className="text-center py-8 text-sm theme-text-muted">No expense accounts with balances yet.</p>
                    )}
                </div>
            </div>

            {/* Table */}
            <TypicalListView
                title="Account Details"
                data={enriched}
                loading={loading}
                getRowId={(item) => item.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                className="layout-card-radius border-0 shadow-sm overflow-hidden theme-surface"
            />
        </div>
    )
}
