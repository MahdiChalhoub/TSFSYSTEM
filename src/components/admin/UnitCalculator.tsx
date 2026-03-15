'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowRightLeft } from 'lucide-react';

type Unit = {
    id: number;
    name: string;
    code: string;
    conversionFactor: number;
    baseUnitId: number | null;
    conversion_factor?: number;
    base_unit?: number | null;
};

export function UnitCalculator({ units = [] }: { units?: any[] }) {
    const [quantity, setQuantity] = useState<number>(1);
    const [fromUnitId, setFromUnitId] = useState<string>('');
    const [toUnitId, setToUnitId] = useState<string>('');
    const [result, setResult] = useState<string>('---');

    // Normalize unit data (handle both camelCase and snake_case)
    const normalizedUnits = useMemo(() =>
        units.map(u => ({
            id: u.id,
            name: u.name,
            code: u.code,
            conversionFactor: u.conversionFactor ?? u.conversion_factor ?? 1,
            baseUnitId: u.baseUnitId ?? u.base_unit ?? null,
        })),
        [units]
    );

    const getRootInfo = useCallback((unitId: number): { rootId: number, totalFactor: number } => {
        const unit = normalizedUnits.find(u => u.id === unitId);
        if (!unit) return { rootId: -1, totalFactor: 0 };
        if (!unit.baseUnitId) return { rootId: unit.id, totalFactor: 1 };
        const parentInfo = getRootInfo(unit.baseUnitId);
        return { rootId: parentInfo.rootId, totalFactor: Number(unit.conversionFactor) * parentInfo.totalFactor };
    }, [normalizedUnits]);

    useEffect(() => {
        if (normalizedUnits.length > 0 && !fromUnitId) {
            const root = normalizedUnits.find(u => !u.baseUnitId);
            const child = normalizedUnits.find(u => u.baseUnitId === root?.id);
            if (child) setFromUnitId(child.id.toString());
            else if (normalizedUnits.length > 0) setFromUnitId(normalizedUnits[0].id.toString());
        }
    }, [normalizedUnits, fromUnitId]);

    const compatibleUnits = useMemo(() => {
        if (!fromUnitId) return [];
        const fromRoot = getRootInfo(parseInt(fromUnitId)).rootId;
        return normalizedUnits.filter(u => getRootInfo(u.id).rootId === fromRoot);
    }, [fromUnitId, normalizedUnits, getRootInfo]);

    useEffect(() => {
        if (compatibleUnits.length > 0) {
            const isCurrentValid = compatibleUnits.some(u => u.id.toString() === toUnitId);
            if (!isCurrentValid || !toUnitId) {
                const root = compatibleUnits.find(u => !u.baseUnitId);
                setToUnitId(root ? root.id.toString() : compatibleUnits[0].id.toString());
            }
        } else {
            setToUnitId('');
        }
    }, [compatibleUnits, toUnitId]);

    useEffect(() => {
        if (!fromUnitId || !toUnitId || normalizedUnits.length === 0) return;
        const fromId = parseInt(fromUnitId);
        const toId = parseInt(toUnitId);
        if (fromId === toId) { setResult(`${quantity}`); return; }
        const fromInfo = getRootInfo(fromId);
        const toInfo = getRootInfo(toId);
        if (fromInfo.rootId !== toInfo.rootId) { setResult("Incompatible"); return; }
        const ratio = fromInfo.totalFactor / toInfo.totalFactor;
        const total = quantity * ratio;
        setResult(Number.isInteger(total) ? total.toString() : total.toFixed(4));
    }, [quantity, fromUnitId, toUnitId, normalizedUnits, getRootInfo]);

    const handleSwap = () => {
        const temp = fromUnitId;
        setFromUnitId(toUnitId);
        setToUnitId(temp);
    };

    if (normalizedUnits.length === 0) return null;

    const selectStyle = {
        background: 'var(--app-background)',
        border: '1px solid var(--app-border)',
        color: 'var(--app-foreground)',
    };

    return (
        <div className="rounded-xl p-4" style={{ background: 'color-mix(in srgb, var(--app-info) 4%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}>
            <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                    <ArrowRightLeft size={12} />
                </div>
                <span className="text-[11px] font-black text-app-foreground">Unit Conversion Calculator</span>
            </div>
            <div className="flex flex-col sm:flex-row items-end gap-2">
                <div className="flex-1 w-full">
                    <label className="block text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Quantity</label>
                    <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg text-[13px] font-medium outline-none transition-all"
                        style={selectStyle}
                        placeholder="1"
                        min="0"
                    />
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">From</label>
                    <select
                        className="w-full px-3 py-2 rounded-lg text-[13px] font-medium outline-none transition-all appearance-none"
                        style={selectStyle}
                        value={fromUnitId}
                        onChange={(e) => setFromUnitId(e.target.value)}
                    >
                        {normalizedUnits.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                        ))}
                    </select>
                </div>
                <button
                    onClick={handleSwap}
                    className="p-2 rounded-lg transition-all flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', color: 'var(--app-info)', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)' }}
                    title="Swap Units"
                >
                    <ArrowRightLeft size={14} />
                </button>
                <div className="flex-1 w-full">
                    <label className="block text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">To</label>
                    <select
                        className="w-full px-3 py-2 rounded-lg text-[13px] font-medium outline-none transition-all appearance-none"
                        style={selectStyle}
                        value={toUnitId}
                        onChange={(e) => setToUnitId(e.target.value)}
                        disabled={compatibleUnits.length === 0}
                    >
                        {compatibleUnits.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 w-full">
                    <label className="block text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Result</label>
                    <input
                        type="text"
                        className="w-full px-3 py-2 rounded-lg text-[13px] font-black outline-none tabular-nums"
                        style={{
                            background: 'color-mix(in srgb, var(--app-success) 8%, var(--app-background))',
                            border: '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)',
                            color: 'var(--app-success)',
                        }}
                        value={result}
                        readOnly
                        disabled
                    />
                </div>
            </div>
        </div>
    );
}