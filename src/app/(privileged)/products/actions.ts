'use server';

import { erpFetch } from "@/lib/erp-api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

// Validation Schema
const productSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    description: z.string().optional(),
    sku: z.string().min(3, "SKU is required"),
    barcode: z.string().optional(),
    categoryId: z.coerce.number().optional(),
    unitId: z.coerce.number().optional(),
    brandId: z.coerce.number().optional(),
    countryId: z.coerce.number().optional(),

    costPrice: z.coerce.number().min(0),
    basePrice: z.coerce.number().min(0),
    taxRate: z.coerce.number().min(0).max(1),
    isTaxIncluded: z.boolean(),

    minStockLevel: z.coerce.number().int().min(0),
    isExpiryTracked: z.boolean(),
});

export type ProductFormState = {
    errors?: {
        [key: string]: string[];
    };
    message?: string;
};

export async function createProduct(prevState: ProductFormState, formData: FormData) {
    // 1. Extract Data
    const rawData = {
        name: formData.get('name'),
        description: (formData.get('description') as string) || undefined,
        sku: formData.get('sku'),
        barcode: formData.get('barcode'),
        categoryId: formData.get('categoryId') || undefined,
        unitId: formData.get('unitId') || undefined,
        brandId: formData.get('brandId') || undefined,
        countryId: formData.get('countryId') || undefined,

        // Grouping fields for backend logic
        parfumName: formData.get('parfumName') || undefined,

        size: formData.get('size') || undefined,
        sizeUnitId: formData.get('sizeUnitId') || undefined,

        costPrice: formData.get('costPrice') || 0,
        costPriceHT: formData.get('costPriceHT') || 0,
        costPriceTTC: formData.get('costPriceTTC') || 0,

        basePrice: formData.get('sellingPriceTTC') || 0,
        sellingPriceHT: formData.get('sellingPriceHT') || 0,
        sellingPriceTTC: formData.get('sellingPriceTTC') || 0,

        taxRate: formData.get('taxRate') || 0,
        isTaxIncluded: formData.get('isTaxIncluded') === 'on',
        minStockLevel: formData.get('minStockLevel') || 0,
        isExpiryTracked: formData.get('isExpiryTracked') === 'on',
    };

    // 2. Validate
    const validatedFields = productSchema.extend({
        size: z.coerce.number().optional(),
        sizeUnitId: z.coerce.number().optional(),
        // Backend specific fields
        parfumName: z.string().optional(),
        costPriceHT: z.coerce.number().min(0),
        costPriceTTC: z.coerce.number().min(0),
        sellingPriceHT: z.coerce.number().min(0),
        sellingPriceTTC: z.coerce.number().min(0),
    }).safeParse(rawData);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Product.',
        };
    }

    try {
        // 3. Delegation to Django
        await erpFetch('products/create_complex/', {
            method: 'POST',
            body: JSON.stringify(validatedFields.data),
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: unknown) {
        console.error("Backend Create Error:", e);
        return { message: (e instanceof Error ? e.message : String(e)) || 'System Error: Failed to Create Product.' };
    }

    // 4. Revalidate & Redirect
    revalidatePath('/products');
    redirect('/products');
}