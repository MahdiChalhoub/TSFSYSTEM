'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { generateTransactionNumber } from '@/lib/sequences'

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

export async function createJournalEntry(data: {
    transactionDate: Date
    description: string
    reference?: string
    fiscalYearId?: number
    fiscalPeriodId?: number
    lines: JournalLineInput[]
    status?: 'DRAFT' | 'POSTED'
    siteId?: number | null
}, tx?: Prisma.TransactionClient) {
    const status = data.status || 'DRAFT'

    // Auto-generate reference if missing
    let reference = data.reference
    if (!reference) {
        try {
            reference = await generateTransactionNumber('JOURNAL')
        } catch (e) {
            console.error("Failed to generate journal sequence", e)
        }
    }

    const execute = async (ctx: Prisma.TransactionClient) => {
        // 0. Resolve Fiscal Year if not provided
        let fyId = data.fiscalYearId
        if (!fyId) {
            const fy = await ctx.fiscalYear.findFirst({
                where: { startDate: { lte: data.transactionDate }, endDate: { gte: data.transactionDate } }
            })
            fyId = fy?.id
        }

        if (!fyId) throw new Error("No active Fiscal Year found for date: " + data.transactionDate)

        // Resolve Period
        let periodId = data.fiscalPeriodId
        if (!periodId) {
            const period = await ctx.fiscalPeriod.findFirst({
                where: { fiscalYearId: fyId, startDate: { lte: data.transactionDate }, endDate: { gte: data.transactionDate } }
            })
            periodId = period?.id
        }

        // 1. Double-Entry Validation (The Absolute Law)
        const totalDebit = data.lines.reduce((sum, l) => sum + Number(l.debit), 0)
        const totalCredit = data.lines.reduce((sum, l) => sum + Number(l.credit), 0)

        if (Math.abs(totalDebit - totalCredit) > 0.001) {
            throw new Error(`Out of Balance: Total Debit (${totalDebit}) must equal Total Credit (${totalCredit})`)
        }

        // 2. Create the Entry
        const entry = await ctx.journalEntry.create({
            data: {
                transactionDate: data.transactionDate,
                description: data.description,
                reference: reference, // Use generated reference
                fiscalYearId: fyId,
                fiscalPeriodId: periodId,
                status: status,
                siteId: data.siteId,
                postedAt: status === 'POSTED' ? new Date() : null,
                lines: {
                    create: data.lines.map(l => ({
                        accountId: l.accountId,
                        contactId: l.contactId,
                        employeeId: l.employeeId,
                        debit: l.debit,
                        credit: l.credit,
                        description: l.description || data.description
                    }))
                }
            } as any,
            include: { lines: true }
        }) as any

        // 3. If POSTED, Update Account Balances
        if (status === 'POSTED') {
            for (const line of entry.lines) {
                const netChange = Number(line.debit) - Number(line.credit)
                await ctx.chartOfAccount.update({
                    where: { id: line.accountId },
                    data: { balance: { increment: netChange } }
                })
            }
        }

        return entry
    }

    // Wrap in transaction if not already provided
    if (tx) {
        return await execute(tx)
    } else {
        const result = await prisma.$transaction(async (newTx) => {
            return await execute(newTx)
        })

        revalidatePath('/admin/finance/ledger')
        revalidatePath('/admin/finance/chart-of-accounts')
        return result
    }
}

export async function getLedgerEntries(filters?: { status?: string, q?: string }) {
    const where: any = {}
    if (filters?.status) where.status = filters.status
    if (filters?.q) {
        where.OR = [
            { reference: { contains: filters.q } },
            { description: { contains: filters.q } },
        ]
    }

    return await prisma.journalEntry.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        include: {
            lines: { include: { account: true } },
            site: true,
            fiscalYear: true,
            reversalOf: true,
            reversedBy: true
        } as any
    }) as any
}

export const getJournalEntries = getLedgerEntries;

export async function postJournalEntry(id: number) {
    return await prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.findUnique({
            where: { id },
            include: { lines: true }
        }) as any

        if (!entry) throw new Error("Entry not found")
        if (entry.status === 'POSTED') throw new Error("Entry already posted")

        // 1. Update status
        await tx.journalEntry.update({
            where: { id },
            data: { status: 'POSTED', postedAt: new Date() }
        })

        // 2. Update balances
        for (const line of entry.lines) {
            const netChange = Number(line.debit) - Number(line.credit)
            await tx.chartOfAccount.update({
                where: { id: line.accountId },
                data: { balance: { increment: netChange } }
            })
        }

        return { success: true }
    })
}

export async function reverseJournalEntry(id: number) {
    return await prisma.$transaction(async (tx) => {
        const entry = await tx.journalEntry.findUnique({
            where: { id },
            include: { lines: true }
        }) as any

        if (!entry) throw new Error("Entry not found")
        if (entry.status !== 'POSTED') throw new Error("Only posted entries can be reversed")

        // 1. Reversal Entry (Standard Accounting Practice)
        // Instead of deleting, we create a negative or reversed entry
        const reversalLines: JournalLineInput[] = entry.lines.map((l: any) => ({
            accountId: l.accountId,
            debit: Number(l.credit),
            credit: Number(l.debit),
            description: `Reversal of Entry #${entry.id}`
        }))

        await createJournalEntry({
            transactionDate: new Date(),
            description: `Reversal of Entry #${entry.id} (${entry.reference})`,
            reference: `REV-${entry.id}`,
            status: 'POSTED',
            lines: reversalLines
        }, tx)

        // 2. Mark original as voided (or Reversed)
        await tx.journalEntry.update({
            where: { id },
            data: {
                status: 'REVERSED',
                reversedBy: { connect: { id: entry.id } } // This might need a new link logic but for now REVERSED status is key
            } as any
        })

        return { success: true }
    })
}

export const voidJournalEntry = reverseJournalEntry;

/**
 * MAINTENANCE: Rebuilds account balances from the ground up based on ledger history.
 * Useful if balances ever get out of sync due to manual DB edits or bugs.
 */
export async function recalculateAccountBalances() {
    return await prisma.$transaction(async (tx) => {
        // 1. Reset all balances to zero
        await tx.chartOfAccount.updateMany({
            data: { balance: 0 }
        })

        // 2. Fetch all POSTED journal entry lines
        const lines = await tx.journalEntryLine.findMany({
            where: {
                journalEntry: { status: 'POSTED' }
            }
        })

        // 3. Apply each line to the balance
        for (const line of lines) {
            const netChange = Number(line.debit) - Number(line.credit)
            await tx.chartOfAccount.update({
                where: { id: line.accountId },
                data: { balance: { increment: netChange } }
            })
        }

        revalidatePath('/admin/finance/chart-of-accounts')
        return { success: true, count: lines.length }
    }, { maxWait: 10000, timeout: 60000 })
}

/**
 * DANGER ZONE: Clears all accounting history for a fresh start.
 */
export async function clearAllJournalEntries() {
    return await prisma.$transaction(async (tx) => {
        // 1. Delete all lines and entries
        await tx.journalEntryLine.deleteMany({})
        await tx.journalEntry.deleteMany({})

        // 2. Delete money movements (Transactions)
        await tx.transaction.deleteMany({})

        // 3. Reset balances to zero
        await tx.chartOfAccount.updateMany({
            data: { balance: 0 }
        })

        revalidatePath('/admin/finance/ledger')
        revalidatePath('/admin/finance/chart-of-accounts')
        return { success: true }
    })
}

