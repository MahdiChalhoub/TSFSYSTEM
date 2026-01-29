'use server';

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type CountryState = {
    message?: string;
    errors?: {
        name?: string[];
        code?: string[];
    };
};

export async function createCountry(prevState: CountryState, formData: FormData): Promise<CountryState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    if (!name || name.length < 2) {
        return { message: 'Failed to create country', errors: { name: ['Name must be at least 2 characters'] } };
    }
    if (!code || code.length < 2) {
        return { message: 'Failed to create country', errors: { code: ['Code must be valid (e.g. TR)'] } };
    }

    try {
        await prisma.country.create({
            data: {
                name,
                code: code.toUpperCase()
            }
        });

        revalidatePath('/admin/inventory/countries');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Database Error: Failed to create country.' };
    }
}

export async function updateCountry(id: number, prevState: CountryState, formData: FormData): Promise<CountryState> {
    const name = formData.get('name') as string;
    const code = formData.get('code') as string;

    try {
        await prisma.country.update({
            where: { id },
            data: {
                name,
                code: code.toUpperCase()
            }
        });
        revalidatePath('/admin/inventory/countries');
        return { message: 'success' };
    } catch (e) {
        return { message: 'Failed to update country' };
    }
}

export async function getCountryHierarchy(countryId: number) {
    const brands = await prisma.brand.findMany({
        where: { products: { some: { countryId } } },
        select: {
            id: true,
            name: true,
            logo: true,
            products: {
                where: { countryId },
                select: {
                    id: true,
                    name: true,
                    size: true,
                    sku: true,
                    unit: { select: { name: true } },
                    inventory: { select: { quantity: true } }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    return brands.map(b => {
        // Convert Decimal to Number for serialization
        const productsWithStock = b.products.map(p => ({
            ...p,
            size: p.size ? Number(p.size) : null,
            stock: p.inventory.reduce((sum, inv) => sum + Number(inv.quantity), 0)
        }));

        return {
            ...b,
            products: productsWithStock,
            totalStock: productsWithStock.reduce((sum, p) => sum + p.stock, 0)
        };
    });
}
