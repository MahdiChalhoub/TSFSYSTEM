'use client';

import { useState } from 'react';
import {
    ChevronRight, ChevronDown, Pencil, Trash2, Plus,
    Package, Layers, Scale, AlertCircle, Ruler
} from 'lucide-react';
import { UnitFormModal } from './UnitFormModal';
import { deleteUnit } from '@/app/actions/inventory';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type UnitNode = {
    id: number;
    name: string;
    code: string;
    conversion_factor: number;
    base_unit: number | null;
    children?: UnitNode[];
    product_count?: number;
    type?: string;
    short_name?: string;
    needs_balance?: boolean;
};

export function UnitTree({ units, potentialParents = [], forceExpanded, expandKey = 0 }: { units: UnitNode[], potentialParents?: Record<string, any>[], forceExpanded?: boolean, expandKey?: number }) {
    if (units.length === 0) return null;

    return (
        <div>
            {units.map((unit) => (
                <UnitTreeNode key={`${unit.id}-${expandKey}`} unit={unit} level={0} potentialParents={potentialParents} forceExpanded={forceExpanded} expandKey={expandKey} />
            ))}
        </div>
    );
}

function UnitTreeNode({ unit, level, potentialParents, forceExpanded, expandKey = 0 }: { unit: UnitNode; level: number; potentialParents: Record<string, any>[]; forceExpanded?: boolean; expandKey?: number }) {
    const [isExpanded, setIsExpanded] = useState(forceExpanded !== undefined ? forceExpanded : level < 2);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isAddChildOpen, setIsAddChildOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UnitNode | null>(null);

    const hasChildren = unit.children && unit.children.length > 0;
    const isRoot = level === 0;
    const productCount = unit.product_count || 0;

    const handleDelete = () => {
        if (hasChildren) {
            toast.error("Delete sub-units first.");
            return;
        }
        setDeleteTarget(unit);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        await deleteUnit(deleteTarget.id);
        toast.success(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
    };

    return (
        <div>
            {/* ── ROW ── */}
            <div
                className={`
                    group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-default
                    border-b border-app-border/30
                    ${isRoot
                        ? 'hover:bg-app-surface py-2.5 md:py-3'
                        : 'hover:bg-app-surface/40 py-1.5 md:py-2'
                    }
                `}
                style={{
                    paddingLeft: `${12 + level * 20}px`,
                    paddingRight: '12px',
                    background: isRoot
                        ? 'color-mix(in srgb, var(--app-info) 4%, var(--app-surface))'
                        : undefined,
                    borderLeft: isRoot
                        ? '3px solid var(--app-info)'
                        : level > 0
                            ? '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)'
                            : undefined,
                    marginLeft: level > 0 ? `${12 + (level - 1) * 20 + 10}px` : undefined,
                }}
            >
                {/* Toggle */}
                <button
                    onClick={() => hasChildren && setIsExpanded(!isExpanded)}
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${hasChildren ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}
                >
                    {hasChildren ? (
                        isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-info)' }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isRoot
                            ? 'color-mix(in srgb, var(--app-info) 12%, transparent)'
                            : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                        color: isRoot ? 'var(--app-info)' : 'var(--app-muted-foreground)',
                    }}
                >
                    {isRoot
                        ? <Ruler size={14} strokeWidth={2.5} />
                        : <Package size={13} />}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    <span className={`truncate text-[13px] ${isRoot ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                        {unit.name}
                    </span>
                    {unit.short_name && (
                        <span className="hidden md:inline text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider bg-app-border/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            {unit.short_name}
                        </span>
                    )}
                    {isRoot && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                            Base
                        </span>
                    )}
                    {unit.needs_balance && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 flex items-center gap-0.5"
                            style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)', border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)' }}>
                            <Scale size={8} /> Scale
                        </span>
                    )}
                </div>

                {/* Code */}
                <div className="hidden sm:flex w-16 flex-shrink-0">
                    <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                            background: isRoot
                                ? 'color-mix(in srgb, var(--app-info) 10%, transparent)'
                                : 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                            color: isRoot ? 'var(--app-info)' : 'var(--app-foreground)',
                        }}>
                        {unit.code}
                    </span>
                </div>

                {/* Type */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {unit.type || 'COUNT'}
                    </span>
                </div>

                {/* Ratio */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <span className="text-[10px] font-bold text-app-muted-foreground tabular-nums">
                        {isRoot ? '1:1 (Base)' : `1:${unit.conversion_factor}`}
                    </span>
                </div>

                {/* Products */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    <span className="text-[10px] font-bold flex items-center gap-1"
                        style={{ color: productCount > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)', opacity: productCount > 0 ? 1 : 0.5 }}>
                        <Package size={10} />
                        {productCount}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setIsEditOpen(true)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                        <Pencil size={12} />
                    </button>
                    <button onClick={() => setIsAddChildOpen(true)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors" title="Add derived unit">
                        <Plus size={13} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                        style={{ color: hasChildren ? 'var(--app-border)' : 'var(--app-muted-foreground)', cursor: hasChildren ? 'not-allowed' : 'pointer' }}
                        title={hasChildren ? 'Delete sub-units first' : 'Delete'}
                    >
                        {hasChildren ? <AlertCircle size={12} /> : <Trash2 size={12} />}
                    </button>
                </div>
            </div>

            {/* ── CHILDREN ── */}
            {isExpanded && hasChildren && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {unit.children!.map((child) => (
                        <UnitTreeNode key={`${child.id}-${expandKey}`} unit={child} level={level + 1} potentialParents={potentialParents} forceExpanded={forceExpanded} expandKey={expandKey} />
                    ))}
                </div>
            )}

            {/* Modals */}
            <UnitFormModal
                isOpen={isEditOpen}
                onClose={() => setIsEditOpen(false)}
                unit={unit}
                potentialParents={potentialParents}
            />
            <UnitFormModal
                isOpen={isAddChildOpen}
                onClose={() => setIsAddChildOpen(false)}
                baseUnitId={unit.id}
                baseUnitName={unit.name}
                potentialParents={potentialParents}
            />

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={confirmDelete}
                title={`Delete "${deleteTarget?.name}"?`}
                description="This will permanently remove this unit. Products using it may be affected."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
}