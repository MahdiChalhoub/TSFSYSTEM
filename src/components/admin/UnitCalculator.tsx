'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowRightLeft, Calculator, Scale, Ruler, Info } from 'lucide-react';

type Unit = {
    id: number;
    name: string;
    code: string;
    conversionFactor: number;
    baseUnitId: number | null;
};

export function UnitCalculator({ units = [], defaultUnit }: { units?: Unit[]; defaultUnit?: any }) {
    const [quantity, setQuantity] = useState<number>(1);
    const [fromUnitId, setFromUnitId] = useState<string>('');
    const [toUnitId, setToUnitId] = useState<string>('');
    const [result, setResult] = useState<string>('—');

    // Returns { rootId, totalFactor } — walks the base_unit chain to the absolute root
    const getRootInfo = useCallback((unitId: number): { rootId: number; totalFactor: number } => {
        const unit = units.find(u => u.id === unitId);
        if (!unit) return { rootId: -1, totalFactor: 0 };
        if (!unit.baseUnitId) return { rootId: unit.id, totalFactor: 1 };
        const parentInfo = getRootInfo(unit.baseUnitId);
        return {
            rootId: parentInfo.rootId,
            totalFactor: Number(unit.conversionFactor) * parentInfo.totalFactor,
        };
    }, [units]);

    // Initialize defaults — prefer the current "defaultUnit" if it's provided (from context)
    useEffect(() => {
        if (units.length > 0 && !fromUnitId) {
            if (defaultUnit?.id && units.find(u => u.id === defaultUnit.id)) {
                setFromUnitId(defaultUnit.id.toString());
                return;
            }
            const root = units.find(u => !u.baseUnitId);
            const child = units.find(u => u.baseUnitId === root?.id);
            setFromUnitId((child || root || units[0]).id.toString());
        }
    }, [units, fromUnitId, defaultUnit]);

    // Units sharing the same root as the current "from"
    const compatibleUnits = useMemo(() => {
        if (!fromUnitId) return [];
        const fromRoot = getRootInfo(parseInt(fromUnitId)).rootId;
        return units.filter(u => getRootInfo(u.id).rootId === fromRoot);
    }, [fromUnitId, units, getRootInfo]);

    // Auto-select a valid "to" unit when compatibleUnits change
    useEffect(() => {
        if (compatibleUnits.length > 0) {
            const isCurrentValid = compatibleUnits.some(u => u.id.toString() === toUnitId);
            if (!isCurrentValid || !toUnitId) {
                const root = compatibleUnits.find(u => !u.baseUnitId);
                setToUnitId((root || compatibleUnits[0]).id.toString());
            }
        } else {
            setToUnitId('');
        }
    }, [compatibleUnits, toUnitId]);

    // Live conversion
    const { total, ratio, fromUnit, toUnit } = useMemo(() => {
        if (!fromUnitId || !toUnitId || units.length === 0) {
            return { total: 0, ratio: 0, fromUnit: null, toUnit: null };
        }
        const fromId = parseInt(fromUnitId);
        const toId = parseInt(toUnitId);
        const fromU = units.find(u => u.id === fromId) || null;
        const toU = units.find(u => u.id === toId) || null;
        if (fromId === toId) return { total: quantity, ratio: 1, fromUnit: fromU, toUnit: toU };
        const fromInfo = getRootInfo(fromId);
        const toInfo = getRootInfo(toId);
        if (fromInfo.rootId !== toInfo.rootId) return { total: NaN, ratio: 0, fromUnit: fromU, toUnit: toU };
        const r = fromInfo.totalFactor / toInfo.totalFactor;
        return { total: quantity * r, ratio: r, fromUnit: fromU, toUnit: toU };
    }, [quantity, fromUnitId, toUnitId, units, getRootInfo]);

    useEffect(() => {
        if (Number.isNaN(total)) setResult('Incompatible');
        else if (Number.isInteger(total)) setResult(total.toLocaleString());
        else setResult(total.toLocaleString(undefined, { maximumFractionDigits: 4 }));
    }, [total]);

    const handleSwap = () => {
        const temp = fromUnitId;
        setFromUnitId(toUnitId);
        setToUnitId(temp);
    };

    if (units.length === 0) {
        return (
            <div className="p-6 rounded-2xl text-center"
                style={{
                    background: 'color-mix(in srgb, var(--app-muted-foreground) 6%, var(--app-surface))',
                    border: '1px solid var(--app-border)',
                    color: 'var(--app-muted-foreground)',
                }}>
                <Scale size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-[12px] font-bold">No units available to convert.</p>
            </div>
        );
    }

    const inputCls = "w-full px-3 py-2.5 rounded-xl text-[13px] font-bold outline-none transition-all focus:ring-2";
    const labelCls = "block text-[9px] font-black uppercase tracking-widest mb-1.5";

    return (
        <div className="rounded-2xl overflow-hidden"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)',
            }}>
            {/* ── Header ── */}
            <div className="px-5 py-3 flex items-center justify-between"
                style={{
                    background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)',
                            color: 'var(--app-primary)',
                        }}>
                        <Calculator size={14} />
                    </div>
                    <div>
                        <div className="text-[13px] font-black" style={{ color: 'var(--app-foreground)' }}>
                            Conversion Calculator
                        </div>
                        <div className="text-[10px] font-semibold" style={{ color: 'var(--app-muted-foreground)' }}>
                            Convert between compatible units
                        </div>
                    </div>
                </div>
                {fromUnit && toUnit && ratio > 0 && !Number.isNaN(total) && (
                    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                        style={{
                            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
                            color: 'var(--app-info, #3b82f6)',
                        }}
                        title="Live ratio">
                        <Info size={10} />
                        1 {fromUnit.code} = {ratio >= 1 ? ratio.toLocaleString(undefined, { maximumFractionDigits: 4 }) : ratio.toFixed(4)} {toUnit.code}
                    </div>
                )}
            </div>

            {/* ── Body ── */}
            <div className="p-4 md:p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_1fr] gap-3 md:items-end">
                    <div>
                        <label className={labelCls} style={{ color: 'var(--app-muted-foreground)' }}>
                            Quantity
                        </label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className={inputCls}
                            placeholder="1"
                            min="0"
                            style={{
                                background: 'var(--app-background)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)',
                            }}
                        />
                    </div>

                    <div>
                        <label className={labelCls} style={{ color: 'var(--app-muted-foreground)' }}>
                            <Ruler size={9} className="inline mr-1" /> From
                        </label>
                        <select
                            value={fromUnitId}
                            onChange={(e) => setFromUnitId(e.target.value)}
                            className={inputCls + " cursor-pointer appearance-none"}
                            style={{
                                background: 'var(--app-background)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)',
                            }}>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex justify-center">
                        <button
                            onClick={handleSwap}
                            type="button"
                            className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 10%, var(--app-surface))',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                                color: 'var(--app-primary)',
                            }}
                            title="Swap units">
                            <ArrowRightLeft size={15} />
                        </button>
                    </div>

                    <div>
                        <label className={labelCls} style={{ color: 'var(--app-muted-foreground)' }}>
                            <Scale size={9} className="inline mr-1" /> To
                        </label>
                        <select
                            value={toUnitId}
                            onChange={(e) => setToUnitId(e.target.value)}
                            disabled={compatibleUnits.length === 0}
                            className={inputCls + " cursor-pointer appearance-none disabled:opacity-50"}
                            style={{
                                background: 'var(--app-background)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)',
                            }}>
                            {compatibleUnits.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── Result Panel (primary emphasis) ── */}
                <div className="mt-2 px-5 py-4 rounded-2xl flex items-center justify-between gap-4"
                    style={{
                        background: `linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 8%, var(--app-surface)) 0%, color-mix(in srgb, var(--app-primary) 14%, var(--app-surface)) 100%)`,
                        border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                        boxShadow: '0 2px 12px color-mix(in srgb, var(--app-primary) 15%, transparent)',
                    }}>
                    <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-black uppercase tracking-widest mb-0.5"
                            style={{ color: 'var(--app-primary)', opacity: 0.7 }}>
                            Result
                        </div>
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-[10px] font-mono tabular-nums font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                {quantity.toLocaleString()} {fromUnit?.code || ''} =
                            </span>
                            <span className="text-[22px] md:text-[26px] font-black font-mono tabular-nums leading-none truncate"
                                style={{ color: 'var(--app-primary)' }}
                                title={result}>
                                {result}
                            </span>
                            <span className="text-[13px] font-black" style={{ color: 'var(--app-primary)', opacity: 0.7 }}>
                                {toUnit?.code || ''}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Hint strip ── */}
                {compatibleUnits.length <= 1 && (
                    <div className="px-3 py-2 rounded-xl text-[10px] font-semibold flex items-start gap-1.5"
                        style={{
                            background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                            color: 'var(--app-warning, #f59e0b)',
                            border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)',
                        }}>
                        <Info size={11} className="mt-0.5 flex-shrink-0" />
                        <span>No derived units exist from this unit yet — only self-conversion is available. Add derived units with a conversion factor to enable cross-unit calculations.</span>
                    </div>
                )}
            </div>
        </div>
    );
}
