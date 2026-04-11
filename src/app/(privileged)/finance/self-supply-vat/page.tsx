import { redirect } from 'next/navigation'

/**
 * Redirect: Self-Supply VAT → Inventory Internal Consumption
 * This page has moved from finance to inventory.
 */
export default function SelfSupplyVATRedirect() {
  redirect('/inventory/internal-consumption')
}
