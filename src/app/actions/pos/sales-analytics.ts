'use server'

import { erpFetch } from "@/lib/erp-api"
import { format, subDays } from "date-fns"

/**
 * Fetches pre-aggregated daily summary totals from Gap 9 endpoint.
 * Falls back to raw aggregation if new endpoint not ready.
 */
export async function getSalesAnalytics(days: number = 30) {
 const to = format(new Date(), 'yyyy-MM-dd')
 const from = format(subDays(new Date(), days), 'yyyy-MM-dd')
 try {
 // Try the new pre-aggregated endpoint first (Gap 9)
 const summary = await erpFetch(`pos/analytics/daily/summary/?from=${from}&to=${to}`)
 // Map to the shape the existing analytics page expects
 return {
 period: { start: from, end: to },
 overall: {
 revenue: parseFloat(summary.revenue_ttc || '0'),
 revenue_ht: parseFloat(summary.revenue_ht || '0'),
 orders: summary.orders_total || 0,
 avg_order: summary.orders_total
 ? parseFloat(summary.revenue_ttc || '0') / summary.orders_total
 : 0,
 tax: parseFloat(summary.tax_collected || '0'),
 discount: parseFloat(summary.discount_total || '0'),
 cogs: parseFloat(summary.cogs_total || '0'),
 gross_margin: parseFloat(summary.gross_margin || '0'),
 gross_margin_pct: parseFloat(summary.gross_margin_pct || '0'),
 cash: parseFloat(summary.cash_total || '0'),
 mobile: parseFloat(summary.mobile_total || '0'),
 credit: parseFloat(summary.credit_total || '0'),
 },
 // Daily trend: from list endpoint
 daily_trend: await erpFetch(`pos/analytics/daily/?from=${from}&to=${to}&page_size=90`)
 .then((r: any) => (r.results || []).map((row: any) => ({
 date: row.date,
 revenue: parseFloat(row.revenue_ttc || '0'),
 orders: row.orders_total,
 margin: parseFloat(row.gross_margin || '0'),
 })))
 .catch(() => []),
 payment_methods: [
 { method: 'CASH', total: parseFloat(summary.cash_total || '0'), count: 0 },
 { method: 'MOBILE', total: parseFloat(summary.mobile_total || '0'), count: 0 },
 { method: 'CREDIT', total: parseFloat(summary.credit_total || '0'), count: 0 },
 { method: 'BANK', total: parseFloat(summary.bank_total || '0'), count: 0 },
 ].filter(p => p.total > 0),
 // These still come from raw Order aggregation
 top_products: [],
 top_customers: [],
 site_performance: [],
 }
 } catch {
 // Fallback: raw aggregation (old endpoint)
 return await erpFetch(`pos/pos/sales-analytics/?days=${days}`).catch(() => null)
 }
}

/**
 * Fetches the SalesAuditLog for a specific order (Gap 8).
 */
export async function getOrderAuditLog(orderId: string | number, limit = 50) {
 return await erpFetch(`pos/orders/${orderId}/audit/?limit=${limit}`)
}
