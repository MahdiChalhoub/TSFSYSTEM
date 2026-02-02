'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

/**
 * FRESH VERSION: Wipes all operational data but keeps core configuration
 * (Users, Roles, Sites, Fiscal Years, Chart of Accounts structure, Settings)
 */
export async function wipeAllOperationalData() {
    return await prisma.$transaction(async (tx) => {
        // Order matters for FK constraints

        // 1. Commercial & Finance Transactions
        await tx.journalEntryLine.deleteMany({})
        await tx.journalEntry.deleteMany({})
        await tx.orderLine.deleteMany({})
        await tx.order.deleteMany({})
        await tx.transaction.deleteMany({})
        await tx.financialEvent.deleteMany({})

        // 2. Loans
        await tx.loanInstallment.deleteMany({})
        await tx.loan.deleteMany({})

        // 3. Inventory
        await tx.inventory.deleteMany({})
        await tx.stockBatch.deleteMany({})
        await tx.inventoryLevel.deleteMany({})

        // 4. Products & Catalogs
        await tx.productImage.deleteMany({})
        await tx.pricingRule.deleteMany({})
        await tx.priceList.deleteMany({})
        await tx.product.deleteMany({})
        await tx.productGroup.deleteMany({})
        await tx.category.deleteMany({})
        await tx.brand.deleteMany({})
        await tx.parfum.deleteMany({})

        // 5. CRM & HR
        await tx.employee.deleteMany({})
        await tx.contact.deleteMany({})
        await tx.financialAccount.deleteMany({})

        // 6. System Logs & Tasks
        await tx.task.deleteMany({})
        await tx.auditLog.deleteMany({})

        // 7. Reset Balances in Chart of Accounts
        await tx.chartOfAccount.updateMany({
            data: { balance: 0, balanceOfficial: 0 } as any
        })

        // 8. Reset Sequences
        await tx.transactionSequence.updateMany({
            data: { nextNumber: 1 }
        })
    }, { timeout: 30000 })
}

/**
 * SEED DATA: Fills the database with realistic test data
 */
export async function seedTestData() {
    return await prisma.$transaction(async (tx) => {
        // 0. Core Dimensions for Linkage
        const site = await tx.site.findFirst() || await tx.site.create({
            data: { name: 'Main Branch', code: 'MAIN' }
        })

        // Ensure Cash/Bank Roots exist in COA
        const assetRoot = await tx.chartOfAccount.findFirst({ where: { code: '1000' } })

        const cashAccount = await tx.chartOfAccount.upsert({
            where: { code: '5701' },
            update: {},
            create: {
                code: '5701',
                name: 'Main Cash Drawer Ledger',
                type: 'ASSET',
                subType: 'CASH',
                parentId: assetRoot?.id
            }
        })

        const bankAccount = await tx.chartOfAccount.upsert({
            where: { code: '5121' },
            update: {},
            create: {
                code: '5121',
                name: 'Main Bank Ledger',
                type: 'ASSET',
                subType: 'BANK',
                parentId: assetRoot?.id
            }
        })

        // 1. Financial Accounts (Drawers) LINKED to COA
        await tx.financialAccount.create({
            data: {
                name: 'Main Cash Drawer',
                type: 'CASH',
                currency: 'USD',
                siteId: site.id,
                ledgerAccount: { connect: { id: cashAccount.id } }
            } as any
        })

        await tx.financialAccount.create({
            data: {
                name: 'Petty Cash (LBP)',
                type: 'CASH',
                currency: 'LBP',
                siteId: site.id,
                ledgerAccount: { connect: { id: cashAccount.id } } // Linked to same root for simplicity in tests
            } as any
        })

        await tx.financialAccount.create({
            data: {
                name: 'Company Bank Account',
                type: 'BANK',
                currency: 'USD',
                siteId: site.id,
                ledgerAccount: { connect: { id: bankAccount.id } }
            } as any
        })

        // 2. Countries
        const countries = [
            { name: 'France', code: 'FR' },
            { name: 'United States', code: 'US' },
            { name: 'Ivory Coast', code: 'CI' },
            { name: 'Turkey', code: 'TR' }
        ]
        const createdCountries: Record<string, any> = {}
        for (const c of countries) {
            createdCountries[c.code] = await tx.country.upsert({
                where: { code: c.code },
                update: {},
                create: c
            })
        }

        // 2. Categories with Hierarchy
        const food = await tx.category.create({ data: { name: 'Food', code: 'FOOD' } })
        const beverages = await tx.category.create({ data: { name: 'Beverages', code: 'BEV', parentId: food.id } })
        const snacks = await tx.category.create({ data: { name: 'Snacks', code: 'SNC', parentId: food.id } })
        const dairy = await tx.category.create({ data: { name: 'Dairy & Eggs', code: 'DAI', parentId: food.id } })

        // 3. Brands linked to Countries and Categories
        const brandCoca = await tx.brand.create({
            data: {
                name: 'Coca-Cola',
                countries: { connect: [{ id: createdCountries['US'].id }, { id: createdCountries['CI'].id }] },
                categories: { connect: [{ id: beverages.id }] }
            }
        })
        const brandNestle = await tx.brand.create({
            data: {
                name: 'Nestlé',
                countries: { connect: [{ id: createdCountries['FR'].id }, { id: createdCountries['CI'].id }] },
                categories: { connect: [{ id: dairy.id }, { id: snacks.id }] }
            }
        })
        const brandPringles = await tx.brand.create({
            data: {
                name: 'Pringles',
                countries: { connect: [{ id: createdCountries['US'].id }] },
                categories: { connect: [{ id: snacks.id }] }
            }
        })

        // 4. Attributes (Parfums) linked to Categories
        const attrOriginal = await tx.parfum.create({
            data: {
                name: 'Original',
                shortName: 'ORG',
                categories: { connect: [{ id: beverages.id }, { id: snacks.id }] }
            }
        })
        const attrVanilla = await tx.parfum.create({
            data: {
                name: 'Vanilla',
                shortName: 'VAN',
                categories: { connect: [{ id: dairy.id }, { id: snacks.id }] }
            }
        })
        const attrStrawberry = await tx.parfum.create({
            data: {
                name: 'Strawberry',
                shortName: 'STR',
                categories: { connect: [{ id: dairy.id }] }
            }
        })

        // 5. Units
        const unitPc = await tx.unit.upsert({
            where: { code: 'PC' },
            update: {},
            create: { code: 'PC', name: 'Piece' }
        })

        // 6. Contacts
        const supplier = await tx.contact.create({
            data: {
                type: 'SUPPLIER',
                name: 'Global Foods Distribution',
                email: 'contact@globalfoods.com',
                phone: '+123456789'
            }
        })

        const customer = await tx.contact.create({
            data: {
                type: 'CUSTOMER',
                name: 'Walk-in Customer',
                email: 'customer@test.com'
            }
        })

        // 7. Products with Full Linkage
        const products = [
            {
                sku: 'BEV-001', name: 'Coca Cola 330ml Classic',
                catId: beverages.id, brandId: brandCoca.id, countryId: createdCountries['CI'].id,
                parfumId: attrOriginal.id, cost: 0.40, selling: 0.75, barcode: '613000000001'
            },
            {
                sku: 'SNC-001', name: 'Pringles Original Large',
                catId: snacks.id, brandId: brandPringles.id, countryId: createdCountries['US'].id,
                parfumId: attrOriginal.id, cost: 1.50, selling: 2.50, barcode: '613000000003'
            },
            {
                sku: 'DAI-001', name: 'Nestle Yogurt Strawberry',
                catId: dairy.id, brandId: brandNestle.id, countryId: createdCountries['FR'].id,
                parfumId: attrStrawberry.id, cost: 0.80, selling: 1.20, barcode: '613000000004'
            },
            {
                sku: 'SNC-002', name: 'Nestle KitKat Vanilla',
                catId: snacks.id, brandId: brandNestle.id, countryId: createdCountries['TR'].id,
                parfumId: attrVanilla.id, cost: 0.50, selling: 1.00, barcode: '613000000006'
            },
        ]

        for (const p of products) {
            await tx.product.create({
                data: {
                    sku: p.sku,
                    barcode: p.barcode,
                    name: p.name,
                    categoryId: p.catId,
                    brandId: p.brandId,
                    countryId: p.countryId,
                    parfumId: p.parfumId,
                    unitId: unitPc.id,
                    basePrice: p.selling,
                    costPrice: p.cost,
                    costPriceHT: p.cost,
                    sellingPriceTTC: p.selling,
                    tvaRate: 0.11,
                    status: 'ACTIVE',
                    supplierId: supplier.id
                }
            })
        }

        // 8. Initial Stock
        const warehouse = await tx.warehouse.findFirst()
        if (warehouse) {
            const allProducts = await tx.product.findMany()
            for (const p of allProducts) {
                await tx.inventory.create({
                    data: {
                        warehouseId: warehouse.id,
                        productId: p.id,
                        quantity: 100
                    }
                })
            }
        }

    }, { timeout: 60000 })
}
