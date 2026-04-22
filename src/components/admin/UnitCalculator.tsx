'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowRightLeft, Calculator, Scale, Ruler, Info } from 'lucide-react';

// The backend serializes units as snake_case (`base_unit`, `conversion_factor`)
// but some callers pass camelCase. Tolerate both: these helpers look up
// either form and normalize on read.
type RawUnit = {
    id: number;
    name: string;
    code: string;
    // snake_case (what the API actually returns)
    base_unit?: number | null;
    conversion_factor?: number | string;
    // camelCase fallback (older client-side normalizations)
    baseUnitId?: number | null;
    conversionFactor?: number | string;
};
type Unit = RawUnit;

const getBaseUnitId = (u: RawUnit | undefined): number | null => {
    if (!u) return null;
    const v = u.base_unit ?? u.baseUnitId;
    return v == null ? null : Number(v);
};
const getFactor = (u: RawUnit | undefined): number => {
    if (!u) return 1;
    const v = u.conversion_factor ?? u.conversionFactor ?? 1;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 1;
};

export function UnitCalculator({
    units = [],
    defaultUnit,
    variant = 'card',
}: {
    units?: Unit[];
    defaultUnit?: any;
    /** 'card' = self-contained card with header (default).
     *  'embedded' = no outer card or header — blends into its host container
     *  (e.g. the detail panel's Calculator tab, which already provides a card). */
    variant?: 'card' | 'embedded';
}) {
    const [quantity, setQuantity] = useState<number>(1);
    const [fromUnitId, setFromUnitId] = useState<string>('');
    const [toUnitId, setToUnitId] = useState<string>('');
    const [result, setResult] = useState<string>('—');

    // Returns { rootId, totalFactor } — walks the base_unit chain to the absolute root.
    const getRootInfo = useCallback((unitId: number): { rootId: number; totalFactor: number } => {
        const unit = units.find(u => u.id === unitId);
        if (!unit) return { rootId: -1, totalFactor: 0 };
        const parentId = getBaseUnitId(unit);
        if (parentId == null) return { rootId: unit.id, totalFactor: 1 };
        const parentInfo = getRootInfo(parentId);
        return {
            rootId: parentInfo.rootId,
            totalFactor: getFactor(unit) * parentInfo.totalFactor,
        };
    }, [units]);

    // Initialize defaults — prefer the current "defaultUnit" if it's provided (from context)
    useEffect(() => {
        if (units.length > 0 && !fromUnitId) {
            if (defaultUnit?.id && units.find(u => u.id === defaultUnit.id)) {
                setFromUnitId(defaultUnit.id.toString());
                return;
            }
            const root = units.find(u => getBaseUnitId(u) == null);
            const child = units.find(u => root && getBaseUnitId(u) === root.id);
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
                const root = compatibleUnits.find(u => getBaseUnitId(u) == null);
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

    const isSelfConversion = compatibleUnits.length <= 1;
    const hasMeaningfulResult = fromUnit && toUnit && !Number.isNaN(total);
    const isEmbedded = variant === 'embedded';

    // Wrapper that disappears when embedded (host provides the card).
    const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) =>
        isEmbedded ? (
            <>{children}</>
        ) : (
            <div className="rounded-2xl overflow-hidden"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)',
                }}>
                {children}
            </div>
        );

    return (
        <div className="space-y-3">
            {/* ══ Equation block — wrapper disappears in `embedded` mode ══════════ */}
            <Shell>
                {/* Header — skipped in embedded mode (host already titled the section) */}
                {!isEmbedded && (
                    <div className="flex items-center justify-between px-4 py-2.5"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 5%, var(--app-surface))',
                            borderBottom: '1px solid var(--app-border)',
                        }}>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                    color: 'var(--app-primary)',
                                }}>
                                <Calculator size={13} />
                            </div>
                            <div>
                                <div className="text-[13px] font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                                    Conversion Calculator
                                </div>
                                <div className="text-[9px] font-black uppercase tracking-widest"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    {compatibleUnits.length} Compatible Unit{compatibleUnits.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Equation Body — compact, same font scale as Packages form */}
                <div className={isEmbedded ? '' : 'p-3'}>
                    <div className="flex items-center flex-wrap gap-1.5">
                        {/* Quantity */}
                        <input type="number" min="0" value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            placeholder="1"
                            className="w-[64px] px-2 py-1.5 rounded-lg text-[12px] font-mono font-bold text-center outline-none transition-all focus:ring-2"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />

                        {/* From unit */}
                        <select value={fromUnitId} onChange={(e) => setFromUnitId(e.target.value)}
                            className="flex-1 min-w-[100px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer appearance-none outline-none transition-all focus:ring-2"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                            {units.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                            ))}
                        </select>

                        {/* Swap — compact 28×28 matching the other icon buttons */}
                        <button type="button" onClick={handleSwap}
                            disabled={isSelfConversion}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 flex-shrink-0"
                            style={{
                                background: 'var(--app-primary)', color: 'white',
                                boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            }}
                            title="Swap units">
                            <ArrowRightLeft size={11} />
                        </button>

                        {/* To unit */}
                        <select value={toUnitId} onChange={(e) => setToUnitId(e.target.value)}
                            disabled={compatibleUnits.length === 0}
                            className="flex-1 min-w-[100px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer appearance-none outline-none transition-all focus:ring-2 disabled:opacity-50"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                            {compatibleUnits.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                            ))}
                        </select>

                        {/* = sign — same size as body text */}
                        <span className="text-[12px] font-black font-mono px-0.5 flex-shrink-0"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            =
                        </span>

                        {/* Result — inline, same rhythm as inputs */}
                        <div className="flex items-baseline gap-1 px-2.5 py-1.5 rounded-lg flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            }}>
                            <span className="text-[13px] font-black font-mono tabular-nums leading-none"
                                style={{ color: 'var(--app-primary)' }}
                                title={result}>
                                {result}
                            </span>
                            <span className="text-[10px] font-black" style={{ color: 'var(--app-primary)', opacity: 0.75 }}>
                                {toUnit?.code || ''}
                            </span>
                        </div>
                    </div>

                    {/* Sub-caption: live ratio on its own line — quieter than the equation */}
                    {hasMeaningfulResult && ratio > 0 && fromUnitId !== toUnitId && (
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            <Info size={9} />
                            <span>
                                1 <span className="font-black" style={{ color: 'var(--app-primary)' }}>{fromUnit.code}</span> ={' '}
                                <span className="font-mono font-black" style={{ color: 'var(--app-foreground)' }}>
                                    {ratio >= 1 ? ratio.toLocaleString(undefined, { maximumFractionDigits: 4 }) : ratio.toFixed(4)}
                                </span>{' '}
                                <span className="font-black" style={{ color: 'var(--app-primary)' }}>{toUnit.code}</span>
                            </span>
                        </div>
                    )}
                </div>
            </Shell>

            {/* ── Hint strip — self-conversion edge case ── */}
            {isSelfConversion && (
                <div className="px-3 py-2 rounded-xl text-[10px] font-bold flex items-start gap-1.5"
                    style={{
                        background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)',
                        color: 'var(--app-warning, #f59e0b)',
                        border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)',
                    }}>
                    <Info size={11} className="mt-0.5 flex-shrink-0" />
                    <span className="leading-snug">
                        No derived units exist from this unit yet — only self-conversion is available. Add derived units with a conversion factor to enable cross-unit calculations.
                    </span>
                </div>
            )}
        </div>
    );
}
