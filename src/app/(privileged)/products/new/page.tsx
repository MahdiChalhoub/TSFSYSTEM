import ProductFormWrapper from './form-wrapper';
import { erpFetch } from '@/lib/erp-api';

export const dynamic = 'force-dynamic';

export default async function NewProductPage(props: { searchParams: Promise<{ cloneId?: string }> }) {
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
                            {cloneId ? `Creating a copy of "${clonedProduct?.name}"` : 'Smart product wizard with AI suggestions'}
                        </p>
                    </div>
                </div>
            </div>

            <ProductFormWrapper initialData={clonedProduct} />
        </div>
    );
}