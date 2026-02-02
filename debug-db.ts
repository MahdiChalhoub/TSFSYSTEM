import { prisma } from "./src/lib/db"

async function main() {
    try {
        const count = await (prisma.organization as any).count()
        console.log(`Total Organizations: ${count}`)
        const orgs = await (prisma.organization as any).findMany()
        console.log("Organizations:", JSON.stringify(orgs, null, 2))
    } catch (error) {
        console.error("Error checking organizations:", error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
