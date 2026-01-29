'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type BrandState = {
    message?: string;
    errors?: {
        name?: string[];
        countryId?: string[];
    };
};

export async function createBrand(prevState: BrandState, formData: FormData): Promise<BrandState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const countryIds = formData.getAll('countryIds').map(id => Number(id));
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    if (!name || name.length < 2) {
        return { message: 'Failed to create brand', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await prisma.brand.create({
            data: {
                name,
                shortName,
                countries: {
                    connect: countryIds.map(id => ({ id }))
                },
                categories: {
                    connect: categoryIds.map(id => ({ id }))
                }
            }
        });

        revalidatePath('/admin/inventory/brands');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Database Error: Failed to create brand.' };
    }
}

export async function updateBrand(id: number, prevState: BrandState, formData: FormData): Promise<BrandState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const countryIds = formData.getAll('countryIds').map(id => Number(id));
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    try {
        // For implicit M-N, we can use set: [{id:1}, {id:2}] to replace.
        await prisma.brand.update({
            where: { id },
            data: {
                name,
                shortName,
                countries: {
                    set: countryIds.map(id => ({ id }))
                },
                categories: {
                    set: categoryIds.map(id => ({ id }))
                }
            }
        });
        revalidatePath('/admin/inventory/brands');
        revalidatePath('/admin/inventory/countries'); // Update country view too
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to update brand' };
    }
}

/**
 * Get brands filtered by category with parent inheritance
 * @param categoryId - The selected category ID (null = all brands)
 * @returns Brands that:
 *   1. Are universal (no categories linked)
 *   2. Are directly linked to this category
 *   3. Are linked to any parent category (inheritance)
 */
export async function getBrandsByCategory(categoryId: number | null) {
    // If no category selected, return all brands
    if (!categoryId) {
        return prisma.brand.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                shortName: true
            }
        });
    }

    // Get the category with its parent hierarchy
    const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true, parentId: true }
    });

    if (!category) {
        return [];
    }

    // Build array of category IDs to check (self + all parents)
    const categoryIdsToCheck: number[] = [category.id];
    let currentParentId = category.parentId;

    // Walk up the parent tree
    while (currentParentId) {
        categoryIdsToCheck.push(currentParentId);
        const parent = await prisma.category.findUnique({
            where: { id: currentParentId },
            select: { parentId: true }
        });
        currentParentId = parent?.parentId || null;
    }

    // Get brands that match criteria
    const brands = await prisma.brand.findMany({
        where: {
            OR: [
                // Universal brands (no categories linked)
                {
                    categories: {
                        none: {}
                    }
                },
                // Brands linked to this category or its parents
                {
                    categories: {
                        some: {
                            id: {
                                in: categoryIdsToCheck
                            }
                        }
                    }
                }
            ]
        },
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            shortName: true,
            categories: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    return brands;
}

// --- Hierarchy Helper for Frontend ---
export async function getBrandHierarchy(brandId: number) {
    try {
        const brand = await prisma.brand.findUnique({
            where: { id: brandId },
            include: {
                productGroups: {
                    include: {
                        products: { include: { country: true, inventory: true, unit: true } }
                    }
                },
                products: {
                    where: { productGroupId: null },
                    include: { country: true, inventory: true, unit: true }
                }
            }
        });

        if (!brand) return null;

        return {
            groups: brand.productGroups.map(g => ({
                id: g.id,
                name: g.name,
                products: g.products.map(p => ({
                    id: p.id,
                    name: p.name,
                    sku: p.sku,
                    countryName: p.country?.name,
                    size: Number(p.size),
                    unitName: p.unit?.shortName,
                    stock: p.inventory.reduce((a, b) => a + Number(b.quantity), 0)
                })),
                totalStock: g.products.reduce((acc, p) => acc + p.inventory.reduce((a, b) => a + Number(b.quantity), 0), 0)
            })),
            looseProducts: brand.products.map(p => ({
                id: p.id,
                name: p.name,
                sku: p.sku,
                countryName: p.country?.name,
                size: Number(p.size),
                unitName: p.unit?.shortName,
                stock: p.inventory.reduce((a, b) => a + Number(b.quantity), 0)
            }))
        };
    } catch (e) {
        console.error("Error fetching hierarchy:", e);
        return null;
    }
}
