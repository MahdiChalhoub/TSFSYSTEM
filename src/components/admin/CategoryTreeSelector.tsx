'use client';

import { useState, useMemo, memo } from 'react';
import { ChevronRight, FolderTree, Check, Minus } from 'lucide-react';

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

/** Walk a node + descendants and return every id (parent first). */
function collectIds(node: CategoryNode): number[] {
    const out = [node.id];
    (node.children || []).forEach(child => out.push(...collectIds(child)));
    return out;
}

/* ═══════════════════════════════════════════════════════════
 *  CategoryTreeSelector — tree picker with cascading select.
 *  Toggling a parent now selects/unselects the whole subtree
 *  so the user doesn't have to click each child manually.
 *  An indeterminate (—) state on the parent checkbox signals
 *  "some but not all descendants selected".
 * ═══════════════════════════════════════════════════════════ */
export function CategoryTreeSelector({
    categories, selectedIds, onChange, maxHeight = 'max-h-60'
}: Props) {
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const handleToggle = (node: CategoryNode) => {
        const subtreeIds = collectIds(node);
        // Decide based on the parent's current state:
        //   - parent currently checked → unselect the whole subtree
        //   - parent currently unchecked or indeterminate → select the
        //     whole subtree (lifts indeterminate to fully-checked)
        const parentSelected = selectedSet.has(node.id);
        if (parentSelected) {
            const removal = new Set(subtreeIds);
            onChange(selectedIds.filter(id => !removal.has(id)));
        } else {
            const next = new Set(selectedIds);
            subtreeIds.forEach(id => next.add(id));
            onChange([...next]);
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
                            selectedSet={selectedSet}
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
    category, level, selectedSet, onToggle, isLast,
}: {
    category: CategoryNode;
    level: number;
    selectedSet: Set<number>;
    onToggle: (node: CategoryNode) => void;
    isLast: boolean;
}) {
    const [isExpanded, setIsExpanded] = useState(level === 0);

    const hasChildren = !!category.children && category.children.length > 0;
    const isSelected = selectedSet.has(category.id);
    // Indeterminate = some descendants selected, but the node itself
    // isn't (or some descendants are missing). Visualised as a dash
    // instead of a check, so a half-filled subtree reads at a glance.
    const isIndeterminate = useMemo(() => {
        if (isSelected || !hasChildren) return false;
        const stack = [...(category.children || [])];
        while (stack.length) {
            const n = stack.pop()!;
            if (selectedSet.has(n.id)) return true;
            if (n.children) stack.push(...n.children);
        }
        return false;
    }, [isSelected, hasChildren, category.children, selectedSet]);
    const indent = 12 + level * 20;

    return (
        <div>
            {/* Row — smoothed background + border-left transitions so the
                hover and select states fade in gently rather than snapping. */}
            <div
                onClick={() => onToggle(category)}
                className="group flex items-center gap-2 cursor-pointer relative"
                style={{
                    paddingLeft: `${indent}px`,
                    paddingRight: '12px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    background: isSelected
                        ? 'color-mix(in srgb, var(--app-primary) 7%, transparent)'
                        : isIndeterminate
                            ? 'color-mix(in srgb, var(--app-primary) 3%, transparent)'
                            : 'transparent',
                    borderLeft: isSelected
                        ? '2px solid var(--app-primary)'
                        : isIndeterminate
                            ? '2px solid color-mix(in srgb, var(--app-primary) 50%, transparent)'
                            : '2px solid transparent',
                    transition: 'background 180ms ease, border-color 180ms ease',
                }}
                onMouseEnter={e => {
                    if (!isSelected && !isIndeterminate) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 60%, transparent)';
                }}
                onMouseLeave={e => {
                    if (!isSelected && !isIndeterminate) (e.currentTarget as HTMLElement).style.background = 'transparent';
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

                {/* Custom checkbox — three states:
                    • selected (everything in subtree included): solid + Check
                    • indeterminate (some descendants in subtree): solid + Minus
                    • unselected: outline only */}
                <div
                    onClick={(e) => { e.stopPropagation(); onToggle(category); }}
                    className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                        borderColor: (isSelected || isIndeterminate) ? 'var(--app-primary)' : 'var(--app-border)',
                        background: isSelected
                            ? 'var(--app-primary)'
                            : isIndeterminate
                                ? 'color-mix(in srgb, var(--app-primary) 60%, transparent)'
                                : 'transparent',
                        transition: 'border-color 180ms ease, background 180ms ease',
                    }}
                    aria-checked={isSelected ? true : isIndeterminate ? 'mixed' : false}
                    role="checkbox">
                    {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
                    {!isSelected && isIndeterminate && <Minus size={10} className="text-white" strokeWidth={3} />}
                </div>

                {/* Folder icon — neutral, only colored when selected */}
                <FolderTree
                    size={13}
                    className="flex-shrink-0"
                    style={{
                        color: (isSelected || isIndeterminate) ? 'var(--app-primary)' : 'var(--app-text-faint)',
                        transition: 'color 180ms ease',
                    }} />

                {/* Name */}
                <span className="text-tp-sm font-semibold truncate flex-1"
                    style={{ color: (isSelected || isIndeterminate) ? 'var(--app-primary)' : 'var(--app-foreground)' }}>
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
                            selectedSet={selectedSet}
                            onToggle={onToggle}
                            isLast={idx === category.children!.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
});
