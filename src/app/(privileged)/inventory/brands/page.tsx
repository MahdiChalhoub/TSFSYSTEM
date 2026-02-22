import { erpFetch } from "@/lib/erp-api";
import { BrandsClient } from "./BrandsClient";

export const dynamic = 'force-dynamic';

async function getBrandsData() {
    try {
        const brands = await erpFetch('brands/');
        return (brands as any[]) || [];
    } catch {
        return [];
    }
}

async function getCountriesData() {
    try {
        const countries = await erpFetch('countries/');
        return (countries as any[]) || [];
    } catch {
        return [];
    }
}

async function getCategoriesData() {
    try {
        const categories = await erpFetch('inventory/categories/');
        return (categories as any[]) || [];
    } catch {
        return [];
    }
}

export default async function BrandsPage() {
    const [brands, countries, categories] = await Promise.all([
        getBrandsData(),
        getCountriesData(),
        getCategoriesData()
    ]);

    return (
        <BrandsClient
            initialBrands={brands}
            countries={countries}
            categories={categories}
        />
    );
}