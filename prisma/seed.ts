
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // 1. Create Default Admin User
    const adminEmail = 'admin@tsfci.com'
    const admin = await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            name: 'Admin User',
            password: 'hashed_password_123', // In real app, hash this!
            role: 'OWNER',
            isActive: true,
        },
    })
    console.log(`👤 Admin user: ${admin.email}`)

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
            await prisma.warehouse.create({ data: w })
        }
        console.log(`🏭 Seeded ${warehouses.length} warehouses`)
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
            await prisma.financialAccount.create({ data: account })
        }
        console.log(`💰 Seeded ${accounts.length} financial accounts`)
    }

    console.log('✅ Seed complete!')
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
