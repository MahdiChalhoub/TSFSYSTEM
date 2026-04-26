/**
 * /finance/currencies — moved to /settings/regional (single source of truth).
 *
 * The currency configuration (base, enabled list) lives alongside countries
 * and languages in Regional Settings. The FX-rate management surface
 * (Rates / Auto-Sync / Revaluations) is mounted there as the "FX" tab via
 * `_components/FxManagementSection`. This page is kept only as a permanent
 * redirect so existing links keep working.
 */
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function CurrenciesRedirect() {
    redirect('/settings/regional?tab=fx')
}
