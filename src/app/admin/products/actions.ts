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
    categoryId: z.coerce.number().optional(), // Coerce to handle string input

    costPrice: z.coerce.number().min(0),
    basePrice: z.coerce.number().min(0),
    taxRate: z.coerce.number().min(0).max(1), // 0.11 for 11%
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
        description: formData.get('description'),
        sku: formData.get('sku'),
        barcode: formData.get('barcode'),
        categoryId: formData.get('categoryId'),
        costPrice: formData.get('costPrice'),
        basePrice: formData.get('basePrice'),
        taxRate: formData.get('taxRate'),
        isTaxIncluded: formData.get('isTaxIncluded') === 'on',
        minStockLevel: formData.get('minStockLevel'),
        isExpiryTracked: formData.get('isExpiryTracked') === 'on',
    };

    // 2. Validate
    const validatedFields = productSchema.safeParse(rawData);

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

        // 4. Create in DB
        await prisma.product.create({
            data: {
                name: data.name,
                description: data.description,
                sku: data.sku,
                barcode: data.barcode || null,
                categoryId: data.categoryId || null,
                costPrice: data.costPrice,
                basePrice: data.basePrice,
                taxRate: data.taxRate,
                isTaxIncluded: data.isTaxIncluded,
                minStockLevel: data.minStockLevel,
                isExpiryTracked: data.isExpiryTracked,
            }
        });

    } catch (e) {
        console.error(e);
        return { message: 'Database Error: Failed to Create Product.' };
    }

    // 5. Revalidate & Redirect
    revalidatePath('/admin/products');
    redirect('/admin/products');
}
