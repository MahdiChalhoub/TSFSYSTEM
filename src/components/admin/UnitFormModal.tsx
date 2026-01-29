'use client';

import { useActionState } from 'react';
import { createUnit, updateUnit, UnitState } from '@/app/actions/inventory';
import { X, Save, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type UnitFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    unit?: any; // If provided, it's edit mode
    baseUnitId?: number | null; // For adding children
    baseUnitName?: string;
    potentialParents?: any[]; // For generic creation
};

const initialState: UnitState = { message: '', errors: {} };

export function UnitFormModal({ isOpen, onClose, unit, baseUnitId, baseUnitName, potentialParents = [] }: UnitFormModalProps) {
    const [state, formAction] = useActionState(unit ? updateUnit.bind(null, unit.id) : createUnit, initialState);
    const [pending, setPending] = useState(false);

    // Logic: If edit mode, rely on existing unit data. If adding child locally, force "derived". 
    // If generic create, allow choice.
    const [unitType, setUnitType] = useState<'base' | 'derived'>((baseUnitId || unit?.baseUnitId) ? 'derived' : 'base');
    const [selectedParentId, setSelectedParentId] = useState<number | string>(baseUnitId || unit?.baseUnitId || '');
    const [needsBalance, setNeedsBalance] = useState(unit?.needsBalance || false);

    useEffect(() => {
        if (state.message === 'success') {
            onClose();
        }
    }, [state, onClose]);

    // Logic: If inherited, force true.
    const parentUnit = potentialParents.find(p => p.id === Number(selectedParentId));
    const isInheritedBalance = parentUnit?.needsBalance || false;

    // Sync state if inherited
    useEffect(() => {
        if (isInheritedBalance) {
            setNeedsBalance(true);
        }
    }, [isInheritedBalance]);

    useEffect(() => {
        if (isOpen) {
            setUnitType((baseUnitId || unit?.baseUnitId) ? 'derived' : 'base');
            setSelectedParentId(baseUnitId || unit?.baseUnitId || '');
            setNeedsBalance(unit?.needsBalance || false);
        }
    }, [isOpen, baseUnitId, unit]);

    if (!isOpen) return null;

    // Safety: Prevent cycles by finding all descendants
    const descendantIds = new Set<number>();
    if (unit && unit.children) {
        const stack = [...unit.children];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node) {
                descendantIds.add(node.id);
                if (node.children) stack.push(...node.children);
            }
        }
    }

    // Filter out: Same Unit AND Any Descendants
    const availableParents = potentialParents.filter(p =>
        (!unit || p.id !== unit.id) &&
        !descendantIds.has(p.id)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900">
                        {unit ? 'Edit Unit' : 'Create Unit'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form action={(formData) => { setPending(true); formAction(formData); setPending(false); }} className="p-6 space-y-4">
                    {/* Unit Type Toggle (Visible unless adding a child with forced parent) */}
                    {!baseUnitId && (
                        <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
                            <button
                                type="button"
                                onClick={() => setUnitType('base')}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${unitType === 'base' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Base Unit (Root)
                            </button>
                            <button
                                type="button"
                                onClick={() => setUnitType('derived')}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${unitType === 'derived' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Larger Unit (Package)
                            </button>
                        </div>
                    )}

                    {/* Hidden Base Unit ID */}
                    <input type="hidden" name="baseUnitId" value={unitType === 'derived' ? selectedParentId : ''} />

                    {/* Parent Selector (If derived and no fixed baseUnitId) */}
                    {unitType === 'derived' && !baseUnitId && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Base / Parent Unit</label>
                            <select
                                required
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none bg-white transition-all appearance-none"
                                value={selectedParentId}
                                onChange={(e) => setSelectedParentId(e.target.value)}
                            >
                                <option value="" disabled>Select a base unit...</option>
                                {availableParents.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-400">The smaller unit that this package contains.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Unit Name</label>
                            <input
                                name="name"
                                defaultValue={unit?.name || ''}
                                placeholder="e.g. Box, Piece"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-all"
                                required
                            />
                            {state.errors?.name && <p className="text-xs text-red-500">{state.errors.name[0]}</p>}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Short Code</label>
                            <input
                                name="code"
                                defaultValue={unit?.code || ''}
                                placeholder="e.g. BX, KG"
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-all"
                                required
                            />
                            {state.errors?.code && <p className="text-xs text-red-500">{state.errors.code[0]}</p>}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Short Name</label>
                        <input
                            name="shortName"
                            defaultValue={unit?.shortName || ''}
                            placeholder="e.g. pcs, kg"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-all"
                        />
                    </div>

                    <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Unit Type</label>
                            <select name="type" defaultValue={unit?.type || 'COUNT'} className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white">
                                <option value="COUNT">Count (Integer)</option>
                                <option value="WEIGHT">Weight (KG, LB)</option>
                                <option value="VOLUME">Volume (L, M3)</option>
                            </select>
                        </div>

                        <div className="flex flex-col justify-center gap-2">
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                                <input type="checkbox" name="allowFraction" defaultChecked={unit?.allowFraction} className="w-4 h-4 text-emerald-600 rounded" />
                                Allow Fractions
                            </label>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    name="needsBalance"
                                    defaultChecked={unit?.needsBalance}
                                    disabled={isInheritedBalance}
                                    onChange={(e) => setNeedsBalance(e.target.checked)}
                                    className="w-4 h-4 text-emerald-600 rounded disabled:opacity-50"
                                />
                                Connect to Balance
                                {isInheritedBalance && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded ml-1">Inherited</span>}
                            </label>
                            {isInheritedBalance && <input type="hidden" name="needsBalance" value="on" />}
                        </div>
                    </div>

                    {needsBalance && (
                        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                ⚖️ Balance Barcode Configuration
                            </h4>
                            <p className="text-xs text-orange-600">Define the barcode structure printed by your scale.</p>

                            <div className="grid grid-cols-3 gap-2">
                                <div>
                                    <label className="text-[10px] font-bold text-orange-600 uppercase">Item Code Digits</label>
                                    <input
                                        name="balanceItemDigits"
                                        type="number"
                                        defaultValue={unit?.balanceCodeStructure?.split(',')[0] || 6}
                                        className="w-full px-2 py-1.5 rounded border border-orange-200 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-orange-600 uppercase">Weight Int</label>
                                    <input
                                        name="balanceIntDigits"
                                        type="number"
                                        defaultValue={unit?.balanceCodeStructure?.split(',')[1] || 3}
                                        className="w-full px-2 py-1.5 rounded border border-orange-200 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-orange-600 uppercase">Weight Dec</label>
                                    <input
                                        name="balanceDecDigits"
                                        type="number"
                                        defaultValue={unit?.balanceCodeStructure?.split(',')[2] || 3}
                                        className="w-full px-2 py-1.5 rounded border border-orange-200 text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {(unitType === 'derived') && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Conversion Factor</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">1 {unit?.name || 'Unit'} =</span>
                                <input
                                    name="conversionFactor"
                                    type="number"
                                    step="0.001"
                                    defaultValue={unit?.conversionFactor || (baseUnitId ? 1 : '')}
                                    className="w-full pl-24 pr-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                    placeholder="Qty"
                                    required
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-xs">Base Units</span>
                            </div>
                            <p className="text-[10px] text-gray-400">How many base units are in this unit?</p>
                        </div>
                    )}

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={pending} className="flex-1 py-3 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-lg hover:shadow-emerald-600/20 flex items-center justify-center gap-2">
                            {pending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            <span>Save Unit</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
