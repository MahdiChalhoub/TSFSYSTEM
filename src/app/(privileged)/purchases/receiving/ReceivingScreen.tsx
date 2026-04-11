// @ts-nocheck
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useCurrency } from '@/lib/utils/currency'
import {
    startReceivingSession, addReceivingLine, receiveLine, rejectLine, resetLine,
    finalizeReceiving, getDecisionPreview, getReceivingSession,
    type GoodsReceipt, type GoodsReceiptLine
} from '@/app/actions/inventory/goods-receipt'
import { fetchPurchaseOrders } from '@/app/actions/pos/purchases'
import { getContactsByType } from '@/app/actions/crm/contacts'
import {
    Package, Truck, Search, PackageCheck, PackageX, ScanBarcode,
    ChevronLeft, Check, X, AlertTriangle, ArrowRightLeft, ShieldCheck,
    Clock, Loader2, RefreshCw, Eye, Camera, Calendar,
    BarChart3, TrendingUp, TrendingDown, Info, BookOpen,
    ChevronDown, ChevronUp, Warehouse as WarehouseIcon, Store
} from 'lucide-react'
import Link from 'next/link'
import SmartDatePicker from '@/components/ui/SmartDatePicker'

// ═══════════════════════════════════════════════════════════════════════════
// BADGE CONFIG — Decision engine warning badges
// ═══════════════════════════════════════════════════════════════════════════

const BADGE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
    SAFE_TO_RECEIVE: { label: 'Safe to Receive', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Check },
    OVERSTOCK_RISK: { label: 'Overstock Risk', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertTriangle },
    EXCESS_RECEIPT: { label: 'Excess Receipt', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertTriangle },
    EXPIRY_RISK: { label: 'Expiry Risk', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: Clock },
    SHELF_ROTATION_NEEDED: { label: 'Shelf Rotation', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', icon: RefreshCw },
    TRANSFER_TO_WAREHOUSE: { label: 'Transfer → Warehouse', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: WarehouseIcon },
    TRANSFER_TO_STORE: { label: 'Transfer → Store', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Store },
    UNEXPECTED_ITEM: { label: 'Unexpected Item', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: AlertTriangle },
    APPROVAL_REQUIRED: { label: 'Approval Required', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: ShieldCheck },
    HIGH_ADJUSTMENT_RISK: { label: 'High Risk Item', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: TrendingDown },
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
    PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    SCANNED: { label: 'Scanned', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    RECEIVED: { label: 'Received', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    PARTIALLY_RECEIVED: { label: 'Partial', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    UNDER_REVIEW: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
    APPROVAL_REQUIRED: { label: 'Needs Approval', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    CLOSED: { label: 'Closed', color: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}

const REJECTION_REASONS = [
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'SHORT_SHELF_LIFE', label: 'Short Shelf Life' },
    { value: 'QUALITY_ISSUE', label: 'Quality Issue' },
    { value: 'NOT_ORDERED', label: 'Not Ordered' },
    { value: 'WRONG_PRODUCT', label: 'Wrong Product' },
    { value: 'OTHER', label: 'Other' },
]

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function ReceivingScreen() {
    const params = useSearchParams()
    const router = useRouter()
    const { fmt } = useCurrency()

    // Session state
    const [session, setSession] = useState<GoodsReceipt | null>(null)
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    // Mode selection (before session starts)
    const fromPO = params.get('from_po')
    const initialMode = (fromPO || params.get('mode') === 'po') ? 'PO_BASED' : 'DIRECT'
    const [mode, setMode] = useState<'DIRECT' | 'PO_BASED'>(initialMode)
    const [selectedPO, setSelectedPO] = useState<number | null>(null)
    const [selectedWarehouse, setSelectedWarehouse] = useState<number | null>(null)
    const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null)
    const [purchaseOrders, setPurchaseOrders] = useState<any[]>([])
    const [warehouses, setWarehouses] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<any[]>([])
    const autoStarted = useRef(false)

    // Product search
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [searchLoading, setSearchLoading] = useState(false)
    const searchTimeout = useRef<NodeJS.Timeout | null>(null)

    // Popup state
    const [popup, setPopup] = useState<{
        line?: GoodsReceiptLine
        preview?: Record<string, any>
        product?: any
        action: 'receive' | 'reject' | 'new'
    } | null>(null)

    // Popup form
    const [popupQty, setPopupQty] = useState('')
    const [popupExpiry, setPopupExpiry] = useState('')
    const [popupBatch, setPopupBatch] = useState('')
    const [popupRejReason, setPopupRejReason] = useState('DAMAGED')
    const [popupRejNotes, setPopupRejNotes] = useState('')

    // Tab state for sections
    const [activeTab, setActiveTab] = useState<'pending' | 'received' | 'rejected'>('pending')

    // ── Load initial data ──
    useEffect(() => {
        loadPurchaseOrders()
        loadWarehouses()
        loadSuppliers()
    }, [])

    // ── Auto-start from PO link (?from_po=<id>) ──
    useEffect(() => {
        if (!fromPO || autoStarted.current) return
        autoStarted.current = true

        ;(async () => {
            setLoading(true)
            try {
                // Fetch the PO to get warehouse + supplier
                const po = await fetchPurchaseOrders()
                const poList = Array.isArray(po) ? po : (po?.results ?? [])
                const targetPO = poList.find((p: any) => String(p.id) === fromPO)

                const warehouseId = targetPO?.warehouse_id || targetPO?.warehouse?.id || null
                const supplierId = targetPO?.supplier?.id || targetPO?.supplier_id || null

                if (warehouseId) setSelectedWarehouse(warehouseId)
                if (supplierId) setSelectedSupplier(supplierId)
                setSelectedPO(Number(fromPO))
                setMode('PO_BASED')

                // Auto-start if we have the required warehouse
                if (warehouseId) {
                    const result = await startReceivingSession({
                        mode: 'PO_BASED',
                        warehouse_id: warehouseId,
                        purchase_order_id: Number(fromPO),
                    })
                    setSession(result)
                    if (result.lines?.length > 0) setActiveTab('pending')
                    toast.success(`Session ${result.receipt_number} started from PO`)
                } else {
                    toast.info('Please select a warehouse to start receiving')
                }
            } catch (e: any) {
                toast.error(e?.message || 'Failed to auto-start from PO')
            }
            setLoading(false)
        })()
    }, [fromPO])

    async function loadPurchaseOrders() {
        try {
            const data = await fetchPurchaseOrders()
            const list = Array.isArray(data) ? data : (data?.results ?? [])
            setPurchaseOrders(list.filter((po: any) =>
                ['APPROVED', 'SENT', 'CONFIRMED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(po.status)
            ))
        } catch { setPurchaseOrders([]) }
    }

    async function loadWarehouses() {
        try {
            const { erpFetch } = await import('@/lib/erp-api')
            const data = await erpFetch('inventory/warehouses/')
            setWarehouses(Array.isArray(data) ? data : (data?.results ?? []))
        } catch { setWarehouses([]) }
    }

    async function loadSuppliers() {
        try {
            const data = await getContactsByType('SUPPLIER')
            const list = Array.isArray(data) ? data : (data?.results ?? [])
            setSuppliers(list)
        } catch { setSuppliers([]) }
    }

    // Filtered POs based on selected supplier
    const filteredPurchaseOrders = selectedSupplier
        ? purchaseOrders.filter((po: any) => po.supplier === selectedSupplier || po.supplier?.id === selectedSupplier)
        : purchaseOrders

    // ── Start Session ──
    async function handleStartSession() {
        if (!selectedWarehouse) {
            toast.error('Please select a receiving location')
            return
        }
        if (mode === 'PO_BASED' && !selectedPO) {
            toast.error('Please select a Purchase Order')
            return
        }

        setLoading(true)
        try {
            const result = await startReceivingSession({
                mode,
                warehouse_id: selectedWarehouse,
                purchase_order_id: mode === 'PO_BASED' ? selectedPO : null,
            })
            setSession(result)
            if (result.lines?.length > 0) {
                setActiveTab('pending')
            }
            toast.success(`Session ${result.receipt_number} started`)
        } catch (e: any) {
            toast.error(e?.message || 'Failed to start session')
        }
        setLoading(false)
    }

    // ── Product Search ──
    function handleSearch(query: string) {
        setSearchQuery(query)
        if (searchTimeout.current) clearTimeout(searchTimeout.current)
        if (!query.trim()) { setSearchResults([]); return }

        searchTimeout.current = setTimeout(async () => {
            setSearchLoading(true)
            try {
                const { erpFetch } = await import('@/lib/erp-api')
                const data = await erpFetch(`inventory/products/?search=${encodeURIComponent(query)}&page_size=10`)
                setSearchResults(Array.isArray(data) ? data : (data?.results ?? []))
            } catch { setSearchResults([]) }
            setSearchLoading(false)
        }, 300)
    }

    // ── Add Product (opens popup with decision preview) ──
    async function handleSelectProduct(product: any) {
        if (!session) return
        setSearchQuery('')
        setSearchResults([])

        try {
            const preview = await getDecisionPreview(session.id, {
                product_id: product.id,
                qty_received: 0,
            })
            setPopup({ product, preview, action: 'new' })
            setPopupQty('')
            setPopupExpiry('')
            setPopupBatch('')
        } catch (e: any) {
            toast.error(e?.message || 'Failed to get decision preview')
        }
    }

    // ── Open line in popup ──
    function handleOpenLine(line: GoodsReceiptLine, action: 'receive' | 'reject') {
        setPopup({ line, action })
        setPopupQty(String(line.qty_ordered || ''))
        setPopupExpiry(line.expiry_date || '')
        setPopupBatch(line.batch_number || '')
        setPopupRejReason('DAMAGED')
        setPopupRejNotes('')
    }

    // ── Submit popup ──
    async function handlePopupSubmit() {
        if (!session) return
        setActionLoading(true)

        try {
            if (popup?.action === 'new' && popup.product) {
                // Add new line and receive
                const line = await addReceivingLine(session.id, {
                    product_id: popup.product.id,
                    qty_received: Number(popupQty) || 0,
                    expiry_date: popupExpiry || null,
                    batch_number: popupBatch,
                })

                if (Number(popupQty) > 0) {
                    await receiveLine(session.id, {
                        line_id: line.id,
                        qty_received: Number(popupQty),
                        expiry_date: popupExpiry || null,
                        batch_number: popupBatch,
                    })
                }
                toast.success(`${popup.product.name} added and received`)

            } else if (popup?.action === 'receive' && popup.line) {
                await receiveLine(session.id, {
                    line_id: popup.line.id,
                    qty_received: Number(popupQty),
                    expiry_date: popupExpiry || null,
                    batch_number: popupBatch,
                })
                toast.success(`${popup.line.product_name} received`)

            } else if (popup?.action === 'reject' && popup.line) {
                await rejectLine(session.id, {
                    line_id: popup.line.id,
                    qty_rejected: Number(popupQty),
                    rejection_reason: popupRejReason,
                    rejection_notes: popupRejNotes,
                })
                toast.success(`${popup.line.product_name} rejected`)

            } else if (popup?.action === 'reject' && popup.product) {
                // Add new line and reject it
                const line = await addReceivingLine(session.id, {
                    product_id: popup.product.id,
                    qty_rejected: Number(popupQty) || 0,
                    expiry_date: popupExpiry || null,
                    batch_number: popupBatch,
                })

                if (Number(popupQty) > 0) {
                    await rejectLine(session.id, {
                        line_id: line.id,
                        qty_rejected: Number(popupQty),
                        rejection_reason: popupRejReason,
                        rejection_notes: popupRejNotes,
                    })
                }
                toast.success(`${popup.product.name} added and rejected`)
            }

            // Refresh session
            const updated = await getReceivingSession(session.id)
            setSession(updated)
            setPopup(null)
        } catch (e: any) {
            toast.error(e?.message || 'Operation failed')
        }
        setActionLoading(false)
    }

    // ── Finalize ──
    async function handleFinalize() {
        if (!session) return
        setActionLoading(true)
        try {
            const updated = await finalizeReceiving(session.id)
            setSession(updated)
            toast.success('Receiving session finalized — stock updated')
        } catch (e: any) {
            toast.error(e?.message || 'Failed to finalize')
        }
        setActionLoading(false)
    }

    // ── Reset Line (back to pending) ──
    async function handleResetLine(line: GoodsReceiptLine) {
        if (!session) return
        setActionLoading(true)
        try {
            await resetLine(session.id, { line_id: line.id })
            const updated = await getReceivingSession(session.id)
            setSession(updated)
            toast.success(`${line.product_name} reset to pending`)
        } catch (e: any) {
            toast.error(e?.message || 'Failed to reset line')
        }
        setActionLoading(false)
    }

    // ── Line categorization ──
    const pendingLines = session?.lines?.filter(l =>
        ['PENDING', 'SCANNED', 'UNDER_REVIEW', 'APPROVAL_REQUIRED'].includes(l.line_status)
    ) || []
    const receivedLines = session?.lines?.filter(l =>
        ['RECEIVED', 'PARTIALLY_RECEIVED', 'APPROVED_EXTRA', 'VERIFIED', 'CLOSED'].includes(l.line_status)
    ) || []
    const rejectedLines = session?.lines?.filter(l =>
        ['REJECTED', 'REFUSED_EXTRA', 'RETURN_PENDING'].includes(l.line_status)
    ) || []

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: Pre-session setup (mode selection, warehouse, PO)
    // ═══════════════════════════════════════════════════════════════════════════

    if (!session) {
        return (
            <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
                <div className="layout-container-padding max-w-[900px] mx-auto space-y-6">

                    {/* Back link */}
                    <Link href="/purchases/receipts" className="flex items-center gap-1.5 text-sm font-medium text-app-muted-foreground hover:text-app-foreground transition-colors">
                        <ChevronLeft size={16} /> Back to Stock Reception
                    </Link>

                    {/* Header */}
                    <header className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shadow-sm">
                            <PackageCheck size={28} className="text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-app-foreground">
                                Goods <span className="text-emerald-500">Receipt</span>
                            </h1>
                            <p className="text-sm font-medium text-app-muted-foreground mt-0.5">
                                Start a new receiving session
                            </p>
                        </div>
                    </header>

                    {/* Mode selection */}
                    <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-6">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-3 block">Receiving Mode</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setMode('DIRECT')}
                                    className={`p-4 rounded-xl border-2 transition-all text-left ${mode === 'DIRECT' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-app-border hover:border-app-muted-foreground/30'}`}
                                >
                                    <ScanBarcode size={24} className={mode === 'DIRECT' ? 'text-emerald-500' : 'text-app-muted-foreground'} />
                                    <p className="font-bold text-app-foreground mt-2">Direct Receiving</p>
                                    <p className="text-xs text-app-muted-foreground mt-0.5">Search, scan, or browse — no PO needed</p>
                                </button>
                                <button
                                    onClick={() => setMode('PO_BASED')}
                                    className={`p-4 rounded-xl border-2 transition-all text-left ${mode === 'PO_BASED' ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-app-border hover:border-app-muted-foreground/30'}`}
                                >
                                    <BookOpen size={24} className={mode === 'PO_BASED' ? 'text-emerald-500' : 'text-app-muted-foreground'} />
                                    <p className="font-bold text-app-foreground mt-2">Against Purchase Order</p>
                                    <p className="text-xs text-app-muted-foreground mt-0.5">Load PO items as pending checklist</p>
                                </button>
                            </div>
                        </div>

                        {/* Warehouse */}
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-2 block">Receiving Location</label>
                            <select
                                value={selectedWarehouse || ''}
                                onChange={e => setSelectedWarehouse(Number(e.target.value) || null)}
                                className="w-full border border-app-border rounded-lg p-3 text-sm font-medium bg-app-background text-app-foreground focus:ring-2 focus:ring-emerald-500 outline-none"
                            >
                                <option value="">Select warehouse...</option>
                                {warehouses.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.name} ({w.location_type})</option>
                                ))}
                            </select>
                        </div>

                        {/* Supplier + PO Selection (Mode B only) */}
                        {mode === 'PO_BASED' && (
                            <>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-2 block">Supplier</label>
                                    <select
                                        value={selectedSupplier || ''}
                                        onChange={e => {
                                            const val = Number(e.target.value) || null
                                            setSelectedSupplier(val)
                                            setSelectedPO(null) // reset PO when supplier changes
                                        }}
                                        className="w-full border border-app-border rounded-lg p-3 text-sm font-medium bg-app-background text-app-foreground focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="">Select supplier...</option>
                                        {suppliers.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name || s.company_name || `Supplier #${s.id}`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-2 block">Purchase Order</label>
                                    <select
                                        value={selectedPO || ''}
                                        onChange={e => setSelectedPO(Number(e.target.value) || null)}
                                        disabled={!selectedSupplier}
                                        className="w-full border border-app-border rounded-lg p-3 text-sm font-medium bg-app-background text-app-foreground focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50"
                                    >
                                        <option value="">{selectedSupplier ? 'Select PO...' : 'Select a supplier first...'}</option>
                                        {filteredPurchaseOrders.map((po: any) => (
                                            <option key={po.id} value={po.id}>
                                                {po.po_number || `PO-${po.id}`} — {po.status}{po.expected_date ? ` • Due: ${po.expected_date}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {selectedSupplier && filteredPurchaseOrders.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-1.5 font-medium">No open purchase orders for this supplier</p>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Start button */}
                        <button
                            onClick={handleStartSession}
                            disabled={loading}
                            className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <PackageCheck size={20} />}
                            Start Receiving Session
                        </button>
                    </div>
                </div>
            </main>
        )
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER: Active session
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <main className="space-y-4 md:space-y-[var(--layout-section-spacing)] animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-4 md:space-y-[var(--layout-section-spacing)]">

                {/* ── Header ── */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Link href="/purchases/receipts" className="text-app-muted-foreground hover:text-app-foreground transition-colors">
                            <ChevronLeft size={20} />
                        </Link>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shadow-sm">
                            <PackageCheck size={24} className="text-emerald-500" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-black tracking-tight text-app-foreground flex items-center gap-2">
                                {session.receipt_number}
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${mode === 'DIRECT' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30'}`}>
                                    {mode === 'DIRECT' ? 'Direct' : 'PO-Based'}
                                </span>
                            </h1>
                            <p className="text-xs text-app-muted-foreground font-medium">
                                {session.warehouse_name}
                                {session.supplier_name && ` • ${session.supplier_name}`}
                                {session.po_number && ` • ${session.po_number}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {session.status !== 'CLOSED' && session.status !== 'CANCELLED' && (
                            <button
                                onClick={handleFinalize}
                                disabled={actionLoading || receivedLines.length === 0}
                                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
                            >
                                {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                Finalize & Post to Stock
                            </button>
                        )}
                    </div>
                </header>

                {/* ── KPI Strip ── */}
                <section className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Pending', value: pendingLines.length, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', icon: Clock },
                        { label: 'Received', value: receivedLines.length, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: PackageCheck },
                        { label: 'Rejected', value: rejectedLines.length, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/30', icon: PackageX },
                    ].map(kpi => (
                        <div key={kpi.label} className="bg-app-surface border border-app-border rounded-xl p-3 md:p-4 flex items-center gap-3 shadow-sm">
                            <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                                <kpi.icon size={18} className={kpi.color} />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-wider text-app-muted-foreground">{kpi.label}</p>
                                <p className={`text-xl font-black ${kpi.color}`}>{kpi.value}</p>
                            </div>
                        </div>
                    ))}
                </section>

                {/* ── Product Search / Scan Bar ── */}
                {session.status !== 'CLOSED' && session.status !== 'CANCELLED' && (
                    <div className="relative">
                        <div className="flex items-center gap-2 bg-app-surface border border-app-border rounded-xl shadow-sm p-1">
                            <div className="flex-1 relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => handleSearch(e.target.value)}
                                    placeholder="Search product name, barcode, or SKU..."
                                    className="w-full pl-10 pr-4 py-3 bg-transparent text-sm font-medium text-app-foreground outline-none min-h-[44px]"
                                    autoFocus
                                />
                            </div>
                            {searchLoading && <Loader2 size={16} className="animate-spin text-app-muted-foreground mr-2" />}
                        </div>

                        {/* Search results dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-20 left-0 right-0 mt-1 bg-app-surface border border-app-border rounded-xl shadow-2xl max-h-[300px] overflow-y-auto">
                                {searchResults.map((p: any) => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSelectProduct(p)}
                                        className="w-full text-left p-3 hover:bg-app-background transition-colors first:rounded-t-xl last:rounded-b-xl flex items-center gap-3"
                                    >
                                        <Package size={16} className="text-app-muted-foreground shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-app-foreground truncate">{p.name}</p>
                                            <p className="text-xs text-app-muted-foreground">
                                                {p.barcode && <span className="font-mono mr-3">{p.barcode}</span>}
                                                {p.sku && <span className="font-mono">{p.sku}</span>}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Section Tabs ── */}
                <div className="flex border-b border-app-border">
                    {['pending', 'received', 'rejected'].map(tab => {
                        const count = tab === 'pending' ? pendingLines.length : tab === 'received' ? receivedLines.length : rejectedLines.length
                        const isActive = activeTab === tab
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`px-4 py-3 text-sm font-bold capitalize transition-colors border-b-2 flex items-center gap-2 ${isActive
                                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                    : 'border-transparent text-app-muted-foreground hover:text-app-foreground'
                                    }`}
                            >
                                {tab}
                                {count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                                        }`}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* ── Lines Table ── */}
                <div className="space-y-2">
                    {activeTab === 'pending' && pendingLines.map(line => (
                        <LineCard key={line.id} line={line} onReceive={l => handleOpenLine(l, 'receive')} onReject={l => handleOpenLine(l, 'reject')} fmt={fmt} sessionOpen={session.status !== 'CLOSED' && session.status !== 'CANCELLED'} />
                    ))}
                    {activeTab === 'received' && receivedLines.map(line => (
                        <LineCard key={line.id} line={line} onReject={l => handleOpenLine(l, 'reject')} onReset={handleResetLine} fmt={fmt} sessionOpen={session.status !== 'CLOSED' && session.status !== 'CANCELLED'} />
                    ))}
                    {activeTab === 'rejected' && rejectedLines.map(line => (
                        <LineCard key={line.id} line={line} onReceive={l => handleOpenLine(l, 'receive')} onReset={handleResetLine} fmt={fmt} sessionOpen={session.status !== 'CLOSED' && session.status !== 'CANCELLED'} />
                    ))}
                    {((activeTab === 'pending' && pendingLines.length === 0) ||
                        (activeTab === 'received' && receivedLines.length === 0) ||
                        (activeTab === 'rejected' && rejectedLines.length === 0)) && (
                            <div className="bg-app-surface border border-app-border rounded-xl p-12 text-center shadow-sm">
                                <Package size={40} className="mx-auto text-app-muted-foreground opacity-30 mb-3" />
                                <p className="text-sm font-medium text-app-muted-foreground">No {activeTab} items</p>
                                <p className="text-xs text-app-muted-foreground mt-1">
                                    {activeTab === 'pending' ? 'All items have been processed' :
                                        activeTab === 'received' ? 'Use the search bar or process pending items' :
                                            'No items have been rejected'}
                                </p>
                            </div>
                        )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
         RECEIVING POPUP (Mobile-first bottom sheet)
     ═══════════════════════════════════════════════════════════════════════ */}
            {popup && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={() => setPopup(null)}>
                    <div className="w-full md:max-w-lg bg-app-surface rounded-t-2xl md:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="overflow-y-auto flex-1">

                            {/* Block 1: Product Identity */}
                            <div className="p-5 border-b border-app-border">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                        <Package size={20} className="text-emerald-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-black text-lg text-app-foreground truncate">
                                            {popup.line?.product_name || popup.product?.name || 'Product'}
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs text-app-muted-foreground mt-1">
                                            {(popup.line?.product_barcode || popup.product?.barcode) && (
                                                <span className="font-mono">{popup.line?.product_barcode || popup.product?.barcode}</span>
                                            )}
                                            {popup.line?.qty_ordered > 0 && (
                                                <span className="font-bold">Ordered: {popup.line.qty_ordered}</span>
                                            )}
                                        </div>
                                        {popup.line?.is_unexpected && (
                                            <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                                                ⚠ Unexpected Item
                                            </span>
                                        )}
                                    </div>
                                    <button onClick={() => setPopup(null)} className="text-app-muted-foreground hover:text-app-foreground">
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Block 2: User Input */}
                            <div className="p-5 space-y-4 border-b border-app-border">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 block">
                                            {popup.action === 'reject' ? 'Qty to Reject' : 'Qty to Receive'}
                                        </label>
                                        <input
                                            type="number"
                                            value={popupQty}
                                            onChange={e => setPopupQty(e.target.value)}
                                            placeholder="0"
                                            className="w-full border border-app-border rounded-lg p-3 text-sm font-bold bg-app-background text-app-foreground focus:ring-2 focus:ring-emerald-500 outline-none min-h-[48px]"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 block">Expiry Date</label>
                                        <SmartDatePicker
                                            value={popupExpiry}
                                            onChange={setPopupExpiry}
                                            placeholder="Pick expiry date..."
                                            showPresets={true}
                                        />
                                    </div>
                                </div>

                                {popup.action !== 'reject' && (
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 block">Batch / Lot Number</label>
                                        <input
                                            type="text"
                                            value={popupBatch}
                                            onChange={e => setPopupBatch(e.target.value)}
                                            placeholder="Optional"
                                            className="w-full border border-app-border rounded-lg p-3 text-sm font-medium bg-app-background text-app-foreground focus:ring-2 focus:ring-emerald-500 outline-none min-h-[48px]"
                                        />
                                    </div>
                                )}

                                {popup.action === 'reject' && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 block">Rejection Reason</label>
                                            <select
                                                value={popupRejReason}
                                                onChange={e => setPopupRejReason(e.target.value)}
                                                className="w-full border border-app-border rounded-lg p-3 text-sm font-medium bg-app-background text-app-foreground focus:ring-2 focus:ring-emerald-500 outline-none min-h-[48px]"
                                            >
                                                {REJECTION_REASONS.map(r => (
                                                    <option key={r.value} value={r.value}>{r.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 block">Notes</label>
                                            <textarea
                                                value={popupRejNotes}
                                                onChange={e => setPopupRejNotes(e.target.value)}
                                                rows={2}
                                                placeholder="Optional details..."
                                                className="w-full border border-app-border rounded-lg p-3 text-sm font-medium bg-app-background text-app-foreground focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Block 3: Decision Support */}
                            {(popup.preview || popup.line?.stock_on_location !== undefined) && (
                                <div className="p-5 border-b border-app-border">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-3 flex items-center gap-1.5">
                                        <BarChart3 size={12} /> Decision Intelligence
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { label: 'Stock Here', value: popup.preview?.stock_on_location ?? popup.line?.stock_on_location ?? 0 },
                                            { label: 'Total Stock', value: popup.preview?.total_stock ?? popup.line?.total_stock ?? 0 },
                                            { label: 'Avg Daily Sales', value: Number(popup.preview?.avg_daily_sales ?? popup.line?.avg_daily_sales ?? 0).toFixed(1) },
                                            { label: 'Safe Qty', value: Number(popup.preview?.safe_qty ?? popup.line?.safe_qty ?? 0).toFixed(0), highlight: true },
                                            { label: 'Safe After Rcpt', value: Number(popup.preview?.safe_qty_after_receipt ?? popup.line?.safe_qty_after_receipt ?? 0).toFixed(0) },
                                            { label: 'Coverage %', value: `${Number(popup.preview?.receipt_coverage_pct ?? popup.line?.receipt_coverage_pct ?? 0).toFixed(0)}%` },
                                        ].map(m => (
                                            <div key={m.label} className="bg-app-background rounded-lg p-2.5 text-center">
                                                <p className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">{m.label}</p>
                                                <p className={`text-sm font-black ${m.highlight ? 'text-emerald-500' : 'text-app-foreground'} mt-0.5`}>{m.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Block 4: Warnings / Recommendations */}
                            {(popup.preview?.warnings || popup.line?.decision_warnings)?.length > 0 && (
                                <div className="px-5 py-3 border-b border-app-border flex flex-wrap gap-1.5">
                                    {(popup.preview?.warnings || popup.line?.decision_warnings || []).map((w: string) => {
                                        const cfg = BADGE_CONFIG[w]
                                        if (!cfg) return null
                                        return (
                                            <span key={w} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${cfg.color}`}>
                                                <cfg.icon size={10} /> {cfg.label}
                                            </span>
                                        )
                                    })}
                                </div>
                            )}

                        </div>{/* end scroll wrapper */}

                        {/* Block 5: Actions (pinned at bottom) */}
                        <div className="p-5 flex gap-3 shrink-0 border-t border-app-border">
                            <button
                                onClick={() => setPopup(null)}
                                className="flex-1 py-3 rounded-xl border border-app-border text-app-foreground font-bold text-sm hover:bg-app-background transition-colors min-h-[48px]"
                            >
                                Cancel
                            </button>
                            {popup.action === 'reject' ? (
                                <button
                                    onClick={handlePopupSubmit}
                                    disabled={!popupQty || actionLoading}
                                    className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 min-h-[48px] flex items-center justify-center gap-2"
                                >
                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <PackageX size={14} />}
                                    Reject
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { setPopup({ ...popup, action: 'reject' }); setPopupQty('') }}
                                        className="py-3 px-4 rounded-xl border border-red-300 text-red-600 font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[48px]"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={handlePopupSubmit}
                                        disabled={!popupQty || actionLoading}
                                        className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 min-h-[48px] flex items-center justify-center gap-2"
                                    >
                                        {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                                        Receive
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}


// ═══════════════════════════════════════════════════════════════════════════
// LINE CARD SUB-COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function LineCard({
    line,
    onReceive,
    onReject,
    onReset,
    fmt,
    sessionOpen = true,
}: {
    line: GoodsReceiptLine
    onReceive?: (line: GoodsReceiptLine) => void
    onReject?: (line: GoodsReceiptLine) => void
    onReset?: (line: GoodsReceiptLine) => void
    fmt: (val: number) => string
    sessionOpen?: boolean
}) {
    const [expanded, setExpanded] = useState(false)
    const statusCfg = STATUS_BADGE[line.line_status] || { label: line.line_status, color: 'bg-gray-100 text-gray-500' }

    const isPending = ['PENDING', 'SCANNED', 'UNDER_REVIEW', 'APPROVAL_REQUIRED'].includes(line.line_status)
    const isReceived = ['RECEIVED', 'PARTIALLY_RECEIVED', 'APPROVED_EXTRA', 'VERIFIED', 'CLOSED'].includes(line.line_status)
    const isRejected = ['REJECTED', 'REFUSED_EXTRA', 'RETURN_PENDING'].includes(line.line_status)

    return (
        <div className="bg-app-surface border border-app-border rounded-xl shadow-sm overflow-hidden">
            {/* Primary Row */}
            <div className="p-3 md:p-4 flex items-center gap-3">
                <button onClick={() => setExpanded(!expanded)} className="text-app-muted-foreground hover:text-app-foreground shrink-0">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-app-foreground truncate">{line.product_name}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase ${statusCfg.color}`}>
                            {statusCfg.label}
                        </span>
                        {line.is_unexpected && (
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                                Unexpected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-app-muted-foreground mt-1 flex-wrap">
                        <span>Stock: <b className="text-app-foreground">{Number(line.stock_on_location).toFixed(0)}</b></span>
                        {line.qty_ordered > 0 && <span>Ordered: <b className="text-app-foreground">{Number(line.qty_ordered).toFixed(0)}</b></span>}
                        {line.qty_received > 0 && <span className="text-emerald-600">Rcvd: <b>{Number(line.qty_received).toFixed(0)}</b></span>}
                        {line.qty_rejected > 0 && <span className="text-red-600">Rej: <b>{Number(line.qty_rejected).toFixed(0)}</b></span>}
                        {line.expiry_date && <span className="flex items-center gap-0.5"><Calendar size={10} />{line.expiry_date}</span>}
                    </div>
                </div>

                {/* Decision badges (compact) */}
                <div className="hidden md:flex items-center gap-1 shrink-0">
                    {(line.decision_warnings || []).slice(0, 2).map((w: string) => {
                        const cfg = BADGE_CONFIG[w]
                        if (!cfg) return null
                        return (
                            <span key={w} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${cfg.color}`}>
                                <cfg.icon size={8} /> {cfg.label}
                            </span>
                        )
                    })}
                </div>

                {/* Action buttons — context-sensitive based on line status */}
                {sessionOpen && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Pending lines: Receive + Reject */}
                        {isPending && onReceive && (
                            <button
                                onClick={() => onReceive(line)}
                                className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors min-h-[40px] flex items-center gap-1"
                            >
                                <PackageCheck size={12} /> Receive
                            </button>
                        )}
                        {isPending && onReject && (
                            <button
                                onClick={() => onReject(line)}
                                className="px-3 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[40px] flex items-center gap-1"
                            >
                                <PackageX size={12} /> Reject
                            </button>
                        )}

                        {/* Received lines: Reset + Reject */}
                        {isReceived && onReset && (
                            <button
                                onClick={() => onReset(line)}
                                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-app-muted-foreground text-xs font-bold hover:bg-app-background transition-colors min-h-[40px] flex items-center gap-1"
                            >
                                <RefreshCw size={12} /> Reset
                            </button>
                        )}
                        {isReceived && onReject && (
                            <button
                                onClick={() => onReject(line)}
                                className="px-3 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors min-h-[40px] flex items-center gap-1"
                            >
                                <PackageX size={12} /> Reject
                            </button>
                        )}

                        {/* Rejected lines: Reset + Receive */}
                        {isRejected && onReset && (
                            <button
                                onClick={() => onReset(line)}
                                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-app-muted-foreground text-xs font-bold hover:bg-app-background transition-colors min-h-[40px] flex items-center gap-1"
                            >
                                <RefreshCw size={12} /> Reset
                            </button>
                        )}
                        {isRejected && onReceive && (
                            <button
                                onClick={() => onReceive(line)}
                                className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors min-h-[40px] flex items-center gap-1"
                            >
                                <PackageCheck size={12} /> Receive
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Secondary Row (expanded) */}
            {expanded && (
                <div className="px-4 pb-4 border-t border-app-border pt-3">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                        {[
                            { label: 'Barcode', value: line.product_barcode || '—' },
                            { label: 'Total Stock', value: Number(line.total_stock).toFixed(0) },
                            { label: 'Avg Daily Sales', value: Number(line.avg_daily_sales).toFixed(1) },
                            { label: 'Safe Qty', value: Number(line.safe_qty).toFixed(0) },
                            { label: 'Safe After Rcpt', value: Number(line.safe_qty_after_receipt).toFixed(0) },
                            { label: 'Coverage %', value: `${Number(line.receipt_coverage_pct).toFixed(0)}%` },
                            { label: 'Risk Score', value: Number(line.adjustment_risk_score).toFixed(2) },
                        ].map(m => (
                            <div key={m.label} className="bg-app-background rounded-lg p-2 text-center">
                                <p className="text-[7px] font-black uppercase tracking-wider text-app-muted-foreground">{m.label}</p>
                                <p className="text-xs font-bold text-app-foreground mt-0.5">{m.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Full decision badges */}
                    {(line.decision_warnings || []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {line.decision_warnings.map((w: string) => {
                                const cfg = BADGE_CONFIG[w]
                                if (!cfg) return null
                                return (
                                    <span key={w} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${cfg.color}`}>
                                        <cfg.icon size={10} /> {cfg.label}
                                    </span>
                                )
                            })}
                        </div>
                    )}

                    {line.recommended_action && (
                        <div className="mt-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-xs font-medium text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                            <Info size={12} /> {line.recommended_action}
                        </div>
                    )}

                    {line.rejection_reason && line.rejection_reason !== 'NOT_REJECTED' && (
                        <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs font-medium text-red-700 dark:text-red-400">
                            Rejected: {line.rejection_reason} {line.rejection_notes && `— ${line.rejection_notes}`}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
