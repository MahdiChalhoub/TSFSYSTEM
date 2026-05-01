'use client'

import { useState, useEffect, useMemo } from 'react'
import { Eye, Briefcase, Package, FileText, Clock, CheckCircle2, AlertCircle, XCircle, ChevronDown, Search, TrendingUp, DollarSign, Truck } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────
interface Supplier {
    id: number
    name: string
    email?: string
    phone?: string
    type?: string
}

interface PurchaseOrder {
    id: number
    po_number: string
    status: string
    total_amount: number | string
    order_date?: string
    expected_date?: string
    line_count?: number
    purchase_sub_type?: string
}

// ─── Status styling ─────────────────────────────────────────
const PO_STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
    DRAFT: { bg: 'bg-app-surface-2/10', text: 'text-app-muted-foreground', icon: FileText },
    SUBMITTED: { bg: 'bg-app-info/10', text: 'text-app-info', icon: Clock },
    APPROVED: { bg: 'bg-app-primary/10', text: 'text-app-success', icon: CheckCircle2 },
    SENT: { bg: 'bg-indigo-500/10', text: 'text-app-info', icon: Truck },
    PARTIALLY_RECEIVED: { bg: 'bg-app-warning/10', text: 'text-app-warning', icon: Package },
    RECEIVED: { bg: 'bg-app-primary/10', text: 'text-app-success', icon: CheckCircle2 },
    REJECTED: { bg: 'bg-app-error/10', text: 'text-app-error', icon: XCircle },
    CANCELLED: { bg: 'bg-app-error/10', text: 'text-app-error', icon: AlertCircle },
}

// ─── Data fetchers ──────────────────────────────────────────
async function fetchSuppliers(): Promise<Supplier[]> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch('contacts/?type=SUPPLIER')
}

async function fetchPOsForSupplier(supplierId: number): Promise<PurchaseOrder[]> {
    const { erpFetch } = await import('@/lib/erp-api')
    return await erpFetch(`purchase-orders/?supplier=${supplierId}`)
}

// ─── Component ──────────────────────────────────────────────
export default function SupplierGatePreviewClient() {
    const [suppliers, setSuppliers] = useState<Supplier[]>([])
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
    const [pos, setPos] = useState<PurchaseOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingPOs, setLoadingPOs] = useState(false)
    const [dropdownOpen, setDropdownOpen] = useState(false)
    const [supplierSearch, setSupplierSearch] = useState('')

    useEffect(() => {
        fetchSuppliers()
            .then(s => { setSuppliers(Array.isArray(s) ? s : []); })
            .catch(() => { })
            .finally(() => setLoading(false))
    }, [])

    const selectSupplier = async (supplier: Supplier) => {
        setSelectedSupplier(supplier)
        setDropdownOpen(false)
        setSupplierSearch('')
        setLoadingPOs(true)
        try {
            const data = await fetchPOsForSupplier(supplier.id)
            setPos(Array.isArray(data) ? data : [])
        } catch { setPos([]) }
        finally { setLoadingPOs(false) }
    }

    const filteredSuppliers = useMemo(() => {
        if (!supplierSearch) return suppliers
        const q = supplierSearch.toLowerCase()
        return suppliers.filter(s => s.name.toLowerCase().includes(q))
    }, [suppliers, supplierSearch])

    // Compute summary stats
    const totalValue = pos.reduce((sum, po) => sum + Number(po.total_amount || 0), 0)
    const activeCount = pos.filter(po => !['CANCELLED', 'REJECTED'].includes(po.status)).length
    const receivedCount = pos.filter(po => po.status === 'RECEIVED' || po.status === 'COMPLETED').length

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex items-center gap-3 text-app-muted-foreground">
                    <div className="w-6 h-6 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
                    Loading suppliers...
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-app-info-bg border border-app-info flex items-center justify-center">
                    <Eye size={22} className="text-app-info" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-app-foreground tracking-tight">Supplier Gate Preview</h1>
                    <p className="text-sm text-app-muted-foreground">Select a supplier to see what they see when they access their portal</p>
                </div>
            </div>

            {/* Supplier Selector */}
            <div className="bg-app-surface rounded-xl border border-app-border p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <Briefcase size={14} className="text-app-muted-foreground" />
                    <span className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Select Supplier</span>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-app-surface border border-app-border rounded-xl text-sm hover:bg-app-surface-2 transition-colors"
                    >
                        <span className={selectedSupplier ? 'text-app-foreground font-bold' : 'text-app-muted-foreground'}>
                            {selectedSupplier ? selectedSupplier.name : 'Choose a supplier to preview...'}
                        </span>
                        <ChevronDown size={16} className={`text-app-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {dropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-app-surface border border-app-border rounded-xl shadow-2xl z-50 max-h-72 overflow-hidden">
                            <div className="p-2 border-b border-app-border">
                                <div className="relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                    <input
                                        value={supplierSearch}
                                        onChange={e => setSupplierSearch(e.target.value)}
                                        placeholder="Search suppliers..."
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-app-border rounded-lg focus:outline-none focus:border-app-info"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto max-h-56">
                                {filteredSuppliers.length === 0 ? (
                                    <p className="text-center py-4 text-sm text-app-muted-foreground">No suppliers found</p>
                                ) : filteredSuppliers.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => selectSupplier(s)}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-app-info-bg transition-colors flex items-center justify-between ${selectedSupplier?.id === s.id ? 'bg-app-info-bg font-bold text-app-info' : 'text-app-foreground'
                                            }`}
                                    >
                                        <span>{s.name}</span>
                                        {s.email && <span className="text-[10px] text-app-muted-foreground">{s.email}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Supplier Portal Preview */}
            {selectedSupplier && (
                <div className="bg-[#020617] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
                    {/* Portal Header */}
                    <div className="p-8 pb-4">
                        <div className="max-w-6xl mx-auto">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-app-info/30 flex items-center justify-center">
                                    <Briefcase size={18} className="text-app-info" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white">Supplier Portal</h2>
                                    <p className="text-xs text-app-muted-foreground">Welcome, <span className="text-app-info font-bold">{selectedSupplier.name}</span></p>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-3 mb-6">
                                <div className="px-5 py-3 bg-app-surface/5 border border-white/5 rounded-2xl">
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Active Orders</span>
                                    <div className="text-2xl font-black text-white flex items-center gap-2">
                                        <TrendingUp size={14} className="text-app-success" />{activeCount}
                                    </div>
                                </div>
                                <div className="px-5 py-3 bg-app-surface/5 border border-white/5 rounded-2xl">
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Fulfilled</span>
                                    <div className="text-2xl font-black text-white flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-app-info" />{receivedCount}
                                    </div>
                                </div>
                                <div className="px-5 py-3 bg-app-surface/5 border border-white/5 rounded-2xl">
                                    <span className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">Total Value</span>
                                    <div className="text-2xl font-black text-white flex items-center gap-2">
                                        <DollarSign size={14} className="text-app-warning" />{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PO List */}
                    <div className="bg-[#0a0f1e] p-8 pt-4">
                        <div className="max-w-6xl mx-auto">
                            <h3 className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider mb-4">Purchase Orders</h3>
                            {loadingPOs ? (
                                <div className="flex items-center justify-center py-16">
                                    <div className="w-6 h-6 border-2 border-gray-700 border-t-indigo-400 rounded-full animate-spin" />
                                </div>
                            ) : pos.length === 0 ? (
                                <div className="text-center py-16">
                                    <FileText size={40} className="text-app-foreground mx-auto mb-3" />
                                    <p className="text-app-muted-foreground font-medium">No purchase orders with this supplier</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {pos.map(po => {
                                        const style = PO_STATUS_STYLES[po.status] || PO_STATUS_STYLES.DRAFT
                                        const Icon = style.icon
                                        return (
                                            <div key={po.id} className="flex items-center gap-4 p-4 bg-app-surface/5 border border-white/5 rounded-xl hover:border-app-info/20 transition-all">
                                                <div className={`w-9 h-9 rounded-lg ${style.bg} flex items-center justify-center flex-shrink-0`}>
                                                    <Icon size={16} className={style.text} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-white">{po.po_number}</span>
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${style.bg} ${style.text}`}>
                                                            {po.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-0.5">
                                                        {po.order_date && <span className="text-[10px] text-app-muted-foreground">{new Date(po.order_date).toLocaleDateString()}</span>}
                                                        {po.line_count !== undefined && <span className="text-[10px] text-app-muted-foreground">{po.line_count} items</span>}
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0">
                                                    <span className="text-sm font-black text-white">${Number(po.total_amount || 0).toLocaleString()}</span>
                                                    {po.expected_date && (
                                                        <p className="text-[10px] text-app-muted-foreground mt-0.5">Due {new Date(po.expected_date).toLocaleDateString()}</p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!selectedSupplier && (
                <div className="bg-app-surface rounded-2xl border border-dashed border-app-border p-16 text-center">
                    <Briefcase size={40} className="text-app-faint mx-auto mb-3" />
                    <p className="text-app-muted-foreground font-semibold">Select a supplier above</p>
                    <p className="text-xs text-app-muted-foreground mt-1">You&apos;ll see exactly what they see when they access their portal</p>
                </div>
            )}
        </div>
    )
}
