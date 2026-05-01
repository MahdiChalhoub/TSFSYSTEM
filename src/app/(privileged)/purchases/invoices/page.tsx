import { Metadata } from 'next'
import PurchaseInvoicesPage from './page-client'

export const metadata: Metadata = {
 title: 'Purchase Invoices | Purchasing',
 description: 'Process and manage billing for supplier purchases.',
}

/**
 * `?from_po=<id>` is set by the PO list "→ Invoice" action so the
 * operator lands here scoped to the source PO. We forward the param to
 * the client view, which filters the list, scrolls the matching row
 * into view, and shows a clearable "Showing invoices for PO #X" banner.
 *
 * Next 15 ships `searchParams` as a Promise — we await once and forward
 * a plain string (or undefined) so the client component stays simple.
 */
export default async function Page({
 searchParams,
}: {
 searchParams?: Promise<{ from_po?: string }>
}) {
 const params = (await searchParams) ?? {}
 const fromPo = params.from_po && /^\d+$/.test(params.from_po) ? params.from_po : undefined
 return <PurchaseInvoicesPage fromPo={fromPo} />
}
