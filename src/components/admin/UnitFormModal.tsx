'use client';

import { useActionState } from 'react';
import { createUnit, updateUnit, UnitState } from '@/app/actions/inventory';
import { X, Save, Loader2, Ruler, Package, Scale, Layers } from 'lucide-react';
import { useEffect, useState } from 'react';

type UnitFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    unit?: Record<string, any>;
    baseUnitId?: number | null;
    baseUnitName?: string;
    potentialParents?: Record<string, any>[];
};

const initialState: UnitState = { message: '', errors: {} };

export function UnitFormModal({ isOpen, onClose, onSuccess, unit, baseUnitId, baseUnitName, potentialParents = [] }: UnitFormModalProps) {
    const [state, formAction] = useActionState(unit ? updateUnit.bind(null, unit.id) : createUnit, initialState);
    const [pending, setPending] = useState(false);
    const [unitType, setUnitType] = useState<'base' | 'derived'>((baseUnitId || unit?.base_unit) ? 'derived' : 'base');
    const [selectedParentId, setSelectedParentId] = useState<number | string>(baseUnitId || unit?.base_unit || '');
    const [needsBalance, setNeedsBalance] = useState(unit?.needs_balance || false);

    useEffect(() => {
        if (state.message === 'success') { (onSuccess || onClose)(); }
    }, [state, onClose, onSuccess]);

    const parentUnit = potentialParents.find(p => p.id === Number(selectedParentId));
    const isInheritedBalance = parentUnit?.needsBalance || parentUnit?.needs_balance || false;

    useEffect(() => { if (isInheritedBalance) setNeedsBalance(true); }, [isInheritedBalance]);

    useEffect(() => {
        if (isOpen) {
            setUnitType((baseUnitId || unit?.base_unit) ? 'derived' : 'base');
            setSelectedParentId(baseUnitId || unit?.base_unit || '');
            setNeedsBalance(unit?.needs_balance || false);
            setPending(false);
        }
    }, [isOpen, baseUnitId, unit]);

    if (!isOpen) return null;

    // Prevent cycles
    const descendantIds = new Set<number>();
    if (unit && unit.children) {
        const stack = [...unit.children];
        while (stack.length > 0) {
            const node = stack.pop();
            if (node) { descendantIds.add(node.id); if (node.children) stack.push(...node.children); }
        }
    }
    const availableParents = potentialParents.filter(p => (!unit || p.id !== unit.id) && !descendantIds.has(p.id));

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-md mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-info) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-info)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-info) 30%, transparent)' }}>
                            <Ruler size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">{unit ? 'Edit Unit' : baseUnitId ? `Add to "${baseUnitName}"` : 'New Unit'}</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                {unit ? `Editing "${unit.name}"` : 'Create a measurement unit'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <form
                    action={(formData) => { setPending(true); formAction(formData); setPending(false); }}
                    className="flex-1 overflow-y-auto custom-scrollbar"
                >
                    <div className="p-5 space-y-4">

                        {state.message && state.message !== 'success' && (
                            <div className="p-3 rounded-xl text-[12px] font-bold"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)' }}>
                                {state.message}
                            </div>
                        )}

                        {/* Type Toggle */}
                        {!baseUnitId && (
                            <div className="flex p-1 rounded-xl" style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                <button
                                    type="button"
                                    onClick={() => setUnitType('base')}
                                    className="flex-1 py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                    style={{
                                        background: unitType === 'base' ? 'var(--app-surface)' : 'transparent',
                                        color: unitType === 'base' ? 'var(--app-info)' : 'var(--app-muted-foreground)',
                                        boxShadow: unitType === 'base' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    }}
                                >
                                    <Ruler size={12} /> Base Unit
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setUnitType('derived')}
                                    className="flex-1 py-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                    style={{
                                        background: unitType === 'derived' ? 'var(--app-surface)' : 'transparent',
                                        color: unitType === 'derived' ? 'var(--app-accent, #8b5cf6)' : 'var(--app-muted-foreground)',
                                        boxShadow: unitType === 'derived' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    }}
                                >
                                    <Layers size={12} /> Child Unit
                                </button>
                            </div>
                        )}

                        <input type="hidden" name="baseUnitId" value={unitType === 'derived' ? selectedParentId : ''} />

                        {/* Parent selector */}
                        {unitType === 'derived' && !baseUnitId && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Base / Parent Unit</label>
                                <select
                                    required
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium outline-none transition-all appearance-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                    value={selectedParentId}
                                    onChange={(e) => setSelectedParentId(e.target.value)}
                                >
                                    <option value="" disabled>Select a base unit...</option>
                                    {availableParents.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Name + Code */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Unit Name</label>
                                <input
                                    name="name"
                                    defaultValue={unit?.name || ''}
                                    placeholder="e.g. Box, Piece"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                    required
                                />
                                {state.errors?.name && <p className="text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>{state.errors.name[0]}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Code</label>
                                <input
                                    name="code"
                                    defaultValue={unit?.code || ''}
                                    placeholder="e.g. BX, KG"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono font-medium text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                    required
                                />
                                {state.errors?.code && <p className="text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>{state.errors.code[0]}</p>}
                            </div>
                        </div>

                        {/* Short Name */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Short Name</label>
                            <input
                                name="shortName"
                                defaultValue={unit?.short_name || ''}
                                placeholder="e.g. pcs, kg"
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                            />
                        </div>

                        {/* Type + Options */}
                        <div className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Unit Type</label>
                                <select name="type" defaultValue={unit?.type || 'COUNT'}
                                    className="w-full px-3 py-2 rounded-lg text-[12px] font-medium outline-none transition-all appearance-none"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="COUNT">Count (Integer)</option>
                                    <option value="WEIGHT">Weight (KG, LB)</option>
                                    <option value="VOLUME">Volume (L, M3)</option>
                                </select>
                            </div>
                            <div className="flex flex-col justify-center gap-2">
                                <label className="flex items-center gap-2 text-[11px] font-medium text-app-foreground cursor-pointer">
                                    <input type="checkbox" name="allowFraction" defaultChecked={unit?.allow_fraction} className="w-3.5 h-3.5 rounded accent-[var(--app-primary)]" />
                                    Fractions
                                </label>
                                <label className="flex items-center gap-2 text-[11px] font-medium text-app-foreground cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="needsBalance"
                                        defaultChecked={unit?.needs_balance}
                                        disabled={isInheritedBalance}
                                        onChange={(e) => setNeedsBalance(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded accent-[var(--app-warning)] disabled:opacity-50"
                                    />
                                    <Scale size={11} className="text-app-muted-foreground" /> Balance
                                    {isInheritedBalance && <span className="text-[8px] font-bold text-app-muted-foreground px-1 py-0.5 rounded" style={{ background: 'var(--app-border)' }}>Inherited</span>}
                                </label>
                                {isInheritedBalance && <input type="hidden" name="needsBalance" value="on" />}
                            </div>
                        </div>

                        {/* Balance Config */}
                        {needsBalance && (
                            <div className="p-3 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2"
                                style={{ background: 'color-mix(in srgb, var(--app-warning) 6%, var(--app-surface))', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
                                <div className="flex items-center gap-1.5">
                                    <Scale size={11} style={{ color: 'var(--app-warning)' }} />
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>Balance Barcode Config</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { name: 'balanceItemDigits', label: 'Item Digits', idx: 0, def: 6 },
                                        { name: 'balanceIntDigits', label: 'Weight Int', idx: 1, def: 3 },
                                        { name: 'balanceDecDigits', label: 'Weight Dec', idx: 2, def: 3 },
                                    ].map(f => (
                                        <div key={f.name}>
                                            <label className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-warning)' }}>{f.label}</label>
                                            <input
                                                name={f.name}
                                                type="number"
                                                defaultValue={unit?.balance_code_structure?.split(',')[f.idx] || f.def}
                                                className="w-full px-2 py-1.5 rounded-lg text-[12px] font-mono outline-none"
                                                style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)', color: 'var(--app-foreground)' }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Conversion Factor */}
                        {unitType === 'derived' && (
                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Conversion Factor</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-app-muted-foreground font-medium">1 {unit?.name || 'Unit'} =</span>
                                    <input
                                        name="conversionFactor"
                                        type="number"
                                        step="0.001"
                                        defaultValue={unit?.conversion_factor || (baseUnitId ? 1 : '')}
                                        className="w-full pl-24 pr-16 py-2.5 rounded-xl text-[13px] font-medium outline-none transition-all"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                        placeholder="Qty"
                                        required
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-app-muted-foreground font-medium">Base Units</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-5 pt-0 flex gap-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={pending}
                            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {pending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                            <span>Save Unit</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}