'use server';

import { prisma } from "@/lib/db";
import { getCurrentSiteId } from "@/app/actions/context";
import { createJournalEntry, JournalLineInput } from "@/app/actions/finance/ledger";
import { getPostingRules } from "@/app/actions/finance/posting-rules";
import { generateTransactionNumber } from "@/lib/sequences";
import { CartItem } from "@/types/pos";
import { revalidatePath } from "next/cache";

// Cache for frequently accessed data (server-side)
let productsCache: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export async function getPosProducts(options: {
    search?: string;
    limit?: number;
    offset?: number;
    categoryId?: number;
} = {}) {
    const { search = '', limit = 100, offset = 0, categoryId } = options;
    const currentSiteId = await getCurrentSiteId();

    try {
        // Build where clause for filtering
        const where: any = {};

        // Search filter (case-insensitive search on name and SKU)
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Category filter
        if (categoryId) {
            where.categoryId = categoryId;
        }

        // Execute query with timeout protection
        const fetchPromise = prisma.product.findMany({
            where,
            include: {
                inventory: {
                    where: {
                        warehouse: {
                            siteId: currentSiteId
                        }
                    },
                    select: {
                        quantity: true
                    }
                }
            },
            orderBy: { name: 'asc' },
            take: limit,
            skip: offset,
        });

        // Add a manual timeout as backup (15 seconds)
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database query timeout')), 15000)
        );

        const products = await Promise.race([fetchPromise, timeoutPromise]) as any[];

        // Convert Decimals to numbers for JSON serialization
        // And calculate local stock level
        const serializedProducts = products.map(p => {
            const localStock = p.inventory.reduce((sum: number, item: any) => sum + Number(item.quantity), 0);
            return {
                ...p,
                costPrice: Number(p.costPrice),
                costPriceHT: Number(p.costPriceHT),
                costPriceTTC: Number(p.costPriceTTC),
                tvaRate: Number(p.tvaRate),
                sellingPriceHT: Number(p.sellingPriceHT),
                sellingPriceTTC: Number(p.sellingPriceTTC),
                basePrice: Number(p.basePrice),
                minPrice: Number(p.minPrice),
                taxRate: Number(p.taxRate),
                stock: localStock,
                inventory: undefined // Don't leak full relations
            };
        });

        return serializedProducts;

    } catch (error) {
        console.error('[getPosProducts] Database error:', error);
        return [];
    }
}

/**
 * Get product count for pagination
 */
export async function getProductCount(search?: string) {
    try {
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { barcode: { contains: search, mode: 'insensitive' } },
            ];
        }

        const count = await prisma.product.count({ where });
        return count;
    } catch (error) {
        console.error('[getProductCount] Error:', error);
        return 0;
    }
}

/**
 * Clear the products cache (call after product updates)
 */
export async function clearProductsCache() {
    productsCache = null;
    cacheTimestamp = 0;
    return { success: true };
}

/**
 * Get categories for filtering
 */
export async function getCategories() {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' }
        });
        return categories;
    } catch (error) {
        console.error('[getCategories] Error:', error);
        return [];
    }
}

/**
 * Process a POS Sale
 */
export async function processSale(data: {
    cart: CartItem[],
    paymentMethod: 'CASH' | 'CARD' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'MOBILE_PAYMENT',
    totalAmount: number,
    notes?: string,
    scope?: 'OFFICIAL' | 'INTERNAL',
    _userId?: number // For testing or admin overrides
}) {
    const { cart, paymentMethod, totalAmount, notes, scope = 'OFFICIAL', _userId } = data;
    const currentSiteId = await getCurrentSiteId();

    // User Resolution
    let user;
    if (_userId) {
        user = await prisma.user.findUnique({ where: { id: _userId } });
    } else {
        // Default User ID (In real app, get from session)
        user = await prisma.user.findFirst();
    }

    if (!user) throw new Error("No user found to process sale");

    return await prisma.$transaction(async (tx) => {
        // 1. Create Order
        const orderRef = await generateTransactionNumber('INVOICE');

        const order = await tx.order.create({
            data: {
                type: 'SALE',
                status: 'COMPLETED',
                refCode: orderRef,
                totalAmount: totalAmount,
                paymentMethod: paymentMethod,
                siteId: currentSiteId,
                userId: user.id,
                notes: notes,
                scope: scope,
                lines: {
                    create: cart.map(item => {
                        const lineTotal = item.price * item.quantity;

                        return {
                            productId: item.productId,
                            quantity: item.quantity,
                            unitPrice: item.price,
                            taxRate: item.taxRate,
                            total: lineTotal
                        };
                    })
                }
            }
        });

        // 2. Finance Integration
        const rules = await getPostingRules(tx);

        // Define Accounts
        // Revenue (Credit)
        const revenueAccount = rules.sales.revenue;
        if (!revenueAccount) throw new Error("Posting Rule Missing: Sales Revenue Account. Please configure Finance > Settings > Posting Rules.");

        // Tax (Credit)
        // Use purchases.tax for now as a fallback if specific Output Tax isn't defined, or assume 4457 if not present.
        const taxAccount = rules.purchases.tax;
        if (!taxAccount) throw new Error("Posting Rule Missing: Tax Account. Please configure Finance > Settings > Posting Rules.");

        // Cash/Bank (Debit)
        let debitAccountId = null;

        if (paymentMethod === 'CASH') {
            // STRICT CHECK 1: User MUST have an assigned Cash Drawer
            if (!user.cashRegisterId) {
                throw new Error(`You (User: ${user.name}) are not assigned to any Cash Register. Please ask an Administrator to assign you to a Financial Account via Finance > Accounts.`);
            }

            // Fetch the Financial Account to get the Linked Ledger Account
            const fAccount = await tx.financialAccount.findUnique({
                where: { id: user.cashRegisterId },
                include: { ledgerAccount: true }
            });

            if (!fAccount) {
                throw new Error(`Assigned Cash Register (ID: ${user.cashRegisterId}) not found in database.`);
            }

            // STRICT CHECK 2: Cash Drawer MUST be linked to a Ledger Account
            if (!fAccount.ledgerAccountId) {
                throw new Error(`Your Cash Register (${fAccount.name}) is NOT linked to a Ledger Account. An Administrator must link it via Finance > Accounts before you can accept payments.`);
            }

            debitAccountId = fAccount.ledgerAccountId;

        } else {
            // Card/Mobile Logic - This also needs to be strict ideally, but for now we map by type.
            // In future, we should have "Card Terminals" as Financial Accounts too.
            const code = paymentMethod === 'MOBILE_PAYMENT' ? '5121' : '5120';
            const acc = await tx.chartOfAccount.findFirst({ where: { code: code } }); // 5120 Bank, 5121 Mobile

            if (!acc) throw new Error(`System Configuration Error: Default Ledger Account for ${paymentMethod} (${code}) is missing.`);
            debitAccountId = acc.id;
        }

        // Calculate Totals
        // Scan the cart to separate Base vs Tax
        let totalBase = 0;
        let totalTax = 0;

        cart.forEach(item => {
            const lineTotal = item.price * item.quantity;
            const itemTaxRate = Number(item.taxRate);

            // If item.price includes tax: Price = Base * (1 + Rate)
            // Base = Price / (1 + Rate)
            // Tax = Price - Base
            let base = 0;
            let tax = 0;

            if (item.isTaxIncluded) {
                base = lineTotal / (1 + itemTaxRate);
                tax = lineTotal - base;
            } else {
                base = lineTotal;
                tax = lineTotal * itemTaxRate;
            }

            totalBase += base;
            totalTax += tax;
        });

        // Create Journal Entry
        // Debit: Cash (Total)
        // Credit: Revenue (Base)
        // Credit: VAT (Tax)

        const lines: JournalLineInput[] = [
            {
                accountId: debitAccountId,
                debit: totalAmount,
                credit: 0,
                description: `Payment for Order #${order.id}`
            },
            {
                accountId: revenueAccount,
                debit: 0,
                credit: totalBase,
                description: `Sales Revenue Order #${order.id}`
            }
        ];

        if (totalTax > 0.01) {
            lines.push({
                accountId: taxAccount,
                debit: 0,
                credit: totalTax,
                description: `VAT Collected Order #${order.id}`
            });
        }

        // Fix Rounding Issues (Simple Penny allocation to Revenue)
        const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);
        const diff = totalDebits - totalCredits;

        if (Math.abs(diff) > 0.0001) {
            // Apply diff to revenue
            lines[1].credit += diff;
        }

        await createJournalEntry({
            transactionDate: new Date(),
            description: `POS Sale #${order.id}`,
            reference: orderRef,
            status: 'POSTED',
            scope: scope,
            lines: lines,
            siteId: currentSiteId
        }, tx);

        return { success: true, orderId: order.id, ref: orderRef };
    });
}
