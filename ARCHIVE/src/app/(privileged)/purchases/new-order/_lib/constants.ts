/**
 * New Order Form — Constants & Utilities
 * =========================================
 */

import type { OrderLine } from './types'

/* ── Style tokens ── */
export const card = "bg-app-surface rounded-2xl border border-app-border/70 overflow-hidden shadow-sm"
export const cardHead = (accent: string) => `px-5 py-3.5 border-l-[3px] ${accent} flex items-center justify-between bg-gradient-to-r from-app-surface to-app-background/30`
export const cardTitle = "text-[14px] font-bold text-app-foreground tracking-[-0.01em]"
export const fieldLabel = "block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest"
export const fieldInput = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-[10px] text-[13px] focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all text-app-foreground placeholder:text-app-muted-foreground"
export const fieldSelect = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-[10px] text-[13px] focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all text-app-foreground appearance-none"
// Legacy aliases
export const selectClass = fieldSelect
export const labelClass = fieldLabel
export const cardClass = card

/* ── Column system ── */
export const PO_ALL_COLUMNS: { key: string; label: string; sub?: string; w: number; defaultVisible: boolean }[] = [
    { key: 'qty',            label: 'Qty',              sub: 'proposed',            w: 80,  defaultVisible: true },
    { key: 'stock',          label: 'Stock',            sub: 'total',              w: 90,  defaultVisible: true },
    { key: 'productStatus',  label: 'Status',           sub: 'po count',           w: 80,  defaultVisible: true },
    { key: 'trend',          label: 'Trend',                                       w: 55,  defaultVisible: true },
    { key: 'salesWindows',   label: 'Demand',           sub: 'windows',            w: 180, defaultVisible: true },
    { key: 'dailySales',     label: 'Sales',            sub: 'monthly',            w: 75,  defaultVisible: true },
    { key: 'financialScore', label: 'Financial',        sub: 'adjustment',         w: 70,  defaultVisible: true },
    { key: 'unitCost',       label: 'Cost',             sub: 'sell · margin',      w: 85,  defaultVisible: true },
    { key: 'bestSupplier',   label: 'Supplier',         sub: 'price',              w: 100, defaultVisible: true },
    { key: 'expiry',         label: 'Expiry',           sub: 'safety',             w: 75,  defaultVisible: true },
    { key: 'suppliers',      label: 'Sup+',                                        w: 60,  defaultVisible: true },
]

export const PO_DEFAULT_VISIBLE_COLS = Object.fromEntries(PO_ALL_COLUMNS.map(c => [c.key, c.defaultVisible]))

/* ── Profile system ── */
export type POViewProfile = {
    id: string;
    name: string;
    columns: Record<string, boolean>;
}

export const PO_MAX_PROFILES = 8
export const PO_PROFILES_KEY = 'po_view_profiles'
export const PO_ACTIVE_PROFILE_KEY = 'po_active_profile'

export function loadPOProfiles(): POViewProfile[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(PO_PROFILES_KEY)
        if (raw) {
            const profiles: POViewProfile[] = JSON.parse(raw)
            return profiles.map(p => ({
                ...p,
                columns: { ...PO_DEFAULT_VISIBLE_COLS, ...Object.fromEntries(Object.entries(p.columns).filter(([k]) => k in PO_DEFAULT_VISIBLE_COLS)) }
            }))
        }
    } catch { /* noop */ }
    return [{ id: 'default', name: 'Default', columns: PO_DEFAULT_VISIBLE_COLS }]
}

export function savePOProfiles(profiles: POViewProfile[]) {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(PO_PROFILES_KEY, JSON.stringify(profiles)) } catch { /* noop */ }
}

export function loadPOActiveProfileId(): string {
    if (typeof window === 'undefined') return 'default'
    return localStorage.getItem(PO_ACTIVE_PROFILE_KEY) || 'default'
}

export function savePOActiveProfileId(id: string) {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(PO_ACTIVE_PROFILE_KEY, id) } catch { /* noop */ }
}

/* ── Create line from product data ── */
export function createLine(product: Record<string, any>): OrderLine {
    const dailySales = Number(product.avg_daily_sales ?? product.daily_sales ?? product.dailySales ?? 0) || 0
    const monthlyAvg = Number(product.monthly_average ?? (dailySales * 30)) || 0
    const stockHere = Number(product.stock_on_location ?? product.stockLevel ?? product.stock ?? 0) || 0
    const stockTotal = Number(product.stock_total ?? stockHere) || 0
    const proposedQty = Number(product.proposed_qty ?? product.proposedQty ?? 0) || 0
    const qtyRequired = proposedQty > 0 ? proposedQty : Math.max(0, Math.ceil(monthlyAvg * 1.5) - stockTotal)

    return {
        id: `line-${product.id}-${Date.now()}`,
        productId: product.id,
        productName: product.name || '',
        barcode: product.barcode || product.sku || product.product_sku || '',
        unit: product.unit_name || product.unit || product.uom || 'PCS',
        category: product.category_name || product.categoryName || product.category || '',
        qtyRequired,
        qtyProposed: proposedQty > 0 ? proposedQty : qtyRequired,
        stockOnLocation: stockHere,
        stockTotal,
        stockInTransit: Number(product.stock_in_transit ?? 0) || 0,
        purchaseCount: Number(product.purchase_count ?? 0) || 0,
        productStatus: product.product_status || (product.is_active !== false ? 'Available' : 'Unavailable'),
        statusDetail: product.status_detail || null,
        dailySales,
        monthlyAverage: monthlyAvg,
        salesPeriodDays: Number(product.sales_period_days ?? 180) || 180,
        financialScore: Number(product.financial_score ?? 0) || 0,
        adjustmentScore: Number(product.adjustment_score ?? 100) || 100,
        marginPct: Number(product.margin_pct ?? 0) || 0,
        unitCost: Number(product.cost_price_ht ?? product.cost_price ?? product.costPriceHT ?? 0) || 0,
        sellingPrice: Number(product.selling_price_ht ?? product.sellingPriceHT ?? 0) || 0,
        bestSupplier: product.best_supplier_name ?? '',
        bestPrice: Number(product.best_supplier_price ?? 0) || 0,
        bestPricePeriodDays: Number(product.best_price_period_days ?? 180) || 180,
        isExpiryTracked: product.is_expiry_tracked ?? false,
        expiryInfo: product.expiry_info || null,
        safetyTag: product.safety_tag ?? 'SAFE',
        availableSuppliers: (product.available_suppliers ?? []).map((s: any) => ({
            name: typeof s === 'string' ? s : (s.supplier_name || s.name || ''),
            price: s.last_purchased_price ?? s.price ?? undefined,
            last_date: s.last_date ?? undefined,
        })),
        salesWindows: product.sales_windows ?? [],
        salesWindowSizeDays: Number(product.sales_window_size_days ?? 15) || 15,
        trend: product.trend ?? 'FLAT',
        actionQty: qtyRequired > 0 ? qtyRequired : 1,
    }
}
