
import { prisma } from './src/lib/db'

async function checkAccounts() {
    const codes = ['5700', '5120', '5121'];
    const accounts = await prisma.chartOfAccount.findMany({
        where: { code: { in: codes } }
    });

    console.log("Existing Accounts:");
    accounts.forEach(a => console.log(`- [${a.code}] ${a.name} (${a.type})`));

    const foundCodes = accounts.map(a => a.code);
    const missing = codes.filter(c => !foundCodes.includes(c));

    if (missing.length > 0) {
        console.log("\nMISSING ACCOUNTS:", missing);
    } else {
        console.log("\nAll required accounts exist.");
    }
}

checkAccounts()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
