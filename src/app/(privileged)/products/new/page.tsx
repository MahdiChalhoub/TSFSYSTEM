import ProductFormWrapper from './form-wrapper';
import { erpFetch } from '@/lib/erp-api';

export const dynamic = 'force-dynamic';

export default async function NewProductPage(props: {
    searchParams: Promise<{
        cloneId?: string;
        // Entity-prefill params (sent by EntityProductsTab empty-state CTA)
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

    let clonedProduct = null;
    if (cloneId) {
        try {
            clonedProduct = await erpFetch(`/inventory/products/${cloneId}/`);
            if (clonedProduct) {
                clonedProduct.sku = '';
                clonedProduct.barcode = '';
                clonedProduct.name = `${clonedProduct.name} (Copy)`;
            }
        } catch (error) {
            console.error("Failed to fetch cloned product", error);
        }
    }

    // Entity prefill — applied when not cloning. Populates unit/category/brand
    // on the product form from Empty-state CTAs on /inventory/units, /inventory/categories, /inventory/brands.
    const entityPrefill = !clonedProduct ? {
        ...(searchParams.unit ? { unit_id: Number(searchParams.unit), unit_name: searchParams.unit_name } : {}),
        ...(searchParams.category ? { category_id: Number(searchParams.category), category_name: searchParams.category_name } : {}),
        ...(searchParams.brand ? { brand_id: Number(searchParams.brand), brand_name: searchParams.brand_name } : {}),
    } : {};
    const initialData = clonedProduct || (Object.keys(entityPrefill).length ? entityPrefill : null);
    const prefillSource = searchParams.unit ? ('unit' as const)
        : searchParams.category ? ('category' as const)
        : searchParams.brand ? ('brand' as const) : null;
    const prefillName = searchParams.unit_name || searchParams.category_name || searchParams.brand_name;

    return (
        <div>
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                        background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                        color: 'var(--app-primary)',
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 3v12M3 12h18M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                            {cloneId ? 'Clone Product' : 'Create Product'}
                        </h1>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--app-text-muted)' }}>
                            {cloneId ? `Creating a copy of "${clonedProduct?.name}"` :
                             prefillSource ? `Will be assigned to ${prefillSource}: ${prefillName}` :
                             'Smart product wizard with AI suggestions'}
                        </p>
                    </div>
                </div>
                {prefillSource && prefillName && (
                    <div className="mt-3 px-3 py-2 rounded-lg inline-flex items-center gap-2 text-[11px] font-bold"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        }}>
                        <span className="uppercase tracking-widest text-[9px]">Pre-filled</span>
                        <span>{prefillSource}: <strong>{prefillName}</strong></span>
                    </div>
                )}
            </div>

            <ProductFormWrapper initialData={initialData} />
        </div>
    );
}