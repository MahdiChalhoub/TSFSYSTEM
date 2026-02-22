'use client';

import { useState, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Edit2, Trash2, Plus, Folder, AlertCircle, Bookmark, Tag, Box, Search } from 'lucide-react';
import { CategoryFormModal } from './CategoryFormModal';
import { CategoryExplorer } from './CategoryExplorer';
import { deleteCategory } from '@/app/actions/categories';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import clsx from 'clsx';

type CategoryNode = {
    id: number;
    name: string;
    parent: number | null;
    children?: CategoryNode[];
    product_count?: number;
    brand_count?: number;
    parfum_count?: number;
    code?: string;
    short_name?: string;
};

export function CategoryTree({ categories, allCategories = [] }: { categories: CategoryNode[], allCategories?: Record<string, any>[] }) {
    const [activeModal, setActiveModal] = useState<{ type: 'edit' | 'add-child' | 'none', category?: CategoryNode, parentId?: number }>({ type: 'none' });
    const [explorerTarget, setExplorerTarget] = useState<{ id: number; name: string } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);

    const handleEdit = useCallback((category: CategoryNode) => {
        setActiveModal({ type: 'edit', category });
    }, []);

    const handleAddChild = useCallback((parentId: number) => {
        setActiveModal({ type: 'add-child', parentId });
    }, []);

    const handleRequestDelete = useCallback((category: CategoryNode) => {
        setDeleteTarget(category);
    }, []);

    const handleExplore = useCallback((id: number, name: string) => {
        setExplorerTarget({ id, name });
    }, []);

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        await deleteCategory(deleteTarget.id);
        toast.success(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
    };

    const closeModals = useCallback(() => {
        setActiveModal({ type: 'none' });
    }, []);

    if (categories.length === 0) {
        return (
            <div className="py-20 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-100 shadow-inner">
                    <Folder size={32} className="text-orange-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-400">No categories defined</h3>
                <p className="text-gray-400 mt-1 max-w-xs mx-auto">Create a main category to organize your catalog.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {categories.map((cat, idx) => (
                <div key={cat.id} className="animate-in slide-in-from-bottom-4 fade-in duration-500" style={{ animationDelay: `${idx * 50}ms` }}>
                    <CategoryTreeNode
                        category={cat}
                        level={0}
                        allCategories={allCategories}
                        onEdit={handleEdit}
                        onAddChild={handleAddChild}
                        onDelete={handleRequestDelete}
                        onExplore={handleExplore}
                    />
                </div>
            ))}

            {/* Global Modals */}
            {activeModal.type !== 'none' && (
                <CategoryFormModal
                    isOpen={true}
                    onClose={closeModals}
                    category={activeModal.type === 'edit' ? activeModal.category : undefined}
                    parentId={activeModal.type === 'add-child' ? activeModal.parentId : undefined}
                    potentialParents={allCategories}
                />
            )}

            <CategoryExplorer
                categoryId={explorerTarget?.id || null}
                categoryName={explorerTarget?.name || null}
                isOpen={explorerTarget !== null}
                onClose={() => setExplorerTarget(null)}
            />

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleConfirmDelete}
                title={`Delete "${deleteTarget?.name}"?`}
                description="This will permanently remove this category. Make sure it has no products assigned."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
}

const CategoryTreeNode = memo(function CategoryTreeNode({
    category,
    level,
    allCategories,
    onEdit,
    onAddChild,
    onDelete,
    onExplore
}: {
    category: CategoryNode;
    level: number;
    allCategories: Record<string, any>[];
    onEdit: (cat: CategoryNode) => void;
    onAddChild: (id: number) => void;
    onDelete: (cat: CategoryNode) => void;
    onExplore: (id: number, name: string) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    const hasChildren = category.children && category.children.length > 0;

    const handleDelete = () => {
        if (hasChildren) {
            toast.error('Cannot delete a category that has sub-categories.');
            return;
        }
        onDelete(category);
    };

    return (
        <div className="select-none mb-1">
            <div
                className={clsx(
                    "group flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden",
                    level === 0
                        ? "bg-white/80 backdrop-blur-md border-gray-100 shadow-sm hover:shadow-xl hover:border-orange-200"
                        : "bg-orange-50/20 border-gray-100/50 ml-10 mt-2 hover:bg-white hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/5",
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
                            isExpanded ? "bg-orange-50 text-orange-600 rotate-0" : "bg-gray-50 text-gray-400 -rotate-90",
                            !hasChildren && 'invisible opacity-0'
                        )}
                    >
                        <ChevronDown size={18} />
                    </button>

                    {/* Icon with Gradient Glow */}
                    <div className={clsx(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner transition-transform group-hover:scale-110 duration-300",
                        level === 0
                            ? "bg-orange-100 text-orange-600 ring-4 ring-orange-50/50"
                            : "bg-gray-100 text-gray-400 ring-4 ring-gray-100/30"
                    )}>
                        {level === 0 ? <Bookmark size={22} strokeWidth={2.5} /> : <Folder size={20} strokeWidth={2} />}
                    </div>

                    {/* Info */}
                    <div
                        className="cursor-pointer group/title"
                        onClick={() => onExplore(category.id, category.name)}
                    >
                        <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-gray-900 text-lg tracking-tight group-hover/title:text-orange-600 transition-colors flex items-center gap-2">
                                {category.name}
                                <Search size={14} className="opacity-0 group-hover/title:opacity-100 transition-opacity text-orange-400" />
                            </h4>
                            {category.code && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 border border-gray-200 shadow-sm">
                                    {category.code}
                                </span>
                            )}
                            {level === 0 && (
                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-orange-50 text-orange-600 border border-orange-100 animate-pulse">
                                    Master
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-3">
                            <span className="font-medium text-xs">
                                {hasChildren ? `${category.children!.length} sub-categories` : 'Terminal Category'}
                            </span>
                            {category.product_count != null && category.product_count > 0 && (
                                <div className="h-1 w-1 bg-gray-300 rounded-full" />
                            )}
                            {category.product_count != null && category.product_count > 0 && (
                                <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50/50 px-2 py-0.5 rounded-lg text-xs border border-emerald-100/50 shadow-sm">
                                    {category.product_count} Products
                                </span>
                            )}
                            {category.brand_count != null && category.brand_count > 0 && (
                                <span className="flex items-center gap-1.5 text-blue-600 font-bold bg-blue-50/50 px-2 py-0.5 rounded-lg text-xs border border-blue-100/50 shadow-sm">
                                    <Tag size={12} strokeWidth={3} />
                                    {category.brand_count} Brands
                                </span>
                            )}
                            {category.parfum_count != null && category.parfum_count > 0 && (
                                <span className="flex items-center gap-1.5 text-purple-600 font-bold bg-purple-50/50 px-2 py-0.5 rounded-lg text-xs border border-purple-100/50 shadow-sm">
                                    <Box size={12} strokeWidth={3} />
                                    {category.parfum_count} Attributes
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Actions - Modern Styled */}
                <div className="flex items-center gap-1 relative z-10">
                    <button
                        onClick={() => onEdit(category)}
                        className="p-2.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all hover:shadow-lg active:scale-90"
                        title="Edit"
                    >
                        <Edit2 size={18} />
                    </button>
                    <button
                        onClick={() => onAddChild(category.id)}
                        className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all hover:shadow-lg active:scale-90"
                        title="Add Sub-Category"
                    >
                        <Plus size={18} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className={clsx(
                            "p-2.5 rounded-xl transition-all hover:shadow-lg active:scale-90",
                            hasChildren ? "text-gray-200 cursor-not-allowed" : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                        )}
                        title={hasChildren ? "Delete sub-categories first" : "Delete"}
                    >
                        {hasChildren ? <AlertCircle size={18} /> : <Trash2 size={18} />}
                    </button>
                </div>

                {/* Glassmorphism gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 transition-transform pointer-events-none" />
            </div>

            {/* Children Recursive Render with Animation */}
            {isExpanded && hasChildren && (
                <div className="border-l-2 border-gray-100/80 ml-6 pl-1 animate-in slide-in-from-top-2 duration-300">
                    {category.children!.map((child) => (
                        <CategoryTreeNode
                            key={child.id}
                            category={child}
                            level={level + 1}
                            allCategories={allCategories}
                            onEdit={onEdit}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                            onExplore={onExplore}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});