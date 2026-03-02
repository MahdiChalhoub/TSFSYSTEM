'use client'

import { useState, useEffect, useTransition } from "react"
import type { ProfitDistribution, FiscalYear } from '@/types/erp'
import { getProfitDistributions, calculateDistribution, createDistribution, postDistribution } from "@/app/actions/finance/profit-distribution"
import { getFiscalYears } from "@/app/actions/finance/fiscal-year"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
 PieChart, Plus, Wallet, CheckCircle2, Clock, Send,
 ChevronRight, Trash2, DollarSign, Calendar
} from "lucide-react"

export default function ProfitDistributionPage() {
 const [distributions, setDistributions] = useState<ProfitDistribution[]>([])
 const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([])
 const [loading, setLoading] = useState(true)
 const [wizardOpen, setWizardOpen] = useState(false)
 const [wizardStep, setWizardStep] = useState(1)
 const [selectedFY, setSelectedFY] = useState<number | null>(null)
 const [allocations, setAllocations] = useState<Record<string, number>>({
 RESERVE: 10,
 REINVESTMENT: 20,
 DISTRIBUTABLE: 70
 })
 const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
 const [isPending, startTransition] = useTransition()

 useEffect(() => { loadData() }, [])

 async function loadData() {
 try {
 const [dist, fys] = await Promise.all([getProfitDistributions(), getFiscalYears()])
 setDistributions(Array.isArray(dist) ? dist : [])
 setFiscalYears(Array.isArray(fys) ? fys : [])
 } catch {
 setDistributions([]); setFiscalYears([])
 toast.error("Failed to load distributions")
 } finally {
 setLoading(false)
 }
 }

 const closedYears = fiscalYears.filter((fy: Record<string, any>) => fy.is_closed || fy.isClosed)

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
 const isValidPct = Math.abs(totalPct - 100) <= 0.01

 async function handleCalculate() {
 if (!selectedFY) { toast.error("Select a fiscal year"); return }
 if (!isValidPct) { toast.error("Percentages must sum to 100%"); return }

 startTransition(async () => {
 try {
 const result = await calculateDistribution(selectedFY, allocations)
 setPreview(result.data)
 setWizardStep(2)
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)) || "Failed to calculate")
 }
 })
 }

 async function handleCreate() {
 if (!selectedFY) return

 startTransition(async () => {
 try {
 const today = new Date().toISOString().split("T")[0]
 await createDistribution({
 fiscal_year_id: selectedFY,
 allocations,
 distribution_date: today,
 notes: `Auto-generated on ${today}`
 })
 setWizardOpen(false)
 setWizardStep(1)
 setPreview(null)
 toast.success("Distribution draft created!")
 loadData()
 } catch (err: unknown) {
 toast.error((err instanceof Error ? err.message : String(err)) || "Failed to create distribution")
 }
 })
 }

 async function handlePost(id: number) {
 toast.error("To post, configure retained earnings and allocation COA mappings in Finance Settings.")
 }

 const walletColors = ["from-blue-500 to-blue-600", "from-emerald-500 to-emerald-600", "from-violet-500 to-violet-600", "from-amber-500 to-amber-600", "from-rose-500 to-rose-600", "from-cyan-500 to-cyan-600"]

 const statusConfig: Record<string, { icon: Record<string, any>; color: string; bg: string }> = {
 POSTED: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
 APPROVED: { icon: CheckCircle2, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
 DRAFT: { icon: Clock, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
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
 <h1 className="page-header-title text-app-text font-serif tracking-tight">Profit Distribution</h1>
 <p className="text-app-text-muted font-medium mt-1">Year-end profit allocation across equity wallets</p>
 </div>
 <Dialog open={wizardOpen} onOpenChange={(open) => { setWizardOpen(open); if (!open) { setWizardStep(1); setPreview(null) } }}>
 <DialogTrigger asChild>
 <Button className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-all">
 <Plus size={16} /> New Distribution
 </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"><PieChart size={20} /> Distribution Wizard</DialogTitle>
 <DialogDescription>Configure allocation percentages and preview the breakdown.</DialogDescription>
 </DialogHeader>

 {/* Step Indicator */}
 <div className="flex items-center gap-2 py-2">
 <div className={`flex items-center gap-2 ${wizardStep >= 1 ? "text-app-text" : "text-stone-300"}`}>
 <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${wizardStep >= 1 ? "bg-gradient-to-br from-stone-800 to-stone-900 text-white shadow-md" : "bg-app-surface-2 text-app-text-faint"}`}>1</span>
 <span className="text-sm font-semibold">Configure</span>
 </div>
 <ChevronRight size={16} className="text-stone-300" />
 <div className={`flex items-center gap-2 ${wizardStep >= 2 ? "text-app-text" : "text-stone-300"}`}>
 <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${wizardStep >= 2 ? "bg-gradient-to-br from-stone-800 to-stone-900 text-white shadow-md" : "bg-app-surface-2 text-app-text-faint"}`}>2</span>
 <span className="text-sm font-semibold">Preview</span>
 </div>
 </div>

 {/* Step 1: Configure */}
 {wizardStep === 1 && (
 <div className="space-y-5 pt-2">
 <div className="space-y-1.5">
 <label className="text-xs font-bold text-app-text-muted uppercase">Fiscal Year *</label>
 <select
 value={selectedFY || ""}
 onChange={e => setSelectedFY(Number(e.target.value))}
 className="w-full px-3 py-2 border rounded-xl bg-background text-sm"
 >
 <option value="">Select closed fiscal year...</option>
 {closedYears.map((fy: Record<string, any>) => (
 <option key={fy.id} value={fy.id}>{fy.name} ({fy.start_date || fy.startDate} → {fy.end_date || fy.endDate})</option>
 ))}
 </select>
 {closedYears.length === 0 && (
 <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">⚠ No closed fiscal years found</p>
 )}
 </div>

 <div>
 <div className="flex justify-between items-center mb-3">
 <label className="text-xs font-bold text-app-text-muted uppercase">Allocation Wallets</label>
 <button type="button" onClick={addWallet} className="text-xs text-primary hover:underline font-semibold flex items-center gap-1">
 <Plus size={12} /> Add Wallet
 </button>
 </div>
 <div className="space-y-3">
 {Object.entries(allocations).map(([key, pct], idx) => (
 <div key={key} className="flex items-center gap-3">
 <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${walletColors[idx % walletColors.length]}`} />
 <span className="text-sm font-bold text-stone-700 w-32">{key}</span>
 <Input
 type="number"
 min="0"
 max="100"
 step="0.1"
 value={pct}
 onChange={e => updateAllocation(key, Number(e.target.value))}
 className="w-20 rounded-xl text-right text-sm h-9"
 />
 <span className="text-sm text-app-text-faint">%</span>
 <div className="flex-1 h-2.5 bg-app-surface-2 rounded-full overflow-hidden">
 <div className={`h-full rounded-full bg-gradient-to-r ${walletColors[idx % walletColors.length]} transition-all`} style={{ width: `${pct}%` }} />
 </div>
 {Object.keys(allocations).length > 1 && (
 <button type="button" onClick={() => removeWallet(key)} className="text-stone-300 hover:text-rose-500 transition-colors">
 <Trash2 size={14} />
 </button>
 )}
 </div>
 ))}
 </div>
 <div className={`mt-3 text-sm font-bold flex items-center gap-1.5 ${isValidPct ? "text-emerald-600" : "text-rose-600"}`}>
 {isValidPct ? <CheckCircle2 size={14} /> : <Clock size={14} />}
 Total: {totalPct}% {isValidPct ? "✓" : "(must equal 100%)"}
 </div>
 </div>

 <div className="flex justify-end pt-2 border-t">
 <Button
 onClick={handleCalculate}
 disabled={isPending || !selectedFY || !isValidPct}
 className="rounded-xl gap-2"
 >
 {isPending ? "Calculating..." : <><PieChart size={14} /> Calculate Preview</>}
 </Button>
 </div>
 </div>
 )}

 {/* Step 2: Preview */}
 {wizardStep === 2 && preview && (
 <div className="space-y-5 pt-2">
 <div className="bg-gradient-to-br from-stone-50 to-emerald-50/30 rounded-2xl p-5 border">
 <p className="text-xs font-bold text-app-text-faint uppercase">Fiscal Year</p>
 <p className="text-lg font-bold text-app-text">{preview.fiscal_year}</p>
 <p className="text-xs font-bold text-app-text-faint uppercase mt-3">Net Profit</p>
 <p className="text-4xl font-bold text-emerald-600">{Number(preview.net_profit).toLocaleString()}</p>
 </div>

 <div className="space-y-2">
 <label className="text-xs font-bold text-app-text-muted uppercase">Allocation Breakdown</label>
 {Object.entries(preview.allocations).map(([wallet, amount]: Record<string, any>, idx: number) => (
 <div key={wallet} className="flex justify-between items-center p-3 bg-app-surface border rounded-xl">
 <div className="flex items-center gap-2">
 <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${walletColors[idx % walletColors.length]}`} />
 <span className="font-semibold text-stone-700">{wallet}</span>
 </div>
 <span className="font-bold text-app-text">{Number(amount).toLocaleString()}</span>
 </div>
 ))}
 </div>

 <div className="flex justify-between pt-2 border-t">
 <Button variant="outline" onClick={() => setWizardStep(1)} className="rounded-xl gap-1">← Back</Button>
 <Button onClick={handleCreate} disabled={isPending} className="rounded-xl gap-2">
 {isPending ? "Creating..." : <><Send size={14} /> Create Draft</>}
 </Button>
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 </div>

 {/* Summary Cards */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-stone-50 to-stone-100">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-app-text-faint uppercase tracking-wider">Total Distributions</p>
 <p className="text-3xl font-bold text-app-text mt-1">{distributions.length}</p>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-stone-200/60 flex items-center justify-center">
 <PieChart size={22} className="text-app-text-muted" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Drafts</p>
 <p className="text-3xl font-bold text-amber-900 mt-1">{distributions.filter(d => d.status === "DRAFT").length}</p>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-amber-200/60 flex items-center justify-center">
 <Clock size={22} className="text-amber-500" />
 </div>
 </div>
 </CardContent>
 </Card>
 <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
 <CardContent className="pt-5 pb-4 px-5">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Posted</p>
 <p className="text-3xl font-bold text-emerald-900 mt-1">{distributions.filter(d => d.status === "POSTED").length}</p>
 </div>
 <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
 <CheckCircle2 size={22} className="text-emerald-500" />
 </div>
 </div>
 </CardContent>
 </Card>
 </div>

 {/* Distribution History Table */}
 <Card className="rounded-2xl shadow-sm overflow-hidden">
 <div className="px-5 py-3 border-b bg-stone-50/50">
 <h2 className="font-semibold text-app-text flex items-center gap-2"><Calendar size={16} /> Distribution History</h2>
 </div>
 <Table>
 <TableHeader>
 <TableRow className="bg-stone-50/30">
 <TableHead className="text-xs font-bold uppercase text-app-text-faint">Fiscal Year</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint">Date</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-right">Net Profit</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint">Allocations</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-center">Status</TableHead>
 <TableHead className="text-xs font-bold uppercase text-app-text-faint text-right">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {distributions.map((d: Record<string, any>) => {
 const sc = statusConfig[d.status] || statusConfig.DRAFT
 const StatusIcon = sc.icon
 return (
 <TableRow key={d.id} className="hover:bg-stone-50/50 transition-colors">
 <TableCell className="font-semibold text-app-text">{d.fiscal_year_name || `FY #${d.fiscal_year}`}</TableCell>
 <TableCell className="text-sm text-app-text-muted">{d.distribution_date}</TableCell>
 <TableCell className="text-right font-semibold text-app-text">{Number(d.net_profit).toLocaleString()}</TableCell>
 <TableCell>
 <div className="flex flex-wrap gap-1.5">
 {d.allocations && Object.entries(d.allocations).map(([k, v]: Record<string, any>, idx: number) => (
 <Badge key={k} variant="outline" className="rounded-lg text-[11px] border-app-border text-app-text-muted gap-1">
 <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${walletColors[idx % walletColors.length]}`} />
 {k}: {Number(v).toLocaleString()}
 </Badge>
 ))}
 </div>
 </TableCell>
 <TableCell className="text-center">
 <Badge variant="outline" className={`gap-1 rounded-lg border ${sc.bg} ${sc.color} font-semibold text-[11px]`}>
 <StatusIcon size={12} /> {d.status}
 </Badge>
 </TableCell>
 <TableCell className="text-right">
 {d.status === "DRAFT" && (
 <Button
 size="sm"
 variant="outline"
 onClick={() => handlePost(d.id)}
 disabled={isPending}
 className="rounded-xl gap-1 h-8 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
 >
 <Send size={12} /> Post
 </Button>
 )}
 </TableCell>
 </TableRow>
 )
 })}
 {distributions.length === 0 && (
 <TableRow>
 <TableCell colSpan={6} className="py-16 text-center">
 <div className="flex flex-col items-center gap-3">
 <div className="w-16 h-16 rounded-full bg-app-surface-2 flex items-center justify-center">
 <PieChart size={28} className="text-stone-300" />
 </div>
 <div>
 <p className="font-semibold text-app-text-muted">No distributions yet</p>
 <p className="text-sm text-app-text-faint mt-1">Close a fiscal year and create your first distribution</p>
 </div>
 <Button variant="outline" onClick={() => setWizardOpen(true)} className="rounded-xl gap-2 mt-2">
 <Plus size={14} /> New Distribution
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
