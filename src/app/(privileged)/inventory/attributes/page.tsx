import { AttributeManager } from "@/components/admin/AttributeManager";
import { getAttributes } from "@/app/actions/attributes";
import { erpFetch } from "@/lib/erp-api";

export const dynamic = 'force-dynamic';

async function getCategories() {
    try {
        const categories = await erpFetch('categories/');
        return categories.sort((a: Record<string, any>, b: Record<string, any>) => a.name.localeCompare(b.name));
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

    const cleanAttributes = JSON.parse(JSON.stringify(attributes));
    const cleanCategories = JSON.parse(JSON.stringify(categories));

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <AttributeManager attributes={cleanAttributes} categories={cleanCategories} />
        </div>
    );
}