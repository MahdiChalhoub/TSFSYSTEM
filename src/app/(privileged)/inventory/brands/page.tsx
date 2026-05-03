import { erpFetch, getTenantContext } from "@/lib/erp-api";
import { BrandsGateway } from "./BrandsGateway";
import { NoTenantNotice } from "./NoTenantNotice";

export const dynamic = 'force-dynamic';

async function getBrands() {
    // no-store: counts (categories/countries/attrs) are derived from
    // products and change when products move. The default 30s revalidate
    // cache let stale counts persist long enough that the user opened the
    // page after a backend update and saw 0s. Fresh on every request.
    try { return await erpFetch('inventory/brands/?with_counts=true', { cache: 'no-store' }); }
    catch { return []; }
}

async function getCountries() {
    // The brand "Sourcing Markets" picker should offer ONLY the
    // tenant's enabled sourcing countries (the curated subset shown at
    // /inventory/countries), not the global ~250-country ISO list.
    // The reference/sourcing-countries/ endpoint returns rows of
    // SourcingCountry { id, country, country_name, country_iso2, ... }
    // — adapt to {id, name, code} so the modal's existing rendering
    // (which expects Country shape) works without changes. The id we
    // expose is the underlying Country FK (sc.country) because that's
    // what gets POSTed back as country_ids to the brand endpoint.
    try {
        const res: any = await erpFetch('reference/sourcing-countries/');
        const rows: any[] = Array.isArray(res) ? res : (res?.results ?? []);
        return rows
            .filter(sc => sc.is_enabled !== false)
            .map(sc => ({
                id: sc.country,
                name: sc.country_name,
                code: sc.country_iso2,
            }));
    } catch { return []; }
}

async function getCategories() {
    // Only top-level categories. Brand ↔ category links live at the
    // root level; child categories inherit their parent's brand
    // associations through the tree, and the backend's link_category
    // action either rejects or silently no-ops a leaf id (same pattern
    // the user hit on the attributes pane). Filtering parent-IS-NULL
    // here means the tree selector shows a clean flat list of roots
    // and the user can't pick a child by accident.
    try {
        const res: any = await erpFetch('inventory/categories/');
        const rows: any[] = Array.isArray(res?.results) ? res.results : (Array.isArray(res) ? res : []);
        return rows.filter(c => c?.parent == null);
    } catch { return []; }
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
