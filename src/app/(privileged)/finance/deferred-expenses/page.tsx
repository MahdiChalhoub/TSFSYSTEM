'use client'

import { useState, useEffect, useMemo, useTransition } from "react"
import type { DeferredExpense, FinancialAccount } from '@/types/erp'
import { getDeferredExpenses, createDeferredExpense, recognizeDeferredExpense, DeferredExpenseInput } from "@/app/actions/finance/deferred-expenses"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { useCurrency } from '@/lib/utils/currency'
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Clock, Plus, Search, CheckCircle2, Receipt, Timer,
    CalendarClock, DollarSign, PlayCircle, Filter, ChevronRight, LayoutGrid
} from "lucide-react"
import { TypicalListView, ColumnDef } from "@/components/common/TypicalListView"
import { useListViewSettings } from '@/hooks/useListViewSettings'

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
    ACTIVE: { icon: PlayCircle, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    COMPLETED: { icon: CheckCircle2, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
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
            key: 'name',
            label: 'Asset / Expense',
            sortable: true,
            render: (exp) => (
                <div className="flex flex-col">
                    <span className="font-bold text-gray-900 text-sm">{exp.name}</span>
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{exp.category?.replace(/_/g, " ")}</span>
                </div>
            )
        },
        {
            key: 'total_amount',
            label: 'Total Commitment',
            align: 'right',
            sortable: true,
            render: (exp) => <span className="font-mono text-sm font-bold text-stone-900">{fmt(Number(exp.total_amount))}</span>
        },
        {
            key: 'progress',
            label: 'Amortization Progress',
            align: 'center',
            render: (exp) => {
                const progress = exp.duration_months > 0 ? Math.round((exp.months_recognized / exp.duration_months) * 100) : 100
                return (
                    <div className="flex flex-col items-center gap-1.5 min-w-[120px]">
                        <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden shadow-inner">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? "bg-blue-500" : "bg-emerald-500"}`}
                                style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                        </div>
                        <span className="text-[9px] font-black text-stone-400 uppercase tracking-tighter">
                            {exp.months_recognized} / {exp.duration_months} Months Recognized
                        </span>
                    </div>
                )
            }
        },
        {
            key: 'remaining_amount',
            label: 'Remaining',
            align: 'right',
            sortable: true,
            render: (exp) => <span className="font-mono text-sm font-black text-emerald-600">{fmt(Number(exp.remaining_amount))}</span>
        },
        {
            key: 'status',
            label: 'Status',
            align: 'center',
            sortable: true,
            render: (exp) => {
                const sc = STATUS_CONFIG[exp.status] || STATUS_CONFIG.ACTIVE
                const Icon = sc.icon
                return (
                    <Badge className={`${sc.bg} ${sc.color} border-none shadow-none text-[10px] font-black uppercase px-2 h-5 rounded-lg flex items-center gap-1`}>
                        <Icon size={10} /> {exp.status}
                    </Badge>
                )
            }
        },
        {
            key: 'actions',
            label: '',
            align: 'right',
            render: (exp) => (
                exp.status === "ACTIVE" ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRecognize(exp.id)}
                        disabled={isPending}
                        className="rounded-xl h-8 px-3 text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all group"
                    >
                        Recognize Period <ChevronRight size={12} className="ml-1 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                ) : null
            )
        }
    ], [fmt, isPending])

    if (loading) {
        return (
            <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-64" /><Skeleton className="h-4 w-48 mt-2" /></div>
                    <Skeleton className="h-10 w-44" />
                </div>
                <div className="grid grid-cols-3 gap-6">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-3xl" />)}</div>
                <Skeleton className="h-96 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Standard Header */}
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="page-header-title  tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Clock size={28} className="text-white" />
                        </div>
                        Deferred <span className="text-indigo-600">Expenses</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Amortization & Prepaid Management</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]">
                            <Plus size={18} /> New Expense Account
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg rounded-3xl border-0 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
                                <CalendarClock size={24} className="text-indigo-600" />
                                Create Amortization Schedule
                            </DialogTitle>
                            <DialogDescription className="text-stone-400 font-medium tracking-tight">Set up a prepaid expense to be recognized over time.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-5 pt-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Expense Name</label>
                                <Input name="name" required placeholder="Annual License" className="rounded-xl bg-stone-50 border-stone-100 focus:bg-white transition-all" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Category</label>
                                <select name="category" required className="w-full h-10 px-3 border border-stone-100 rounded-xl bg-stone-50 text-sm focus:bg-white transition-all outline-none">
                                    {["SUBSCRIPTION", "RENOVATION", "ADVERTISING", "INSURANCE", "RENT_ADVANCE", "OTHER"].map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Total Amount</label>
                                <Input name="total_amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className="rounded-xl bg-stone-50 border-stone-100" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Duration (Months)</label>
                                <Input name="duration_months" type="number" min="1" max="120" required placeholder="12" className="rounded-xl bg-stone-50 border-stone-100" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Activation Date</label>
                                <Input name="start_date" type="date" required className="rounded-xl bg-stone-50 border-stone-100" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Funding Account</label>
                                <select name="source_account_id" required className="w-full h-10 px-3 border border-stone-100 rounded-xl bg-stone-50 text-sm focus:bg-white transition-all outline-none">
                                    <option value="">Select account...</option>
                                    {accounts.map((a: Record<string, any>) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Internal Notes</label>
                                <textarea name="description" rows={2} className="w-full px-3 py-2 border border-stone-100 rounded-xl bg-stone-50 text-sm resize-none focus:bg-white transition-all outline-none" placeholder="Optional audit notes..." />
                            </div>
                            <div className="col-span-2 flex justify-end gap-3 pt-6 border-t border-stone-50">
                                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-black text-[10px] uppercase">Cancel</Button>
                                <Button type="submit" disabled={isPending} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase h-10 px-6 px-6">
                                    {isPending ? "Configuring..." : "Schedule Amortization"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </header>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <PlayCircle size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Active Schedules</p>
                            <p className="text-3xl font-black mt-1 tracking-tighter text-stone-900">{stats.active}</p>
                            <p className="text-[10px] text-emerald-600 font-bold uppercase mt-1">Currently Amortizing</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <DollarSign size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Total Commitment</p>
                            <p className="text-3xl font-black mt-1 tracking-tighter text-stone-900">{fmt(stats.total)}</p>
                            <p className="text-[10px] text-indigo-600 font-bold uppercase mt-1">Asset Value</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-sm bg-white overflow-hidden group">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-16 h-16 rounded-[1.5rem] bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Timer size={32} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Unrecognized Balance</p>
                            <p className="text-3xl font-black mt-1 tracking-tighter text-amber-600">{fmt(stats.remaining)}</p>
                            <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">Pending Amortization</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TypicalListView
                title="Amortization Lifecycle"
                data={filteredExpenses}
                loading={loading}
                getRowId={(exp) => exp.id}
                columns={columns}
                className="rounded-3xl border-0 shadow-sm overflow-hidden"
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                headerExtra={
                    <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-2xl">
                        {[
                            { key: "ALL", label: "All Assets", icon: LayoutGrid },
                            { key: "ACTIVE", label: "Running", icon: PlayCircle },
                            { key: "COMPLETED", label: "Closed", icon: CheckCircle2 },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === tab.key
                                    ? "bg-white shadow-sm text-gray-900"
                                    : "text-stone-400 hover:text-stone-600"
                                    }`}
                            >
                                <tab.icon size={12} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                }
            />
        </div>
    )
}
