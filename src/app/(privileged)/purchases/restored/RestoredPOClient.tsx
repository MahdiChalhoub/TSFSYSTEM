// @ts-nocheck
'use client';

import { useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import FormalOrderFormV2, { type FormalOrderFormV2Handle } from '../new-order-v2/form';
import { CatalogueModal } from '../new-order/_components/CatalogueModal';

export default function RestoredPOClient({
    suppliers,
    sites,
    paymentTerms,
    drivers,
}: {
    suppliers: Record<string, any>[];
    sites: Record<string, any>[];
    paymentTerms: any[];
    drivers: any[];
}) {
    const formRef = useRef<FormalOrderFormV2Handle>(null);
    const [catalogueOpen, setCatalogueOpen] = useState(false);

    const handleCatalogueSelect = (product: Record<string, any>) => {
        formRef.current?.addProduct(product);
    };

    return (
        <>
            <FormalOrderFormV2
                ref={formRef}
                suppliers={suppliers}
                sites={sites}
                paymentTerms={paymentTerms}
                drivers={drivers}
            />

            {/* Floating Catalogue trigger — recovered from pre-wipe PO UX. */}
            <button
                type="button"
                onClick={() => setCatalogueOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full text-[12px] font-black uppercase tracking-widest transition-all hover:scale-[1.03]"
                style={{
                    background: 'var(--app-primary)',
                    color: 'white',
                    boxShadow: '0 10px 30px color-mix(in srgb, var(--app-primary) 40%, transparent)',
                }}
                title="Browse Catalogue"
            >
                <BookOpen size={16} />
                Catalogue
            </button>

            {catalogueOpen && (
                <CatalogueModal
                    onSelect={(p) => {
                        handleCatalogueSelect(p);
                    }}
                    onClose={() => setCatalogueOpen(false)}
                    siteId={Number(formRef.current?.getSelectedSiteId() || 0)}
                    supplierId={Number(formRef.current?.getSelectedSupplierId() || 0) || undefined}
                />
            )}
        </>
    );
}
