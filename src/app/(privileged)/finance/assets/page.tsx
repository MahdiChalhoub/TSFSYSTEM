// @ts-nocheck
'use client'

import { useState, useEffect, useTransition } from "react"
import type { Asset, FinancialAccount, DepreciationScheduleItem } from '@/types/erp'
import { getAssets, getAssetSchedule, createAsset, postDepreciation, AssetInput } from "@/app/actions/finance/assets"
import { getFinancialAccounts } from "@/app/actions/finance/financial-accounts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    Landmark, Plus, Search, TrendingDown, Package, CheckCircle2,
    AlertTriangle, XCircle, Eye, Calendar, X
} from "lucide-react"

export default function AssetsPage() {
    const [assets, setAssets] = useState<Asset[]>([])
    const [accounts, setAccounts] = useState<FinancialAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
    const [schedule, setSchedule] = useState<DepreciationScheduleItem[]>([])
    const [searchQuery, setSearchQuery] = useState("")
    const [isPending, startTransition] = useTransition()

    useEffect(() => { loadData() }, [])

    async function loadData() {
        try {
            const [a, accs] = await Promise.all([getAssets(), getFinancialAccounts()])
            setAssets(Array.isArray(a) ? a : [])
            setAccounts(Array.isArray(accs) ? accs : [])
        } catch {
            setAssets([]); setAccounts([])
            toast.error("Failed to load assets")
        } finally {
            setLoading(false)
        }
    }

    async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
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
                setDialogOpen(false)
                toast.success("Asset acquired successfully")
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to create asset")
            }
        })
    }

    async function viewSchedule(asset: Record<string, any>) {
        setSelectedAsset(asset)
        try {
            const s = await getAssetSchedule(asset.id)
            setSchedule(Array.isArray(s) ? s : [])
        } catch {
            setSchedule([])
            toast.error("Failed to load schedule")
        }
    }

    async function handleDepreciate(assetId: number, scheduleId: number) {
        startTransition(async () => {
            try {
                await postDepreciation(assetId, scheduleId)
                toast.success("Depreciation posted")
                viewSchedule(selectedAsset)
                loadData()
            } catch (err: unknown) {
                toast.error((err instanceof Error ? err.message : String(err)) || "Failed to post depreciation")
            }
        })
    }

    const categories = ["VEHICLE", "EQUIPMENT", "IT", "FURNITURE", "BUILDING", "LAND", "OTHER"]

    const filteredAssets = assets.filter(a =>
        !searchQuery ||
        (a.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.category || "").toLowerCase().includes(searchQuery.toLowerCase())
    )

    const totalPurchase = assets.reduce((s, a) => s + Number(a.purchase_value || 0), 0)
    const totalBook = assets.reduce((s, a) => s + Number(a.book_value || 0), 0)
    const fullyDepreciated = assets.filter(a => a.status === "FULLY_DEPRECIATED").length

    const statusConfig: Record<string, { icon: Record<string, any>; color: string; bg: string }> = {
        ACTIVE: { icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
        FULLY_DEPRECIATED: { icon: AlertTriangle, color: "text-stone-600", bg: "bg-stone-100 border-stone-200" },
        DISPOSED: { icon: XCircle, color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto">
                <div className="flex justify-between items-center">
                    <div><Skeleton className="h-10 w-48" /><Skeleton className="h-4 w-64 mt-2" /></div>
                    <Skeleton className="h-10 w-36" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
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
                    <h1 className="text-4xl font-bold text-stone-900 font-serif tracking-tight">Fixed Assets</h1>
                    <p className="text-stone-500 font-medium mt-1">Track assets, depreciation schedules, and book values</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-xl gap-2 shadow-md hover:shadow-lg transition-all">
                            <Plus size={16} /> Acquire Asset
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2"><Landmark size={20} /> Acquire New Asset</DialogTitle>
                            <DialogDescription>Register a fixed asset and configure its depreciation schedule.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Name *</label>
                                <Input name="name" required placeholder="Delivery Truck" className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Category *</label>
                                <select name="category" required className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                    {categories.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Depreciation Method</label>
                                <select name="depreciation_method" className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                    <option value="LINEAR">Linear (Straight-Line)</option>
                                    <option value="DECLINING">Declining Balance</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Purchase Value *</label>
                                <Input name="purchase_value" type="number" step="0.01" min="0.01" required placeholder="50,000.00" className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Purchase Date *</label>
                                <Input name="purchase_date" type="date" required className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Useful Life (Years) *</label>
                                <Input name="useful_life_years" type="number" min="1" max="50" required placeholder="5" className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Residual Value</label>
                                <Input name="residual_value" type="number" step="0.01" min="0" defaultValue="0" placeholder="5,000.00" className="rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Source Account</label>
                                <select name="source_account_id" className="w-full px-3 py-2 border rounded-xl bg-background text-sm">
                                    <option value="">Select account...</option>
                                    {accounts.map((a: Record<string, any>) => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-xs font-bold text-stone-500 uppercase">Description</label>
                                <Input name="description" placeholder="Optional description..." className="rounded-xl" />
                            </div>
                            <div className="col-span-2 flex justify-end gap-2 pt-3 border-t">
                                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancel</Button>
                                <Button type="submit" disabled={isPending} className="rounded-xl gap-2">
                                    {isPending ? "Acquiring..." : <><Landmark size={14} /> Acquire Asset</>}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-stone-50 to-stone-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Assets</p>
                                <p className="text-3xl font-bold text-stone-900 mt-1">{assets.length}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-stone-200/60 flex items-center justify-center">
                                <Package size={22} className="text-stone-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-indigo-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Purchase Value</p>
                                <p className="text-3xl font-bold text-indigo-900 mt-1">{totalPurchase.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-indigo-200/60 flex items-center justify-center">
                                <Landmark size={22} className="text-indigo-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Book Value</p>
                                <p className="text-3xl font-bold text-emerald-900 mt-1">{totalBook.toLocaleString()}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-200/60 flex items-center justify-center">
                                <TrendingDown size={22} className="text-emerald-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100">
                    <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Fully Depreciated</p>
                                <p className="text-3xl font-bold text-amber-900 mt-1">{fullyDepreciated}</p>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-200/60 flex items-center justify-center">
                                <AlertTriangle size={22} className="text-amber-500" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Assets Table */}
            <Card className="rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b flex items-center justify-between bg-stone-50/50">
                    <h2 className="font-semibold text-stone-800 flex items-center gap-2"><Package size={16} /> Asset Register</h2>
                    <div className="relative w-64">
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
                            <TableHead className="text-xs font-bold uppercase text-stone-400">Method</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Purchase</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Book Value</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-center">Depreciation</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-center">Status</TableHead>
                            <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAssets.map((asset: Record<string, any>) => {
                            const depTotal = Number(asset.purchase_value) - Number(asset.residual_value || 0)
                            const depPct = depTotal > 0 ? Math.round((Number(asset.accumulated_depreciation) / depTotal) * 100) : 100
                            const sc = statusConfig[asset.status] || statusConfig.ACTIVE
                            const StatusIcon = sc.icon
                            return (
                                <TableRow key={asset.id} className="hover:bg-stone-50/50 transition-colors">
                                    <TableCell className="font-semibold text-stone-800">{asset.name}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="rounded-lg text-[11px] border-stone-200 text-stone-600">
                                            {(asset.category || "").replace(/_/g, " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-stone-500">{asset.depreciation_method}</TableCell>
                                    <TableCell className="text-right text-sm">{Number(asset.purchase_value).toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-semibold text-stone-800">{Number(asset.book_value).toLocaleString()}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 justify-center">
                                            <div className="w-20 h-2.5 bg-stone-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${depPct >= 100 ? "bg-stone-400" : depPct >= 70 ? "bg-amber-400" : "bg-emerald-400"}`}
                                                    style={{ width: `${Math.min(depPct, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-stone-400 w-9">{depPct}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`gap-1 rounded-lg border ${sc.bg} ${sc.color} font-semibold text-[11px]`}>
                                            <StatusIcon size={12} /> {(asset.status || "").replace(/_/g, " ")}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => viewSchedule(asset)}
                                            className="rounded-xl gap-1 h-8 text-xs font-semibold"
                                        >
                                            <Eye size={12} /> Schedule
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        {filteredAssets.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center">
                                            <Landmark size={28} className="text-stone-300" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-stone-600">No assets found</p>
                                            <p className="text-sm text-stone-400 mt-1">Acquire your first fixed asset to get started</p>
                                        </div>
                                        <Button variant="outline" onClick={() => setDialogOpen(true)} className="rounded-xl gap-2 mt-2">
                                            <Plus size={14} /> Acquire Asset
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Depreciation Schedule Panel */}
            {selectedAsset && (
                <Card className="rounded-2xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
                    <div className="px-5 py-4 border-b flex justify-between items-center bg-gradient-to-r from-stone-50 to-amber-50/30">
                        <div>
                            <h2 className="font-semibold text-stone-800 flex items-center gap-2">
                                <Calendar size={16} /> Depreciation Schedule: {selectedAsset.name}
                            </h2>
                            <p className="text-sm text-stone-400 mt-0.5">
                                Life: {selectedAsset.useful_life_years} years • Method: {selectedAsset.depreciation_method}
                            </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedAsset(null)} className="rounded-xl gap-1">
                            <X size={14} /> Close
                        </Button>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-stone-50/30 sticky top-0">
                                    <TableHead className="text-xs font-bold uppercase text-stone-400">Period</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Amount</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-stone-400 text-center">Status</TableHead>
                                    <TableHead className="text-xs font-bold uppercase text-stone-400 text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {schedule.map((line: Record<string, any>) => (
                                    <TableRow key={line.id} className="hover:bg-stone-50/50 transition-colors">
                                        <TableCell className="text-sm text-stone-600">{line.period_date}</TableCell>
                                        <TableCell className="text-right text-sm font-semibold">{Number(line.amount).toLocaleString()}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`gap-1 rounded-lg border font-semibold text-[11px] ${line.is_posted ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                                                {line.is_posted ? <><CheckCircle2 size={12} /> Posted</> : <><TrendingDown size={12} /> Pending</>}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {!line.is_posted && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleDepreciate(selectedAsset.id, line.id)}
                                                    disabled={isPending}
                                                    className="rounded-xl gap-1 h-7 text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50"
                                                >
                                                    <TrendingDown size={12} /> Post
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {schedule.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-8 text-center text-stone-400">
                                            No depreciation schedule available.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}
        </div>
    )
}
