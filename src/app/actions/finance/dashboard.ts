'use server'

import { prisma } from '@/lib/db'
import { serializeDecimals } from '@/lib/utils/serialization'
import { getInventoryFinancialStatus } from './inventory-integration'

export async function getFinancialDashboardStats(scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const balanceField = scope === 'OFFICIAL' ? 'balanceOfficial' : 'balance'

    // 1. Cash Position (Bank + Cash accounts)
    const cashAccounts = await prisma.chartOfAccount.findMany({
        where: {
            OR: [
                { subType: 'CASH' },
                { subType: 'BANK' }
            ]
        }
    })
    const totalCash = cashAccounts.reduce((sum: number, acc: any) => sum + Number(acc[balanceField]), 0)

    // 2. Precise Monthly P&L
    const lines = await prisma.journalEntryLine.findMany({
        where: {
            journalEntry: {
                status: 'POSTED',
                transactionDate: { gte: currentMonthStart, lte: currentMonthEnd },
                ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
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

    const totalAR = arAccounts.reduce((sum: number, a: any) => sum + Number(a[balanceField]), 0)
    const totalAP = Math.abs(apAccounts.reduce((sum: number, a: any) => sum + Number(a[balanceField]), 0))

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
                    transactionDate: { gte: monthStart, lte: monthEnd },
                    ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
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
        where: {
            ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
        },
        orderBy: { transactionDate: 'desc' },
        include: {
            lines: {
                include: { account: true },
                take: 2
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
export async function getAdminDashboardStats() {
    const totalSales = await prisma.order.aggregate({
        where: { type: 'SALE', status: 'COMPLETED' },
        _sum: { totalAmount: true }
    })

    const activeOrders = await prisma.order.count({
        where: { status: 'PENDING_APPROVAL' }
    })

    const totalProducts = await prisma.product.count({
        where: { status: 'ACTIVE' }
    })

    const totalCustomers = await prisma.contact.count({
        where: { type: 'CUSTOMER' }
    })

    const latestSales = await prisma.order.findMany({
        where: { type: 'SALE' },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { contact: true }
    })

    return serializeDecimals({
        totalSales: Number(totalSales._sum.totalAmount || 0),
        activeOrders,
        totalProducts,
        totalCustomers,
        latestSales
    })
}
