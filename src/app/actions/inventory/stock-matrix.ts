'use server'

/**
 * Stock Cross-Analysis Matrix Server Actions
 * ============================================
 * Multi-dimensional stock analysis across products, countries,
 * parfums (variants), sizes, warehouses, and branches.
 */

import { erpFetch } from '@/lib/erp-api'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface MatrixProduct {
    id: number
    name: string
    sku: string
    barcode: string | null
    brand_id: number | null
    brand_name: string | null
    parfum_id: number | null
    parfum_name: string | null
    category_id: number | null
    category_name: string | null
    product_group_id: number | null
    product_group_name: string | null
    country_of_origin_id: number | null
    country_of_origin_name: string | null
    size: number | null
    size_unit: string | null
    size_label: string | null
    unit: string | null
    cost_price: number
    selling_price_ttc: number
    image_url: string | null
    stock: {
        on_hand: number
        reserved: number
        available: number
    }
    trend?: 'UP' | 'DOWN' | 'STABLE'
}

export interface MatrixParfum {
    parfum_id: number | null
    parfum_name: string
    total_stock: number
    products?: MatrixProduct[]
    country_sizes?: MatrixCountrySize[]
}

export interface MatrixCountrySize {
    country_id: number | null
    country_name: string
    country_code: string
    size: number | null
    size_label: string | null
    stock: number
    available: number
    cost_price: number
    selling_price: number
    product: MatrixProduct
}

export interface MatrixGroup {
    group_id: number | null
    group_name: string
    brand_id?: number | null
    brand_name: string
    image_url?: string | null
    total_stock?: number
    product_count?: number
    parfums: MatrixParfum[]
}

export interface MatrixVariant {
    variant_name: string
    attr_group_name: string
    total_stock: number
    product_count: number
    products: MatrixProduct[]
}

export interface MatrixBrandGroup {
    brand_id: number | null
    brand_name: string
    total_stock: number
    product_count: number
    variants: MatrixVariant[]
}

export interface MatrixCountry {
    country_id: number | null
    country_name: string
    country_code: string
    total_stock: number
    product_count: number
    brands: MatrixBrandGroup[]
    groups?: MatrixGroup[]  // legacy fallback
}

export interface MatrixFilters {
    countries: { id: number; name: string; count: number }[]
    brands: { id: number; name: string; count: number }[]
    product_groups: { id: number; name: string; count: number }[]
    parfums: { id: number; name: string; count: number }[]
    warehouses: { id: number; name: string; type: string; country: string | null }[]
}

// ═══════════════════════════════════════════════════════════════
// API Calls
// ═══════════════════════════════════════════════════════════════

interface MatrixQueryParams {
    origin_country_ids?: number[]
    brand_ids?: number[]
    group_ids?: number[]
    parfum_ids?: number[]
    category_ids?: number[]
    warehouse_ids?: number[]
    stock_country_ids?: number[]
    branch_ids?: number[]
    search?: string
}

function buildQueryString(params: MatrixQueryParams): string {
    const qs: string[] = []
    if (params.origin_country_ids?.length) qs.push(`origin_country_ids=${params.origin_country_ids.join(',')}`)
    if (params.brand_ids?.length) qs.push(`brand_ids=${params.brand_ids.join(',')}`)
    if (params.group_ids?.length) qs.push(`group_ids=${params.group_ids.join(',')}`)
    if (params.parfum_ids?.length) qs.push(`parfum_ids=${params.parfum_ids.join(',')}`)
    if (params.category_ids?.length) qs.push(`category_ids=${params.category_ids.join(',')}`)
    if (params.warehouse_ids?.length) qs.push(`warehouse_ids=${params.warehouse_ids.join(',')}`)
    if (params.stock_country_ids?.length) qs.push(`stock_country_ids=${params.stock_country_ids.join(',')}`)
    if (params.branch_ids?.length) qs.push(`branch_ids=${params.branch_ids.join(',')}`)
    if (params.search) qs.push(`search=${encodeURIComponent(params.search)}`)
    return qs.length ? `?${qs.join('&')}` : ''
}

/**
 * View 1: Stock grouped by Country of Origin
 * Country > ProductGroup > Parfum > Products
 */
export async function getStockMatrixByCountry(params: MatrixQueryParams = {}): Promise<{
    countries: MatrixCountry[]
}> {
    try {
        const qs = buildQueryString(params)
        const data = await erpFetch(`inventory/stock-matrix/by-country/${qs}`)
        return data || { countries: [] }
    } catch (error) {
        console.error('[StockMatrix] byCountry failed:', error)
        return { countries: [] }
    }
}

/**
 * View 2: Stock grouped by Product Group
 * ProductGroup > Parfum > Country × Size
 */
export async function getStockMatrixByProduct(params: MatrixQueryParams = {}): Promise<{
    product_groups: (MatrixGroup & { total_stock: number; product_count: number })[]
}> {
    try {
        const qs = buildQueryString(params)
        const data = await erpFetch(`inventory/stock-matrix/by-product/${qs}`)
        return data || { product_groups: [] }
    } catch (error) {
        console.error('[StockMatrix] byProduct failed:', error)
        return { product_groups: [] }
    }
}

/**
 * Available filter options for the matrix UI
 */
export async function getStockMatrixFilters(): Promise<MatrixFilters> {
    try {
        const data = await erpFetch('inventory/stock-matrix/filters/')
        return data || { countries: [], brands: [], product_groups: [], parfums: [], warehouses: [] }
    } catch (error) {
        console.error('[StockMatrix] filters failed:', error)
        return { countries: [], brands: [], product_groups: [], parfums: [], warehouses: [] }
    }
}

// ═══════════════════════════════════════════════════════════════
// Sales Periods
// ═══════════════════════════════════════════════════════════════

export interface SalesPeriod {
    period_num: number
    period_start: string
    period_end: string
    qty_sold: number
}

export interface SalesPeriodsResponse {
    product_id: number
    product_name: string
    period_days: number
    lookback_days: number
    total_periods: number
    periods: SalesPeriod[]
    avg_daily_sales: number
    total_sold: number
    needed_qty: number
    current_stock: number
}

export async function getProductSalesPeriods(
    productId: number,
    periodDays: number = 7,
    lookbackDays: number = 90
): Promise<SalesPeriodsResponse | null> {
    try {
        const data = await erpFetch(
            `inventory/stock-matrix/sales-periods/?product_id=${productId}&period_days=${periodDays}&lookback_days=${lookbackDays}`,
            { cache: 'no-store' }
        )
        return data
    } catch (error) {
        console.error('[StockMatrix] salesPeriods failed:', error)
        return null
    }
}
