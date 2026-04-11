'use server'

/**
 * Product Explorer Server Actions
 * ================================
 * Fetches all products with their brand, country, attribute, and packaging
 * data in a single payload for client-side tree construction.
 * Also fetches InventoryGroups for overlay badges.
 */

import { erpFetch } from "@/lib/erp-api"

export interface ExplorerProduct {
    id: number
    name: string
    sku: string
    brand_id: number | null
    brand_name: string
    country_id: number | null
    country_name: string
    parfum_id: number | null
    parfum_name: string
    category_id: number | null
    category_name: string
    size: number | null
    size_unit: string
    selling_price_ttc: number
    cost_price: number
    image_url: string | null
    packaging_count: number
}

export interface ExplorerBrand {
    id: number
    name: string
    logo: string | null
}

export interface ExplorerCountry {
    id: number
    name: string
    iso2: string
    flag: string
}

export interface ExplorerAttribute {
    id: number
    name: string
    values: { id: number; value: string }[]
}

export interface ExplorerGroup {
    id: number
    name: string
    group_type: string
    brand_name: string | null
    approval_status: string
    member_count: number
    members: { product_id: number; origin_label: string; substitution_role: string }[]
}

export interface ExplorerData {
    products: ExplorerProduct[]
    brands: ExplorerBrand[]
    countries: ExplorerCountry[]
    attributes: ExplorerAttribute[]
    groups: ExplorerGroup[]
}

/**
 * Fetch all data for the product explorer in parallel.
 */
export async function getExplorerData(): Promise<ExplorerData> {
    try {
        const [productsRaw, brandsRaw, attributesRaw, groupsRaw] = await Promise.all([
            erpFetch('inventory/products/?page_size=9999&fields=id,name,sku,brand,brand_name,country_of_origin,country,parfum,parfum_name,category,category_name,size,size_unit,selling_price_ttc,cost_price,image_url'),
            erpFetch('inventory/brands/?page_size=9999'),
            erpFetch('inventory/product-attributes/?page_size=9999'),
            erpFetch('inventory/inventory-groups/?page_size=9999'),
        ])

        const productList = Array.isArray(productsRaw) ? productsRaw : productsRaw?.results || []
        const brandList = Array.isArray(brandsRaw) ? brandsRaw : brandsRaw?.results || []
        const attributeList = Array.isArray(attributesRaw) ? attributesRaw : attributesRaw?.results || []
        const groupList = Array.isArray(groupsRaw) ? groupsRaw : groupsRaw?.results || []

        // Build country map from products
        const countryMap = new Map<number, ExplorerCountry>()
        for (const p of productList) {
            const cid = p.country_of_origin || p.country
            if (cid && !countryMap.has(cid)) {
                const cname = p.country_of_origin_name || p.country_name || `Country ${cid}`
                const iso2 = p.country_of_origin_iso2 || ''
                countryMap.set(cid, {
                    id: cid,
                    name: cname,
                    iso2,
                    flag: iso2 ? String.fromCodePoint(
                        ...([...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
                    ) : '🏳️',
                })
            }
        }

        const products: ExplorerProduct[] = productList.map((p: any) => ({
            id: p.id,
            name: p.name || '',
            sku: p.sku || '',
            brand_id: p.brand || null,
            brand_name: p.brand_name || 'Unbranded',
            country_id: p.country_of_origin || p.country || null,
            country_name: p.country_of_origin_name || p.country_name || 'Unknown',
            parfum_id: p.parfum || null,
            parfum_name: p.parfum_name || '',
            category_id: p.category || null,
            category_name: p.category_name || '',
            size: p.size ? parseFloat(p.size) : null,
            size_unit: p.size_unit_name || p.size_unit_code || '',
            selling_price_ttc: parseFloat(p.selling_price_ttc) || 0,
            cost_price: parseFloat(p.cost_price) || 0,
            image_url: p.image_url || null,
            packaging_count: p.packaging_levels?.length || 0,
        }))

        const brands: ExplorerBrand[] = brandList.map((b: any) => ({
            id: b.id,
            name: b.name || '',
            logo: b.logo || null,
        }))

        const attributes: ExplorerAttribute[] = attributeList.map((a: any) => ({
            id: a.id,
            name: a.name || '',
            values: (a.values || []).map((v: any) => ({ id: v.id, value: v.value || '' })),
        }))

        const groups: ExplorerGroup[] = groupList.map((g: any) => ({
            id: g.id,
            name: g.name || '',
            group_type: g.group_type || 'EXACT',
            brand_name: g.brand_name || null,
            approval_status: g.approval_status || 'APPROVED',
            member_count: g.members?.length || 0,
            members: (g.members || []).map((m: any) => ({
                product_id: m.product || m.product_id,
                origin_label: m.origin_label || '',
                substitution_role: m.substitution_role || 'TWIN',
            })),
        }))

        return {
            products,
            brands,
            countries: Array.from(countryMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
            attributes,
            groups,
        }
    } catch (error) {
        console.error("[Explorer] Failed to fetch data:", error)
        return { products: [], brands: [], countries: [], attributes: [], groups: [] }
    }
}
