'use server'

import { prisma } from "@/lib/db"

export async function searchProductsSimple(query: string, siteId?: number) {
    if (!query || query.length < 2) return []

    // Get products with basic info
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { name: { contains: query } },
                { sku: { contains: query } },
                { barcode: { contains: query } }
            ],
            status: 'ACTIVE'
        },
        include: {
            inventory: {
                select: {
                    quantity: true,
                    warehouseId: true,
                    warehouse: {
                        select: { siteId: true }
                    }
                }
            },
            // Get last purchase price
            orderLines: {
                where: {
                    order: {
                        type: 'PURCHASE',
                        status: 'COMPLETED'
                    }
                },
                orderBy: {
                    order: { createdAt: 'desc' }
                },
                take: 1,
                select: {
                    unitPrice: true,
                    order: {
                        select: { createdAt: true }
                    }
                }
            }
        },
        take: 10
    })

    // Calculate Velocity and Aggregate Stock
    const enhancedProducts = await Promise.all(products.map(async (p) => {
        // Aggregate stock level for selected site or globally
        let stockLevel = 0;
        if (siteId) {
            stockLevel = p.inventory
                .filter(i => i.warehouse.siteId === siteId)
                .reduce((sum, i) => sum + Number(i.quantity), 0);
        } else {
            stockLevel = p.inventory
                .reduce((sum, i) => sum + Number(i.quantity), 0);
        }

        // Calculate Daily Sales (Velocity) - Last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const salesData = await prisma.orderLine.aggregate({
            _sum: { quantity: true },
            where: {
                productId: p.id,
                order: {
                    type: 'SALE',
                    status: 'COMPLETED',
                    createdAt: { gte: thirtyDaysAgo }
                }
            }
        });

        const totalQtySold = Number(salesData._sum.quantity || 0);
        const dailySales = totalQtySold / 30;

        return {
            id: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            costPrice: Number(p.costPrice),
            costPriceHT: Number(p.costPriceHT),
            costPriceTTC: Number(p.costPriceTTC),
            sellingPriceHT: Number(p.sellingPriceHT),
            sellingPriceTTC: Number(p.sellingPriceTTC),
            lastPrice: p.orderLines.length > 0 ? Number(p.orderLines[0].unitPrice) : null,
            stockLevel,
            dailySales: Number(dailySales.toFixed(2)),
            taxRate: Number(p.taxRate || 0.11),
            // Qty Proposed logic: Enough for 14 days minus current stock
            proposedQty: Math.max(0, Math.ceil(dailySales * 14 - stockLevel))
        }
    }))

    return enhancedProducts
}
