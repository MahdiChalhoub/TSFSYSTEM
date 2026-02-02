'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Zod Schema Definition
export const NamingRuleComponentSchema = z.object({
    id: z.string(),
    label: z.string(),
    enabled: z.boolean(),
    useShortName: z.boolean(),
});

export const ProductNamingRuleSchema = z.object({
    components: z.array(NamingRuleComponentSchema),
    separator: z.string(),
});

export type NamingRuleComponent = z.infer<typeof NamingRuleComponentSchema>;
export type ProductNamingRule = z.infer<typeof ProductNamingRuleSchema>;

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

export const SETTING_KEY = 'product_naming_rule';

export async function getProductNamingRule(): Promise<ProductNamingRule> {
    const setting = await prisma.systemSettings.findUnique({
        where: { key: SETTING_KEY }
    });

    if (!setting) {
        return DEFAULT_NAMING_RULE;
    }

    try {
        const parsed = JSON.parse(setting.value);
        const result = ProductNamingRuleSchema.safeParse(parsed);

        if (result.success) {
            return result.data;
        } else {
            console.error('Invalid naming rule in DB:', result.error);
            return DEFAULT_NAMING_RULE;
        }
    } catch (e) {
        console.error('Failed to parse naming rule JSON:', e);
        return DEFAULT_NAMING_RULE;
    }
}

export async function saveProductNamingRule(rule: ProductNamingRule) {
    // Validate input before saving
    const validation = ProductNamingRuleSchema.safeParse(rule);

    if (!validation.success) {
        return { success: false, error: validation.error.format() };
    }

    await prisma.systemSettings.upsert({
        where: { key: SETTING_KEY },
        update: {
            value: JSON.stringify(validation.data)
        },
        create: {
            key: SETTING_KEY,
            value: JSON.stringify(validation.data)
        }
    });

    revalidatePath('/admin/settings');
    revalidatePath('/admin/products/new');

    return { success: true };
}
