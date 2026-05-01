'use client'

import { useState, useCallback } from 'react'
import {
    FileText, Plus, Send, Check, X, ShoppingCart, Trash2, Search,
    ArrowRight, ChevronDown, Calendar, User
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    createQuotation, deleteQuotation,
    addQuotationLine, removeQuotationLine,
    sendQuotation, acceptQuotation, rejectQuotation,
    convertQuotationToOrder,
} from '@/app/actions/quotations'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Contact { id: number; name: string }
interface Product { id: number; sku: string; name: string; selling_price_ttc: number; tva_rate: number }
interface QuotationLine {
    id: number; product: number; product_name: string; product_sku: string
    quantity: number; unit_price_ttc: number; total_ttc: number; discount: number
}
interface Quotation {
    id: number; reference: string | null; status: string
    contact_name: string | null; contact: number | null
    total_ttc: number; total_ht: number; total_tax: number; discount: number
    valid_until: string | null; notes: string | null
    converted_order: number | null; created_at: string
    lines: QuotationLine[]; line_count: number
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    DRAFT: { label: 'Draft', color: 'bg-app-surface-2 text-app-foreground' },
    SENT: { label: 'Sent', color: 'bg-app-info-bg text-app-info' },
    ACCEPTED: { label: 'Accepted', color: 'bg-app-success-bg text-app-success' },
    REJECTED: { label: 'Rejected', color: 'bg-app-error-bg text-app-error' },
    EXPIRED: { label: 'Expired', color: 'bg-app-warning-bg text-app-warning' },
    CONVERTED: { label: 'Converted', color: 'bg-purple-100 text-purple-700' },
}

const fmt = (n: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(n)

export default function QuotationManager({
    initialQuotations, contacts, products,
}: {
    initialQuotations: Quotation[]
    contacts: Contact[]
    products: Product[]
}) {
    const [quotations, setQuotations] = useState<Quotation[]>(initialQuotations)
    const [selected, setSelected] = useState<Quotation | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [showAddLine, setShowAddLine] = useState(false)
    const [loading, setLoading] = useState(false)
    const [filter, setFilter] = useState('')
    const [productSearch, setProductSearch] = useState('')

    // Create form state
    const [newRef, setNewRef] = useState('')
    const [newContact, setNewContact] = useState<number | null>(null)
    const [newValidUntil, setNewValidUntil] = useState('')
    const [newNotes, setNewNotes] = useState('')

    // Add line form state
    const [lineProductId, setLineProductId] = useState<number | null>(null)
    const [lineQty, setLineQty] = useState(1)
    const [lineDiscount, setLineDiscount] = useState(0)

    const refreshQuotation = useCallback(async (id: number) => {
        try {
            const { getQuotation } = await import('@/app/actions/quotations')
            const updated = await getQuotation(id)
            setQuotations(prev => prev.map(q => q.id === id ? updated : q))
            setSelected(updated)
        } catch { /* ignore */ }
    }, [])

    const handleCreate = async () => {
        setLoading(true)
        try {
            const res = await createQuotation({
                reference: newRef || undefined,
                contact: newContact || undefined,
                valid_until: newValidUntil || undefined,
                notes: newNotes || undefined,
            })
            setQuotations(prev => [res, ...prev])
            setSelected(res)
            setShowCreate(false)
            setNewRef(''); setNewContact(null); setNewValidUntil(''); setNewNotes('')
        } catch { /* ignore */ }
        setLoading(false)
    }

    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    const handleDelete = async () => {
        if (deleteTarget === null) return
        setLoading(true)
        try {
            await deleteQuotation(deleteTarget)
            setQuotations(prev => prev.filter(q => q.id !== deleteTarget))
            if (selected?.id === deleteTarget) setSelected(null)
        } catch { /* ignore */ }
        setLoading(false)
        setDeleteTarget(null)
    }

    const handleAddLine = async () => {
        if (!selected || !lineProductId) return
        setLoading(true)
        try {
            await addQuotationLine(selected.id, {
                product_id: lineProductId,
                quantity: lineQty,
                discount: lineDiscount,
            })
            await refreshQuotation(selected.id)
            setShowAddLine(false)
            setLineProductId(null); setLineQty(1); setLineDiscount(0); setProductSearch('')
        } catch { /* ignore */ }
        setLoading(false)
    }

    const handleRemoveLine = async (lineId: number) => {
        if (!selected) return
        setLoading(true)
        try {
            await removeQuotationLine(selected.id, lineId)
            await refreshQuotation(selected.id)
        } catch { /* ignore */ }
        setLoading(false)
    }

    const handleAction = async (action: 'send' | 'accept' | 'reject' | 'convert') => {
        if (!selected) return
        setLoading(true)
        try {
            const fns = { send: sendQuotation, accept: acceptQuotation, reject: rejectQuotation, convert: convertQuotationToOrder }
            const res = await fns[action](selected.id)
            if (action === 'convert' && res.quotation) {
                setQuotations(prev => prev.map(q => q.id === selected.id ? res.quotation : q))
                setSelected(res.quotation)
                toast.success(`Order created: ${res.ref_code}`)
            } else {
                await refreshQuotation(selected.id)
            }
        } catch { /* ignore */ }
        setLoading(false)
    }

    const filteredQuotations = quotations.filter(q => {
        if (!filter) return true
        const f = filter.toLowerCase()
        return (
            q.reference?.toLowerCase().includes(f) ||
            q.contact_name?.toLowerCase().includes(f) ||
            q.status.toLowerCase().includes(f)
        )
    })

    const filteredProducts = products.filter(p => {
        if (!productSearch) return true
        const s = productSearch.toLowerCase()
        return p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)
    }).slice(0, 20)

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Quotation List */}
            <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Quotations</CardTitle>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                        >
                            <Plus size={14} /> New
                        </button>
                    </div>
                    <div className="relative mt-2">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                            placeholder="Search quotations..."
                            value={filter}
                            onChange={e => setFilter(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
                    {filteredQuotations.length === 0 && (
                        <p className="text-sm text-app-muted-foreground text-center py-8">No quotations yet</p>
                    )}
                    {filteredQuotations.map(q => {
                        const cfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.DRAFT
                        const isActive = selected?.id === q.id
                        return (
                            <button
                                key={q.id}
                                onClick={() => setSelected(q)}
                                className={`w-full text-left p-3 rounded-xl transition-all ${isActive ? 'bg-app-success-bg border border-app-success' : 'hover:bg-app-surface border border-transparent'
                                    }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">
                                        {q.reference || `QUO-${q.id}`}
                                    </span>
                                    <Badge className={`text-[10px] ${cfg.color}`}>{cfg.label}</Badge>
                                </div>
                                <div className="flex items-center justify-between mt-1 text-xs text-app-muted-foreground">
                                    <span>{q.contact_name || 'No client'}</span>
                                    <span className="font-semibold text-app-muted-foreground">{fmt(q.total_ttc)}</span>
                                </div>
                            </button>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Right: Detail / Actions */}
            <div className="lg:col-span-2 space-y-6">
                {!selected ? (
                    <Card>
                        <CardContent className="py-16 text-center text-app-muted-foreground">
                            <FileText size={48} className="mx-auto mb-3 opacity-30" />
                            <p>Select a quotation or create a new one</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Header */}
                        <Card>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-lg font-bold">{selected.reference || `QUO-${selected.id}`}</h2>
                                        <div className="flex items-center gap-3 text-xs text-app-muted-foreground mt-1">
                                            {selected.contact_name && (
                                                <span className="flex items-center gap-1"><User size={12} />{selected.contact_name}</span>
                                            )}
                                            {selected.valid_until && (
                                                <span className="flex items-center gap-1"><Calendar size={12} />Valid: {selected.valid_until}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge className={STATUS_CONFIG[selected.status]?.color || ''}>
                                            {STATUS_CONFIG[selected.status]?.label || selected.status}
                                        </Badge>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {selected.status === 'DRAFT' && (
                                        <button onClick={() => handleAction('send')} disabled={loading}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-40">
                                            <Send size={14} /> Mark as Sent
                                        </button>
                                    )}
                                    {['DRAFT', 'SENT'].includes(selected.status) && (
                                        <>
                                            <button onClick={() => handleAction('accept')} disabled={loading}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-40">
                                                <Check size={14} /> Accept
                                            </button>
                                            <button onClick={() => handleAction('reject')} disabled={loading}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 disabled:opacity-40">
                                                <X size={14} /> Reject
                                            </button>
                                        </>
                                    )}
                                    {['DRAFT', 'SENT', 'ACCEPTED'].includes(selected.status) && !selected.converted_order && (
                                        <button onClick={() => handleAction('convert')} disabled={loading}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 disabled:opacity-40">
                                            <ShoppingCart size={14} /> Convert to Order
                                        </button>
                                    )}
                                    {selected.status === 'DRAFT' && (
                                        <button onClick={() => setDeleteTarget(selected.id)} disabled={loading}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-app-surface-2 text-app-error text-xs font-bold rounded-lg hover:bg-app-error-bg disabled:opacity-40 ml-auto">
                                            <Trash2 size={14} /> Delete
                                        </button>
                                    )}
                                </div>

                                {selected.converted_order && (
                                    <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2 text-sm text-purple-700">
                                        <ArrowRight size={16} />
                                        Converted to Order #{selected.converted_order}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Totals */}
                        <div className="grid grid-cols-3 gap-4">
                            <Card>
                                <CardContent className="py-4 text-center">
                                    <p className="text-xs text-app-muted-foreground mb-1">Subtotal HT</p>
                                    <p className="text-lg font-bold">{fmt(selected.total_ht)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="py-4 text-center">
                                    <p className="text-xs text-app-muted-foreground mb-1">Tax</p>
                                    <p className="text-lg font-bold">{fmt(selected.total_tax)}</p>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="py-4 text-center">
                                    <p className="text-xs text-app-muted-foreground mb-1">Total TTC</p>
                                    <p className="text-lg font-bold text-app-success">{fmt(selected.total_ttc)}</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Lines */}
                        <Card>
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Line Items</CardTitle>
                                    {['DRAFT', 'SENT'].includes(selected.status) && (
                                        <button
                                            onClick={() => setShowAddLine(true)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                                        >
                                            <Plus size={14} /> Add Product
                                        </button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(!selected.lines || selected.lines.length === 0) ? (
                                    <p className="text-sm text-app-muted-foreground text-center py-6">No items yet — add products to this quotation</p>
                                ) : (
                                    <div className="space-y-2">
                                        {selected.lines.map(line => (
                                            <div key={line.id} className="flex items-center gap-4 p-3 bg-app-surface rounded-xl">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{line.product_name}</p>
                                                    <p className="text-xs text-app-muted-foreground">{line.product_sku} × {line.quantity}</p>
                                                </div>
                                                <span className="text-sm font-semibold">{fmt(line.total_ttc)}</span>
                                                {['DRAFT', 'SENT'].includes(selected.status) && (
                                                    <button
                                                        onClick={() => handleRemoveLine(line.id)}
                                                        className="p-1.5 text-red-400 hover:text-app-error hover:bg-app-error-bg rounded-lg"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowCreate(false)}>
                    <div className="bg-app-surface rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">New Quotation</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-1">Reference</label>
                                <input className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="e.g. PRO-2026-001" value={newRef} onChange={e => setNewRef(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-1">Client</label>
                                <select className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={newContact || ''} onChange={e => setNewContact(e.target.value ? Number(e.target.value) : null)}>
                                    <option value="">No client</option>
                                    {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-1">Valid Until</label>
                                <input type="date" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={newValidUntil} onChange={e => setNewValidUntil(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-1">Notes</label>
                                <textarea className="w-full px-3 py-2 border rounded-lg text-sm resize-none h-20 focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={newNotes} onChange={e => setNewNotes(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowCreate(false)}
                                className="px-4 py-2 text-sm text-app-muted-foreground hover:bg-app-surface-2 rounded-lg">Cancel</button>
                            <button onClick={handleCreate} disabled={loading}
                                className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-40">
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Line Modal */}
            {showAddLine && selected && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowAddLine(false)}>
                    <div className="bg-app-surface rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">Add Product Line</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-app-muted-foreground mb-1">Product</label>
                                <input className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none mb-2"
                                    placeholder="Search products..." value={productSearch}
                                    onChange={e => setProductSearch(e.target.value)} />
                                <div className="max-h-40 overflow-y-auto border rounded-lg">
                                    {filteredProducts.map(p => (
                                        <button key={p.id} onClick={() => { setLineProductId(p.id); setProductSearch(p.name) }}
                                            className={`w-full text-left p-2 text-sm hover:bg-app-surface border-b last:border-0 ${lineProductId === p.id ? 'bg-app-success-bg' : ''}`}>
                                            <span className="font-medium">{p.name}</span>
                                            <span className="text-app-muted-foreground ml-2">{p.sku}</span>
                                            <span className="float-right text-app-muted-foreground">{fmt(p.selling_price_ttc)}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-app-muted-foreground mb-1">Quantity</label>
                                    <input type="number" min={1} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={lineQty} onChange={e => setLineQty(Number(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-app-muted-foreground mb-1">Discount</label>
                                    <input type="number" min={0} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={lineDiscount} onChange={e => setLineDiscount(Number(e.target.value))} />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button onClick={() => setShowAddLine(false)}
                                className="px-4 py-2 text-sm text-app-muted-foreground hover:bg-app-surface-2 rounded-lg">Cancel</button>
                            <button onClick={handleAddLine} disabled={loading || !lineProductId}
                                className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-40">
                                Add to Quotation
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleDelete}
                title="Delete Quotation?"
                description="This will permanently remove this quotation and all its line items."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    )
}
