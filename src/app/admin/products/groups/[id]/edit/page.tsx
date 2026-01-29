
import { prisma } from "@/lib/db";
import { GroupedProductForm } from "@/components/admin/GroupedProductForm";
import { notFound } from "next/navigation";

export const dynamic = 'force-dynamic';

async function getData(groupId: number) {
    const [group, brands, categories, units, countries] = await Promise.all([
        prisma.productGroup.findUnique({
            where: { id: groupId },
            include: {
                products: true
            }
        }),
        prisma.brand.findMany({ include: { countries: true }, orderBy: { name: 'asc' } }),
        prisma.category.findMany({ orderBy: { name: 'asc' } }),
        prisma.unit.findMany({ orderBy: { name: 'asc' } }),
        prisma.country.findMany({ orderBy: { name: 'asc' } })
    ]);

    if (!group) return null;

    return {
        initialGroup: JSON.parse(JSON.stringify(group)),
        brands: JSON.parse(JSON.stringify(brands)),
        categories: JSON.parse(JSON.stringify(categories)),
        units: JSON.parse(JSON.stringify(units)),
        countries: JSON.parse(JSON.stringify(countries))
    };
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
