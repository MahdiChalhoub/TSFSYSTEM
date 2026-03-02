'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getBankAccounts() {
 return await erpFetch('finance/journal/bank-reconciliation/')
}

export async function getBankReconciliation(accountId: string, startDate?: string, endDate?: string) {
 const params = new URLSearchParams({ account_id: accountId })
 if (startDate) params.set('start_date', startDate)
 if (endDate) params.set('end_date', endDate)
 return await erpFetch(`finance/journal/bank-reconciliation/?${params.toString()}`)
}

export async function getContactStatement(contactId: string) {
 return await erpFetch(`crm/contacts/${contactId}/summary/`)
}

export async function matchEntries(bankEntryId: string, ledgerEntryIds: string[]) {
 return await erpFetch('finance/journal/bank-reconciliation/match/', {
 method: 'POST',
 body: JSON.stringify({ bank_entry_id: bankEntryId, ledger_entry_ids: ledgerEntryIds })
 })
}

export async function unmatchEntries(matchId: string) {
 return await erpFetch(`finance/journal/bank-reconciliation/match/${matchId}/`, {
 method: 'DELETE'
 })
}

export async function createAdjustment(data: { account_id: string, amount: number, type: 'DEBIT' | 'CREDIT', description: string }) {
 return await erpFetch('finance/journal/bank-reconciliation/adjustment/', {
 method: 'POST',
 body: JSON.stringify(data)
 })
}

export async function triggerAutoMatch(accountId: string) {
 return await erpFetch(`finance/journal/bank-reconciliation/auto-match/`, {
 method: 'POST',
 body: JSON.stringify({ account_id: accountId })
 })
}
