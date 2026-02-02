import { prisma } from './src/lib/db'
import { processSale } from './src/app/admin/sales/actions'

// Mock revalidatePath for script execution
import * as cache from 'next/cache'
(cache as any).revalidatePath = (path: string) => {
    // console.log(`[Mock] Revalidating path: ${path}`);
};

async function runScenario() {
    console.log("🛠️  STARTING DUAL VIEW ENGINE TEST...");

    // 1. Reset System (Directly via Prisma to avoid revalidatePath issues in scripts)
    console.log("🧹 Clearing previous data...");
    await prisma.journalEntryLine.deleteMany({});
    await prisma.journalEntry.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.chartOfAccount.updateMany({
        data: { balance: 0, balanceOfficial: 0 }
    });

    // 2. Setup Dimensions
    const user = await prisma.user.findFirst({ include: { cashRegister: true } });
    const product = await prisma.product.findFirst();
    const site = await prisma.site.findFirst();

    if (!user || !product || !site) {
        throw new Error("Missing seed data (User, Product, or Site). Please run npx prisma db seed first.");
    }

    // Ensure user has a cash register assigned
    if (!user.cashRegisterId) {
        const defaultCash = await prisma.financialAccount.findFirst({ where: { type: 'CASH' } });
        if (defaultCash) {
            await prisma.user.update({
                where: { id: user.id },
                data: { cashRegisterId: defaultCash.id }
            });
        }
    }

    console.log(`👤 User: ${user.name}`);

    // 3. Scenario A: Official Sale of $100
    console.log("\n🛒 Scenario A: $100 OFFICIAL Sale...");
    await processSale({
        cart: [{ productId: product.id, name: product.name, price: 100, quantity: 1, taxRate: 0, isTaxIncluded: true }],
        paymentMethod: 'CASH',
        totalAmount: 100,
        scope: 'OFFICIAL',
        _userId: user.id
    });

    // 4. Scenario B: Internal Sale of $50
    console.log("🛒 Scenario B: $50 INTERNAL Sale...");
    await processSale({
        cart: [{ productId: product.id, name: product.name, price: 50, quantity: 1, taxRate: 0, isTaxIncluded: true }],
        paymentMethod: 'CASH',
        totalAmount: 50,
        scope: 'INTERNAL',
        _userId: user.id
    });

    // 5. Audit Results
    const cashAccount = await prisma.chartOfAccount.findFirst({
        where: { subType: 'CASH' }
    });

    if (!cashAccount) {
        console.log("❌ No CASH account found in COA.");
        return;
    }

    console.log("\n🏁 TEST RESULTS (Audit Trail):");
    console.log("==================================================================");
    console.log("| Account Code | Name             | Consolidated (Mgt) | Official (Tax) |");
    console.log("------------------------------------------------------------------");

    const consolidated = Number(cashAccount.balance).toFixed(2);
    const official = Number(cashAccount.balanceOfficial).toFixed(2);
    console.log(`| ${cashAccount.code.padEnd(12)} | ${cashAccount.name.padEnd(16)} | $${consolidated.padStart(16)} | $${official.padStart(12)} |`);
    console.log("==================================================================");

    const journalEntries = await prisma.journalEntry.findMany({
        select: { id: true, scope: true, description: true }
    });

    console.log("\n📝 Journal Entries Check:");
    journalEntries.forEach(je => {
        console.log(`[J-${je.id}] [${je.scope.padEnd(8)}] ${je.description}`);
    });

    if (Number(cashAccount.balance) === 150 && Number(cashAccount.balanceOfficial) === 100) {
        console.log("\n✅ DUAL VIEW VERIFIED: Balances correctly isolated!");
        console.log("   - Management View reflects $150 (Total Business)");
        console.log("   - Official View reflects $100 (Tax Declared)");
    } else {
        console.log("\n❌ VERIFICATION FAILED: Unexpected balance state.");
    }
}

runScenario()
    .catch(console.error)
    .finally(() => process.exit());
