'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function getFiscalYears() {
    // @ts-ignore
    return await prisma.fiscalYear.findMany({
        orderBy: { startDate: 'desc' },
        include: { periods: true }
    })
}

export async function getLatestFiscalYear() {
    // @ts-ignore
    return await prisma.fiscalYear.findFirst({
        orderBy: { endDate: 'desc' }
    })
}

export type FiscalYearConfig = {
    name: string
    startDate: Date
    endDate: Date
    frequency: 'MONTHLY' | 'QUARTERLY'
    defaultPeriodStatus: 'OPEN' | 'FUTURE' | 'LOCKED'
    includeAuditPeriod?: boolean
}

export async function createFiscalYear(config: FiscalYearConfig) {
    // Validate Dates
    if (config.endDate <= config.startDate) {
        throw new Error('End date must be after start date')
    }

    // @ts-ignore
    const existing = await prisma.fiscalYear.findFirst({
        where: { name: config.name }
    })

    if (existing) {
        throw new Error('Fiscal Year with this name already exists')
    }

    // Create Year
    // @ts-ignore
    const fy = await prisma.fiscalYear.create({
        data: {
            name: config.name,
            startDate: config.startDate,
            endDate: config.endDate,
            status: 'OPEN'
        }
    })

    // Generate Periods based on Frequency
    const periods = []
    let currentStart = new Date(config.startDate)
    let periodCount = 1

    while (currentStart < config.endDate) {
        // Determine Period End Date
        let periodEnd = new Date(currentStart)

        if (config.frequency === 'MONTHLY') {
            periodEnd.setMonth(periodEnd.getMonth() + 1)
        } else if (config.frequency === 'QUARTERLY') {
            periodEnd.setMonth(periodEnd.getMonth() + 3)
        }

        // Set to day 0 of the *next* month/increment relative to current loop
        periodEnd = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 0) // End of previous month relative to jump

        // Handling edge case where calculated end > year end
        if (periodEnd > config.endDate) periodEnd = new Date(config.endDate)

        // Name generation
        let periodName = ""
        if (config.frequency === 'MONTHLY') {
            periodName = currentStart.toLocaleString('default', { month: 'long', year: 'numeric' })
        } else {
            periodName = `Q${periodCount} ${currentStart.getFullYear()}`
        }

        periods.push({
            fiscalYearId: fy.id,
            number: periodCount,
            name: periodName,
            startDate: new Date(currentStart),
            endDate: new Date(periodEnd),
            status: config.defaultPeriodStatus // User defined status (e.g. FUTURE)
        })

        // Prepare for next loop
        // Next start is day after current end
        currentStart = new Date(periodEnd)
        currentStart.setDate(currentStart.getDate() + 1)
        periodCount++
    }

    // Optional 13th Period / Audit Adjustment Period
    if (config.includeAuditPeriod) {
        periods.push({
            fiscalYearId: fy.id,
            number: periodCount,
            type: 'ADJUSTMENT',
            name: 'Audit Adjustments',
            startDate: new Date(config.endDate), // Same day as year end but distinct period
            endDate: new Date(config.endDate),
            status: 'LOCKED'
        })
    }

    // @ts-ignore
    await prisma.fiscalPeriod.createMany({
        data: periods
    })

    revalidatePath('/admin/finance/fiscal-years')
    return { success: true }
}

export async function closeFiscalYear(id: number) {
    // @ts-ignore
    const fy = await prisma.fiscalYear.findUnique({ where: { id } })
    if (!fy) throw new Error("Fiscal Year not found")
    if (fy.status === 'CLOSED') throw new Error("Fiscal Year is already closed")

    // 1. Calculate P&L Balances (Income & Expense)
    // @ts-ignore
    const accountBalances = await prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
            journalEntry: {
                fiscalYearId: id,
                status: 'POSTED' // Only consider posted entries
            },
            account: {
                type: { in: ['INCOME', 'EXPENSE'] }
            }
        },
        _sum: { debit: true, credit: true }
    })

    if (accountBalances.length > 0) {
        // 2. Prepare Closing Lines
        const closingLines = []
        let netIncomeCredit = 0
        let netIncomeDebit = 0

        for (const acc of accountBalances) {
            // @ts-ignore
            const debit = Number(acc._sum.debit || 0)
            // @ts-ignore
            const credit = Number(acc._sum.credit || 0)
            const net = credit - debit // + means Credit Balance (Revenue), - means Debit Balance (Expense)

            if (Math.abs(net) < 0.01) continue

            if (net > 0) {
                // Remove Credit Balance by Debiting it
                closingLines.push({
                    accountId: acc.accountId,
                    debit: net,
                    credit: 0,
                    description: "Closing Entry - Clear Revenue"
                })
                netIncomeCredit += net // Revenue moves to Equity
            } else {
                // Remove Debit Balance by Crediting it
                const absNet = Math.abs(net)
                closingLines.push({
                    accountId: acc.accountId,
                    debit: 0,
                    credit: absNet,
                    description: "Closing Entry - Clear Expense"
                })
                netIncomeDebit += absNet // Expense reduces Equity
            }
        }

        // 3. Find or Create Retained Earnings Account
        // @ts-ignore
        let reAccount = await prisma.chartOfAccount.findFirst({
            where: {
                name: "Retained Earnings",
                type: 'EQUITY'
            }
        })

        if (!reAccount) {
            // @ts-ignore
            reAccount = await prisma.chartOfAccount.create({
                data: {
                    code: '3999', // Standard placeholder, ensure it doesn't conflict
                    name: 'Retained Earnings',
                    type: 'EQUITY'
                }
            })
        }

        // 4. Plug to Retained Earnings
        const netRE = netIncomeCredit - netIncomeDebit
        if (Math.abs(netRE) > 0.001) {
            if (netRE > 0) {
                // Profit -> Credit RE
                closingLines.push({
                    accountId: reAccount.id,
                    debit: 0,
                    credit: netRE,
                    description: "Closing Entry - Net Income Allocation"
                })
            } else {
                // Loss -> Debit RE
                closingLines.push({
                    accountId: reAccount.id,
                    debit: Math.abs(netRE),
                    credit: 0,
                    description: "Closing Entry - Net Loss Allocation"
                })
            }
        }

        // 5. Create Closing Transaction
        if (closingLines.length > 0) {
            // @ts-ignore
            await prisma.journalEntry.create({
                data: {
                    fiscalYearId: id,
                    transactionDate: fy.endDate, // Last day of FY
                    description: `Year-End Closing Entry ${fy.name}`,
                    status: 'POSTED',
                    scope: 'OFFICIAL',
                    lines: {
                        create: closingLines
                    }
                }
            })
        }
    }

    // 6. Update Statuses
    // @ts-ignore
    await prisma.fiscalYear.update({
        where: { id },
        data: { status: 'CLOSED', isLocked: true }
    })

    // @ts-ignore
    await prisma.fiscalPeriod.updateMany({
        where: { fiscalYearId: id },
        data: { status: 'CLOSED' }
    })

    revalidatePath('/admin/finance/fiscal-years')
    return { success: true }
}

export async function deleteFiscalYear(id: number) {
    // 1. Safety Check: Any transactions?
    // @ts-ignore
    const hasEntries = await prisma.journalEntry.findFirst({
        where: { fiscalYearId: id }
    })

    if (hasEntries) {
        throw new Error('Cannot delete Fiscal Year because it has recorded transactions. You must reverse them or archive the data first.')
    }

    // 2. Delete Periods first (Cascade usually handles this, but being explicit is safer)
    // @ts-ignore
    await prisma.fiscalPeriod.deleteMany({
        where: { fiscalYearId: id }
    })

    // 3. Delete Year
    // @ts-ignore
    await prisma.fiscalYear.delete({
        where: { id }
    })

    revalidatePath('/admin/finance/fiscal-years')
    return { success: true }
}

export async function updatePeriod(periodId: number, data: { name?: string, startDate?: Date, endDate?: Date }) {
    // @ts-ignore
    await prisma.fiscalPeriod.update({
        where: { id: periodId },
        data
    })
    revalidatePath('/admin/finance/fiscal-years')
    return { success: true }
}

export async function updatePeriodStatus(periodId: number, newStatus: 'OPEN' | 'CLOSED' | 'FUTURE') {

    // Strict Check: Check Fiscal Year Status
    // @ts-ignore
    const period = await prisma.fiscalPeriod.findUnique({
        where: { id: periodId },
        include: { fiscalYear: true }
    })

    if (!period) throw new Error("Period not found")

    // @ts-ignore
    if (period.fiscalYear.status === 'CLOSED') {
        throw new Error("Cannot change Period status because the Fiscal Year is designated as CLOSED.")
    }

    // @ts-ignore
    if (period.fiscalYear.isHardLocked) {
        throw new Error("This fiscal year is HARD LOCKED for compliance. No status changes allowed.")
    }

    // Safety Check for FUTURE: Can't move to FUTURE if data exists
    if (newStatus === 'FUTURE') {
        // @ts-ignore
        const hasEntries = await prisma.journalEntry.findFirst({
            where: { fiscalPeriodId: periodId }
        })

        if (hasEntries) {
            throw new Error('Cannot set period to FUTURE because it contains transactions.')
        }
    }

    // @ts-ignore
    await prisma.fiscalPeriod.update({
        where: { id: periodId },
        data: { status: newStatus }
    })
    revalidatePath('/admin/finance/fiscal-years')
    return { success: true }
}

export async function hardLockFiscalYear(id: number) {
    // @ts-ignore
    await prisma.fiscalYear.update({
        where: { id },
        data: { isHardLocked: true, status: 'CLOSED' }
    })
    revalidatePath('/admin/finance/fiscal-years')
    return { success: true }
}

export async function getFiscalGaps() {
    // @ts-ignore
    const years = await prisma.fiscalYear.findMany({
        orderBy: { startDate: 'asc' }
    })

    const gaps = []
    for (let i = 0; i < years.length - 1; i++) {
        const currentEnd = new Date(years[i].endDate)
        const nextStart = new Date(years[i + 1].startDate)

        // Difference in days
        const diff = (nextStart.getTime() - currentEnd.getTime()) / (1000 * 3600 * 24)
        if (diff > 1.1) { // More than 1 day gap
            gaps.push({
                after: years[i].name,
                before: years[i + 1].name,
                days: Math.floor(diff - 1),
                startDate: new Date(currentEnd.getTime() + (1000 * 3600 * 24)),
                endDate: new Date(nextStart.getTime() - (1000 * 3600 * 24))
            })
        }
    }
    return gaps
}

export async function transferBalancesToNextYear(fromYearId: number, toYearId: number) {
    // 1. Fetch target year and its first period
    // @ts-ignore
    const targetYear = await prisma.fiscalYear.findUnique({
        where: { id: toYearId },
        include: { periods: { orderBy: { number: 'asc' }, take: 1 } }
    })

    if (!targetYear || targetYear.periods.length === 0) {
        throw new Error("Target Fiscal Year or its first period not found.")
    }

    // 2. Calculate Balances for Asset, Liability, Equity
    // @ts-ignore
    const balances = await prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
            journalEntry: {
                fiscalYearId: fromYearId,
                status: 'POSTED'
            },
            account: {
                type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] }
            }
        },
        _sum: { debit: true, credit: true }
    })

    if (balances.length === 0) {
        throw new Error("No balances found to transfer.")
    }

    // 3. Prepare Opening Entry Lines
    const openingLines = balances.map(b => {
        // @ts-ignore
        const debit = Number(b._sum.debit || 0)
        // @ts-ignore
        const credit = Number(b._sum.credit || 0)
        const net = debit - credit // Assets usually have Debit Net (+), Liabilities/Equity have Credit Net (-)

        return {
            accountId: b.accountId,
            debit: net > 0 ? net : 0,
            credit: net < 0 ? Math.abs(net) : 0,
            description: "Opening Balance Roll-forward"
        }
    }).filter(l => l.debit !== 0 || l.credit !== 0)

    if (openingLines.length === 0) return { success: true, message: "Balances were zero, no entry created." }

    // 4. Create Opening Entry
    // @ts-ignore
    await prisma.journalEntry.create({
        data: {
            fiscalYearId: toYearId,
            fiscalPeriodId: targetYear.periods[0].id,
            transactionDate: targetYear.startDate,
            description: `Opening Balances from Prior Year`,
            reference: 'OPENING',
            status: 'POSTED',
            scope: 'OFFICIAL',
            lines: {
                create: openingLines
            }
        }
    })

    revalidatePath('/admin/finance/fiscal-years')
    revalidatePath('/admin/finance/ledger')
    return { success: true }
}
