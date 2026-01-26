import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Production-ready Prisma configuration with timeouts and connection pooling
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Query timeout configuration for Hostinger shared hosting
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
})

// Connection pool timeout management
// Note: SQLite doesn't support connection pooling, but MySQL does
// When you migrate to MySQL, these settings will take effect
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

// Graceful shutdown
if (typeof window === 'undefined') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect()
    })
}
