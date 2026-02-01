'use server'

import { prisma } from '@/lib/db'
import { serializeDecimals } from '@/lib/utils/serialization'
import { getInventoryFinancialStatus } from './inventory-integration'

export async function getFinancialDashboardStats() {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // 1. Cash Position (Bank + Cash accounts)
    const cashAccounts = await prisma.chartOfAccount.findMany({
        where: {
            OR: [
                { subType: 'CASH' },
                { subType: 'BANK' }
            ]
        }
    })
    const totalCash = cashAccounts.reduce((sum: number, acc: any) => sum + Number(acc.balance), 0)

    // 2. Precise Monthly P&L
    const lines = await prisma.journalEntryLine.findMany({
        where: {
            journalEntry: {
                status: 'POSTED',
                transactionDate: { gte: currentMonthStart, lte: currentMonthEnd }
            },
            account: { type: { in: ['INCOME', 'EXPENSE'] } }
        },
        include: { account: true }
    })

    let curMonthlyIncome = 0
    let curMonthlyExpense = 0
    lines.forEach((l: any) => {
        if (l.account.type === 'INCOME') curMonthlyIncome += (Number(l.credit) - Number(l.debit))
        else curMonthlyExpense += (Number(l.debit) - Number(l.credit))
    })

    // 3. Receivables & Payables
    const arAccounts = await (prisma.chartOfAccount as any).findMany({ where: { subType: 'RECEIVABLE' } })
    const apAccounts = await (prisma.chartOfAccount as any).findMany({ where: { subType: 'PAYABLE' } })

    const totalAR = arAccounts.reduce((sum: number, a: any) => sum + Number(a.balance), 0)
    const totalAP = Math.abs(apAccounts.reduce((sum: number, a: any) => sum + Number(a.balance), 0))

    // 4. Trend Data (Last 6 Months)
    const trends = []
    for (let i = 5; i >= 0; i--) {
        const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthStart = new Date(mDate.getFullYear(), mDate.getMonth(), 1)
        const monthEnd = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0)

        const monthLines = await prisma.journalEntryLine.findMany({
            where: {
                journalEntry: {
                    status: 'POSTED',
                    transactionDate: { gte: monthStart, lte: monthEnd }
                },
                account: { type: { in: ['INCOME', 'EXPENSE'] } }
            },
            include: { account: true }
        })

        let inc = 0
        let exp = 0
        monthLines.forEach((l: any) => {
            if (l.account.type === 'INCOME') inc += (Number(l.credit) - Number(l.debit))
            else exp += (Number(l.debit) - Number(l.credit))
        })

        trends.push({
            month: monthStart.toLocaleString('default', { month: 'short' }),
            income: inc,
            expense: exp,
            profit: inc - exp
        })
    }

    // 5. Recent Activity
    const recentEntries = await prisma.journalEntry.findMany({
        take: 5,
        orderBy: { transactionDate: 'desc' },
        include: {
            lines: {
                include: { account: true },
                take: 2 // Only preview a couple of lines per entry
            }
        }
    })

    // 6. Inventory Integrity
    const inventoryStatus = await getInventoryFinancialStatus()

    const stats = {
        totalCash: Number(totalCash),
        monthlyIncome: Number(curMonthlyIncome),
        monthlyExpense: Number(curMonthlyExpense),
        netProfit: Number(curMonthlyIncome - curMonthlyExpense),
        totalAR: Number(totalAR),
        totalAP: Number(totalAP),
        trends: trends.map(t => ({
            ...t,
            income: Number(t.income),
            expense: Number(t.expense),
            profit: Number(t.profit)
        })),
        recentEntries,
        inventoryStatus: {
            totalValue: Number(inventoryStatus.totalValue),
            ledgerBalance: Number(inventoryStatus.ledgerBalance),
            discrepancy: Number(inventoryStatus.discrepancy),
            isMapped: inventoryStatus.isMapped
        }
    }

    return serializeDecimals(stats)
}
