import { PrismaClient } from '../generated/client'

const globalForPrisma = globalThis as unknown as {
    prismaMain: PrismaClient | undefined
}

// Get DATABASE_URL with fallback for build time
const getDatabaseUrl = () => {
    // During build, use a dummy URL if DATABASE_URL is not set
    // This prevents build errors on Hostinger
    if (!process.env.DATABASE_URL) {
        console.warn('[Prisma] DATABASE_URL not found, using fallback for build');
        return 'file:./dev.db';
    }
    return process.env.DATABASE_URL;
};

export const prisma =
    globalForPrisma.prismaMain ||
    new PrismaClient({
        log: ['query', 'error', 'warn'],
        // Query timeout configuration for Hostinger shared hosting
        datasources: {
            db: {
                url: getDatabaseUrl(),
            },
        },
    })

// Connection pool timeout management
// Note: SQLite doesn't support connection pooling, but MySQL does
// When you migrate to MySQL, these settings will take effect
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prismaMain = prisma
}

// Graceful shutdown
if (typeof window === 'undefined') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect()
    })
}
