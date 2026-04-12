'use client';

import { useState, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Edit2, Trash2, Plus, Folder, AlertCircle } from 'lucide-react';
import { CategoryFormModal } from './CategoryFormModal';
import { deleteCategory } from '@/app/actions/categories';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type CategoryNode = {
    id: number;
    name: string;
    parent: number | null;
    children?: CategoryNode[];
    product_count?: number;
    code?: string;
    short_name?: string;
};

export function CategoryTree({ categories, allCategories = [] }: { categories: CategoryNode[], allCategories?: Record<string, any>[] }) {
    const [activeModal, setActiveModal] = useState<{ type: 'edit' | 'add-child' | 'none', category?: CategoryNode, parentId?: number }>({ type: 'none' });
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

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        await deleteCategory(deleteTarget.id);
        toast.success(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
    };

    const closeModals = useCallback(() => {
        setActiveModal({ type: 'none' });
    }, []);

    return (
        <div className="space-y-2">
            {categories.map((cat) => (
                <CategoryTreeNode
                    key={cat.id}
                    category={cat}
                    level={0}
                    allCategories={allCategories}
                    onEdit={handleEdit}
                    onAddChild={handleAddChild}
                    onDelete={handleRequestDelete}
                />
            ))}

            {activeModal.type !== 'none' && (
                <CategoryFormModal
                    isOpen={true}
                    onClose={closeModals}
                    category={activeModal.type === 'edit' ? activeModal.category : undefined}
                    parentId={activeModal.type === 'add-child' ? activeModal.parentId : undefined}
                    potentialParents={allCategories}
                />
            )}

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
    onDelete
}: {
    category: CategoryNode;
    level: number;
    allCategories: Record<string, any>[];
    onEdit: (cat: CategoryNode) => void;
    onAddChild: (id: number) => void;
    onDelete: (cat: CategoryNode) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(true);
    const hasChildren = category.children && category.children.length > 0;

    const handleDelete = () => {
        if (hasChildren) {
            toast.error('Cannot delete a category that has sub-categories. Please delete the sub-categories first.');
            return;
        }
        onDelete(category);
    };

    return (
        <div className="select-none">
            <div
                className="group flex items-center justify-between p-3 rounded-xl border transition-all duration-200"
                style={{
                    background: level === 0 ? 'var(--app-surface)' : 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                    borderColor: 'var(--app-border)',
                    marginLeft: level > 0 ? '2rem' : 0,
                    marginTop: level > 0 ? '0.375rem' : 0,
                    marginBottom: level === 0 ? '0.375rem' : 0,
                }}
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
                        background: level === 0 ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'color-mix(in srgb, var(--app-text-muted) 8%, transparent)',
                        color: level === 0 ? 'var(--app-primary)' : 'var(--app-text-muted)',
                    }}>
                        <Folder size={18} strokeWidth={2} />
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-[13px] font-bold" style={{ color: 'var(--app-text)' }}>{category.name}</h4>
                            {category.code && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
                                    background: 'color-mix(in srgb, var(--app-text-muted) 8%, transparent)',
                                    color: 'var(--app-text-muted)',
                                }}>
                                    {category.code}
                                </span>
                            )}
                            {level === 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest" style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                                    color: 'var(--app-primary)',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                                }}>
                                    Root
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] mt-0.5 flex items-center gap-2" style={{ color: 'var(--app-text-muted)' }}>
                            <span>{hasChildren ? `${category.children!.length} sub-categories` : 'No sub-categories'}</span>
                            {category.product_count != null && category.product_count > 0 && (
                                <span className="font-bold" style={{ color: 'var(--app-primary)' }}>
                                    · {category.product_count} Products
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(category)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--app-text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 8%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Edit"
                    >
                        <Edit2 size={14} />
                    </button>
                    <button
                        onClick={() => onAddChild(category.id)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--app-text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-info, #3b82f6)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        title="Add Sub-Category"
                    >
                        <Plus size={14} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{
                            color: hasChildren ? 'color-mix(in srgb, var(--app-text-muted) 40%, transparent)' : 'var(--app-text-muted)',
                            cursor: hasChildren ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={e => { if (!hasChildren) { e.currentTarget.style.color = 'var(--app-error, #ef4444)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)'; } }}
                        onMouseLeave={e => { e.currentTarget.style.color = hasChildren ? 'color-mix(in srgb, var(--app-text-muted) 40%, transparent)' : 'var(--app-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                        title={hasChildren ? "Delete sub-categories first" : "Delete"}
                    >
                        {hasChildren ? <AlertCircle size={14} /> : <Trash2 size={14} />}
                    </button>
                </div>
            </div>

            {isExpanded && hasChildren && (
                <div className="ml-5 pl-3" style={{ borderLeft: '2px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                    {category.children!.map((child) => (
                        <CategoryTreeNode
                            key={child.id}
                            category={child}
                            level={level + 1}
                            allCategories={allCategories}
                            onEdit={onEdit}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});