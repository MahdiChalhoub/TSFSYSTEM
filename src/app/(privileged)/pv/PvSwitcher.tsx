// @ts-nocheck
'use client';

import { useState } from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import Link from 'next/link';

import PurchaseForm from '../purchases/new/form';
import FormalOrderForm from '../purchases/new-order/form';
import FormalOrderFormV2 from '../purchases/new-order-v2/form';

type View = 'new' | 'new-order' | 'new-order-v2';

const TABS: { id: View; label: string; sub: string }[] = [
    { id: 'new', label: 'New', sub: 'purchases/new' },
    { id: 'new-order', label: 'New Order (RFQ)', sub: 'purchases/new-order' },
    { id: 'new-order-v2', label: 'New Order V2', sub: 'purchases/new-order-v2' },
];

export default function PvSwitcher({
    suppliers,
    sites,
    financialSettings,
    paymentTerms,
    drivers,
}: {
    suppliers: Record<string, any>[];
    sites: Record<string, any>[];
    financialSettings: any;
    paymentTerms: any[];
    drivers: any[];
}) {
    const [view, setView] = useState<View>('new');

    return (
        <div className="min-h-screen flex flex-col animate-in fade-in duration-300"
            style={{ background: 'var(--app-background)' }}>

            {/* Header with switcher */}
            <div className="sticky top-0 z-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-3"
                style={{
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                    boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)',
                }}>
                <div className="flex items-center gap-3">
                    <Link href="/purchases" className="p-1.5 rounded-full transition-colors hover:bg-app-border/20"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <ArrowLeft size={18} />
                    </Link>
                    <FileText size={16} style={{ color: 'var(--app-primary)' }} />
                    <h1 className="text-lg md:text-xl font-black tracking-tight"
                        style={{ color: 'var(--app-foreground)' }}>
                        Purchase <span style={{ color: 'var(--app-primary)' }}>Playground</span>
                    </h1>
                </div>

                {/* Tab switcher */}
                <div className="p-1 rounded-xl inline-flex gap-0.5"
                    style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                    {TABS.map((t) => {
                        const active = view === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setView(t.id)}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all"
                                style={active ? {
                                    background: 'var(--app-primary)',
                                    color: 'white',
                                    boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                } : {
                                    color: 'var(--app-muted-foreground)',
                                }}
                                title={t.sub}
                            >
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Body — mount only the active form so state resets on switch */}
            <div className="flex-1 flex flex-col">
                {view === 'new' && (
                    <PurchaseForm
                        suppliers={suppliers}
                        sites={sites}
                        financialSettings={financialSettings}
                    />
                )}
                {view === 'new-order' && (
                    <div className="px-4 md:px-6 py-4">
                        <FormalOrderForm suppliers={suppliers} sites={sites} />
                    </div>
                )}
                {view === 'new-order-v2' && (
                    <div className="flex-1 min-h-0 flex flex-col px-4 md:px-6 py-4">
                        <FormalOrderFormV2
                            suppliers={suppliers}
                            sites={sites}
                            paymentTerms={paymentTerms}
                            drivers={drivers}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
