'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type MaintenanceEntity = {
    id: number;
    name: string;
    count: number;
    // Extra fields for specific types
    shortName?: string;
    code?: string;
    type?: string;
    children?: MaintenanceEntity[]; // For categories
};

export async function getMaintenanceEntities(type: 'category' | 'brand' | 'unit' | 'country' | 'attribute'): Promise<MaintenanceEntity[]> {
    if (type === 'category') {
        const categories = await prisma.category.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' }
        });

        // Build Tree
        const map = new Map<number, any>();
        const roots: any[] = [];
        categories.forEach((c: any) => map.set(c.id, { ...c, count: c._count.products, children: [] }));
        categories.forEach((c: any) => {
            if (c.parentId) {
                map.get(c.parentId)?.children.push(map.get(c.id));
            } else {
                roots.push(map.get(c.id));
            }
        });
        return JSON.parse(JSON.stringify(roots));
    }

    if (type === 'brand') {
        const brands = await prisma.brand.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' }
        });
        return brands.map((b: any) => ({
            id: b.id,
            name: b.name,
            count: b._count.products,
            shortName: b.shortName
        }));
    }

    if (type === 'unit') {
        const units = await prisma.unit.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' }
        });
        return units.map((u: any) => ({
            id: u.id,
            name: u.name,
            count: u._count.products,
            shortName: u.shortName,
            type: u.type
        }));
    }

    if (type === 'attribute') {
        const attributes = await prisma.parfum.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' }
        });
        return attributes.map((a: any) => ({
            id: a.id,
            name: a.name,
            count: a._count.products,
            shortName: a.shortName
        }));
    }

    if (type === 'country') {
        const countries = await prisma.country.findMany({
            include: { _count: { select: { products: true } } },
            orderBy: { name: 'asc' }
        });
        return countries.map((c: any) => ({
            id: c.id,
            name: c.name,
            count: c._count.products,
            code: c.code
        }));
    }

    return [];
}

export async function moveProductsGeneric(
    productIds: number[],
    targetId: number,
    type: 'category' | 'brand' | 'unit' | 'country' | 'attribute'
) {
    try {
        // --- VALIDATION PHASE ---

        // 1. Brand Validity (Moving TO a Brand)
        if (type === 'brand') {
            const targetBrand = await prisma.brand.findUnique({
                where: { id: targetId },
                include: { countries: true }
            });

            if (targetBrand && targetBrand.countries.length > 0) {
                // Brand is restricted to specific countries
                const products = await prisma.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, name: true, countryId: true, country: { select: { name: true } } }
                });

                const invalidProducts = products.filter(p => p.countryId && !targetBrand.countries.some((c: any) => c.id === p.countryId));

                if (invalidProducts.length > 0) {
                    const names = invalidProducts.slice(0, 3).map(p => p.name).join(', ');
                    return {
                        success: false,
                        message: `Validation Failed: Brand '${targetBrand.name}' does not operate in the countries of selected products (${names}${invalidProducts.length > 3 ? '...' : ''}).`
                    };
                }
            }
        }

        // 2. Country Validity (Moving TO a Country)
        if (type === 'country') {
            const products = await prisma.product.findMany({
                where: { id: { in: productIds } },
                include: { brand: { include: { countries: true } } }
            });

            const invalidProducts = products.filter(p => {
                if (!p.brand || !p.brand.countries || p.brand.countries.length === 0) return false; // Global brand
                return !p.brand.countries.some((c: any) => c.id === targetId);
            });

            if (invalidProducts.length > 0) {
                const names = invalidProducts.slice(0, 3).map(p => p.name).join(', ');
                return {
                    success: false,
                    message: `Validation Failed: The Brand of products (${names}...) does not support the selected Country.`
                };
            }
        }

        // 3. Attribute/Parfum Validity (Moving TO an Attribute)
        if (type === 'attribute') {
            const targetAttribute = await prisma.parfum.findUnique({
                where: { id: targetId },
                include: { categories: true }
            });

            if (targetAttribute && targetAttribute.categories.length > 0) {
                // Attribute is restricted to specific categories
                const products = await prisma.product.findMany({
                    where: { id: { in: productIds } },
                    select: { id: true, name: true, categoryId: true }
                });

                const invalidProducts = products.filter(p => p.categoryId && !targetAttribute.categories.some((c: any) => c.id === p.categoryId));

                if (invalidProducts.length > 0) {
                    const names = invalidProducts.slice(0, 3).map(p => p.name).join(', ');
                    return {
                        success: false,
                        message: `Validation Failed: Attribute '${targetAttribute.name}' is not compatible with the Category of selected products (${names}...).`
                    };
                }
            }
        }

        // --- EXECUTION PHASE ---
        const data: any = {};
        if (type === 'category') {
            data.categoryId = targetId;
            data.productGroupId = null; // Detach from group to maintain integrity
        }
        if (type === 'brand') {
            data.brandId = targetId;
            data.productGroupId = null; // Detach from group to maintain integrity
        }
        if (type === 'unit') data.unitId = targetId;
        if (type === 'country') data.countryId = targetId;
        if (type === 'attribute') data.parfumId = targetId;

        await prisma.product.updateMany({
            where: { id: { in: productIds } },
            data
        });

        // Revalidate basically everything to be safe
        revalidatePath('/admin/inventory');
        revalidatePath('/admin/products');

        return { success: true, message: `Successfully moved ${productIds.length} products.` };
    } catch (error) {
        console.error('Bulk Move Error:', error);
        return { success: false, message: 'Failed to move products.' };
    }
}
