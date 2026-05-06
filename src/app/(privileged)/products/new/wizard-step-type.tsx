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
        <div className="max-w-5xl mx-auto fade-in-up flex flex-col gap-3">
            {/* Header — compact, single line, no decorative pill (the page
                wrapper already shows "Create Product · Smart product wizard"
                so the title was redundant). */}
            <div className="text-center">
                <h1 className="text-lg md:text-xl font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                    What are you <span style={{
                        background: 'linear-gradient(90deg, var(--app-primary), var(--app-info, #3b82f6))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                    }}>creating</span>?
                </h1>
                <p className="text-tp-xs mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                    Pick a type — fields and options adapt to your choice.
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
                relative group text-left p-3 rounded-xl border-2 transition-all duration-200 ease-out
                ${isSelected
                                    ? 'border-app-primary shadow-md shadow-app-primary/10 scale-[1.01]'
                                    : 'border-app-border/60 hover:border-app-primary/40'
                                }
              `}
                            style={{ animationDelay: `${idx * 60}ms`, ...type.gradientStyle }}
                        >
                            {/* Selection indicator */}
                            {isSelected && (
                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-app-primary flex items-center justify-center shadow-sm">
                                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                            )}

                            {/* Icon — smaller, less mb */}
                            <div className={`
                w-9 h-9 rounded-lg flex items-center justify-center mb-2 transition-transform duration-200
                bg-gradient-to-br ${type.accent} shadow-md
                ${isHovered || isSelected ? 'scale-105' : ''}
              `}>
                                <Icon className="w-4 h-4 text-white" />
                            </div>

                            {/* Label */}
                            <h3 className="text-tp-sm font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>{type.label}</h3>
                            <p className="text-tp-xxs leading-snug mb-2" style={{ color: 'var(--app-muted-foreground)' }}>{type.subtitle}</p>

                            {/* Feature list — top 3 only, compact spacing */}
                            <ul className="space-y-0.5">
                                {type.features.slice(0, 3).map((f, i) => (
                                    <li key={i} className="flex items-center gap-1.5 text-tp-xxs" style={{ color: 'var(--app-muted-foreground)' }}>
                                        <div className={`w-1 h-1 rounded-full bg-gradient-to-r ${type.accent} shrink-0`} />
                                        {f}
                                    </li>
                                ))}
                                {type.features.length > 3 && (
                                    <li className="text-tp-xxs italic" style={{ color: 'var(--app-muted-foreground)', opacity: 0.7 }}>
                                        + {type.features.length - 3} more
                                    </li>
                                )}
                            </ul>
                        </button>
                    );
                })}
            </div>

            {/* Action Bar — compact */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                    type="button"
                    onClick={onQuickCreate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-tp-xs font-bold transition-all"
                    style={{
                        color: 'var(--app-muted-foreground)',
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--app-primary) 30%, transparent)'; e.currentTarget.style.color = 'var(--app-foreground)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.color = 'var(--app-muted-foreground)' }}
                >
                    <Zap className="w-3.5 h-3.5" style={{ color: 'var(--app-warning)' }} />
                    Quick Create
                    <span className="text-tp-xxs ml-0.5" style={{ color: 'var(--app-muted-foreground)', opacity: 0.6 }}>2 sec</span>
                </button>

                <button
                    type="button"
                    onClick={() => selectedId && onSelect(selectedId)}
                    disabled={!selectedId}
                    className="flex items-center gap-2 px-5 py-1.5 rounded-xl text-tp-sm font-bold transition-all hover:brightness-110 disabled:cursor-not-allowed"
                    style={{
                        background: selectedId
                            ? 'linear-gradient(90deg, var(--app-primary), var(--app-info, #3b82f6))'
                            : 'color-mix(in srgb, var(--app-foreground) 5%, transparent)',
                        color: selectedId ? '#fff' : 'var(--app-muted-foreground)',
                        boxShadow: selectedId ? '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' : 'none',
                    }}
                >
                    Continue
                    <ArrowRight className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
