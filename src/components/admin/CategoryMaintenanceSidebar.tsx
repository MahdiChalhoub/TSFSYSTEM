'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, Folder, Database } from 'lucide-react';
import { clsx } from 'clsx';

type CategoryNode = {
    id: number;
    name: string;
    parentId: number | null;
    _count?: { products: number };
    children?: CategoryNode[];
};

type Props = {
    categories: Record<string, any>[];
    activeCategoryId: number | null;
};

function buildCategoryTree(flatCategories: Record<string, any>[]): CategoryNode[] {
    const categoryMap = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];

    // Clone and map
    flatCategories.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] } as unknown as CategoryNode);
    });

    // Build hierarchy
    flatCategories.forEach(cat => {
        const node = categoryMap.get(cat.id)!;
        if (cat.parentId && categoryMap.has(cat.parentId)) {
            const parent = categoryMap.get(cat.parentId)!;
            parent.children!.push(node);
        } else {
            roots.push(node);
        }
    });

    return roots;
}

// Find path of IDs from root to target
function findPathToNode(categories: Record<string, any>[], targetId: number | null): number[] {
    if (!targetId) return [];

    // Build parent map for easy traversal up
    const parentMap = new Map<number, number | null>();
    categories.forEach(c => parentMap.set(c.id, c.parentId));

    const path: number[] = [];
    let current: number | null = targetId;

    while (current) {
        path.unshift(current);
        current = parentMap.get(current) || null;
    }

    return path;
}

export function CategoryMaintenanceSidebar({ categories, activeCategoryId }: Props) {
    const tree = useMemo(() => buildCategoryTree(categories), [categories]);
    const expandedPath = useMemo(() => findPathToNode(categories, activeCategoryId), [categories, activeCategoryId]);

    return (
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-app-border bg-app-surface flex flex-col h-full">
            <div className="p-3 md:p-4 border-b border-app-border bg-app-surface-2/50">
                <h2 className="font-bold text-app-foreground flex items-center gap-2">
                    <Database size={18} className="text-app-primary" />
                    Category Browser
                </h2>
                <div className="mt-2 text-app-muted-foreground" style={{ fontSize: 'var(--tp-xs)' }}>
                    Navigate to view products.
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {tree.map(node => (
                    <SidebarNode
                        key={node.id}
                        node={node}
                        activeCategoryId={activeCategoryId}
                        expandedPath={expandedPath}
                    />
                ))}
            </div>
        </div>
    );
}

function SidebarNode({ node, activeCategoryId, expandedPath, level = 0 }: { node: CategoryNode, activeCategoryId: number | null, expandedPath: number[], level?: number }) {
    const isActive = activeCategoryId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    // Auto-expand if this node is in the path to the active node
    const shouldBeExpanded = expandedPath.includes(node.id);
    const [isExpanded, setIsExpanded] = useState(shouldBeExpanded);

    // Update expansion when path changes externally (e.g. navigation)
    useEffect(() => {
        if (shouldBeExpanded) setIsExpanded(true);
    }, [shouldBeExpanded]);

    return (
        <div>
            <div className={clsx(
                "group flex items-center gap-2 px-2 py-2 rounded-lg transition-colors select-none",
                isActive
                    ? "bg-app-primary/10 text-app-primary"
                    : "hover:bg-app-surface-2 text-app-foreground"
            )}
                style={{ minHeight: 40 }}>
                {/* Indentation */}
                <div style={{ width: level * 12 }} />

                {/* Toggle */}
                {hasChildren ? (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 rounded hover:bg-app-border/30 text-app-muted-foreground flex-shrink-0"
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <span className="w-6" />
                )}

                {/* Link — fixed the broken /admin/ prefix: real route is /inventory/categories/maintenance */}
                <Link
                    href={`/inventory/categories/maintenance?categoryId=${node.id}`}
                    className="flex-1 flex items-center gap-2 truncate"
                >
                    <Folder size={16} className={clsx(
                        'flex-shrink-0',
                        isActive ? "text-app-primary" : "text-app-warning"
                    )} />
                    <span className="truncate font-medium" style={{ fontSize: 'var(--tp-md)' }}>{node.name}</span>

                    {/* Count Badge */}
                    {node._count && node._count.products > 0 && (
                        <span className="ml-auto font-bold bg-app-surface-2 text-app-muted-foreground px-1.5 rounded-full"
                            style={{ fontSize: 'var(--tp-xxs)' }}>
                            {node._count.products}
                        </span>
                    )}
                </Link>
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div>
                    {node.children!.map(child => (
                        <SidebarNode
                            key={child.id}
                            node={child}
                            activeCategoryId={activeCategoryId}
                            expandedPath={expandedPath}
                            level={level + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
