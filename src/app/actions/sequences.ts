'use server'

import { erpFetch } from "@/lib/erp-api"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const updateSchema = z.object({
    id: z.number(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    next_number: z.number().min(1), // Snake case from Django
    padding: z.number().min(1).max(20)
})

export async function getTransactionSequences() {
    // Django backend should handle initialization in Service or View
    const sequences = await erpFetch('sequences/')
    return sequences
}

export async function updateTransactionSequence(data: {
    id: number,
    prefix?: string,
    suffix?: string,
    nextNumber: number,
    padding: number
}) {
    try {
        // Map camelCase to snake_case for Django
        const payload = {
            prefix: data.prefix,
            suffix: data.suffix,
            next_number: data.nextNumber,
            padding: data.padding
        }

        await erpFetch(`sequences/${data.id}/`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        })

        revalidatePath('/settings/sequences')
        return { success: true }
    } catch (error) {
        console.error("Failed to update sequence", error)
        return { success: false, error: "Failed to update sequence" }
    }
}
