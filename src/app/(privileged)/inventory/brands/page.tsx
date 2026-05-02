import { erpFetch, getTenantContext } from "@/lib/erp-api";
import { BrandsGateway } from "./BrandsGateway";
import { NoTenantNotice } from "./NoTenantNotice";

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
    // Brands are tenant-scoped — without a tenant context (e.g. on saas.* root)
    // every backend call 404s. Detect that upfront and render a clear notice
    // instead of the misleading "No brands yet" empty state.
    const tenant = await getTenantContext();
    if (!tenant) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <NoTenantNotice />
            </div>
        );
    }

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
