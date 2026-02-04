import { erpFetch } from "@/lib/erp-api";
import { GroupedProductForm } from "@/components/admin/GroupedProductForm";

export const dynamic = 'force-dynamic';

async function getData() {
    try {
        const [brands, categories, units, countries] = await Promise.all([
            erpFetch('brands/'),
            erpFetch('categories/'),
            erpFetch('units/'),
            erpFetch('countries/')
        ]);

        return {
            brands,
            categories,
            units,
            countries
        };
    } catch (e) {
        console.error("Failed to fetch product group metadata:", e);
        return { brands: [], categories: [], units: [], countries: [] };
    }
}

export default async function CreateGroupPage() {
    const data = await getData();

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Create Product Group</h1>
                <p className="text-gray-500">Define a master product (e.g. Head & Shoulders) and its country-specific variants.</p>
            </div>

            <GroupedProductForm {...data} />
        </div>
    );
}
