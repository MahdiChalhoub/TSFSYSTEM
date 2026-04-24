'use client';

import { useActionState } from 'react';
import { createUnit, updateUnit, UnitState } from '@/app/actions/inventory';
import { X, Save, Loader2, Ruler, Scale, Package, Milestone, Clock, Grid2X2, Hash, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

type UnitFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    unit?: Record<string, any>;
    baseUnitId?: number | null;
    baseUnitName?: string;
    potentialParents?: Record<string, any>[];
};

const initialState: UnitState = { message: '', errors: {} };

// Type taxonomy — mirror of UNIT_TYPE_CHOICES in the backend. Extensible:
// new types can be appended here without a migration (model keeps CharField).
const UNIT_TYPES = [
    { id: 'COUNT', label: 'Count', hint: 'Integer quantities — pieces, units, items', icon: Hash, color: 'var(--app-primary)' },
    { id: 'WEIGHT', label: 'Weight', hint: 'Grams, kg, lb — needs scale', icon: Scale, color: 'var(--app-warning, #f59e0b)' },
    { id: 'VOLUME', label: 'Volume', hint: 'Litre, ml, gallon — liquids', icon: Milestone, color: 'var(--app-info, #3b82f6)' },
    { id: 'LENGTH', label: 'Length', hint: 'Metres, cm, inches — distance/dimension', icon: Ruler, color: '#8b5cf6' },
    { id: 'AREA', label: 'Area', hint: 'm², ft² — surface measurement', icon: Grid2X2, color: '#ec4899' },
    { id: 'TIME', label: 'Time', hint: 'Hours, minutes — labor/service billing', icon: Clock, color: '#14b8a6' },
] as const;

export function UnitFormModal({ isOpen, onClose, unit, baseUnitId, baseUnitName, potentialParents = [] }: UnitFormModalProps) {
    const [state, formAction] = useActionState(unit ? updateUnit.bind(null, unit.id) : createUnit, initialState);
    const [pending, setPending] = useState(false);

    const [unitType, setUnitType] = useState<'base' | 'derived'>((baseUnitId || unit?.base_unit) ? 'derived' : 'base');
    const [selectedParentId, setSelectedParentId] = useState<number | string>(baseUnitId || unit?.base_unit || '');
    const [needsBalance, setNeedsBalance] = useState(unit?.needs_balance || false);
    const [selectedType, setSelectedType] = useState<string>(unit?.type || 'COUNT');
    const [allowFraction, setAllowFraction] = useState<boolean>(unit?.allow_fraction ?? true);

    useEffect(() => {
        if (state.message === 'success') onClose();
    }, [state, onClose]);

    const parentUnit = potentialParents.find(p => p.id === Number(selectedParentId));
    const isInheritedBalance = parentUnit?.needsBalance || false;

    useEffect(() => {
        if (isInheritedBalance) setNeedsBalance(true);
    }, [isInheritedBalance]);

    useEffect(() => {
        if (isOpen) {
            setUnitType((baseUnitId || unit?.base_unit) ? 'derived' : 'base');
            setSelectedParentId(baseUnitId || unit?.base_unit || '');
            setNeedsBalance(unit?.needs_balance || false);
            setSelectedType(unit?.type || 'COUNT');
            setAllowFraction(unit?.allow_fraction ?? true);
        }
    }, [isOpen, baseUnitId, unit]);

    // When type changes, suggest sensible defaults for allowFraction
    useEffect(() => {
        if (selectedType === 'COUNT') setAllowFraction(false);
        else if (['WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'TIME'].includes(selectedType)) setAllowFraction(true);
    }, [selectedType]);

    if (!isOpen) return null;

    // Safety: cycle prevention
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
    const availableParents = potentialParents.filter(p => (!unit || p.id !== unit.id) && !descendantIds.has(p.id));

    const inputCls = "w-full px-3 py-2 rounded-xl text-tp-md font-bold outline-none transition-all focus:ring-2";
    const inputStyle = {
        background: 'var(--app-background)',
        border: '1px solid var(--app-border)',
        color: 'var(--app-foreground)',
    };
    const labelCls = "block text-tp-xxs font-bold uppercase tracking-widest mb-1.5";
    const labelStyle = { color: 'var(--app-muted-foreground)' };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

                {/* Header */}
                <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                    style={{
                        borderBottom: '1px solid var(--app-border)',
                        background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                    }}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 15%, transparent)',
                                color: 'var(--app-primary)',
                            }}>
                            <Ruler size={14} />
                        </div>
                        <div>
                            <h3 className="text-tp-md font-bold" style={{ color: 'var(--app-foreground)' }}>
                                {unit ? 'Edit Unit' : 'Create Unit'}
                            </h3>
                            <p className="text-tp-xs font-semibold" style={{ color: 'var(--app-muted-foreground)' }}>
                                {baseUnitName ? `Adds under "${baseUnitName}"` : 'Define a unit of measurement'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} type="button"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={15} />
                    </button>
                </div>

                <form action={(formData) => { setPending(true); formAction(formData); setPending(false); }}
                    className="flex-1 overflow-y-auto px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">

                    {/* ── UNIT TYPE — full width ── */}
                    <div className="md:col-span-2">
                        <label className={labelCls} style={labelStyle}>Unit Type</label>
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
                            {UNIT_TYPES.map(t => {
                                const Icon = t.icon;
                                const active = selectedType === t.id;
                                return (
                                    <button key={t.id} type="button"
                                        onClick={() => setSelectedType(t.id)}
                                        title={t.hint}
                                        className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl transition-all"
                                        style={active ? {
                                            background: `color-mix(in srgb, ${t.color} 12%, transparent)`,
                                            border: `1.5px solid ${t.color}`,
                                            color: t.color,
                                        } : {
                                            background: 'var(--app-background)',
                                            border: '1px solid var(--app-border)',
                                            color: 'var(--app-muted-foreground)',
                                        }}>
                                        <Icon size={14} />
                                        <span className="text-tp-xs font-bold uppercase tracking-wider">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Hidden input — posts the selected type */}
                        <input type="hidden" name="type" value={selectedType} />
                        <p className="text-tp-xs mt-1.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            {UNIT_TYPES.find(t => t.id === selectedType)?.hint || 'Category of measurement'}
                        </p>
                    </div>

                    {/* ── LEFT COLUMN: Identity + naming ──
                     * Hierarchy/parent/conversion/options live in the right column. */}
                    <div className="space-y-4">

                    {/* ── ROOT / DERIVED TOGGLE ── */}
                    {!baseUnitId && (
                        <div>
                            <label className={labelCls} style={labelStyle}>Hierarchy</label>
                            <div className="flex p-1 rounded-xl gap-0.5"
                                style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                                <button type="button" onClick={() => setUnitType('base')}
                                    className="flex-1 py-1.5 text-tp-xs font-bold uppercase tracking-widest rounded-lg transition-all"
                                    style={unitType === 'base' ? {
                                        background: 'var(--app-surface)', color: 'var(--app-primary)',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                    } : { color: 'var(--app-muted-foreground)' }}>
                                    Base (Root)
                                </button>
                                <button type="button" onClick={() => setUnitType('derived')}
                                    className="flex-1 py-1.5 text-tp-xs font-bold uppercase tracking-widest rounded-lg transition-all"
                                    style={unitType === 'derived' ? {
                                        background: 'var(--app-surface)', color: 'var(--app-primary)',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                    } : { color: 'var(--app-muted-foreground)' }}>
                                    Derived (Larger)
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Hidden base-unit id */}
                    <input type="hidden" name="baseUnitId" value={unitType === 'derived' ? selectedParentId : ''} />

                    {/* ── PARENT SELECTOR ── */}
                    {unitType === 'derived' && !baseUnitId && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className={labelCls} style={labelStyle}>Base / Parent Unit</label>
                            <select required value={selectedParentId}
                                onChange={(e) => setSelectedParentId(e.target.value)}
                                className={inputCls + " appearance-none cursor-pointer"}
                                style={inputStyle}>
                                <option value="" disabled>Select a base unit…</option>
                                {availableParents.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* ── NAME + CODE ── */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls} style={labelStyle}>Name *</label>
                            <input name="name" defaultValue={unit?.name || ''} placeholder="e.g. Box"
                                required className={inputCls} style={inputStyle} />
                            {state.errors?.name && (
                                <p className="text-tp-xs mt-1 font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                    {state.errors.name[0]}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className={labelCls} style={labelStyle}>Short Code *</label>
                            <input name="code" defaultValue={unit?.code || ''} placeholder="e.g. BX"
                                required className={inputCls + " font-mono uppercase"} style={inputStyle} />
                            {state.errors?.code && (
                                <p className="text-tp-xs mt-1 font-bold" style={{ color: 'var(--app-error, #ef4444)' }}>
                                    {state.errors.code[0]}
                                </p>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className={labelCls} style={labelStyle}>Short Name</label>
                        <input name="shortName" defaultValue={unit?.short_name || ''} placeholder="e.g. pcs, kg"
                            className={inputCls} style={inputStyle} />
                    </div>

                    </div>{/* /LEFT COLUMN */}

                    {/* ── RIGHT COLUMN: behaviour ── */}
                    <div className="space-y-4">

                    {/* ── OPTIONS ── */}
                    <div className="p-3 rounded-xl space-y-2"
                        style={{
                            background: 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                            border: '1px solid var(--app-border)',
                        }}>
                        <label className="flex items-center gap-2 text-tp-sm font-bold cursor-pointer"
                            style={{ color: 'var(--app-foreground)' }}>
                            <input type="checkbox" name="allowFraction"
                                checked={allowFraction}
                                onChange={(e) => setAllowFraction(e.target.checked)}
                                className="w-4 h-4 rounded cursor-pointer"
                                style={{ accentColor: 'var(--app-primary)' }} />
                            Allow fractional quantities
                            <span className="text-tp-xxs font-bold uppercase tracking-widest ml-auto"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                {selectedType === 'COUNT' ? 'Usually off' : 'Usually on'}
                            </span>
                        </label>
                        <label className="flex items-center gap-2 text-tp-sm font-bold cursor-pointer"
                            style={{ color: 'var(--app-foreground)' }}>
                            <input type="checkbox" name="needsBalance"
                                defaultChecked={unit?.needs_balance}
                                disabled={isInheritedBalance}
                                onChange={(e) => setNeedsBalance(e.target.checked)}
                                className="w-4 h-4 rounded cursor-pointer disabled:opacity-50"
                                style={{ accentColor: 'var(--app-warning, #f59e0b)' }} />
                            Connect to scale (balance barcode)
                            {isInheritedBalance && (
                                <span className="ml-auto text-tp-xxs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
                                    style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)' }}>
                                    Inherited
                                </span>
                            )}
                        </label>
                        {isInheritedBalance && <input type="hidden" name="needsBalance" value="on" />}
                    </div>

                    {/* ── BALANCE CONFIG — pointer only ──
                     * The digit structure (prefix / item / int / dec) lives in the
                     * tenant-wide Variable Barcode Config to avoid two sources of
                     * truth. This unit only needs to flag that it dispatches via
                     * the scale barcode path; the actual format comes from there.
                     */}
                    {needsBalance && (
                        <div className="p-3 rounded-xl space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200"
                            style={{
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)',
                            }}>
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={12} style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                <span className="text-tp-xs font-bold uppercase tracking-widest"
                                    style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                    Scale dispatch enabled
                                </span>
                            </div>
                            <p className="text-tp-xs" style={{ color: 'var(--app-muted-foreground)' }}>
                                This unit's barcodes follow the tenant's <strong style={{ color: 'var(--app-foreground)' }}>Variable Barcode Config</strong>. Edit the digit structure there — one source of truth for every weighed, priced, or counted item.
                            </p>
                            {/* Preserve any legacy per-unit structure so re-save keeps the old values.
                             * When the row has no previous structure, the inventory action's
                             * built-in defaults (6/3/3) apply — matching Variable Barcode Config
                             * defaults closely enough until a migration consolidates everything. */}
                            {(() => {
                                const parts = unit?.balance_code_structure?.split(',') ?? []
                                return (
                                    <>
                                        {parts[0] && <input type="hidden" name="balanceItemDigits" value={parts[0]} />}
                                        {parts[1] && <input type="hidden" name="balanceIntDigits" value={parts[1]} />}
                                        {parts[2] && <input type="hidden" name="balanceDecDigits" value={parts[2]} />}
                                    </>
                                )
                            })()}
                        </div>
                    )}

                    {/* ── CONVERSION FACTOR ── */}
                    {unitType === 'derived' && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className={labelCls} style={labelStyle}>Conversion Factor</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tp-xs font-bold font-mono"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    1 =
                                </span>
                                <input name="conversionFactor" type="number" step="0.001"
                                    defaultValue={unit?.conversion_factor || (baseUnitId ? 1 : '')}
                                    required placeholder="Qty"
                                    className={inputCls + " pl-14 pr-20 font-mono text-center"} style={inputStyle} />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tp-xxs font-bold uppercase tracking-widest"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    base units
                                </span>
                            </div>
                            <p className="text-tp-xs mt-1.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                How many base units are in this unit?
                            </p>
                        </div>
                    )}

                    </div>{/* /RIGHT COLUMN */}
                </form>

                {/* Footer */}
                <div className="flex-shrink-0 px-5 py-3 flex items-center justify-end gap-2"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                    <button type="button" onClick={onClose}
                        className="px-4 py-2 rounded-lg text-tp-xs font-bold uppercase tracking-widest transition-all"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        Cancel
                    </button>
                    <button type="submit" disabled={pending}
                        onClick={(e) => {
                            // Submit the form manually — button lives outside <form> for sticky-footer reliability
                            const form = (e.currentTarget.closest('.w-full') as HTMLElement)?.querySelector('form');
                            form?.requestSubmit();
                        }}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-tp-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: 'var(--app-primary)',
                            color: 'white',
                            boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                        }}>
                        {pending ? <><Loader2 className="animate-spin" size={13} /> Saving…</> : <><Save size={13} /> Save Unit</>}
                    </button>
                </div>
            </div>
        </div>
    );
}
