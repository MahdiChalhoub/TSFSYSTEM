/**
 * Forwarding shim — `/inventory/purchases/...` is NOT a real path
 * (Purchases is a sibling module to Inventory, not a child). Anyone
 * landing here typed it wrong, has a stale TabNavigator tab, or
 * followed a bookmark from before the modules were split. Bounce them
 * to `/purchases/...` so they don't hit the "Module Under Construction"
 * page. Preserves any sub-segments (e.g. /inventory/purchases/invoices
 * → /purchases/invoices) and querystrings.
 */
import { redirect } from 'next/navigation'

export default async function InventoryPurchasesRedirect({
    params,
    searchParams,
}: {
    params: Promise<{ rest?: string[] }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const { rest = [] } = await params
    const sp = (await searchParams) ?? {}
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
        if (typeof v === 'string') qs.set(k, v)
        else if (Array.isArray(v)) v.forEach(x => qs.append(k, x))
    }
    const tail = qs.toString()
    const target = `/purchases${rest.length ? '/' + rest.join('/') : ''}`
    redirect(`${target}${tail ? `?${tail}` : ''}`)
}
