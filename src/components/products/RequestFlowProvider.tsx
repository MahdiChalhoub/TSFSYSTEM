'use client'

import {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition,
} from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ShoppingCart, ArrowRightLeft, X, Trash2, Loader2 } from 'lucide-react'
import {
    createProcurementRequest, getSuggestedQuantity,
} from '@/app/actions/commercial/procurement-requests'
import { bumpProcurementRequest } from '@/app/actions/inventory/procurement-requests'
import { getPurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import { RequestProductDialog, type RequestableProduct } from './RequestProductDialog'

type RequestType = 'PURCHASE' | 'TRANSFER'
type FlowMode = 'INSTANT' | 'DIALOG' | 'CART'

type CartLine = { type: RequestType; product: RequestableProduct }

type Ctx = {
    mode: FlowMode
    cart: CartLine[]
    trigger: (type: RequestType, products: RequestableProduct[]) => void
    addToCart: (type: RequestType, products: RequestableProduct[]) => void
    removeFromCart: (type: RequestType, productId: number) => void
    clearCart: () => void
    submitCart: () => void
}

const RequestFlowContext = createContext<Ctx | null>(null)

export function useRequestFlow() {
    const ctx = useContext(RequestFlowContext)
    if (!ctx) throw new Error('useRequestFlow must be used inside <RequestFlowProvider>')
    return ctx
}

const CART_STORAGE_KEY = 'tsf_request_cart_v1'

export function RequestFlowProvider({ children }: { children: React.ReactNode }) {
    const [mode, setMode] = useState<FlowMode>('DIALOG')
    const [dialog, setDialog] = useState<{ type: RequestType; products: RequestableProduct[] } | null>(null)
    const [cart, setCart] = useState<CartLine[]>(() => {
        if (typeof window === 'undefined') return []
        try {
            const raw = window.localStorage.getItem(CART_STORAGE_KEY)
            if (!raw) return []
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : []
        } catch { return [] }
    })
    const [pending, startTransition] = useTransition()
    const modeRef = useRef<FlowMode>('DIALOG')
    modeRef.current = mode

    useEffect(() => {
        getPurchaseAnalyticsConfig().then(cfg => {
            const m = (cfg.request_flow_mode || 'DIALOG') as FlowMode
            setMode(m === 'INSTANT' || m === 'CART' ? m : 'DIALOG')
        })
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)) } catch {}
    }, [cart])

    const addToCart = useCallback((type: RequestType, products: RequestableProduct[]) => {
        setCart(prev => {
            const existingKey = new Set(prev.map(l => `${l.type}:${l.product.id}`))
            const additions = products
                .filter(p => !existingKey.has(`${type}:${p.id}`))
                .map(p => ({ type, product: p }))
            if (additions.length === 0) {
                toast.info('Already in your draft cart')
                return prev
            }
            toast.success(`Added ${additions.length} to ${type === 'PURCHASE' ? 'purchase' : 'transfer'} cart`)
            return [...prev, ...additions]
        })
    }, [])

    const removeFromCart = useCallback((type: RequestType, productId: number) => {
        setCart(prev => prev.filter(l => !(l.type === type && l.product.id === productId)))
    }, [])

    const clearCart = useCallback(() => setCart([]), [])

    const instantCreate = useCallback((type: RequestType, products: RequestableProduct[]) => {
        startTransition(async () => {
            let created = 0
            const failures: string[] = []
            for (const product of products) {
                try {
                    const sug = await getSuggestedQuantity(product.id)
                    const qty = sug && sug.suggested_qty > 0 ? sug.suggested_qty : 1
                    await createProcurementRequest({
                        requestType: type, productId: product.id, quantity: qty, priority: 'NORMAL',
                    })
                    created++
                } catch (e: any) {
                    failures.push(`${product.name}: ${e?.message || 'failed'}`)
                }
            }
            if (created > 0) {
                toast.success(
                    `${created} ${type === 'PURCHASE' ? 'purchase' : 'transfer'} request${created === 1 ? '' : 's'} created`,
                    { description: 'Open requests list', action: { label: 'View →', onClick: () => { window.location.href = '/inventory/requests' } } },
                )
            }
            if (failures.length > 0) {
                toast.error(`${failures.length} failed`, { description: failures.slice(0, 3).join('\n') })
            }
        })
    }, [])

    const submitCart = useCallback(() => {
        if (cart.length === 0) return
        startTransition(async () => {
            let created = 0
            const failures: string[] = []
            for (const line of cart) {
                try {
                    const sug = await getSuggestedQuantity(line.product.id)
                    const qty = sug && sug.suggested_qty > 0 ? sug.suggested_qty : 1
                    await createProcurementRequest({
                        requestType: line.type, productId: line.product.id, quantity: qty, priority: 'NORMAL',
                    })
                    created++
                } catch (e: any) {
                    failures.push(`${line.product.name}: ${e?.message || 'failed'}`)
                }
            }
            if (created > 0) {
                toast.success(
                    `${created} request${created === 1 ? '' : 's'} created`,
                    { description: 'Open requests list', action: { label: 'View →', onClick: () => { window.location.href = '/inventory/requests' } } },
                )
                setCart([])
            }
            if (failures.length > 0) {
                toast.error(`${failures.length} failed`, { description: failures.slice(0, 3).join('\n') })
            }
        })
    }, [cart])

    const trigger = useCallback((type: RequestType, products: RequestableProduct[]) => {
        // Block duplicates: if a product already has an active procurement state
        // (REQUESTED / PO_SENT / IN_TRANSIT), don't queue a new request.
        const ACTIVE = new Set(['REQUESTED', 'PO_SENT', 'PO_ACCEPTED', 'IN_TRANSIT'])
        const blocked: RequestableProduct[] = []
        const allowed: RequestableProduct[] = []
        for (const p of products) {
            if (p.procurement_status && ACTIVE.has(p.procurement_status)) blocked.push(p)
            else allowed.push(p)
        }
        if (blocked.length > 0) {
            const names = blocked.slice(0, 3).map(p => p.name).join(', ')
            const more = blocked.length > 3 ? ` +${blocked.length - 3} more` : ''
            toast.warning(`${blocked.length} already in flight`, {
                description: `${names}${more}. Bump priority to remind procurement, or wait for delivery.`,
                action: {
                    label: 'Bump priority',
                    onClick: async () => {
                        const results = await Promise.all(
                            blocked.map(p => bumpProcurementRequest({ productId: p.id })),
                        )
                        const ok = results.filter(r => r.success).length
                        const fail = results.length - ok
                        if (ok > 0) toast.success(`Bumped ${ok} request${ok === 1 ? '' : 's'}`)
                        if (fail > 0) toast.error(`${fail} bump${fail === 1 ? '' : 's'} failed`)
                    },
                },
            })
        }
        if (allowed.length === 0) return
        const m = modeRef.current
        if (m === 'INSTANT') instantCreate(type, allowed)
        else if (m === 'CART') addToCart(type, allowed)
        else setDialog({ type, products: allowed })
    }, [instantCreate, addToCart])

    const ctxValue = useMemo<Ctx>(() => ({
        mode, cart, trigger, addToCart, removeFromCart, clearCart, submitCart,
    }), [mode, cart, trigger, addToCart, removeFromCart, clearCart, submitCart])

    return (
        <RequestFlowContext.Provider value={ctxValue}>
            {children}
            {dialog && (
                <RequestProductDialog
                    open
                    onClose={() => setDialog(null)}
                    requestType={dialog.type}
                    products={dialog.products}
                />
            )}
            {cart.length > 0 && <CartTray cart={cart} pending={pending} onRemove={removeFromCart} onClear={clearCart} onSubmit={submitCart} />}
        </RequestFlowContext.Provider>
    )
}

function CartTray({
    cart, pending, onRemove, onClear, onSubmit,
}: {
    cart: CartLine[]
    pending: boolean
    onRemove: (type: RequestType, productId: number) => void
    onClear: () => void
    onSubmit: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    const purchaseCount = cart.filter(l => l.type === 'PURCHASE').length
    const transferCount = cart.filter(l => l.type === 'TRANSFER').length
    return (
        <div
            className="fixed z-40 rounded-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-200 bottom-3 right-3 left-3 sm:left-auto sm:bottom-4 sm:right-4"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                maxWidth: expanded ? 'min(360px, calc(100vw - 24px))' : 'calc(100vw - 24px)',
                marginLeft: 'auto',
                maxHeight: expanded ? 'min(440px, calc(100vh - 5rem))' : 'auto',
            }}
        >
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="flex items-center gap-2 px-3 py-2.5 hover:bg-app-border/20 transition-colors rounded-2xl"
                style={{ borderBottom: expanded ? '1px solid var(--app-border)' : 'none' }}
            >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-app-primary"
                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                    <ShoppingCart size={14} className="text-white" />
                </div>
                <div className="text-left">
                    <div className="text-[12px] font-black text-app-foreground">Request Cart</div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground">
                        {purchaseCount} purchase · {transferCount} transfer
                    </div>
                </div>
                {!expanded && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onSubmit() }}
                        disabled={pending}
                        className="ml-2 text-[10px] font-bold text-white px-2.5 py-1.5 rounded-lg bg-app-primary hover:brightness-110 transition-all disabled:opacity-50"
                    >
                        {pending ? <Loader2 size={11} className="animate-spin inline" /> : `Submit ${cart.length}`}
                    </button>
                )}
            </button>
            {expanded && (
                <>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {cart.map(line => {
                            const TypeIcon = line.type === 'PURCHASE' ? ShoppingCart : ArrowRightLeft
                            const tint = line.type === 'PURCHASE' ? 'var(--app-info, #3b82f6)' : 'var(--app-warning, #f59e0b)'
                            return (
                                <div key={`${line.type}:${line.product.id}`}
                                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-app-border/20 transition-colors"
                                    style={{ borderLeft: `3px solid color-mix(in srgb, ${tint} 50%, transparent)` }}>
                                    <TypeIcon size={11} style={{ color: tint }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[11px] font-bold text-app-foreground truncate">{line.product.name}</div>
                                        <div className="text-[9px] font-mono text-app-muted-foreground truncate">{line.product.sku || '—'}</div>
                                    </div>
                                    <button onClick={() => onRemove(line.type, line.product.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-app-border/40 text-app-muted-foreground hover:text-app-error transition-all">
                                        <X size={11} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                    <div className="flex items-center justify-between gap-2 p-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                        <button onClick={onClear} disabled={pending}
                            className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-error transition-colors disabled:opacity-50">
                            <Trash2 size={10} /> Clear
                        </button>
                        <Link href="/inventory/requests" className="text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground">
                            View existing
                        </Link>
                        <button onClick={onSubmit} disabled={pending}
                            className="flex items-center gap-1 text-[10px] font-bold text-white px-3 py-1.5 rounded-lg bg-app-primary hover:brightness-110 transition-all disabled:opacity-50">
                            {pending ? <Loader2 size={11} className="animate-spin" /> : <ShoppingCart size={11} />}
                            {pending ? 'Submitting…' : `Submit ${cart.length}`}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
