'use client'

import { useState, useEffect, useTransition } from "react"
import { getProfitDistributions, calculateDistribution, createDistribution, postDistribution } from "@/app/actions/finance/profit-distribution"
import { getFiscalYears } from "@/app/actions/finance/fiscal-year"

export default function ProfitDistributionPage() {
    const [distributions, setDistributions] = useState<any[]>([])
    const [fiscalYears, setFiscalYears] = useState<any[]>([])
    const [showWizard, setShowWizard] = useState(false)
    const [wizardStep, setWizardStep] = useState(1)
    const [selectedFY, setSelectedFY] = useState<number | null>(null)
    const [allocations, setAllocations] = useState<Record<string, number>>({
        RESERVE: 10,
        REINVESTMENT: 20,
        DISTRIBUTABLE: 70
    })
    const [preview, setPreview] = useState<any>(null)
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState("")
    const [successMsg, setSuccessMsg] = useState("")

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [dist, fys] = await Promise.all([getProfitDistributions(), getFiscalYears()])
            setDistributions(Array.isArray(dist) ? dist : [])
            setFiscalYears(Array.isArray(fys) ? fys : [])
        } catch { setDistributions([]); setFiscalYears([]) }
    }

    const closedYears = fiscalYears.filter((fy: any) => fy.is_closed || fy.isClosed)

    function updateAllocation(key: string, value: number) {
        setAllocations(prev => ({ ...prev, [key]: value }))
    }

    function addWallet() {
        const name = prompt("Wallet name (e.g., DIVIDEND):")
        if (name && name.trim()) {
            setAllocations(prev => ({ ...prev, [name.trim().toUpperCase()]: 0 }))
        }
    }

    function removeWallet(key: string) {
        setAllocations(prev => {
            const next = { ...prev }
            delete next[key]
            return next
        })
    }

    const totalPct = Object.values(allocations).reduce((a, b) => a + b, 0)

    async function handleCalculate() {
        if (!selectedFY) { setError("Select a fiscal year"); return }
        if (Math.abs(totalPct - 100) > 0.01) { setError("Percentages must sum to 100%"); return }
        setError("")

        startTransition(async () => {
            try {
                const result = await calculateDistribution(selectedFY, allocations)
                setPreview(result.data)
                setWizardStep(2)
            } catch (err: any) {
                setError(err.message || "Failed to calculate")
            }
        })
    }

    async function handleCreate() {
        if (!selectedFY) return
        setError("")

        startTransition(async () => {
            try {
                const today = new Date().toISOString().split("T")[0]
                await createDistribution({
                    fiscal_year_id: selectedFY,
                    allocations,
                    distribution_date: today,
                    notes: `Auto-generated on ${today}`
                })
                setShowWizard(false)
                setWizardStep(1)
                setPreview(null)
                setSuccessMsg("Distribution draft created!")
                setTimeout(() => setSuccessMsg(""), 3000)
                loadData()
            } catch (err: any) {
                setError(err.message || "Failed to create distribution")
            }
        })
    }

    async function handlePost(id: number) {
        // For posting, we'd need COA mapping which would come from a more detailed form
        // For now, show a message that COA mapping is needed
        setError("To post, you need to configure retained earnings and allocation COA mappings in Finance Settings.")
        setTimeout(() => setError(""), 5000)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Profit Distribution</h1>
                    <p className="text-muted-foreground mt-1">Year-end profit allocation across equity wallets</p>
                </div>
                <button
                    onClick={() => { setShowWizard(!showWizard); setWizardStep(1); setPreview(null) }}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium"
                >
                    {showWizard ? "Cancel" : "+ New Distribution"}
                </button>
            </div>

            {successMsg && <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">✓ {successMsg}</div>}
            {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">✕ {error}</div>}

            {/* Distribution Wizard */}
            {showWizard && (
                <div className="bg-card border rounded-lg p-6 shadow-sm">
                    {/* Step Indicator */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`flex items-center gap-2 ${wizardStep >= 1 ? "text-primary" : "text-muted-foreground"}`}>
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${wizardStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>1</span>
                            <span className="text-sm font-medium">Configure</span>
                        </div>
                        <div className="h-px w-12 bg-border" />
                        <div className={`flex items-center gap-2 ${wizardStep >= 2 ? "text-primary" : "text-muted-foreground"}`}>
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${wizardStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>2</span>
                            <span className="text-sm font-medium">Preview & Confirm</span>
                        </div>
                    </div>

                    {/* Step 1: Configure */}
                    {wizardStep === 1 && (
                        <div className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Fiscal Year *</label>
                                <select
                                    value={selectedFY || ""}
                                    onChange={e => setSelectedFY(Number(e.target.value))}
                                    className="w-full px-3 py-2 border rounded-md bg-background"
                                >
                                    <option value="">Select closed fiscal year...</option>
                                    {closedYears.map((fy: any) => (
                                        <option key={fy.id} value={fy.id}>{fy.name} ({fy.start_date || fy.startDate} → {fy.end_date || fy.endDate})</option>
                                    ))}
                                </select>
                                {closedYears.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1">⚠ No closed fiscal years found. Close a fiscal year first.</p>
                                )}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-sm font-medium">Allocation Wallets</label>
                                    <button type="button" onClick={addWallet} className="text-xs text-primary hover:underline">+ Add Wallet</button>
                                </div>
                                <div className="space-y-3">
                                    {Object.entries(allocations).map(([key, pct]) => (
                                        <div key={key} className="flex items-center gap-3">
                                            <span className="text-sm font-medium w-36">{key}</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                value={pct}
                                                onChange={e => updateAllocation(key, Number(e.target.value))}
                                                className="w-24 px-3 py-2 border rounded-md bg-background text-right"
                                            />
                                            <span className="text-sm text-muted-foreground">%</span>
                                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                            {Object.keys(allocations).length > 1 && (
                                                <button type="button" onClick={() => removeWallet(key)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className={`mt-3 text-sm font-medium ${Math.abs(totalPct - 100) <= 0.01 ? "text-green-600" : "text-red-600"}`}>
                                    Total: {totalPct}% {Math.abs(totalPct - 100) <= 0.01 ? "✓" : "(must equal 100%)"}
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    onClick={handleCalculate}
                                    disabled={isPending || !selectedFY || Math.abs(totalPct - 100) > 0.01}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {isPending ? "Calculating..." : "Calculate Preview →"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {wizardStep === 2 && preview && (
                        <div className="space-y-5">
                            <div className="bg-muted/50 rounded-lg p-5">
                                <p className="text-sm text-muted-foreground">Fiscal Year</p>
                                <p className="text-lg font-bold">{preview.fiscal_year}</p>
                                <p className="text-sm text-muted-foreground mt-3">Net Profit</p>
                                <p className="text-3xl font-bold text-green-600">{Number(preview.net_profit).toLocaleString()}</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium mb-3 block">Allocation Breakdown</label>
                                <div className="space-y-2">
                                    {Object.entries(preview.allocations).map(([wallet, amount]: any) => (
                                        <div key={wallet} className="flex justify-between items-center p-3 bg-background border rounded-md">
                                            <span className="font-medium">{wallet}</span>
                                            <span className="font-bold">{Number(amount).toLocaleString()}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between">
                                <button onClick={() => setWizardStep(1)} className="px-4 py-2 border rounded-md hover:bg-muted transition-colors">← Back</button>
                                <button
                                    onClick={handleCreate}
                                    disabled={isPending}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {isPending ? "Creating..." : "Create Distribution Draft"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Total Distributions</p>
                    <p className="text-2xl font-bold mt-1">{distributions.length}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Drafts</p>
                    <p className="text-2xl font-bold mt-1 text-yellow-600">{distributions.filter((d: any) => d.status === "DRAFT").length}</p>
                </div>
                <div className="bg-card border rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-muted-foreground">Posted</p>
                    <p className="text-2xl font-bold mt-1 text-green-600">{distributions.filter((d: any) => d.status === "POSTED").length}</p>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border rounded-lg shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="font-semibold">Distribution History</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Fiscal Year</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Date</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Net Profit</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Allocations</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {distributions.map((d: any) => (
                                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 font-medium">{d.fiscal_year_name || `FY #${d.fiscal_year}`}</td>
                                    <td className="px-4 py-3 text-sm">{d.distribution_date}</td>
                                    <td className="px-4 py-3 text-right font-medium">{Number(d.net_profit).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm">
                                        {d.allocations && Object.entries(d.allocations).map(([k, v]: any) => (
                                            <span key={k} className="inline-block mr-2 px-2 py-0.5 bg-muted rounded text-xs">{k}: {Number(v).toLocaleString()}</span>
                                        ))}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${d.status === "POSTED" ? "bg-green-100 text-green-800" :
                                                d.status === "APPROVED" ? "bg-blue-100 text-blue-800" :
                                                    "bg-yellow-100 text-yellow-800"
                                            }`}>
                                            {d.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {d.status === "DRAFT" && (
                                            <button
                                                onClick={() => handlePost(d.id)}
                                                disabled={isPending}
                                                className="px-3 py-1 text-xs bg-green-100 text-green-800 rounded-md hover:bg-green-200 transition-colors disabled:opacity-50"
                                            >
                                                Post
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {distributions.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                                        No profit distributions yet. Close a fiscal year and click &quot;+ New Distribution&quot; to start.
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
