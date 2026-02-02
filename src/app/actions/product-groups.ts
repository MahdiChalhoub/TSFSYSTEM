'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type VariantInput = {
    id?: number; // Optional for existing variants
    countryId: number;
    sku: string;
    barcode?: string;
    size?: number;
    sizeUnitId?: number;
    costPrice: number;
    basePrice: number;
    minStockLevel?: number;

    // New Pricing Fields
    costPriceHT?: number;
    costPriceTTC?: number;
    sellingPriceHT?: number;
    sellingPriceTTC?: number;
    taxRate?: number;
};

export type ProductGroupState = {
    message?: string;
    errors?: Record<string, string[]>;
};

export async function createProductGroupWithVariants(
    prevState: ProductGroupState,
    data: {
        name: string;
        brandId: number;
        categoryId?: number;
        description?: string;
        baseUnitId: number;
        variants: VariantInput[];
    }
) { // Removed strict Promise<ProductGroupState> return type annotation to let inference work if needed, or keep it.
    const { name, brandId, categoryId, description, baseUnitId, variants } = data;

    if (!name || variants.length === 0) {
        return { message: "Name and at least one variant are required." };
    }

    try {
        await prisma.$transaction(async (tx) => {
            const group = await tx.productGroup.create({
                data: {
                    name,
                    brandId,
                    categoryId,
                    description
                }
            });

            for (const v of variants) {
                await tx.product.create({
                    data: {
                        name: `${name}`,
                        productGroupId: group.id,
                        brandId,
                        categoryId,
                        unitId: baseUnitId,
                        countryId: v.countryId,
                        sku: v.sku,
                        barcode: v.barcode,
                        size: v.size,
                        sizeUnitId: v.sizeUnitId,

                        costPrice: v.costPrice,
                        costPriceHT: v.costPriceHT || 0,
                        costPriceTTC: v.costPriceTTC || 0,

                        basePrice: v.basePrice,
                        sellingPriceHT: v.sellingPriceHT || 0,
                        sellingPriceTTC: v.sellingPriceTTC || 0,

                        taxRate: v.taxRate || 0,

                        minStockLevel: v.minStockLevel || 0,
                        isTaxIncluded: true
                    }
                });
            }
        });

        revalidatePath('/admin/products');
        return { message: 'success' };
    } catch (e: any) {
        console.error(e);
        return { message: e.message || 'Failed to create product group.' };
    }
}

export async function updateProductGroup(
    prevState: ProductGroupState,
    data: {
        groupId: number;
        name: string;
        brandId: number;
        categoryId?: number;
        description?: string;
        baseUnitId: number;
        variants: VariantInput[];
    }
) {
    const { groupId, name, brandId, categoryId, description, baseUnitId, variants } = data;

    if (!groupId || !name) return { message: "Group ID and Name are required." };

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Update Group
            await tx.productGroup.update({
                where: { id: groupId },
                data: { name, brandId, categoryId, description }
            });

            for (const v of variants) {
                if (v.id) {
                    // Update existing
                    await tx.product.update({
                        where: { id: v.id },
                        data: {
                            countryId: v.countryId,
                            sku: v.sku,
                            barcode: v.barcode,
                            size: v.size,
                            sizeUnitId: v.sizeUnitId,

                            costPrice: v.costPrice,
                            costPriceHT: v.costPriceHT, // Prisma checks for undefined, so safe
                            costPriceTTC: v.costPriceTTC,

                            basePrice: v.basePrice,
                            sellingPriceHT: v.sellingPriceHT,
                            sellingPriceTTC: v.sellingPriceTTC,
                            taxRate: v.taxRate,

                            unitId: baseUnitId, // Ensure unit matches master
                            name: name // Update name if group name changed
                        }
                    });
                } else {
                    // Create new
                    await tx.product.create({
                        data: {
                            name: name,
                            productGroupId: groupId,
                            brandId,
                            categoryId,
                            unitId: baseUnitId,
                            countryId: v.countryId,
                            sku: v.sku,
                            barcode: v.barcode,
                            size: v.size,
                            sizeUnitId: v.sizeUnitId,
                            costPrice: v.costPrice,
                            costPriceHT: v.costPriceHT || 0,
                            costPriceTTC: v.costPriceTTC || 0,

                            basePrice: v.basePrice,
                            sellingPriceHT: v.sellingPriceHT || 0,
                            sellingPriceTTC: v.sellingPriceTTC || 0,
                            taxRate: v.taxRate || 0,

                            minStockLevel: v.minStockLevel || 0,
                            isTaxIncluded: true
                        }
                    });
                }
            }
        });

        revalidatePath('/admin/products');
        revalidatePath(`/admin/inventory/brands/${brandId}`); // Revalidate brand page
        return { message: 'success' };
    } catch (e: any) {
        console.error(e);
        return { message: e.message || 'Failed to update product group.' };
    }
}
// --- Grouping Existing Products ---

export async function linkProductsToGroup(productIds: number[], groupId: number) {
    try {
        const group = await prisma.productGroup.findUnique({ where: { id: groupId } });
        if (!group) return { success: false, message: 'Group not found.' };

        // Link and Align metadata
        await prisma.product.updateMany({
            where: { id: { in: productIds } },
            data: {
                productGroupId: groupId,
                brandId: group.brandId || undefined,
                categoryId: group.categoryId || undefined
            }
        });

        revalidatePath('/admin/products');
        revalidatePath('/admin/inventory/maintenance');
        return { success: true, message: 'Successfully linked products to group.' };
    } catch (e: any) {
        console.error(e);
        return { success: false, message: e.message || 'Failed to link products.' };
    }
}

export async function createGroupFromProducts(
    productIds: number[],
    data: { name: string, description?: string }
) {
    try {
        const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
        if (products.length === 0) return { success: false, message: 'No products selected.' };

        const template = products[0];
        if (!template.brandId) return { success: false, message: 'Selected reference product must have a Brand.' };

        // Create Group
        const group = await prisma.productGroup.create({
            data: {
                name: data.name,
                description: data.description,
                brandId: template.brandId,
                categoryId: template.categoryId
            }
        });

        // Link Products
        await prisma.product.updateMany({
            where: { id: { in: productIds } },
            data: {
                productGroupId: group.id,
                brandId: template.brandId,
                categoryId: template.categoryId
            }
        });

        revalidatePath('/admin/products');
        revalidatePath('/admin/inventory/maintenance');
        return { success: true, message: 'Successfully created group from products.' };
    } catch (e: any) {
        console.error(e);
        return { success: false, message: e.message || 'Failed to create group.' };
    }
}
