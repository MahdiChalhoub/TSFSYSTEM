import ProductFormWrapper from './form-wrapper';
import { erpFetch } from '@/lib/erp-api';

export const dynamic = 'force-dynamic';

const DEFAULT_NAMING_RULE = {
    components: [
        { id: 'category', label: 'Category', enabled: true, useShortName: true },
        { id: 'brand', label: 'Brand', enabled: true, useShortName: true },
        { id: 'family', label: 'Family', enabled: true, useShortName: false },
        { id: 'emballage', label: 'Emballage', enabled: true, useShortName: true },
        { id: 'country', label: 'Country', enabled: true, useShortName: true },
    ],
    separator: ' ',
};

async function safeList(url: string): Promise<any[]> {
    try {
        const d = await erpFetch(url);
        return Array.isArray(d) ? d : (d?.results ?? []);
    } catch { return []; }
}
async function safeOne(url: string): Promise<any | null> {
    try { return await erpFetch(url); } catch { return null; }
}

export default async function NewProductPage(props: {
    searchParams: Promise<{
        cloneId?: string;
        unit?: string;
        unit_name?: string;
        category?: string;
        category_name?: string;
        brand?: string;
        brand_name?: string;
    }>
}) {
    const searchParams = await props.searchParams;
    const cloneId = searchParams.cloneId;

    /* All fetches run in parallel on the server so the form renders with
     * full data on first paint — no client-side spinner / lookup waterfall.
     * Each call is wrapped in safeList/safeOne so a single endpoint failure
     * (e.g. attribute-tree on a fresh tenant) doesn't kill the whole page. */
    const [
        clonedProduct,
        categories,
        units,
        brands,
        countries,
        namingRule,
        fin,
        attributeTree,
    ] = await Promise.all([
        cloneId ? safeOne(`/inventory/products/${cloneId}/`) : Promise.resolve(null),
        safeList('inventory/categories/'),
        safeList('units/'),
        safeList('inventory/brands/'),
        safeList('countries/'),
        safeOne('settings/item/product_naming_rule/'),
        safeOne('settings/global_financial/'),
        safeList('inventory/product-attributes/tree/'),
    ]);

    const cloned = clonedProduct ? {
        ...clonedProduct,
        sku: '',
        barcode: '',
        name: `${clonedProduct.name} (Copy)`,
    } : null;

    /* Entity prefill — applied when not cloning. Populates unit/category/brand
     * on the product form from Empty-state CTAs on /inventory/units,
     * /inventory/categories, /inventory/brands. */
    const entityPrefill = !cloned ? {
        ...(searchParams.unit ? { unit_id: Number(searchParams.unit), unit_name: searchParams.unit_name } : {}),
        ...(searchParams.category ? { category_id: Number(searchParams.category), category_name: searchParams.category_name } : {}),
        ...(searchParams.brand ? { brand_id: Number(searchParams.brand), brand_name: searchParams.brand_name } : {}),
    } : {};
    const initialData = cloned || (Object.keys(entityPrefill).length ? entityPrefill : null);
    const prefillSource = searchParams.unit ? ('unit' as const)
        : searchParams.category ? ('category' as const)
        : searchParams.brand ? ('brand' as const) : null;
    const prefillName = searchParams.unit_name || searchParams.category_name || searchParams.brand_name;

    return (
        <ProductFormWrapper
            initialData={initialData}
            categories={categories}
            units={units}
            brands={brands}
            countries={countries}
            namingRule={namingRule || DEFAULT_NAMING_RULE}
            worksInTTC={(fin as any)?.worksInTTC ?? false}
            attributeTree={attributeTree}
            cloneSourceName={cloned?.name ?? null}
            prefillSource={prefillSource}
            prefillName={prefillName ?? null}
        />
    );
}