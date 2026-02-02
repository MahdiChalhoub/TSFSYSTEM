import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🚀 Initializing Multi-Site Migration...')

    let mainSite = await prisma.site.findFirst({
        where: { OR: [{ name: 'Main Store' }, { code: 'MAIN' }] }
    })

    if (!mainSite) {
        mainSite = await prisma.site.create({
            data: {
                name: 'Main Store',
                code: 'MAIN',
                isActive: true
            }
        })
        console.log('✅ Created Main Store Site')
    }

    const siteId = mainSite.id
    console.log(`📍 Using Site ID: ${siteId}`)

    const w = await prisma.warehouse.updateMany({ where: { siteId: null }, data: { siteId } })
    const u = await prisma.user.updateMany({ where: { homeSiteId: null }, data: { homeSiteId: siteId } })
    const o = await prisma.order.updateMany({ where: { siteId: null }, data: { siteId } })
    const t = await prisma.transaction.updateMany({ where: { siteId: null }, data: { siteId } })
    const j = await prisma.journalEntry.updateMany({ where: { siteId: null }, data: { siteId } })
    const f = await prisma.financialAccount.updateMany({ where: { siteId: null }, data: { siteId } })

    console.log(`📊 Migration complete:`)
    console.log(`   - Warehouses: ${w.count}`)
    console.log(`   - Users: ${u.count}`)
    console.log(`   - Orders: ${o.count}`)
    console.log(`   - Transactions: ${t.count}`)
    console.log(`   - Journal Entries: ${j.count}`)
    console.log(`   - Financial Accounts: ${f.count}`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
