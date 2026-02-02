
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting seed...')

    // 1. Create Warehouses
    const mainWarehouse = await prisma.warehouse.upsert({
        where: { id: 1 },
        update: {},
        create: {
            name: 'Central Warehouse',
            type: 'PHYSICAL'
        }
    })

    const storeShelf = await prisma.warehouse.upsert({
        where: { id: 2 },
        update: {},
        create: {
            name: 'TSF Store Floor',
            type: 'STORE'
        }
    })

    // 2. Create Categories
    const catProduce = await prisma.category.create({
        data: { name: 'Fresh Produce' }
    })

    const catDairy = await prisma.category.create({
        data: { name: 'Dairy & Eggs' }
    })

    // 3. Create Products
    const apple = await prisma.product.create({
        data: {
            sku: 'FRT-001',
            barcode: '930001000',
            name: 'Red Delicious Apple',
            description: 'Fresh crisp apples',
            categoryId: catProduce.id,
            basePrice: 2.99,
            taxRate: 0.11, // 11% Tax
            isTaxIncluded: true,
            minStockLevel: 50
        }
    })

    const milk = await prisma.product.create({
        data: {
            sku: 'DRY-001',
            barcode: '930002000',
            name: 'Full Cream Milk 2L',
            categoryId: catDairy.id,
            basePrice: 3.50,
            taxRate: 0.00, // Exempt
            isExpiryTracked: true,
            minStockLevel: 20
        }
    })

    // 4. Create Supplier
    const supplier = await prisma.contact.create({
        data: {
            type: 'SUPPLIER',
            name: 'Farms United Ltd',
            email: 'orders@farmsunited.com',
            creditLimit: 5000.00
        }
    })

    // 5. Initial Stock (Batch)
    // Incoming Batch of Milk
    const batch1 = await prisma.stockBatch.create({
        data: {
            productId: milk.id,
            batchCode: 'BATCH-JAN-01',
            expiryDate: new Date('2026-02-01'), // Expires soon!
            costPrice: 2.00
        }
    })

    // Add Stock to Warehouse
    await prisma.inventory.create({
        data: {
            warehouseId: mainWarehouse.id,
            productId: milk.id,
            batchId: batch1.id,
            quantity: 100
        }
    })

    console.log('✅ Seed completed!')
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
