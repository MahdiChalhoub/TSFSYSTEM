'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";
import { getCommercialContext } from "@/app/actions/commercial";

/**
 * Enhanced product search for POS with Next.js cache integration
 */
export async function getPosProducts(options: {
    search?: string;
    limit?: number;
    offset?: number;
    categoryId?: number;
    category?: number;
} = {}) {
    const { search = '', limit = 100, offset = 0, categoryId, category } = options;
    const effectiveCategoryId = categoryId || category;

    try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('query', search);
        if (effectiveCategoryId) queryParams.append('category', String(effectiveCategoryId));
        queryParams.append('limit', String(limit));
        queryParams.append('offset', String(offset));

        // Use fetch cache for high-frequency search
        const data = await erpFetch(`products/search_enhanced/?${queryParams.toString()}`, {
            next: { revalidate: 0, tags: ['products', 'pos'] }
        });
        console.log(`[DEBUG] getPosProducts returned ${data?.length} items. First item price:`, data?.[0]?.basePrice);
        return data;
    } catch (error) {
        console.error('[getPosProducts] API error:', error);
        return [];
    }
}

/**
 * Get total product count for pagination/metrics
 */
export async function getProductCount(options: { search?: string; categoryId?: number } = {}) {
    try {
        const queryParams = new URLSearchParams();
        if (options.search) queryParams.append('query', options.search);
        const catId = options.categoryId || (options as any).category;
        if (catId) queryParams.append('category', String(catId));

        const res = await erpFetch(`products/count/?${queryParams.toString()}`);
        return res.count || 0;
    } catch (error) {
        console.error('[getProductCount] Error:', error);
        return 0;
    }
}

export async function clearProductsCache() {
    // In Next.js, we revalidate tags instead of clearing local vars
    revalidatePath('/sales');
    return { success: true };
}

export async function getPosSettings() {
    try {
        const data = await erpFetch('pos/pos-settings/', {
            next: { revalidate: 0, tags: ['pos-settings'] }
        });
        return {
            loyaltyPointValue: Number(data?.loyalty_point_value ?? 1),
            loyaltyEarnRate: Number(data?.loyalty_earn_rate ?? 10),
        };
    } catch {
        return { loyaltyPointValue: 1, loyaltyEarnRate: 10 };
    }
}

export async function getCategories() {
    try {
        const data = await erpFetch('inventory/categories/with_counts/?limit=500', {
            next: { revalidate: 0, tags: ['categories'] }
        });
        const cats = Array.isArray(data) ? data : (data?.results || []);
        console.log(`[DEBUG] getCategories returned ${cats.length} categories.`);
        return cats;
    } catch (error) {
        console.error('[getCategories] Error:', error);
        return [];
    }
}

export async function getDeliveryZones() {
    try {
        const data = await erpFetch('pos/delivery-zones/', {
            next: { revalidate: 0, tags: ['delivery-zones'] }
        });
        return Array.isArray(data) ? data : (data?.results || []);
    } catch (error) {
        console.error('[getDeliveryZones] Error:', error);
        return [];
    }
}

export async function processSale(data: {
    cart: Record<string, any>[],
    paymentMethod: string,
    totalAmount: number,
    scope?: string,
    notes?: string,
    warehouseId?: number,
    paymentAccountId?: number,
    clientId?: number,
    pointsRedeemed?: number,
    storeChangeInWallet?: boolean,
    cashReceived?: number,
    userConfirmedDeclaration?: boolean, // Added for high-value override
    globalDiscount?: number,
    paymentLegs?: Array<{ method: string; amount: number }>
}) {
    try {
        const [context, financialSettings] = await Promise.all([
            getCommercialContext(),
            import('@/app/actions/finance/settings').then(m => m.getFinancialSettings())
        ]);

        let effectiveScope = data.scope || 'INTERNAL';
        let protectionWarning = null;
        let requiresConfirmation = false;

        // 0. EMERGENCY OVERRIDE (Panic Button)
        if (financialSettings.emergencyForceDeclared) {
            effectiveScope = 'OFFICIAL';
        } else if (financialSettings.dualViewEnabled && financialSettings.autoDeclarationEnabled) {

            // 1. HIGH-VALUE CONFIRMATION GUARD
            if (financialSettings.highValueAlertThreshold && data.totalAmount >= financialSettings.highValueAlertThreshold) {
                if (!data.userConfirmedDeclaration) {
                    return {
                        success: false,
                        needsConfirmation: true,
                        message: `High-value transaction detected ($${data.totalAmount}). Please confirm if this should be DECLARED.`
                    };
                }
            }

            // 1.5 GLOBAL THRESHOLD OVERRIDE
            if (financialSettings.autoDeclareThreshold) {
                const amount = data.totalAmount;
                const threshold = financialSettings.autoDeclareThreshold;
                const isMatch = financialSettings.autoDeclareThresholdMode === 'BELOW' ? amount <= threshold : amount >= threshold;

                if (isMatch) {
                    effectiveScope = 'OFFICIAL';
                }
            }

            // 2. RULES OF ENGAGEMENT (ROE) ENGINE
            if (financialSettings.declarationRules && financialSettings.declarationRules.length > 0) {
                const now = new Date();
                const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                // Find matching rule (First matching rule wins)
                const matchingRule = financialSettings.declarationRules.find((rule: any) => {
                    const timeMatch = currentTime >= rule.startTime && currentTime <= rule.endTime;
                    if (!timeMatch) return false;

                    const methodMatch = !rule.allowedMethods || rule.allowedMethods.length === 0 || rule.allowedMethods.includes(data.paymentMethod);
                    if (!methodMatch) return false;

                    const accountMatch = !rule.allowedAccountIds || rule.allowedAccountIds.length === 0 || rule.allowedAccountIds.includes(Number(data.paymentAccountId));
                    if (!accountMatch) return false;

                    const amountMatch = (!rule.minTransactionAmount || data.totalAmount >= rule.minTransactionAmount) &&
                        (!rule.maxTransactionAmount || data.totalAmount <= rule.maxTransactionAmount);

                    return amountMatch;
                });

                if (matchingRule) {
                    // Check if rule has a turnover limit
                    if (matchingRule.limitDailyTurnover) {
                        const { getDeclaredTurnoverToday } = await import('@/app/actions/finance/ledger');
                        const turnover = await getDeclaredTurnoverToday();
                        if (turnover < matchingRule.limitDailyTurnover) {
                            effectiveScope = matchingRule.forceScope;
                        }
                    } else {
                        effectiveScope = matchingRule.forceScope;
                    }
                }
            }

            // 3. LEGACY / FALLBACK: CONTROLLABLE ACCOUNTS GUARD
            if (effectiveScope === 'INTERNAL') {
                const isControllable = financialSettings.controllableAccountIds?.includes(Number(data.paymentAccountId));
                if (isControllable) effectiveScope = 'OFFICIAL';

                // Random Sampling if still Internal
                if (effectiveScope === 'INTERNAL' && financialSettings.autoDeclarePercentage) {
                    const dice = Math.random() * 100;
                    if (dice <= financialSettings.autoDeclarePercentage) effectiveScope = 'OFFICIAL';
                }
            }

            // --- INTEGRITY PROTECTION (DAILY LIMIT) ---
            if (effectiveScope === 'OFFICIAL' && financialSettings.autoDeclareDailyLimit) {
                const { getDeclaredTurnoverToday } = await import('@/app/actions/finance/ledger');
                const dailyTurnover = await getDeclaredTurnoverToday();

                if (dailyTurnover + data.totalAmount > financialSettings.autoDeclareDailyLimit) {
                    effectiveScope = 'INTERNAL';
                    protectionWarning = "Declaration Strategy Halted: Daily Cap Matched. Use alternative payment to protect company integrity.";
                } else if (dailyTurnover + data.totalAmount > (financialSettings.autoDeclareDailyLimit * 0.9)) {
                    protectionWarning = "Advisory: Daily Declaration approaching limit. Consider switching to Internal methods.";
                }
            }
        }

        const response = await erpFetch('pos/checkout/', {
            method: 'POST',
            body: JSON.stringify({
                items: data.cart.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity,
                    unit_price: item.price,
                    discount_rate: item.discountRate || 0
                })),
                warehouse_id: data.warehouseId || context.defaultWarehouseId,
                payment_account_id: data.paymentAccountId,
                payment_method: data.paymentMethod,
                notes: data.notes,
                scope: effectiveScope,
                total_amount: data.totalAmount,
                contact_id: data.clientId,
                points_redeemed: data.pointsRedeemed || 0,
                store_change_in_wallet: data.storeChangeInWallet || false,
                cash_received: data.cashReceived || 0,
                global_discount: data.globalDiscount || 0,
                payment_legs: data.paymentLegs || []
            })
        });

        revalidatePath('/sales/history');
        return {
            success: true,
            orderId: response.order_id,
            ref: response.ref || "POS-WEB",
            scope: effectiveScope,
            protectionWarning
        };
    } catch (e: unknown) {
        console.error("POS Checkout Error:", e);
        throw new Error((e instanceof Error ? e.message : String(e)) || "Checkout Failed");
    }
}

export async function deleteOrder(id: number) {
    try {
        await erpFetch(`pos/orders/${id}/`, { method: 'DELETE' });
        revalidatePath('/sales/history');
        return { success: true };
    } catch (e) {
        console.error("Delete Order Error:", e);
        return { success: false, error: String(e) };
    }
}

export async function lockOrder(id: number, locked: boolean) {
    try {
        await erpFetch(`pos/orders/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ is_locked: locked })
        });
        revalidatePath('/sales/history');
        return { success: true };
    } catch (e) {
        console.error("Lock Order Error:", e);
        return { success: false, error: String(e) };
    }
}

export async function verifyOrder(id: number, verified: boolean) {
    try {
        await erpFetch(`pos/orders/${id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ is_verified: verified })
        });
        revalidatePath('/sales/history');
        return { success: true };
    } catch (e) {
        console.error("Verify Order Error:", e);
        return { success: false, error: String(e) };
    }
}