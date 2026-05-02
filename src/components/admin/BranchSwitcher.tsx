'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, Check, GitBranch, Warehouse, Building2, ChevronRight, Globe } from 'lucide-react';
import { getAllWarehouseContextItems } from '@/app/actions/inventory/warehouses';
import { useBranchScope } from '@/context/BranchContext';

export function BranchLocationSwitcher() {
    const [all, setAll] = useState<Record<string, any>[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    // Reads from BranchContext (which reads localStorage on mount + writes
    // to cookie + triggers router.refresh on change). The dropdown is now
    // a thin VIEW over the shared scope state — every page that uses
    // useBranchScope sees the same selection.
    const { branchId: selectedBranchId, locationId: selectedLocationId, setSelection } = useBranchScope();

    useEffect(() => {
        getAllWarehouseContextItems().then(data => {
            setAll(data);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const branches = all.filter(w => w.location_type === 'BRANCH');

    // Locations that belong to selected branch, or all non-branch items if no branch selected
    const locations = selectedBranchId
        ? all.filter(w => w.location_type !== 'BRANCH' && w.parent === selectedBranchId)
        : all.filter(w => w.location_type !== 'BRANCH');

    const selectedBranch = branches.find(b => b.id === selectedBranchId) ?? null;
    const selectedLocation = locations.find(l => l.id === selectedLocationId) ?? null;

    const handleSelectBranch = (id: number | null) => {
        // Clear location when branch changes (location only makes sense
        // inside a chosen branch). Setting null on both = "All Branches".
        setSelection(id, null);
    };

    const handleSelectLocation = (id: number | null) => {
        setSelection(selectedBranchId, id);
        setIsOpen(false);
    };

    /** "All Branches" — the explicit top-level scope. Clears both. */
    const handleSelectAllBranches = () => {
        setSelection(null, null);
        setIsOpen(false);
    };

    // Don't render if nothing to show and not loading
    if (!loading && branches.length === 0 && locations.length === 0) return null;

    // Trigger label — use "All Branches" when nothing is scoped so the
    // user can see at a glance whether they're filtering or not.
    const triggerLabel = selectedBranch
        ? (selectedLocation ? `${selectedBranch.name} · ${selectedLocation.name}` : selectedBranch.name)
        : 'All Branches';

    return (
        <div className="relative flex-shrink-0">

            {/* ── Trigger ── */}
            <button
                onClick={() => setIsOpen(v => !v)}
                suppressHydrationWarning
                className="flex items-center gap-1.5 h-8 px-2 rounded-lg transition-all duration-150"
                style={{
                    background: isOpen ? 'var(--app-surface)' : 'transparent',
                    border: `1px solid ${isOpen ? 'var(--app-border)' : 'transparent'}`,
                }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface)'; el.style.borderColor = 'var(--app-border)'; }}
                onMouseLeave={(e) => { if (!isOpen) { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.borderColor = 'transparent'; } }}
            >
                {/* Icon */}
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                        background: selectedBranch ? 'var(--app-primary-light)' : 'var(--app-surface-2)',
                        color: selectedBranch ? 'var(--app-primary)' : 'var(--app-text-faint)',
                        border: '1px solid var(--app-border)',
                    }}>
                    <GitBranch size={11} />
                </div>

                {/* Label — branch [> location] */}
                <span className="hidden sm:flex items-center gap-1 text-[13px] font-semibold leading-none"
                    style={{ color: 'var(--app-text)' }}>
                    <span className="truncate max-w-[90px]">{triggerLabel}</span>
                    {selectedLocation && (
                        <>
                            <ChevronRight size={9} className="opacity-30 flex-shrink-0" />
                            <span className="truncate max-w-[80px]" style={{ color: 'var(--app-primary)' }}>
                                {selectedLocation.name}
                            </span>
                        </>
                    )}
                </span>

                <ChevronDown size={12} className="flex-shrink-0 opacity-40 transition-transform duration-200"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', color: 'var(--app-text)' }} />
            </button>

            {/* ── Dropdown ── */}
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 z-50 overflow-hidden rounded-xl animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                            minWidth: '260px',
                        }}>

                        {/* ── BRANCH SECTION ── */}
                        {branches.length > 0 && (
                            <>
                                <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                                    <GitBranch size={10} style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-faint)' }}>
                                        Branch
                                    </span>
                                    <span className="text-[8px] font-bold px-1 rounded ml-auto"
                                        style={{ background: 'var(--app-surface-2)', color: 'var(--app-text-faint)' }}>
                                        {branches.length}
                                    </span>
                                </div>
                                <div className="px-1.5 pb-1.5">
                                    {/* "All Branches" — the explicit unscoped state. Click to clear
                                        both branch and location filters and work across everything. */}
                                    <button
                                        onClick={handleSelectAllBranches}
                                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors duration-100"
                                        style={{
                                            background: selectedBranchId === null ? 'var(--app-primary-light)' : 'transparent',
                                            borderLeft: selectedBranchId === null ? '2px solid var(--app-primary)' : '2px solid transparent',
                                        }}
                                        onMouseEnter={(e) => { if (selectedBranchId !== null) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                        onMouseLeave={(e) => { if (selectedBranchId !== null) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                                        <Globe size={12} className="flex-shrink-0"
                                            style={{ color: selectedBranchId === null ? 'var(--app-primary)' : 'var(--app-text-faint)' }} />
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-xs font-semibold truncate"
                                                style={{ color: selectedBranchId === null ? 'var(--app-primary)' : 'var(--app-text)' }}>
                                                All Branches
                                            </p>
                                            <p className="text-[9px] truncate mt-0.5" style={{ color: 'var(--app-text-faint)' }}>
                                                No filter — see data from every branch
                                            </p>
                                        </div>
                                        {selectedBranchId === null && <Check size={13} className="flex-shrink-0" style={{ color: 'var(--app-primary)' }} />}
                                    </button>
                                    {branches.map(branch => {
                                        const isActive = branch.id === selectedBranchId;
                                        return (
                                            <button key={branch.id}
                                                onClick={() => handleSelectBranch(branch.id)}
                                                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors duration-100"
                                                style={{
                                                    background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                                    borderLeft: isActive ? '2px solid var(--app-primary)' : '2px solid transparent',
                                                }}
                                                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                    style={{ background: branch.is_active !== false ? 'var(--app-success)' : 'var(--app-text-faint)' }} />
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="text-xs font-semibold truncate"
                                                        style={{ color: isActive ? 'var(--app-primary)' : 'var(--app-text)' }}>
                                                        {branch.name}
                                                    </p>
                                                    {branch.code && (
                                                        <p className="text-[9px] font-mono truncate mt-0.5" style={{ color: 'var(--app-text-faint)' }}>
                                                            {branch.code}
                                                        </p>
                                                    )}
                                                </div>
                                                {isActive && <Check size={13} className="flex-shrink-0" style={{ color: 'var(--app-primary)' }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* ── LOCATION SECTION — only shown when a branch is selected and has children ── */}
                        {selectedBranchId && locations.length > 0 && (
                            <div style={{ borderTop: '1px solid var(--app-border)' }}>
                                <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                                    <Warehouse size={10} style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-faint)' }}>
                                        Location
                                    </span>
                                    <span className="text-[8px] font-bold px-1 rounded ml-auto"
                                        style={{ background: 'var(--app-surface-2)', color: 'var(--app-text-faint)' }}>
                                        {locations.length}
                                    </span>
                                </div>
                                <div className="px-1.5 pb-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                                    {/* "All locations in branch" option */}
                                    <button
                                        onClick={() => handleSelectLocation(null)}
                                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors duration-100"
                                        style={{
                                            background: selectedLocationId === null ? 'var(--app-primary-light)' : 'transparent',
                                            borderLeft: selectedLocationId === null ? '2px solid var(--app-primary)' : '2px solid transparent',
                                        }}
                                        onMouseEnter={(e) => { if (selectedLocationId !== null) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                        onMouseLeave={(e) => { if (selectedLocationId !== null) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                                        <Building2 size={12} className="flex-shrink-0"
                                            style={{ color: selectedLocationId === null ? 'var(--app-primary)' : 'var(--app-text-faint)' }} />
                                        <span className="flex-1 text-xs font-medium text-left truncate"
                                            style={{ color: selectedLocationId === null ? 'var(--app-primary)' : 'var(--app-text-muted)' }}>
                                            All in branch
                                        </span>
                                        {selectedLocationId === null && <Check size={13} className="flex-shrink-0" style={{ color: 'var(--app-primary)' }} />}
                                    </button>

                                    {locations.map(loc => {
                                        const isActive = loc.id === selectedLocationId;
                                        return (
                                            <button key={loc.id}
                                                onClick={() => handleSelectLocation(loc.id)}
                                                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors duration-100"
                                                style={{
                                                    background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                                    borderLeft: isActive ? '2px solid var(--app-primary)' : '2px solid transparent',
                                                }}
                                                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                                onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                    style={{ background: loc.is_active !== false ? 'var(--app-success)' : 'var(--app-text-faint)' }} />
                                                <div className="flex-1 min-w-0 text-left">
                                                    <p className="text-xs font-semibold truncate"
                                                        style={{ color: isActive ? 'var(--app-primary)' : 'var(--app-text)' }}>
                                                        {loc.name}
                                                    </p>
                                                    {loc.code && (
                                                        <p className="text-[9px] font-mono truncate mt-0.5" style={{ color: 'var(--app-text-faint)' }}>
                                                            {loc.code}
                                                        </p>
                                                    )}
                                                </div>
                                                {isActive && <Check size={13} className="flex-shrink-0" style={{ color: 'var(--app-primary)' }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Empty state */}
                        {!loading && branches.length === 0 && (
                            <div className="px-4 py-6 text-center">
                                <p className="text-xs" style={{ color: 'var(--app-text-faint)' }}>No branches configured</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
