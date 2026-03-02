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
 const extraFees: any[] = [];
 const rawLines: any[] = [];
 const initialPayment: any = { amount: 0, accountId: null };

 for (const [key, value] of Array.from(formData.entries())) {
 const lineMatch = key.match(/^lines\[(\d+)\]\[(\w+)\]$/);
 if (lineMatch) {
 const index = parseInt(lineMatch[1]);
 const field = lineMatch[2];
 if (!rawLines[index]) rawLines[index] = {};
 rawLines[index][field] = value;
 }

 const feeMatch = key.match(/^extraFees\[(\d+)\]\[(\w+)\]$/);
 if (feeMatch) {
 const index = parseInt(feeMatch[1]);
 const field = feeMatch[2];
 if (!extraFees[index]) extraFees[index] = {};
 extraFees[index][field] = value;
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
 declaredRef: formData.get('declaredRef'),
 supplierRef: formData.get('supplierRef'),
 deliveryNoteRef: formData.get('deliveryNoteRef'),
 notes: formData.get('notes'),
 discountAmount: Number(formData.get('discountAmount') || 0),
 extraFees: extraFees.filter(f => f && f.amount && Number(f.amount) > 0),
 initialPayment: {
 amount: Number(formData.get('paidAmount') || 0),
 accountId: Number(formData.get('paymentAccountId') || 0)
 },
 lines: rawLines.filter(l => l && l.productId)
 };

 try {
 await erpFetch('purchase/quick_purchase/', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(rawData)
 });
 } catch (e: unknown) {
 console.error("Purchase Creation Error:", e);
 return { message: (e instanceof Error ? e.message : String(e)) || "Critical Error: Could not process purchase replenishment." };
 }
 revalidatePath('/purchases');
 redirect('/purchases');
}

export async function getOpenPurchaseOrders(supplierId: number) {
 try {
 const res = await erpFetch(`purchase/pending-invoice/?supplier=${supplierId}`);
 return res;
 } catch (e) {
 console.error("Fetch Open POs Error:", e);
 return [];
 }
}

export async function getPurchaseOrder(id: number) {
 try {
 const res = await erpFetch(`purchase/${id}/`);
 return res;
 } catch (e) {
 console.error("Fetch PO Detail Error:", e);
 return null;
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
 supplierId: Number(formData.get('supplierId')),
 siteId: Number(formData.get('siteId')),
 warehouseId: Number(formData.get('warehouseId')),
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