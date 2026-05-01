/**
 * Database client stub.
 * The actual Prisma client should be initialized here via:
 * import { PrismaClient } from '@prisma/client'
 * 
 * This stub is provided to prevent TypeScript import errors while
 * the database configuration is being set up.
 */

/**
 * Stub transaction context — the real Prisma `tx` exposes generated model
 * delegates (`tx.transactionSequence.findUnique(...)` etc.). The stub keeps
 * an `unknown` shape and consumers narrow at the call site.
 */
export type PrismaTx = Record<string, unknown>;

/**
 * Loose shape — the real Prisma client exposes many auto-generated model
 * delegates (`prisma.product.findMany`, etc.). Until the real client is wired
 * up, the stub permits any property. Each downstream consumer is responsible
 * for typing the specific delegate it touches (see `sequences.ts` for the
 * pattern).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StubPrismaClient = {
    $transaction: <T>(fn: (tx: PrismaTx) => Promise<T>) => Promise<T>;
    $disconnect: () => Promise<void>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

// Stub Prisma client - replace with actual Prisma setup
const prisma: StubPrismaClient = {
    $transaction: async <T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> => {
        return fn({});
    },
    $disconnect: async (): Promise<void> => { },
};

export { prisma };
export default prisma;
