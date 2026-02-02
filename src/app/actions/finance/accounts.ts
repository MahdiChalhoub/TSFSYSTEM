'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { serialize } from '@/lib/utils'

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

export async function getChartOfAccounts(includeInactive: boolean = false, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    const accounts = await (prisma.chartOfAccount as any).findMany({
        orderBy: { code: 'asc' },
        where: {
            isActive: true,
            ...(includeInactive ? {} : { isHidden: false })
        },
        include: {
            children: true
        }
    })

    const balanceField = scope === 'OFFICIAL' ? 'balanceOfficial' : 'balance'

    // 2. Build Hierarchy & Calculate Rollup Balances
    const accountMap = new Map<number, any>()

    // Initialize Map with raw data
    accounts.forEach((acc: any) => {
        accountMap.set(acc.id, {
            ...acc,
            balance: Number(acc[balanceField]),
            children: []
        })
    })

    const rootAccounts: any[] = []

    // Build Tree
    accounts.forEach((acc: any) => {
        const node = accountMap.get(acc.id)
        if (acc.parentId && accountMap.has(acc.parentId)) {
            accountMap.get(acc.parentId).children.push(node)
        } else {
            rootAccounts.push(node)
        }
    })

    // Recursive Sum Function (Mutates nodes to update balance)
    function calculateRollup(node: any): number {
        let childSum = 0
        if (node.children && node.children.length > 0) {
            node.children.forEach((child: any) => {
                childSum += calculateRollup(child)
            })
        }

        // Logical Balance = Own Direct Balance + Children Balance
        // Note: This assumes strict +/- consistency.
        const total = node.balance + childSum

        // We update the node's displayed balance to be the total
        // But we keep 'directBalance' if needed for debugging (optional)
        node.directBalance = node.balance // Preserve original
        node.balance = total

        return total
    }

    // Calculate for all roots
    rootAccounts.forEach(root => calculateRollup(root))

    // Return FLAT list with updated balances (preserving original order)
    // This ensures dropdowns and other lists see ALL accounts, not just roots.
    return serialize(accounts.map((acc: any) => accountMap.get(acc.id)))
}

export async function getInactiveAccounts() {
    const accounts = await (prisma.chartOfAccount as any).findMany({
        where: { isActive: false },
        orderBy: { code: 'asc' }
    })
    return serialize(accounts.map((acc: any) => ({
        ...acc,
        balance: Number(acc.balance)
    })))
}

export async function createAccount(data: {
    code: string
    name: string
    type: string
    description?: string
    subType?: string
    parentId?: number
    syscohadaCode?: string
    syscohadaClass?: string
}) {
    // Validate uniqueness
    const existing = await prisma.chartOfAccount.findUnique({
        where: { code: data.code }
    })

    if (existing) {
        throw new Error(`Account code ${data.code} already exists.`)
    }

    await (prisma.chartOfAccount as any).create({
        data: {
            code: data.code,
            name: data.name,
            type: data.type,
            description: data.description,
            subType: data.subType,
            parentId: data.parentId,
            syscohadaCode: data.syscohadaCode,
            syscohadaClass: data.syscohadaClass,
            isActive: true
        }
    })

    revalidatePath('/admin/finance/chart-of-accounts')
    return { success: true }
}

export async function updateAccount(data: {
    id: number
    code: string
    name: string
    type: string
    description?: string
    subType?: string
    isActive?: boolean
    parentId?: number
    syscohadaCode?: string
    syscohadaClass?: string
}) {
    // Validate uniqueness if code changed
    const existing = await prisma.chartOfAccount.findFirst({
        where: {
            code: data.code,
            id: { not: data.id }
        }
    })

    if (existing) {
        throw new Error(`Account code ${data.code} already exists.`)
    }

    // Prevent circular dependency (Parent cannot be itself or its own child)
    if (data.parentId === data.id) {
        throw new Error("Account cannot be its own parent.")
    }
    // Deep circular check would be better but this catches the basic case.

    await (prisma.chartOfAccount as any).update({
        where: { id: data.id },
        data: {
            code: data.code,
            name: data.name,
            type: data.type,
            description: data.description,
            subType: data.subType,
            isActive: data.isActive,
            parentId: data.parentId,
            syscohadaCode: data.syscohadaCode,
            syscohadaClass: data.syscohadaClass
        }
    })

    revalidatePath('/admin/finance/chart-of-accounts')
    return { success: true }
}

export async function getAccountStatement(accountId: number, filter?: { startDate?: Date, endDate?: Date }, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    // 1. Get Account Info
    const account = await prisma.chartOfAccount.findUnique({
        where: { id: accountId }
    })

    if (!account) throw new Error("Account not found")

    // 2. Calculate Opening Balance (Sum of all lines BEFORE startDate)
    let openingBalance = 0
    if (filter?.startDate) {
        const openingAgg = await prisma.journalEntryLine.groupBy({
            by: ['accountId'],
            where: {
                accountId: accountId,
                journalEntry: {
                    status: 'POSTED',
                    transactionDate: { lt: filter.startDate },
                    ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
                }
            },
            _sum: { debit: true, credit: true }
        })

        if (openingAgg.length > 0) {
            const deb = Number(openingAgg[0]._sum.debit || 0)
            const cred = Number(openingAgg[0]._sum.credit || 0)
            openingBalance = deb - cred // Standard: Debit positive
        }
    } else {
        // If no start date, opening is 0 (beginning of time)
        openingBalance = 0
    }

    // 3. Update Opening Balance Sign based on Account Type for display
    // Usually statements show "Balance" relative to normal side
    // Assets/Expenses: Dr is +
    // Liab/Equity/Income: Cr is + (so we might invert for display, or keep Dr/Cr distinct)
    // Let's keep strict Dr (+) Cr (-) for calculation, and handle display in UI.

    // 4. Get Transactions in Range
    const whereClause: any = {
        accountId: accountId,
        journalEntry: {
            status: 'POSTED',
            ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
        }
    }

    if (filter?.startDate) {
        whereClause.journalEntry.transactionDate = {
            ...(whereClause.journalEntry.transactionDate || {}),
            gte: filter.startDate
        }
    }
    if (filter?.endDate) {
        whereClause.journalEntry.transactionDate = {
            ...(whereClause.journalEntry.transactionDate || {}),
            lte: filter.endDate
        }
    }

    const lines = await prisma.journalEntryLine.findMany({
        where: whereClause,
        include: {
            journalEntry: true
        },
        orderBy: {
            journalEntry: { transactionDate: 'asc' }
        }
    })

    return serialize({
        account: {
            ...account,
            balance: Number(account.balance)
        },
        openingBalance,
        lines: lines.map(line => ({
            ...line,
            debit: Number(line.debit),
            credit: Number(line.credit)
        }))
    })
}

export async function getTrialBalanceReport(asOfDate?: Date, legalReport: boolean = false, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    // 1. Get All Accounts
    const accounts = await (prisma.chartOfAccount as any).findMany({
        orderBy: { code: 'asc' },
        where: {
            isActive: true,
            ...(legalReport ? {
                isSystemOnly: false,
                NOT: { code: { startsWith: '9' } }
            } : {})
        },
        include: { children: true }
    })

    // 2. Fetch Aggregated Balances up to Date
    const where: any = {
        journalEntry: {
            status: 'POSTED',
            ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
        }
    }
    if (asOfDate) {
        where.journalEntry.transactionDate = { lte: asOfDate }
    }

    const balances = await prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: where,
        _sum: { debit: true, credit: true }
    })

    const balanceMap = new Map(balances.map(b => [b.accountId, Number(b._sum.debit || 0) - Number(b._sum.credit || 0)]))

    // 3. Build Memory Tree for Rollups
    const accountMap = new Map<number, any>()
    accounts.forEach((acc: any) => {
        accountMap.set(acc.id, {
            ...acc,
            directBalance: balanceMap.get(acc.id) || 0,
            balance: balanceMap.get(acc.id) || 0,
            children: []
        })
    })

    const rootAccounts: any[] = []
    accounts.forEach((acc: any) => {
        const node = accountMap.get(acc.id)
        if (acc.parentId && accountMap.has(acc.parentId)) {
            accountMap.get(acc.parentId).children.push(node)
        } else {
            rootAccounts.push(node)
        }
    })

    // 4. Rollup Sums
    function calculateRollup(node: any): number {
        let childSum = 0
        node.children.forEach((child: any) => {
            childSum += calculateRollup(child)
        })
        const total = node.directBalance + childSum
        node.balance = total
        return total
    }

    rootAccounts.forEach(root => calculateRollup(root))

    return serialize(Array.from(accountMap.values()))
}

export async function getProfitAndLossReport(startDate: Date, endDate: Date, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    // 1. Get Income & Expense Accounts
    const accounts = await (prisma.chartOfAccount as any).findMany({
        where: {
            isActive: true,
            type: { in: ['INCOME', 'EXPENSE'] }
        },
        orderBy: { code: 'asc' },
        include: { children: true }
    })

    // 2. Fetch Aggregated Balances in Range
    const balances = await prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
            journalEntry: {
                status: 'POSTED',
                transactionDate: { gte: startDate, lte: endDate },
                ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
            },
            account: { type: { in: ['INCOME', 'EXPENSE'] } }
        },
        _sum: { debit: true, credit: true }
    })

    // Map: Income is normally Credit (+), Expense is normally Debit (+)
    const balanceMap = new Map()
    balances.forEach(b => {
        const acc = accounts.find((a: any) => a.id === b.accountId)
        if (!acc) return
        const val = acc.type === 'INCOME'
            ? Number(b._sum.credit || 0) - Number(b._sum.debit || 0)
            : Number(b._sum.debit || 0) - Number(b._sum.credit || 0)
        balanceMap.set(b.accountId, val)
    })

    // 3. Build Tree
    const accountMap = new Map<number, any>()
    accounts.forEach((acc: any) => {
        accountMap.set(acc.id, {
            ...acc,
            directBalance: balanceMap.get(acc.id) || 0,
            balance: balanceMap.get(acc.id) || 0,
            children: []
        })
    })

    const rootAccounts: any[] = []
    accounts.forEach((acc: any) => {
        const node = accountMap.get(acc.id)
        if (acc.parentId && accountMap.has(acc.parentId)) {
            accountMap.get(acc.parentId).children.push(node)
        } else {
            rootAccounts.push(node)
        }
    })

    function calculateRollup(node: any): number {
        let childSum = 0
        node.children.forEach((child: any) => {
            childSum += calculateRollup(child)
        })
        const total = node.directBalance + childSum
        node.balance = total
        return total
    }

    rootAccounts.forEach(root => calculateRollup(root))

    return serialize(Array.from(accountMap.values()))
}

export async function getBalanceSheetReport(asOfDate: Date, scope: 'OFFICIAL' | 'INTERNAL' = 'INTERNAL') {
    // 1. Get A-L-E Accounts
    const accounts = await (prisma.chartOfAccount as any).findMany({
        where: {
            isActive: true,
            type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] }
        },
        orderBy: { code: 'asc' },
        include: { children: true }
    })

    // 2. Aggregated Balances for A-L-E
    const balances = await prisma.journalEntryLine.groupBy({
        by: ['accountId'],
        where: {
            journalEntry: {
                status: 'POSTED',
                transactionDate: { lte: asOfDate },
                ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
            },
            account: { type: { in: ['ASSET', 'LIABILITY', 'EQUITY'] } }
        },
        _sum: { debit: true, credit: true }
    })

    const balanceMap = new Map()
    balances.forEach(b => {
        const acc = accounts.find((a: any) => a.id === b.accountId)
        if (!acc) return
        // Real accounts: assets = dr - cr. liab/eq = cr - dr.
        const val = acc.type === 'ASSET'
            ? Number(b._sum.debit || 0) - Number(b._sum.credit || 0)
            : Number(b._sum.credit || 0) - Number(b._sum.debit || 0)
        balanceMap.set(b.accountId, val)
    })

    // 3. Current Year Profit (Virtual Equity)
    // We need to calculate Net Profit for all time up to asOfDate from INCOME/EXPENSE
    const profitAgg = await prisma.journalEntryLine.aggregate({
        where: {
            journalEntry: {
                status: 'POSTED',
                transactionDate: { lte: asOfDate },
                ...(scope === 'OFFICIAL' ? { scope: 'OFFICIAL' } : {})
            },
            account: { type: { in: ['INCOME', 'EXPENSE'] } }
        },
        _sum: { debit: true, credit: true }
    })
    const netProfit = Number(profitAgg._sum.credit || 0) - Number(profitAgg._sum.debit || 0)

    // 4. Build Tree
    const accountMap = new Map<number, any>()
    accounts.forEach((acc: any) => {
        accountMap.set(acc.id, {
            ...acc,
            directBalance: balanceMap.get(acc.id) || 0,
            balance: balanceMap.get(acc.id) || 0,
            children: []
        })
    })

    const rootAccounts: any[] = []
    accounts.forEach((acc: any) => {
        const node = accountMap.get(acc.id)
        if (acc.parentId && accountMap.has(acc.parentId)) {
            accountMap.get(acc.parentId).children.push(node)
        } else {
            rootAccounts.push(node)
        }
    })

    function calculateRollup(node: any): number {
        let childSum = 0
        node.children.forEach((child: any) => {
            childSum += calculateRollup(child)
        })
        const total = node.directBalance + childSum
        node.balance = total
        return total
    }

    rootAccounts.forEach(root => calculateRollup(root))

    return serialize({
        accounts: Array.from(accountMap.values()),
        netProfit
    })
}
export async function reactivateChartOfAccount(id: number) {
    await (prisma.chartOfAccount as any).update({
        where: { id },
        data: { isActive: true }
    })
    revalidatePath('/admin/finance/chart-of-accounts')
    return { success: true }
}
