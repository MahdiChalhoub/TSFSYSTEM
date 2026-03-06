'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Check, X } from 'lucide-react';

/* ── Keyword → suggestion mapping ── */
const KEYWORD_MAP: Record<string, { category?: string; brand?: string; tax?: string; packaging?: string; unit?: string }> = {
    // Beverages
    'coca': { category: 'Beverage', brand: 'Coca Cola', tax: '18%', packaging: '24 bottles carton' },
    'cola': { category: 'Beverage', brand: 'Coca Cola', tax: '18%' },
    'pepsi': { category: 'Beverage', brand: 'PepsiCo', tax: '18%', packaging: '24 bottles carton' },
    'fanta': { category: 'Beverage', brand: 'Coca Cola', tax: '18%' },
    'sprite': { category: 'Beverage', brand: 'Coca Cola', tax: '18%' },
    'water': { category: 'Beverage', tax: '0%', unit: 'Bottle' },
    'juice': { category: 'Beverage', tax: '18%' },
    'beer': { category: 'Beverage', tax: '18%' },
    'wine': { category: 'Beverage', tax: '18%' },
    // Food
    'rice': { category: 'Food', tax: '0%', unit: 'Kg', packaging: '25kg bag' },
    'sugar': { category: 'Food', tax: '0%', unit: 'Kg', packaging: '50kg bag' },
    'flour': { category: 'Food', tax: '0%', unit: 'Kg', packaging: '25kg bag' },
    'oil': { category: 'Food', tax: '0%', unit: 'Litre' },
    'milk': { category: 'Food', tax: '0%', unit: 'Litre' },
    'bread': { category: 'Food', tax: '0%', unit: 'Piece' },
    'pasta': { category: 'Food', tax: '0%' },
    'chicken': { category: 'Food', tax: '0%', unit: 'Kg' },
    'beef': { category: 'Food', tax: '0%', unit: 'Kg' },
    'fish': { category: 'Food', tax: '0%', unit: 'Kg' },
    // Electronics
    'phone': { category: 'Electronics', tax: '18%', unit: 'Piece' },
    'laptop': { category: 'Electronics', tax: '18%', unit: 'Piece' },
    'charger': { category: 'Electronics', tax: '18%', unit: 'Piece' },
    'cable': { category: 'Electronics', tax: '18%', unit: 'Piece' },
    'samsung': { category: 'Electronics', brand: 'Samsung', tax: '18%' },
    'apple': { category: 'Electronics', brand: 'Apple', tax: '18%' },
    'iphone': { category: 'Electronics', brand: 'Apple', tax: '18%' },
    // Personal Care
    'soap': { category: 'Personal Care', tax: '18%', unit: 'Piece' },
    'shampoo': { category: 'Personal Care', tax: '18%', unit: 'Bottle' },
    'toothpaste': { category: 'Personal Care', tax: '18%', unit: 'Piece' },
    'loreal': { category: 'Personal Care', brand: "L'Oréal", tax: '18%' },
    'nivea': { category: 'Personal Care', brand: 'Nivea', tax: '18%' },
    // Sizes
    '33cl': { packaging: '33cl Bottle' },
    '50cl': { packaging: '50cl Bottle' },
    '1l': { packaging: '1L Bottle' },
    '1.5l': { packaging: '1.5L Bottle' },
    '500ml': { packaging: '500ml Bottle' },
    '250ml': { packaging: '250ml Bottle' },
};

export interface AISuggestions {
    category?: string;
    brand?: string;
    tax?: string;
    packaging?: string;
    unit?: string;
}

interface AISuggestionsProps {
    productName: string;
    onAccept: (suggestions: AISuggestions) => void;
}

export default function AISuggestionsPanel({ productName, onAccept }: AISuggestionsProps) {
    const [suggestions, setSuggestions] = useState<AISuggestions>({});
    const [dismissed, setDismissed] = useState(false);
    const [accepted, setAccepted] = useState<Set<string>>(new Set());

    const analyze = useCallback((name: string) => {
        if (!name || name.length < 3) {
            setSuggestions({});
            return;
        }
        const words = name.toLowerCase().split(/[\s\-_.,]+/);
        const merged: AISuggestions = {};

        for (const word of words) {
            const match = KEYWORD_MAP[word];
            if (match) {
                if (match.category && !merged.category) merged.category = match.category;
                if (match.brand && !merged.brand) merged.brand = match.brand;
                if (match.tax && !merged.tax) merged.tax = match.tax;
                if (match.packaging && !merged.packaging) merged.packaging = match.packaging;
                if (match.unit && !merged.unit) merged.unit = match.unit;
            }
        }

        setSuggestions(merged);
        setDismissed(false);
        setAccepted(new Set());
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => analyze(productName), 400);
        return () => clearTimeout(timer);
    }, [productName, analyze]);

    const hasSuggestions = Object.keys(suggestions).length > 0;
    if (!hasSuggestions || dismissed) return null;

    const entries = Object.entries(suggestions).filter(([_, v]) => v);

    const handleAcceptAll = () => {
        onAccept(suggestions);
        setAccepted(new Set(entries.map(([k]) => k)));
    };

    const fieldLabels: Record<string, string> = {
        category: 'Category',
        brand: 'Brand',
        tax: 'Tax Rate',
        packaging: 'Packaging',
        unit: 'Unit',
    };

    return (
        <div className="relative overflow-hidden rounded-xl border border-app-primary/30 bg-gradient-to-r from-app-primary/5 via-app-info/5 to-purple-500/5 p-4 fade-in-up">
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse pointer-events-none" />

            <div className="relative flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-app-primary to-app-info flex items-center justify-center shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                        <h4 className="text-[12px] font-bold text-app-foreground">AI Assistant Detected</h4>
                        <p className="text-[10px] text-app-muted-foreground">Auto-suggestions based on product name</p>
                    </div>
                </div>
                <button onClick={() => setDismissed(true)} className="text-app-muted-foreground hover:text-app-foreground transition-colors p-1">
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 mb-3">
                {entries.map(([key, value]) => (
                    <div
                        key={key}
                        className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all
              ${accepted.has(key)
                                ? 'bg-app-primary/15 text-app-primary border border-app-primary/30'
                                : 'bg-app-surface border border-app-border text-app-foreground'
                            }
            `}
                    >
                        {accepted.has(key) && <Check className="w-3 h-3" />}
                        <span className="text-app-muted-foreground font-medium">{fieldLabels[key]}:</span>
                        <span>{value}</span>
                    </div>
                ))}
            </div>

            {/* Accept All button */}
            {accepted.size < entries.length && (
                <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-app-primary to-app-info text-white text-[11px] font-bold shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
                >
                    <Check className="w-3.5 h-3.5" />
                    Accept All Suggestions
                </button>
            )}
            {accepted.size === entries.length && (
                <p className="text-[11px] text-app-primary font-semibold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    All suggestions applied
                </p>
            )}
        </div>
    );
}
