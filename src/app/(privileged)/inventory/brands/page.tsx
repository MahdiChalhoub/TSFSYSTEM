import { erpFetch } from "@/lib/erp-api";
import { BrandsGateway } from "./BrandsGateway";

export const dynamic = 'force-dynamic';

async function getBrands() {
    try { return await erpFetch('inventory/brands/?with_counts=true'); }
    catch { return []; }
}

async function getCountries() {
    try { return await erpFetch('countries/'); }
    catch { return []; }
}

async function getCategories() {
    try { return await erpFetch('inventory/categories/'); }
    catch { return []; }
}

export default async function BrandsPage() {
    const [brands, countries, categories] = await Promise.all([
        getBrands(),
        getCountries(),
        getCategories()
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <BrandsGateway
                brands={brands}
                countries={countries}
                categories={categories}
            />
        </div>
    );
}