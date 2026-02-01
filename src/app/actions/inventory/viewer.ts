'use server';

import { prisma } from "@/lib/db";
import { getCurrentSiteId } from "@/app/actions/context";

export async function getGlobalInventory(options: {
    search?: string;
    categoryId?: number;
    brandId?: number;
    limit?: number;
    offset?: number;
} = {}) {
    const { search = '', categoryId, brandId, limit = 50, offset = 0 } = options;

    const sites = await prisma.site.findMany({
        where: { isActive: true },
        select: { id: true, name: true, code: true }
    });

    const where: any = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { sku: { contains: search, mode: 'insensitive' } },
            { barcode: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (brandId) where.brandId = brandId;

    const products = await prisma.product.findMany({
        where,
        include: {
            category: { select: { name: true } },
            brand: { select: { name: true } },
            unit: { select: { code: true } },
            inventory: {
                include: {
                    warehouse: {
                        select: { siteId: true }
                    }
                }
            }
        },
        orderBy: { name: 'asc' },
        take: limit,
        skip: offset,
    });

    const totalCount = await prisma.product.count({ where });

    // Process data to map quantities to sites
    const processedProducts = products.map(p => {
        const siteStock: Record<number, number> = {};
        sites.forEach(s => siteStock[s.id] = 0);

        p.inventory.forEach(item => {
            if (item.warehouse?.siteId) {
                siteStock[item.warehouse.siteId] += Number(item.quantity);
            }
        });

        const totalQty = Object.values(siteStock).reduce((a, b) => a + b, 0);

        return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            category: p.category?.name,
            brand: p.brand?.name,
            unit: p.unit?.code,
            siteStock,
            totalQty,
            costPrice: Number(p.costPrice)
        };
    });

    return {
        products: processedProducts,
        sites,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
    };
}
