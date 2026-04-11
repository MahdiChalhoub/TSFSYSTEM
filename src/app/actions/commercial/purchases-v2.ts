'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export type PurchaseFormState = {
    message?: string;
    errors?: Record<string, string[]>;
};

export async function createFormalPurchaseOrderV2(prevState: PurchaseFormState, formData: FormData): Promise<PurchaseFormState> {
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

    const payload = {
        supplier: Number(formData.get('supplierId')),
        site: Number(formData.get('siteId')),
        warehouse: Number(formData.get('warehouseId')),
        purchase_sub_type: formData.get('purchaseSubType') || 'STANDARD',
        priority: formData.get('priority') || 'NORMAL',
        supplier_ref: formData.get('supplierRef') || '',
        expected_date: formData.get('expectedDate') || null,
        currency: formData.get('currency') || 'XOF',
        shipping_cost: Number(formData.get('shippingCost') || 0),
        discount_amount: Number(formData.get('discountAmount') || 0),
        notes: formData.get('notes') || '',
        internal_notes: formData.get('internalNotes') || '',
        payment_term: Number(formData.get('paymentTermId')) || null,
        assigned_driver: Number(formData.get('driverId')) || null,
        invoice_policy: formData.get('invoicePolicy') || 'RECEIVED_QTY',
        status: 'DRAFT',
        lines: rawLines.filter(l => l && l.productId).map(l => ({
            product: Number(l.productId),
            quantity: Number(l.quantity),
            unit_price: Number(l.unitPrice)
        }))
    };

    try {
        await erpFetch('purchase-orders/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e: unknown) {
        console.error("Formal PO V2 Error:", e);
        return { message: (e instanceof Error ? e.message : String(e)) || "Failed to create Purchase Order." };
    }

    revalidatePath('/purchases');
    revalidatePath('/purchases/purchase-orders');
    redirect('/purchases/purchase-orders');
}
