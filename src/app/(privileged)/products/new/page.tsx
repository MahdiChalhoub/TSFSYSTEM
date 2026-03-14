import ProductFormWrapper from './form-wrapper';
import { PackagePlus } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { getProductNamingRule } from '@/app/actions/settings';
import { getFinancialSettings } from '@/app/actions/finance/settings';
import { serializeDecimals } from '@/lib/utils/serialization';

export const dynamic = 'force-dynamic';

async function getCategories() {
    try {
        const d = await erpFetch('inventory/categories/');
        return Array.isArray(d) ? d : (d?.results ?? []);
    } catch (e) {
        console.warn("Error fetching categories:", e);
        return [];
    }
}

async function getUnits() {
    try {
        const d = await erpFetch('units/');
        return Array.isArray(d) ? d : (d?.results ?? []);
    } catch (e) {
        console.warn("Error fetching units:", e);
        return [];
    }
}

async function getBrands() {
    try {
        const d = await erpFetch('inventory/brands/');
        return Array.isArray(d) ? d : (d?.results ?? []);
    } catch (e) {
        console.warn("Error fetching brands:", e);
        return [];
    }
}

async function getCountries() {
    try {
        const d = await erpFetch('countries/');
        return Array.isArray(d) ? d : (d?.results ?? []);
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