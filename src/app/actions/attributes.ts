'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AttributeState = {
    message?: string;
    errors?: {
        name?: string[];
    };
};

export async function getAttributes() {
    return await prisma.parfum.findMany({
        include: {
            categories: true,
            _count: { select: { products: true } }
        },
        orderBy: { name: 'asc' }
    });
}

export async function createAttribute(prevState: AttributeState, formData: FormData): Promise<AttributeState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    if (!name || name.length < 2) {
        return { message: 'Failed to create attribute', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await prisma.parfum.create({
            data: {
                name,
                shortName: shortName || null,
                categories: {
                    connect: categoryIds.map(id => ({ id }))
                }
            }
        });

        revalidatePath('/admin/inventory/attributes');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Database Error: Failed to create attribute.' };
    }
}

export async function updateAttribute(id: number, prevState: AttributeState, formData: FormData): Promise<AttributeState> {
    const name = formData.get('name') as string;
    const shortName = formData.get('shortName') as string;
    const categoryIds = formData.getAll('categoryIds').map(id => Number(id));

    try {
        await prisma.parfum.update({
            where: { id },
            data: {
                name,
                shortName: shortName || null,
                categories: {
                    set: categoryIds.map(id => ({ id }))
                }
            }
        });
        revalidatePath('/admin/inventory/attributes');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to update attribute' };
    }
}

export async function deleteAttribute(id: number, prevState: AttributeState, formData: FormData): Promise<AttributeState> {
    try {
        await prisma.parfum.delete({ where: { id } });
        revalidatePath('/admin/inventory/attributes');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to delete attribute. It may be in use.' };
    }
}

/**
 * Get attributes (parfums) filtered by category with parent inheritance
 * @param categoryId - The selected category ID (null = all attributes)
 */
export async function getAttributesByCategory(categoryId: number | null) {
    if (!categoryId) {
        return prisma.parfum.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, shortName: true }
        });
    }

    // Get the category with its parent hierarchy
    const category = await prisma.category.findUnique({
        where: { id: categoryId },
        select: { id: true, parentId: true }
    });

    if (!category) return [];

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

    // Get attributes that match criteria
    const attributes = await prisma.parfum.findMany({
        where: {
            OR: [
                // Universal attributes (no categories linked)
                {
                    categories: {
                        none: {}
                    }
                },
                // Attributes linked to this category or its parents
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
                select: { id: true, name: true }
            }
        }
    });

    return attributes;
}

export async function getAttributeHierarchy(parfumId: number) {
    const brands = await prisma.brand.findMany({
        where: { products: { some: { parfumId } } },
        select: {
            id: true,
            name: true,
            logo: true,
            products: {
                where: { parfumId },
                select: {
                    id: true,
                    name: true,
                    size: true,
                    sku: true,
                    country: { select: { name: true, code: true } },
                    unit: { select: { name: true } },
                    inventory: { select: { quantity: true } }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    if (!brands) return [];

    return brands.map(b => {
        // Fix Decimal serialization for size
        const productsWithStock = b.products.map(p => ({
            ...p,
            size: p.size ? Number(p.size) : null,
            stock: p.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0)
        }));

        return {
            id: b.id,
            name: b.name,
            logo: b.logo,
            products: productsWithStock,
            totalStock: productsWithStock.reduce((sum, p) => sum + p.stock, 0)
        };
    });
}
