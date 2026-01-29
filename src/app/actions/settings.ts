'use server';

import { prisma } from "@/lib/db";
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
    const setting = await prisma.systemSettings.findUnique({
        where: { key: 'product_naming_rule' }
    });

    if (!setting) {
        return DEFAULT_NAMING_RULE;
    }

    try {
        return JSON.parse(setting.value);
    } catch {
        return DEFAULT_NAMING_RULE;
    }
}

export async function saveProductNamingRule(rule: ProductNamingRule) {
    await prisma.systemSettings.upsert({
        where: { key: 'product_naming_rule' },
        update: {
            value: JSON.stringify(rule)
        },
        create: {
            key: 'product_naming_rule',
            value: JSON.stringify(rule)
        }
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/products/new');

    return { success: true };
}
