/**
 * Legacy redirect shim — `/purchases/new` was relocated to
 * `/purchases/purchase-orders/new` so the create page lives next to
 * its list (matching `/purchases/invoices/new` next to /purchases/invoices).
 *
 * Preserves any querystring (e.g. `?edit=<id>` from the bulk-bar Edit
 * action) so existing bookmarks and links keep working.
 */
import { redirect } from 'next/navigation'

export default async function PurchasesNewRedirect({
    searchParams,
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = (await searchParams) ?? {}
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
        if (typeof v === 'string') qs.set(k, v)
        else if (Array.isArray(v)) v.forEach(x => qs.append(k, x))
    }
    const tail = qs.toString()
    redirect(`/purchases/purchase-orders/new${tail ? `?${tail}` : ''}`)
}
