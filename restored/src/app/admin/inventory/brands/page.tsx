import { erpFetch } from "@/lib/erp-api";
import { BrandManager } from "@/components/admin/BrandManager";

export const dynamic = 'force-dynamic';

async function getBrands() {
    return await erpFetch('brands/');
}

async function getCountries() {
    return await erpFetch('countries/');
}

async function getCategories() {
    return await erpFetch('categories/');
}

export default async function BrandsPage() {
    const [brands, countries, categories] = await Promise.all([
        getBrands(),
        getCountries(),
        getCategories()
    ]);

    return (
        <div className="animate-in fade-in duration-500">
            <BrandManager
                brands={brands}
                countries={countries}
                categories={categories}
            />
        </div>
    );
}