'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api"

export interface ProductAnalytics {
    id: number
    sku: string
    barcode: string | null
    name: string
    category_name: string | null
    brand_name: string | null
    unit_code: string | null
    total_stock: number
    min_stock_level: number
    cost_price: number
    selling_price_ttc: number
    avg_daily_sales: number
    avg_monthly_sales: number
    total_sold_30d: number
    total_purchased_30d: number
    avg_unit_cost: number
    health_score: number
    stock_days_remaining: number | null
    request_status: string | null      // PENDING, APPROVED, CONVERTED, REJECTED, CANCELLED
    request_type: string | null        // purchase_request, transfer_request, etc.
    request_id: number | null
    request_priority: string | null
    order_type: string | null          // stock_adjustment, stock_transfer, purchase_order
    order_id: number | null
    rejection_reason: string | null
}

export interface ProductAnalyticsResponse {
    products: ProductAnalytics[]
    total: number
}

export interface AnalyticsFilters {
    search?: string
    category?: string
    brand?: string
    warehouse_id?: string
    status?: string              // AVAILABLE, REQUESTED, ORDER_CREATED, FAILED
    hide_completed?: boolean
    limit?: number
    offset?: number
}

export async function getProductAnalytics(filters: AnalyticsFilters = {}): Promise<ProductAnalyticsResponse> {
    try {
        const q = new URLSearchParams()
        if (filters.search) q.append('search', filters.search)
        if (filters.category) q.append('category', filters.category)
        if (filters.brand) q.append('brand', filters.brand)
        if (filters.warehouse_id) q.append('warehouse_id', filters.warehouse_id)
        if (filters.status) q.append('status', filters.status)
        if (filters.hide_completed) q.append('hide_completed', 'true')
        if (filters.limit) q.append('limit', filters.limit.toString())
        if (filters.offset) q.append('offset', filters.offset.toString())

        return await erpFetch(`products/product_analytics/?${q.toString()}`)
    } catch (error) {
        console.error("Failed to fetch product analytics:", error)
        return { products: [], total: 0 }
    }
}

export async function getWarehouses() {
    try {
        return await erpFetch('warehouses/')
    } catch (error) {
        handleAuthError(error)
        console.error("Failed to fetch warehouses:", error)
        return []
    }
}

export async function getCategories() {
    try {
        return await erpFetch('categories/')
    } catch (error) {
        handleAuthError(error)
        console.error("Failed to fetch categories:", error)
        return []
    }
}

export async function getBrands() {
    try {
        return await erpFetch('brands/')
    } catch (error) {
        handleAuthError(error)
        console.error("Failed to fetch brands:", error)
        return []
    }
}
