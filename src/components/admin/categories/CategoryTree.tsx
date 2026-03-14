'use client';

import { useState, useCallback, memo } from 'react';
import {
    ChevronRight, ChevronDown, Edit2, Trash2, Plus,
    Folder, FolderOpen, AlertCircle, Bookmark, Tag, Box, Search,
    ChevronsDownUp, ChevronsUpDown
} from 'lucide-react';
import { CategoryFormModal } from './CategoryFormModal';
import { CategoryExplorer } from './CategoryExplorer';
import { deleteCategory } from '@/app/actions/inventory/categories';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

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

export function CategoryTree({
    categories,
    allCategories = [],
    authToken,
}: {
    categories: CategoryNode[];
    allCategories?: Record<string, any>[];
    authToken?: string;
}) {
    const [activeModal, setActiveModal] = useState<{
        type: 'edit' | 'add-child' | 'none';
        category?: CategoryNode;
        parentId?: number;
    }>({ type: 'none' });
    const [explorerTarget, setExplorerTarget] = useState<{ id: number; name: string } | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);
    const [expandAll, setExpandAll] = useState(false);
    const [expandKey, setExpandKey] = useState(0);

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

    /* ── Empty state ──────────────────────────────────────────────── */
    if (categories.length === 0) {
        return (
            <div className="py-16 text-center animate-in fade-in zoom-in duration-500">
                <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                    }}
                >
                    <Folder size={32} style={{ color: 'var(--app-primary)', opacity: 0.5 }} />
                </div>
                <h3 className="text-lg font-bold text-app-foreground">No categories defined</h3>
                <p className="text-sm text-app-muted-foreground mt-1 max-w-xs mx-auto">
                    Create a root category to start organizing your product catalog.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* ── Expand / Collapse All ─────────────────────────────── */}
            <div className="flex justify-end mb-2">
                <button
                    onClick={() => { setExpandAll(!expandAll); setExpandKey(k => k + 1); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                        color: 'var(--app-primary)',
                        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                    }}
                >
                    {expandAll
                        ? <><ChevronsDownUp size={14} /> Collapse All</>
                        : <><ChevronsUpDown size={14} /> Expand All</>}
                </button>
            </div>

            {categories.map((cat, idx) => (
                <div
                    key={`${cat.id}-${expandKey}`}
                    className="animate-in slide-in-from-bottom-2 fade-in duration-300"
                    style={{ animationDelay: `${idx * 40}ms` }}
                >
                    <TreeNode
                        category={cat}
                        level={0}
                        allCategories={allCategories}
                        onEdit={handleEdit}
                        onAddChild={handleAddChild}
                        onDelete={handleRequestDelete}
                        onExplore={handleExplore}
                        defaultExpanded={expandAll}
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
                authToken={authToken}
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

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TreeNode — Recursive, theme-compliant tree node
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
const TreeNode = memo(function TreeNode({
    category,
    level,
    allCategories,
    onEdit,
    onAddChild,
    onDelete,
    onExplore,
    defaultExpanded,
}: {
    category: CategoryNode;
    level: number;
    allCategories: Record<string, any>[];
    onEdit: (cat: CategoryNode) => void;
    onAddChild: (id: number) => void;
    onDelete: (cat: CategoryNode) => void;
    onExplore: (id: number, name: string) => void;
    defaultExpanded?: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? level < 2);
    const hasChildren = category.children && category.children.length > 0;
    const isRoot = level === 0;

    const handleDelete = () => {
        if (hasChildren) {
            toast.error('Cannot delete a category that has sub-categories.');
            return;
        }
        onDelete(category);
    };

    return (
        <div className="select-none">
            {/* ── Row ────────────────────────────────────────────────────── */}
            <div
                className="group flex items-center justify-between rounded-xl border transition-all duration-150
          hover:shadow-sm cursor-default"
                style={{
                    padding: isRoot ? '14px 16px' : '10px 16px',
                    paddingLeft: `${16 + level * 24}px`,
                    background: isRoot
                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                        : 'var(--app-surface)',
                    borderColor: isRoot
                        ? 'color-mix(in srgb, var(--app-primary) 15%, var(--app-border))'
                        : 'var(--app-border)',
                    borderLeft: isRoot
                        ? '3px solid var(--app-primary)'
                        : level > 0
                            ? '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)'
                            : undefined,
                    marginLeft: level > 0 ? `${(level - 1) * 24 + 16}px` : undefined,
                    marginTop: level > 0 ? '4px' : '0',
                }}
            >
                <div className="flex items-center gap-3 min-w-0">
                    {/* Expand Toggle */}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-6 h-6 flex items-center justify-center rounded-md transition-all shrink-0"
                        style={{
                            background: hasChildren
                                ? (isExpanded
                                    ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--app-border) 30%, transparent)')
                                : 'transparent',
                            color: hasChildren
                                ? (isExpanded ? 'var(--app-primary)' : 'var(--app-muted-foreground)')
                                : 'transparent',
                            visibility: hasChildren ? 'visible' : 'hidden',
                        }}
                    >
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>

                    {/* Icon */}
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                        style={{
                            background: isRoot
                                ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            color: isRoot ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                        }}
                    >
                        {isRoot
                            ? <Bookmark size={18} strokeWidth={2.5} />
                            : hasChildren
                                ? (isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />)
                                : <Folder size={15} />}
                    </div>

                    {/* Text */}
                    <div
                        className="cursor-pointer group/title min-w-0"
                        onClick={() => onExplore(category.id, category.name)}
                    >
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4
                                className="font-bold text-app-foreground truncate transition-colors"
                                style={{ fontSize: isRoot ? '15px' : '13px' }}
                            >
                                {category.name}
                            </h4>
                            <Search
                                size={12}
                                className="opacity-0 group-hover/title:opacity-60 transition-opacity text-app-muted-foreground"
                            />
                            {category.code && (
                                <span
                                    className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                                        color: 'var(--app-muted-foreground)',
                                        border: '1px solid var(--app-border)',
                                    }}
                                >
                                    {category.code}
                                </span>
                            )}
                            {isRoot && (
                                <span
                                    className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                        color: 'var(--app-primary)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                    }}
                                >
                                    Root
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-app-muted-foreground">
                                {hasChildren ? `${category.children!.length} sub-categories` : 'Leaf node'}
                            </span>

                            {category.product_count != null && category.product_count > 0 && (
                                <>
                                    <div
                                        className="w-1 h-1 rounded-full shrink-0"
                                        style={{ background: 'var(--app-border)' }}
                                    />
                                    <span
                                        className="text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                                        style={{
                                            color: 'var(--app-success)',
                                            background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                                        }}
                                    >
                                        <Box size={10} />
                                        {category.product_count} products
                                    </span>
                                </>
                            )}

                            {category.brand_count != null && category.brand_count > 0 && (
                                <span
                                    className="text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                                    style={{
                                        color: 'var(--app-info)',
                                        background: 'color-mix(in srgb, var(--app-info) 8%, transparent)',
                                    }}
                                >
                                    <Tag size={10} />
                                    {category.brand_count} brands
                                </span>
                            )}

                            {category.parfum_count != null && category.parfum_count > 0 && (
                                <span
                                    className="text-[11px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                                    style={{
                                        color: 'var(--app-warning)',
                                        background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)',
                                    }}
                                >
                                    {category.parfum_count} attributes
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Actions ───────────────────────────────────────────────── */}
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(category)}
                        className="p-2 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors"
                        style={{ ['--hover-bg' as any]: 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 10%, transparent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        title="Edit"
                    >
                        <Edit2 size={15} />
                    </button>
                    <button
                        onClick={() => onAddChild(category.id)}
                        className="p-2 rounded-lg text-app-muted-foreground hover:text-app-info transition-colors"
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--app-info) 10%, transparent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        title="Add Sub-Category"
                    >
                        <Plus size={16} />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-2 rounded-lg transition-colors"
                        style={{
                            color: hasChildren ? 'var(--app-border)' : 'var(--app-muted-foreground)',
                            cursor: hasChildren ? 'not-allowed' : 'pointer',
                        }}
                        onMouseEnter={(e) => {
                            if (!hasChildren) {
                                e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error) 10%, transparent)';
                                e.currentTarget.style.color = 'var(--app-error)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = hasChildren ? 'var(--app-border)' : 'var(--app-muted-foreground)';
                        }}
                        title={hasChildren ? "Delete sub-categories first" : "Delete"}
                    >
                        {hasChildren ? <AlertCircle size={15} /> : <Trash2 size={15} />}
                    </button>
                </div>
            </div>

            {/* ── Children ───────────────────────────────────────────────── */}
            {isExpanded && hasChildren && (
                <div className="animate-in slide-in-from-top-1 duration-200">
                    {category.children!.map((child) => (
                        <TreeNode
                            key={child.id}
                            category={child}
                            level={level + 1}
                            allCategories={allCategories}
                            onEdit={onEdit}
                            onAddChild={onAddChild}
                            onDelete={onDelete}
                            onExplore={onExplore}
                            defaultExpanded={defaultExpanded}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});