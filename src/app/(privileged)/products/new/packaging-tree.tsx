'use client';

import { Plus, Trash2, Lock, Package, ChevronRight, Calculator, PenLine } from 'lucide-react';

type PriceMode = 'FORMULA' | 'FIXED';

export interface PackagingLevel {
    id: string;
    unitId: string;
    ratio: number;
    barcode: string;
    price: number;           // custom_selling_price (used when mode=FIXED)
    priceMode: PriceMode;    // FORMULA or FIXED
    discountPct: number;     // discount % for FORMULA mode
}

export interface PackagingUnitOption {
    id: number | string;
    name?: string;
    shortName?: string;
    [key: string]: unknown;
}

interface PackagingTreeProps {
    levels: PackagingLevel[];
    onChange: (levels: PackagingLevel[]) => void;
    units: PackagingUnitOption[];
    basePrice?: number;      // base unit selling price (TTC)
    currency?: string;
}

export default function PackagingTree({ levels, onChange, units, basePrice = 0, currency = '$' }: PackagingTreeProps) {
    const addLevel = () => {
        onChange([...levels, {
            id: crypto.randomUUID(),
            unitId: '',
            ratio: 0,
            barcode: '',
            price: 0,
            priceMode: 'FORMULA',
            discountPct: 0,
        }]);
    };

    const removeLevel = (id: string) => {
        onChange(levels.filter(l => l.id !== id));
    };

    const updateLevel = <K extends keyof PackagingLevel>(idx: number, field: K, value: PackagingLevel[K]) => {
        const arr = [...levels];
        arr[idx] = { ...arr[idx], [field]: value };
        onChange(arr);
    };

    // Calculate total base units at each level
    const getTotalUnits = (idx: number) => {
        let total = 1;
        for (let i = 0; i <= idx; i++) {
            if (levels[i].ratio > 0) total *= levels[i].ratio;
        }
        return total;
    };

    // Calculate formula price for a level
    const getFormulaPrice = (idx: number) => {
        if (basePrice <= 0) return 0;
        const totalUnits = getTotalUnits(idx);
        const discountFactor = 1 - (levels[idx].discountPct / 100);
        return basePrice * totalUnits * discountFactor;
    };

    // Get effective price (formula or fixed)
    const getEffectivePrice = (idx: number) => {
        if (levels[idx].priceMode === 'FIXED' && levels[idx].price > 0) {
            return levels[idx].price;
        }
        return getFormulaPrice(idx);
    };

    // Calculate per-unit price at this packaging level
    const getPerUnitPrice = (idx: number) => {
        const effective = getEffectivePrice(idx);
        const totalUnits = getTotalUnits(idx);
        if (totalUnits <= 0) return 0;
        return effective / totalUnits;
    };

    const getUnitName = (unitId: string) => {
        const unit = units.find(u => String(u.id) === unitId);
        return unit?.name || unit?.shortName || '—';
    };

    const smallLabel = "block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider";

    return (
        <div className="space-y-3">
            {/* Base Level (always present) */}
            <div className="flex items-center gap-3 p-3 bg-app-background rounded-xl border border-app-border">
                <div className="w-8 h-8 rounded-lg bg-app-info flex items-center justify-center shadow-sm shrink-0">
                    <Lock className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-app-foreground">Piece (Base Unit)</div>
                    <div className="text-[10px] text-app-muted-foreground">
                        {basePrice > 0 ? `${currency}${basePrice.toFixed(2)} per unit` : 'Set base price in Pricing tab'}
                    </div>
                </div>
                <span className="text-[9px] font-bold text-app-info bg-app-info-bg px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0">Base</span>
            </div>

            {/* Dynamic Levels */}
            {levels.map((lvl, idx) => {
                const effectivePrice = getEffectivePrice(idx);
                const formulaPrice = getFormulaPrice(idx);
                const perUnit = getPerUnitPrice(idx);
                const totalUnits = getTotalUnits(idx);
                const savings = basePrice > 0 && perUnit > 0 ? ((basePrice - perUnit) / basePrice * 100) : 0;

                return (
                    <div key={lvl.id} className="relative">
                        {/* Connector line */}
                        <div className="absolute left-[18px] -top-3 w-px h-3 bg-app-border" />

                        <div className="p-3 bg-app-surface rounded-xl border border-app-border space-y-2.5 group hover:border-app-primary/30 transition-all">
                            {/* Level header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-app-accent/20 text-app-accent flex items-center justify-center text-[10px] font-black border border-app-accent">
                                        {idx + 2}
                                    </div>
                                    <span className="text-[12px] font-bold text-app-foreground">
                                        {lvl.unitId ? getUnitName(lvl.unitId) : `Level ${idx + 2}`}
                                    </span>
                                    {lvl.ratio > 0 && (
                                        <span className="text-[10px] text-app-muted-foreground font-medium flex items-center gap-1">
                                            <ChevronRight className="w-3 h-3" />
                                            {totalUnits} pcs
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeLevel(lvl.id)}
                                    className="p-1 text-app-muted-foreground hover:text-app-error transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Row 1: Unit + Quantity */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className={smallLabel}>Unit Type</label>
                                    <select
                                        className="w-full bg-app-background border border-app-border rounded-lg px-2.5 py-2 text-[11px] outline-none text-app-foreground font-medium"
                                        value={lvl.unitId}
                                        onChange={e => updateLevel(idx, 'unitId', e.target.value)}
                                    >
                                        <option value="">Select...</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={smallLabel}>Contains (qty)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-app-background border border-app-border rounded-lg px-2.5 py-2 text-[11px] outline-none font-bold text-app-foreground"
                                        placeholder="e.g. 12"
                                        value={lvl.ratio || ''}
                                        onChange={e => updateLevel(idx, 'ratio', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>

                            {/* Row 2: Barcode */}
                            <div>
                                <label className={smallLabel}>Barcode</label>
                                <input
                                    type="text"
                                    className="w-full bg-app-background border border-app-border rounded-lg px-2.5 py-2 text-[11px] outline-none font-mono text-app-foreground placeholder:text-app-muted-foreground"
                                    placeholder="Scan or enter barcode..."
                                    value={lvl.barcode}
                                    onChange={e => updateLevel(idx, 'barcode', e.target.value)}
                                />
                            </div>

                            {/* Row 3: Price Mode Toggle + Price */}
                            <div className="p-2.5 bg-app-background rounded-lg border border-app-border/50">
                                {/* Mode Toggle */}
                                <div className="flex gap-1.5 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => updateLevel(idx, 'priceMode', 'FORMULA')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-bold transition-all
                                            ${lvl.priceMode === 'FORMULA'
                                                ? 'bg-app-info/10 text-app-info border border-app-info/30'
                                                : 'bg-transparent text-app-muted-foreground hover:text-app-foreground border border-transparent'
                                            }`}
                                    >
                                        <Calculator className="w-3 h-3" /> Formula
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => updateLevel(idx, 'priceMode', 'FIXED')}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-bold transition-all
                                            ${lvl.priceMode === 'FIXED'
                                                ? 'bg-app-warning/10 text-app-warning border border-app-warning'
                                                : 'bg-transparent text-app-muted-foreground hover:text-app-foreground border border-transparent'
                                            }`}
                                    >
                                        <PenLine className="w-3 h-3" /> Fixed
                                    </button>
                                </div>

                                {/* Formula Mode: Discount % + calculated price */}
                                {lvl.priceMode === 'FORMULA' ? (
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className={smallLabel}>Discount %</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        className="w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-[11px] outline-none font-bold text-app-foreground pr-7"
                                                        placeholder="0"
                                                        value={lvl.discountPct || ''}
                                                        onChange={e => updateLevel(idx, 'discountPct', parseFloat(e.target.value) || 0)}
                                                    />
                                                    <span className="absolute right-2.5 top-[6px] text-[10px] text-app-muted-foreground font-bold">%</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={smallLabel}>Calculated Price</label>
                                                <div className="bg-app-info/5 border border-app-info/20 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-app-info">
                                                    {formulaPrice > 0 ? `${currency}${formulaPrice.toFixed(2)}` : '—'}
                                                </div>
                                            </div>
                                        </div>
                                        {formulaPrice > 0 && (
                                            <p className="text-[9px] text-app-muted-foreground">
                                                = {currency}{basePrice.toFixed(2)} × {totalUnits} pcs × {(1 - lvl.discountPct / 100).toFixed(2)}
                                                {lvl.discountPct > 0 && <span className="text-app-success font-bold"> (−{lvl.discountPct}%)</span>}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    /* Fixed Mode: Manual price input */
                                    <div>
                                        <label className={smallLabel}>Fixed Selling Price</label>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-[6px] text-app-primary text-[10px] font-bold">{currency}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="w-full bg-app-primary/5 border border-app-primary/30 rounded-lg pl-6 pr-2.5 py-1.5 text-[11px] outline-none font-bold text-app-primary placeholder:text-app-primary/40"
                                                placeholder="Enter price..."
                                                value={lvl.price || ''}
                                                onChange={e => updateLevel(idx, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        {formulaPrice > 0 && (
                                            <p className="text-[9px] text-app-muted-foreground mt-1">
                                                Formula would be: {currency}{formulaPrice.toFixed(2)}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Per-unit price & savings indicator */}
                                {effectivePrice > 0 && totalUnits > 0 && (
                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-app-border/30">
                                        <span className="text-[9px] text-app-muted-foreground font-medium">
                                            Per unit: <span className="font-bold text-app-foreground">{currency}{perUnit.toFixed(2)}</span>
                                        </span>
                                        {savings > 0 && (
                                            <span className="text-[9px] font-bold text-app-success bg-app-success-bg px-1.5 py-0.5 rounded">
                                                −{savings.toFixed(1)}% vs base
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Add Level Button */}
            <button
                type="button"
                onClick={addLevel}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-app-border hover:border-app-primary/40 text-[11px] font-bold text-app-muted-foreground hover:text-app-primary bg-app-surface/50 hover:bg-app-primary/5 transition-all group"
            >
                <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Add Packaging Level
            </button>

            {/* Visual tree summary */}
            {levels.length > 0 && levels.some(l => l.ratio > 0 && l.unitId) && (
                <div className="p-3 bg-app-accent/5 border border-app-accent/30 rounded-xl">
                    <p className="text-[10px] font-bold text-app-accent uppercase tracking-widest mb-2">Packaging Tree</p>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-app-foreground">
                        {levels.filter(l => l.ratio > 0 && l.unitId).map((l, i) => (
                            <span key={l.id} className="flex items-center gap-1.5">
                                {i > 0 && <span className="text-app-muted-foreground">→</span>}
                                <Package className="w-3 h-3 text-app-accent" />
                                {getUnitName(l.unitId)} ({l.ratio}×)
                                {getEffectivePrice(levels.indexOf(l)) > 0 && (
                                    <span className="text-app-primary text-[9px]">
                                        {currency}{getEffectivePrice(levels.indexOf(l)).toFixed(2)}
                                    </span>
                                )}
                            </span>
                        ))}
                        <span className="text-app-muted-foreground">→</span>
                        <span className="flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-app-info" />
                            Piece
                            {basePrice > 0 && <span className="text-app-primary text-[9px]">{currency}{basePrice.toFixed(2)}</span>}
                        </span>
                    </div>
                </div>
            )}

            {/* Hidden field for form submission */}
            <input type="hidden" name="packagingLevels" value={JSON.stringify(levels)} />
        </div>
    );
}
