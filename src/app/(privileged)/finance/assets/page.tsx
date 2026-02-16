'use client'

import { useState, useEffect, useTransition } from "react"
import { getAssets, getAssetSchedule, createAsset, postDepreciation, AssetInput } from "@/app/actions/finance/assets"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { useRouter } from "next/navigation"

export default function AssetsPage() {
    const [assets, setAssets] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [showForm, setShowForm] = useState(false)
    const [selectedAsset, setSelectedAsset] = useState<any>(null)
    const [schedule, setSchedule] = useState<any[]>([])
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const [successMsg, setSuccessMsg] = useState("")
    const router = useRouter()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [a, accs] = await Promise.all([getAssets(), getFinancialAccounts()])
            setAssets(Array.isArray(a) ? a : [])
            setAccounts(Array.isArray(accs) ? accs : [])
        } catch { setAssets([]); setAccounts([]) }
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError("")
        const fd = new FormData(e.currentTarget)
        const data: AssetInput = {
            name: fd.get("name") as string,
            description: fd.get("description") as string,
            category: fd.get("category") as string,
            purchase_value: Number(fd.get("purchase_value")),
            purchase_date: fd.get("purchase_date") as string,
            useful_life_years: Number(fd.get("useful_life_years")),
            residual_value: Number(fd.get("residual_value") || 0),
            depreciation_method: fd.get("depreciation_method") as string,
            source_account_id: Number(fd.get("source_account_id")),
        }

        startTransition(async () => {
            try {
                await createAsset(data)
                setShowForm(false)
                setSuccessMsg("Asset acquired successfully!")
                setTimeout(() => setSuccessMsg(""), 3000)
                loadData()
            } catch (err: any) {
                setError(err.message || "Failed to create asset")
            }
        })
    }

    async function viewSchedule(asset: any) {
        setSelectedAsset(asset)
        try {
            const s = await getAssetSchedule(asset.id)
            setSchedule(Array.isArray(s) ? s : [])
        } catch { setSchedule([]) }
    }

    async function handleDepreciate(assetId: number, scheduleId: number) {
        startTransition(async () => {
            try {
                await postDepreciation(assetId, scheduleId)
                setSuccessMsg("Depreciation posted!")
                setTimeout(() => setSuccessMsg(""), 3000)
                viewSchedule(selectedAsset)
                loadData()
            } catch (err: any) {
                setError(err.message || "Failed to post depreciation")
                setTimeout(() => setError(""), 3000)
            }
        })
    }

    const categories = ["VEHICLE", "EQUIPMENT", "IT", "FURNITURE", "BUILDING", "LAND", "OTHER"]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Fixed Assets</h1>
                    <p className="text-muted-foreground mt-1">Track assets, depreciation schedules, and book values</p>
                </div>
                <button
                    onClick={() => { setShowForm(!showForm); setSelectedAsset(null) }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
                >
                    {showForm ? "Cancel" : "+ Acquire Asset"}
                </button>
            </div>

            {successMsg && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">✓ {successMsg}</div>}
            {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">✕ {error}</div>}

            {/* Create Form */}
            {showForm && (
                <div className="bg-card border rounded-lg p-6 shadow-sm">
                    <h2 className="text-lg font-semibold mb-4">Acquire New Asset</h2>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Name *</label>
                            <input name="name" required className="w-full px-3 py-2 border rounded-md bg-background" placeholder="Delivery Truck" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Category *</label>
                            <select name="category" required className="w-full px-3 py-2 border rounded-md bg-background">
                                {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Depreciation Method</label>
                            <select name="depreciation_method" className="w-full px-3 py-2 border rounded-md bg-background">
                                <option value="LINEAR">Linear (Straight-Line)</option>
                                <option value="DECLINING">Declining Balance</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Purchase Value *</label>
                            <input name="purchase_value" type="number" step="0.01" min="0.01" required className="w-full px-3 py-2 border rounded-md bg-background" placeholder="50000.00" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Purchase Date *</label>
                            <input name="purchase_date" type="date" required className="w-full px-3 py-2 border rounded-md bg-background" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Useful Life (Years) *</label>
                            <input name="useful_life_years" type="number" min="1" max="50" required className="w-full px-3 py-2 border rounded-md bg-background" placeholder="5" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Residual Value</label>
                            <input name="residual_value" type="number" step="0.01" min="0" defaultValue="0" className="w-full px-3 py-2 border rounded-md bg-background" placeholder="5000.00" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Source Account</label>
                            <select name="source_account_id" className="w-full px-3 py-2 border rounded-md bg-background">
                                <option value="">Select account...</option>
                                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Description</label>
                            <input name="description" className="w-full px-3 py-2 border rounded-md bg-background" placeholder="Optional..." />
                        </div>
                        <div className="lg:col-span-3 md:col-span-2 flex justify-end gap-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md hover:bg-muted transition-colors">Cancel</button>
                            <button type="submit" disabled={isPending} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                {isPending ? "Acquiring..." : "Acquire Asset"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Assets</p>
                    <p className="text-2xl font-bold mt-1">{assets.length}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Purchase Value</p>
                    <p className="text-2xl font-bold mt-1">{assets.reduce((s: number, a: any) => s + Number(a.purchase_value || 0), 0).toLocaleString()}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Book Value</p>
                    <p className="text-2xl font-bold mt-1">{assets.reduce((s: number, a: any) => s + Number(a.book_value || 0), 0).toLocaleString()}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Fully Depreciated</p>
                    <p className="text-2xl font-bold mt-1">{assets.filter((a: any) => a.status === "FULLY_DEPRECIATED").length}</p>
                </div>
            </div>

            {/* Assets Table */}
            <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="font-semibold">Asset Register</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Method</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Purchase</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Book Value</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Depreciation</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {assets.map((asset: any) => {
                                const depTotal = Number(asset.purchase_value) - Number(asset.residual_value || 0)
                                const depPct = depTotal > 0 ? Math.round((Number(asset.accumulated_depreciation) / depTotal) * 100) : 100
                                return (
                                    <tr key={asset.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-medium">{asset.name}</td>
                                        <td className="px-4 py-3 text-sm">{(asset.category || "").replace(/_/g, " ")}</td>
                                        <td className="px-4 py-3 text-sm">{asset.depreciation_method}</td>
                                        <td className="px-4 py-3 text-right">{Number(asset.purchase_value).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-medium">{Number(asset.book_value).toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2 justify-center">
                                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${depPct}%` }} />
                                                </div>
                                                <span className="text-xs text-muted-foreground">{depPct}%</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${asset.status === "ACTIVE" ? "bg-green-100 text-green-800" :
                                                    asset.status === "FULLY_DEPRECIATED" ? "bg-gray-100 text-gray-800" :
                                                        asset.status === "DISPOSED" ? "bg-red-100 text-red-800" :
                                                            "bg-yellow-100 text-yellow-800"
                                                }`}>
                                                {(asset.status || "").replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => viewSchedule(asset)}
                                                className="px-3 py-1 text-xs bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
                                            >
                                                Schedule
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {assets.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                                        No assets found. Click &quot;+ Acquire Asset&quot; to register one.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Depreciation Schedule Modal */}
            {selectedAsset && (
                <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b flex justify-between items-center">
                        <div>
                            <h2 className="font-semibold">Depreciation Schedule: {selectedAsset.name}</h2>
                            <p className="text-sm text-muted-foreground">Life: {selectedAsset.useful_life_years} years • Method: {selectedAsset.depreciation_method}</p>
                        </div>
                        <button onClick={() => setSelectedAsset(null)} className="px-3 py-1 text-sm border rounded-md hover:bg-muted transition-colors">Close</button>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full">
                            <thead className="bg-muted/50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase">Period</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase">Amount</th>
                                    <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {schedule.map((line: any) => (
                                    <tr key={line.id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-2.5 text-sm">{line.period_date}</td>
                                        <td className="px-4 py-2.5 text-right text-sm">{Number(line.amount).toLocaleString()}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${line.is_posted ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                                                {line.is_posted ? "Posted" : "Pending"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            {!line.is_posted && (
                                                <button
                                                    onClick={() => handleDepreciate(selectedAsset.id, line.id)}
                                                    disabled={isPending}
                                                    className="px-3 py-1 text-xs bg-orange-100 text-orange-800 rounded-md hover:bg-orange-200 transition-colors disabled:opacity-50"
                                                >
                                                    Post
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {schedule.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No depreciation schedule available.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
