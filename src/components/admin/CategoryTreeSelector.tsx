'use client';

import { useState, memo } from 'react';
import { ChevronRight, ChevronDown, Folder } from 'lucide-react';

type CategoryNode = {
    id: number;
    name: string;
    parentId: number | null;
    children?: CategoryNode[];
    code?: string;
};

type Props = {
    categories: CategoryNode[];
    selectedIds: number[];
    onChange: (selectedIds: number[]) => void;
    maxHeight?: string;
};

export function CategoryTreeSelector({ categories, selectedIds, onChange, maxHeight = 'max-h-60' }: Props) {
    const handleToggle = (categoryId: number) => {
        if (selectedIds.includes(categoryId)) {
            // Remove from selection
            onChange(selectedIds.filter(id => id !== categoryId));
        } else {
            // Add to selection
            onChange([...selectedIds, categoryId]);
        }
    };

    return (
        <div className={`${maxHeight} overflow-y-auto p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-1`}>
            {categories.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-4">No categories available</p>
            ) : (
                categories.map(category => (
                    <CategoryTreeNode
                        key={category.id}
                        category={category}
                        level={0}
                        selectedIds={selectedIds}
                        onToggle={handleToggle}
                    />
                ))
            )}
        </div>
    );
}

const CategoryTreeNode = memo(function CategoryTreeNode({
    category,
    level,
    selectedIds,
    onToggle
}: {
    category: CategoryNode;
    level: number;
    selectedIds: number[];
    onToggle: (id: number) => void;
}) {
    const [isExpanded, setIsExpanded] = useState(level === 0); // Expand root categories by default

    const hasChildren = category.children && category.children.length > 0;
    const isSelected = selectedIds.includes(category.id);

    return (
        <div>
            {/* Category Row */}
            <div
                className={`
                    flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all
                    hover:bg-white
                    ${level > 0 ? `ml-${level * 4}` : ''}
                    ${isSelected ? 'bg-purple-50 border border-purple-100' : 'bg-transparent'}
                `}
                style={{ marginLeft: `${level * 1.5}rem` }}
            >
                {/* Expand Toggle */}
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                        className="p-0.5 hover:bg-gray-200 rounded text-gray-500 transition-colors flex-shrink-0"
                    >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                ) : (
                    <div className="w-4" /> // Spacer for alignment
                )}

                {/* Checkbox */}
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(category.id)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 flex-shrink-0 cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                />

                {/* Icon */}
                <Folder
                    size={16}
                    className={`flex-shrink-0 ${level === 0 ? 'text-orange-500' : 'text-gray-400'}`}
                />

                {/* Category Name */}
                <label
                    onClick={() => onToggle(category.id)}
                    className="text-sm text-gray-700 cursor-pointer flex-1 select-none flex items-center gap-2"
                >
                    <span>{category.name}</span>
                    {category.code && (
                        <span className="text-[10px] font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-500">
                            {category.code}
                        </span>
                    )}
                    {level === 0 && (
                        <span className="text-[9px] font-bold uppercase bg-orange-50 text-orange-500 px-1.5 py-0.5 rounded-full">
                            Main
                        </span>
                    )}
                </label>
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div className="border-l border-gray-200 ml-2 pl-1">
                    {category.children!.map(child => (
                        <CategoryTreeNode
                            key={child.id}
                            category={child}
                            level={level + 1}
                            selectedIds={selectedIds}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});