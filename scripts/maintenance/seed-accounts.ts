
import { prisma } from './src/lib/db'

async function seedMissingAccounts() {
    const accounts = [
        { code: '5700', name: 'Main Cash Drawer', type: 'ASSET', subType: 'CASH', description: 'Physical cash in hand' },
        { code: '5120', name: 'Bank Accounts', type: 'ASSET', subType: 'BANK', description: 'Main business bank accounts' },
        { code: '5121', name: 'Mobile Wallets', type: 'ASSET', subType: 'Mobile Money', description: 'OMT, Whish, etc.' }
    ];

    for (const acc of accounts) {
        const exists = await prisma.chartOfAccount.findUnique({ where: { code: acc.code } });
        if (!exists) {
            console.log(`Creating ${acc.code} - ${acc.name}...`);
            await prisma.chartOfAccount.create({
                data: {
                    code: acc.code,
                    name: acc.name,
                    type: acc.type,
                    subType: acc.subType, // This might not be in schema? Let's check schema.
                    description: acc.description,
                    balance: 0,
                    isActive: true
                }
            });
        } else {
            console.log(`Verified ${acc.code}.`);
        }
    }
}

seedMissingAccounts()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
