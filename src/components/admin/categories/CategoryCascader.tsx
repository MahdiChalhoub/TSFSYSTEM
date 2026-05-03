'use client';

import { useMemo } from 'react';
import { ChevronRight, FolderTree, Layers } from 'lucide-react';

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

    return (
        <div className="space-y-1.5">
            {columns.map((col, index) => {
                const options = getOptions(col.parentId);
                if (options.length === 0) return null;

                const isRoot = index === 0;
                const levelLabel = isRoot ? 'Main' : `L${index + 1}`;

                return (
                    <div
                        key={col.parentId}
                        className="flex items-center gap-2 animate-in fade-in slide-in-from-left-1 duration-150"
                    >
                        {/* Level badge — compact, inline */}
                        <span
                            className="inline-flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-lg text-tp-xxs font-bold uppercase tracking-wider"
                            style={{
                                background: col.selected
                                    ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                    : 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                                color: col.selected ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                border: `1px solid ${col.selected
                                    ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)'
                                    : 'color-mix(in srgb, var(--app-border) 80%, transparent)'}`,
                                minWidth: '46px',
                                justifyContent: 'center',
                            }}
                        >
                            {isRoot ? <FolderTree size={9} /> : <Layers size={9} />}
                            {levelLabel}
                        </span>

                        {/* Slim select — uses theme tokens, custom chevron */}
                        <div className="flex-1 relative">
                            <select
                                className="w-full appearance-none text-tp-sm font-bold pl-3 pr-8 py-2 rounded-lg outline-none transition-all"
                                style={{
                                    background: 'var(--app-surface)',
                                    border: `1px solid ${col.selected
                                        ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)'
                                        : 'var(--app-border)'}`,
                                    color: col.selected ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
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
                            <ChevronRight
                                size={12}
                                className="absolute right-2.5 top-1/2 pointer-events-none rotate-90"
                                style={{
                                    color: 'var(--app-muted-foreground)',
                                    transform: 'translateY(-50%) rotate(90deg)',
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
