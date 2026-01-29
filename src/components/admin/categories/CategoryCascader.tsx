'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';

type Category = {
    id: number;
    name: string;
    parentId: number | null;
};

type CategoryCascaderProps = {
    allCategories: Category[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    excludeId?: number; // Prevent selecting self or descendants as parent
    placeholder?: string;
};

export function CategoryCascader({ allCategories, selectedId, onSelect, excludeId, placeholder = "Select category..." }: CategoryCascaderProps) {
    // 1. Build memoized trees and lookups
    const { categoryMap, childrenMap } = useMemo(() => {
        const catMap = new Map<number, Category>();
        const childMap = new Map<number | 'root', Category[]>();

        childMap.set('root', []);

        allCategories.forEach(cat => {
            catMap.set(cat.id, cat);
            const pId = cat.parentId ? cat.parentId : 'root';
            if (!childMap.has(pId)) {
                childMap.set(pId, []);
            }
            childMap.get(pId)!.push(cat);
        });

        return { categoryMap: catMap, childrenMap: childMap };
    }, [allCategories]);

    // 2. Helper to get path to root: [Grandparent, Parent, Self]
    const getPath = (id: number | null): number[] => {
        if (!id) return [];
        const path: number[] = [];
        let currentId: number | null | undefined = id;

        while (currentId) {
            path.unshift(currentId);
            const cat = categoryMap.get(currentId);
            currentId = cat?.parentId;
        }
        return path;
    };

    // 3. Derived state from props
    // We don't keep local state for path to avoid sync issues, we derive it from selectedId
    const activePath = useMemo(() => getPath(selectedId), [selectedId, categoryMap]);

    // 4. Calculate Columns to display
    // Always show Root column. Then show columns for each item in the path that has children.
    const columns = useMemo(() => {
        const cols = [];
        // Root column
        cols.push({ parentId: 'root' as const, selected: activePath[0] || null });

        // Subsequent columns
        for (let i = 0; i < activePath.length; i++) {
            const currentId = activePath[i];
            const children = childrenMap.get(currentId);

            // If the current selection has children, we show the next column
            // BUT we only show it if this is the last item in the current path OR we are expanding
            if (children && children.length > 0) {
                cols.push({
                    parentId: currentId,
                    selected: activePath[i + 1] || null
                });
            }
        }
        return cols;
    }, [activePath, childrenMap]);

    // 5. Handle Filtering (Circular dependency prevention)
    const getOptions = (parentId: number | 'root') => {
        let options = childrenMap.get(parentId) || [];

        if (excludeId) {
            // Must not be the excluded ID
            options = options.filter(o => o.id !== excludeId);

            // Note: We should technically also filter descendants of excludeId, 
            // but if the parent is excluded, you can't reach the descendants anyway in a cascader.
            // So filtering just the excludeId at any level is sufficient for the UI.
        }
        return options;
    };

    return (
        <div className="space-y-3">
            {columns.map((col, index) => {
                const options = getOptions(col.parentId);
                // Don't render empty columns (dead ends)
                if (options.length === 0) return null;

                return (
                    <div key={col.parentId} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                        {index > 0 && <ChevronRight className="text-gray-400" size={16} />}
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">
                                {index === 0 ? 'Main Category' : `Level ${index + 1}`}
                            </label>
                            <select
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none bg-white transition-all shadow-sm"
                                value={col.selected || ''}
                                onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                    // If user selects a value in the middle of a chain, we just select that value
                                    // The parent logic upstream will decide if it needs to be deeper? 
                                    // User said: "he will render a new box... until i select one"
                                    // So collecting any ID is valid.
                                    onSelect(val);
                                }}
                            >
                                <option value="">{index === 0 ? 'None (Top Level)' : 'Select sub-category...'}</option>
                                {options.map(opt => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                );
            })}

            {/* Helper message */}
            {selectedId && (
                <div className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100 mt-2">
                    Selected Parent: <span className="font-bold">{categoryMap.get(selectedId)?.name}</span>
                </div>
            )}
        </div>
    );
}
