'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from 'next/cache';

export async function getBarcodeSettings() {
    try {
        const settings = await erpFetch('settings/barcode/');
        return { success: true, data: settings };
    } catch (error) {
        console.error("Failed to fetch barcode settings:", error);
        return { success: false, error: "Failed to fetch settings" };
    }
}

export async function updateBarcodeSettings(data: {
    prefix: string;
    nextSequence: number;
    isEnabled: boolean;
}) {
    try {
        await erpFetch('settings/barcode/', {
            method: 'POST',
            body: JSON.stringify({
                prefix: data.prefix,
                next_sequence: data.nextSequence,
                is_enabled: data.isEnabled
            })
        });

        revalidatePath('/admin/settings/barcode');
        return { success: true };
    } catch (error) {
        console.error("Update failed:", error);
        return { success: false, error: "Failed to update settings" };
    }
}

export async function generateNewBarcodeAction() {
    try {
        const res = await erpFetch('settings/barcode/generate/', { method: 'POST' });
        return { success: true, code: res.barcode };
    } catch (error: any) {
        console.error("Generate failed:", error);
        return { success: false, error: error.message };
    }
}
