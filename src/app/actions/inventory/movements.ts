'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from '@prisma/client';
import { Decimal } from "@prisma/client/runtime/library";
import { normalizePriceToBaseUnit } from "@/lib/utils/units";
import { createJournalEntry } from "../finance/ledger";
import { getPostingRules } from "../finance/posting-rules";

export type StockMovementState = {
    message?: string;
    success?: boolean;
};

export async function createStockMovement(data: {
    siteId: number,
    type: 'IN' | 'OUT' | 'TRANSFER',
    items: {
        productId: number,
        quantity: number,
        unitId: number,
        costPrice?: number // Override cost
    }[],
    description?: string,
    reference?: string
}) {
    // ...

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // ...

        // Calculate Total Value for Journal Entry
        let totalValue = 0

        for (const item of data.items) {
            // ... (fetching product)
            // ...

            // Update Validation logic:
            if (data.type === 'OUT' || data.type === 'TRANSFER') {
                const currentStock = await (tx as any).inventoryLevel.findUnique({
                    where: { siteId_productId: { siteId: data.siteId, productId: item.productId } }
                })
                const currentQty = Number(currentStock?.quantity || 0)
                // We deal with base units inside logic usually, assuming 'quantity' is already converted or we convert here.
                // For simplicity assuming base unit input or handling elsewhere.
                // ...
            }

            // ...

            totalValue += (item.costPrice || 0) * item.quantity
        }

        // ...
    })
}

/**
 * Validates and Post a Stock Reception.
 * Updates quantity and calculates New Global AMC.
 */
export async function receiveStock(
    productId: number,
    warehouseId: number,
    quantity: number,
    unitId: number,
    costPriceHT: number, // Price for the GIVEN unitId
    reference: string = "RECEPTION"
): Promise<StockMovementState> {
    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { inventory: true }
        });

        if (!product) return { success: false, message: "Product not found" };

        const warehouse = await prisma.warehouse.findUnique({
            where: { id: warehouseId },
            // @ts-ignore
            include: { site: true }
        });

        if (!warehouse) return { success: false, message: "Warehouse not found" };

        // 1. Normalize Quantity to Base Unit
        const baseUnitId = product.unitId;
        if (!baseUnitId) return { success: false, message: "Product has no base unit defined." };

        const normalizedCost = await normalizePriceToBaseUnit(costPriceHT, unitId, baseUnitId);

        // 2. Calculate New AMC (Average Moving Cost)
        const currentTotalQty = product.inventory.reduce((sum, item) => sum.add(new Decimal(item.quantity.toString())), new Decimal(0));
        const currentTotalValue = currentTotalQty.mul(new Decimal(product.costPrice.toString()));

        const inboundQty = new Decimal(quantity.toString());
        const inboundValue = inboundQty.mul(normalizedCost);

        const newTotalQty = currentTotalQty.add(inboundQty);
        let newAMC = new Decimal(product.costPrice.toString());

        if (newTotalQty.gt(0)) {
            newAMC = currentTotalValue.add(inboundValue).div(newTotalQty);
        }

        // 3. Database Transaction: Update Stock + Update Cost + Create Journal
        await prisma.$transaction(async (tx) => {
            // A. Update Inventory (Manual Upsert to handle NULL batchId correctly)
            const existingStock = await tx.inventory.findFirst({
                where: {
                    warehouseId,
                    productId,
                    batchId: null
                }
            });

            if (existingStock) {
                await tx.inventory.update({
                    where: { id: existingStock.id },
                    data: { quantity: { increment: inboundQty } }
                });
            } else {
                await tx.inventory.create({
                    data: {
                        warehouseId,
                        productId,
                        quantity: inboundQty,
                        batchId: null
                    }
                });
            }

            // B. Update Product Cost
            await tx.product.update({
                where: { id: productId },
                data: {
                    costPrice: newAMC,
                    costPriceHT: normalizedCost
                }
            });

            // C. Financial Integration: Automatic Ledger Entry
            const rules = await getPostingRules(tx);
            if (rules.sales.inventory && rules.suspense.reception) {
                const journalRes = await createJournalEntry({
                    transactionDate: new Date(),
                    description: `Stock Reception: ${product.name} (${quantity} units)`,
                    reference: reference,
                    status: "POSTED",
                    // @ts-ignore - Some IDEs don't see Site relation in types yet
                    siteId: (warehouse as any).siteId,
                    lines: [
                        {
                            accountId: rules.sales.inventory,
                            debit: inboundValue.toNumber(),
                            credit: 0,
                            description: `Inventory Increase (+${quantity})`
                        },
                        {
                            accountId: rules.suspense.reception,
                            debit: 0,
                            credit: inboundValue.toNumber(),
                            description: `Accrued Liability for Reception`
                        }
                    ]
                }, tx);
            }
        });

        try {
            revalidatePath('/admin/inventory');
            revalidatePath('/admin/finance/ledger');
        } catch (e) {
            // Standalone script
        }

        return { success: true, message: `Successfully received ${quantity} items.` };
    } catch (e: any) {
        console.error("Reception Error:", e);
        return { success: false, message: "Error: " + e.message };
    }
}

/**
 * Performs a Manual Stock Adjustment (Gain or Loss).
 * - Positive Quantity: Found Stock (Increases Inventory, Income/Gain)
 * - Negative Quantity: Lost/Damaged Stock (Decreases Inventory, Expense/Loss)
 */
export async function adjustStock(
    productId: number,
    warehouseId: number,
    quantity: number,
    reason: string,
    notes?: string
): Promise<StockMovementState> {
    try {
        if (quantity === 0) return { success: false, message: "Quantity cannot be zero." };

        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: { inventory: true }
        });

        if (!product) return { success: false, message: "Product not found" };

        const warehouse = await prisma.warehouse.findUnique({
            where: { id: warehouseId },
            // @ts-ignore
            include: { site: true }
        });

        if (!warehouse) return { success: false, message: "Warehouse not found" };

        const adjQty = new Decimal(quantity.toString());
        const costPrice = new Decimal(product.costPrice.toString());
        const adjustmentValue = adjQty.abs().mul(costPrice);

        await prisma.$transaction(async (tx) => {
            // A. Update Inventory
            const existingStock = await tx.inventory.findFirst({
                where: {
                    warehouseId,
                    productId,
                    batchId: null
                }
            });

            if (existingStock) {
                // Prevent negative stock if wanted, but generally allow for now
                // Check if new quantity will be negative?
                // const current = new Decimal(existingStock.quantity);
                // if (current.add(adjQty).isNegative()) throw new Error("Insufficient stock for adjustment.");

                await tx.inventory.update({
                    where: { id: existingStock.id },
                    data: { quantity: { increment: adjQty } }
                });
            } else {
                if (quantity < 0) throw new Error("Cannot deduce stock from empty inventory.");
                await tx.inventory.create({
                    data: {
                        warehouseId,
                        productId,
                        quantity: adjQty,
                        batchId: null
                    }
                });
            }

            // B. Financial Journal
            const rules = await getPostingRules(tx);
            if (rules.sales.inventory) {
                const isGain = quantity > 0;

                // Using suspense/reception as the contra-account for adjustments for now
                const targetAccount = rules.suspense.reception || rules.sales.inventory;

                if (targetAccount) {
                    await createJournalEntry({
                        transactionDate: new Date(),
                        description: `Stock Adjustment (${reason}): ${product.name} (${quantity})`,
                        reference: "ADJ-" + new Date().getTime(),
                        status: "POSTED",
                        // @ts-ignore
                        siteId: (warehouse as any).siteId,
                        lines: [
                            {
                                accountId: rules.sales.inventory,
                                debit: isGain ? adjustmentValue.toNumber() : 0,
                                credit: isGain ? 0 : adjustmentValue.toNumber(),
                                description: `Inventory ${isGain ? 'Gain' : 'Shrinkage'}`
                            },
                            {
                                accountId: targetAccount,
                                debit: isGain ? 0 : adjustmentValue.toNumber(),
                                credit: isGain ? adjustmentValue.toNumber() : 0,
                                description: `Adjustment: ${reason}`
                            }
                        ]
                    }, tx);
                }
            }

            // C. Audit Log (Simplified - implicitly tracked via Journal or explicit log)
            await tx.auditLog.create({
                data: {
                    action: 'UPDATE',
                    entity: 'Inventory',
                    entityId: productId.toString(),
                    field: 'quantity',
                    oldValue: '?',
                    newValue: quantity.toString(),
                    userId: 1, // FAST FIX: Need real user ID from context
                }
            });
        });

        revalidatePath('/admin/inventory');
        return { success: true, message: `Successfully adjusted stock by ${quantity}.` };

    } catch (e: any) {
        console.error("Adjustment Error:", e);
        return { success: false, message: "Error: " + e.message };
    }
}

