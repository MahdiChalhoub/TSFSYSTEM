'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

/**
 * Get login branding settings for the current organization.
 */
export async function getLoginBranding() {
    try {
        const data = await erpFetch('settings/item/login_branding/');
        return data || {};
    } catch (error) {
        handleAuthError(error)
        console.error("[getLoginBranding] Error:", error);
        return {};
    }
}

/**
 * Save login branding settings for the current organization.
 * Fields: brand_color, bg_image, tagline
 */
export async function saveLoginBranding(branding: {
    brand_color?: string;
    bg_image?: string;
    tagline?: string;
}) {
    try {
        await erpFetch('settings/item/login_branding/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(branding),
        });
        revalidatePath('/settings/branding');
        return { success: true };
    } catch (error) {
        console.error("[saveLoginBranding] Error:", error);
        return { success: false, error: (error as Error).message };
    }
}
