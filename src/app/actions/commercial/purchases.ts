'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// --- Validation Schemas ---
const lineItemSchema = z.object({
    productId: z.coerce.number().min(1),
    quantity: z.coerce.number().min(1),
    unitCostHT: z.coerce.number().min(0),
    unitCostTTC: z.coerce.number().min(0),
    sellingPriceHT: z.coerce.number().optional(),
    sellingPriceTTC: z.coerce.number().optional(),
    taxRate: z.coerce.number().min(0),
    expiryDate: z.string().optional(),
});

const purchaseSchema = z.object({
    supplierId: z.coerce.number().min(1),
    warehouseId: z.coerce.number().min(1),
    siteId: z.coerce.number().min(1),
    scope: z.enum(['OFFICIAL', 'INTERNAL']),
    invoicePriceType: z.enum(['HT', 'TTC']).default('HT'),
    vatRecoverable: z.coerce.boolean().default(true),
    refCode: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(lineItemSchema).min(1),
});

export type PurchaseFormState = {
    message?: string;
    errors?: Record<string, string[]>;
};

export async function createPurchaseInvoice(prevState: PurchaseFormState, formData: FormData): Promise<PurchaseFormState> {
    // 1. Extract & Parse Complex FormData
    const rawLines: any[] = [];

    for (const [key, value] of Array.from(formData.entries())) {
        const match = key.match(/^lines\[(\d+)\]\[(\w+)\]$/);
        if (match) {
            const index = parseInt(match[1]);
            const field = match[2];
            if (!rawLines[index]) rawLines[index] = {};
            rawLines[index][field] = value;
        }
    }

    const rawData = {
        supplierId: formData.get('supplierId'),
        warehouseId: formData.get('warehouseId'),
        siteId: formData.get('siteId'),
        scope: formData.get('scope'),
        invoicePriceType: formData.get('invoicePriceType'),
        vatRecoverable: formData.get('vatRecoverable') === 'true',
        refCode: formData.get('refCode'),
        notes: formData.get('notes'),
        lines: rawLines.filter(l => l && l.productId)
    };

    const validated = purchaseSchema.safeParse(rawData);

    if (!validated.success) {
        return {
            errors: validated.error.flatten().fieldErrors,
            message: "Some fields are missing or invalid."
        };
    }

    const { data } = validated;

    try {
        await erpFetch('purchases/quick_purchase/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e: any) {
        console.error("Purchase Creation Error:", e);
        return { message: e.message || "Critical Error: Could not process purchase replenishment." };
    }

    revalidatePath('/admin/purchases');
    redirect('/admin/purchases');
}
