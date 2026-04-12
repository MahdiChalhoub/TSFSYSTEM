'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
    getCountingSession, getSessionLines, submitCount, completeSession
} from "@/app/actions/inventory/stock-count"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    ArrowLeft, Search, CheckCircle2, AlertTriangle, Package,
    Loader2, Save, Send, Hash
} from "lucide-react"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// ─── Types ───────────────────────────────────────────────────────
interface Line {
    id: number
    product: number
    product_name: string
    product_sku: string | null
    product_barcode: string | null
    category_name: string | null
    brand_name: string | null
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
}

// ─── Page ────────────────────────────────────────────────────────
export default function CountingPage() {
    const params = useParams()
    const sessionId = Number(params.id)
    const router = useRouter()

    const [session, setSession] = useState<Session | null>(null)
    const [lines, setLines] = useState<Line[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState("")
    const [countDialog, setCountDialog] = useState<{ line: Line; person: 1 | 2 } | null>(null)
    const [countValue, setCountValue] = useState("")
    const [showFilter, setShowFilter] = useState<"all" | "counted" | "uncounted" | "diff">("all")

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
            list = list.filter(l =>
                l.product_name?.toLowerCase().includes(s) ||
                l.product_sku?.toLowerCase().includes(s) ||
                l.product_barcode?.toLowerCase().includes(s)
            )
        }
        if (showFilter === "counted") list = list.filter(l => l.physical_qty_person1 !== null)
        if (showFilter === "uncounted") list = list.filter(l => l.physical_qty_person1 === null)
        if (showFilter === "diff") list = list.filter(l => l.needs_adjustment)
        return list
    }, [lines, search, showFilter])

    // ─── Stats ───
    const totalCount = lines.length
    const countedCount = lines.filter(l => l.physical_qty_person1 !== null).length
    const diffCount = lines.filter(l => l.needs_adjustment).length
    const progress = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0

    // ─── Submit Count ───
    const handleSubmitCount = () => {
        if (!countDialog || countValue === "") return
        startTransition(async () => {
            await submitCount(countDialog.line.id, countDialog.person, parseFloat(countValue))
            setCountDialog(null)
            setCountValue("")
            reload()
        })
    }

    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false)

    // ─── Complete ───
    const handleComplete = () => {
        startTransition(async () => {
            await completeSession(sessionId)
            router.push('/inventory/stock-count')
        })
        setShowCompleteConfirm(false)
    }

    if (loading) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push('/inventory/stock-count')}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold">
                        Counting — COUNT-{session?.reference || session?.id}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {session?.location} • {session?.section}
                        {session?.person1_name && ` • ${session.person1_name}`}
                        {session?.person2_name && ` & ${session.person2_name}`}
                    </p>
                </div>
                {session?.status === 'IN_PROGRESS' && (
                    <Button onClick={() => setShowCompleteConfirm(true)} disabled={isPending || countedCount === 0} className="bg-green-600 hover:bg-green-700">
                        <Send className="w-4 h-4 mr-2" /> Submit for Verification
                    </Button>
                )}
            </div>

            {/* Progress Bar */}
            <Card>
                <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Counting Progress</span>
                        <span className="text-sm text-muted-foreground">{countedCount} / {totalCount} products ({progress}%)</span>
                    </div>
                    <Progress value={progress} className="h-3" />
                    <div className="flex gap-6 mt-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> {countedCount} counted</span>
                        <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5 text-app-muted-foreground" /> {totalCount - countedCount} remaining</span>
                        {diffCount > 0 && <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> {diffCount} differences</span>}
                    </div>
                </CardContent>
            </Card>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search by name, SKU, barcode..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex gap-2">
                    {(["all", "uncounted", "counted", "diff"] as const).map(f => (
                        <Button key={f} variant={showFilter === f ? "default" : "outline"} size="sm" onClick={() => setShowFilter(f)}>
                            {f === "all" ? "All" : f === "uncounted" ? "Uncounted" : f === "counted" ? "Counted" : "Differences"}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Lines Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-center">System Qty</TableHead>
                                <TableHead className="text-center">Person 1</TableHead>
                                <TableHead className="text-center">Person 2</TableHead>
                                <TableHead className="text-center">Difference</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">No products found</TableCell></TableRow>
                            ) : filtered.map(line => {
                                const diff = line.difference_person1
                                const hasDiff = diff !== null && diff !== 0
                                return (
                                    <TableRow key={line.id} className={hasDiff ? "bg-yellow-50/50 dark:bg-yellow-950/10" : ""}>
                                        <TableCell className="font-medium max-w-[200px] truncate">{line.product_name}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{line.product_sku || '—'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{line.category_name || '—'}</TableCell>
                                        <TableCell className="text-center font-mono">{Number(line.system_qty)}</TableCell>
                                        <TableCell className="text-center">
                                            {line.physical_qty_person1 !== null ? (
                                                <Badge variant="outline" className="font-mono cursor-pointer" onClick={() => { setCountDialog({ line, person: 1 }); setCountValue(String(line.physical_qty_person1)) }}>
                                                    {Number(line.physical_qty_person1)}
                                                </Badge>
                                            ) : (
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCountDialog({ line, person: 1 }); setCountValue("") }}>
                                                    <Hash className="w-3 h-3 mr-1" /> Count
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {line.physical_qty_person2 !== null ? (
                                                <Badge variant="outline" className="font-mono cursor-pointer" onClick={() => { setCountDialog({ line, person: 2 }); setCountValue(String(line.physical_qty_person2)) }}>
                                                    {Number(line.physical_qty_person2)}
                                                </Badge>
                                            ) : (
                                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCountDialog({ line, person: 2 }); setCountValue("") }}>
                                                    <Hash className="w-3 h-3 mr-1" /> Count
                                                </Button>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {diff !== null ? (
                                                <Badge className={diff === 0 ? "bg-green-100 text-green-700" : diff > 0 ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}>
                                                    {diff > 0 ? '+' : ''}{Number(diff)}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {line.physical_qty_person1 !== null && (
                                                <Badge variant="outline" className="text-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Count Dialog */}
            <Dialog open={!!countDialog} onOpenChange={() => setCountDialog(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Enter Physical Count</DialogTitle>
                        <DialogDescription>
                            {countDialog?.line.product_name} — Person {countDialog?.person}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">System Qty</span>
                            <span className="font-mono font-bold">{countDialog ? Number(countDialog.line.system_qty) : 0}</span>
                        </div>
                        <div className="space-y-2">
                            <Label>Physical Count</Label>
                            <Input
                                type="number"
                                value={countValue}
                                onChange={e => setCountValue(e.target.value)}
                                placeholder="Enter count..."
                                autoFocus
                                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitCount() }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCountDialog(null)}>Cancel</Button>
                        <Button onClick={handleSubmitCount} disabled={isPending || countValue === ""}>
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" /> Save</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={showCompleteConfirm}
                onOpenChange={setShowCompleteConfirm}
                onConfirm={handleComplete}
                title="Submit for Verification?"
                description="Mark counting as complete? This will send the session for verification."
                confirmText="Submit"
                variant="warning"
            />
        </div>
    )
}
