'use server';

import { erpFetch, ErpApiError } from "@/lib/erp-api";
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
 * Create a TRUE Purchase Order — DRAFT-state commitment, no GL impact.
 *
 * Hits POST `/api/purchase-orders/` (PurchaseOrderViewSet) which writes
 * a `PurchaseOrder` row + `PurchaseOrderLine` rows and stops there. No
 * journal voucher, no inventory movement, no AP entry — that's all
 * deferred to the Receive (GRN) and Match-Invoice steps later in the
 * lifecycle (DRAFT → SUBMITTED → APPROVED → ORDERED → RECEIVED →
 * INVOICED → COMPLETED).
 *
 * Use this for /purchases/new. The legacy `createPurchaseInvoice` is
 * the "quick purchase" shortcut that fuses PO+GRN+Invoice in one shot
 * — keep it for that workflow, but it is NOT what /purchases/new wants.
 */
export async function createPurchaseOrder(prevState: PurchaseFormState, formData: FormData): Promise<PurchaseFormState> {
    let rawLines: Record<string, unknown>[] = [];
    const linesRaw = formData.get('lines');
    if (typeof linesRaw === 'string' && linesRaw.length) {
        try {
            const parsed = JSON.parse(linesRaw);
            if (Array.isArray(parsed)) rawLines = parsed as Record<string, unknown>[];
        } catch { /* fall through; backend will reject below */ }
    }

    const orUndef = (v: FormDataEntryValue | null) =>
        (typeof v === 'string' && v.length > 0) ? v : undefined;

    // Backend payload — matches PurchaseOrderViewSet.perform_create + the
    // serializer fields. Field names are snake_case to match Django.
    const supplierId = formData.get('supplierId');
    const siteId = formData.get('siteId');
    const warehouseId = formData.get('warehouseId');
    if (!supplierId) return { errors: { supplierId: ['Supplier is required.'] }, message: 'Supplier is required.' };
    if (!warehouseId) return { errors: { warehouseId: ['Warehouse is required.'] }, message: 'Warehouse is required.' };

    // Initial status — the form lets staff pick DRAFT / SUBMITTED /
    // APPROVED on create (plain users get DRAFT only, gated client-side
    // in form.tsx::handleStatusChange). Whitelist here as a defense-in-
    // depth check so a hand-crafted POST can't skip into ORDERED+
    // without going through the Receive / Invoice flows.
    const rawStatus = (orUndef(formData.get('status')) || 'DRAFT').toUpperCase();
    const allowedCreateStatuses = ['DRAFT', 'SUBMITTED', 'APPROVED'];
    const initialStatus = allowedCreateStatuses.includes(rawStatus) ? rawStatus : 'DRAFT';

    const payload = {
        supplier: Number(supplierId),
        site: siteId ? Number(siteId) : null,
        warehouse: Number(warehouseId),
        scope: orUndef(formData.get('scope')) || 'OFFICIAL',
        order_date: orUndef(formData.get('orderDate') ?? formData.get('date')),
        expected_date: orUndef(formData.get('expectedDelivery') ?? formData.get('deliveryDate')),
        supplier_ref: orUndef(formData.get('supplierRef')),
        notes: orUndef(formData.get('notes')),
        status: initialStatus,
        lines: rawLines
            .filter(l => l && (l as any).productId)
            .map(l => {
                const ll = l as any;
                return {
                    product: Number(ll.productId),
                    quantity: Number(ll.quantity || 0),
                    unit_price: Number(ll.unitCostHT ?? ll.unitPrice ?? 0),
                    tax_rate: Number(ll.taxRate ?? 0),
                    discount_percent: Number(ll.discountPercent ?? 0),
                };
            }),
    };

    if (payload.lines.length === 0) {
        return { errors: { lines: ['At least one line item is required.'] }, message: 'No line items.' };
    }

    let saved: Record<string, any> | null = null;
    try {
        saved = await erpFetch('purchase-orders/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (e: unknown) {
        // Only redirect to /login when Django actually rejected the
        // session (401/403). Any other status (400 validation, 500
        // server error, network) should stay on the form so the user
        // sees the real error instead of being kicked out.
        // Stay on the form for ALL errors (including 401/403) — the
        // user just told us the silent redirect-to-login was confusing
        // and looked like a logout. Surface the real reason instead so
        // we can debug whether it's a missing token, missing perm, or
        // a Django validation error.
        if (e instanceof ErpApiError) {
            console.error(`[createPurchaseOrder] HTTP ${e.status}:`, e.message, e.data);
            const fieldErrors: Record<string, string[]> = {};
            const data = e.data as Record<string, unknown> | undefined;
            if (data && typeof data === 'object') {
                for (const [k, v] of Object.entries(data)) {
                    if (Array.isArray(v)) fieldErrors[k] = v.map(String);
                    else if (typeof v === 'string') fieldErrors[k] = [v];
                }
            }
            const prefix = e.status === 401 || e.status === 403
                ? `Auth ${e.status}: `
                : `HTTP ${e.status}: `;
            return {
                errors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
                message: prefix + (e.message || 'Failed to create purchase order.'),
            };
        }
        console.error('[createPurchaseOrder] Unexpected error:', e);
        return { message: e instanceof Error ? e.message : String(e) };
    }

    // Don't redirect to /purchases — the list page hits a downstream
    // service that 401's on the saas tenant right now (procurement
    // status), which kicks the user to /login and looks like a logout.
    // Instead return success with the new PO number so the form can
    // toast it, clear local draft, and let the user choose to go back.
    revalidatePath('/purchases');
    const poNumber = (saved && (saved.po_number || saved.id)) ? String(saved.po_number || saved.id) : '';
    return {
        message: poNumber ? `Purchase order ${poNumber} saved.` : 'Purchase order saved.',
        errors: {},
    };
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

/** Hard-delete a single PO. Backend gates on lifecycle — only DRAFT /
 *  CANCELLED orders can actually be removed; later states are protected
 *  to preserve audit trail. The 4xx response surfaces back as `error`. */
export async function deletePurchaseOrder(poId: number | string): Promise<{ ok?: true; error?: string }> {
    try {
        await erpFetch(`purchase-orders/${String(poId)}/`, { method: 'DELETE' })
        revalidatePath('/purchases')
        return { ok: true }
    } catch (e: unknown) {
        console.error('PO Delete Error:', e)
        const msg = e instanceof Error ? e.message : String(e)
        return { error: msg || 'Failed to delete PO.' }
    }
}

/** Apply the same status transition to every id in the list. Returns
 *  per-id result so the UI can surface partial failures (a typical case:
 *  some POs are already in a terminal state and reject the transition).
 *
 *  Runs in parallel — the previous sequential loop made a 12-PO bulk
 *  click feel like 1+ second of dead time. The user-throttle (2000/min)
 *  has plenty of headroom for typical bulk sizes; if a tenant routinely
 *  bulk-actions hundreds of POs, switch to a chunked Promise.all. */
export async function bulkTransitionPurchaseOrders(
    poIds: Array<number | string>,
    toStatus: string,
    reason?: string,
): Promise<{ succeeded: number; failed: Array<{ id: number | string; error: string }> }> {
    const results = await Promise.all(
        poIds.map(id => transitionPurchaseOrderStatus(id, toStatus, reason)
            .then(r => ({ id, ...r })))
    )
    const failed: Array<{ id: number | string; error: string }> = []
    let succeeded = 0
    for (const r of results) {
        if (r.error) failed.push({ id: r.id, error: r.error })
        else succeeded += 1
    }
    revalidatePath('/purchases')
    return { succeeded, failed }
}

/** Bulk DELETE — parallel for the same UX reasons as bulkTransition. */
export async function bulkDeletePurchaseOrders(
    poIds: Array<number | string>,
): Promise<{ succeeded: number; failed: Array<{ id: number | string; error: string }> }> {
    const results = await Promise.all(
        poIds.map(id => deletePurchaseOrder(id).then(r => ({ id, ...r })))
    )
    const failed: Array<{ id: number | string; error: string }> = []
    let succeeded = 0
    for (const r of results) {
        if (r.error) failed.push({ id: r.id, error: r.error })
        else succeeded += 1
    }
    revalidatePath('/purchases')
    return { succeeded, failed }
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