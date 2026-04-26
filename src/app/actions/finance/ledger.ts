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
    costCenter: z.string().nullable().optional(),
    taxLineId: z.number().int().positive().nullable().optional(),
    tax_line_id: z.number().int().positive().nullable().optional(),
    partnerId: z.number().int().positive().nullable().optional(),
    partnerType: z.enum(['CUSTOMER', 'SUPPLIER', 'EMPLOYEE', 'PARTNER']).nullable().optional(),
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
    costCenter?: string | null
    taxLineId?: number | null
    partnerId?: number | null
    partnerType?: 'CUSTOMER' | 'SUPPLIER' | 'EMPLOYEE' | 'PARTNER' | null
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
        parsed.lines = parsed.lines.map((l: any) => ({
            account_id: l.accountId || l.account_id,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
            contact_id: l.contactId || l.contact_id || null,
            employee_id: l.employeeId || l.employee_id || null,
            cost_center: l.costCenter || l.cost_center || null,
            tax_line_id: l.taxLineId || l.tax_line_id || null,
            partner_id: l.partnerId || l.partner_id || null,
            partner_type: l.partnerType || l.partner_type || null,
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
        parsed.lines = parsed.lines.map((l: any) => ({
            account_id: l.accountId || l.account_id,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
            contact_id: l.contactId || l.contact_id || null,
            employee_id: l.employeeId || l.employee_id || null,
            cost_center: l.costCenter || l.cost_center || null,
            tax_line_id: l.taxLineId || l.tax_line_id || null,
            partner_id: l.partnerId || l.partner_id || null,
            partner_type: l.partnerType || l.partner_type || null,
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
    }
) {
    try {
        let path = 'journal/'
        const params = new URLSearchParams()
        if (scope === 'OFFICIAL') params.append('scope', 'OFFICIAL')
        if (filters?.status) params.append('status', filters.status)
        if (filters?.q) params.append('search', filters.q)
        if (filters?.fiscal_year) params.append('fiscal_year', filters.fiscal_year)
        if (filters?.date_from) params.append('date_from', filters.date_from)
        if (filters?.date_to) params.append('date_to', filters.date_to)
        if (filters?.entry_type) params.append('entry_type', filters.entry_type)

        const queryString = params.toString()
        if (queryString) path += `?${queryString}`

        return await erpFetch(path)
    } catch (error) {
        console.error("Failed to fetch ledger entries:", error)
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

export async function deleteJournalEntry(id: number) {
    try {
        await erpFetch(`journal/${id}/`, {
            method: 'DELETE',
        })
        revalidatePath('/finance/ledger')
        revalidatePath('/finance/chart-of-accounts')
        return { success: true }
    } catch (error: unknown) {
        console.error("Failed to delete journal entry:", error)
        throw error
    }
}

export async function bulkDeleteJournalEntries(ids: number[]) {
    const results: { id: number; success: boolean; error?: string }[] = []
    for (const id of ids) {
        try {
            await erpFetch(`journal/${id}/`, { method: 'DELETE' })
            results.push({ id, success: true })
        } catch (error: unknown) {
            results.push({ id, success: false, error: error instanceof Error ? error.message : String(error) })
        }
    }
    revalidatePath('/finance/ledger')
    revalidatePath('/finance/chart-of-accounts')
    return results
}

export async function recalculateAccountBalances() {
    try {
        // Soft sync: rebuilds ChartOfAccount.balance / .balance_official from
        // POSTED JE-line aggregation via a single SQL UPDATE. Doesn't replay
        // entries, doesn't touch hash chains, doesn't trigger the closed-period
        // guard — so it works on orgs with finalized fiscal years (where the
        // hard `recalculate_balances` would atomically roll back).
        const result: any = await erpFetch('journal/recalculate_balances_soft/', {
            method: 'POST',
        })
        revalidatePath('/finance/chart-of-accounts')
        return {
            success: true,
            drifted_before: result?.drifted_before ?? 0,
            total_accounts: result?.total_accounts ?? 0,
            message: result?.message,
        }
    } catch (error) {
        console.error("Failed to recalculate balances:", error)
        return { success: false }
    }
}

/**
 * Hard recalculate: replays every POSTED JE through post_journal_entry.
 * Rebuilds balances AND the hash chain, but FAILS atomically on any JE in
 * a closed/finalized period. Reserved for fresh orgs / pre-close situations.
 */
export async function recalculateAccountBalancesHard() {
    try {
        await erpFetch('journal/recalculate_balances/', { method: 'POST' })
        revalidatePath('/finance/chart-of-accounts')
        return { success: true }
    } catch (error) {
        console.error("Failed to recalculate balances (hard):", error)
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
        return result
    } catch (error) {
        console.error("Failed to fetch opening entries:", error)
        return []
    }
}

export async function getJournalEntry(id: number) {
    try {
        const result = await erpFetch(`journal/${id}/`)
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

export type ImportRow = {
    date: string
    description: string
    debit_account_code: string
    credit_account_code: string
    amount: number | string
    reference?: string
}

export type ImportPreviewRow = {
    row: number
    date: string
    description: string
    debit_code: string
    debit_account: { id: number; name: string; type: string } | null
    credit_code: string
    credit_account: { id: number; name: string; type: string } | null
    amount: number
    reference: string
    errors: string[]
    valid: boolean
}

export type ImportPreviewResult = {
    total: number
    valid: number
    invalid: number
    rows: ImportPreviewRow[]
}

export type ImportResult = {
    created: number
    errors: { row: number; message: string }[]
    total: number
}

// ── Opening Balance Import ────────────────────────────────────────────────────

export type OpeningBalancePreviewRow = {
    row: number
    account_code: string
    account: { id: number; name: string; type: string; code: string } | null
    balance: number
    side: 'Dr' | 'Cr' | null
    debit: number
    credit: number
    errors: string[]
    valid: boolean
}

export type OpeningBalancePreviewResult = {
    total: number
    valid: number
    invalid: number
    total_debit: number
    total_credit: number
    difference: number
    rows: OpeningBalancePreviewRow[]
}

export type OpeningBalanceImportResult = {
    created_entry_id: number
    lines_ok: number
    auto_balance_amount: string
    errors: { row: number; message: string }[]
    skipped: number
}

export async function previewOpeningBalances(
    formData: FormData
): Promise<OpeningBalancePreviewResult> {
    try {
        const result = await erpFetch('journal/preview-opening-balances/', {
            method: 'POST',
            body: formData,
        })
        return result as OpeningBalancePreviewResult
    } catch (error) {
        console.error('Failed to preview opening balances:', error)
        throw error
    }
}

export async function importOpeningBalances(
    formData: FormData
): Promise<OpeningBalanceImportResult> {
    try {
        const result = await erpFetch('journal/import-opening-balances/', {
            method: 'POST',
            body: formData,
        })
        revalidatePath('/finance/ledger')
        revalidatePath('/finance/chart-of-accounts')
        return result as OpeningBalanceImportResult
    } catch (error) {
        console.error('Failed to import opening balances:', error)
        throw error
    }
}

export async function previewImport(formData: FormData): Promise<ImportPreviewResult> {
    try {
        const result = await erpFetch('journal/preview-import/', {
            method: 'POST',
            body: formData,
        })
        return result as ImportPreviewResult
    } catch (error) {
        console.error('Failed to preview import:', error)
        throw error
    }
}

export async function importJournalEntries(
    formData: FormData
): Promise<ImportResult> {
    try {
        const result = await erpFetch('journal/import/', {
            method: 'POST',
            body: formData,
        })
        revalidatePath('/finance/ledger')
        return result as ImportResult
    } catch (error) {
        console.error('Failed to import journal entries:', error)
        throw error
    }
}