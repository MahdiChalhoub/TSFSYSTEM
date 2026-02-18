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
    const rawLines: Record<string, any>[] = [];

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
        await erpFetch('purchase/quick_purchase/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e: unknown) {
        console.error("Purchase Creation Error:", e);
        return { message: (e instanceof Error ? e.message : String(e)) || "Critical Error: Could not process purchase replenishment." };
    }

    revalidatePath('/purchases');
    redirect('/purchases');
}

export async function authorizePurchaseOrder(id: string) {
    try {
        await erpFetch(`purchase/${id}/authorize/`, { method: 'POST' });
        revalidatePath(`/purchases/${id}`);
    } catch (e) {
        console.error("Authorize PO Error:", e);
    }
}

export async function receivePurchaseOrder(id: string, formData: FormData) {
    const warehouseId = formData.get('warehouseId');
    try {
        await erpFetch(`purchase/${id}/receive/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ warehouseId })
        });
        revalidatePath(`/purchases/${id}`);
    } catch (e) {
        console.error("Receive PO Error:", e);
    }
}

export async function invoicePurchaseOrder(id: string, formData: FormData) {
    const invoiceNumber = formData.get('invoiceNumber');
    try {
        await erpFetch(`purchase/${id}/invoice/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceNumber })
        });
        revalidatePath(`/purchases/${id}`);
    } catch (e) {
        console.error("Invoice PO Error:", e);
    }
}

export async function createFormalPurchaseOrder(prevState: PurchaseFormState, formData: FormData): Promise<PurchaseFormState> {
    const rawLines: Record<string, any>[] = [];
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
        siteId: formData.get('siteId'),
        warehouseId: formData.get('warehouseId'),
        scope: formData.get('scope'),
        notes: formData.get('notes'),
        refCode: formData.get('refCode'),
        lines: rawLines.filter(l => l && l.productId).map(l => ({
            productId: Number(l.productId),
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice)
        }))
    };

    try {
        await erpFetch('purchase/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rawData)
        });
    } catch (e: unknown) {
        console.error("Formal PO Error:", e);
        return { message: (e instanceof Error ? e.message : String(e)) || "Failed to create Request for Quotation." };
    }

    revalidatePath('/purchases');
    redirect('/purchases');
}