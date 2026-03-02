/**
 * GET /api/org-currency
 * Returns the organization's base currency code.
 * Used by the useCurrency() hook to avoid hardcoded XOF in 31+ pages.
 */
import { NextResponse } from 'next/server'
import { erpFetch } from '@/lib/erp-api'

export const dynamic = 'force-dynamic'

export async function GET() {
 try {
 const settings = await erpFetch('settings/global_financial/')
 const currency = settings?.currency || 'XOF'
 return NextResponse.json({ currency }, {
 headers: {
 // Cache for 5 minutes in the browser — org currency rarely changes
 'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
 }
 })
 } catch {
 return NextResponse.json({ currency: 'XOF' })
 }
}
