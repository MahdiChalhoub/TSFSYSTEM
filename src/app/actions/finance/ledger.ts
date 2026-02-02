'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@/generated/client'
import { generateTransactionNumber } from '@/lib/sequences'
import { logAuditAction } from '@/lib/audit'

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
    const aggregate = await prisma.chartOfAccount.aggregate({
        _sum: { balance: true }
    })
    const total = Number(aggregate._sum.balance || 0)

    if (Math.abs(total) > 0.01) {
        console.error(`CRITICAL: System Out of Balance! Trial Balance Total: ${total}`)
        return { isBalanced: false, difference: total }
    }
    return { isBalanced: true, difference: total }
}

import { erpFetch } from '@/lib/erp-api'

export async function createJournalEntry(data: any) {
    try {
        const result = await erpFetch('journal/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        })
        revalidatePath('/admin/finance/ledger')
        return result
    } catch (error: any) {
        console.error("Failed to create journal entry:", error)
        throw error
    }
}

export async function getLedgerEntries(scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL', filters?: { status?: string, q?: string }) {
    try {
        let path = 'journal/'
        const params = new URLSearchParams()
        if (scope === 'OFFICIAL') params.append('scope', 'OFFICIAL')
        if (filters?.status) params.append('status', filters.status)
        if (filters?.q) params.append('search', filters.q)

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
        revalidatePath('/admin/finance/ledger')
        return result
    } catch (error: any) {
        console.error("Failed to reverse journal entry:", error)
        throw error
    }
}

export const voidJournalEntry = reverseJournalEntry;

export async function recalculateAccountBalances() {
    return await prisma.$transaction(async (tx) => {
        // 1. Reset all balances to zero
        await tx.chartOfAccount.updateMany({
            data: { balance: 0, balanceOfficial: 0 }
        })

        // 2. Fetch all POSTED journal entry lines
        const lines = await tx.journalEntryLine.findMany({
            where: {
                journalEntry: { status: 'POSTED' }
            },
            include: { journalEntry: true }
        })

        // 3. Apply each line to the balance
        for (const line of lines) {
            const netChange = Number(line.debit) - Number(line.credit)

            const updateData: any = {
                balance: { increment: netChange }
            }

            if (line.journalEntry.scope === 'OFFICIAL') {
                updateData.balanceOfficial = { increment: netChange }
            }

            await tx.chartOfAccount.update({
                where: { id: line.accountId },
                data: updateData
            })
        }

        revalidatePath('/admin/finance/chart-of-accounts')
        return { success: true, count: lines.length }
    }, { maxWait: 10000, timeout: 60000 })
}

export async function clearAllJournalEntries() {
    return await prisma.$transaction(async (tx) => {
        await tx.journalEntryLine.deleteMany({})
        await tx.journalEntry.deleteMany({})
        await tx.transaction.deleteMany({})
        await tx.chartOfAccount.updateMany({
            data: { balance: 0, balanceOfficial: 0 }
        })

        revalidatePath('/admin/finance/ledger')
        revalidatePath('/admin/finance/chart-of-accounts')
        return { success: true }
    })
}
