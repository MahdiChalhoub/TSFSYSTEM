import AddProductForm from './form';
import { erpFetch } from '@/lib/erp-api';
import { getProductNamingRule } from '@/app/actions/settings';
import { getFinancialSettings } from '@/app/actions/finance/settings';
import { serializeDecimals } from '@/lib/utils/serialization';

export const dynamic = 'force-dynamic';

async function getCategories() {
    return await erpFetch('/inventory/categories/');
}

async function getUnits() {
    return await erpFetch('/inventory/units/');
}

async function getBrands() {
    return await erpFetch('/inventory/brands/');
}

async function getCountries() {
    return await erpFetch('/inventory/countries/');
}

export default async function NewProductPage(props: { searchParams: Promise<{ cloneId?: string }> }) {
    const searchParams = await props.searchParams;
    const cloneId = searchParams.cloneId;

    let clonedProduct = null;
    if (cloneId) {
        try {
            clonedProduct = await erpFetch(`/inventory/products/${cloneId}/`);
            if (clonedProduct) {
                // Reset unique fields
                clonedProduct.sku = '';
                clonedProduct.barcode = '';
                clonedProduct.name = `${clonedProduct.name} (Copy)`;
            }
        } catch (error) {
            console.error("Failed to fetch cloned product", error);
        }
    }

    const [categories, units, brands, countries, namingRule, financialSettings] = await Promise.all([
        getCategories(),
        getUnits(),
        getBrands(),
        getCountries(),
        getProductNamingRule(),
        getFinancialSettings()
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
                categories={categories}
                units={units}
                brands={brands}
                countries={countries}
                namingRule={namingRule}
                initialData={clonedProduct}
                worksInTTC={financialSettings?.worksInTTC ?? false}
            />
        </div>
    );
}
