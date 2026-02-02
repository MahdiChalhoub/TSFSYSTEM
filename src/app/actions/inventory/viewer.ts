'use server'

import { erpFetch } from "@/lib/erp-api"

export async function getGlobalInventory(options: {
    search?: string;
    categoryId?: number;
    brandId?: number;
    limit?: number;
    offset?: number;
} = {}) {
    const { search = '', categoryId, brandId, limit = 50, offset = 0 } = options;

    try {
        const query = new URLSearchParams({
            search,
            limit: limit.toString(),
            offset: offset.toString()
        })
        if (categoryId) query.append('categoryId', categoryId.toString())
        if (brandId) query.append('brandId', brandId.toString())

        const result = await erpFetch(`inventory/viewer/?${query.toString()}`)

        return {
            products: result.products,
            sites: result.sites,
            totalCount: result.totalCount,
            totalPages: Math.ceil(result.totalCount / limit)
        }
    } catch (error) {
        console.error("Failed to fetch global inventory:", error)
        return {
            products: [],
            sites: [],
            totalCount: 0,
            totalPages: 0
        }
    }
}
