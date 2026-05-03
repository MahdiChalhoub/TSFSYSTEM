'use client'

import { useActionState, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { PurchaseLine } from '@/types/erp'
import { createPurchaseOrder, updatePurchaseInvoice, transitionPurchaseOrderStatus } from '@/app/actions/commercial/purchases'
import {
    ShoppingCart, ArrowLeft, Settings2,
    Plus, ArrowRight, BookOpen,
    DollarSign, Hash, Layers, TrendingUp,
    Building2, MapPin, List, LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { useFormDraft } from './_lib/use-form-draft'
import { ProductSearch } from './_components/ProductSearch'
import { LineCardGrid } from './_components/LineCardGrid'
import { AdminSidebar } from './_components/AdminSidebar'
import { POLifecycle, type POStatus } from './_components/POLifecycle'
import { CatalogueModal } from './_components/CatalogueModal'
import { ColumnVisibilityButton, ColumnVisibilityPanel } from './_components/ColumnVisibility'
import { DajingoListView } from '@/components/common/DajingoListView'
import { renderPurchaseCell } from './_components/PurchaseColumns'
import {
    COLUMN_DEFS, COLUMN_WIDTHS, RIGHT_ALIGNED_COLS, CENTER_ALIGNED_COLS, GROW_COLS,
    DEFAULT_VISIBLE, DEFAULT_ORDER, type ColumnKey
} from './_lib/columns'
import type { POViewProfile } from './_lib/profiles'
import {
    loadProfiles, loadActiveProfileId, saveProfiles, saveActiveProfileId,
    syncProfileToBackend, loadProfileFromBackend,
} from './_lib/profiles'
import type { AnalyticsProfilesData } from '@/app/actions/settings/analytics-profiles'
import { peekNextCode, prefetchNextCode, resolveDocSeqKey } from '@/lib/sequences-client'
import { Package, Trash2, Maximize2 } from 'lucide-react'

type PurchaseFormMode = 'create' | 'edit'

interface PurchaseFormProps {
    suppliers: Record<string, any>[]
    sites: Record<string, any>[]
    financialSettings: Record<string, any>
    users: Record<string, any>[]
    profilesData: AnalyticsProfilesData
    currentUser?: any
    /** When 'edit', the form prefills from `initialPO` and submits via
     *  `updatePurchaseInvoice` (PATCH) instead of the create action. */
    mode?: PurchaseFormMode
    initialPO?: Record<string, any> | null
}

export default function PurchaseForm({
    suppliers,
    sites,
    financialSettings,
    users,
    profilesData,
    currentUser,
    mode = 'create',
    initialPO = null,
}: PurchaseFormProps) {
    const isStaff = currentUser?.is_staff || currentUser?.is_superuser;

    const isEdit = mode === 'edit' && !!initialPO
    const editId = isEdit ? Number(initialPO?.id) : null
    const initialState = { message: '', errors: {} }
    // Pick the right server action up-front so we don't change hook
    // identity on a subsequent re-render. The `useActionState` contract
    // assumes a stable function reference per mount.
    // Create path = true PO (DRAFT, no GL impact). Edit path keeps the
    // existing PATCH-to-purchase-orders flow.
    const submitAction = isEdit ? updatePurchaseInvoice : createPurchaseOrder
    const [state, formAction, isPending] = useActionState(submitAction, initialState)
    const router = useRouter()
    const searchRef = useRef<HTMLInputElement>(null)

    // Edit-mode prefill helper. `useState` initializers run once at mount,
    // so we wrap each `useState(initial)` with a value derived from
    // `initialPO`. The shape handled here mirrors the `purchase-orders/`
    // serializer: nested supplier/warehouse objects, snake_case dates,
    // `lines[]` with `product`/`quantity_ordered`/`unit_price`.
    const seedNumber = (val: unknown): number | '' => {
        const n = Number(val)
        return Number.isFinite(n) && n > 0 ? n : ''
    }

    const seededLines: PurchaseLine[] = useMemo(() => {
        if (!isEdit || !Array.isArray(initialPO?.lines)) return []
        return (initialPO!.lines as Record<string, any>[]).map((l): PurchaseLine => {
            const taxRate = Number(l.tax_rate ?? l.taxRate ?? 0.18)
            const unitCostHT = Number(l.unit_cost_ht ?? l.unit_price ?? l.unitCostHT ?? 0)
            const sellingPriceHT = Number(l.selling_price_ht ?? l.sellingPriceHT ?? 0)
            const productId = Number(l.product?.id ?? l.product ?? l.productId ?? 0)
            return {
                productId,
                productName: l.product?.name || l.product_name || l.productName,
                quantity: Number(l.quantity_ordered ?? l.quantity ?? 0),
                unitCostHT,
                unitCostTTC: Number(l.unit_cost_ttc ?? l.unitCostTTC ?? unitCostHT * (1 + taxRate)),
                sellingPriceHT,
                sellingPriceTTC: Number(l.selling_price_ttc ?? l.sellingPriceTTC ?? sellingPriceHT * (1 + taxRate)),
                taxRate,
                expiryDate: typeof l.expiry_date === 'string' ? l.expiry_date : (l.expiryDate as string | undefined) || '',
            }
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const [reference, setReference] = useState(() => (isEdit ? String(initialPO?.po_number || initialPO?.ref_code || '') : ''))
    // True if the user has hand-typed into the reference field. Once they
    // do, we never overwrite it with a fresh sequence peek — auto-fill is
    // a convenience, not a constraint. In edit mode we start as "touched"
    // so the sequence peek doesn't clobber the saved reference.
    const [referenceTouched, setReferenceTouched] = useState(isEdit)
    // Optional second reference. Operators use this to capture the
    // supplier's own PO/quote number, an internal cost-center code, or a
    // legacy ERP reference — anything they want to track alongside the
    // tenant-generated PO number. Always editable, never auto-filled.
    const [supplierRef, setSupplierRef] = useState(() => (isEdit ? String(initialPO?.supplier_ref || initialPO?.supplierRef || '') : ''))
    // Order date defaults to today; expected delivery to tomorrow — sane
    // defaults so the operator only changes them when their workflow needs
    // a different date. The operator can still pick any date afterwards.
    const [date, setDate] = useState(() => {
        if (isEdit && typeof initialPO?.order_date === 'string') return initialPO.order_date as string
        return new Date().toISOString().split('T')[0]
    })
    const [deliveryDate, setDeliveryDate] = useState(() => {
        if (isEdit && typeof initialPO?.expected_delivery === 'string') return initialPO.expected_delivery as string
        const t = new Date()
        t.setDate(t.getDate() + 1)
        return t.toISOString().split('T')[0]
    })
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>(() => {
        const s = isEdit ? (initialPO?.scope as string | undefined) : undefined
        return s === 'INTERNAL' ? 'INTERNAL' : 'OFFICIAL'
    })
    const [supplierId, setSupplierId] = useState<number | ''>(() =>
        isEdit ? seedNumber(initialPO?.supplier?.id ?? initialPO?.supplier ?? initialPO?.supplier_id) : ''
    )
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>(() => {
        if (!isEdit) return ''
        // Backend stores `warehouse` (the leaf) — use its `parent` (or
        // `site`/`branch` if the serializer surfaces it directly) for the
        // site selector.
        const wh = initialPO?.warehouse as Record<string, unknown> | undefined
        return seedNumber(initialPO?.site?.id ?? initialPO?.site ?? wh?.parent ?? wh?.site ?? initialPO?.branch_id)
    })
    const [warehouseId, setWarehouseId] = useState<number | ''>(() =>
        isEdit ? seedNumber(initialPO?.warehouse?.id ?? initialPO?.warehouse ?? initialPO?.warehouse_id) : ''
    )
    const [assigneeId, setAssigneeId] = useState<number | ''>(() =>
        isEdit ? seedNumber(initialPO?.assignee?.id ?? initialPO?.assignee ?? initialPO?.assignee_id) : ''
    )
    const [driverId, setDriverId] = useState<number | ''>(() =>
        isEdit ? seedNumber(initialPO?.driver?.id ?? initialPO?.driver ?? initialPO?.driver_id) : ''
    )
    const [lines, setLines] = useState<PurchaseLine[]>(seededLines)

    // ── Draft autosave + recovery ────────────────────────────────────
    // Persist a debounced snapshot of the user's in-progress order to
    // localStorage. If the tab dies (crash, accidental close, navigate
    // away), the next visit can recover from the stored draft instead
    // of forcing the user to re-enter everything. Disabled on edit
    // mode since the server row is the source of truth there.
    type PODraft = {
        reference: string; supplierRef: string; date: string; deliveryDate: string
        scope: 'OFFICIAL' | 'INTERNAL'
        supplierId: number | ''; selectedSiteId: number | ''; warehouseId: number | ''
        assigneeId: number | ''; driverId: number | ''
        lines: PurchaseLine[]
    }
    const { recoverable: draft, saveDraft, clearDraft } = useFormDraft<PODraft>({
        storageKey: 'po.draft.create.v1',
        enabled: !isEdit,
    })
    const [draftBannerDismissed, setDraftBannerDismissed] = useState(false)
    const showDraftBanner = !isEdit && draft !== null && !draftBannerDismissed
    const recoverDraft = useCallback(() => {
        if (!draft) return
        const d = draft.data
        // Clear the reference and mark untouched so the auto-peek effect
        // refetches the *current* next-PO number from the backend. The
        // saved-draft reference would otherwise be a stale peek that's
        // already been consumed by another save.
        setReference('')
        setReferenceTouched(false)
        setSupplierRef(d.supplierRef || '')
        setDate(d.date || new Date().toISOString().split('T')[0])
        setDeliveryDate(d.deliveryDate || '')
        setScope(d.scope === 'INTERNAL' ? 'INTERNAL' : 'OFFICIAL')
        setSupplierId(d.supplierId ?? '')
        setSelectedSiteId(d.selectedSiteId ?? '')
        setWarehouseId(d.warehouseId ?? '')
        setAssigneeId(d.assigneeId ?? '')
        setDriverId(d.driverId ?? '')
        setLines(Array.isArray(d.lines) ? d.lines : [])
        setDraftBannerDismissed(true)
        toast.success('Draft restored')
    }, [draft])
    const discardDraft = useCallback(() => {
        clearDraft()
        setDraftBannerDismissed(true)
    }, [clearDraft])

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [catalogueOpen, setCatalogueOpen] = useState(false)
    const [columnsOpen, setColumnsOpen] = useState(false)

    // ── Column visibility profiles (backend-persisted, same as Products) ──
    // Initialize from DEFAULTS only — reading localStorage in the useState
    // initializer creates a hydration mismatch because the server renders
    // with defaults (window undefined → []) while the client reads the
    // user's saved profile and computes a different column order. The
    // resulting "Status vs Sales" column-position diff failed React's
    // hydration check. Load real preferences in useEffect after mount.
    const [colProfiles, setColProfiles] = useState<POViewProfile[]>([])
    const [activeColProfileId, setActiveColProfileId] = useState<string>('default')
    const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(() => new Set(DEFAULT_VISIBLE))
    const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => [...DEFAULT_ORDER])

    // Load preferences after mount (client-only): first localStorage, then
    // backend-persisted profile.
    useEffect(() => {
        const profiles = loadProfiles()
        const activeId = loadActiveProfileId()
        setColProfiles(profiles)
        setActiveColProfileId(activeId)
        const local = profiles.find(pr => pr.id === activeId)
        if (local) {
            setVisibleColumns(new Set(
                Object.entries(local.columns).filter(([, v]) => v).map(([k]) => k as ColumnKey)
            ))
            setColumnOrder(local.columnOrder || [...DEFAULT_ORDER])
        }
        loadProfileFromBackend(profiles, activeId).then(result => {
            if (!result) return
            setColProfiles(result.profiles)
            setVisibleColumns(new Set(
                Object.entries(result.columns).filter(([, v]) => v).map(([k]) => k as ColumnKey)
            ))
            setColumnOrder(result.columnOrder)
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleColumnToggle = useCallback((key: ColumnKey) => {
        setVisibleColumns(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            // Also update the active profile
            setColProfiles(profiles => {
                const updated = profiles.map(p => {
                    if (p.id !== activeColProfileId) return p
                    const cols = { ...p.columns, [key]: !prev.has(key) }
                    return { ...p, columns: cols }
                })
                saveProfiles(updated)
                const ap = updated.find(p => p.id === activeColProfileId)
                if (ap) syncProfileToBackend(ap)
                return updated
            })
            return next
        })
    }, [activeColProfileId])

    const handleColumnReorder = useCallback((newOrder: ColumnKey[]) => {
        setColumnOrder(newOrder)
        setColProfiles(profiles => {
            const updated = profiles.map(p =>
                p.id === activeColProfileId ? { ...p, columnOrder: newOrder } : p
            )
            saveProfiles(updated)
            const ap = updated.find(p => p.id === activeColProfileId)
            if (ap) syncProfileToBackend(ap)
            return updated
        })
    }, [activeColProfileId])

    const switchColProfile = useCallback((id: string) => {
        const prof = colProfiles.find(p => p.id === id)
        if (!prof) return
        setActiveColProfileId(id)
        saveActiveProfileId(id)
        setVisibleColumns(new Set(
            Object.entries(prof.columns).filter(([, v]) => v).map(([k]) => k as ColumnKey)
        ))
        setColumnOrder(prof.columnOrder || [...DEFAULT_ORDER])
    }, [colProfiles])

    // ── Lifecycle status (edit mode only) ─────────────────────────────
    // On new POs this is always DRAFT (hardcoded). On edit mode it reads
    // from the backend's `status` field. When the operator clicks a stage
    // in the sidebar's lifecycle widget, we fire the transition server
    // action and optimistically update the local state.
    const [poStatus, setPoStatus] = useState<POStatus>(() => {
        if (!isEdit) return 'DRAFT'
        const s = (initialPO?.status as string || 'DRAFT').toUpperCase()
        return s as POStatus
    })
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list')
    const [statusTransitioning, setStatusTransitioning] = useState(false)

    /** Statuses the user can SET on create (gated by role).
     *  - Plain users: DRAFT only.
     *  - Staff / superuser: DRAFT, SUBMITTED, APPROVED — i.e. they can
     *    short-circuit the approval workflow when the PO is being entered
     *    after-the-fact (a phone-confirmed order, an already-signed quote).
     *  Lifecycle states beyond APPROVED (ORDERED / RECEIVED / INVOICED…)
     *  are never reachable on create — they require GRN / invoice match. */
    const allowedCreateStatuses: POStatus[] = isStaff
        ? ['DRAFT', 'SUBMITTED', 'APPROVED']
        : ['DRAFT']

    const handleStatusChange = useCallback(async (next: POStatus) => {
        if (next === poStatus) return

        // Create mode: the PO doesn't exist yet, so we can't call the
        // transition endpoint. Just stash the desired initial status —
        // it travels with the form payload to the backend on save.
        if (!isEdit || !editId) {
            if (!allowedCreateStatuses.includes(next)) {
                toast.error(`You don't have permission to start a PO as ${next.toLowerCase()}.`)
                return
            }
            setPoStatus(next)
            return
        }

        setStatusTransitioning(true)
        try {
            const result = await transitionPurchaseOrderStatus(editId, next)
            if (result.error) {
                toast.error(result.error)
                if (result.current_status) {
                    setPoStatus(result.current_status as POStatus)
                }
            } else {
                const newStatus = (result.status || next) as POStatus
                setPoStatus(newStatus)
                toast.success(`PO transitioned to ${newStatus.replace(/_/g, ' ').toLowerCase()}`)
            }
        } catch (e) {
            toast.error('Failed to transition PO status')
        } finally {
            setStatusTransitioning(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEdit, editId, poStatus, isStaff])

    const selectedSupplier = useMemo(() => suppliers.find(s => Number(s.id) === Number(supplierId)), [suppliers, supplierId])
    const selectedSite = useMemo(() => sites.find(s => Number(s.id) === Number(selectedSiteId)), [sites, selectedSiteId])
    const selectedWarehouse = useMemo(() => {
        if (!selectedSite) return null
        return selectedSite.warehouses?.find((w: any) => Number(w.id) === Number(warehouseId))
    }, [selectedSite, warehouseId])

    const totals = useMemo(() => lines.reduce((acc, line) => {
        const qty = Number(line.quantity) || 0
        const ht = Number(line.unitCostHT) || 0
        const tax = Number(line.taxRate) || 0
        const lineHT = qty * ht
        const lineVAT = lineHT * tax
        return { ht: acc.ht + lineHT, vat: acc.vat + lineVAT, ttc: acc.ttc + lineHT + lineVAT }
    }, { ht: 0, vat: 0, ttc: 0 }), [lines])

    const canSubmit = !isPending && lines.length > 0 && supplierId !== '' && selectedSiteId !== '' && warehouseId !== ''

    // Persist draft on every change (debounced inside the hook). Edit
    // mode bypasses — the hook's `enabled: !isEdit` makes saveDraft a
    // no-op there.
    useEffect(() => {
        if (isEdit) return
        saveDraft({
            reference, supplierRef, date, deliveryDate, scope,
            supplierId, selectedSiteId, warehouseId, assigneeId, driverId,
            lines,
        })
    }, [isEdit, reference, supplierRef, date, deliveryDate, scope,
        supplierId, selectedSiteId, warehouseId, assigneeId, driverId,
        lines, saveDraft])

    useEffect(() => {
        if (state.message && state.errors && Object.keys(state.errors).length === 0) {
            // Successful save — wipe the draft and toast, then send the
            // user to the PO list. Reset every field on the way so a
            // back-button trip doesn't show the just-saved data.
            clearDraft()
            toast.success(state.message)
            if (!isEdit) {
                setReference(''); setReferenceTouched(false)
                setSupplierRef('')
                setLines([])
                setSupplierId('')
                setSelectedSiteId('')
                setWarehouseId('')
                setAssigneeId('')
                setDriverId('')
                setDate(new Date().toISOString().split('T')[0])
                const t = new Date(); t.setDate(t.getDate() + 1)
                setDeliveryDate(t.toISOString().split('T')[0])
                // Navigate to the list so the user sees the new PO in
                // context. router.push is client-side so it skips the
                // server-action redirect path that previously kicked
                // the user to /login when /purchases had a downstream
                // 401.
                router.push('/purchases')
            }
        } else if (state.message) {
            // Surface which fields failed so the user knows what to fix
            // instead of staring at a generic "Some fields are missing or
            // invalid." Map a few common keys to human labels.
            const labelMap: Record<string, string> = {
                supplierId: 'Supplier',
                warehouseId: 'Warehouse',
                siteId: 'Site',
                scope: 'Scope (Official/Internal)',
                lines: 'Line items',
            }
            const fields = state.errors ? Object.keys(state.errors) : []
            const human = fields.map(f => labelMap[f] || f).join(', ')
            toast.error(state.message, {
                description: human ? `Missing or invalid: ${human}` : undefined,
                duration: 6000,
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Auto-fill the PO reference from the tenant's PURCHASE_ORDER sequence
    // (configured under /settings/sequences). Picks the OFFICIAL or INTERNAL
    // tier based on the current scope, so toggling OFFICIAL ⇄ INTERNAL
    // refreshes the suggested reference (PO-… ⇄ IPO-…) — same convention as
    // the backend save path. Skipped once the user has hand-edited the
    // field — `referenceTouched` is the discipline lever.
    useEffect(() => {
        // Warm both tiers so a scope toggle is instant on second hit.
        prefetchNextCode('PURCHASE_ORDER')
        prefetchNextCode('PURCHASE_ORDER_INTERNAL')
        if (referenceTouched) return
        const key = resolveDocSeqKey('PURCHASE_ORDER', scope)
        peekNextCode(key)
            .then(code => {
                // Re-check `referenceTouched` after the await — user could
                // have started typing during the round-trip.
                if (!referenceTouched) setReference(code)
            })
            .catch(() => { /* keep whatever we already have */ })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scope])

    const addProductToLines = (product: Record<string, any>) => {
        if (lines.find(l => l.productId === product.id)) { toast.info('Already in list'); return }
        const taxRate = product.taxRate || 0.18
        const unitCostHT = product.unitCostHT || product.costPriceHT || 0
        const sellingPriceHT = product.sellingPriceHT || 0
        setLines(prev => [{
            ...product, productId: product.id, productName: product.name, quantity: 1,
            unitCostHT, unitCostTTC: unitCostHT * (1 + taxRate),
            sellingPriceHT, sellingPriceTTC: sellingPriceHT * (1 + taxRate),
            expiryDate: '', taxRate, poCount: 0,
            // Canonical pipeline_status from the product (source of truth,
            // same vocabulary as /inventory/products and the request mapping
            // on /inventory/requests). Defaults to NONE for products without
            // active procurement activity.
            pipeline_status: product.pipeline_status || 'NONE',
            stockTotal: product.stockTotal || 0, stockTransit: 0, requiredProposed: 0,
        }, ...prev])
    }

    const updateLine = (idx: number, updates: Record<string, any>) => {
        setLines(prev => { const next = [...prev]; Object.assign(next[idx], updates); return next })
    }
    const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx))

    const kpis = [
        { label: 'Lines', value: lines.length.toString(), color: 'var(--app-primary)', icon: <Hash size={14} /> },
        { label: 'Total HT', value: totals.ht.toLocaleString('fr-FR', { minimumFractionDigits: 0 }), color: 'var(--app-info)', icon: <DollarSign size={14} /> },
        { label: 'VAT', value: totals.vat.toLocaleString('fr-FR', { minimumFractionDigits: 0 }), color: 'var(--app-accent)', icon: <Layers size={14} /> },
        { label: 'Total TTC', value: totals.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 0 }), color: 'var(--app-success)', icon: <TrendingUp size={14} /> },
    ]

    const handleShareProfile = useCallback(async (id: string, shared: boolean) => {
        const { shareProfile } = await import('./_lib/profiles')
        const updated = await shareProfile(colProfiles, id, shared)
        setColProfiles(updated)
    }, [colProfiles])

    return (
        <div className="h-full flex flex-col overflow-hidden bg-app-background">
            <input type="hidden" name="scope" value={scope} form="po-form" />

            {/* ── Draft recovery banner ──
                 Surfaces a previously-autosaved order from a crashed /
                 closed tab. One tap to restore the snapshot, or dismiss
                 (which also wipes the draft). Hidden in edit mode and
                 once the user has acted on it. */}
            {showDraftBanner && (
                <div className="flex-shrink-0 mx-4 md:mx-6 mt-3 p-3 rounded-xl flex items-center gap-3"
                    style={{
                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 35%, transparent)',
                    }}>
                    <BookOpen size={16} className="flex-shrink-0" style={{ color: 'var(--app-info, #3b82f6)' }} />
                    <div className="flex-1 min-w-0">
                        <div className="text-tp-sm font-bold text-app-foreground">
                            Recover unsaved purchase order?
                        </div>
                        <div className="text-tp-xs text-app-muted-foreground truncate">
                            Auto-saved {draft ? new Date(draft.savedAt).toLocaleString() : ''}
                            {draft?.data?.lines?.length ? ` · ${draft.data.lines.length} line${draft.data.lines.length === 1 ? '' : 's'}` : ''}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={recoverDraft}
                        className="flex-shrink-0 px-3 h-8 rounded-lg text-tp-sm font-bold text-white transition-all active:scale-95"
                        style={{
                            background: 'var(--app-info, #3b82f6)',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)',
                        }}>
                        Recover
                    </button>
                    <button
                        type="button"
                        onClick={discardDraft}
                        className="flex-shrink-0 px-3 h-8 rounded-lg text-tp-sm font-bold transition-all active:scale-95"
                        style={{
                            background: 'transparent',
                            color: 'var(--app-muted-foreground)',
                            border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                        }}>
                        Discard
                    </button>
                </div>
            )}

            {/* ── Page Header ── */}
            <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <Link href="/purchases"
                            className="flex items-center justify-center w-8 h-8 rounded-xl border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <ArrowLeft size={15} />
                        </Link>
                        <div className="page-header-icon bg-app-primary"
                            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <ShoppingCart size={20} className="text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="font-black text-app-foreground tracking-tight leading-none truncate"
                                style={{ fontSize: 'var(--tp-lg)' }}
                                title={isEdit ? `Edit PO ${reference || `#${editId}`}` : 'New Purchase Order'}>
                                {isEdit ? `Edit PO ${reference || `#${editId}`}` : 'New Purchase Order'}
                            </h1>
                            {/* Subtitle is conditional:
                             *   - When the user hasn't configured anything yet → soft hint.
                             *   - Once Reference / Supplier / Site are set → show them as
                             *     compact chips so the operator can verify at a glance
                             *     without opening the side panel. After full setup the
                             *     "Click Configure to set up" hint is dead weight. */}
                            {(reference || selectedSupplier || selectedSite) ? (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                    {reference && (
                                        <SummaryChip
                                            icon={<Hash size={10} />}
                                            label={reference}
                                            color="var(--app-primary)"
                                            onClick={() => setSidebarOpen(true)}
                                        />
                                    )}
                                    {selectedSupplier && (
                                        <SummaryChip
                                            icon={<Building2 size={10} />}
                                            label={selectedSupplier.name}
                                            color="var(--app-info, #3b82f6)"
                                            onClick={() => setSidebarOpen(true)}
                                        />
                                    )}
                                    {selectedSite && (
                                        <SummaryChip
                                            icon={<MapPin size={10} />}
                                            label={selectedSite.name}
                                            color="var(--app-success, #22c55e)"
                                            onClick={() => setSidebarOpen(true)}
                                        />
                                    )}
                                    {/* Compact lifecycle chip — same data
                                     *  source as the sidebar's full version,
                                     *  so the two stay in sync. */}
                                    <POLifecycle
                                        current={poStatus}
                                        variant="compact"
                                        transitioning={statusTransitioning}
                                    />
                                </div>
                            ) : (
                                <p className="font-bold text-app-muted-foreground uppercase tracking-widest mt-0.5"
                                   style={{ fontSize: 'var(--tp-xxs)' }}>
                                    Draft · Click <span style={{ color: 'var(--app-primary)' }}>configure</span> to set up
                                </p>
                            )}
                        </div>
                    </div>

                    {/* ───────────────────────────────────────────
                     *  HEADER CONTROL ROW — three buttons sharing
                     *  the same height (h-9 / 36px), border radius
                     *  (rounded-xl), border treatment (app-border on
                     *  surface), and primary fill on active state.
                     *  Built with shared CSS variables so a theme tweak
                     *  stays consistent across all three.
                     * ───────────────────────────────────────────── */}
                    <div className="flex items-center gap-2 flex-shrink-0 h-9">
                        {/* Scope toggle —
                         *  Inactive pill: subtle hover tint so it reads as clickable.
                         *  All controls: `active:scale-[0.97]` press feedback (the
                         *  one universally-trusted modern micro-interaction). */}
                        <div className="h-9 flex items-center p-0.5 rounded-xl bg-app-surface border border-app-border">
                            {(['OFFICIAL', 'INTERNAL'] as const).map(s => {
                                const active = scope === s
                                return (
                                    <button key={s} type="button" onClick={() => setScope(s)}
                                            className={`h-8 px-3 text-[11px] font-bold rounded-lg transition-all active:scale-[0.97] ${active ? '' : 'hover:bg-app-surface-hover hover:text-app-foreground'}`}
                                            style={active
                                                ? { background: 'var(--app-primary)', color: 'white' }
                                                : { color: 'var(--app-muted-foreground)', background: 'transparent' }}>
                                        {s}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Configure icon button — same height, same surface, same border. */}
                        <button type="button" onClick={() => setSidebarOpen(true)}
                                aria-label="Configure setup"
                                title="Configure setup"
                                className="h-9 w-9 flex items-center justify-center rounded-xl border transition-all active:scale-[0.97] hover:brightness-105"
                                style={sidebarOpen ? {
                                    background: 'var(--app-primary)',
                                    color: 'white',
                                    borderColor: 'var(--app-primary)',
                                } : {
                                    background: 'var(--app-surface)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'var(--app-border)',
                                }}>
                            <Settings2 size={14} />
                        </button>

                        {/* Submit — same height, same radius, primary fill (always-on accent). */}
                        <form id="po-form" action={formAction}>
                            {/* Edit-mode marker. The update server action
                             *  reads `__poId` to know which PO to PATCH;
                             *  absent in create mode so the create action
                             *  ignores it. */}
                            {isEdit && editId !== null && (
                                <input type="hidden" name="__poId" value={editId} />
                            )}
                            <input type="hidden" name="scope" value={scope} />
                            <input type="hidden" name="supplierId" value={supplierId} />
                            <input type="hidden" name="siteId" value={selectedSiteId} />
                            <input type="hidden" name="warehouseId" value={warehouseId} />
                            <input type="hidden" name="assigneeId" value={assigneeId} />
                            <input type="hidden" name="driverId" value={driverId} />
                            <input type="hidden" name="reference" value={reference} />
                            <input type="hidden" name="supplierRef" value={supplierRef} />
                            <input type="hidden" name="orderDate" value={date} />
                            <input type="hidden" name="expectedDelivery" value={deliveryDate} />
                            <input type="hidden" name="lines" value={JSON.stringify(lines)} />
                            {/* Initial PO status — DRAFT for plain users,
                                Staff can choose Submitted/Approved (gated
                                in handleStatusChange). Travels to the
                                createPurchaseOrder action and onto Django. */}
                            <input type="hidden" name="status" value={poStatus} />
                            <button type="submit" disabled={!canSubmit}
                                    className="h-9 px-3.5 flex items-center gap-1.5 text-[11px] font-bold rounded-xl border transition-all active:scale-[0.97] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
                                    style={{
                                        background: 'var(--app-primary)',
                                        color: 'white',
                                        borderColor: 'var(--app-primary)',
                                        // Lowest-tier elevation — half a millimeter
                                        // of lift so the affirmative action reads
                                        // first. Only on this button; the toggle
                                        // and configure stay perfectly flat.
                                        boxShadow: canSubmit
                                            ? '0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 1px rgba(0, 0, 0, 0.04)'
                                            : 'none',
                                    }}>
                                <ArrowRight size={14} />
                                <span className="hidden sm:inline">
                                    {isPending
                                        ? (isEdit ? 'Saving…' : 'Processing…')
                                        : (isEdit ? 'Save Changes' : 'Create PO')}
                                </span>
                            </button>
                        </form>
                    </div>
                </div>

                {/* KPI Strip */}
                <div className="mt-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {kpis.map(k => (
                        <div key={k.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${k.color} 10%, transparent)`, color: k.color }}>
                                {k.icon}
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{k.label}</div>
                                <div className="text-sm font-black text-app-foreground tabular-nums">{k.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Content Row: Grid + Sidebar side-by-side ── */}
            <div className="flex-1 flex gap-0 px-4 md:px-6 pb-0 min-h-0">

                {/* Intelligence Grid */}
                <div className="flex-1 flex flex-col min-w-0 h-full">

                    {/* Toolbar */}
                    <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                        <div className="flex-1">
                            <ProductSearch ref={searchRef} callback={addProductToLines} siteId={Number(selectedSiteId) || 1} />
                        </div>
                        <ColumnVisibilityButton visibleColumns={visibleColumns} onClick={() => setColumnsOpen(true)} />
                        <button type="button" onClick={() => setCatalogueOpen(true)}
                            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all flex-shrink-0">
                            <BookOpen size={13} />
                            <span className="hidden md:inline">Catalogue</span>
                        </button>
                        <div className="flex items-center p-0.5 rounded-lg bg-app-surface border border-app-border">
                            <button
                                type="button"
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md transition-all ${viewMode === 'list' ? 'bg-app-primary text-white' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                                title="List View"
                            >
                                <List size={13} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('card')}
                                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md transition-all ${viewMode === 'card' ? 'bg-app-primary text-white' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                                title="Card View"
                            >
                                <LayoutGrid size={13} />
                            </button>
                        </div>
                        <button type="button" onClick={() => searchRef.current?.focus()}
                            className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all flex-shrink-0"
                            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            <Plus size={14} />
                            <span className="hidden sm:inline">New</span>
                        </button>
                    </div>

                    {/* Table / Grid */}
                    <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                        {/* ═══════════════════════════════════════════════════════════
                            PO INTELLIGENCE GRID
                            ============================================
                            Universal Template (Dajingo Pro V2)
                            Supports drag-reorder, proportional scaling, and mobile dual-layout.
                            ═══════════════════════════════════════════════════════════ */}
                        <div className={viewMode === 'card' ? 'hidden' : 'contents'}>
                            <DajingoListView<PurchaseLine>
                                data={lines}
                                allData={lines}
                                loading={false}
                                getRowId={line => line.productId as number}
                                
                                columns={COLUMN_DEFS}
                                visibleColumns={Object.fromEntries(COLUMN_DEFS.map(c => [c.key, visibleColumns.has(c.key as ColumnKey)]))}
                                columnWidths={COLUMN_WIDTHS}
                                rightAlignedCols={RIGHT_ALIGNED_COLS}
                                centerAlignedCols={CENTER_ALIGNED_COLS}
                                growCols={GROW_COLS}
                                columnOrder={columnOrder}
                                onColumnReorder={handleColumnReorder as (order: string[]) => void}
                                
                                entityLabel="Product"
                                
                                renderRowIcon={() => (
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                                        <Package size={14} />
                                    </div>
                                )}
                                
                                renderRowTitle={line => (
                                    <div className="flex flex-col min-w-0">
                                        <span className="truncate text-[12px] font-bold tracking-tight text-app-foreground leading-tight">{String(line.productName || '')}</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-mono font-bold text-app-muted-foreground uppercase tracking-widest bg-app-surface/50 px-1.5 py-0.5 rounded-md border border-app-border/40">
                                                {String(line.productId || 0).padStart(4, '0')}
                                            </span>
                                            {!!line.categoryName && (
                                                <span className="text-[9px] font-black text-app-muted-foreground/60 uppercase tracking-tighter">
                                                    • {String(line.categoryName)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                
                                renderColumnCell={(key, line) => {
                                    const idx = lines.findIndex(l => l.productId === line.productId)
                                    return renderPurchaseCell(key, line, idx, updateLine)
                                }}
                                
                                menuActions={line => {
                                    const idx = lines.findIndex(l => l.productId === line.productId)
                                    return [
                                        { label: 'View Product Details', icon: <Maximize2 size={12} className="text-app-primary" />, onClick: () => window.open(`/inventory/products/${line.productId}`, '_blank') },
                                        { label: 'Remove from PO', icon: <Trash2 size={12} className="text-app-error" />, onClick: () => removeLine(idx), separator: true },
                                    ]
                                }}
                                
                                emptyIcon={<ShoppingCart size={36} />}
                                emptyMessage="No products added to this purchase order yet."
                                
                                /* Selection */
                                selectedIds={new Set()}
                                
                                /* Toolbar Integration (matches List View pattern) */
                                onToggleCustomize={() => setColumnsOpen(true)}
                                
                            />
                        </div>
                        
                        {viewMode === 'card' && (
                            <div className="overflow-y-auto custom-scrollbar flex-1">
                                {lines.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                                        <ShoppingCart size={36} className="text-app-muted-foreground mb-3 opacity-40" />
                                        <p className="text-sm font-bold text-app-muted-foreground">No products added yet</p>
                                        <p className="text-[11px] text-app-muted-foreground mt-1">Search above or browse the catalogue to add products.</p>
                                    </div>
                                ) : (
                                    <LineCardGrid lines={lines} onUpdate={updateLine} onRemove={removeLine} />
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Catalogue Modal ── */}
                <CatalogueModal
                    open={catalogueOpen}
                    onClose={() => setCatalogueOpen(false)}
                    onAddProduct={addProductToLines}
                    existingProductIds={lines.map(l => l.productId as number)}
                    supplierId={supplierId}
                />

                {/* ── Column Visibility Panel (same pattern as Products CustomizePanel) ── */}
                <ColumnVisibilityPanel
                    isOpen={columnsOpen}
                    onClose={() => setColumnsOpen(false)}
                    visibleColumns={visibleColumns}
                    onToggle={handleColumnToggle}
                    columnOrder={columnOrder}
                    onReorder={handleColumnReorder}
                    profiles={colProfiles}
                    setProfiles={setColProfiles}
                    activeProfileId={activeColProfileId}
                    switchProfile={switchColProfile}
                    onShare={handleShareProfile}
                    isStaff={isStaff}
                />

                {/* ── Configuration Drawer (same pattern as categories detail panel) ── */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-200"
                        style={{ background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)' }}
                        onClick={(e) => { if (e.target === e.currentTarget) setSidebarOpen(false) }}
                    >
                        {/* Width bumped from 260px → 320px so the two date
                         *  fields (Order date / Expected) can each render the
                         *  "May 5, 2026" formatted label + chevron without
                         *  truncating. 320px also fits "OFFICIAL"/"INTERNAL"
                         *  scope pills + supplier select comfortably with the
                         *  new SearchableDropdown. */}
                        <div
                            className="w-[320px] max-w-full h-full flex flex-col animate-in slide-in-from-right-4 duration-300 shadow-2xl"
                            style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)' }}
                        >
                             <AdminSidebar
                                suppliers={suppliers} sites={sites} users={users}
                                supplierId={supplierId} onSupplierChange={setSupplierId}
                                siteId={selectedSiteId} onSiteChange={setSelectedSiteId}
                                warehouseId={warehouseId} onWarehouseChange={setWarehouseId}
                                scope={scope} onScopeChange={setScope}
                                assigneeId={assigneeId} onAssigneeChange={setAssigneeId}
                                driverId={driverId} onDriverChange={setDriverId}
                                reference={reference} onReferenceChange={(v) => { setReferenceTouched(true); setReference(v) }}
                                supplierRef={supplierRef} onSupplierRefChange={setSupplierRef}
                                date={date} onDateChange={setDate}
                                expectedDelivery={deliveryDate} onExpectedDeliveryChange={setDeliveryDate}
                                onClose={() => setSidebarOpen(false)}
                                poStatus={poStatus}
                                onStatusChange={isEdit ? handleStatusChange : undefined}
                                statusTransitioning={statusTransitioning}
                            />
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}

/* ─────────────────────────────────────────────────────────────────────
 *  SummaryChip — compact configured-value badge for the page header.
 *  Click → opens the configuration panel scrolled to the matching step.
 * ───────────────────────────────────────────────────────────────────── */
function SummaryChip({ icon, label, color, onClick }: {
    icon: React.ReactNode
    label: string
    color: string
    onClick?: () => void
}) {
    return (
        <button type="button" onClick={onClick} title={`${label} — click to edit`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold transition-all hover:brightness-110 max-w-[200px]"
                style={{
                    fontSize: 'var(--tp-xxs)',
                    background: `color-mix(in srgb, ${color} 10%, transparent)`,
                    color,
                    border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
                }}>
            <span className="flex-shrink-0 opacity-80">{icon}</span>
            <span className="truncate">{label}</span>
        </button>
    )
}
