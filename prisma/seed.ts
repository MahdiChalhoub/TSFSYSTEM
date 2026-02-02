
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // 1. Seed Roles
    const roles = [
        { name: 'ADMIN', description: 'Total System Control' },
        { name: 'MANAGER', description: 'Branch & Stock Management' },
        { name: 'CASHIER', description: 'POS & Basic Sales' },
    ]
    for (const r of roles) {
        // @ts-ignore
        await prisma.role.upsert({
            where: { name: r.name },
            update: { description: r.description },
            create: r
        })
    }
    // @ts-ignore
    const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } })

    // 2. Seed Sites (The Enterprise Roots)
    // @ts-ignore
    const hqSite = await prisma.site.upsert({
        where: { code: 'HQ-BEIRUT' },
        update: {},
        create: {
            name: 'HQ - Beirut Central',
            code: 'HQ-BEIRUT',
            address: 'Downtown, Beirut',
            phone: '+961 1 000 000',
            isActive: true
        }
    })
    console.log(`📍 Seeded Primary Site: ${hqSite.name}`)

    // 2. Create Default Admin User
    const adminEmail = 'admin@tsfci.com'
    // @ts-ignore
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
            role: adminRole ? { connect: { id: adminRole.id } } : undefined,
            homeSite: hqSite ? { connect: { id: hqSite.id } } : undefined
        },
        create: {
            email: adminEmail,
            name: 'Admin User',
            password: 'hashed_password_123',
            role: adminRole ? { connect: { id: adminRole.id } } : undefined,
            homeSite: hqSite ? { connect: { id: hqSite.id } } : undefined,
            isActive: true,
        },
    })
    console.log(`👤 Admin user: ${adminEmail}`)

    // 2. Seed Countries
    const countries = [
        { code: 'LB', name: 'Lebanon' },
        { code: 'US', name: 'United States' },
        { code: 'FR', name: 'France' },
        { code: 'TR', name: 'Turkey' },
        { code: 'CN', name: 'China' },
    ]

    for (const c of countries) {
        await prisma.country.upsert({
            where: { code: c.code },
            update: {},
            create: c,
        })
    }
    console.log(`🌍 Seeded ${countries.length} countries`)

    // 3. Seed Units
    // 3. Seed Units (Hierarchical)
    // First, ensure Base Unit exists
    const piece = await prisma.unit.upsert({
        where: { code: 'PC' },
        update: {},
        create: { code: 'PC', name: 'Piece', conversionFactor: 1 },
    })

    // Level 1: Weight based
    await prisma.unit.upsert({
        where: { code: 'KG' },
        update: {},
        create: { code: 'KG', name: 'Kilogram', conversionFactor: 1 },
    })

    // Level 2: Derived Units (Pack = 6 Pieces)
    await prisma.unit.upsert({
        where: { code: 'PACK' },
        update: { baseUnitId: piece.id, conversionFactor: 6 },
        create: { code: 'PACK', name: 'Pack', baseUnitId: piece.id, conversionFactor: 6 },
    })

    // Level 2: Derived Units (Box = 12 Pieces)
    await prisma.unit.upsert({
        where: { code: 'BOX' },
        update: { baseUnitId: piece.id, conversionFactor: 12 },
        create: { code: 'BOX', name: 'Box', baseUnitId: piece.id, conversionFactor: 12 },
    })

    // Liquid
    await prisma.unit.upsert({
        where: { code: 'LITER' },
        update: {},
        create: { code: 'LITER', name: 'Liter', conversionFactor: 1 },
    })

    console.log(`📏 Seeded units with hierarchy`)

    // 4. Seed Warehouses
    const warehouses = [
        { name: 'Main Store', type: 'STORE' },
        { name: 'Backroom', type: 'PHYSICAL' },
        { name: 'Damaged Goods', type: 'VIRTUAL' },
    ]

    // Warehouse doesn't have a unique code, so we check first or just create if empty.
    // For simplicity in this seed, we'll Create Many if table is empty.
    const warehouseCount = await prisma.warehouse.count()
    if (warehouseCount === 0) {
        for (const w of warehouses) {
            // @ts-ignore
            await prisma.warehouse.create({
                data: { ...w, site: { connect: { id: hqSite.id } } }
            })
        }
        console.log(`🏭 Seeded ${warehouses.length} warehouses for site ${hqSite.name}`)
    }

    // 5. Seed Financial Accounts
    const accounts = [
        { name: 'Main Cash Drawer', type: 'CASH', currency: 'USD' },
        { name: 'Main Bank Account', type: 'BANK', currency: 'USD' },
        { name: 'Petty Cash', type: 'CASH', currency: 'LBP' },
    ]

    const accountCount = await prisma.financialAccount.count()
    if (accountCount === 0) {
        for (const account of accounts) {
            // @ts-ignore
            await prisma.financialAccount.create({
                data: { ...account, site: { connect: { id: hqSite.id } } }
            })
        }
        console.log(`💰 Seeded ${accounts.length} financial accounts for site ${hqSite.name}`)
    }


    console.log('✅ Financial Accounts Seeded')

    // 6. Seed Financial Settings (Default)
    const settings = await prisma.financialSettings.findFirst()
    if (!settings) {
        await prisma.financialSettings.create({
            data: {
                companyType: 'MIXED',
                currency: 'USD',
                defaultTaxRate: 0.11,
                worksInTTC: true,
                allowHTEntryForTTC: false,
                dualView: true
            }
        })
        console.log('⚙️ Default Financial Settings Created')
    }

    // 7. Seed Fiscal Year 2026
    const fy2026 = await prisma.fiscalYear.upsert({
        where: { id: 1 }, // Using ID 1 for simplicity in test
        update: {},
        create: {
            id: 1,
            name: 'FY 2026',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            status: 'OPEN'
        }
    })
    console.log('📅 Fiscal Year FY 2026 Created')

    // 8. Seed Chart of Accounts (Standard Simplified)
    // Assets (1000), Liabilities (2000), Equity (3000), Revenue (4000), Expenses (5000)

    // Helper to create account if missing
    const upsertAccount = async (code: string, name: string, type: string, parentId?: number, subType?: string) => {
        const acc = await prisma.chartOfAccount.upsert({
            where: { code },
            update: { subType },
            create: { code, name, type, parentId, subType }
        })
        return acc
    }

    const assets = await upsertAccount('1000', 'ASSETS', 'ASSET')
    const liabilities = await upsertAccount('2000', 'LIABILITIES', 'LIABILITY')
    const equity = await upsertAccount('3000', 'EQUITY', 'EQUITY')
    const revenue = await upsertAccount('4000', 'REVENUE', 'INCOME')
    const expenses = await upsertAccount('5000', 'COST OF GOODS SOLD (COGS)', 'EXPENSE')
    const opEx = await upsertAccount('6000', 'OPERATING EXPENSES', 'EXPENSE')

    // Assets Detail
    await upsertAccount('1100', 'Current Assets', 'ASSET', assets.id)
    await upsertAccount('1101', 'Cash & Cash Equivalents', 'ASSET') // General category

    // Automation Roots (SYSCOHADA Standard Defaults)
    const cashRoot = await upsertAccount('5700', 'Cash Accounts', 'ASSET', assets.id, 'CASH')
    const bankRoot = await upsertAccount('5120', 'Bank Accounts', 'ASSET', assets.id, 'BANK')
    const mobileRoot = await upsertAccount('5121', 'Mobile Wallets', 'ASSET', assets.id, 'MOBILE')
    await upsertAccount('1110', 'Accounts Receivable', 'ASSET', assets.id)
    await upsertAccount('1120', 'Inventory', 'ASSET', assets.id)

    // Liabilities Detail
    await upsertAccount('2100', 'Current Liabilities', 'LIABILITY', liabilities.id)
    await upsertAccount('2101', 'Accounts Payable', 'LIABILITY')
    await upsertAccount('2110', 'Taxes Payable', 'LIABILITY')
    await upsertAccount('2200', 'Long-Term Liabilities', 'LIABILITY', liabilities.id)

    console.log('📊 Chart of Accounts Seeded')

    // 8. Seed Default Posting Rules for Automation (Aligned with Final COA)
    const postingRules = {
        sales: {
            receivable: (await upsertAccount('1110', 'Accounts Receivable', 'ASSET')).id,
            revenue: (await upsertAccount('4100', 'Sales Revenue', 'INCOME', revenue.id)).id,
            cogs: (await upsertAccount('5100', 'Cost of Sales', 'EXPENSE', expenses.id)).id,
            inventory: (await upsertAccount('1120', 'Inventory', 'ASSET', assets.id)).id
        },
        purchases: {
            payable: (await upsertAccount('2101', 'Accounts Payable', 'LIABILITY')).id,
            inventory: (await upsertAccount('1120', 'Inventory', 'ASSET')).id,
            tax: (await upsertAccount('2111', 'VAT Payable', 'LIABILITY')).id
        },
        inventory: {
            adjustment: (await upsertAccount('5104', 'Inventory Adjustment', 'EXPENSE', expenses.id)).id,
            transfer: (await upsertAccount('1120', 'Inventory', 'ASSET')).id
        },
        automation: {
            customerRoot: (await upsertAccount('1110', 'Accounts Receivable', 'ASSET')).id,
            supplierRoot: (await upsertAccount('2101', 'Accounts Payable', 'LIABILITY')).id,
            payrollRoot: (await upsertAccount('2121', 'Salaries Payable', 'LIABILITY')).id
        },
        fixedAssets: {
            depreciationExpense: (await upsertAccount('6303', 'Depreciation & Amortization Expense', 'EXPENSE', opEx.id)).id,
            accumulatedDepreciation: (await upsertAccount('1210', 'Accumulated Depreciation (CONTRA-ASSET)', 'ASSET', assets.id)).id
        }
    }

    await prisma.systemSettings.upsert({
        where: { key: 'finance_posting_rules' },
        update: { value: JSON.stringify(postingRules) },
        create: { key: 'finance_posting_rules', value: JSON.stringify(postingRules) }
    })
    console.log('⚙️ Posting Rules (Auto-Mapping) Initialized')

    // 9. Seed Sample Product for Valuation Tests
    const testPiece = await prisma.unit.findUnique({ where: { code: 'PC' } })
    await prisma.product.upsert({
        where: { sku: 'TEST-PROD-01' },
        update: { unitId: testPiece?.id },
        create: {
            sku: 'TEST-PROD-01',
            name: 'Sample Product (IFRS Test)',
            unitId: testPiece?.id,
            costPrice: 0,
            basePrice: 50,
            taxRate: 0.11,
            isTaxIncluded: true,
            status: 'ACTIVE'
        }
    });
    console.log('✅ Sample Product Seeded');
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
