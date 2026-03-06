'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Percent, BarChart3 } from 'lucide-react';

type PricingStrategy = 'fixed' | 'margin' | 'markup';

interface PricingEngineProps {
    costPrice: number;
    sellPrice: number;
    taxPercent: number;
    isTaxIncluded: boolean;
    onCostChange: (val: number) => void;
    onSellChange: (val: number) => void;
    onTaxChange: (val: number) => void;
    onTaxIncludedChange: (val: boolean) => void;
    currency?: string;
}

export default function PricingEngine({
    costPrice,
    sellPrice,
    taxPercent,
    isTaxIncluded,
    onCostChange,
    onSellChange,
    onTaxChange,
    onTaxIncludedChange,
    currency = '$',
}: PricingEngineProps) {
    const [strategy, setStrategy] = useState<PricingStrategy>('fixed');
    const [marginTarget, setMarginTarget] = useState(35);
    const [markupTarget, setMarkupTarget] = useState(50);

    // Compute derived prices
    const taxMultiplier = 1 + taxPercent;
    const costHT = isTaxIncluded ? costPrice / taxMultiplier : costPrice;
    const sellHT = isTaxIncluded ? sellPrice / taxMultiplier : sellPrice;
    const costTTC = isTaxIncluded ? costPrice : costPrice * taxMultiplier;
    const sellTTC = isTaxIncluded ? sellPrice : sellPrice * taxMultiplier;
    const marginValue = sellHT - costHT;
    const marginPercent = costHT > 0 ? (marginValue / sellHT) * 100 : 0;
    const markupPercent = costHT > 0 ? (marginValue / costHT) * 100 : 0;

    // Auto-calc sell price when strategy changes
    useEffect(() => {
        if (strategy === 'margin' && costHT > 0) {
            const newSellHT = costHT / (1 - marginTarget / 100);
            onSellChange(isTaxIncluded ? newSellHT * taxMultiplier : newSellHT);
        } else if (strategy === 'markup' && costHT > 0) {
            const newSellHT = costHT * (1 + markupTarget / 100);
            onSellChange(isTaxIncluded ? newSellHT * taxMultiplier : newSellHT);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [strategy, marginTarget, markupTarget, costPrice]);

    // Status determination
    const getStatus = () => {
        if (marginPercent >= 40) return { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-500', barColor: 'from-emerald-400 to-emerald-600' };
        if (marginPercent >= 25) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-500', barColor: 'from-blue-400 to-blue-600' };
        if (marginPercent >= 10) return { label: 'Low', color: 'text-amber-600', bg: 'bg-amber-500', barColor: 'from-amber-400 to-amber-600' };
        if (marginPercent > 0) return { label: 'Thin', color: 'text-orange-600', bg: 'bg-orange-500', barColor: 'from-orange-400 to-orange-600' };
        return { label: 'Loss', color: 'text-red-600', bg: 'bg-red-500', barColor: 'from-red-400 to-red-600' };
    };
    const status = getStatus();

    const strategies: { id: PricingStrategy; label: string; icon: typeof DollarSign }[] = [
        { id: 'fixed', label: 'Fixed Price', icon: DollarSign },
        { id: 'margin', label: 'Margin %', icon: Percent },
        { id: 'markup', label: 'Markup %', icon: TrendingUp },
    ];

    return (
        <div className="space-y-4">
            {/* Strategy Selector */}
            <div>
                <label className="block text-[10px] font-semibold text-app-muted-foreground mb-2 uppercase tracking-widest">Pricing Strategy</label>
                <div className="grid grid-cols-3 gap-2">
                    {strategies.map(s => {
                        const Icon = s.icon;
                        return (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setStrategy(s.id)}
                                className={`
                  flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold transition-all
                  ${strategy === s.id
                                        ? 'bg-app-primary/10 text-app-primary border-2 border-app-primary/40 shadow-sm'
                                        : 'bg-app-surface border border-app-border text-app-muted-foreground hover:border-app-primary/30'
                                    }
                `}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {s.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Cost + Sell Price */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest">
                        Cost {isTaxIncluded ? '(TTC)' : '(HT)'}
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-[10px] text-app-muted-foreground text-[12px] font-bold">{currency}</span>
                        <input
                            type="number"
                            step="0.01"
                            value={costPrice || ''}
                            onChange={e => onCostChange(parseFloat(e.target.value) || 0)}
                            className="w-full bg-app-surface border border-app-border rounded-lg pl-7 pr-3 py-2.5 text-[13px] font-bold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 transition-all"
                            placeholder="0.00"
                        />
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mt-1 font-medium">
                        {isTaxIncluded ? `= ${costHT.toFixed(2)} HT` : `= ${costTTC.toFixed(2)} TTC`}
                    </p>
                </div>

                <div>
                    <label className="block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest">
                        Sell {isTaxIncluded ? '(TTC)' : '(HT)'} <span className="text-app-error">*</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-[10px] text-app-primary text-[12px] font-bold">{currency}</span>
                        <input
                            type="number"
                            step="0.01"
                            value={sellPrice || ''}
                            onChange={e => { setStrategy('fixed'); onSellChange(parseFloat(e.target.value) || 0); }}
                            className="w-full bg-app-primary/5 border border-app-primary/30 rounded-lg pl-7 pr-3 py-2.5 text-[13px] font-bold text-app-primary outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
                            placeholder="0.00"
                        />
                    </div>
                    <p className="text-[10px] text-app-primary mt-1 font-medium">
                        {isTaxIncluded ? `= ${sellHT.toFixed(2)} HT` : `= ${sellTTC.toFixed(2)} TTC`}
                    </p>
                </div>
            </div>

            {/* Strategy target input */}
            {strategy === 'margin' && (
                <div>
                    <label className="block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest">Target Margin %</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={5}
                            max={80}
                            value={marginTarget}
                            onChange={e => setMarginTarget(parseInt(e.target.value))}
                            className="flex-1 h-2 rounded-full appearance-none bg-app-surface-hover cursor-pointer accent-app-primary"
                        />
                        <span className="text-[14px] font-black text-app-primary w-12 text-right">{marginTarget}%</span>
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mt-1">→ Suggested price: {currency}{(isTaxIncluded ? (costHT / (1 - marginTarget / 100)) * taxMultiplier : costHT / (1 - marginTarget / 100)).toFixed(2)}</p>
                </div>
            )}
            {strategy === 'markup' && (
                <div>
                    <label className="block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest">Target Markup %</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={5}
                            max={200}
                            value={markupTarget}
                            onChange={e => setMarkupTarget(parseInt(e.target.value))}
                            className="flex-1 h-2 rounded-full appearance-none bg-app-surface-hover cursor-pointer accent-app-primary"
                        />
                        <span className="text-[14px] font-black text-app-primary w-12 text-right">{markupTarget}%</span>
                    </div>
                    <p className="text-[10px] text-app-muted-foreground mt-1">→ Suggested price: {currency}{(isTaxIncluded ? costHT * (1 + markupTarget / 100) * taxMultiplier : costHT * (1 + markupTarget / 100)).toFixed(2)}</p>
                </div>
            )}

            {/* Tax Rate */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <label className="block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest">Tax Rate</label>
                    <select
                        value={taxPercent}
                        onChange={e => onTaxChange(parseFloat(e.target.value))}
                        className="w-full bg-app-surface border border-app-border rounded-lg px-3 py-2.5 text-[12px] font-semibold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
                    >
                        <option value={0}>0% — Exempt</option>
                        <option value={0.11}>11% — Standard</option>
                        <option value={0.18}>18% — Luxury</option>
                    </select>
                </div>
                <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={isTaxIncluded}
                        onChange={e => onTaxIncludedChange(e.target.checked)}
                        className="w-4 h-4 rounded border-app-border text-app-primary focus:ring-app-primary"
                    />
                    <span className="text-[11px] font-semibold text-app-muted-foreground">Incl. tax</span>
                </label>
            </div>

            {/* Hidden form fields for submission */}
            <input type="hidden" name="costPrice" value={costPrice} />
            <input type="hidden" name="basePrice" value={sellPrice} />
            <input type="hidden" name="taxRate" value={taxPercent} />
            {isTaxIncluded && <input type="hidden" name="isTaxIncluded" value="on" />}

            {/* Margin Analyzer */}
            {costPrice > 0 && sellPrice > 0 && (
                <div className="p-4 rounded-xl bg-app-surface border border-app-border space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-app-muted-foreground" />
                            <span className="text-[12px] font-bold text-app-foreground">Margin Analysis</span>
                        </div>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${status.color} bg-opacity-10`} style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
                            {status.label}
                        </span>
                    </div>

                    {/* Profit Bar */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-semibold">
                            <span className="text-app-muted-foreground">Gross Margin</span>
                            <span className={status.color}>{marginPercent.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 bg-app-surface-hover rounded-full overflow-hidden relative">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${status.barColor} transition-all duration-500 ease-out`}
                                style={{ width: `${Math.min(Math.max(marginPercent, 0), 100)}%` }}
                            />
                            {/* Industry average line */}
                            <div className="absolute top-0 bottom-0 w-px bg-app-foreground/30" style={{ left: '35%' }} />
                        </div>
                        <div className="flex justify-between text-[9px] text-app-muted-foreground/60">
                            <span>0%</span>
                            <span className="text-app-foreground/40 font-semibold">↑ Industry avg (35%)</span>
                            <span>100%</span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-app-border/50">
                        <div className="text-center">
                            <p className="text-[10px] text-app-muted-foreground font-medium">Cost</p>
                            <p className="text-[13px] font-bold text-app-foreground">{currency}{costHT.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-app-muted-foreground font-medium">Profit</p>
                            <p className={`text-[13px] font-bold ${status.color}`}>{currency}{marginValue.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] text-app-muted-foreground font-medium">Markup</p>
                            <p className="text-[13px] font-bold text-app-foreground">{markupPercent.toFixed(1)}%</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
