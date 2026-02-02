import { prisma } from './src/lib/db'

async function check() {
    const cash = await prisma.chartOfAccount.findFirst({ where: { subType: 'CASH' } });
    const bank = await prisma.chartOfAccount.findFirst({ where: { subType: 'BANK' } });

    console.log("--- CURRENT LEDGER STATUS ---");
    if (cash) {
        console.log(`CASH [${cash.code}]: Mgt: $${cash.balance}, Off: $${cash.balanceOfficial}`);
    }
    if (bank) {
        console.log(`BANK [${bank.code}]: Mgt: $${bank.balance}, Off: $${bank.balanceOfficial}`);
    }

    const entries = await prisma.journalEntry.findMany({
        take: 5,
        orderBy: { id: 'desc' },
        select: { id: true, scope: true, description: true }
    });

    console.log("\n--- RECENT ENTRIES ---");
    entries.forEach(e => console.log(`[J-${e.id}] [${e.scope}] ${e.description}`));
}

check().catch(console.error).finally(() => process.exit());
