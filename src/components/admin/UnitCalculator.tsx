'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowRightLeft } from 'lucide-react';

type Unit = {
 id: number;
 name: string;
 code: string;
 conversionFactor: number;
 baseUnitId: number | null;
};

export function UnitCalculator({ units = [] }: { units?: Unit[] }) {
 const [quantity, setQuantity] = useState<number>(1);
 const [fromUnitId, setFromUnitId] = useState<string>('');
 const [toUnitId, setToUnitId] = useState<string>('');
 const [result, setResult] = useState<string>('---');

 // Recursive helper to get factor relative to the absolute root
 // Returns { rootId, totalFactor }
 const getRootInfo = useCallback((unitId: number): { rootId: number, totalFactor: number } => {
 const unit = units.find(u => u.id === unitId);
 if (!unit) return { rootId: -1, totalFactor: 0 };

 if (!unit.baseUnitId) {
 return { rootId: unit.id, totalFactor: 1 };
 }

 const parentInfo = getRootInfo(unit.baseUnitId);
 return {
 rootId: parentInfo.rootId,
 totalFactor: Number(unit.conversionFactor) * parentInfo.totalFactor
 };
 }, [units]);

 // Initialize defaults
 useEffect(() => {
 if (units.length > 0 && !fromUnitId) {
 const root = units.find(u => !u.baseUnitId);
 const child = units.find(u => u.baseUnitId === root?.id);

 if (child && root) {
 setFromUnitId(child.id.toString());
 } else if (units.length > 0) {
 setFromUnitId(units[0].id.toString());
 }
 }
 }, [units, fromUnitId]);

 // Calculate Compatible Units
 const compatibleUnits = useMemo(() => {
 if (!fromUnitId) return [];
 const fromRoot = getRootInfo(parseInt(fromUnitId)).rootId;

 // Filter units that share the same root
 return units.filter(u => getRootInfo(u.id).rootId === fromRoot);
 }, [fromUnitId, units, getRootInfo]);

 // Auto-select valid To Unit if current selection is invalid
 useEffect(() => {
 if (compatibleUnits.length > 0) {
 const isCurrentValid = compatibleUnits.some(u => u.id.toString() === toUnitId);
 if (!isCurrentValid || !toUnitId) {
 // Default to root or first available
 const root = compatibleUnits.find(u => !u.baseUnitId);
 setToUnitId(root ? root.id.toString() : compatibleUnits[0].id.toString());
 }
 } else {
 setToUnitId('');
 }
 }, [compatibleUnits, toUnitId]);

 // Calculation Logic
 useEffect(() => {
 if (!fromUnitId || !toUnitId || units.length === 0) return;

 const fromId = parseInt(fromUnitId);
 const toId = parseInt(toUnitId);

 if (fromId === toId) {
 setResult(`${quantity}`);
 return;
 }

 const fromInfo = getRootInfo(fromId);
 const toInfo = getRootInfo(toId);

 if (fromInfo.rootId !== toInfo.rootId) {
 setResult("Incompatible"); // Should not happen with new UI logic
 return;
 }

 // Conversion
 // Quantity * (FromFactor / ToFactor)
 // 1 Pallet (120) to Box (12) -> 1 * (120 / 12) = 10.
 // 10 Boxes (12) to Pallet (120) -> 10 * (12 / 120) = 1.

 const ratio = fromInfo.totalFactor / toInfo.totalFactor;
 const total = quantity * ratio;

 // Format nicely (avoid long decimals)
 setResult(Number.isInteger(total) ? total.toString() : total.toFixed(4));

 }, [quantity, fromUnitId, toUnitId, units, getRootInfo]);

 const handleSwap = () => {
 const temp = fromUnitId;
 setFromUnitId(toUnitId);
 // We know toUnitId (old from) is compatible with fromUnitId (old to)
 // so we can just swap safely.
 setToUnitId(temp);
 };

 if (units.length === 0) return null;

 return (
 <div className="card-premium p-6 bg-app-info-bg/30 border-blue-100">
 <h3 className="font-bold text-app-text mb-4">Unit Conversion Calculator</h3>
 <div className="flex flex-col md:flex-row items-end gap-4">
 <div className="flex-1 w-full">
 <label className="block text-xs font-semibold text-app-text-muted mb-1 uppercase tracking-wider">Quantity</label>
 <input
 type="number"
 value={quantity}
 onChange={(e) => setQuantity(Number(e.target.value))}
 className="input-field bg-app-surface"
 placeholder="1"
 min="0"
 />
 </div>

 <div className="flex-1 w-full">
 <label className="block text-xs font-semibold text-app-text-muted mb-1 uppercase tracking-wider">From Unit</label>
 <select
 className="input-field bg-app-surface"
 value={fromUnitId}
 onChange={(e) => setFromUnitId(e.target.value)}
 >
 {units.map(u => (
 <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
 ))}
 </select>
 </div>

 <button
 onClick={handleSwap}
 className="mb-1 p-3 rounded-xl bg-app-surface border border-app-border text-app-text-muted hover:text-app-primary hover:border-app-success shadow-sm transition-all"
 title="Swap Units"
 >
 <ArrowRightLeft size={20} />
 </button>

 <div className="flex-1 w-full">
 <label className="block text-xs font-semibold text-app-text-muted mb-1 uppercase tracking-wider">To Unit</label>
 <select
 className="input-field bg-app-surface"
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
 <label className="block text-xs font-semibold text-app-text-muted mb-1 uppercase tracking-wider">Result</label>
 <input type="text" className="input-field bg-app-primary-light font-bold text-app-success border-emerald-100" value={result} readOnly disabled />
 </div>
 </div>
 </div>
 );
}