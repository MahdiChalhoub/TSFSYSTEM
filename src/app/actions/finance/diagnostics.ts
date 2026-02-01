'use server'

import { prisma } from '@/lib/db'

export async function diagnoseFinancialDiscrepancy() {
    const issues: any[] = []

    // 1. Check for Unbalanced Journal Entries (Dr != Cr)
    const entries = await prisma.journalEntry.findMany({
        where: { status: 'POSTED' },
        include: { lines: true }
    })

    for (const entry of entries) {
        const sum = entry.lines.reduce((acc, line) => acc + (Number(line.debit) - Number(line.credit)), 0)
        if (Math.abs(sum) > 0.001) {
            issues.push({
                type: 'UNBALANCED_ENTRY',
                severity: 'CRITICAL',
                title: `Unbalanced Entry #${entry.id}`,
                description: `This entry is off by ${sum.toFixed(2)}. Financial statements will never balance until this is corrected.`,
                action: `/admin/finance/ledger/${entry.id}`
            })
        }
    }

    // 2. Check for Invalid Account Types
    const invalidAccounts = await (prisma.chartOfAccount as any).findMany({
        where: {
            type: { notIn: ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] },
            isActive: true
        }
    })

    if (invalidAccounts.length > 0) {
        issues.push({
            type: 'INVALID_ACCOUNT_TYPE',
            severity: 'CRITICAL',
            title: `${invalidAccounts.length} accounts have invalid types`,
            description: "Accounts without a standard type (Asset, Liability, etc.) are excluded from financial reports.",
            action: '/admin/finance/chart-of-accounts'
        })
    }

    // 3. Check for Out-of-Sync Cached Balances
    // (This is a common issue where the 'balance' field doesn't match the ledger)
    const coas = await prisma.chartOfAccount.findMany({
        include: {
            journalLines: {
                where: { journalEntry: { status: 'POSTED' } }
            }
        }
    })

    for (const acc of coas) {
        const ledgerBalance = acc.journalLines.reduce((sum, l) => sum + (Number(l.debit) - Number(l.credit)), 0)
        if (Math.abs(Number(acc.balance) - ledgerBalance) > 0.001) {
            issues.push({
                type: 'REAL_BALANCE_MISMATCH',
                severity: 'WARNING',
                title: `Balance Mismatch: ${acc.name}`,
                description: `Cached balance (${acc.balance}) does not match real ledger sum (${ledgerBalance}). Use the "Audit Integrity" tool in COA to fix.`,
                action: '/admin/finance/chart-of-accounts'
            })
        }
    }

    // 4. Check for Balances in Inactive Accounts (The "Invisible Money" trap)
    const inactiveAccounts = await prisma.chartOfAccount.findMany({ where: { isActive: false } })
    for (const acc of inactiveAccounts) {
        const ledgerSum = await prisma.journalEntryLine.aggregate({
            where: { accountId: acc.id, journalEntry: { status: 'POSTED' } },
            _sum: { debit: true, credit: true }
        })
        const realBalance = Number(ledgerSum._sum.debit || 0) - Number(ledgerSum._sum.credit || 0)

        if (Math.abs(realBalance) > 0.001) {
            issues.push({
                type: 'LEDGER_RESIDUE',
                severity: 'CRITICAL',
                accountId: acc.id,
                title: `Ledger Residue: ${acc.name}`,
                description: `Account "${acc.name}" is INACTIVE but still has a ledger balance of ${realBalance.toFixed(2)}. This "invisible" money is causing your Balance Sheet mismatch.`,
                action: 'HEAL_RESIDUE'
            })
        }
    }

    // 5. Find any MIGRATION entries that don't Sum to Zero
    const migrationEntries = await prisma.journalEntry.findMany({
        where: { reference: 'MIGRATION' },
        include: { lines: true }
    })
    for (const entry of migrationEntries) {
        const diff = entry.lines.reduce((sum, l) => sum + (Number(l.debit) - Number(l.credit)), 0)
        if (Math.abs(diff) > 0.001) {
            issues.push({
                type: 'BROKEN_MIGRATION_ENTRY',
                severity: 'CRITICAL',
                title: 'Unbalanced Migration Entry',
                description: `Entry #${entry.id} is unbalanced by ${diff.toFixed(2)}. This is a critical database failure.`,
                action: null
            })
        }
    }

    // 6. Check for accounts with EMPTY types
    const emptyTyped = await prisma.chartOfAccount.findMany({
        where: { type: '' }
    })
    if (emptyTyped.length > 0) {
        issues.push({
            type: 'UNTYPED_ACCOUNT',
            severity: 'CRITICAL',
            title: `${emptyTyped.length} accounts have an empty type`,
            description: "These accounts are invisible to the reporting engine.",
            action: `/admin/finance/chart-of-accounts`
        })
    }

    // 9. Detect Cross-Type Migration Spills (Type Leakage)
    const crossMigrations = await prisma.journalEntry.findMany({
        where: { reference: { in: ['MIGRATION', 'CLEANUP'] } },
        include: { lines: { include: { account: true } } }
    })
    for (const entry of crossMigrations) {
        const typeBalances: Record<string, number> = {}
        for (const line of entry.lines) {
            const val = Number(line.debit) - Number(line.credit)
            const type = line.account.type
            typeBalances[type] = (typeBalances[type] || 0) + val
        }

        // We only care about types that had a net change. 
        // If an entry moves money from Liability to Liability, the net change for 'LIABILITY' is 0.
        // If it moves Liability to Income, Liability will have a negative balance and Income a positive one.
        const leakage = Object.entries(typeBalances).filter(([_, bal]) => Math.abs(bal) > 0.001)

        if (leakage.length > 0) {
            const leakingTypes = leakage.map(([type]) => type).join(', ')
            issues.push({
                type: 'CROSS_TYPE_MIGRATION',
                severity: 'WARNING',
                title: `Type Spill Detected: Entry #${entry.id}`,
                description: `This migration entry shifted values between different account categories (${leakingTypes}). This usually happens if an account was incorrectly mapped to a different type during migration.`,
                action: `/admin/finance/ledger/${entry.id}/edit`
            })
        }
    }

    return issues
}

export async function healLedgerResidues() {
    const issues = await diagnoseFinancialDiscrepancy()
    const leakers = issues.filter(i => i.type === 'LEDGER_RESIDUE')

    if (leakers.length === 0) return { success: true, message: "No residues found." }

    const { sweepInactiveBalances } = await import('./coa-templates')

    const mapping: Record<number, number> = {}

    for (const issue of leakers) {
        if (!issue.accountId) continue

        const source = await prisma.chartOfAccount.findUnique({ where: { id: issue.accountId } })
        const target = await prisma.chartOfAccount.findFirst({
            where: { type: source?.type, isActive: true },
            orderBy: { code: 'asc' }
        })

        if (target) mapping[issue.accountId] = target.id
    }

    if (Object.keys(mapping).length > 0) {
        await sweepInactiveBalances(mapping)
    }

    return { success: true }
}
