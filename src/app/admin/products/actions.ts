'use server';

import { prisma } from "@/lib/db";
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

        size: formData.get('size') || undefined,
        sizeUnitId: formData.get('sizeUnitId') || undefined,

        costPrice: formData.get('costPrice') || 0,
        basePrice: formData.get('basePrice') || 0,
        taxRate: formData.get('taxRate') || 0,
        isTaxIncluded: formData.get('isTaxIncluded') === 'on',
        minStockLevel: formData.get('minStockLevel') || 0,
        isExpiryTracked: formData.get('isExpiryTracked') === 'on',
    };

    // 2. Validate
    const validatedFields = productSchema.extend({
        size: z.coerce.number().optional(),
        sizeUnitId: z.coerce.number().optional(),
    }).safeParse(rawData);

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Product.',
        };
    }

    const { data } = validatedFields;

    try {
        // 3. Check Uniqueness
        const existingSku = await prisma.product.findUnique({ where: { sku: data.sku } });
        if (existingSku) {
            return { message: 'SKU already exists. Please use a unique SKU.' };
        }

        // --- Auto-Grouping Logic (Brand + Family) ---
        // Family (stored as Parfum in DB) is a product attribute that groups variants
        const parfumName = formData.get('parfumName') as string; // Form field name kept for compatibility
        let parfumId = null;
        let productGroupId = null;

        if (parfumName && data.brandId) {
            // A. Upsert Parfum
            const parfum = await prisma.parfum.upsert({
                where: { name: parfumName },
                update: {
                    categories: data.categoryId ? { connect: { id: data.categoryId } } : undefined
                },
                create: {
                    name: parfumName,
                    categories: data.categoryId ? { connect: { id: data.categoryId } } : undefined
                }
            });
            parfumId = parfum.id;

            // B. Find or Create Group
            const existingGroup = await prisma.productGroup.findFirst({
                where: {
                    brandId: data.brandId,
                    parfumId: parfum.id
                }
            });

            if (existingGroup) {
                productGroupId = existingGroup.id;
            } else {
                const brand = await prisma.brand.findUnique({ where: { id: data.brandId } });
                const groupName = `${brand?.name || ''} ${parfumName}`.trim();

                const newGroup = await prisma.productGroup.create({
                    data: {
                        name: groupName,
                        brandId: data.brandId,
                        parfumId: parfum.id,
                        categoryId: data.categoryId,
                        description: `Auto-generated group via ${parfumName}`
                    }
                });
                productGroupId = newGroup.id;
            }
        }

        // 4. Create in DB
        const product = await prisma.product.create({
            data: {
                name: data.name,
                description: data.description,
                sku: data.sku,
                barcode: data.barcode || null,
                categoryId: data.categoryId || null,
                unitId: data.unitId || null,
                brandId: data.brandId || null,
                countryId: data.countryId || null,

                size: data.size,
                sizeUnitId: data.sizeUnitId,

                parfumId: parfumId,        // Link to Parfum
                productGroupId: productGroupId, // Link to Auto-Group

                costPrice: data.costPrice,
                basePrice: data.basePrice,
                taxRate: data.taxRate,
                isTaxIncluded: data.isTaxIncluded,
                minStockLevel: data.minStockLevel,
                isExpiryTracked: data.isExpiryTracked,
            }
        });

        // 5. Post-Create: Auto-Generate Barcode if missing
        if (!data.barcode && data.categoryId) {
            const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
            if (category && category.code) {
                // Format: CATCODE-PRODUCTID (e.g. C001-55)
                const autoBarcode = `${category.code}-${product.id.toString().padStart(4, '0')}`;
                await prisma.product.update({
                    where: { id: product.id },
                    data: { barcode: autoBarcode }
                });
            }
        }

    } catch (e) {
        console.error(e);
        return { message: 'Database Error: Failed to Create Product.' };
    }

    // 6. Revalidate & Redirect
    revalidatePath('/admin/products');
    redirect('/admin/products');
}
