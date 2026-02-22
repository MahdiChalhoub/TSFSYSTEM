'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Edit2, Trash2, Plus, Package, Layers } from 'lucide-react';
import { UnitFormModal } from './UnitFormModal';
import { deleteUnit } from '@/app/actions/inventory';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import clsx from 'clsx';

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
    if (units.length === 0) {
        return (
            <div className="py-20 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-inner">
                    <Package size={32} className="text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-400">No units defined yet</h3>
                <p className="text-gray-400 mt-1 max-w-xs mx-auto">Create a base unit like 'Piece' or 'KG' to get started.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {units.map((unit, idx) => (
                <div key={unit.id} className="animate-in slide-in-from-bottom-4 fade-in duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                    <UnitTreeNode unit={unit} level={0} potentialParents={potentialParents} />
                </div>
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
        <div className="select-none mb-1">
            <div
                className={clsx(
                    "group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden",
                    level === 0
                        ? "bg-white/80 backdrop-blur-md border-gray-100 shadow-sm hover:shadow-xl hover:border-emerald-200"
                        : "bg-gray-50/40 border-gray-100/50 ml-10 mt-2 hover:bg-white hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5",
                    "hover:-translate-y-0.5"
                )}
            >
                {/* Visual Connector lines for nested items */}
                {level > 0 && (
                    <div className="absolute left-[-2.5rem] top-1/2 w-10 h-px bg-gradient-to-r from-gray-200 to-transparent pointer-events-none" />
                )}

                <div className="flex items-center gap-4 relative z-10">
                    {/* Expand Toggle */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={clsx(
                            "p-1.5 rounded-xl transition-all duration-300",
                            isExpanded ? "bg-emerald-50 text-emerald-600 rotate-0" : "bg-gray-50 text-gray-400 -rotate-90",
                            !hasChildren && 'invisible opacity-0'
                        )}
                    >
                        <ChevronDown size={18} />
                    </button>

                    {/* Icon with Gradient Glow */}
                    <div className={clsx(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300",
                        level === 0
                            ? "bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/50"
                            : "bg-blue-50 text-blue-500 ring-4 ring-blue-50/50"
                    )}>
                        {level === 0 ? <Layers size={22} strokeWidth={2.5} /> : <Package size={20} strokeWidth={2} />}
                    </div>

                    {/* Info */}
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-gray-900 text-lg tracking-tight">{unit.name}</h4>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-100/80 text-gray-500 border border-gray-200 shadow-sm">
                                {unit.code}
                            </span>
                            {level === 0 && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 animate-pulse">
                                    Base
                                </span>
                            )}
                            {unit.needs_balance && (
                                <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg border border-amber-100 font-bold flex items-center gap-1 shadow-sm">
                                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
                                    Scale
                                </span>
                            )}
                        </div>
                        <div className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                            <span className="font-medium">
                                {level === 0
                                    ? `Registry: ${unit.type || 'Standard'}`
                                    : `Ratio: 1:${unit.conversion_factor}`
                                }
                            </span>
                            {unit.product_count != null && unit.product_count > 0 && (
                                <div className="h-1 w-1 bg-gray-300 rounded-full" />
                            )}
                            {unit.product_count != null && unit.product_count > 0 && (
                                <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50/50 px-2 py-0.5 rounded-lg text-xs border border-emerald-100/50 shadow-sm">
                                    {unit.product_count} Products
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions - Modern Styled */}
                <div className="flex items-center gap-1 relative z-10">
                    <button
                        onClick={() => setIsEditOpen(true)}
                        className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all hover:shadow-lg active:scale-90"
                        title="Edit"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button
                        onClick={() => setIsAddChildOpen(true)}
                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all hover:shadow-lg active:scale-90"
                        title="Add Multiplier"
                    >
                        <Plus size={18} />
                    </button>
                    {!hasChildren && (
                        <button
                            onClick={handleDelete}
                            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all hover:shadow-lg active:scale-90"
                            title="Delete"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>

                {/* Glassmorphism gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform pointer-events-none" />
            </div>

            {/* Children Recursive Render with Animation */}
            {isExpanded && hasChildren && (
                <div className="border-l-2 border-gray-100/80 ml-6 pl-1 animate-in slide-in-from-top-2 duration-300">
                    {unit.children!.map((child, cidx) => (
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