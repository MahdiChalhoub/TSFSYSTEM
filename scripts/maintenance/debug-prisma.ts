import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    console.log('--- Prisma Models Debug ---')
    const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'))
    console.log('Available Models:', models.join(', '))

    if (models.includes('site')) {
        console.log('✅ site model found')
    } else {
        console.log('❌ site model MISSING')
    }

    if (models.includes('contact')) {
        console.log('✅ contact model found')
    } else {
        console.log('❌ contact model MISSING')
    }
}

main().catch(console.error).finally(() => prisma.$disconnect())
