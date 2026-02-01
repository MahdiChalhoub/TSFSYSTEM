import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function scan() {
    console.log("🔍 INVESTIGATING ACCOUNT CROSS-MIGRATION")

    // 1. Check all MIGRATION/CLEANUP entries for cross-type errors
    const entries = await prisma.journalEntry.findMany({
        where: { reference: { in: ['MIGRATION', 'CLEANUP'] } },
        include: { lines: { include: { account: true } } }
    })

    for (const e of entries) {
        const types = new Set(e.lines.map(l => l.account.type))
        if (types.size > 1) {
            console.log(`\n⚠️ POTENTIAL CROSS-TYPE ERROR in Entry #${e.id} (${e.reference})`)
            console.log(`Description: ${e.description}`)
            for (const l of e.lines) {
                console.log(`  - [${l.account.type}] ${l.account.code} ${l.account.name}: Dr ${l.debit}, Cr ${l.credit}`)
            }
        }
    }

    // 2. Check for accounts that were supposed to be zeroed but aren't
    const inactiveWithBalance = await prisma.chartOfAccount.findMany({
        where: { isActive: false, balance: { not: 0 } }
    })

    if (inactiveWithBalance.length > 0) {
        console.log("\n❌ INACTIVE ACCOUNTS WITH LINGERING BALANCES:")
        for (const acc of inactiveWithBalance) {
            console.log(`  - ${acc.code} ${acc.name}: ${acc.balance}`)
        }
    } else {
        console.log("\n✅ All inactive accounts are zeroed (cached).")
    }

    // 3. Overall Balance Sheet Verification
    const accounts = await prisma.chartOfAccount.findMany({
        include: {
            journalLines: {
                where: { journalEntry: { status: 'POSTED' } }
            }
        }
    })

    let assets = 0; let liabEq = 0; let profit = 0
    for (const acc of accounts) {
        const bal = acc.journalLines.reduce((s, l) => s + (Number(l.debit) - Number(l.credit)), 0)
        if (acc.isActive) {
            if (acc.type === 'ASSET') assets += bal
            else if (acc.type === 'LIABILITY' || acc.type === 'EQUITY') liabEq -= bal
            else profit -= bal
        } else {
            if (Math.abs(bal) > 0.01) {
                console.log(`🚨 INVISIBLE LEAK: ${acc.name} (${acc.type}) has ledger balance ${bal.toFixed(2)}`)
            }
        }
    }

    console.log(`\nStats:`)
    console.log(`Assets: ${assets.toFixed(2)}`)
    console.log(`Liab+Eq: ${liabEq.toFixed(2)}`)
    console.log(`Profit (P&L): ${profit.toFixed(2)}`)
    console.log(`Mismatch: ${(assets - (liabEq + profit)).toFixed(2)}`)
}

scan().catch(console.error).finally(() => prisma.$disconnect())
