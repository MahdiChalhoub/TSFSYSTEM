'use server';
/**
 * Sales Workflow Server Actions
 * ================================
 * Calls POST /pos/orders/{id}/workflow/ with a typed action string.
 * The backend SalesWorkflowService enforces valid transitions and returns
 * the updated order, or a 400 with a clear error message.
 */
import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type WorkflowAction =
    | 'confirm'
    | 'processing'
    | 'deliver'
    | 'deliver_partial'
    | 'return'
    | 'pay'
    | 'write_off'
    | 'generate_invoice'
    | 'send_invoice'
    | 'cancel';

interface WorkflowPayload {
    action: WorkflowAction;
    reason?: string;
    amount?: number;
}

interface WorkflowResult {
    success: boolean;
    data?: any;
    error?: string;
}

export async function triggerOrderWorkflow(
    orderId: number,
    payload: WorkflowPayload
): Promise<WorkflowResult> {
    try {
        const data = await erpFetch(`pos/orders/${orderId}/workflow/`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        // erpFetch throws on non-2xx, so if we get here it's a success
        revalidatePath('/sales/history');
        revalidatePath(`/sales/${orderId}`);
        return { success: true, data };
    } catch (err: any) {
        // Try to extract Django error message
        const msg = err?.message || err?.error || 'Workflow action failed';
        return { success: false, error: msg };
    }
}

/** Convenience wrappers for common transitions */
export const confirmOrder = (id: number) => triggerOrderWorkflow(id, { action: 'confirm' });
export const markDelivered = (id: number) => triggerOrderWorkflow(id, { action: 'deliver' });
export const markPartial = (id: number) => triggerOrderWorkflow(id, { action: 'deliver_partial' });
export const markPaid = (id: number, amount?: number) => triggerOrderWorkflow(id, { action: 'pay', amount });
export const generateInvoice = (id: number) => triggerOrderWorkflow(id, { action: 'generate_invoice' });
export const sendInvoice = (id: number) => triggerOrderWorkflow(id, { action: 'send_invoice' });
export const cancelOrder = (id: number, reason?: string) => triggerOrderWorkflow(id, { action: 'cancel', reason });
export const writeOffOrder = (id: number, reason?: string) => triggerOrderWorkflow(id, { action: 'write_off', reason });
