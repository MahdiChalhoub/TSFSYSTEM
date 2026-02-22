'use client'

import { useState, useEffect, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
    getCountingSessions, createCountingSession, deleteCountingSession,
    getFilterOptions, getProductCount, type CreateSessionInput
} from "@/app/actions/inventory/stock-count"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
    Plus, Search, Clock, AlertTriangle, CheckCircle2, Sparkles,
    Package, ClipboardList, Trash2, Eye, ShieldCheck, Loader2, Users
} from "lucide-react"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { SessionPopulator } from "./SyncPanel"

// ─── Types ───────────────────────────────────────────────────────
interface Session {
    id: number
    reference: string | null
    location: string
    section: string
    warehouse: number | null
    warehouse_name: string | null
    session_date: string
    status: string
    person1_name: string | null
    person2_name: string | null
    assigned_users: { user_id: number; user_name: string }[]
    products_count: number
    counted_count: number
    verified_count: number
    needs_adjustment_count: number
    created_by_name: string | null
    created_at: string
}

interface FilterOptions {
    categories: string[]
    suppliers: { id: number; company_name: string }[]
    warehouses: { id: number; name: string; code: string | null }[]
}

// ─── Status Helpers ──────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: <Clock className="w-4 h-4" /> },
    WAITING_VERIFICATION: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700', icon: <AlertTriangle className="w-4 h-4" /> },
    VERIFIED: { label: 'Verified', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-4 h-4" /> },
    ADJUSTED: { label: 'Adjusted', color: 'bg-purple-100 text-purple-700', icon: <Sparkles className="w-4 h-4" /> },
    CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', icon: <Trash2 className="w-4 h-4" /> },
}

// ─── Page ────────────────────────────────────────────────────────
export default function StockCountPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [loading, setLoading] = useState(true)
    const [isPending, startTransition] = useTransition()
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("ALL")
    const [showCreate, setShowCreate] = useState(false)
    const [activeSession, setActiveSession] = useState<{ id: number, ref?: string } | null>(null)
    const router = useRouter()

    // ─── Fetch ───
    const fetchSessions = () => {
        startTransition(async () => {
            const data = await getCountingSessions()
            setSessions(Array.isArray(data) ? data : data?.results || [])
            setLoading(false)
        })
    }
    useEffect(() => { fetchSessions() }, [])

    // ─── Filter ───
    const filtered = useMemo(() => {
        let list = sessions
        if (search) {
            const s = search.toLowerCase()
            list = list.filter(r =>
                r.location?.toLowerCase().includes(s) ||
                r.section?.toLowerCase().includes(s) ||
                r.reference?.toLowerCase().includes(s)
            )
        }
        if (statusFilter !== "ALL") list = list.filter(r => r.status === statusFilter)
        return list
    }, [sessions, search, statusFilter])

    // ─── Stats ───
    const inProgress = sessions.filter(s => s.status === 'IN_PROGRESS').length
    const pending = sessions.filter(s => s.status === 'WAITING_VERIFICATION').length
    const completed = sessions.filter(s => s.status === 'VERIFIED' || s.status === 'ADJUSTED').length

    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    // ─── Delete ───
    const handleDelete = () => {
        if (deleteTarget === null) return
        startTransition(async () => {
            await deleteCountingSession(deleteTarget)
            fetchSessions()
        })
        setDeleteTarget(null)
    }

    // ─── Create callback ───
    const handleCreated = (id: number, ref?: string) => {
        setShowCreate(false)
        setActiveSession({ id, ref })
        fetchSessions()
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Count</h1>
                    <p className="text-muted-foreground text-sm">Physical inventory counting with dual-person verification</p>
                </div>
                <Button onClick={() => setShowCreate(true)}>
                    <Plus className="w-4 h-4 mr-2" /> New Session
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="p-3 bg-blue-100 rounded-xl"><Clock className="w-5 h-5 text-blue-600" /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground">In Progress</p>
                                    <p className="text-2xl font-bold">{inProgress}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="p-3 bg-yellow-100 rounded-xl"><AlertTriangle className="w-5 h-5 text-yellow-600" /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Pending Verification</p>
                                    <p className="text-2xl font-bold">{pending}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="flex items-center gap-4 p-5">
                                <div className="p-3 bg-green-100 rounded-xl"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Completed</p>
                                    <p className="text-2xl font-bold">{completed}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="Search sessions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">All Statuses</SelectItem>
                                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                <SelectItem value="WAITING_VERIFICATION">Pending Review</SelectItem>
                                <SelectItem value="VERIFIED">Verified</SelectItem>
                                <SelectItem value="ADJUSTED">Adjusted</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Sessions Table */}
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Session</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Section</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-center">Products</TableHead>
                                        <TableHead className="text-center">Counted</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Team</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow><TableCell colSpan={9} className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                                    ) : filtered.length === 0 ? (
                                        <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No sessions found</TableCell></TableRow>
                                    ) : filtered.map(s => {
                                        const st = STATUS_MAP[s.status] || STATUS_MAP.IN_PROGRESS
                                        return (
                                            <TableRow key={s.id}>
                                                <TableCell className="font-medium">COUNT-{s.reference || s.id}</TableCell>
                                                <TableCell>{s.location}</TableCell>
                                                <TableCell className="text-muted-foreground text-sm">{s.section}</TableCell>
                                                <TableCell className="text-sm">{s.session_date}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline">{s.products_count}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="text-sm">{s.counted_count}/{s.products_count}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={st.color + " gap-1"}>{st.icon}{st.label}</Badge>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                                        <span className="text-sm">{s.assigned_users?.length || 0}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {s.status === 'IN_PROGRESS' && (
                                                            <Button size="sm" variant="outline" onClick={() => router.push(`/inventory/stock-count/${s.id}/count`)}>
                                                                <ClipboardList className="w-3.5 h-3.5 mr-1" /> Count
                                                            </Button>
                                                        )}
                                                        {(s.status === 'WAITING_VERIFICATION' || s.status === 'VERIFIED') && (
                                                            <Button size="sm" variant="outline" onClick={() => router.push(`/inventory/stock-count/${s.id}/verify`)}>
                                                                <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verify
                                                            </Button>
                                                        )}
                                                        {s.status === 'ADJUSTED' && (
                                                            <Button size="sm" variant="outline" onClick={() => router.push(`/inventory/stock-count/${s.id}/verify`)}>
                                                                <Eye className="w-3.5 h-3.5 mr-1" /> View
                                                            </Button>
                                                        )}
                                                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTarget(s.id)}>
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>

                    {/* Create Modal */}
                    {showCreate && <CreateSessionDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />}

                    <ConfirmDialog
                        open={deleteTarget !== null}
                        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                        onConfirm={handleDelete}
                        title="Delete Session?"
                        description="This will permanently delete this counting session. This cannot be undone."
                        confirmText="Delete"
                        variant="danger"
                    />
                </div>

                <div className="lg:col-span-1">
                    <SessionPopulator
                        sessionId={activeSession?.id}
                        sessionRef={activeSession?.ref}
                        onComplete={fetchSessions}
                    />
                </div>
            </div>
        </div>
    )
}

// ─── Create Session Dialog ───────────────────────────────────────
function CreateSessionDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number, ref?: string) => void }) {
    const [isPending, startTransition] = useTransition()
    const [filterOpts, setFilterOpts] = useState<FilterOptions | null>(null)
    const [productPreview, setProductPreview] = useState<number | null>(null)
    const [form, setForm] = useState({
        warehouse_id: '',
        category: '',
        supplier_id: '',
        qty_filter: '',
        qty_min: '',
        qty_max: '',
        person1_name: '',
        person2_name: '',
    })

    useEffect(() => {
        startTransition(async () => {
            const opts = await getFilterOptions()
            setFilterOpts(opts)
        })
    }, [])

    // Preview product count when filters change
    useEffect(() => {
        const params: Record<string, string> = {}
        if (form.category) params.category = form.category
        if (form.supplier_id) params.supplier_id = form.supplier_id
        if (form.qty_filter) {
            params.qty_filter = form.qty_filter
            if (form.qty_filter === 'custom') {
                if (form.qty_min) params.qty_min = form.qty_min
                if (form.qty_max) params.qty_max = form.qty_max
            }
        }
        startTransition(async () => {
            const data = await getProductCount(params)
            setProductPreview(data?.total ?? null)
        })
    }, [form.category, form.supplier_id, form.qty_filter, form.qty_min, form.qty_max])

    const handleSubmit = () => {
        const wh = filterOpts?.warehouses.find(w => w.id.toString() === form.warehouse_id)
        const data: CreateSessionInput = {
            location: wh?.name || 'All Locations',
            section: form.category || 'All Categories',
            warehouse: wh ? wh.id : undefined,
            session_date: new Date().toISOString().split('T')[0],
            person1_name: form.person1_name || undefined,
            person2_name: form.person2_name || undefined,
            category_filter: form.category || undefined,
            supplier_filter: form.supplier_id ? parseInt(form.supplier_id) : undefined,
            qty_filter: form.qty_filter || undefined,
            qty_min: form.qty_filter === 'custom' && form.qty_min ? parseFloat(form.qty_min) : undefined,
            qty_max: form.qty_filter === 'custom' && form.qty_max ? parseFloat(form.qty_max) : undefined,
        }
        startTransition(async () => {
            const res = await createCountingSession(data)
            if (res && res.id) {
                onCreated(res.id, res.reference)
            } else {
                onCreated(0) // Fallback
            }
        })
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>New Counting Session</DialogTitle>
                    <DialogDescription>Select a warehouse and filters to scope which products to count.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Warehouse */}
                    <div className="space-y-2">
                        <Label>Warehouse / Location</Label>
                        <Select value={form.warehouse_id} onValueChange={v => setForm(f => ({ ...f, warehouse_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                            <SelectContent>
                                {filterOpts?.warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id.toString()}>{w.name}{w.code ? ` (${w.code})` : ''}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                        <Label>Category Filter</Label>
                        <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                            <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value=" ">All Categories</SelectItem>
                                {filterOpts?.categories.map(c => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Supplier */}
                    <div className="space-y-2">
                        <Label>Supplier Filter</Label>
                        <Select value={form.supplier_id} onValueChange={v => setForm(f => ({ ...f, supplier_id: v }))}>
                            <SelectTrigger><SelectValue placeholder="All Suppliers" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value=" ">All Suppliers</SelectItem>
                                {filterOpts?.suppliers.map(s => (
                                    <SelectItem key={s.id} value={s.id.toString()}>{s.company_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Qty Filter */}
                    <div className="space-y-2">
                        <Label>Quantity Filter</Label>
                        <Select value={form.qty_filter} onValueChange={v => setForm(f => ({ ...f, qty_filter: v }))}>
                            <SelectTrigger><SelectValue placeholder="All Quantities" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value=" ">All Quantities</SelectItem>
                                <SelectItem value="zero">Zero Qty Only (= 0)</SelectItem>
                                <SelectItem value="non_zero">Non-Zero Only (&gt; 0)</SelectItem>
                                <SelectItem value="custom">Custom Range</SelectItem>
                            </SelectContent>
                        </Select>
                        {form.qty_filter === 'custom' && (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <div>
                                    <Label className="text-xs">Min</Label>
                                    <Input type="number" value={form.qty_min} onChange={e => setForm(f => ({ ...f, qty_min: e.target.value }))} placeholder="0" />
                                </div>
                                <div>
                                    <Label className="text-xs">Max</Label>
                                    <Input type="number" value={form.qty_max} onChange={e => setForm(f => ({ ...f, qty_max: e.target.value }))} placeholder="No limit" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Product Count Preview */}
                    {productPreview !== null && (
                        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="p-2 bg-blue-600 rounded-lg"><Package className="w-5 h-5 text-white" /></div>
                            <div>
                                <p className="text-xs text-muted-foreground">Products to count</p>
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{productPreview.toLocaleString()}</p>
                            </div>
                        </div>
                    )}

                    {/* Person Names */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label>Person 1 Name</Label>
                            <Input value={form.person1_name} onChange={e => setForm(f => ({ ...f, person1_name: e.target.value }))} placeholder="Counter 1" />
                        </div>
                        <div className="space-y-2">
                            <Label>Person 2 Name</Label>
                            <Input value={form.person2_name} onChange={e => setForm(f => ({ ...f, person2_name: e.target.value }))} placeholder="Counter 2" />
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isPending}>
                        {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Session'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
