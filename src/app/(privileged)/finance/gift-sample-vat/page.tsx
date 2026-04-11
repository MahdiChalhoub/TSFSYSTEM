import { redirect } from 'next/navigation'

/**
 * Redirect: Gift/Sample VAT → Inventory Gift/Sample Events
 * This page has moved from finance to inventory.
 */
export default function GiftSampleVATRedirect() {
  redirect('/inventory/gift-sample')
}
