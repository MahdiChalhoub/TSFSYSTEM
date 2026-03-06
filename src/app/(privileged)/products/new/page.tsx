import ProductFormWrapper from './form-wrapper';
import { PackagePlus } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { getProductNamingRule } from '@/app/actions/settings';
import { getFinancialSettings } from '@/app/actions/finance/settings';
import { serializeDecimals } from '@/lib/utils/serialization';

export const dynamic = 'force-dynamic';

async function getCategories() {
    try {
        return await erpFetch('inventory/categories/');
    } catch (e) {
        console.warn("Error fetching categories:", e);
        return [];
    }
}

async function getUnits() {
    try {
        return await erpFetch('units/');
    } catch (e) {
        console.warn("Error fetching units:", e);
        return [];
    }
}

async function getBrands() {
    try {
        return await erpFetch('inventory/brands/');
    } catch (e) {
        console.warn("Error fetching brands:", e);
        return [];
    }
}

async function getCountries() {
    try {
        return await erpFetch('countries/');
    } catch (e) {
        console.warn("Error fetching countries:", e);
        return [];
    }
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
                <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-app-primary to-app-info flex items-center justify-center shadow-lg shadow-app-primary/20">
                        <PackagePlus size={28} className="text-white" />
                    </div>
                    New <span className="text-app-primary">Product</span>
                </h1>
                <p className="text-app-muted-foreground text-sm mt-2">
                    {cloneId ? `Creating a copy of "${clonedProduct?.name}"` : 'Smart Product Creator — guided setup with AI assistance.'}
                </p>
            </div>

            <ProductFormWrapper
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