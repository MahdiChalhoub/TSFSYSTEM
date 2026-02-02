'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";

export type NamingRuleComponent = {
    id: string;
    label: string;
    enabled: boolean;
    useShortName: boolean;
};

export type ProductNamingRule = {
    components: NamingRuleComponent[];
    separator: string;
};

const DEFAULT_NAMING_RULE: ProductNamingRule = {
    components: [
        { id: 'category', label: 'Category', enabled: true, useShortName: true },
        { id: 'brand', label: 'Brand', enabled: true, useShortName: true },
        { id: 'family', label: 'Family', enabled: true, useShortName: false },
        { id: 'emballage', label: 'Emballage', enabled: true, useShortName: true },
        { id: 'country', label: 'Country', enabled: true, useShortName: true },
    ],
    separator: ' '
};

export async function getProductNamingRule(): Promise<ProductNamingRule> {
    try {
        const rule = await erpFetch('settings/item/product_naming_rule/');
        return rule || DEFAULT_NAMING_RULE;
    } catch (e) {
        console.error("Failed to fetch naming rule:", e);
        return DEFAULT_NAMING_RULE;
    }
}

export async function saveProductNamingRule(rule: ProductNamingRule) {
    try {
        await erpFetch('settings/item/product_naming_rule/', {
            method: 'POST',
            body: JSON.stringify(rule),
            headers: { 'Content-Type': 'application/json' }
        });

        revalidatePath('/admin/settings');
        revalidatePath('/admin/products/new');

        return { success: true };
    } catch (e: any) {
        console.error("Failed to save naming rule:", e);
        return { success: false, message: e.message };
    }
}
