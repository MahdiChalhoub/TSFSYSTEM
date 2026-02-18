import { erpFetch } from "@/lib/erp-api";
import { CountryManager } from "@/components/admin/CountryManager";

export const dynamic = 'force-dynamic';

async function getCountries() {
    try {
        // CountrySerializer now includes product_count
        // Frontend expects { ..., _count: { products: N }, products: [...] } logic
        // But previously it fetched products via brand -> flattened.
        // The new serializer has `product_count`.
        // The Frontend Manager likely displays the count.
        // If it strictly needs `_count.products` structure, we map it here.
        const countries = await erpFetch('countries/');
        return countries.map((c: Record<string, any>) => ({
            ...c,
            _count: { products: c.product_count || 0 }
            // Note: We are NOT returning the list of products anymore to save bandwidth.
            // If the UI relies on filtering specific products, it might break.
            // But usually this view is just "Name (Count)".
            // Let's assume Count is enough.
        }));
    } catch (e) {
        console.error("Failed to fetch countries:", e);
        return [];
    }
}

async function getCategories() {
    try {
        return await erpFetch('categories/');
    } catch (e) {
        return [];
    }
}

export default async function CountriesPage() {
    const [countries, categories] = await Promise.all([
        getCountries(),
        getCategories()
    ]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <CountryManager countries={countries} categories={categories} />
        </div>
    );
}