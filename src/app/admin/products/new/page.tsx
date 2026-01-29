import AddProductForm from './form';
import { prisma } from '@/lib/db';
import { getProductNamingRule } from '@/app/actions/settings';

export const dynamic = 'force-dynamic';

async function getCategories() {
    return await prisma.category.findMany({
        include: { parfums: true },
        orderBy: { name: 'asc' }
    });
}

async function getUnits() {
    const units = await prisma.unit.findMany({
        orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(units));
}

async function getBrands() {
    const brands = await prisma.brand.findMany({
        include: { countries: true },
        orderBy: { name: 'asc' }
    });
    return JSON.parse(JSON.stringify(brands));
}

async function getCountries() {
    return await prisma.country.findMany({
        orderBy: { name: 'asc' }
    });
}

export default async function NewProductPage() {
    const [categories, units, brands, countries, namingRule] = await Promise.all([
        getCategories(),
        getUnits(),
        getBrands(),
        getCountries(),
        getProductNamingRule()
    ]);

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Add New Product</h1>
                <p className="text-gray-500">Create a new item in the TSF Catalog.</p>
            </div>

            <AddProductForm categories={categories} units={units} brands={brands} countries={countries} namingRule={namingRule} />
        </div>
    );
}
