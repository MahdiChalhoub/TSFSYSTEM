'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type CategoryState = {
    message?: string;
    errors?: {
        name?: string[];
    };
};

export async function createCategory(prevState: CategoryState, formData: FormData): Promise<CategoryState> {
    const name = formData.get('name') as string;
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null;
    const code = (formData.get('code') as string) || null;
    const shortName = (formData.get('shortName') as string) || null;

    if (!name || name.length < 2) {
        return { message: 'Failed to create category', errors: { name: ['Name must be at least 2 characters'] } };
    }

    try {
        await prisma.category.create({
            data: {
                name,
                parentId,
                code,
                shortName
            }
        });

        revalidatePath('/admin/inventory/categories');
        return { message: 'success' };
    } catch (e: any) {
        if (e.code === 'P2002') {
            return { message: 'Category code must be unique' };
        }
        return { message: 'Failed to create category' };
    }
}

export async function updateCategory(id: number, prevState: CategoryState, formData: FormData): Promise<CategoryState> {
    const name = formData.get('name') as string;
    const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null;
    const code = (formData.get('code') as string) || null;
    const shortName = (formData.get('shortName') as string) || null;

    try {
        // Prevent setting parent to itself
        if (parentId === id) {
            return { message: 'Category cannot be its own parent' };
        }

        await prisma.category.update({
            where: { id },
            data: {
                name,
                parentId,
                code,
                shortName
            }
        });
        revalidatePath('/admin/inventory/categories');
        return { message: 'success' };
    } catch (e: any) {
        if (e.code === 'P2002') {
            return { message: 'Category code must be unique' };
        }
        return { message: 'Failed to update category' };
    }
}

export async function deleteCategory(id: number) {
    try {
        await prisma.category.delete({
            where: { id }
        });
        revalidatePath('/admin/inventory/categories');
        return { success: true };
    } catch (e) {
        return { success: false, message: 'Failed to delete category' };
    }
}

export async function getCategoryWithCounts() {
    return await prisma.category.findMany({
        orderBy: { name: 'asc' },
        include: {
            _count: {
                select: { products: true }
            }
        }
    });
}

export async function moveProducts(productIds: number[], targetCategoryId: number) {
    try {
        await prisma.product.updateMany({
            where: {
                id: { in: productIds }
            },
            data: {
                categoryId: targetCategoryId
            }
        });

        revalidatePath('/admin/inventory/categories/maintenance');
        revalidatePath('/admin/inventory/categories'); // Update main list too
        return { success: true };
    } catch (e) {
        console.error('Move products error:', e);
        return { success: false, message: 'Failed to move products' };
    }
}
