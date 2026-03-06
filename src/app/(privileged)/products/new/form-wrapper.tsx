'use client';

import { useState } from 'react';
import WizardStepType, { type ProductTypeChoice } from './wizard-step-type';
import SmartProductForm from './smart-form';
import AddProductForm from './form';
import AdvancedProductForm from './advanced-form';
import { Zap, X, ArrowRight } from 'lucide-react';
import { createProduct } from '../actions';
import { useActionState } from 'react';
import { toast } from 'sonner';

type WizardStep = 'type' | 'form' | 'quick' | 'legacy';

export default function ProductFormWrapper(props: any) {
    const [step, setStep] = useState<WizardStep>('type');
    const [productType, setProductType] = useState<ProductTypeChoice>('SINGLE');
    const [showLegacyToggle, setShowLegacyToggle] = useState(false);

    // Quick Create state
    const [quickName, setQuickName] = useState('');
    const [quickPrice, setQuickPrice] = useState('');
    const [quickBarcode, setQuickBarcode] = useState('');
    const initialState = { message: '', errors: {} };
    const [qState, qFormAction, qPending] = useActionState(createProduct, initialState);

    const handleTypeSelect = (type: ProductTypeChoice) => {
        setProductType(type);
        setStep('form');
    };

    // If we have initial data (cloning), skip to form
    if (props.initialData && step === 'type') {
        setStep('form');
        setProductType((props.initialData.productType as ProductTypeChoice) || 'SINGLE');
    }

    return (
        <div>
            {/* Legacy mode switch (hidden by default) */}
            {step === 'type' && (
                <div className="flex justify-end mb-2">
                    <button
                        type="button"
                        onClick={() => setShowLegacyToggle(!showLegacyToggle)}
                        className="text-[10px] text-app-muted-foreground/50 hover:text-app-muted-foreground font-medium transition-colors"
                    >
                        {showLegacyToggle ? 'Hide' : 'Show'} legacy form
                    </button>
                </div>
            )}

            {showLegacyToggle && step === 'type' && (
                <div className="mb-4 p-3 bg-app-surface border border-app-border rounded-xl flex items-center justify-between">
                    <span className="text-[12px] text-app-muted-foreground font-medium">Switch to legacy creation forms</span>
                    <div className="flex gap-2">
                        <button onClick={() => setStep('legacy')} className="text-[11px] px-3 py-1.5 bg-app-background border border-app-border rounded-lg font-semibold text-app-muted-foreground hover:text-app-foreground transition-colors">
                            Simple Form
                        </button>
                        <button onClick={() => setStep('legacy')} className="text-[11px] px-3 py-1.5 bg-app-background border border-app-border rounded-lg font-semibold text-app-muted-foreground hover:text-app-foreground transition-colors">
                            Advanced Form
                        </button>
                    </div>
                </div>
            )}

            {/* Step 1: Type Selector */}
            {step === 'type' && (
                <WizardStepType
                    onSelect={handleTypeSelect}
                    onQuickCreate={() => setStep('quick')}
                />
            )}

            {/* Step 2: Smart Form */}
            {step === 'form' && (
                <SmartProductForm
                    productType={productType}
                    onBack={() => setStep('type')}
                    {...props}
                />
            )}

            {/* Quick Create Modal */}
            {step === 'quick' && (
                <div className="max-w-md mx-auto py-12 fade-in-up">
                    <div className="bg-app-surface rounded-2xl border border-app-border shadow-xl p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm">
                                    <Zap className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-[15px] font-black text-app-foreground">Quick Create</h3>
                                    <p className="text-[10px] text-app-muted-foreground font-medium">Create a product in 2 seconds</p>
                                </div>
                            </div>
                            <button onClick={() => setStep('type')} className="p-1.5 rounded-lg hover:bg-app-background text-app-muted-foreground transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form action={qFormAction} className="space-y-4">
                            <input type="hidden" name="productType" value="SINGLE" />
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5 uppercase tracking-widest">Name <span className="text-red-500">*</span></label>
                                <input
                                    name="name"
                                    type="text"
                                    value={quickName}
                                    onChange={e => setQuickName(e.target.value)}
                                    className="w-full bg-app-background border border-app-border rounded-xl px-4 py-3 text-[14px] font-semibold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground"
                                    placeholder="Product name"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5 uppercase tracking-widest">Selling Price <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <span className="absolute left-4 top-[14px] text-app-primary font-bold text-[13px]">$</span>
                                    <input
                                        name="basePrice"
                                        type="number"
                                        step="0.01"
                                        value={quickPrice}
                                        onChange={e => setQuickPrice(e.target.value)}
                                        className="w-full bg-app-primary/5 border border-app-primary/30 rounded-xl pl-8 pr-4 py-3 text-[14px] font-bold text-app-primary outline-none focus:ring-2 focus:ring-app-primary/20 transition-all placeholder:text-app-primary/40"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-app-muted-foreground mb-1.5 uppercase tracking-widest">Barcode</label>
                                <input
                                    name="barcode"
                                    type="text"
                                    value={quickBarcode}
                                    onChange={e => setQuickBarcode(e.target.value)}
                                    className="w-full bg-app-background border border-app-border rounded-xl px-4 py-3 text-[14px] font-mono text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all placeholder:text-app-muted-foreground"
                                    placeholder="Scan or type..."
                                />
                            </div>

                            {qState.message && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px] font-medium">
                                    {qState.message}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setStep('type')} className="flex-1 py-3 rounded-xl border border-app-border text-[12px] font-bold text-app-muted-foreground hover:bg-app-background transition-all">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={qPending}
                                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-bold shadow-lg shadow-amber-500/20 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {qPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {qPending ? 'Creating...' : 'Create →'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Legacy Forms */}
            {step === 'legacy' && (
                <div className="space-y-4">
                    <button onClick={() => setStep('type')} className="text-[12px] text-app-info font-bold hover:underline flex items-center gap-1">
                        ← Back to Smart Creator
                    </button>
                    <AdvancedProductForm {...props} />
                </div>
            )}
        </div>
    );
}
