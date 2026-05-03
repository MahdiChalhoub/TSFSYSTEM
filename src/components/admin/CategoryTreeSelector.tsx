'use client';

import { useState, memo } from 'react';
import { ChevronRight, FolderTree, Check } from 'lucide-react';

type CategoryNode = {
    id: number;
    name: string;
    parent: number | null;
    children?: CategoryNode[];
    code?: string;
};

type Props = {
    categories: CategoryNode[];
    selectedIds: number[];
    onChange: (selectedIds: number[]) => void;
    maxHeight?: string;
};

/* ═══════════════════════════════════════════════════════════
 *  CategoryTreeSelector — clean tree picker.
 *  Visual language matches the /countries LinkedTree and the
 *  brand row faceted tree: theme-color variables, subtle
 *  branch connectors, no loud accent badges.
 * ═══════════════════════════════════════════════════════════ */
export function CategoryTreeSelector({
    categories, selectedIds, onChange, maxHeight = 'max-h-60'
}: Props) {
    const handleToggle = (categoryId: number) => {
        if (selectedIds.includes(categoryId)) {
            onChange(selectedIds.filter(id => id !== categoryId));
        } else {
            onChange([...selectedIds, categoryId]);
        }
    };

    return (
        <div className={`${maxHeight} overflow-y-auto rounded-xl`}
            style={{
                background: 'color-mix(in srgb, var(--app-background) 60%, var(--app-surface))',
                border: '1px solid var(--app-border)',
            }}>
            {categories.length === 0 ? (
                <p className="text-tp-sm text-app-muted-foreground italic text-center py-8">
                    No categories available
                </p>
            ) : (
                <div className="py-1">
                    {categories.map((category, idx) => (
                        <CategoryTreeNode
                            key={category.id}
                            category={category}
                            level={0}
                            selectedIds={selectedIds}
                            onToggle={handleToggle}
                            isLast={idx === categories.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

const CategoryTreeNode = memo(function CategoryTreeNode({
    category, level, selectedIds, onToggle, isLast,
}: {
    category: CategoryNode;
    level: number;
    selectedIds: number[];
    onToggle: (id: number) => void;
    isLast: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(level === 0);

    const hasChildren = !!category.children && category.children.length > 0;
    const isSelected = selectedIds.includes(category.id);
    const indent = 12 + level * 20;

    return (
        <div>
            {/* Row — smoothed background + border-left transitions so the
                hover and select states fade in gently rather than snapping. */}
            <div
                onClick={() => onToggle(category.id)}
                className="group flex items-center gap-2 cursor-pointer relative"
                style={{
                    paddingLeft: `${indent}px`,
                    paddingRight: '12px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    background: isSelected
                        ? 'color-mix(in srgb, var(--app-primary) 7%, transparent)'
                        : 'transparent',
                    borderLeft: isSelected
                        ? '2px solid var(--app-primary)'
                        : '2px solid transparent',
                    transition: 'background 180ms ease, border-color 180ms ease',
                }}
                onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 60%, transparent)';
                }}
                onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}>

                {/* Tree connector — vertical line for non-root + horizontal branch */}
                {level > 0 && (
                    <>
                        <div className="absolute pointer-events-none"
                            style={{
                                left: `${12 + (level - 1) * 20 + 8}px`,
                                top: 0,
                                bottom: isLast ? '50%' : 0,
                                width: '1px',
                                background: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                            }} />
                        <div className="absolute pointer-events-none"
                            style={{
                                left: `${12 + (level - 1) * 20 + 8}px`,
                                top: '50%',
                                width: '10px',
                                height: '1px',
                                background: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                            }} />
                    </>
                )}

                {/* Chevron — invisible spacer when no children, keeps alignment.
                    Smoothed transition for the rotate + color so expand/collapse
                    feels continuous, not snap. */}
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className="w-4 h-4 flex items-center justify-center flex-shrink-0 rounded"
                        style={{
                            color: 'var(--app-text-faint)',
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 200ms cubic-bezier(.4,0,.2,1), color 150ms',
                        }}
                        title={isExpanded ? 'Collapse' : 'Expand'}>
                        <ChevronRight size={12} />
                    </button>
                ) : (
                    <div className="w-4 flex-shrink-0" />
                )}

                {/* Custom checkbox with eased transition so check-fill animates */}
                <div
                    onClick={(e) => { e.stopPropagation(); onToggle(category.id); }}
                    className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                        borderColor: isSelected ? 'var(--app-primary)' : 'var(--app-border)',
                        background: isSelected ? 'var(--app-primary)' : 'transparent',
                        transition: 'border-color 180ms ease, background 180ms ease',
                    }}
                    aria-checked={isSelected}
                    role="checkbox">
                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                </div>

                {/* Folder icon — neutral, only colored when selected */}
                <FolderTree
                    size={13}
                    className="flex-shrink-0"
                    style={{
                        color: isSelected ? 'var(--app-primary)' : 'var(--app-text-faint)',
                        transition: 'color 180ms ease',
                    }} />

                {/* Name */}
                <span className="text-tp-sm font-semibold truncate flex-1"
                    style={{ color: isSelected ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
                    {category.name}
                </span>

                {/* Code chip */}
                {category.code && (
                    <span className="text-tp-xxs font-mono font-bold flex-shrink-0 px-1.5 py-0.5 rounded"
                        style={{
                            background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                            color: 'var(--app-text-faint)',
                        }}>
                        {category.code}
                    </span>
                )}
            </div>

            {/* Children — fade + slide in when expanded so the tree opens
                continuously instead of popping. */}
            {isExpanded && hasChildren && (
                <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
                    {category.children!.map((child, idx) => (
                        <CategoryTreeNode
                            key={child.id}
                            category={child}
                            level={level + 1}
                            selectedIds={selectedIds}
                            onToggle={onToggle}
                            isLast={idx === category.children!.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
