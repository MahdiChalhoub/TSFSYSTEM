import { redirect } from 'next/navigation'

/**
 * Redirect: Import Declarations → Procurement Import Declarations
 * This page has moved from finance to procurement.
 */
export default function ImportDeclarationsRedirect() {
  redirect('/procurement/import-declarations')
}
