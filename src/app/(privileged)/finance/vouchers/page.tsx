'use client'

import { useState, useEffect, useTransition } from "react"
import { getVouchers, createVoucher, postVoucher, VoucherInput } from "@/app/actions/finance/vouchers"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { getFinancialEvents } from "@/app/actions/finance/financial-events"

export default function VouchersPage() {
    const [vouchers, setVouchers] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [events, setEvents] = useState<any[]>([])
    const [showForm, setShowForm] = useState(false)
    const [voucherType, setVoucherType] = useState<'TRANSFER' | 'RECEIPT' | 'PAYMENT'>('TRANSFER')
    const [activeTab, setActiveTab] = useState<string>("ALL")
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const [successMsg, setSuccessMsg] = useState("")

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [v, accs, evts] = await Promise.all([
                getVouchers(),
                getFinancialAccounts(),
                getFinancialEvents()
            ])
            setVouchers(Array.isArray(v) ? v : [])
            setAccounts(Array.isArray(accs) ? accs : [])
            setEvents(Array.isArray(evts) ? evts : [])
        } catch { setVouchers([]); setAccounts([]); setEvents([]) }
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError("")
        const fd = new FormData(e.currentTarget)
        const data: VoucherInput = {
            voucher_type: voucherType,
            amount: Number(fd.get("amount")),
            date: fd.get("date") as string,
            description: fd.get("description") as string || undefined,
            source_account_id: fd.get("source_account_id") ? Number(fd.get("source_account_id")) : undefined,
            destination_account_id: fd.get("destination_account_id") ? Number(fd.get("destination_account_id")) : undefined,
            financial_event_id: fd.get("financial_event_id") ? Number(fd.get("financial_event_id")) : undefined,
        }

        startTransition(async () => {
            try {
                await createVoucher(data)
                setShowForm(false)
                setSuccessMsg("Voucher created successfully!")
                setTimeout(() => setSuccessMsg(""), 3000)
                loadData()
            } catch (err: any) {
                setError(err.message || "Failed to create voucher")
            }
        })
    }

    async function handlePost(id: number) {
        startTransition(async () => {
            try {
                await postVoucher(id)
                setSuccessMsg("Voucher posted!")
                setTimeout(() => setSuccessMsg(""), 3000)
                loadData()
            } catch (err: any) {
                setError(err.message || "Failed to post voucher")
                setTimeout(() => setError(""), 3000)
            }
        })
    }

    const filteredVouchers = activeTab === "ALL" ? vouchers : vouchers.filter((v: any) => v.voucher_type === activeTab)

    const tabs = [
        { key: "ALL", label: "All Vouchers" },
        { key: "TRANSFER", label: "Transfers" },
        { key: "RECEIPT", label: "Receipts" },
        { key: "PAYMENT", label: "Payments" },
    ]

    const typeColors: Record<string, string> = {
        TRANSFER: "bg-blue-100 text-blue-800",
        RECEIPT: "bg-green-100 text-green-800",
        PAYMENT: "bg-red-100 text-red-800",
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Vouchers</h1>
                    <p className="text-muted-foreground mt-1">Manage transfers, receipts, and payment vouchers</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
                >
                    {showForm ? "Cancel" : "+ New Voucher"}
                </button>
            </div>

            {successMsg && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">✓ {successMsg}</div>}
            {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">✕ {error}</div>}

            {/* Create Form */}
            {showForm && (
                <div className="bg-card border rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">Create Voucher</h2>

                    {/* Type Selector */}
                    <div className="flex gap-2 mb-5">
                        {(["TRANSFER", "RECEIPT", "PAYMENT"] as const).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setVoucherType(t)}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${voucherType === t ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                                    }`}
                            >
                                {t === "TRANSFER" ? "🔄 Transfer" : t === "RECEIPT" ? "📥 Receipt" : "📤 Payment"}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Amount *</label>
                            <input name="amount" type="number" step="0.01" min="0.01" required className="w-full px-3 py-2 border rounded-md bg-background" placeholder="1000.00" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Date *</label>
                            <input name="date" type="date" required className="w-full px-3 py-2 border rounded-md bg-background" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Description</label>
                            <input name="description" className="w-full px-3 py-2 border rounded-md bg-background" placeholder="Optional description..." />
                        </div>
                        <div className="space-y-1.5 flex items-end">
                            <p className="text-xs text-muted-foreground italic">Reference will be auto-generated</p>
                        </div>

                        {/* Conditional Fields */}
                        {(voucherType === "TRANSFER" || voucherType === "PAYMENT") && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Source Account *</label>
                                <select name="source_account_id" required className="w-full px-3 py-2 border rounded-md bg-background">
                                    <option value="">Select source...</option>
                                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}
                        {(voucherType === "TRANSFER" || voucherType === "RECEIPT") && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Destination Account *</label>
                                <select name="destination_account_id" required className="w-full px-3 py-2 border rounded-md bg-background">
                                    <option value="">Select destination...</option>
                                    {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                        )}
                        {(voucherType === "RECEIPT" || voucherType === "PAYMENT") && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Financial Event *</label>
                                <select name="financial_event_id" required className="w-full px-3 py-2 border rounded-md bg-background">
                                    <option value="">Select event...</option>
                                    {events.map((e: any) => (
                                        <option key={e.id} value={e.id}>
                                            {(e.event_type || e.eventType || "").replace(/_/g, " ")} — {Number(e.amount).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md hover:bg-muted transition-colors">Cancel</button>
                            <button type="submit" disabled={isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {isPending ? "Creating..." : "Create Voucher"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Vouchers</p>
                    <p className="text-2xl font-bold mt-1">{vouchers.length}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm border-l-4 border-l-blue-500">
                    <p className="text-sm text-muted-foreground">Transfers</p>
                    <p className="text-2xl font-bold mt-1">{vouchers.filter((v: any) => v.voucher_type === "TRANSFER").length}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm border-l-4 border-l-green-500">
                    <p className="text-sm text-muted-foreground">Receipts</p>
                    <p className="text-2xl font-bold mt-1">{vouchers.filter((v: any) => v.voucher_type === "RECEIPT").length}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm border-l-4 border-l-red-500">
                    <p className="text-sm text-muted-foreground">Payments</p>
                    <p className="text-2xl font-bold mt-1">{vouchers.filter((v: any) => v.voucher_type === "PAYMENT").length}</p>
                </div>
            </div>

            {/* Tabs & Table */}
            <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-3 border-b flex gap-1 bg-muted/30">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2 text-sm rounded-md transition-colors ${activeTab === tab.key ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Reference</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Amount</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredVouchers.map((v: any) => (
                                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 text-sm">{v.date}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${typeColors[v.voucher_type] || "bg-gray-100 text-gray-800"}`}>
                                            {v.voucher_type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm font-mono">{v.reference || "-"}</td>
                                    <td className="px-4 py-3 text-sm">{v.description || "-"}</td>
                                    <td className="px-4 py-3 text-right font-medium">{Number(v.amount).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${v.status === "POSTED" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                            }`}>
                                            {v.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {v.status === "DRAFT" && (
                                            <button
                                                onClick={() => handlePost(v.id)}
                                                disabled={isPending}
                                                className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors disabled:opacity-50"
                                            >
                                                Post
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredVouchers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        No vouchers found. Click &quot;+ New Voucher&quot; to create one.
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
