'use client';

import { useState, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Edit2, Trash2, Plus, Folder, AlertCircle } from 'lucide-react';
import { CategoryFormModal } from './CategoryFormModal';
import { deleteCategory } from '@/app/actions/categories';

type CategoryNode = {
    id: number;
    name: string;
    parent: number | null;
    children?: CategoryNode[];
    product_count?: number;
    code?: string;
    short_name?: string;
};

export function CategoryTree({ categories, allCategories = [] }: { categories: CategoryNode[], allCategories?: any[] }) {
    const [activeModal, setActiveModal] = useState<{ type: 'edit' | 'add-child' | 'none', category?: CategoryNode, parentId?: number }>({ type: 'none' });

    const handleEdit = useCallback((category: CategoryNode) => {
        setActiveModal({ type: 'edit', category });
    }, []);

    const handleAddChild = useCallback((parentId: number) => {
        setActiveModal({ type: 'add-child', parentId });
    }, []);

    const closeModals = useCallback(() => {
        setActiveModal({ type: 'none' });
    }, []);

    return (
        <div className="space-y-4">
            {categories.map((cat) => (
                <CategoryTreeNode
                    key={cat.id}
                    category={cat}
                    level={0}
                    allCategories={allCategories}
                    onEdit={handleEdit}
                    onAddChild={handleAddChild}
                />
            ))}

            {/* Global Modals - Rendered only once! */}
            {activeModal.type !== 'none' && (
                <CategoryFormModal
                    isOpen={true}
                    onClose={closeModals}
                    category={activeModal.type === 'edit' ? activeModal.category : undefined}
                    parentId={activeModal.type === 'add-child' ? activeModal.parentId : undefined}
                    potentialParents={allCategories}
                />
            )}
        </div>
    );
}

const CategoryTreeNode = memo(function CategoryTreeNode({
    category,
    level,
    allCategories,
    onEdit,
    onAddChild
}: {
    category: CategoryNode;
    level: number;
    allCategories: any[];
    onEdit: (cat: CategoryNode) => void;
    onAddChild: (id: number) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(true);

    const hasChildren = category.children && category.children.length > 0;

    const handleDelete = async () => {
        if (hasChildren) {
            alert('Cannot delete a category that has sub-categories. Please delete the sub-categories first.');
            return;
        }
        if (confirm(`Are you sure you want to delete "${category.name}"?`)) {
            await deleteCategory(category.id);
        }
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
                        ${level === 0 ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}
                    `}>
                        <Folder size={20} strokeWidth={2} />
                    </div>

                    {/* Info */}
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900">{category.name}</h4>
                            {category.code && (
                                <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">
                                    {category.code}
                                </span>
                            )}
                            {level === 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-orange-50 text-orange-500 tracking-wide border border-orange-100">
                                    Main
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-3">
                            <span>{hasChildren ? `${category.children!.length} sub-categories` : 'No sub-categories'}</span>
                            {category.product_count != null && category.product_count > 0 && (
                                <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                    · {category.product_count} Products
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(category)}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <Edit2 size={16} />
                    </button>
                    <button
                        onClick={() => onAddChild(category.id)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Add Sub-Category"
                    >
                        <Plus size={16} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className={`p-2 rounded-lg transition-colors ${hasChildren ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                        title={hasChildren ? "Delete sub-categories first" : "Delete"}
                    >
                        {hasChildren ? <AlertCircle size={16} /> : <Trash2 size={16} />}
                    </button>
                </div>
            </div>

            {/* Children Recursive Render */}
            {isExpanded && hasChildren && (
                <div className="border-l-2 border-gray-100 ml-6 pl-2">
                    {category.children!.map((child) => (
                        <CategoryTreeNode
                            key={child.id}
                            category={child}
                            level={level + 1}
                            allCategories={allCategories}
                            onEdit={onEdit}
                            onAddChild={onAddChild}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});