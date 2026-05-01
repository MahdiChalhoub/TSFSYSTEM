'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

const PRINT_SESSIONS = 'inventory/print-sessions'

// ─── Product fetchers ────────────────────────────────────────────

export type LabelProduct = {
    id: number
    name?: string
    sku?: string
    barcode?: string
    [key: string]: unknown
}

export type GetProductsForLabelsArgs =
    | number[]
    | { search?: string; page_size?: number; page?: number }
    | undefined

/** Get products for label printing — returns full product details including barcode.
 *  Two call shapes are supported for backward compat:
 *    - `getProductsForLabels([1,2,3])` — filter by IDs
 *    - `getProductsForLabels({ search, page_size })` — paged search */
export async function getProductsForLabels(
    args?: GetProductsForLabelsArgs,
): Promise<{ results: LabelProduct[]; count?: number }> {
    if (Array.isArray(args)) {
        const products = await erpFetch('/products/') as { results?: LabelProduct[] } | LabelProduct[]
        const all = Array.isArray(products) ? products : (products.results ?? [])
        const ids = args
        return { results: all.filter((p) => ids.includes(p.id)) }
    }
    const params = new URLSearchParams()
    if (args?.search) params.set('search', args.search)
    if (args?.page_size) params.set('page_size', String(args.page_size))
    if (args?.page) params.set('page', String(args.page))
    const query = params.toString() ? '?' + params.toString() : ''
    const products = await erpFetch(`/products/${query}`) as { results?: LabelProduct[] } | LabelProduct[]
    if (Array.isArray(products)) return { results: products }
    return { results: products.results ?? [], count: undefined }
}

/** Search products by name/sku/barcode */
export async function searchProductsForLabels(query: string): Promise<LabelProduct[]> {
    const products = await erpFetch('/products/') as { results?: LabelProduct[] } | LabelProduct[]
    const all = Array.isArray(products) ? products : (products.results ?? [])
    if (!query) return all.slice(0, 50)
    const q = query.toLowerCase()
    return all.filter(
        (p) =>
            (typeof p.name === 'string' && p.name.toLowerCase().includes(q)) ||
            (typeof p.sku === 'string' && p.sku.toLowerCase().includes(q)) ||
            (typeof p.barcode === 'string' && p.barcode.toLowerCase().includes(q)),
    ).slice(0, 50)
}

// ─── Print Sessions ──────────────────────────────────────────────

export type PrintSessionStatus =
    | 'DRAFT' | 'APPROVED' | 'QUEUED' | 'PRINTING'
    | 'COMPLETED' | 'FAILED' | 'CANCELLED'

export type PrintSession = {
    id: number
    session_code?: string
    status?: PrintSessionStatus
    label_type?: string
    total_labels?: number
    items?: Array<{ product_id: number; quantity: number }>
    created_at?: string
    started_at?: string | null
    completed_at?: string | null
    error?: string
    detail?: string
    [key: string]: unknown
}

export type CreatePrintSessionInput = {
    label_type: string
    items: Array<{ product_id: number; quantity: number }>
}

export type PrintSessionActionResult = PrintSession & {
    error?: string
    detail?: string
}

export type PrintingKPI = {
    total_sessions: number
    total_labels: number
    labels_printed: number
    labels_pending: number
    stuck_sessions: number
    by_status: Record<string, number>
    [key: string]: unknown
}

export async function createPrintSession(
    input: CreatePrintSessionInput,
): Promise<PrintSessionActionResult> {
    const result = await erpFetch(`${PRINT_SESSIONS}/`, {
        method: 'POST',
        body: JSON.stringify(input),
    }) as PrintSessionActionResult
    revalidatePath('/inventory/labels')
    return result
}

export async function listPrintSessions(): Promise<PrintSession[]> {
    const result = await erpFetch(`${PRINT_SESSIONS}/`) as { results?: PrintSession[] } | PrintSession[]
    if (Array.isArray(result)) return result
    return result.results ?? []
}

export async function getPrintingKPI(): Promise<PrintingKPI> {
    const result = await erpFetch(`${PRINT_SESSIONS}/kpi/`) as Partial<PrintingKPI>
    return {
        total_sessions: result.total_sessions ?? 0,
        total_labels: result.total_labels ?? 0,
        labels_printed: result.labels_printed ?? 0,
        labels_pending: result.labels_pending ?? 0,
        stuck_sessions: result.stuck_sessions ?? 0,
        by_status: result.by_status ?? {},
        ...result,
    }
}

async function postPrintSessionAction(
    id: number,
    actionPath: string,
): Promise<PrintSessionActionResult> {
    const result = await erpFetch(`${PRINT_SESSIONS}/${id}/${actionPath}/`, {
        method: 'POST',
    }) as PrintSessionActionResult
    revalidatePath('/inventory/labels')
    return result
}

export async function approvePrintSession(id: number) {
    return postPrintSessionAction(id, 'approve')
}

export async function cancelPrintSession(id: number) {
    return postPrintSessionAction(id, 'cancel')
}

export async function retryPrintSession(id: number) {
    return postPrintSessionAction(id, 'retry')
}

export async function reprintExact(id: number) {
    return postPrintSessionAction(id, 'reprint_exact')
}

export async function reprintRegenerate(id: number) {
    return postPrintSessionAction(id, 'reprint_regenerate')
}
