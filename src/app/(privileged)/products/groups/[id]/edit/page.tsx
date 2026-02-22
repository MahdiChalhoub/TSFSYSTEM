import { erpFetch } from "@/lib/erp-api";
import { GroupedProductForm } from "@/components/admin/GroupedProductForm";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

async function getData(groupId: number) {
    try {
        const [group, brands, categories, units, countries] = await Promise.all([
            erpFetch(`product-groups/${groupId}/`),
            erpFetch('brands/'),
            erpFetch('inventory/categories/'),
            erpFetch('units/'),
            erpFetch('countries/')
        ]);

        if (!group) return null;

        return {
            initialGroup: group,
            brands,
            categories,
            units,
            countries
        };
    } catch (e) {
        console.error("Failed to fetch product group edit data:", e);
        return null;
    }
}

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getData(Number(id));

    if (!data) {
        notFound();
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Edit Product Family</h1>
                <p className="text-gray-500">Update the Parfum/Group details or add new variants.</p>
            </div>

            <GroupedProductForm {...data} />
        </div>
    );
}