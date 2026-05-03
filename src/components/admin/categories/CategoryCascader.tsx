'use client';

import { useMemo } from 'react';
import { ChevronDown, FolderTree, Layers } from 'lucide-react';

type Category = {
    id: number;
    name: string;
    parent: number | null;
};

type CategoryCascaderProps = {
    allCategories: Category[];
    selectedId: number | null;
    onSelect: (id: number | null) => void;
    /** Prevent selecting self or descendants as a parent. */
    excludeId?: number;
    placeholder?: string;
};

/**
 * CategoryCascader — drill-down picker for a node in the category tree.
 *
 * Renders a column per depth level (Root → Sub → …) and only opens the
 * next column when the current one has children. Themed (var(--app-*))
 * to match the rest of the modal — replaces the previous hard-coded
 * gray/emerald styling and the "Selected Parent: …" footer (the
 * Placement Preview in the Hierarchy pane shows that already).
 */
export function CategoryCascader({
    allCategories, selectedId, onSelect, excludeId,
}: CategoryCascaderProps) {
    // ── Tree indices ──
    const { categoryMap, childrenMap } = useMemo(() => {
        const catMap = new Map<number, Category>();
        const childMap = new Map<number | 'root', Category[]>();
        childMap.set('root', []);
        allCategories.forEach(cat => {
            catMap.set(cat.id, cat);
            const pId = cat.parent ? cat.parent : 'root';
            if (!childMap.has(pId)) childMap.set(pId, []);
            childMap.get(pId)!.push(cat);
        });
        return { categoryMap: catMap, childrenMap: childMap };
    }, [allCategories]);

    // ── Path from root to current selection ──
    const activePath = useMemo(() => {
        if (!selectedId) return [] as number[];
        const path: number[] = [];
        let cur: number | null | undefined = selectedId;
        while (cur) {
            path.unshift(cur);
            cur = categoryMap.get(cur)?.parent;
        }
        return path;
    }, [selectedId, categoryMap]);

    // ── Columns to render: root + every level whose currently-selected
    //    item has children of its own. ──
    const columns = useMemo(() => {
        const cols: { parentId: number | 'root'; selected: number | null }[] = [
            { parentId: 'root', selected: activePath[0] || null },
        ];
        for (let i = 0; i < activePath.length; i++) {
            const cur = activePath[i];
            const kids = childrenMap.get(cur);
            if (kids && kids.length > 0) {
                cols.push({ parentId: cur, selected: activePath[i + 1] || null });
            }
        }
        return cols;
    }, [activePath, childrenMap]);

    // ── Filter out the excluded id (prevents selecting self as parent). ──
    const getOptions = (parentId: number | 'root') => {
        const all = childrenMap.get(parentId) || [];
        return excludeId ? all.filter(o => o.id !== excludeId) : all;
    };

    // Render every column as a uniform row inside one bordered container
    // so the picker reads as a single grid (no row visually heavier than
    // another, no per-row border duplication).
    const renderableCols = columns
        .map((col, index) => ({ col, index, options: getOptions(col.parentId) }))
        .filter(c => c.options.length > 0);

    return (
        <div
            className="rounded-xl overflow-hidden"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
            }}
        >
            {renderableCols.map(({ col, index, options }, rowIdx) => {
                const isRoot = index === 0;
                const levelLabel = isRoot ? 'Main' : `L${index + 1}`;
                const isLast = rowIdx === renderableCols.length - 1;

                return (
                    <div
                        key={col.parentId}
                        className="grid items-stretch"
                        style={{
                            gridTemplateColumns: '64px 1fr',
                            borderBottom: isLast
                                ? 'none'
                                : '1px solid color-mix(in srgb, var(--app-border) 70%, transparent)',
                            // Uniform row height — every row is the same
                            // 38px regardless of which level it is.
                            minHeight: '38px',
                        }}
                    >
                        {/* Level badge cell — fixed width, vertically centered */}
                        <div
                            className="flex items-center justify-center gap-1 text-tp-xxs font-bold uppercase tracking-wider"
                            style={{
                                background: col.selected
                                    ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--app-muted-foreground) 6%, transparent)',
                                color: col.selected
                                    ? 'var(--app-primary)'
                                    : 'var(--app-muted-foreground)',
                                borderRight: '1px solid color-mix(in srgb, var(--app-border) 70%, transparent)',
                            }}
                        >
                            {isRoot ? <FolderTree size={10} /> : <Layers size={10} />}
                            <span>{levelLabel}</span>
                        </div>

                        {/* Select cell — borderless, themed chevron, same
                             height as the badge cell so rows stay uniform. */}
                        <div className="relative">
                            <select
                                className="w-full h-full appearance-none text-tp-sm font-bold pl-3 pr-8 outline-none bg-transparent"
                                style={{
                                    color: col.selected
                                        ? 'var(--app-foreground)'
                                        : 'var(--app-muted-foreground)',
                                }}
                                value={col.selected || ''}
                                onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                    onSelect(val);
                                }}
                            >
                                <option value="">
                                    {isRoot ? 'Pick a top-level category…' : 'Pick a sub-category…'}
                                </option>
                                {options.map(opt => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                size={13}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                style={{ color: 'var(--app-muted-foreground)' }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
