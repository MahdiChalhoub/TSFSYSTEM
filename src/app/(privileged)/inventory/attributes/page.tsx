import { AttributeManager } from "@/components/admin/AttributeManager";
import { getAttributes } from "@/app/actions/attributes";
import { erpFetch } from "@/lib/erp-api";

export const dynamic = 'force-dynamic';

async function getCategories() {
    try {
        const categories = await erpFetch('inventory/categories/with_counts/');
        const data = Array.isArray(categories) ? categories : categories?.results || [];
        return data.sort((a: Record<string, any>, b: Record<string, any>) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error("Failed to fetch categories", e);
        return [];
    }
}

export default async function AttributesPage() {
    const [attributes, categories] = await Promise.all([
        getAttributes(),
        getCategories()
    ]);

    const attrData = Array.isArray(attributes) ? attributes : (attributes as any)?.results || [];
    const cleanAttributes = JSON.parse(JSON.stringify(attrData));
    const cleanCategories = JSON.parse(JSON.stringify(categories));

    return (
        <div className="app-page p-4 md:p-6" style={{ height: '100%' }}>
            <AttributeManager attributes={cleanAttributes} categories={cleanCategories} />
        </div>
    );
}