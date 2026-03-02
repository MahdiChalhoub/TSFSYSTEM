'use server'

import { erpFetch } from "@/lib/erp-api"

// ─── Aged Reports ────────────────────────────────────────────────

export async function getAgedReceivables() {
 return await erpFetch('finance/payments/aged_receivables/')
}

export async function getAgedPayables() {
 return await erpFetch('finance/payments/aged_payables/')
}

// ─── Financial Statements ────────────────────────────────────────

export async function getTrialBalance(asOf?: string, scope?: string) {
 const params = new URLSearchParams()
 if (asOf) params.set('as_of', asOf)
 if (scope) params.set('scope', scope)
 const query = params.toString() ? `?${params.toString()}` : ''
 return await erpFetch(`finance/coa/trial_balance/${query}`)
}

export async function getAccountStatement(accountId: number) {
 return await erpFetch(`finance/coa/${accountId}/statement/`)
}

// ─── Helper: Financial Accounts ──────────────────────────────────

export async function getCustomerBalances() {
 return await erpFetch('finance/customer-balances/')
}

export async function getSupplierBalances() {
 return await erpFetch('finance/supplier-balances/')
}

// ─── Report Builder ───────────────────────────────────────────────

export async function getReportDefinitions() {
 try { return await erpFetch('finance/reports/') } catch { return [] }
}

export async function createReportDefinition(data: Record<string, any>) {
 const { revalidatePath } = await import('next/cache')
 const result = await erpFetch('finance/reports/', { method: 'POST', body: JSON.stringify(data) })
 revalidatePath('/finance/reports/builder')
 return result
}

export async function deleteReportDefinition(id: number) {
 const { revalidatePath } = await import('next/cache')
 await erpFetch(`finance/reports/${id}/`, { method: 'DELETE' })
 revalidatePath('/finance/reports/builder')
}

export async function runReport(id: number, exportFormat?: string) {
 return await erpFetch(`finance/reports/${id}/run/`, {
 method: 'POST',
 body: JSON.stringify({ export_format: exportFormat })
 })
}

export async function getReportExecutions(id: number) {
 try { return await erpFetch(`finance/reports/${id}/executions/`) } catch { return [] }
}

export async function getReportDataSources() {
 try { return await erpFetch('finance/reports/data-sources/') } catch { return [] }
}

// ─── Tax Groups ───────────────────────────────────────────────────

export async function getTaxGroups() {
 try { return await erpFetch('finance/tax-groups/') } catch { return [] }
}

export async function createTaxGroup(data: Record<string, any>) {
 const { revalidatePath } = await import('next/cache')
 const result = await erpFetch('finance/tax-groups/', { method: 'POST', body: JSON.stringify(data) })
 revalidatePath('/finance/settings')
 return result
}

export async function setDefaultTaxGroup(taxGroupId: number) {
 return await erpFetch('finance/tax-groups/set_default/', { method: 'POST', body: JSON.stringify({ tax_group_id: taxGroupId }) })
}
