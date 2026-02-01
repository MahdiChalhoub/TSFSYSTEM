'use server'

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const updateSchema = z.object({
    id: z.number(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    nextNumber: z.number().min(1),
    padding: z.number().min(1).max(20)
})

export async function getTransactionSequences() {
    // Ensure default types exist
    const defaultTypes = ['INVOICE', 'BILL', 'LOAN', 'JOURNAL', 'PAYMENT', 'RECEIPT']

    for (const type of defaultTypes) {
        const exists = await (prisma as any).transactionSequence.findUnique({ where: { type } })
        if (!exists) {
            await (prisma as any).transactionSequence.create({
                data: {
                    type,
                    prefix: type.substring(0, 3) + "-",
                    nextNumber: 1
                }
            })
        }
    }

    return await (prisma as any).transactionSequence.findMany({
        orderBy: { type: 'asc' }
    })
}

export async function updateTransactionSequence(data: {
    id: number,
    prefix?: string,
    suffix?: string,
    nextNumber: number,
    padding: number
}) {
    try {
        const validated = updateSchema.parse(data)

        await (prisma as any).transactionSequence.update({
            where: { id: validated.id },
            data: {
                prefix: validated.prefix,
                suffix: validated.suffix,
                nextNumber: validated.nextNumber,
                padding: validated.padding
            }
        })

        revalidatePath('/admin/settings/sequences')
        return { success: true }
    } catch (error) {
        console.error("Failed to update sequence", error)
        return { success: false, error: "Failed to update sequence" }
    }
}
