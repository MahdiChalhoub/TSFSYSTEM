import { prisma } from "@/lib/db";
import { BrandManager } from "@/components/admin/BrandManager";

export const dynamic = 'force-dynamic';

async function getBrands() {
    const brands = await prisma.brand.findMany({
        include: {
            countries: true,
            categories: true, // Include linked categories
            _count: {
                select: { products: true }
            }
        },
        orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(brands));
}

async function getCountries() {
    const countries = await prisma.country.findMany({
        orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(countries));
}

async function getCategories() {
    const categories = await prisma.category.findMany({
        orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(categories));
}

export default async function BrandsPage() {
    const [brands, countries, categories] = await Promise.all([
        getBrands(),
        getCountries(),
        getCategories()
    ]);

    return (
        <div className="animate-in fade-in duration-500">
            <BrandManager
                brands={brands}
                countries={countries}
                categories={categories}
            />
        </div>
    );
}
