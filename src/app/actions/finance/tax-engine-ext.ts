'use server'
/**
 * Tax Engine Server Actions
 * ==========================
 * Pure tax rules and compliance actions only.
 *
 * Models that MOVED to their domain modules:
 *   - Gift/Sample → inventory/business-events.ts
 *   - Self-Supply/Internal Consumption → inventory/business-events.ts
 *   - Import Declarations → procurement/import-declarations.ts
 *   - Intra-Branch VAT → absorbed into StockTransferOrder
 *
 * Remaining here (pure tax compliance):
 *   1. WithholdingTaxRule
 *   2. BadDebtVATClaim
 *   3. AdvancePaymentVAT
 *   4. CreditNoteVATReversal
 *   5. MarginSchemeTransaction
 *   6. ReverseChargeSelfAssessment
 *   7. VATRateChangeHistory
 */
import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'

// ════════════════════════════════════════════════════════════════════
// 1. Withholding Tax Rules
// ════════════════════════════════════════════════════════════════════

export async function getWithholdingTaxRules() {
  return erpFetch('withholding-tax-rules/')
}

export async function getWithholdingTaxRule(id: string | number) {
  return erpFetch(`withholding-tax-rules/${id}/`)
}

export async function createWithholdingTaxRule(data: any) {
  const result = await erpFetch('withholding-tax-rules/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/withholding-tax-rules')
  return result
}

export async function updateWithholdingTaxRule(id: string | number, data: any) {
  const result = await erpFetch(`withholding-tax-rules/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/withholding-tax-rules')
  return result
}

export async function deleteWithholdingTaxRule(id: string | number) {
  const result = await erpFetch(`withholding-tax-rules/${id}/`, {
    method: 'DELETE',
  })
  revalidatePath('/finance/withholding-tax-rules')
  return result
}

export async function getWithholdingRulesByProfile(profileId: string | number) {
  return erpFetch(`withholding-tax-rules/by-profile/${profileId}/`)
}

// ════════════════════════════════════════════════════════════════════
// 2. Bad Debt VAT Claims
// ════════════════════════════════════════════════════════════════════

export async function getBadDebtVATClaims() {
  return erpFetch('bad-debt-vat-claims/')
}

export async function getBadDebtVATClaim(id: string | number) {
  return erpFetch(`bad-debt-vat-claims/${id}/`)
}

export async function createBadDebtVATClaim(data: any) {
  const result = await erpFetch('bad-debt-vat-claims/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/bad-debt-vat-claims')
  return result
}

export async function updateBadDebtVATClaim(id: string | number, data: any) {
  const result = await erpFetch(`bad-debt-vat-claims/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/bad-debt-vat-claims')
  return result
}

export async function submitBadDebtClaim(id: string | number) {
  const result = await erpFetch(`bad-debt-vat-claims/${id}/submit-claim/`, {
    method: 'POST',
  })
  revalidatePath('/finance/bad-debt-vat-claims')
  return result
}

export async function markBadDebtRecovered(id: string | number, recoveredAmount?: number) {
  const result = await erpFetch(`bad-debt-vat-claims/${id}/mark-recovered/`, {
    method: 'POST',
    body: JSON.stringify({ recovered_amount: recoveredAmount }),
  })
  revalidatePath('/finance/bad-debt-vat-claims')
  return result
}

export async function getBadDebtDashboard() {
  return erpFetch('bad-debt-vat-claims/dashboard/')
}

// ════════════════════════════════════════════════════════════════════
// 3. Advance Payment VAT
// ════════════════════════════════════════════════════════════════════

export async function getAdvancePaymentVATRecords() {
  return erpFetch('finance/advance-payment-vat/')
}

export async function createAdvancePaymentVAT(data: any) {
  const result = await erpFetch('finance/advance-payment-vat/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/advance-payment-vat')
  return result
}

export async function declareAdvancePaymentVAT(id: string | number) {
  const result = await erpFetch(`finance/advance-payment-vat/${id}/declare/`, {
    method: 'POST',
  })
  revalidatePath('/finance/advance-payment-vat')
  return result
}

export async function linkAdvancePaymentInvoice(id: string | number, invoiceId: number) {
  const result = await erpFetch(`finance/advance-payment-vat/${id}/link-invoice/`, {
    method: 'POST',
    body: JSON.stringify({ invoice_id: invoiceId }),
  })
  revalidatePath('/finance/advance-payment-vat')
  return result
}

export async function getAdvancePaymentDashboard() {
  return erpFetch('finance/advance-payment-vat/dashboard/')
}

// ════════════════════════════════════════════════════════════════════
// 4. Credit Note VAT Reversals
// ════════════════════════════════════════════════════════════════════

export async function getCreditNoteVATReversals() {
  return erpFetch('finance/credit-note-vat/')
}

export async function createCreditNoteVATReversal(data: any) {
  const result = await erpFetch('finance/credit-note-vat/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/credit-note-vat')
  return result
}

export async function getCreditNoteVATDashboard() {
  return erpFetch('finance/credit-note-vat/dashboard/')
}

// ════════════════════════════════════════════════════════════════════
// 5. Margin Scheme
// ════════════════════════════════════════════════════════════════════

export async function getMarginSchemeTransactions() {
  return erpFetch('finance/margin-scheme/')
}

export async function createMarginSchemeTransaction(data: any) {
  const result = await erpFetch('finance/margin-scheme/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/margin-scheme')
  return result
}

export async function updateMarginSchemeTransaction(id: string | number, data: any) {
  const result = await erpFetch(`finance/margin-scheme/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/margin-scheme')
  return result
}

export async function calculateMarginScheme(id: string | number) {
  const result = await erpFetch(`finance/margin-scheme/${id}/calculate/`, {
    method: 'POST',
  })
  revalidatePath('/finance/margin-scheme')
  return result
}

export async function getMarginSchemeDashboard() {
  return erpFetch('finance/margin-scheme/dashboard/')
}

// ════════════════════════════════════════════════════════════════════
// 6. Reverse Charge Self-Assessment
// ════════════════════════════════════════════════════════════════════

export async function getReverseChargeAssessments() {
  return erpFetch('finance/reverse-charge/')
}

export async function createReverseChargeAssessment(data: any) {
  const result = await erpFetch('finance/reverse-charge/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/reverse-charge')
  return result
}

export async function assessReverseCharge(id: string | number) {
  const result = await erpFetch(`finance/reverse-charge/${id}/assess/`, {
    method: 'POST',
  })
  revalidatePath('/finance/reverse-charge')
  return result
}

export async function getReverseChargeDashboard() {
  return erpFetch('finance/reverse-charge/dashboard/')
}

// ════════════════════════════════════════════════════════════════════
// 7. VAT Rate Change History
// ════════════════════════════════════════════════════════════════════

export async function getVATRateChangeHistory() {
  return erpFetch('finance/vat-rate-history/')
}

export async function createVATRateChange(data: any) {
  const result = await erpFetch('finance/vat-rate-history/', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  revalidatePath('/finance/vat-rate-history')
  return result
}

export async function applyVATRateChange(id: string | number) {
  const result = await erpFetch(`finance/vat-rate-history/${id}/apply/`, {
    method: 'POST',
  })
  revalidatePath('/finance/vat-rate-history')
  return result
}

export async function getVATRateChangeDashboard() {
  return erpFetch('finance/vat-rate-history/dashboard/')
}

// ════════════════════════════════════════════════════════════════════
// DEPRECATED: Re-exports for backward compatibility
// Import from the proper module action files instead:
//   - inventory/business-events.ts (Gift/Sample, Internal Consumption)
//   - procurement/import-declarations.ts (Import Declarations)
// ════════════════════════════════════════════════════════════════════
export {
  getGiftSampleEvents as getGiftSampleVATRecords,
  createGiftSampleEvent as createGiftSampleVAT,
  assessGiftSampleEvent as assessGiftSampleVAT,
  getGiftSampleDashboard,
} from '@/app/actions/inventory/business-events'

export {
  getInternalConsumptionEvents as getSelfSupplyVATEvents,
  createInternalConsumptionEvent as createSelfSupplyVATEvent,
  assessInternalConsumption as assessSelfSupplyVAT,
  getInternalConsumptionDashboard as getSelfSupplyDashboard,
} from '@/app/actions/inventory/business-events'

export {
  getImportDeclarations,
  getImportDeclaration,
  createImportDeclaration,
  updateImportDeclaration,
  calculateImportDeclaration,
  getImportDashboard,
} from '@/app/actions/procurement/import-declarations'
