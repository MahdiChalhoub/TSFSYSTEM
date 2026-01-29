import { prisma } from "@/lib/db";
import { GroupedProductForm } from "@/components/admin/GroupedProductForm";

export const dynamic = 'force-dynamic';

async function getData() {
    const [brands, categories, units, countries] = await Promise.all([
        prisma.brand.findMany({ include: { countries: true }, orderBy: { name: 'asc' } }),
        prisma.category.findMany({ orderBy: { name: 'asc' } }),
        prisma.unit.findMany({ orderBy: { name: 'asc' } }),
        prisma.country.findMany({ orderBy: { name: 'asc' } })
    ]);

    return {
        brands: JSON.parse(JSON.stringify(brands)),
        categories: JSON.parse(JSON.stringify(categories)),
        units: JSON.parse(JSON.stringify(units)),
        countries: JSON.parse(JSON.stringify(countries))
    };
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
