'use client'

import { useState, useEffect, useTransition } from "react"
import { getDeferredExpenses, createDeferredExpense, recognizeDeferredExpense, DeferredExpenseInput } from "@/app/actions/finance/deferred-expenses"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { useRouter } from "next/navigation"

export default function DeferredExpensesPage() {
    const [expenses, setExpenses] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [showForm, setShowForm] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const [successMsg, setSuccessMsg] = useState("")
    const router = useRouter()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        try {
            const [exp, accs] = await Promise.all([getDeferredExpenses(), getFinancialAccounts()])
            setExpenses(Array.isArray(exp) ? exp : [])
            setAccounts(Array.isArray(accs) ? accs : [])
        } catch { setExpenses([]); setAccounts([]) }
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError("")
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
                setShowForm(false)
                setSuccessMsg("Deferred expense created successfully!")
                setTimeout(() => setSuccessMsg(""), 3000)
                loadData()
            } catch (err: any) {
                setError(err.message || "Failed to create")
            }
        })
    }

    async function handleRecognize(id: number) {
        const today = new Date().toISOString().split("T")[0]
        startTransition(async () => {
            try {
                await recognizeDeferredExpense(id, today)
                setSuccessMsg("Month recognized successfully!")
                setTimeout(() => setSuccessMsg(""), 3000)
                loadData()
            } catch (err: any) {
                setError(err.message || "Failed to recognize")
                setTimeout(() => setError(""), 3000)
            }
        })
    }

    const categories = ["SUBSCRIPTION", "RENOVATION", "ADVERTISING", "INSURANCE", "RENT_ADVANCE", "OTHER"]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Deferred Expenses</h1>
                    <p className="text-muted-foreground mt-1">Manage long-term expenses recognized over multiple months</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
                >
                    {showForm ? "Cancel" : "+ New Deferred Expense"}
                </button>
            </div>

            {/* Success / Error Messages */}
            {successMsg && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                    ✓ {successMsg}
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
                    ✕ {error}
                </div>
            )}

            {/* Create Form */}
            {showForm && (
                <div className="bg-card border rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">Create Deferred Expense</h2>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Name *</label>
                            <input name="name" required className="w-full px-3 py-2 border rounded-md bg-background" placeholder="Annual Software License" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Category *</label>
                            <select name="category" required className="w-full px-3 py-2 border rounded-md bg-background">
                                {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Total Amount *</label>
                            <input name="total_amount" type="number" step="0.01" min="0.01" required className="w-full px-3 py-2 border rounded-md bg-background" placeholder="12000.00" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Duration (Months) *</label>
                            <input name="duration_months" type="number" min="1" max="120" required className="w-full px-3 py-2 border rounded-md bg-background" placeholder="12" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Start Date *</label>
                            <input name="start_date" type="date" required className="w-full px-3 py-2 border rounded-md bg-background" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Source Account *</label>
                            <select name="source_account_id" required className="w-full px-3 py-2 border rounded-md bg-background">
                                <option value="">Select account...</option>
                                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                            </select>
                        </div>
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="text-sm font-medium">Description</label>
                            <textarea name="description" rows={2} className="w-full px-3 py-2 border rounded-md bg-background" placeholder="Optional description..." />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md hover:bg-muted transition-colors">Cancel</button>
                            <button type="submit" disabled={isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {isPending ? "Creating..." : "Create Expense"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Active</p>
                    <p className="text-2xl font-bold mt-1">{expenses.filter((e: any) => e.status === "ACTIVE").length}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Committed</p>
                    <p className="text-2xl font-bold mt-1">
                        {expenses.reduce((s: number, e: any) => s + Number(e.total_amount || 0), 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Remaining to Recognize</p>
                    <p className="text-2xl font-bold mt-1">
                        {expenses.reduce((s: number, e: any) => s + Number(e.remaining_amount || 0), 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="font-semibold">All Deferred Expenses</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Total</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Monthly</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Progress</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Remaining</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {expenses.map((exp: any) => {
                                const progress = exp.duration_months > 0 ? Math.round((exp.months_recognized / exp.duration_months) * 100) : 100
                                return (
                                    <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-medium">{exp.name}</td>
                                        <td className="px-4 py-3 text-sm">{(exp.category || "").replace(/_/g, " ")}</td>
                                        <td className="px-4 py-3 text-right">{Number(exp.total_amount).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right">{Number(exp.monthly_amount).toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 justify-center">
                                                <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                                                </div>
                                                <span className="text-xs text-muted-foreground">{exp.months_recognized}/{exp.duration_months}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">{Number(exp.remaining_amount).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${exp.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                                                    exp.status === "COMPLETED" ? "bg-blue-100 text-blue-800" :
                                                        "bg-gray-100 text-gray-800"
                                                }`}>
                                                {exp.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {exp.status === "ACTIVE" && (
                                                <button
                                                    onClick={() => handleRecognize(exp.id)}
                                                    disabled={isPending}
                                                    className="px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors disabled:opacity-50"
                                                >
                                                    Recognize Month
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                            {expenses.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                                        No deferred expenses found. Click &quot;+ New Deferred Expense&quot; to create one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
