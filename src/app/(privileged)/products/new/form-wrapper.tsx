'use client';

/* ═══════════════════════════════════════════════════════════
 *  Product Create — wrapper
 *  -----------------------------------------------------------
 *  Two steps: pick product type → smart form. (Plus a Quick
 *  Create shortcut for SINGLE-type products with name + price
 *  + barcode only.)
 *
 *  Lookups (categories / units / brands / countries / settings /
 *  attributes) are SSR-fetched in page.tsx and passed in as
 *  props — no client-side waterfall on first render.
 * ═══════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import WizardStepType, { type ProductTypeChoice } from './wizard-step-type';
import SmartProductForm from './smart-form';
import { Zap, X, Package } from 'lucide-react';
import { createProduct } from '../actions';
import { useActionState } from 'react';

type WizardStep = 'type' | 'form' | 'quick';

interface ProductFormWrapperProps {
    initialData: any;
    categories: any[];
    units: any[];
    brands: any[];
    countries: any[];
    namingRule: any;
    worksInTTC: boolean;
    attributeTree: any[];
    cloneSourceName: string | null;
    prefillSource: 'unit' | 'category' | 'brand' | null;
    prefillName: string | null;
}

export default function ProductFormWrapper({
    initialData, categories, units, brands, countries, namingRule, worksInTTC, attributeTree,
    cloneSourceName, prefillSource, prefillName,
}: ProductFormWrapperProps) {
    const router = useRouter();
    const isCloning = !!cloneSourceName;
    // Cloning bypasses the type picker — straight to the form. Same for
    // entity-prefill (the user already chose the entity, picking the type
    // again would be a needless extra click).
    const skipPicker = isCloning || !!prefillSource;
    const [step, setStep] = useState<WizardStep>(skipPicker ? 'form' : 'type');
    const [productType, setProductType] = useState<ProductTypeChoice>(
        (initialData?.productType as ProductTypeChoice) || 'SINGLE'
    );

    // Quick-create state (only used when step === 'quick')
    const [quickName, setQuickName] = useState('');
    const [quickPrice, setQuickPrice] = useState('');
    const [quickBarcode, setQuickBarcode] = useState('');
    const initialState = { message: '', errors: {} };
    const [qState, qFormAction, qPending] = useActionState(createProduct, initialState);

    const handleTypeSelect = (type: ProductTypeChoice) => {
        setProductType(type);
        setStep('form');
    };

    return (
        <div className="flex flex-col px-4 md:px-6 pt-4 md:pt-6 pb-6 md:pb-8 animate-in fade-in duration-200">
            {/* No forced max-height: if the form fits the viewport, no scroll
                appears; if it doesn't, the page scrolls naturally and the
                sticky footer inside <SmartProductForm> keeps the Create
                button visible. Bottom padding pb-6/pb-8 ensures the form
                never touches the page edge. */}
            {/* Compact page header — only on the type-picker step. The form
                step has its own back-button + header that owns the chrome. */}
            {step === 'type' && (
                <header className="flex items-center gap-3 mb-3 flex-shrink-0">
                    <div className="page-header-icon bg-app-primary"
                         style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Package size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">
                            {isCloning ? 'Clone Product' : 'Create Product'}
                        </h1>
                        <p className="text-tp-xxs font-bold uppercase tracking-widest"
                           style={{ color: 'var(--app-muted-foreground)' }}>
                            {isCloning && cloneSourceName ? `From "${cloneSourceName}"`
                                : prefillSource && prefillName ? `Pre-filled · ${prefillSource}: ${prefillName}`
                                : 'Smart product wizard'}
                        </p>
                    </div>
                </header>
            )}

            {/* Step 1 — type selector */}
            {step === 'type' && (
                <WizardStepType
                    onSelect={handleTypeSelect}
                    onQuickCreate={() => setStep('quick')}
                />
            )}

            {/* Step 2 — smart form. Lookups are already in memory thanks to SSR. */}
            {step === 'form' && (
                <SmartProductForm
                    productType={productType}
                    categories={categories}
                    units={units}
                    brands={brands}
                    countries={countries}
                    namingRule={namingRule}
                    attributeTree={attributeTree}
                    worksInTTC={worksInTTC}
                    initialData={initialData}
                    onBack={() => skipPicker ? router.push('/inventory/products') : setStep('type')}
                    onCancel={() => router.push('/inventory/products')}
                />
            )}

            {/* Quick Create — SINGLE-type, name + price + barcode only */}
            {step === 'quick' && (
                <div className="max-w-md mx-auto py-8 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="rounded-2xl p-5 space-y-4"
                         style={{
                             background: 'var(--app-surface)',
                             border: '1px solid color-mix(in srgb, var(--app-warning) 22%, transparent)',
                             boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
                         }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                     style={{ background: 'var(--app-warning)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                                    <Zap className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-tp-md font-black" style={{ color: 'var(--app-foreground)' }}>Quick Create</h3>
                                    <p className="text-tp-xxs font-bold uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>2 seconds</p>
                                </div>
                            </div>
                            <button onClick={() => setStep('type')}
                                    className="p-1.5 rounded-lg transition-colors"
                                    style={{ color: 'var(--app-muted-foreground)' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--app-foreground) 6%, transparent)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form action={qFormAction} className="space-y-3">
                            <input type="hidden" name="productType" value="SINGLE" />
                            <div>
                                <label className="block text-tp-xxs font-bold mb-1 uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Name <span style={{ color: 'var(--app-error)' }}>*</span>
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    value={quickName}
                                    onChange={e => setQuickName(e.target.value)}
                                    className="w-full rounded-xl px-3 py-2.5 text-tp-sm font-semibold outline-none transition-all"
                                    style={{
                                        background: 'var(--app-bg)',
                                        border: '1px solid var(--app-border)',
                                        color: 'var(--app-foreground)',
                                    }}
                                    placeholder="Product name"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                                <div>
                                    <label className="block text-tp-xxs font-bold mb-1 uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Selling price <span style={{ color: 'var(--app-error)' }}>*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-[10px] text-tp-xs font-bold" style={{ color: 'var(--app-primary)' }}>$</span>
                                        <input
                                            name="basePrice"
                                            type="number"
                                            step="0.01"
                                            value={quickPrice}
                                            onChange={e => setQuickPrice(e.target.value)}
                                            className="w-full rounded-xl pl-7 pr-3 py-2.5 text-tp-sm font-bold outline-none transition-all"
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-primary) 5%, var(--app-bg))',
                                                border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                                                color: 'var(--app-primary)',
                                            }}
                                            placeholder="0.00"
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-tp-xxs font-bold mb-1 uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Barcode</label>
                                    <input
                                        name="barcode"
                                        type="text"
                                        value={quickBarcode}
                                        onChange={e => setQuickBarcode(e.target.value)}
                                        className="w-full rounded-xl px-3 py-2.5 text-tp-sm font-mono outline-none transition-all"
                                        style={{
                                            background: 'var(--app-bg)',
                                            border: '1px solid var(--app-border)',
                                            color: 'var(--app-foreground)',
                                        }}
                                        placeholder="Scan or type…"
                                    />
                                </div>
                            </div>

                            {qState.message && (
                                <div className="px-3 py-2 rounded-lg text-tp-xs font-medium"
                                     style={{
                                         background: 'color-mix(in srgb, var(--app-error) 8%, transparent)',
                                         border: '1px solid color-mix(in srgb, var(--app-error) 22%, transparent)',
                                         color: 'var(--app-error)',
                                     }}>
                                    {qState.message}
                                </div>
                            )}

                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setStep('type')}
                                        className="flex-1 py-2.5 rounded-xl text-tp-xs font-bold transition-all"
                                        style={{
                                            border: '1px solid var(--app-border)',
                                            color: 'var(--app-muted-foreground)',
                                            background: 'transparent',
                                        }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--app-foreground) 5%, transparent)' }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={qPending}
                                    className="flex-1 py-2.5 rounded-xl text-tp-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 hover:brightness-110"
                                    style={{
                                        background: 'var(--app-warning)',
                                        boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning) 28%, transparent)',
                                    }}
                                >
                                    {qPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {qPending ? 'Creating…' : 'Create →'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
