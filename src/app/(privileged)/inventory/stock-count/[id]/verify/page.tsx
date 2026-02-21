'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    getCountingSession, getSessionLines, verifyLine, unverifyLine,
    verifySession, adjustSession
} from "@/app/actions/inventory/stock-count"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    ArrowLeft, Search, CheckCircle2, AlertTriangle, ShieldCheck,
    Loader2, Sparkles, XCircle, Package
} from "lucide-react"
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ───────────────────────────────────────────────────────
interface Line {
    id: number
    product_name: string
    product_sku: string | null
    category_name: string | null
    system_qty: number
    physical_qty_person1: number | null
    physical_qty_person2: number | null
    difference_person1: number | null
    difference_person2: number | null
    is_same_difference: boolean
    needs_adjustment: boolean
    is_verified: boolean
    is_adjusted: boolean
}

interface Session {
    id: number
    reference: string | null
    location: string
    section: string
    status: string
    person1_name: string | null
    person2_name: string | null
    products_count: number
    counted_count: number
    verified_count: number
    needs_adjustment_count: number
    adjustment_order: number | null
}

// ─── Page ────────────────────────────────────────────────────────
export default function VerifyPage() {
    const params = useParams()
    const sessionId = Number(params.id)
    const router = useRouter()

    const [session, setSession] = useState<Session | null>(null)
    const [lines, setLines] = useState<Line[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState("")
    const [showFilter, setShowFilter] = useState<"all" | "diff" | "match" | "verified">("all")
    const [selected, setSelected] = useState<Set<number>>(new Set())

    const reload = () => {
        startTransition(async () => {
            const [sess, lns] = await Promise.all([
                getCountingSession(sessionId),
                getSessionLines(sessionId)
            ])
            setSession(sess)
            setLines(Array.isArray(lns) ? lns : lns?.results || [])
            setLoading(false)
        })
    }
    useEffect(() => { reload() }, [sessionId])

    // ─── Filter ───
    const filtered = useMemo(() => {
        let list = lines
        if (search) {
            const s = search.toLowerCase()
            list = list.filter(l => l.product_name?.toLowerCase().includes(s) || l.product_sku?.toLowerCase().includes(s))
        }
        if (showFilter === "diff") list = list.filter(l => l.needs_adjustment)
        if (showFilter === "match") list = list.filter(l => !l.needs_adjustment && l.physical_qty_person1 !== null)
        if (showFilter === "verified") list = list.filter(l => l.is_verified)
        return list
    }, [lines, search, showFilter])

    // ─── Stats ───
    const totalLines = lines.length
    const verifiedCount = lines.filter(l => l.is_verified).length
    const diffCount = lines.filter(l => l.needs_adjustment).length
    const adjustedCount = lines.filter(l => l.is_adjusted).length
    const matchCount = lines.filter(l => !l.needs_adjustment && l.physical_qty_person1 !== null).length

    // ─── Actions ───
    const handleVerifyLine = (lineId: number) => {
        startTransition(async () => {
            await verifyLine(lineId)
            reload()
        })
    }
    const handleUnverifyLine = (lineId: number) => {
        startTransition(async () => {
            await unverifyLine(lineId)
            reload()
        })
    }

    const handleBatchVerify = () => {
        startTransition(async () => {
            for (const id of selected) {
                await verifyLine(id)
            }
            setSelected(new Set())
            reload()
        })
    }

    const [pendingAction, setPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info' } | null>(null)

    const handleVerifyAll = () => {
        setPendingAction({
            type: 'verifyAll',
            title: 'Verify All Lines?',
            description: 'This will verify all lines and mark the session as Verified.',
            variant: 'warning',
        })
    }

    const handleCreateAdjustment = () => {
        setPendingAction({
            type: 'createAdjustment',
            title: 'Create Stock Adjustment?',
            description: 'This will create a Stock Adjustment Order from the differences found.',
            variant: 'warning',
        })
    }

    const handleConfirmAction = () => {
        if (!pendingAction) return
        if (pendingAction.type === 'verifyAll') {
            startTransition(async () => {
                await verifySession(sessionId)
                reload()
            })
        } else if (pendingAction.type === 'createAdjustment') {
            startTransition(async () => {
                const result = await adjustSession(sessionId)
                if (result?.adjustment_order_id) {
                    toast.success(`Adjustment order created (${result.adjustments_created} lines). You can review it in Adjustment Orders.`)
                }
                reload()
            })
        }
        setPendingAction(null)
    }

    const toggleSelect = (id: number) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (selected.size === filtered.length) {
            setSelected(new Set())
        } else {
            setSelected(new Set(filtered.map(l => l.id)))
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
    }

    const isReadOnly = session?.status === 'ADJUSTED'

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push('/inventory/stock-count')}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">
                        {isReadOnly ? 'Review' : 'Verification'} — COUNT-{session?.reference || session?.id}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {session?.location} • {session?.section}
                        {session?.person1_name && ` • ${session.person1_name}`}
                        {session?.person2_name && ` & ${session.person2_name}`}
                    </p>
                </div>
                <div className="flex gap-2">
                    {!isReadOnly && session?.status === 'WAITING_VERIFICATION' && (
                        <Button onClick={handleVerifyAll} disabled={isPending} className="bg-green-600 hover:bg-green-700">
                            <ShieldCheck className="w-4 h-4 mr-2" /> Verify All
                        </Button>
                    )}
                    {!isReadOnly && (session?.status === 'VERIFIED' || session?.status === 'WAITING_VERIFICATION') && diffCount > 0 && (
                        <Button onClick={handleCreateAdjustment} disabled={isPending} className="bg-purple-600 hover:bg-purple-700">
                            <Sparkles className="w-4 h-4 mr-2" /> Create Adjustment Order
                        </Button>
                    )}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <Package className="w-5 h-5 text-blue-500" />
                        <div><p className="text-xs text-muted-foreground">Total Lines</p><p className="text-xl font-bold">{totalLines}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <div><p className="text-xs text-muted-foreground">Verified</p><p className="text-xl font-bold">{verifiedCount}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        <div><p className="text-xs text-muted-foreground">Differences</p><p className="text-xl font-bold">{diffCount}</p></div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <div><p className="text-xs text-muted-foreground">Adjusted</p><p className="text-xl font-bold">{adjustedCount}</p></div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-2">
                    {(["all", "diff", "match", "verified"] as const).map(f => (
                        <Button key={f} variant={showFilter === f ? "default" : "outline"} size="sm" onClick={() => setShowFilter(f)}>
                            {f === "all" ? `All (${totalLines})` : f === "diff" ? `Differences (${diffCount})` : f === "match" ? `Match (${matchCount})` : `Verified (${verifiedCount})`}
                        </Button>
                    ))}
                </div>
                {!isReadOnly && selected.size > 0 && (
                    <Button size="sm" onClick={handleBatchVerify} disabled={isPending}>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verify ({selected.size})
                    </Button>
                )}
            </div>

            {/* Lines Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {!isReadOnly && (
                                    <TableHead className="w-10">
                                        <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} />
                                    </TableHead>
                                )}
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-center">System</TableHead>
                                <TableHead className="text-center">Person 1</TableHead>
                                <TableHead className="text-center">Person 2</TableHead>
                                <TableHead className="text-center">Diff P1</TableHead>
                                <TableHead className="text-center">Diff P2</TableHead>
                                <TableHead className="text-center">Match</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                {!isReadOnly && <TableHead className="text-right">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={isReadOnly ? 10 : 11} className="text-center py-12 text-muted-foreground">No lines found</TableCell></TableRow>
                            ) : filtered.map(line => {
                                const hasDiff = line.needs_adjustment
                                return (
                                    <TableRow key={line.id} className={hasDiff ? "bg-yellow-50/50 dark:bg-yellow-950/10" : ""}>
                                        {!isReadOnly && (
                                            <TableCell><Checkbox checked={selected.has(line.id)} onCheckedChange={() => toggleSelect(line.id)} /></TableCell>
                                        )}
                                        <TableCell className="font-medium max-w-[180px] truncate">{line.product_name}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{line.product_sku || '—'}</TableCell>
                                        <TableCell className="text-center font-mono">{Number(line.system_qty)}</TableCell>
                                        <TableCell className="text-center font-mono">{line.physical_qty_person1 !== null ? Number(line.physical_qty_person1) : '—'}</TableCell>
                                        <TableCell className="text-center font-mono">{line.physical_qty_person2 !== null ? Number(line.physical_qty_person2) : '—'}</TableCell>
                                        <TableCell className="text-center">
                                            {line.difference_person1 !== null ? (
                                                <Badge className={Number(line.difference_person1) === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                                    {Number(line.difference_person1) > 0 ? '+' : ''}{Number(line.difference_person1)}
                                                </Badge>
                                            ) : '—'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {line.difference_person2 !== null ? (
                                                <Badge className={Number(line.difference_person2) === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                                                    {Number(line.difference_person2) > 0 ? '+' : ''}{Number(line.difference_person2)}
                                                </Badge>
                                            ) : '—'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {line.is_same_difference ? (
                                                <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                                            ) : line.physical_qty_person1 !== null && line.physical_qty_person2 !== null ? (
                                                <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                                            ) : '—'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {line.is_adjusted ? (
                                                <Badge className="bg-purple-100 text-purple-700"><Sparkles className="w-3 h-3 mr-1" />Adjusted</Badge>
                                            ) : line.is_verified ? (
                                                <Badge className="bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3 mr-1" />Verified</Badge>
                                            ) : (
                                                <Badge variant="outline">Pending</Badge>
                                            )}
                                        </TableCell>
                                        {!isReadOnly && (
                                            <TableCell className="text-right">
                                                {line.is_verified ? (
                                                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => handleUnverifyLine(line.id)} disabled={isPending}>
                                                        Unverify
                                                    </Button>
                                                ) : (
                                                    <Button size="sm" variant="outline" className="text-xs" onClick={() => handleVerifyLine(line.id)} disabled={isPending}>
                                                        <ShieldCheck className="w-3 h-3 mr-1" /> Verify
                                                    </Button>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <ConfirmDialog
                open={pendingAction !== null}
<<<<<<< HEAD
                onOpenChange={(open) => { if (!open) setPendingAction(null) }}
=======
                onOpenChange={(open: boolean) => { if (!open) setPendingAction(null) }}
>>>>>>> update-modules
                onConfirm={handleConfirmAction}
                title={pendingAction?.title ?? ''}
                description={pendingAction?.description ?? ''}
                confirmText="Confirm"
                variant={pendingAction?.variant ?? 'warning'}
            />
        </div>
    )
}
