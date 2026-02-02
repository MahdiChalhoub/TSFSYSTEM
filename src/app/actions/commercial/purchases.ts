'use server';

import { prisma } from "@/lib/db";
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
    invoicePriceType: z.enum(['HT', 'TTC']).default('HT'), // New flag
    vatRecoverable: z.coerce.boolean().default(true),      // New flag
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
        console.error("Purchase Validation Errors:", validated.error.flatten().fieldErrors);
        return {
            errors: validated.error.flatten().fieldErrors,
            message: "Some fields are missing or invalid."
        };
    }

    const { data } = validated;

    try {
        await prisma.$transaction(async (tx) => {
            // Fetch Global Rules
            const financialSettings = await tx.financialSettings.findFirst();
            const pricingCostBasis = financialSettings?.pricingCostBasis || 'AUTO';

            // 2. Aggregate Totals
            let totalAmountHT = 0;
            let totalTax = 0;

            // 3. Create Order
            const order = await tx.order.create({
                data: {
                    type: 'PURCHASE',
                    status: 'COMPLETED',
                    scope: data.scope,
                    invoicePriceType: data.invoicePriceType,
                    vatRecoverable: data.vatRecoverable,
                    contactId: data.supplierId,
                    userId: 1, // TODO: Auth context
                    siteId: data.siteId,
                    refCode: data.refCode,
                    notes: data.notes,
                    paymentMethod: 'CREDIT',
                    totalAmount: 0,
                    taxAmount: 0,
                }
            });

            // 4. Process Lines
            for (let line of data.lines) {
                // Defensive: Ensure both HT and TTC are present based on taxRate
                if (line.unitCostHT > 0 && line.unitCostTTC === 0) {
                    line.unitCostTTC = Number((line.unitCostHT * (1 + line.taxRate)).toFixed(2));
                } else if (line.unitCostTTC > 0 && line.unitCostHT === 0) {
                    line.unitCostHT = Number((line.unitCostTTC / (1 + line.taxRate)).toFixed(2));
                }

                if (line.sellingPriceHT && line.sellingPriceHT > 0 && (!line.sellingPriceTTC || line.sellingPriceTTC === 0)) {
                    line.sellingPriceTTC = Number((line.sellingPriceHT * (1 + line.taxRate)).toFixed(2));
                } else if (line.sellingPriceTTC && line.sellingPriceTTC > 0 && (!line.sellingPriceHT || line.sellingPriceHT === 0)) {
                    line.sellingPriceHT = Number((line.sellingPriceTTC / (1 + line.taxRate)).toFixed(2));
                }

                const lineTotalHT = line.quantity * line.unitCostHT;
                const lineTax = lineTotalHT * line.taxRate;
                const lineTotalTTC = lineTotalHT + lineTax;

                totalAmountHT += lineTotalHT;
                totalTax += lineTax;

                // --- CORE RULE: EFFECTIVE COST ENGINE ---
                let effectiveCost: number;

                if (pricingCostBasis === 'FORCE_HT') {
                    effectiveCost = line.unitCostHT;
                } else if (pricingCostBasis === 'FORCE_TTC') {
                    effectiveCost = line.unitCostTTC;
                } else {
                    // AUTO MODE
                    effectiveCost = data.vatRecoverable ? line.unitCostHT : line.unitCostTTC;
                }

                // A. Create Order Line
                await tx.orderLine.create({
                    data: {
                        orderId: order.id,
                        productId: line.productId,
                        quantity: line.quantity,
                        unitPrice: effectiveCost, // Standardized unit price for reports
                        unitCostHT: line.unitCostHT,
                        unitCostTTC: line.unitCostTTC,
                        vatAmount: lineTax / line.quantity,
                        effectiveCost: effectiveCost,
                        taxRate: line.taxRate,
                        total: lineTotalTTC
                    }
                });

                // B. Inventory Management
                const batch = await tx.stockBatch.create({
                    data: {
                        productId: line.productId,
                        batchCode: `PUR-${order.id}-${line.productId}`,
                        costPrice: effectiveCost,
                        expiryDate: line.expiryDate ? new Date(line.expiryDate) : null
                    }
                });

                await tx.inventory.upsert({
                    where: {
                        warehouseId_productId_batchId: {
                            warehouseId: data.warehouseId,
                            productId: line.productId,
                            batchId: batch.id
                        }
                    },
                    update: { quantity: { increment: line.quantity } },
                    create: {
                        warehouseId: data.warehouseId,
                        productId: line.productId,
                        batchId: batch.id,
                        quantity: line.quantity
                    }
                });

                // C. Update Product Master with Effective Cost
                await tx.product.update({
                    where: { id: line.productId },
                    data: {
                        costPrice: effectiveCost,
                        costPriceHT: line.unitCostHT,
                        costPriceTTC: line.unitCostTTC,
                        sellingPriceHT: line.sellingPriceHT || undefined,
                        sellingPriceTTC: line.sellingPriceTTC || undefined
                    }
                });
            }

            // 5. Update Order Final Totals
            await tx.order.update({
                where: { id: order.id },
                data: {
                    totalAmount: totalAmountHT + totalTax,
                    taxAmount: totalTax
                }
            });

            // 6. Financial Posting (Journal Entry)
            const supplier = await tx.contact.findUnique({
                where: { id: data.supplierId },
                select: { name: true, linkedAccountId: true }
            });

            const apAccountId = supplier?.linkedAccountId || 1;
            const stockAccount = await tx.chartOfAccount.findFirst({ where: { code: '3100' } });
            const taxAccount = await tx.chartOfAccount.findFirst({ where: { code: '4456' } });

            // Posting amounts based on VAT recovery
            const inventoryDebitAmount = data.vatRecoverable ? totalAmountHT : (totalAmountHT + totalTax);

            await tx.journalEntry.create({
                data: {
                    transactionDate: new Date(),
                    description: `Purchase: ${supplier?.name} | Basis: ${pricingCostBasis} | Recoverable: ${data.vatRecoverable}`,
                    reference: `ORD-${order.id}`,
                    fiscalYearId: 1,
                    status: 'DRAFT',
                    scope: data.scope,
                    lines: {
                        create: [
                            // Credit AP (Always TTC)
                            {
                                accountId: apAccountId,
                                credit: totalAmountHT + totalTax,
                                description: `Payable to ${supplier?.name}`
                            },
                            // Debit Inventory
                            {
                                accountId: stockAccount?.id || 1,
                                debit: inventoryDebitAmount,
                                description: data.vatRecoverable ? 'Inventory Value (HT)' : 'Inventory Value (TTC - Non-recoverable)'
                            },
                            // Debit Tax (Only if recoverable)
                            ...(data.vatRecoverable && totalTax > 0 ? [{
                                accountId: taxAccount?.id || 1,
                                debit: totalTax,
                                description: 'TVA Recoverable'
                            }] : [])
                        ]
                    }
                }
            });
        });
    } catch (e) {
        console.error("Purchase Creation Error:", e);
        return { message: "Critical Error: Could not process purchase replenishment." };
    }

    revalidatePath('/admin/purchases');
    redirect('/admin/purchases');
}
