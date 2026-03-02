'use server'

import { erpFetch } from '@/lib/erp-api'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const JournalLineSchema = z.object({
 accountId: z.number({ message: 'Account is required' }).int().positive().optional(),
 account_id: z.number().int().positive().optional(),
 debit: z.number().min(0, 'Debit must be non-negative'),
 credit: z.number().min(0, 'Credit must be non-negative'),
 description: z.string().optional(),
 contactId: z.number().int().positive().nullable().optional(),
 contact_id: z.number().int().positive().nullable().optional(),
 employeeId: z.number().int().positive().nullable().optional(),
 employee_id: z.number().int().positive().nullable().optional(),
}).refine(d => (d.accountId || d.account_id), { message: 'Each line must have an account' })

const JournalEntrySchema = z.object({
 description: z.string().optional(),
 date: z.string().optional(),
 reference: z.string().optional(),
 entry_type: z.string().optional(),
 scope: z.enum(['OFFICIAL', 'INTERNAL']).optional(),
 lines: z.array(JournalLineSchema).min(1, 'At least one journal line is required'),
}).passthrough()

export type JournalLineInput = {
 accountId: number
 debit: number
 credit: number
 description?: string
 contactId?: number | null
 employeeId?: number | null
}

/**
 * Strict Security Rule: The sum of all accounts in a double-entry system MUST always be zero.
 * This checks the "Trial Balance" integrity.
 */
export async function verifyTrialBalance() {
 try {
 const accounts = await erpFetch('coa/trial_balance/')
 const total = accounts.reduce((acc: number, cur: Record<string, any>) => acc + (cur.temp_balance || 0), 0)

 if (Math.abs(total) > 0.01) {
 console.error(`CRITICAL: System Out of Balance! Trial Balance Total: ${total}`)
 return { isBalanced: false, difference: total }
 }
 return { isBalanced: true, difference: total }
 } catch (e) {
 console.error("Trial balance check failed:", e)
 return { isBalanced: false, difference: 0 }
 }
}

export async function createJournalEntry(data: unknown) {
 const parsed = JournalEntrySchema.parse(data)
 // Map camelCase lines to snake_case for Django if needed, 
 // although ViewSet now handles some of it, let's be explicit.
 if (parsed.lines) {
 parsed.lines = parsed.lines.map((l) => ({
 account_id: l.accountId || l.account_id,
 debit: l.debit,
 credit: l.credit,
 description: l.description,
 contact_id: l.contactId || l.contact_id || null,
 employee_id: l.employeeId || l.employee_id || null,
 }))
 }

 try {
 const result = await erpFetch('journal/', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(parsed)
 })
 revalidatePath('/finance/ledger')
 return result
 } catch (error: unknown) {
 console.error("Failed to create journal entry:", error)
 throw error
 }
}

export async function updateJournalEntry(id: number, data: unknown) {
 const parsed = JournalEntrySchema.parse(data)
 if (parsed.lines) {
 parsed.lines = parsed.lines.map((l) => ({
 account_id: l.accountId || l.account_id,
 debit: l.debit,
 credit: l.credit,
 description: l.description,
 contact_id: l.contactId || l.contact_id || null,
 employee_id: l.employeeId || l.employee_id || null,
 }))
 }

 try {
 const result = await erpFetch(`journal/${id}/`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(parsed)
 })
 revalidatePath('/finance/ledger')
 return result
 } catch (error: unknown) {
 console.error("Failed to update journal entry:", error)
 throw error
 }
}

export async function getLedgerEntries(
 scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL',
 filters?: {
 status?: string
 q?: string
 fiscal_year?: string
 date_from?: string
 date_to?: string
 entry_type?: string
 verified?: string
 locked?: string
 user?: string
 auto_source?: string
 }
) {
 try {
 let path = 'journal/'
 const params = new URLSearchParams()
 params.append('scope', scope)
 if (filters?.status) params.append('status', filters.status)
 if (filters?.q) params.append('search', filters.q)
 if (filters?.fiscal_year) params.append('fiscal_year', filters.fiscal_year)
 if (filters?.date_from) params.append('date_from', filters.date_from)
 if (filters?.date_to) params.append('date_to', filters.date_to)
 if (filters?.entry_type) params.append('entry_type', filters.entry_type)
 if (filters?.verified) params.append('verified', filters.verified)
 if (filters?.locked) params.append('locked', filters.locked)
 if (filters?.user) params.append('user', filters.user)
 if (filters?.auto_source) params.append('auto_source', filters.auto_source)

 const queryString = params.toString()
 if (queryString) path += `?${queryString}`

 return await erpFetch(path)
 } catch (error) {
 console.error("Failed to fetch ledger entries:", error)
 return []
 }
}

export async function getLedgerUsers() {
 try {
 return await erpFetch('users/')
 } catch (error) {
 return []
 }
}

export async function reverseJournalEntry(id: number) {
 try {
 const result = await erpFetch(`journal/${id}/reverse/`, {
 method: 'POST'
 })
 revalidatePath('/finance/ledger')
 return result
 } catch (error: unknown) {
 console.error("Failed to reverse journal entry:", error)
 throw error
 }
}

export const voidJournalEntry = reverseJournalEntry;

export async function recalculateAccountBalances() {
 try {
 await erpFetch('journal/recalculate_balances/', {
 method: 'POST'
 })
 revalidatePath('/finance/chart-of-accounts')
 return { success: true }
 } catch (error) {
 console.error("Failed to recalculate balances:", error)
 return { success: false }
 }
}

export async function clearAllJournalEntries(confirm: 'YES_DELETE_ALL' | null = null) {
 if (confirm !== 'YES_DELETE_ALL') {
 return { success: false, message: 'Confirmation required: pass "YES_DELETE_ALL" to proceed.' }
 }
 try {
 await erpFetch('journal/clear_all/', {
 method: 'POST'
 })
 revalidatePath('/finance/ledger')
 revalidatePath('/finance/chart-of-accounts')
 return { success: true }
 } catch (error) {
 console.error("Failed to clear entries:", error)
 return { success: false }
 }
}

export async function getOpeningEntries() {
 try {
 const result = await erpFetch('journal/opening_entries/')
 return result.map((e: any) => ({
 ...e,
 transactionDate: e.transaction_date || e.transactionDate
 }))
 } catch (error) {
 console.error("Failed to fetch opening entries:", error)
 return []
 }
}

export async function getJournalEntry(id: number) {
 try {
 const result = await erpFetch(`journal/${id}/`)
 if (result && typeof result === 'object') {
 const rawDate = result.transaction_date || result.transactionDate
 result.transactionDate = rawDate ? new Date(rawDate) : null
 }
 return result
 } catch (error) {
 console.error("Failed to fetch journal entry:", error)
 return null
 }
}

export async function createOpeningBalanceEntry(data: unknown) {
 const parsed = JournalEntrySchema.parse(data)
 return createJournalEntry({
 ...parsed,
 entry_type: 'OPENING_BALANCE'
 })
}

/**
 * Calculates the total turnover (Sales) declared to the OFFICIAL scope for the current day.
 * Used by the Integrity Guard to enforce daily declaration caps.
 */
export async function getDeclaredTurnoverToday() {
 try {
 const today = new Date().toISOString().split('T')[0]
 const entries = await getLedgerEntries('OFFICIAL', {
 date_from: today,
 date_to: today,
 entry_type: 'SALE'
 })

 let total = 0
 if (Array.isArray(entries)) {
 entries.forEach((e: any) => {
 e.lines?.forEach((l: any) => {
 // Credits in a sale entry usually represent revenue/turnover
 if (Number(l.credit) > 0) total += Number(l.credit)
 })
 })
 }
 return total
 } catch (e) {
 console.error("Failed to calculate today's declared turnover:", e)
 return 0
 }
}