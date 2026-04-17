'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Edit2, Trash2, Plus, Package } from 'lucide-react';
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
    needs_balance?: boolean;
};

export function UnitTree({ units, potentialParents = [], forceExpanded, expandKey, onSelect }: {
    units: UnitNode[],
    potentialParents?: Record<string, any>[],
    forceExpanded?: boolean,
    expandKey?: number,
    onSelect?: (unit: UnitNode) => void,
}) {
    return (
        <div className="space-y-2">
            {units.map((unit) => (
                <UnitTreeNode key={unit.id} unit={unit} level={0} potentialParents={potentialParents}
                    forceExpanded={forceExpanded} expandKey={expandKey} onSelect={onSelect} />
            ))}
        </div>
    );
}

function UnitTreeNode({ unit, level, potentialParents, forceExpanded, expandKey, onSelect }: {
    unit: UnitNode; level: number; potentialParents: Record<string, any>[];
    forceExpanded?: boolean; expandKey?: number; onSelect?: (unit: UnitNode) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    // Respond to global expand/collapse
    useEffect(() => {
        if (forceExpanded !== undefined) setIsExpanded(forceExpanded);
    }, [forceExpanded, expandKey]);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isAddChildOpen, setIsAddChildOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UnitNode | null>(null);

    const hasChildren = unit.children && unit.children.length > 0;

    const handleDelete = () => { setDeleteTarget(unit); };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        await deleteUnit(deleteTarget.id);
        toast.success(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
    };

    return (
        <div className="select-none">
            <div
                className="group flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer"
                style={{
                    background: level === 0 ? 'var(--app-surface)' : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                    borderColor: 'var(--app-border)',
                    marginLeft: level > 0 ? '2rem' : 0,
                    marginTop: level > 0 ? '0.375rem' : 0,
                    marginBottom: level === 0 ? '0.375rem' : 0,
                }}
                onClick={() => { if (hasChildren) setIsExpanded(prev => !prev); else onSelect?.(unit); }}
                onDoubleClick={() => onSelect?.(unit)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--app-primary)'; e.currentTarget.style.boxShadow = '0 2px 8px color-mix(in srgb, var(--app-primary) 10%, transparent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`p-1 rounded-lg transition-colors ${!hasChildren && 'invisible'}`}
                        style={{ color: 'var(--app-text-muted)' }}
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{
                        background: level === 0 ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                        color: level === 0 ? 'var(--app-primary)' : 'var(--app-info, #3b82f6)',
                    }}>
                        <Package size={18} strokeWidth={2} />
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-bold" style={{ color: 'var(--app-text)' }}>{unit.name}</h4>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{
                                background: 'color-mix(in srgb, var(--app-text-muted) 8%, transparent)',
                                color: 'var(--app-text-muted)',
                                border: '1px solid color-mix(in srgb, var(--app-text-muted) 12%, transparent)',
                            }}>
                                {unit.code}
                            </span>
                            {unit.needs_balance && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{
                                    background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                                    color: 'var(--app-warning, #f59e0b)',
                                    border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)',
                                }} title="Connected to Scale">
                                    ⚖️ Scale
                                </span>
                            )}
                        </div>
                        <div className="text-[11px] mt-0.5 flex flex-wrap gap-x-3" style={{ color: 'var(--app-text-muted)' }}>
                            <span>
                                {level === 0
                                    ? `Base Unit (${unit.type || 'COUNT'})`
                                    : `1 ${unit.name} = ${unit.conversion_factor} parent units`
                                }
                            </span>
                            {unit.product_count != null && unit.product_count > 0 && (
                                <span className="font-bold" style={{ color: 'var(--app-primary)' }}>
                                    · {unit.product_count} Products
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => setIsEditOpen(true)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--app-text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 8%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Edit"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => setIsAddChildOpen(true)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--app-text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-info, #3b82f6)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Add Child Unit"
                    >
                        <Plus size={14} />
                    </button>
                    {(!hasChildren) && (
                        <button
                            onClick={handleDelete}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--app-text-muted)' }}
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-error, #ef4444)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                            title="Delete"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="ml-5 pl-3" style={{ borderLeft: '2px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                    {unit.children!.map((child) => (
                        <UnitTreeNode key={child.id} unit={child} level={level + 1} potentialParents={potentialParents}
                        forceExpanded={forceExpanded} expandKey={expandKey} onSelect={onSelect} />
                    ))}
                </div>
            )}

            <UnitFormModal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} unit={unit} potentialParents={potentialParents} />
            <UnitFormModal isOpen={isAddChildOpen} onClose={() => setIsAddChildOpen(false)} baseUnitId={unit.id} baseUnitName={unit.name} potentialParents={potentialParents} />

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