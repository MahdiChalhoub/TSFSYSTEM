'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

type Category = {
    id: number;
    name: string;
    parentId?: number | null;
    parent?: number | null;
    children?: Category[];
};

type Props = {
    categories: Category[];
    onChange?: (lastId: number | null) => void;
    initialCategoryId?: number | null;
    compact?: boolean;
};

export function CategorySelector({ categories, onChange, initialCategoryId, compact = false }: Props) {
    const [selectedPath, setSelectedPath] = useState<number[]>([]);

    useEffect(() => {
        if (initialCategoryId) {
            const path: number[] = [];
            let currentId: number | null = initialCategoryId;
            while (currentId) {
                path.unshift(currentId);
                const cat = categories.find(c => c.id === currentId);
                currentId = getParentId(cat);
            }
            setSelectedPath(path);
        }
    }, [initialCategoryId, categories]);

    const getParentId = (cat: Category | undefined): number | null => {
        if (!cat) return null;
        // API returns 'parent' field (FK), some code uses 'parentId'
        if (cat.parentId !== undefined && cat.parentId !== null) return cat.parentId;
        if (cat.parent !== undefined && cat.parent !== null) return cat.parent;
        return null;
    };

    const getChildren = (parentId: number | null) => {
        return categories.filter(c => getParentId(c) === parentId);
    };

    const handleSelect = (level: number, categoryId: string) => {
        if (!categoryId) {
            // User selected "Select..."
            const newPath = selectedPath.slice(0, level);
            setSelectedPath(newPath);
            if (onChange) onChange(newPath.length > 0 ? newPath[newPath.length - 1] : null);
            return;
        }

        const id = parseInt(categoryId);
        const newPath = [...selectedPath.slice(0, level), id];
        setSelectedPath(newPath);
        if (onChange) onChange(id);
    };

    const renderSelects = () => {
        const roots = getChildren(null);

        if (categories.length === 0) {
            return <p className="text-[11px] text-gray-400 italic py-2">No categories defined.</p>;
        }

        // Build the selects array
        const selects: { level: number, options: Category[], selected?: number }[] = [];

        if (roots.length > 0) {
            // Hierarchical mode
            selects.push({ level: 0, options: roots, selected: selectedPath[0] });

            for (let i = 0; i < selectedPath.length; i++) {
                const children = getChildren(selectedPath[i]);
                if (children.length > 0) {
                    selects.push({ level: i + 1, options: children, selected: selectedPath[i + 1] });
                }
            }
        } else {
            // Flat mode — all categories have parent set (no nulls found at root)
            // Show all categories in a single dropdown
            selects.push({ level: 0, options: categories, selected: selectedPath[0] });
        }

        const selectClass = compact
            ? "w-full bg-white border border-gray-200 rounded-lg px-3 py-[9px] text-[13px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none transition-all text-gray-700 appearance-none"
            : "w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all bg-white";

        const labelNames = [
            <>Category <span className="text-red-400">*</span></>,
            'Sub-Category',
            'Sub-Sub-Category'
        ];

        return (
            <React.Fragment>
                {selects.map((s, idx) => (
                    <div key={idx} className={compact ? "" : `flex items-center gap-2 ${idx > 0 ? 'animate-in fade-in slide-in-from-left-2 duration-300' : ''}`}>
                        {!compact && idx > 0 && <ChevronRight className="text-gray-300 shrink-0" size={14} />}
                        <div className="flex-1">
                            <label className={compact
                                ? "block text-[10px] uppercase text-gray-400 font-semibold mb-1 tracking-wider"
                                : "block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1"
                            }>
                                {labelNames[idx] || `Level ${idx + 1}`}
                            </label>

                            <select
                                value={s.selected || ''}
                                onChange={(e) => handleSelect(idx, e.target.value)}
                                className={selectClass}
                            >
                                <option value="">Select...</option>
                                {s.options.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ))}
            </React.Fragment>
        );
    };

    return (
        <React.Fragment>
            {renderSelects()}
            <input type="hidden" name="categoryId" value={selectedPath[selectedPath.length - 1] || ''} />
        </React.Fragment>
    );
}
