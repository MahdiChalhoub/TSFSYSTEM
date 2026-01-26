'use server';

import { prisma } from "@/lib/db";

export async function getPosProducts() {
    const products = await prisma.product.findMany({
        where: {
            // Only active products?
        },
        select: {
            id: true,
            name: true,
            basePrice: true,
            sku: true,
            taxRate: true,
            isTaxIncluded: true,
            // later image
        },
        orderBy: { name: 'asc' }
    });

    // Convert Decimals to numbers
    return products.map(p => ({
        ...p,
        basePrice: Number(p.basePrice),
        taxRate: Number(p.taxRate)
    }));
}
