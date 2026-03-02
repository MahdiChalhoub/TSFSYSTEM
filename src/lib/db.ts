/**
 * Database client stub.
 * The actual Prisma client should be initialized here via:
 * import { PrismaClient } from '@prisma/client'
 * 
 * This stub is provided to prevent TypeScript import errors while
 * the database configuration is being set up.
 */

// Stub Prisma client - replace with actual Prisma setup
const prisma = {
    $transaction: async (fn: (tx: any) => Promise<any>) => {
        return fn({} as any);
    },
    $disconnect: async () => { },
} as any;

export { prisma };
export default prisma;
