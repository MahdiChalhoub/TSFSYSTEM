import AddProductForm from './form';
import { prisma } from '@/lib/db';
import { getProductNamingRule } from '@/app/actions/settings';
import { serializeDecimals } from '@/lib/utils/serialization';

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

export default async function NewProductPage(props: { searchParams: Promise<{ cloneId?: string }> }) {
    const searchParams = await props.searchParams;
    const cloneId = searchParams.cloneId;

    let clonedProduct = null;
    if (cloneId) {
        clonedProduct = await prisma.product.findUnique({
            where: { id: parseInt(cloneId) },
        });
        if (clonedProduct) {
            // Reset unique fields
            (clonedProduct as any).sku = '';
            (clonedProduct as any).barcode = '';
            (clonedProduct as any).name = `${clonedProduct.name} (Copy)`;
        }
    }

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
                <h1 className="text-2xl font-bold text-gray-800">
                    {cloneId ? 'Clone Product' : 'Add New Product'}
                </h1>
                <p className="text-gray-500">
                    {cloneId ? `Creating a copy of "${clonedProduct?.name}"` : 'Create a new item in the TSF Catalog.'}
                </p>
            </div>

            <AddProductForm
                categories={serializeDecimals(categories)}
                units={serializeDecimals(units)}
                brands={serializeDecimals(brands)}
                countries={serializeDecimals(countries)}
                namingRule={serializeDecimals(namingRule)}
                initialData={clonedProduct ? serializeDecimals(clonedProduct) : null}
            />
        </div>
    );
}
