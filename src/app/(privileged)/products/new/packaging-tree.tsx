'use client';

import { Plus, Trash2, Lock, Package, ChevronRight } from 'lucide-react';

interface PackagingLevel {
    id: string;
    unitId: string;
    ratio: number;
    barcode: string;
    price: number;
}

interface PackagingTreeProps {
    levels: PackagingLevel[];
    onChange: (levels: PackagingLevel[]) => void;
    units: Record<string, any>[];
    currency?: string;
}

export default function PackagingTree({ levels, onChange, units, currency = '$' }: PackagingTreeProps) {
    const addLevel = () => {
        onChange([...levels, { id: crypto.randomUUID(), unitId: '', ratio: 0, barcode: '', price: 0 }]);
    };

    const removeLevel = (id: string) => {
        onChange(levels.filter(l => l.id !== id));
    };

    const updateLevel = (idx: number, field: keyof PackagingLevel, value: any) => {
        const arr = [...levels];
        (arr[idx] as any)[field] = value;
        onChange(arr);
    };

    // Calculate total units at each level
    const getTotalUnits = (idx: number) => {
        let total = 1;
        for (let i = 0; i <= idx; i++) {
            if (levels[i].ratio > 0) total *= levels[i].ratio;
        }
        return total;
    };

    const getUnitName = (unitId: string) => {
        const unit = units.find(u => String(u.id) === unitId);
        return unit?.name || unit?.shortName || '—';
    };

    return (
        <div className="space-y-3">
            {/* Base Level (always present) */}
            <div className="flex items-center gap-3 p-3 bg-app-background rounded-xl border border-app-border">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                    <Lock className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-app-foreground">Piece (Base Unit)</div>
                    <div className="text-[10px] text-app-muted-foreground">Core barcode · Base price · 1×</div>
                </div>
                <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0">Base</span>
            </div>

            {/* Dynamic Levels */}
            {levels.map((lvl, idx) => (
                <div key={lvl.id} className="relative">
                    {/* Connector line */}
                    <div className="absolute left-[18px] -top-3 w-px h-3 bg-app-border" />

                    <div className="p-3 bg-app-surface rounded-xl border border-app-border space-y-3 group hover:border-app-primary/30 transition-all">
                        {/* Level header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 text-purple-600 flex items-center justify-center text-[10px] font-black border border-purple-200">
                                    {idx + 2}
                                </div>
                                <span className="text-[12px] font-bold text-app-foreground">
                                    {lvl.unitId ? getUnitName(lvl.unitId) : `Level ${idx + 2}`}
                                </span>
                                {lvl.ratio > 0 && (
                                    <span className="text-[10px] text-app-muted-foreground font-medium flex items-center gap-1">
                                        <ChevronRight className="w-3 h-3" />
                                        {getTotalUnits(idx)} pieces total
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => removeLevel(lvl.id)}
                                className="p-1 text-app-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Fields grid */}
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Unit Type</label>
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
                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Contains (qty)</label>
                                <input
                                    type="number"
                                    className="w-full bg-app-background border border-app-border rounded-lg px-2.5 py-2 text-[11px] outline-none font-bold text-app-foreground"
                                    placeholder="e.g. 12"
                                    value={lvl.ratio || ''}
                                    onChange={e => updateLevel(idx, 'ratio', parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Barcode</label>
                                <input
                                    type="text"
                                    className="w-full bg-app-background border border-app-border rounded-lg px-2.5 py-2 text-[11px] outline-none font-mono text-app-foreground placeholder:text-app-muted-foreground"
                                    placeholder="Scan..."
                                    value={lvl.barcode}
                                    onChange={e => updateLevel(idx, 'barcode', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Sell Price</label>
                                <div className="relative">
                                    <span className="absolute left-2.5 top-[8px] text-app-primary text-[10px] font-bold">{currency}</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-app-primary/5 border border-app-primary/30 rounded-lg pl-6 pr-2.5 py-2 text-[11px] outline-none font-bold text-app-primary placeholder:text-app-primary/40"
                                        placeholder="Override"
                                        value={lvl.price || ''}
                                        onChange={e => updateLevel(idx, 'price', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

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
                <div className="p-3 bg-gradient-to-r from-purple-500/5 to-fuchsia-500/5 border border-purple-200/30 rounded-xl">
                    <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-2">Packaging Preview</p>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] font-semibold text-app-foreground">
                        {levels.filter(l => l.ratio > 0 && l.unitId).map((l, i) => (
                            <span key={l.id} className="flex items-center gap-1.5">
                                {i > 0 && <span className="text-app-muted-foreground">→</span>}
                                <Package className="w-3 h-3 text-purple-500" />
                                {getUnitName(l.unitId)} ({l.ratio}×)
                            </span>
                        ))}
                        <span className="text-app-muted-foreground">→</span>
                        <span className="flex items-center gap-1.5">
                            <Package className="w-3 h-3 text-blue-500" />
                            Piece
                        </span>
                    </div>
                </div>
            )}

            {/* Hidden field for form submission */}
            <input type="hidden" name="packagingLevels" value={JSON.stringify(levels)} />
        </div>
    );
}
