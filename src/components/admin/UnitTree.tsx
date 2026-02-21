'use client';

import { useState } from 'react';
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

export function UnitTree({ units, potentialParents = [] }: { units: UnitNode[], potentialParents?: Record<string, any>[] }) {
    return (
        <div className="space-y-4">
            {units.map((unit) => (
                <UnitTreeNode key={unit.id} unit={unit} level={0} potentialParents={potentialParents} />
            ))}
        </div>
    );
}

function UnitTreeNode({ unit, level, potentialParents }: { unit: UnitNode; level: number; potentialParents: Record<string, any>[] }) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isAddChildOpen, setIsAddChildOpen] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<UnitNode | null>(null);

    const hasChildren = unit.children && unit.children.length > 0;

    const handleDelete = () => {
        setDeleteTarget(unit);
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        await deleteUnit(deleteTarget.id);
        toast.success(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
    };

    return (
        <div className="select-none">
            <div
                className={`
                    group flex items-center justify-between p-4 rounded-xl border transition-all duration-200
                    ${level === 0 ? 'bg-white border-gray-100 shadow-sm mb-2' : 'bg-gray-50/50 border-gray-100/50 ml-8 mt-2'}
                    hover:border-emerald-200 hover:shadow-md
                `}
            >
                <div className="flex items-center gap-4">
                    {/* Expand Toggle */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors ${!hasChildren && 'invisible'}`}
                    >
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    {/* Icon */}
                    <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center
                        ${level === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-50 text-blue-500'}
                    `}>
                        <Package size={20} strokeWidth={2} />
                    </div>

                    {/* Info */}
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900">{unit.name}</h4>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-gray-100 text-gray-500 tracking-wide border border-gray-200">
                                {unit.code}
                            </span>
                            {unit.needs_balance && (
                                <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded border border-orange-200" title="Connected to Scale">
                                    ΓÜû∩╕Å Scale
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                            <span>
                                {level === 0
                                    ? `Base Unit (${unit.type || 'COUNT'})`
                                    : `1 ${unit.name} = ${unit.conversion_factor} parent units`
                                }
                            </span>
                            {unit.product_count != null && unit.product_count > 0 && (
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                    · {unit.product_count} Products
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => setIsEditOpen(true)}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => setIsAddChildOpen(true)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Add Child Unit"
                    >
                        <Plus size={16} />
                    </button>
                    {(!hasChildren) && (
                        <button
                            onClick={handleDelete}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Children Recursive Render */}
            {isExpanded && hasChildren && (
                <div className="border-l-2 border-gray-100 ml-6 pl-2">
                    {unit.children!.map((child) => (
                        <UnitTreeNode key={child.id} unit={child} level={level + 1} potentialParents={potentialParents} />
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
                onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null) }}
                onConfirm={confirmDelete}
                title={`Delete "${deleteTarget?.name}"?`}
                description="This will permanently remove this unit. Products using it may be affected."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
}