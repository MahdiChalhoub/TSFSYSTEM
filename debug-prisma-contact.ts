import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    try {
        const contact = await prisma.contact.findFirst({
            include: { homeSite: true }
        })
        console.log('✅ homeSite inclusion works')
    } catch (e: any) {
        console.log('❌ homeSite inclusion failed:', e.message)
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
