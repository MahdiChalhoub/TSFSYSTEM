'use client'

import { useState, useEffect, useTransition } from "react"
import type { DeferredExpense, FinancialAccount } from '@/types/erp'
import { getDeferredExpenses, createDeferredExpense, recognizeDeferredExpense, DeferredExpenseInput } from "@/app/actions/finance/deferred-expenses"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Clock, Plus, Search, CheckCircle2, Receipt, Timer,
    CalendarClock, DollarSign, PlayCircle
} from "lucide-react"

export default function DeferredExpensesPage() {
    const [expenses, setExpenses] = useState<DeferredExpense[]>([])
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [activeTab, setActiveTab] = useState<string>("ALL")
    const [isPending, startTransition] = useTransition()

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
            } catch (err: any) {
                toast.error(err.message || "Failed to create")
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
            } catch (err: any) {
                toast.error(err.message || "Failed to recognize")
            }
        })
    }

    const categories = ["SUBSCRIPTION", "RENOVATION", "ADVERTISING", "INSURANCE", "RENT_ADVANCE", "OTHER"]

    const tabs = [
        { key: "ALL", label: "All" },
        { key: "ACTIVE", label: "Active" },
        { key: "COMPLETED", label: "Completed" },
    ]

    const filteredExpenses = expenses
        .filter(e => activeTab === "ALL" || e.status === activeTab)
        .filter(e =>
            !searchQuery ||
            (e.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (e.category || "").toLowerCase().includes(searchQuery.toLowerCase())
        )

    const totalActive = expenses.filter(e => e.status === "ACTIVE").length
    const totalCommitted = expenses.reduce((s, e) => s + Number(e.total_amount || 0), 0)
    const totalRemaining = expenses.reduce((s, e) => s + Number(e.remaining_amount || 0), 0)

    const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
        ACTIVE: { icon: PlayCircle, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
        COMPLETED: { icon: CheckCircle2, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-56" /><Skeleton className="h-4 w-72 mt-2" /></div>
                    <Skeleton className="h-10 w-44" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <Skeleton className="h-96 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-stone-900 font-serif tracking-tight">Deferred Expenses</h1>
                    <p className="text-stone-500 font-medium mt-1">Manage long-term expenses recognized over multiple months</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-all">
                            <Plus size={16} /> New Deferred Expense
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><CalendarClock size={20} /> Create Deferred Expense</DialogTitle>
                            <DialogDescription>Set up a prepaid expense to be amortized over time.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Name *</label>
                                <Input name="name" required placeholder="Annual Software License" className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Category *</label>
                                <select name="category" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                    {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Total Amount *</label>
                                <Input name="total_amount" type="number" step="0.01" min="0.01" required placeholder="12,000.00" className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Duration (Months) *</label>
                                <Input name="duration_months" type="number" min="1" max="120" required placeholder="12" className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Start Date *</label>
                                <Input name="start_date" type="date" required className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Source Account *</label>
                                <select name="source_account_id" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                    <option value="">Select account...</option>
                                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Description</label>
                                <textarea name="description" rows={2} className="w-full px-3 py-2 border rounded-xl bg-background text-sm resize-none" placeholder="Optional description..." />
                            </div>
                            <div className="col-span-2 flex justify-end gap-2 pt-3 border-t">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
                                <Button type="submit" disabled={isPending} className="rounded-xl gap-2">
                                    {isPending ? "Creating..." : <><CalendarClock size={14} /> Create Expense</>}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Active</p>
                                <p className="text-3xl font-bold text-emerald-900 mt-1">{totalActive}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <PlayCircle size={22} className="text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Total Committed</p>
                                <p className="text-3xl font-bold text-indigo-900 mt-1">{totalCommitted.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-200/60 flex items-center justify-center">
                                <DollarSign size={22} className="text-indigo-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Remaining</p>
                                <p className="text-3xl font-bold text-amber-900 mt-1">{totalRemaining.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-200/60 flex items-center justify-center">
                                <Timer size={22} className="text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs + Search + Table */}
            <Card className="rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-stone-50/50">
                    <div className="flex gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-3.5 py-2 text-sm rounded-xl transition-all ${activeTab === tab.key
                                    ? "bg-white shadow-sm font-semibold text-stone-900"
                                    : "text-stone-400 hover:text-stone-600"
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <Input
                            placeholder="Search name or category..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 rounded-xl text-sm h-9 bg-white"
                        />
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-stone-50/30">
                            <TableHead className="text-xs font-bold uppercase text-stone-400">Name</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400">Category</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Total</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Monthly</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-center">Progress</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Remaining</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-center">Status</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredExpenses.map((exp: any) => {
                            const progress = exp.duration_months > 0 ? Math.round((exp.months_recognized / exp.duration_months) * 100) : 100
                            const sc = statusConfig[exp.status] || statusConfig.ACTIVE
                            const StatusIcon = sc.icon
                            return (
                                <TableRow key={exp.id} className="hover:bg-stone-50/50 transition-colors">
                                    <TableCell className="font-semibold text-stone-800">{exp.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="rounded-lg text-[11px] border-stone-200 text-stone-600">
                                            {(exp.category || "").replace(/_/g, " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-sm">{Number(exp.total_amount).toLocaleString()}</TableCell>
                                    <TableCell className="text-right text-sm text-stone-500">{Number(exp.monthly_amount).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 justify-center">
                                            <div className="w-20 h-2.5 bg-stone-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${progress >= 100 ? "bg-blue-400" : "bg-emerald-400"}`}
                                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-stone-400">{exp.months_recognized}/{exp.duration_months}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-stone-800">{Number(exp.remaining_amount).toLocaleString()}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`gap-1 rounded-lg border ${sc.bg} ${sc.color} font-semibold text-[11px]`}>
                                            <StatusIcon size={12} /> {exp.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {exp.status === "ACTIVE" && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleRecognize(exp.id)}
                                                disabled={isPending}
                                                className="rounded-xl gap-1 h-8 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                            >
                                                <Clock size={12} /> Recognize
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {filteredExpenses.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                                            <CalendarClock size={28} className="text-stone-300" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-stone-600">No deferred expenses found</p>
                                            <p className="text-sm text-stone-400 mt-1">Create a deferred expense to start amortization</p>
                                        </div>
                                        <Button variant="outline" onClick={() => setDialogOpen(true)} className="rounded-xl gap-2 mt-2">
                                            <Plus size={14} /> New Deferred Expense
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    )
}
