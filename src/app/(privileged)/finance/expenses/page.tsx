'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import { getExpenses, createExpense, updateExpense, deleteExpense, postExpense, cancelExpense, ExpenseInput, ExpenseUpdateInput } from "@/app/actions/finance/expenses"
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
    Receipt, Plus, Search, CheckCircle2, Clock, Send,
    Pencil, Trash2, XCircle, Ban, DollarSign,
    Building2, Zap, Briefcase, Wrench, Car,
    Phone, Scale, Megaphone, MoreHorizontal, TrendingUp
} from "lucide-react"

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    RENT: { label: 'Rent', icon: Building2, color: 'bg-blue-100 text-blue-700' },
    UTILITIES: { label: 'Utilities', icon: Zap, color: 'bg-yellow-100 text-yellow-700' },
    OFFICE_SUPPLIES: { label: 'Office Supplies', icon: Briefcase, color: 'bg-green-100 text-green-700' },
    SALARIES: { label: 'Salaries', icon: DollarSign, color: 'bg-purple-100 text-purple-700' },
    MAINTENANCE: { label: 'Maintenance', icon: Wrench, color: 'bg-orange-100 text-orange-700' },
    TRANSPORT: { label: 'Transport', icon: Car, color: 'bg-cyan-100 text-cyan-700' },
    TELECOM: { label: 'Telecom', icon: Phone, color: 'bg-indigo-100 text-indigo-700' },
    PROFESSIONAL_FEES: { label: 'Professional Fees', icon: Scale, color: 'bg-rose-100 text-rose-700' },
    TAXES_FEES: { label: 'Taxes & Fees', icon: Receipt, color: 'bg-red-100 text-red-700' },
    MARKETING: { label: 'Marketing', icon: Megaphone, color: 'bg-pink-100 text-pink-700' },
    OTHER: { label: 'Other', icon: MoreHorizontal, color: 'bg-gray-100 text-gray-700' },
}

export default function ExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editExpense, setEditExpense] = useState<any>(null)
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
    const [activeTab, setActiveTab] = useState<string>("ALL")
    const [searchQuery, setSearchQuery] = useState("")
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [exp, accs] = await Promise.all([
                getExpenses(),
                getFinancialAccounts()
            ])
            setExpenses(Array.isArray(exp) ? exp : [])
            setAccounts(Array.isArray(accs) ? accs : [])
        } catch {
            setExpenses([]); setAccounts([])
            toast.error("Failed to load expenses")
        } finally {
            setLoading(false)
        }
    }

    // ─── Create / Edit ─────────────────────────────────────────────
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        startTransition(async () => {
            try {
                if (editExpense) {
                    const updateData: ExpenseUpdateInput = {
                        name: fd.get("name") as string,
                        amount: Number(fd.get("amount")),
                        date: fd.get("date") as string,
                        category: fd.get("category") as string,
                        description: fd.get("description") as string || undefined,
                        source_account_id: fd.get("source_account_id") ? Number(fd.get("source_account_id")) : undefined,
                        expense_coa_id: fd.get("expense_coa_id") ? Number(fd.get("expense_coa_id")) : undefined,
                    }
                    await updateExpense(editExpense.id, updateData)
                    toast.success("Expense updated")
                } else {
                    const data: ExpenseInput = {
                        name: fd.get("name") as string,
                        amount: Number(fd.get("amount")),
                        date: fd.get("date") as string,
                        category: fd.get("category") as string,
                        description: fd.get("description") as string || undefined,
                        source_account_id: fd.get("source_account_id") ? Number(fd.get("source_account_id")) : undefined,
                        expense_coa_id: fd.get("expense_coa_id") ? Number(fd.get("expense_coa_id")) : undefined,
                    }
                    await createExpense(data)
                    toast.success("Expense created")
                }
                closeDialog()
                loadData()
            } catch (err: any) {
                toast.error(err.message || `Failed to ${editExpense ? 'update' : 'create'} expense`)
            }
        })
    }

    async function handlePost(id: number) {
        startTransition(async () => {
            try {
                await postExpense(id)
                toast.success("Expense posted — journal entry created")
                loadData()
            } catch (err: any) { toast.error(err.message || "Failed to post expense") }
        })
    }

    async function handleCancel(id: number) {
        startTransition(async () => {
            try {
                await cancelExpense(id)
                toast.success("Expense cancelled")
                loadData()
            } catch (err: any) { toast.error(err.message || "Failed to cancel expense") }
        })
    }

    async function handleDelete(id: number) {
        startTransition(async () => {
            try {
                await deleteExpense(id)
                toast.success("Expense deleted")
                setDeleteConfirm(null)
                loadData()
            } catch (err: any) { toast.error(err.message || "Failed to delete expense") }
        })
    }

    function openEdit(exp: any) {
        setEditExpense(exp)
        setDialogOpen(true)
    }

    function closeDialog() {
        setDialogOpen(false)
        setEditExpense(null)
    }

    // ─── Filtering ─────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = expenses
        if (activeTab !== "ALL") list = list.filter(e => e.status === activeTab)
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            list = list.filter(e =>
                e.name?.toLowerCase().includes(q) ||
                e.reference?.toLowerCase().includes(q) ||
                e.category?.toLowerCase().includes(q)
            )
        }
        return list
    }, [expenses, activeTab, searchQuery])

    // ─── Summaries ─────────────────────────────────────────────────
    const totalExpenses = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0)
    const postedTotal = expenses.filter(e => e.status === 'POSTED').reduce((s, e) => s + parseFloat(e.amount || 0), 0)
    const draftCount = expenses.filter(e => e.status === 'DRAFT').length
    const thisMonth = expenses.filter(e => {
        if (!e.date) return false
        const d = new Date(e.date)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).reduce((s, e) => s + parseFloat(e.amount || 0), 0)

    // ─── Category summary (top 3) ──────────────────────────────────
    const categorySummary = useMemo(() => {
        const map: Record<string, number> = {}
        expenses.forEach(e => {
            map[e.category] = (map[e.category] || 0) + parseFloat(e.amount || 0)
        })
        return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 3)
    }, [expenses])

    const tabs = [
        { key: "ALL", label: "All", count: expenses.length },
        { key: "DRAFT", label: "Draft", count: expenses.filter(e => e.status === 'DRAFT').length },
        { key: "POSTED", label: "Posted", count: expenses.filter(e => e.status === 'POSTED').length },
        { key: "CANCELLED", label: "Cancelled", count: expenses.filter(e => e.status === 'CANCELLED').length },
    ]

    const statusBadge = (s: string) => {
        switch (s) {
            case 'DRAFT': return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Draft</Badge>
            case 'POSTED': return <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> Posted</Badge>
            case 'CANCELLED': return <Badge variant="destructive" className="gap-1"><Ban className="h-3 w-3" /> Cancelled</Badge>
            default: return <Badge variant="secondary">{s}</Badge>
        }
    }

    // ─── Loading Skeleton ──────────────────────────────────────────
    if (loading) return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
                <Skeleton className="h-10 w-36" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
            <Skeleton className="h-96 rounded-xl" />
        </div>
    )

    return (
        <div className="p-6 space-y-6 animate-in fade-in duration-500">
            {/* ─── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-serif font-bold tracking-tight flex items-center gap-2">
                        <Receipt className="h-6 w-6 text-red-600" /> Direct Expenses
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Record and manage day-to-day operational expenses</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); else setDialogOpen(true) }}>
                    <DialogTrigger asChild>
                        <Button className="gap-2"><Plus className="h-4 w-4" /> New Expense</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>{editExpense ? 'Edit Expense' : 'Record New Expense'}</DialogTitle>
                            <DialogDescription>
                                {editExpense ? 'Update the expense details below.' : 'Fill in the details to record a new direct expense.'}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Name *</label>
                                    <Input name="name" required defaultValue={editExpense?.name || ''} placeholder="e.g. Office Rent January" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Amount *</label>
                                    <Input name="amount" type="number" step="0.01" required defaultValue={editExpense?.amount || ''} placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Date *</label>
                                    <Input name="date" type="date" required defaultValue={editExpense?.date || new Date().toISOString().split('T')[0]} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Category</label>
                                    <select name="category" defaultValue={editExpense?.category || 'OTHER'}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                        {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                                            <option key={k} value={k}>{v.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Source Account</label>
                                    <select name="source_account_id" defaultValue={editExpense?.source_account || ''}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                        <option value="">None</option>
                                        {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Expense COA</label>
                                    <Input name="expense_coa_id" type="number" placeholder="COA ID" defaultValue={editExpense?.expense_coa || ''} />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm font-medium">Description</label>
                                    <Input name="description" defaultValue={editExpense?.description || ''} placeholder="Optional notes..." />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
                                <Button type="submit" disabled={isPending}>
                                    {isPending ? "Saving..." : editExpense ? "Update" : "Create Expense"}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ─── Summary Cards ──────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-red-50 to-red-100/50 border-red-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-red-600/80 uppercase tracking-wider">Total Expenses</p>
                                <p className="text-2xl font-bold text-red-900 mt-1">${totalExpenses.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-red-200/60 rounded-lg p-2.5"><DollarSign className="h-5 w-5 text-red-700" /></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-emerald-600/80 uppercase tracking-wider">Posted</p>
                                <p className="text-2xl font-bold text-emerald-900 mt-1">${postedTotal.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-emerald-200/60 rounded-lg p-2.5"><CheckCircle2 className="h-5 w-5 text-emerald-700" /></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-amber-600/80 uppercase tracking-wider">This Month</p>
                                <p className="text-2xl font-bold text-amber-900 mt-1">${thisMonth.toLocaleString('en', { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-amber-200/60 rounded-lg p-2.5"><TrendingUp className="h-5 w-5 text-amber-700" /></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-slate-200/60">
                    <CardContent className="pt-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-slate-600/80 uppercase tracking-wider">Drafts</p>
                                <p className="text-2xl font-bold text-slate-900 mt-1">{draftCount}</p>
                            </div>
                            <div className="bg-slate-200/60 rounded-lg p-2.5"><Clock className="h-5 w-5 text-slate-700" /></div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ─── Top Categories ─────────────────────────────────── */}
            {categorySummary.length > 0 && (
                <div className="flex gap-3 flex-wrap">
                    {categorySummary.map(([cat, amount]) => {
                        const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.OTHER
                        const CatIcon = cfg.icon
                        return (
                            <div key={cat} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${cfg.color}`}>
                                <CatIcon className="h-3.5 w-3.5" />
                                {cfg.label}: ${amount.toLocaleString('en', { minimumFractionDigits: 2 })}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* ─── Tabs + Search ──────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {tabs.map(t => (
                        <button key={t.key}
                            onClick={() => setActiveTab(t.key)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            {t.label} <span className="ml-1 text-xs opacity-60">({t.count})</span>
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search expenses..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 w-64"
                    />
                </div>
            </div>

            {/* ─── Table ──────────────────────────────────────────── */}
            <Card>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="bg-muted rounded-full p-4 mb-4">
                                <Receipt className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-lg">No expenses found</h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                {searchQuery ? 'Try a different search term' : 'Record your first direct expense to get started'}
                            </p>
                            {!searchQuery && (
                                <Button className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
                                    <Plus className="h-4 w-4" /> Record Expense
                                </Button>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((exp) => {
                                    const cfg = CATEGORY_CONFIG[exp.category] || CATEGORY_CONFIG.OTHER
                                    const CatIcon = cfg.icon
                                    return (
                                        <TableRow key={exp.id}>
                                            <TableCell className="text-sm">{exp.date}</TableCell>
                                            <TableCell>
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                                                    <CatIcon className="h-3 w-3" /> {cfg.label}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium">{exp.name}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground font-mono">{exp.reference || '—'}</TableCell>
                                            <TableCell className="text-right font-semibold">${parseFloat(exp.amount).toLocaleString('en', { minimumFractionDigits: 2 })}</TableCell>
                                            <TableCell>{statusBadge(exp.status)}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {exp.status === 'DRAFT' && (
                                                        <>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(exp)} title="Edit">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handlePost(exp.id)} disabled={isPending}>
                                                                <Send className="h-3 w-3" /> Post
                                                            </Button>
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-600" onClick={() => handleCancel(exp.id)} disabled={isPending} title="Cancel">
                                                                <XCircle className="h-3.5 w-3.5" />
                                                            </Button>
                                                            {deleteConfirm === exp.id ? (
                                                                <Button size="sm" variant="destructive" className="h-7 gap-1 text-xs" onClick={() => handleDelete(exp.id)} disabled={isPending}>
                                                                    Confirm
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteConfirm(exp.id)} title="Delete">
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
