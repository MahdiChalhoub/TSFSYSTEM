// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, DollarSign, Percent, BarChart3, ArrowRightLeft } from 'lucide-react';

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

    // Which field was last edited — prevents circular updates
    const [lastEdited, setLastEdited] = useState<'ht' | 'ttc' | 'margin' | 'markup' | null>(null);

    // ── Core Computed Values ──
    const taxMultiplier = 1 + taxPercent;

    // HT & TTC always computed from the source
    const costHT = isTaxIncluded ? costPrice / taxMultiplier : costPrice;
    const costTTC = isTaxIncluded ? costPrice : costPrice * taxMultiplier;
    const sellHT = isTaxIncluded ? sellPrice / taxMultiplier : sellPrice;
    const sellTTC = isTaxIncluded ? sellPrice : sellPrice * taxMultiplier;

    // Margin & Markup
    const marginValue = sellHT - costHT;
    const marginPercent = costHT > 0 ? (marginValue / sellHT) * 100 : 0;
    const markupPercent = costHT > 0 ? (marginValue / costHT) * 100 : 0;

    // ── Local editable values (for controlled inputs) ──
    const [localCostHT, setLocalCostHT] = useState('');
    const [localCostTTC, setLocalCostTTC] = useState('');
    const [localSellHT, setLocalSellHT] = useState('');
    const [localSellTTC, setLocalSellTTC] = useState('');
    const [localMargin, setLocalMargin] = useState('');
    const [localMarkup, setLocalMarkup] = useState('');

    // Sync local values from computed when not actively editing
    useEffect(() => {
        if (lastEdited !== 'ht') {
            setLocalCostHT(costHT > 0 ? costHT.toFixed(2) : '');
            setLocalSellHT(sellHT > 0 ? sellHT.toFixed(2) : '');
        }
        if (lastEdited !== 'ttc') {
            setLocalCostTTC(costTTC > 0 ? costTTC.toFixed(2) : '');
            setLocalSellTTC(sellTTC > 0 ? sellTTC.toFixed(2) : '');
        }
        if (lastEdited !== 'margin') {
            setLocalMargin(marginPercent !== 0 ? marginPercent.toFixed(2) : '');
        }
        if (lastEdited !== 'markup') {
            setLocalMarkup(markupPercent !== 0 ? markupPercent.toFixed(2) : '');
        }
        // Reset last edited after sync
        const timer = setTimeout(() => setLastEdited(null), 100);
        return () => clearTimeout(timer);
    }, [costPrice, sellPrice, taxPercent, isTaxIncluded]);

    // ── Handler: Edit Cost HT ──
    const handleCostHTChange = (val: string) => {
        setLocalCostHT(val);
        setLastEdited('ht');
        const num = parseFloat(val) || 0;
        onCostChange(isTaxIncluded ? num * taxMultiplier : num);
    };

    // ── Handler: Edit Cost TTC ──
    const handleCostTTCChange = (val: string) => {
        setLocalCostTTC(val);
        setLastEdited('ttc');
        const num = parseFloat(val) || 0;
        onCostChange(isTaxIncluded ? num : num / taxMultiplier);
    };

    // ── Handler: Edit Sell HT ──
    const handleSellHTChange = (val: string) => {
        setLocalSellHT(val);
        setLastEdited('ht');
        setStrategy('fixed');
        const num = parseFloat(val) || 0;
        onSellChange(isTaxIncluded ? num * taxMultiplier : num);
    };

    // ── Handler: Edit Sell TTC ──
    const handleSellTTCChange = (val: string) => {
        setLocalSellTTC(val);
        setLastEdited('ttc');
        setStrategy('fixed');
        const num = parseFloat(val) || 0;
        onSellChange(isTaxIncluded ? num : num / taxMultiplier);
    };

    // ── Handler: Edit Margin % ──
    const handleMarginChange = (val: string) => {
        setLocalMargin(val);
        setLastEdited('margin');
        setStrategy('margin');
        const pct = parseFloat(val) || 0;
        setMarginTarget(pct);
        if (costHT > 0 && pct < 100) {
            const newSellHT = costHT / (1 - pct / 100);
            onSellChange(isTaxIncluded ? newSellHT * taxMultiplier : newSellHT);
        }
    };

    // ── Handler: Edit Markup % ──
    const handleMarkupChange = (val: string) => {
        setLocalMarkup(val);
        setLastEdited('markup');
        setStrategy('markup');
        const pct = parseFloat(val) || 0;
        setMarkupTarget(pct);
        if (costHT > 0) {
            const newSellHT = costHT * (1 + pct / 100);
            onSellChange(isTaxIncluded ? newSellHT * taxMultiplier : newSellHT);
        }
    };

    // Auto-calc sell price when strategy target changes via slider
    useEffect(() => {
        if (strategy === 'margin' && costHT > 0 && lastEdited !== 'margin') {
            const newSellHT = costHT / (1 - marginTarget / 100);
            onSellChange(isTaxIncluded ? newSellHT * taxMultiplier : newSellHT);
        } else if (strategy === 'markup' && costHT > 0 && lastEdited !== 'markup') {
            const newSellHT = costHT * (1 + markupTarget / 100);
            onSellChange(isTaxIncluded ? newSellHT * taxMultiplier : newSellHT);
        }
    }, [strategy, marginTarget, markupTarget, costPrice]);

    // Status determination
    const getStatus = () => {
        if (marginPercent >= 40) return { label: 'Excellent', color: 'text-app-success', bg: 'bg-app-success', barColor: 'from-emerald-400 to-emerald-600' };
        if (marginPercent >= 25) return { label: 'Good', color: 'text-app-info', bg: 'bg-app-info', barColor: 'from-blue-400 to-blue-600' };
        if (marginPercent >= 10) return { label: 'Low', color: 'text-app-warning', bg: 'bg-app-warning', barColor: 'from-amber-400 to-amber-600' };
        if (marginPercent > 0) return { label: 'Thin', color: 'text-app-warning', bg: 'bg-app-warning', barColor: 'from-orange-400 to-orange-600' };
        return { label: 'Loss', color: 'text-app-error', bg: 'bg-app-error', barColor: 'from-red-400 to-red-600' };
    };
    const status = getStatus();

    const strategies: { id: PricingStrategy; label: string; icon: typeof DollarSign }[] = [
        { id: 'fixed', label: 'Fixed Price', icon: DollarSign },
        { id: 'margin', label: 'Margin %', icon: Percent },
        { id: 'markup', label: 'Markup %', icon: TrendingUp },
    ];

    const smallLabel = "block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-widest";
    const priceInput = "w-full bg-app-surface border border-app-border rounded-lg pl-7 pr-3 py-2 text-[12px] font-bold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 transition-all";
    const sellInput = "w-full bg-app-primary/5 border border-app-primary/30 rounded-lg pl-7 pr-3 py-2 text-[12px] font-bold text-app-primary outline-none focus:ring-2 focus:ring-app-primary/20 transition-all";
    const metricInput = "w-full bg-app-surface border border-app-border rounded-lg px-3 py-2 text-[12px] font-bold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all text-right";

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
                                    flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-bold transition-all
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

            {/* ═══ Cost Price: HT & TTC side by side ═══ */}
            <div>
                <label className="block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest">Cost Price</label>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={smallLabel}>HT (excl. tax)</label>
                        <div className="relative">
                            <span className="absolute left-2.5 top-[8px] text-app-muted-foreground text-[11px] font-bold">{currency}</span>
                            <input
                                type="number"
                                step="0.01"
                                value={localCostHT}
                                onChange={e => handleCostHTChange(e.target.value)}
                                className={priceInput}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div>
                        <label className={smallLabel}>TTC (incl. tax)</label>
                        <div className="relative">
                            <span className="absolute left-2.5 top-[8px] text-app-muted-foreground text-[11px] font-bold">{currency}</span>
                            <input
                                type="number"
                                step="0.01"
                                value={localCostTTC}
                                onChange={e => handleCostTTCChange(e.target.value)}
                                className={priceInput}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Selling Price: HT & TTC side by side ═══ */}
            <div>
                <label className="block text-[10px] font-semibold text-app-muted-foreground mb-1.5 uppercase tracking-widest">
                    Selling Price <span className="text-app-error">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className={smallLabel}>HT (excl. tax)</label>
                        <div className="relative">
                            <span className="absolute left-2.5 top-[8px] text-app-primary text-[11px] font-bold">{currency}</span>
                            <input
                                type="number"
                                step="0.01"
                                value={localSellHT}
                                onChange={e => handleSellHTChange(e.target.value)}
                                className={sellInput}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div>
                        <label className={smallLabel}>TTC (incl. tax)</label>
                        <div className="relative">
                            <span className="absolute left-2.5 top-[8px] text-app-primary text-[11px] font-bold">{currency}</span>
                            <input
                                type="number"
                                step="0.01"
                                value={localSellTTC}
                                onChange={e => handleSellTTCChange(e.target.value)}
                                className={sellInput}
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Margin & Markup — always editable ═══ */}
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className={smallLabel}>Margin %</label>
                    <div className="relative">
                        <input
                            type="number"
                            step="0.01"
                            value={localMargin}
                            onChange={e => handleMarginChange(e.target.value)}
                            className={metricInput + (marginPercent < 0 ? ' !text-app-error !border-app-error' : '')}
                            placeholder="0.00"
                        />
                        <span className="absolute right-3 top-[8px] text-app-muted-foreground text-[11px] font-bold">%</span>
                    </div>
                    <p className="text-[9px] text-app-muted-foreground mt-0.5">Profit ÷ Sell Price</p>
                </div>
                <div>
                    <label className={smallLabel}>Markup %</label>
                    <div className="relative">
                        <input
                            type="number"
                            step="0.01"
                            value={localMarkup}
                            onChange={e => handleMarkupChange(e.target.value)}
                            className={metricInput + (markupPercent < 0 ? ' !text-app-error !border-app-error' : '')}
                            placeholder="0.00"
                        />
                        <span className="absolute right-3 top-[8px] text-app-muted-foreground text-[11px] font-bold">%</span>
                    </div>
                    <p className="text-[9px] text-app-muted-foreground mt-0.5">Profit ÷ Cost Price</p>
                </div>
            </div>

            {/* Strategy target slider (when margin/markup strategy is active) */}
            {strategy === 'margin' && (
                <div className="p-3 rounded-lg bg-app-primary/5 border border-app-primary/20">
                    <label className="block text-[9px] font-semibold text-app-primary mb-1.5 uppercase tracking-widest">Target Margin Slider</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={5}
                            max={80}
                            value={marginTarget}
                            onChange={e => { setMarginTarget(parseInt(e.target.value)); setLastEdited(null); }}
                            className="flex-1 h-2 rounded-full appearance-none bg-app-surface-hover cursor-pointer accent-app-primary"
                        />
                        <span className="text-[13px] font-black text-app-primary w-12 text-right">{marginTarget}%</span>
                    </div>
                </div>
            )}
            {strategy === 'markup' && (
                <div className="p-3 rounded-lg bg-app-primary/5 border border-app-primary/20">
                    <label className="block text-[9px] font-semibold text-app-primary mb-1.5 uppercase tracking-widest">Target Markup Slider</label>
                    <div className="flex items-center gap-3">
                        <input
                            type="range"
                            min={5}
                            max={200}
                            value={markupTarget}
                            onChange={e => { setMarkupTarget(parseInt(e.target.value)); setLastEdited(null); }}
                            className="flex-1 h-2 rounded-full appearance-none bg-app-surface-hover cursor-pointer accent-app-primary"
                        />
                        <span className="text-[13px] font-black text-app-primary w-12 text-right">{markupTarget}%</span>
                    </div>
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
            </div>

            {/* Hidden form fields for submission */}
            <input type="hidden" name="costPrice" value={costPrice} />
            <input type="hidden" name="basePrice" value={sellPrice} />
            <input type="hidden" name="costPriceHT" value={costHT.toFixed(2)} />
            <input type="hidden" name="costPriceTTC" value={costTTC.toFixed(2)} />
            <input type="hidden" name="sellPriceHT" value={sellHT.toFixed(2)} />
            <input type="hidden" name="sellPriceTTC" value={sellTTC.toFixed(2)} />
            <input type="hidden" name="taxRate" value={taxPercent} />
            <input type="hidden" name="marginPercent" value={marginPercent.toFixed(2)} />
            <input type="hidden" name="markupPercent" value={markupPercent.toFixed(2)} />
            {isTaxIncluded && <input type="hidden" name="isTaxIncluded" value="on" />}

            {/* Margin Analyzer Bar */}
            {costPrice > 0 && sellPrice > 0 && (
                <div className="p-3.5 rounded-xl bg-app-surface border border-app-border space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-app-muted-foreground" />
                            <span className="text-[11px] font-bold text-app-foreground">Margin Analysis</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${status.color}`} style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
                            {status.label}
                        </span>
                    </div>

                    {/* Profit Bar */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-semibold">
                            <span className="text-app-muted-foreground">Gross Margin</span>
                            <span className={status.color}>{marginPercent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 bg-app-surface-hover rounded-full overflow-hidden relative">
                            <div
                                className={`h-full rounded-full bg-gradient-to-r ${status.barColor} transition-all duration-500 ease-out`}
                                style={{ width: `${Math.min(Math.max(marginPercent, 0), 100)}%` }}
                            />
                            <div className="absolute top-0 bottom-0 w-px bg-app-foreground/30" style={{ left: '35%' }} />
                        </div>
                        <div className="flex justify-between text-[8px] text-app-muted-foreground/60">
                            <span>0%</span>
                            <span className="text-app-foreground/40 font-semibold">↑ 35%</span>
                            <span>100%</span>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-app-border/50">
                        <div className="text-center">
                            <p className="text-[8px] text-app-muted-foreground font-medium">Cost HT</p>
                            <p className="text-[11px] font-bold text-app-foreground">{currency}{costHT.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[8px] text-app-muted-foreground font-medium">Sell HT</p>
                            <p className="text-[11px] font-bold text-app-primary">{currency}{sellHT.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[8px] text-app-muted-foreground font-medium">Profit</p>
                            <p className={`text-[11px] font-bold ${status.color}`}>{currency}{marginValue.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[8px] text-app-muted-foreground font-medium">Sell TTC</p>
                            <p className="text-[11px] font-bold text-app-foreground">{currency}{sellTTC.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
