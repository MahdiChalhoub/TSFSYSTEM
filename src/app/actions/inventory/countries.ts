'use server'

/**
 * Inventory Countries Server Actions
 * ====================================
 * Fetches org-enabled countries enriched with product/brand counts.
 * Countries come from Settings → Regional (OrgCountry).
 */

import { erpFetch } from "@/lib/erp-api"
import { getOrgCountries, getRefCountries } from "@/app/actions/reference"

export interface InventoryCountry {
    id: number
    name: string
    iso2: string
    iso3?: string
    region?: string
    phone_code?: string
    currency_code?: string
    flag: string
    productCount: number
    brandCount: number
    isDefault: boolean
}

/**
 * Fetch the org's enabled countries, enriched with product/brand counts.
 */
export async function getInventoryCountries(): Promise<InventoryCountry[]> {
    try {
        const [orgCountries, refCountries] = await Promise.all([
            getOrgCountries(),
            getRefCountries(),
        ])

        // Build a lookup of reference country data
        const refMap = new Map(refCountries.map(c => [c.id, c]))

        // Fetch product counts per country (using country_of_origin which references reference.Country)
        let productCounts: Record<number, number> = {}
        let brandCounts: Record<number, number> = {}
        try {
            const products = await erpFetch('inventory/products/?fields=country_of_origin,country&page_size=9999')
            const productList = Array.isArray(products) ? products : products?.results || []
            for (const p of productList) {
                const cid = p.country_of_origin || p.country
                if (cid) productCounts[cid] = (productCounts[cid] || 0) + 1
            }
        } catch { /* counts optional */ }

        try {
            const brands = await erpFetch('inventory/brands/?page_size=9999')
            const brandList = Array.isArray(brands) ? brands : brands?.results || []
            for (const b of brandList) {
                const countries = b.countries || []
                for (const c of countries) {
                    const cid = typeof c === 'number' ? c : c.id
                    if (cid) brandCounts[cid] = (brandCounts[cid] || 0) + 1
                }
            }
        } catch { /* counts optional */ }

        // Map org countries to inventory countries
        return orgCountries.map(oc => {
            const ref = refMap.get(oc.country)
            const iso2 = String(ref?.iso2 || oc.country_iso2 || '')
            return {
                id: oc.country,
                name: ref?.name || oc.country_name || 'Unknown',
                iso2,
                iso3: String(ref?.iso3 ?? ''),
                region: ref?.region,
                phone_code: String(ref?.phone_code ?? ''),
                currency_code: String(ref?.default_currency_code ?? ''),
                flag: iso2 ? String.fromCodePoint(
                    ...([...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
                ) : '🏳️',
                productCount: productCounts[oc.country] || 0,
                brandCount: brandCounts[oc.country] || 0,
                isDefault: oc.is_default || false,
            }
        }).sort((a, b) => a.name.localeCompare(b.name))
    } catch (error) {
        console.error("[Inventory] Failed to fetch countries:", error)
        return []
    }
}

/**
 * Get products for a specific country (for hierarchy expansion)
 */
export async function getCountryProducts(countryId: number) {
    try {
        // Try country_of_origin first (correct FK to reference.Country), fallback to legacy country
        let result = await erpFetch(`inventory/products/?country_of_origin=${countryId}&page_size=50`)
        let products = Array.isArray(result) ? result : result?.results || []
        if (products.length === 0) {
            result = await erpFetch(`inventory/products/?country=${countryId}&page_size=50`)
            products = Array.isArray(result) ? result : result?.results || []
        }
        return products.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || p.reference,
            brand: p.brand_name,
            category: p.category_name,
        }))
    } catch {
        return []
    }
}