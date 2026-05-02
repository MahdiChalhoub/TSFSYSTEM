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
    // The form posts `lines` as a single JSON-stringified hidden input
    // (see form.tsx: <input name="lines" value={JSON.stringify(lines)} />),
    // not as repeated `lines[i][field]` keys. Parse the JSON envelope —
    // matches updatePurchaseInvoice's contract.
    let rawLines: Record<string, unknown>[] = [];
    const linesRaw = formData.get('lines');
    if (typeof linesRaw === 'string' && linesRaw.length) {
        try {
            const parsed = JSON.parse(linesRaw);
            if (Array.isArray(parsed)) rawLines = parsed as Record<string, unknown>[];
        } catch { /* fall through to []; schema will reject below */ }
    }

    // FormData.get returns null for absent fields, but z.string().optional()
    // only accepts undefined — coerce null → undefined so optional fields
    // don't trip the schema. The form also posts the PO ref as `reference`
    // (legacy name), so accept both.
    const orUndefined = (v: FormDataEntryValue | null) =>
        (typeof v === 'string' && v.length > 0) ? v : undefined;

    const rawData = {
        supplierId: formData.get('supplierId'),
        warehouseId: formData.get('warehouseId'),
        siteId: formData.get('siteId'),
        scope: formData.get('scope'),
        invoicePriceType: orUndefined(formData.get('invoicePriceType')) ?? 'HT',
        vatRecoverable: formData.get('vatRecoverable') !== 'false',
        refCode: orUndefined(formData.get('refCode') ?? formData.get('reference')),
        notes: orUndefined(formData.get('notes')),
        lines: rawLines.filter((l) => l && (l as Record<string, unknown>).productId),
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

/**
 * Update an existing Purchase Order from the same New Order form.
 *
 * Wires the `/purchases/new?edit=<id>` flow into a `useActionState`
 * server action with the same `(prevState, formData)` shape as
 * `createPurchaseInvoice`, so `form.tsx` can swap in/out by mode without
 * restructuring its hooks. Reads the same hidden fields (supplierId,
 * warehouseId, scope, lines, …) and PATCHes the JSON envelope to
 * `purchase-orders/{id}/`.
 *
 * The PO id travels via a hidden `__poId` field — we can't curry it with
 * `bind()` because `useActionState` already supplies prevState/formData.
 */
export async function updatePurchaseInvoice(prevState: PurchaseFormState, formData: FormData): Promise<PurchaseFormState> {
    const id = formData.get('__poId');
    if (!id) {
        return { message: 'Missing PO id for update.' };
    }

    let lines: Record<string, unknown>[] = [];
    const linesRaw = formData.get('lines');
    if (typeof linesRaw === 'string' && linesRaw.length) {
        try {
            const parsed = JSON.parse(linesRaw);
            if (Array.isArray(parsed)) lines = parsed as Record<string, unknown>[];
        } catch { /* fall through to []; backend will reject below */ }
    }

    const rawData = {
        supplierId: formData.get('supplierId'),
        warehouseId: formData.get('warehouseId'),
        siteId: formData.get('siteId'),
        scope: formData.get('scope'),
        refCode: formData.get('reference') || formData.get('refCode'),
        supplierRef: formData.get('supplierRef'),
        orderDate: formData.get('orderDate'),
        expectedDelivery: formData.get('expectedDelivery'),
        notes: formData.get('notes'),
        lines: lines.filter((l) => l && (l as Record<string, unknown>).productId),
    };

    const validated = purchaseSchema.safeParse({
        ...rawData,
        invoicePriceType: 'HT' as const,
        vatRecoverable: true,
    });

    if (!validated.success) {
        return {
            errors: validated.error.flatten().fieldErrors,
            message: 'Some fields are missing or invalid.',
        };
    }

    try {
        await erpFetch(`purchase-orders/${String(id)}/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(validated.data),
        });
    } catch (e: unknown) {
        console.error('Purchase Update Error:', e);
        return { message: (e instanceof Error ? e.message : String(e)) || 'Could not save changes to this Purchase Order.' };
    }

    revalidatePath('/purchases');
    revalidatePath(`/purchases/${String(id)}`);
    redirect(`/purchases/${String(id)}`);
}

export async function getProcurementIntelligence() {
    try {
        const [dashboard, trend, recent, suppliers] = await Promise.all([
            erpFetch('analytics/procurement/dashboard/'),
            erpFetch('analytics/procurement/monthly-trend/'),
            erpFetch('purchase-orders/?limit=10'),
            erpFetch('analytics/procurement/spend-by-supplier/?top=5'),
        ]);

        return {
            dashboard,
            trend: trend?.trend || [],
            recent: Array.isArray(recent) ? recent : (recent?.results || []),
            suppliers: suppliers?.suppliers || [],
        };
    } catch (e) {
        console.error("Failed to fetch procurement intelligence:", e);
        return {
            dashboard: null,
            trend: [],
            recent: [],
            suppliers: [],
        };
    }
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

/**
 * Transition a PurchaseOrder through its lifecycle state machine.
 *
 * Calls `purchase-orders/{id}/transition/` which routes through the
 * model's `VALID_TRANSITIONS` map and fires per-stage side-effects
 * (timestamps, actor fields, number promotion).
 *
 * Returns `{ status }` on success or `{ error, current_status }` on
 * failure (invalid transition or backend validation error).
 */
export async function transitionPurchaseOrderStatus(
    poId: number | string,
    toStatus: string,
    reason?: string,
): Promise<{ status?: string; error?: string; current_status?: string }> {
    try {
        const body: Record<string, string> = { to: toStatus }
        if (reason) body.reason = reason

        const result = await erpFetch(`purchase-orders/${String(poId)}/transition/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        revalidatePath('/purchases')
        revalidatePath(`/purchases/${String(poId)}`)

        const data = result as Record<string, unknown>
        return { status: (data?.status as string) || toStatus }
    } catch (e: unknown) {
        console.error('PO Transition Error:', e)
        const msg = e instanceof Error ? e.message : String(e)
        return { error: msg || 'Failed to transition PO status.' }
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