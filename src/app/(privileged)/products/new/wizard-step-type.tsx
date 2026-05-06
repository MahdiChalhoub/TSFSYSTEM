'use client';

import React, { useState } from 'react';
import { Package, Wrench, Layers, Monitor, Zap, ArrowRight, Sparkles } from 'lucide-react';

export type ProductTypeChoice = 'SINGLE' | 'SERVICE' | 'COMBO' | 'DIGITAL';

interface ProductTypeOption {
    id: ProductTypeChoice;
    label: string;
    subtitle: string;
    icon: typeof Package;
    accent: string;
    /** Inline-style background — uses CSS color-mix to preserve translucent gradient
     *  semantics (Tailwind v4 lost the `from-X/N` opacity-stop syntax, so we tint
     *  the explicit hex stops manually). */
    gradientStyle: React.CSSProperties;
    features: string[];
    hiddenFields: string[];
}

const PRODUCT_TYPES: ProductTypeOption[] = [
    {
        id: 'SINGLE',
        label: 'Physical Product',
        subtitle: 'Tangible items with stock tracking',
        icon: Package,
        accent: 'from-emerald-500 to-teal-600',
        gradientStyle: { background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 10%, transparent), color-mix(in srgb, #14B8A6 5%, transparent))' },
        features: ['Inventory tracking', 'Barcode / SKU', 'Packaging levels', 'Supplier mapping'],
        hiddenFields: [],
    },
    {
        id: 'SERVICE',
        label: 'Service',
        subtitle: 'Billable labor or consulting',
        icon: Wrench,
        accent: 'from-blue-500 to-indigo-600',
        gradientStyle: { background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-info) 10%, transparent), color-mix(in srgb, var(--app-accent) 5%, transparent))' },
        features: ['Hourly / fixed pricing', 'No inventory', 'Tax configuration', 'Service categories'],
        hiddenFields: ['inventory', 'packaging', 'supplier', 'barcode'],
    },
    {
        id: 'COMBO',
        label: 'Bundle / Combo',
        subtitle: 'Assembled from other products',
        icon: Layers,
        accent: 'from-purple-500 to-fuchsia-600',
        gradientStyle: { background: 'linear-gradient(135deg, color-mix(in srgb, #A855F7 10%, transparent), color-mix(in srgb, #D946EF 5%, transparent))' },
        features: ['Combo builder', 'Auto-pricing', 'Component stock check', 'Bundle discounts'],
        hiddenFields: ['supplier'],
    },
    {
        id: 'DIGITAL',
        label: 'Digital Product',
        subtitle: 'Downloads, licenses, subscriptions',
        icon: Monitor,
        accent: 'from-amber-500 to-orange-600',
        gradientStyle: { background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-warning) 10%, transparent), color-mix(in srgb, var(--app-warning) 5%, transparent))' },
        features: ['No physical stock', 'License keys', 'Download links', 'Subscription billing'],
        hiddenFields: ['inventory', 'packaging', 'supplier'],
    },
];

interface WizardStepTypeProps {
    onSelect: (type: ProductTypeChoice) => void;
    onQuickCreate: () => void;
}

export default function WizardStepType({ onSelect, onQuickCreate }: WizardStepTypeProps) {
    const [hoveredId, setHoveredId] = useState<ProductTypeChoice | null>(null);
    const [selectedId, setSelectedId] = useState<ProductTypeChoice | null>(null);

    return (
        <div className="max-w-5xl mx-auto w-full fade-in-up flex flex-col gap-3">
            {/* Header — original treatment (Sparkles pill + gradient h1 + sub),
                just with all margins removed so it sits flush against the page
                header above instead of floating in the middle of the viewport. */}
            <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-app-primary/10 to-app-info/10 border border-app-primary/20 rounded-full px-3 py-1 mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-app-primary" />
                    <span className="text-[11px] font-bold text-app-primary uppercase tracking-widest">Smart Product Creator</span>
                </div>
                <h1>
                    What are you <span className="bg-gradient-to-r from-app-primary to-app-info bg-clip-text text-transparent">creating</span>?
                </h1>
                <p className="text-app-muted-foreground text-sm mt-1 max-w-md mx-auto">
                    Select a product type to get a tailored creation experience.
                </p>
            </div>

            {/* Product Type Cards — always 4 in a row at any width. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
                {PRODUCT_TYPES.map((type, idx) => {
                    const Icon = type.icon;
                    const isSelected = selectedId === type.id;
                    const isHovered = hoveredId === type.id;

                    return (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => setSelectedId(type.id)}
                            onMouseEnter={() => setHoveredId(type.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            className={`
                relative group text-left p-5 rounded-2xl border-2 transition-all duration-300 ease-out
                ${isSelected
                                    ? 'border-app-primary shadow-lg shadow-app-primary/10 scale-[1.02]'
                                    : 'border-app-border/60 hover:border-app-primary/40 hover:shadow-md'
                                }
              `}
                            style={{ animationDelay: `${idx * 80}ms`, ...type.gradientStyle }}
                        >
                            {/* Selection indicator */}
                            {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-app-primary flex items-center justify-center shadow-md">
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}

                            {/* Icon */}
                            <div className={`
                w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300
                bg-gradient-to-br ${type.accent} shadow-lg
                ${isHovered || isSelected ? 'scale-110 rotate-[-3deg]' : ''}
              `}>
                                <Icon className="w-6 h-6 text-white" />
                            </div>

                            {/* Label */}
                            <h3 className="mb-1">{type.label}</h3>
                            <p className="text-[11px] text-app-muted-foreground leading-relaxed mb-4">{type.subtitle}</p>

                            {/* Feature list */}
                            <ul className="space-y-1.5">
                                {type.features.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-[11px] text-app-muted-foreground">
                                        <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${type.accent} shrink-0`} />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            {/* Hidden fields indicator */}
                            {type.hiddenFields.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-app-border/50">
                                    <span className="text-[10px] font-medium text-app-muted-foreground/70">
                                        {type.hiddenFields.length} section{type.hiddenFields.length > 1 ? 's' : ''} hidden for simplicity
                                    </span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={onQuickCreate}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-app-muted-foreground hover:text-app-foreground bg-app-surface border border-app-border hover:border-app-primary/30 transition-all group"
                >
                    <Zap className="w-4 h-4 text-app-warning group-hover:text-app-primary transition-colors" />
                    Quick Create
                    <span className="text-[10px] text-app-muted-foreground/60 font-medium ml-1">2 sec</span>
                </button>

                <button
                    type="button"
                    onClick={() => selectedId && onSelect(selectedId)}
                    disabled={!selectedId}
                    className={`
            flex items-center gap-2.5 px-8 py-3 rounded-xl text-[13px] font-bold transition-all duration-300
            ${selectedId
                            ? 'bg-gradient-to-r from-app-primary to-app-info text-white shadow-lg shadow-app-primary/20 hover:shadow-xl hover:shadow-app-primary/30 hover:scale-[1.02]'
                            : 'bg-app-surface-hover text-app-muted-foreground cursor-not-allowed'
                        }
          `}
                >
                    Continue
                    <ArrowRight className={`w-4 h-4 transition-transform duration-300 ${selectedId ? 'translate-x-0' : '-translate-x-1 opacity-50'}`} />
                </button>
            </div>
        </div>
    );
}
