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

// ─── Phase 2 Financial Reports ────────────────────────────────────

export async function getProfitLoss(startDate: string, endDate: string, comparative?: boolean, previousStart?: string, previousEnd?: string) {
 const params = new URLSearchParams({
   start_date: startDate,
   end_date: endDate
 })
 if (comparative) params.set('comparative', 'true')
 if (previousStart) params.set('previous_start', previousStart)
 if (previousEnd) params.set('previous_end', previousEnd)

 return await erpFetch(`finance/reports/profit-loss/?${params.toString()}`)
}

export async function getBalanceSheet(asOfDate: string, comparative?: boolean, previousDate?: string) {
 const params = new URLSearchParams({ as_of_date: asOfDate })
 if (comparative) params.set('comparative', 'true')
 if (previousDate) params.set('previous_date', previousDate)

 return await erpFetch(`finance/reports/balance-sheet/?${params.toString()}`)
}

export async function getCashFlowStatement(startDate: string, endDate: string, method: 'INDIRECT' | 'DIRECT' = 'INDIRECT') {
 const params = new URLSearchParams({
   start_date: startDate,
   end_date: endDate,
   method
 })

 return await erpFetch(`finance/reports/cash-flow/?${params.toString()}`)
}

export async function getFinancialReportsDashboard(period: 'CURRENT_MONTH' | 'CURRENT_QUARTER' | 'CURRENT_YEAR' | 'YTD' = 'CURRENT_MONTH') {
 return await erpFetch(`finance/reports/dashboard/?period=${period}`)
}

export async function getAccountDrilldown(accountId: number, startDate: string, endDate: string) {
 const params = new URLSearchParams({
   start_date: startDate,
   end_date: endDate
 })

 return await erpFetch(`finance/reports/account-drilldown/${accountId}/?${params.toString()}`)
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
