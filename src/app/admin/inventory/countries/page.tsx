import { prisma } from "@/lib/db";
import { CountryManager } from "@/components/admin/CountryManager";

export const dynamic = 'force-dynamic';

async function getCountries() {
    const countries = await prisma.country.findMany({
        orderBy: { name: 'asc' }
    });

    // Strategy 3: Fetch via Brand Relation (mirroring the Tree View logic)
    // This ensures that whatever shows in the Tree View is counted on the Badge.
    const brandsData = await prisma.brand.findMany({
        select: {
            products: {
                where: { countryId: { not: null } },
                select: { countryId: true, categoryId: true }
            }
        }
    });

    // Flatten all products found via brands
    const connectedProducts = brandsData.flatMap(b => b.products);

    const enrichedCountries = countries.map(c => {
        const countryProducts = connectedProducts.filter(p => p.countryId === c.id);

        return {
            ...c,
            _count: { products: countryProducts.length },
            products: countryProducts
        };
    });

    return JSON.parse(JSON.stringify(enrichedCountries));
}

async function getCategories() {
    const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(categories));
}

export default async function CountriesPage() {
    const [countries, categories] = await Promise.all([
        getCountries(),
        getCategories()
    ]);

    return (
        <div className="animate-in fade-in duration-500 container mx-auto px-4 py-8">
            <CountryManager countries={countries} categories={categories} />
        </div>
    );
}
