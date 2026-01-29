'use client';

import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

type Category = {
    id: number;
    name: string;
    parentId: number | null;
    children?: Category[];
};

type Props = {
    categories: Category[];
    onChange?: (lastId: number | null) => void;
    initialCategoryId?: number | null;
};

export function CategorySelector({ categories, onChange, initialCategoryId }: Props) {
    // We expect a flat list of categories. We'll organize them into a map for easy lookup.
    const [selectedPath, setSelectedPath] = useState<number[]>([]);

    useEffect(() => {
        if (initialCategoryId) {
            // Reconstruct path to root
            const path: number[] = [];
            let currentId: number | null = initialCategoryId;
            while (currentId) {
                path.unshift(currentId);
                const cat = categories.find(c => c.id === currentId);
                currentId = cat?.parentId || null;
            }
            setSelectedPath(path);
        }
    }, [initialCategoryId, categories]);

    const getChildren = (parentId: number | null) => {
        return categories.filter(c => c.parentId === parentId);
    };

    const handleSelect = (level: number, categoryId: string) => {
        const id = parseInt(categoryId);
        const newPath = [...selectedPath.slice(0, level), id];
        setSelectedPath(newPath);

        // Notify parent of the most specific selection
        if (onChange) {
            onChange(id);
        }
    };

    // Determine how many levels to show
    // We always show Level 0 (Roots)
    // Then for every selected item in the path, if it has children, we show the next level.

    const renderSelects = () => {
        const selects = [];

        // Level 0
        const roots = getChildren(null);
        if (roots.length === 0 && categories.length === 0) {
            return <p className="text-sm text-gray-500 italic">No categories defined.</p>;
        }

        selects.push({
            level: 0,
            options: roots,
            selected: selectedPath[0]
        });

        // Subsequent levels
        for (let i = 0; i < selectedPath.length; i++) {
            const currentId = selectedPath[i];
            const children = getChildren(currentId);

            if (children.length > 0) {
                selects.push({
                    level: i + 1,
                    options: children,
                    selected: selectedPath[i + 1]
                });
            }
        }

        return (
            <div className="space-y-3">
                {selects.map((s, idx) => (
                    <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        {idx > 0 && <ChevronRight className="text-gray-400" size={16} />}
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                                {idx === 0 ? 'Main Category' : `Sub-Category (Level ${idx})`}
                            </label>
                            <select
                                value={s.selected || ''}
                                onChange={(e) => handleSelect(idx, e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all bg-white"
                            >
                                <option value="" disabled>Select...</option>
                                {s.options.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div>
            {renderSelects()}
            {/* Hidden input for form submission */}
            <input type="hidden" name="categoryId" value={selectedPath[selectedPath.length - 1] || ''} />
        </div>
    );
}
