'use client'

import { useState, useEffect, useMemo, useTransition } from "react"
import type { DeferredExpense, FinancialAccount } from '@/types/erp'
import { getDeferredExpenses, createDeferredExpense, recognizeDeferredExpense, DeferredExpenseInput } from "@/app/actions/finance/deferred-expenses"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { useCurrency } from '@/lib/utils/currency'
import { toast } from "sonner"
import {
    Clock, Plus, CheckCircle2, Timer,
    CalendarClock, DollarSign, PlayCircle, LayoutGrid, X
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string; border: string }> = {
    ACTIVE: { icon: PlayCircle, color: 'var(--app-success)', bg: 'var(--app-success-bg)', border: 'var(--app-success)' },
    COMPLETED: { icon: CheckCircle2, color: 'var(--app-info)', bg: 'var(--app-info-bg)', border: 'var(--app-info)' },
}

export default function DeferredExpensesPage() {
    const { fmt } = useCurrency()
    const [expenses, setExpenses] = useState<DeferredExpense[]>([])
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<string>("ALL")
    const [isPending, startTransition] = useTransition()
    const settings = useListViewSettings('fin_deferred_expenses', {
        columns: ['name', 'total_amount', 'progress', 'remaining_amount', 'status', 'actions'],
        pageSize: 25, sortKey: 'name', sortDir: 'asc'
    })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [exp, accs] = await Promise.all([getDeferredExpenses(), getFinancialAccounts()])
            setExpenses(Array.isArray(exp) ? exp : [])
            setAccounts(Array.isArray(accs) ? accs : [])
        } catch {
            setExpenses([]); setAccounts([])
            toast.error("Failed to load deferred expenses")
        } finally {
            setLoading(false)
        }
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const data: DeferredExpenseInput = {
            name: fd.get("name") as string,
            description: fd.get("description") as string,
            category: fd.get("category") as string,
            total_amount: Number(fd.get("total_amount")),
            start_date: fd.get("start_date") as string,
            duration_months: Number(fd.get("duration_months")),
            source_account_id: Number(fd.get("source_account_id")),
        }
        startTransition(async () => {
            try {
                await createDeferredExpense(data)
                setDialogOpen(false)
                toast.success("Deferred expense created successfully")
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to create")
            }
        })
    }

    async function handleRecognize(id: number) {
        const today = new Date().toISOString().split("T")[0]
        startTransition(async () => {
            try {
                await recognizeDeferredExpense(id, today)
                toast.success("Month recognized successfully")
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to recognize")
            }
        })
    }

    const filteredExpenses = useMemo(() => {
        return expenses.filter(e => activeTab === "ALL" || e.status === activeTab)
    }, [expenses, activeTab])

    const stats = useMemo(() => {
        const active = expenses.filter(e => e.status === "ACTIVE").length
        const total = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0)
        const remaining = expenses.reduce((s, e) => s + Number(e.remaining_amount || 0), 0)
        return { active, total, remaining }
    }, [expenses])

    const columns: ColumnDef<any>[] = useMemo(() => [
        {
            key: 'name', label: 'Asset / Expense', sortable: true,
            render: (exp) => (
                <div className="app-page flex flex-col">
                    <span className="font-bold text-sm" style={{ color: 'var(--app-foreground)' }}>{exp.name}</span>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                        {exp.category?.replace(/_/g, " ")}
                    </span>
                </div>
            )
        },
        {
            key: 'total_amount', label: 'Total Commitment', align: 'right', sortable: true,
            render: (exp) => <span className="font-mono text-sm font-bold" style={{ color: 'var(--app-foreground)' }}>{fmt(Number(exp.total_amount))}</span>
        },
        {
            key: 'progress', label: 'Amortization Progress', align: 'center',
            render: (exp) => {
                const progress = exp.duration_months > 0 ? Math.round((exp.months_recognized / exp.duration_months) * 100) : 100
                return (
                    <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--app-surface-2)' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(progress, 100)}%`, background: progress >= 100 ? 'var(--app-info)' : 'var(--app-success)' }} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-tighter" style={{ color: 'var(--app-muted-foreground)' }}>
                            {exp.months_recognized} / {exp.duration_months} Months
                        </span>
                    </div>
                )
            }
        },
        {
            key: 'remaining_amount', label: 'Remaining', align: 'right', sortable: true,
            render: (exp) => <span className="font-mono text-sm font-black" style={{ color: 'var(--app-success)' }}>{fmt(Number(exp.remaining_amount))}</span>
        },
        {
            key: 'status', label: 'Status', align: 'center', sortable: true,
            render: (exp) => {
                const sc = STATUS_CONFIG[exp.status] || STATUS_CONFIG.ACTIVE
                const Icon = sc.icon
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border"
                        style={{ color: sc.color, background: sc.bg, borderColor: sc.border }}>
                        <Icon size={10} /> {exp.status}
                    </span>
                )
            }
        },
        {
            key: 'actions', label: '', align: 'right',
            render: (exp) => (
                exp.status === "ACTIVE" ? (
                    <button onClick={() => handleRecognize(exp.id)} disabled={isPending}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        style={{ color: 'var(--app-success)', background: 'var(--app-success-bg)', border: '1px solid var(--app-success)' }}>
                        Recognize Period →
                    </button>
                ) : null
            )
        }
    ], [fmt, isPending])

    return (
        <div className="app-page min-h-screen p-5 md:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex justify-between items-center gap-4 fade-in-up">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                        style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px var(--app-primary)' }}>
                        <Clock size={26} color="#fff" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter" style={{ color: 'var(--app-foreground)' }}>
                            Deferred <span style={{ color: 'var(--app-primary)' }}>Expenses</span>
                        </h1>
                        <p className="text-sm font-bold uppercase tracking-widest mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            Amortization &amp; Prepaid Management
                        </p>
                    </div>
                </div>
                <button onClick={() => setDialogOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-widest transition-all shadow-lg"
                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 16px var(--app-primary)' }}>
                    <Plus size={16} /> New Schedule
                </button>
            </header>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Active Schedules', value: String(stats.active), sub: 'Currently Amortizing', icon: PlayCircle, color: 'var(--app-success)', bg: 'var(--app-success-bg)' },
                    { label: 'Total Commitment', value: fmt(stats.total), sub: 'Asset Value', icon: DollarSign, color: 'var(--app-primary)', bg: 'var(--app-primary)' },
                    { label: 'Unrecognized Balance', value: fmt(stats.remaining), sub: 'Pending Amortization', icon: Timer, color: 'var(--app-warning)', bg: 'var(--app-warning-bg)' },
                ].map((kpi, i) => (
                    <div key={i} className="app-kpi-card">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform hover:scale-110"
                                style={{ background: kpi.bg }}>
                                <kpi.icon size={28} style={{ color: kpi.color }} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{kpi.label}</p>
                                <p className="text-2xl font-black mt-1 tracking-tighter" style={{ color: 'var(--app-foreground)' }}>{kpi.value}</p>
                                <p className="text-[10px] font-bold uppercase mt-0.5" style={{ color: kpi.color }}>{kpi.sub}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table */}
            <TypicalListView
                title="Amortization Lifecycle"
                data={filteredExpenses}
                loading={loading}
                getRowId={(exp) => exp.id}
                columns={columns}
                className="rounded-2xl overflow-hidden"
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                headerExtra={
                    <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--app-surface-2)' }}>
                        {[
                            { key: "ALL", label: "All", icon: LayoutGrid },
                            { key: "ACTIVE", label: "Running", icon: PlayCircle },
                            { key: "COMPLETED", label: "Closed", icon: CheckCircle2 },
                        ].map(tab => (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all"
                                style={activeTab === tab.key
                                    ? { background: 'var(--app-surface)', color: 'var(--app-foreground)', boxShadow: 'var(--app-shadow-sm)' }
                                    : { color: 'var(--app-muted-foreground)' }}>
                                <tab.icon size={11} /> {tab.label}
                            </button>
                        ))}
                    </div>
                }
            />

            {/* Create Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'var(--app-border)', backdropFilter: 'blur(8px)' }}
                    onClick={(e) => e.target === e.currentTarget && setDialogOpen(false)}>
                    <div className="w-full max-w-lg rounded-3xl p-6 shadow-2xl"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <CalendarClock size={22} style={{ color: 'var(--app-primary)' }} />
                                <div>
                                    <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>Create Amortization Schedule</h2>
                                    <p className="text-xs" style={{ color: 'var(--app-muted-foreground)' }}>Set up a prepaid expense to recognize over time.</p>
                                </div>
                            </div>
                            <button onClick={() => setDialogOpen(false)} style={{ color: 'var(--app-muted-foreground)' }} className="hover:opacity-70 transition-opacity">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
                            {[
                                { label: 'Expense Name', name: 'name', type: 'text', placeholder: 'Annual License', required: true },
                                { label: 'Total Amount', name: 'total_amount', type: 'number', placeholder: '0.00', required: true },
                                { label: 'Activation Date', name: 'start_date', type: 'date', required: true },
                                { label: 'Duration (Months)', name: 'duration_months', type: 'number', placeholder: '12', required: true },
                            ].map(field => (
                                <div key={field.name} className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{field.label}</label>
                                    <input name={field.name} type={field.type} placeholder={field.placeholder} required={field.required}
                                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                </div>
                            ))}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Category</label>
                                <select name="category" required className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    {["SUBSCRIPTION", "RENOVATION", "ADVERTISING", "INSURANCE", "RENT_ADVANCE", "OTHER"].map(c =>
                                        <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                                    )}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Funding Account</label>
                                <select name="source_account_id" required className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="">Select account...</option>
                                    {accounts.map((a: Record<string, any>) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Internal Notes</label>
                                <textarea name="description" rows={2} placeholder="Optional audit notes..."
                                    className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            </div>
                            <div className="col-span-2 flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--app-border)' }}>
                                <button type="button" onClick={() => setDialogOpen(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                                    style={{ color: 'var(--app-muted-foreground)', background: 'var(--app-surface-2)' }}>
                                    Cancel
                                </button>
                                <button type="submit" disabled={isPending}
                                    className="px-5 py-2 rounded-xl text-sm font-black uppercase tracking-widest transition-all"
                                    style={{ background: 'var(--app-primary)', opacity: isPending ? 0.7 : 1 }}>
                                    {isPending ? "Scheduling..." : "Schedule Amortization"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
