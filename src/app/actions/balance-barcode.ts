'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from 'next/cache';

export type BalanceBarcodeConfig = {
    prefix: string;           // e.g. "2" — balance barcode prefix
    itemDigits: number;       // e.g. 6 — number of digits for item code
    weightIntDigits: number;  // e.g. 3 — integer part of weight
    weightDecDigits: number;  // e.g. 3 — decimal part of weight
    isEnabled: boolean;       // whether balance barcode enforcement is active
};

const DEFAULT_CONFIG: BalanceBarcodeConfig = {
    prefix: '2',
    itemDigits: 6,
    weightIntDigits: 3,
    weightDecDigits: 3,
    isEnabled: true,
};

export async function getBalanceBarcodeConfig(): Promise<{ success: boolean; data: BalanceBarcodeConfig; error?: string }> {
    try {
        const settings = await erpFetch('settings/balance-barcode/');
        return {
            success: true,
            data: {
                prefix: settings.prefix ?? DEFAULT_CONFIG.prefix,
                itemDigits: settings.item_digits ?? settings.itemDigits ?? DEFAULT_CONFIG.itemDigits,
                weightIntDigits: settings.weight_int_digits ?? settings.weightIntDigits ?? DEFAULT_CONFIG.weightIntDigits,
                weightDecDigits: settings.weight_dec_digits ?? settings.weightDecDigits ?? DEFAULT_CONFIG.weightDecDigits,
                isEnabled: settings.is_enabled ?? settings.isEnabled ?? DEFAULT_CONFIG.isEnabled,
            }
        };
    } catch (error) {
        // If the endpoint doesn't exist yet, return defaults
        console.warn("Balance barcode config not found, using defaults:", error);
        return { success: true, data: { ...DEFAULT_CONFIG } };
    }
}

export async function updateBalanceBarcodeConfig(config: BalanceBarcodeConfig): Promise<{ success: boolean; error?: string }> {
    try {
        await erpFetch('settings/balance-barcode/', {
            method: 'POST',
            body: JSON.stringify({
                prefix: config.prefix,
                item_digits: config.itemDigits,
                weight_int_digits: config.weightIntDigits,
                weight_dec_digits: config.weightDecDigits,
                is_enabled: config.isEnabled,
            })
        });

        revalidatePath('/inventory/units');
        revalidatePath('/inventory/barcode');
        revalidatePath('/sales/pos-settings');
        return { success: true };
    } catch (error) {
        console.error("Failed to update balance barcode config:", error);
        return { success: false, error: "Failed to save configuration" };
    }
}
