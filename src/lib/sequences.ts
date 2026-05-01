import { prisma, type PrismaTx } from "@/lib/db"

/** Loose shape for a TransactionSequence row (mirrors Prisma model fields). */
type TransactionSequenceRow = {
    id: number;
    type: string;
    prefix?: string | null;
    suffix?: string | null;
    nextNumber: number;
    padding: number;
};

/** Loose shape of the Prisma `tx.transactionSequence` delegate methods we use. */
type SequenceDelegate = {
    findUnique: (args: { where: { type: string } }) => Promise<TransactionSequenceRow | null>;
    create: (args: { data: Omit<TransactionSequenceRow, 'id'> }) => Promise<TransactionSequenceRow>;
    update: (args: { where: { id: number }; data: { nextNumber: number } }) => Promise<TransactionSequenceRow>;
};

/**
 * Generates the next transaction number for a given type.
 * Automatically increments the sequence in the database.
 *
 * @param type The transaction type (e.g., 'INVOICE', 'LOAN')
 * @returns The formatted transaction number (e.g., "INV-00001/24")
 */
export async function generateTransactionNumber(type: string) {
    // We use a transaction to ensure we lock the sequence row and increment atomically
    return await prisma.$transaction(async (tx: PrismaTx) => {
        const seqDelegate = (tx as { transactionSequence: SequenceDelegate }).transactionSequence;

        // 1. Fetch current sequence
        let seq = await seqDelegate.findUnique({ where: { type } })

        // 2. Auto-initialize if not exists for this type
        if (!seq) {
            seq = await seqDelegate.create({
                data: {
                    type,
                    prefix: type.substring(0, 3).toUpperCase() + "-", // Default prefix e.g. "INV-"
                    nextNumber: 1,
                    padding: 5,
                }
            })
        }

        // 3. Format the current number
        const numberString = seq.nextNumber.toString().padStart(seq.padding, '0')
        const formatted = `${seq.prefix || ''}${numberString}${seq.suffix || ''}`

        // 4. Increment for the next usage
        await seqDelegate.update({
            where: { id: seq.id },
            data: { nextNumber: seq.nextNumber + 1 }
        })

        return formatted
    })
}