import { prisma } from "@/lib/db";
import { AttributeManager } from "@/components/admin/AttributeManager";
import { getAttributes } from "@/app/actions/attributes";

export const dynamic = 'force-dynamic';

async function getCategories() {
    return await prisma.category.findMany({
        orderBy: { name: 'asc' }
    });
}

export default async function AttributesPage() {
    const [attributes, categories] = await Promise.all([
        getAttributes(),
        getCategories()
    ]);

    // Parse to ensure clean JSON for client component
    const cleanAttributes = JSON.parse(JSON.stringify(attributes));
    const cleanCategories = JSON.parse(JSON.stringify(categories));

    return (
        <div className="container mx-auto px-4 py-8">
            <AttributeManager attributes={cleanAttributes} categories={cleanCategories} />
        </div>
    );
}
