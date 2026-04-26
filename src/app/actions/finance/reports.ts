'use server'

import { erpFetch } from "@/lib/erp-api"

async function _readScopeFromCookie(): Promise<'OFFICIAL' | 'INTERNAL'> {
    const { cookies } = await import('next/headers')
    const v = (await cookies()).get('tsf_view_scope')?.value
    return v === 'INTERNAL' ? 'INTERNAL' : 'OFFICIAL'
}

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
    const scope = await _readScopeFromCookie()
    return await erpFetch(`finance/coa/${accountId}/statement/?scope=${scope}`)
}

// ─── Helper: Financial Accounts ──────────────────────────────────

export async function getCustomerBalances() {
    return await erpFetch('finance/customer-balances/')
}

export async function getSupplierBalances() {
    return await erpFetch('finance/supplier-balances/')
}

export async function getReportDefinitions() {
    return await erpFetch('finance/reports/definitions/');
}
export async function createReportDefinition(data: unknown) {
    return await erpFetch('finance/reports/definitions/', { method: 'POST', body: JSON.stringify(data) });
}
export async function deleteReportDefinition(id: number) {
    return await erpFetch(`finance/reports/definitions/${id}/`, { method: 'DELETE' });
}
export async function runReport(id: number, params?: unknown) {
    return await erpFetch(`finance/reports/definitions/${id}/run/`, { method: 'POST', body: JSON.stringify(params || {}) });
}
export async function getReportExecutions(id: number) {
    return await erpFetch(`finance/reports/definitions/${id}/executions/`);
}
export async function getReportDataSources() {
    return await erpFetch('finance/reports/data-sources/');
}
export async function getFinancialReportsDashboard(period?: string) {
    return await erpFetch(`finance/reports/dashboard/?period=${period || 'CURRENT_MONTH'}`);
}
export async function getCashFlowStatement(startDate: string, endDate: string, method: string) {
    return await erpFetch(`finance/reports/cash-flow/?start_date=${startDate}&end_date=${endDate}&method=${method}`);
}
