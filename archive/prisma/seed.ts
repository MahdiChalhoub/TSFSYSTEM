
import { PrismaClient } from '../src/generated/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed (SaaS Mode)...')

    // 0. Seed Default Organization
    const organization = await (prisma as any).organization.upsert({
        where: { slug: 'tsf-global' },
        update: {},
        create: {
            name: 'TSF Global',
            slug: 'tsf-global',
            isActive: true
        }
    })
    console.log(`🏢 Seeded Organization: ${organization.name}`)

    const orgId = organization.id

    // 1. Seed Roles
    const roles = [
        { name: 'ADMIN', description: 'Total System Control' },
        { name: 'MANAGER', description: 'Branch & Stock Management' },
        { name: 'CASHIER', description: 'POS & Basic Sales' },
    ]
    for (const r of roles) {
        // @ts-ignore
        await (prisma as any).role.upsert({
            where: { name_organizationId: { name: r.name, organizationId: orgId } },
            update: { description: r.description },
            create: { ...r, organizationId: orgId }
        })
    }
    // @ts-ignore
    const adminRole = await (prisma as any).role.findUnique({
        where: { name_organizationId: { name: 'ADMIN', organizationId: orgId } }
    })

    // 2. Seed Sites (The Enterprise Roots)
    // @ts-ignore
    const hqSite = await (prisma as any).site.upsert({
        where: { code_organizationId: { code: 'HQ-BEIRUT', organizationId: orgId } },
        update: {},
        create: {
            name: 'HQ - Beirut Central',
            code: 'HQ-BEIRUT',
            address: 'Downtown, Beirut',
            phone: '+961 1 000 000',
            isActive: true,
            organizationId: orgId
        }
    })
    console.log(`📍 Seeded Primary Site: ${hqSite.name}`)

    // 2. Create Default Admin User
    const adminEmail = 'admin@tsfci.com'
    // @ts-ignore
    await (prisma as any).user.upsert({
        where: { email: adminEmail },
        update: {
            role: adminRole ? { connect: { id: adminRole.id } } : undefined,
            homeSite: hqSite ? { connect: { id: hqSite.id } } : undefined,
            organizationId: orgId
        },
        create: {
            email: adminEmail,
            name: 'Admin User',
            password: 'hashed_password_123',
            role: adminRole ? { connect: { id: adminRole.id } } : undefined,
            homeSite: hqSite ? { connect: { id: hqSite.id } } : undefined,
            isActive: true,
            organizationId: orgId
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
        await (prisma as any).country.upsert({
            where: { code_organizationId: { code: c.code, organizationId: orgId } },
            update: {},
            create: { ...c, organizationId: orgId },
        })
    }
    console.log(`🌍 Seeded ${countries.length} countries`)

    // 3. Seed Units
    // 3. Seed Units (Hierarchical)
    // First, ensure Base Unit exists
    const piece = await (prisma as any).unit.upsert({
        where: { code_organizationId: { code: 'PC', organizationId: orgId } },
        update: {},
        create: { code: 'PC', name: 'Piece', conversionFactor: 1, organizationId: orgId },
    })

    // Level 1: Weight based
    await (prisma as any).unit.upsert({
        where: { code_organizationId: { code: 'KG', organizationId: orgId } },
        update: {},
        create: { code: 'KG', name: 'Kilogram', conversionFactor: 1, organizationId: orgId },
    })

    // Level 2: Derived Units (Pack = 6 Pieces)
    await (prisma as any).unit.upsert({
        where: { code_organizationId: { code: 'PACK', organizationId: orgId } },
        update: { baseUnitId: piece.id, conversionFactor: 6 },
        create: { code: 'PACK', name: 'Pack', baseUnitId: piece.id, conversionFactor: 6, organizationId: orgId },
    })

    // Level 2: Derived Units (Box = 12 Pieces)
    await (prisma as any).unit.upsert({
        where: { code_organizationId: { code: 'BOX', organizationId: orgId } },
        update: { baseUnitId: piece.id, conversionFactor: 12 },
        create: { code: 'BOX', name: 'Box', baseUnitId: piece.id, conversionFactor: 12, organizationId: orgId },
    })

    // Liquid
    await (prisma as any).unit.upsert({
        where: { code_organizationId: { code: 'LITER', organizationId: orgId } },
        update: {},
        create: { code: 'LITER', name: 'Liter', conversionFactor: 1, organizationId: orgId },
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
            await (prisma as any).warehouse.create({
                data: { ...w, site: { connect: { id: hqSite.id } }, organizationId: orgId }
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
            await (prisma as any).financialAccount.create({
                data: { ...account, site: { connect: { id: hqSite.id } }, organizationId: orgId }
            })
        }
        console.log(`💰 Seeded ${accounts.length} financial accounts for site ${hqSite.name}`)
    }


    console.log('✅ Financial Accounts Seeded')

    // 6. Seed Financial Settings (Default)
    const settings = await prisma.financialSettings.findFirst()
    if (!settings) {
        await (prisma as any).financialSettings.create({
            data: {
                companyType: 'MIXED',
                currency: 'USD',
                defaultTaxRate: 0.11,
                worksInTTC: true,
                allowHTEntryForTTC: false,
                dualView: true,
                organizationId: orgId
            }
        })
        console.log('⚙️ Default Financial Settings Created')
    }

    const fy2026 = await (prisma as any).fiscalYear.upsert({
        where: { id: 1 }, // ID is still globally unique in SQLite autoincrement
        update: {},
        create: {
            id: 1,
            name: 'FY 2026',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            status: 'OPEN',
            organizationId: orgId
        }
    })
    console.log('📅 Fiscal Year FY 2026 Created')

    // 8. Seed Chart of Accounts (Standard Simplified)
    // Assets (1000), Liabilities (2000), Equity (3000), Revenue (4000), Expenses (5000)

    // Helper to create account if missing
    const upsertAccount = async (code: string, name: string, type: string, parentId?: number, subType?: string) => {
        const acc = await (prisma as any).chartOfAccount.upsert({
            where: { code_organizationId: { code, organizationId: orgId } },
            update: { subType },
            create: { code, name, type, parentId, subType, organizationId: orgId }
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

    await (prisma as any).systemSettings.upsert({
        where: { key_organizationId: { key: 'finance_posting_rules', organizationId: orgId } },
        update: { value: JSON.stringify(postingRules) },
        create: { key: 'finance_posting_rules', value: JSON.stringify(postingRules), organizationId: orgId }
    })
    console.log('⚙️ Posting Rules (Auto-Mapping) Initialized')

    // 9. Seed Sample Product for Valuation Tests
    const testPiece = await (prisma as any).unit.findUnique({
        where: { code_organizationId: { code: 'PC', organizationId: orgId } }
    })
    await (prisma as any).product.upsert({
        where: { sku_organizationId: { sku: 'TEST-PROD-01', organizationId: orgId } },
        update: { unitId: testPiece?.id },
        create: {
            sku: 'TEST-PROD-01',
            name: 'Sample Product (IFRS Test)',
            unitId: testPiece?.id,
            costPrice: 0,
            basePrice: 50,
            taxRate: 0.11,
            isTaxIncluded: true,
            status: 'ACTIVE',
            organizationId: orgId
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
