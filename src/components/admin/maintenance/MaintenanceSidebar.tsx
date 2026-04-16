'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
    ChevronRight, ChevronDown, Folder, Tag,
    Package, Globe, Ruler, Database, Search,
    ChevronsUpDown, ChevronsDownUp
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

type MaintenanceEntity = {
    id: number;
    name: string;
    count: number;
    children?: MaintenanceEntity[];
    [key: string]: any;
};

type Props = {
    entities: MaintenanceEntity[];
    type: string;
    activeId: number | null;
};

const TypeIcon = ({ type, size = 16 }: { type: string; size?: number }) => {
    switch (type) {
        case 'category': return <Folder size={size} />;
        case 'brand': return <Tag size={size} />;
        case 'unit': return <Ruler size={size} />;
        case 'country': return <Globe size={size} />;
        case 'attribute': return <Package size={size} />;
        default: return <Database size={size} />;
    }
};

function countAll(list: MaintenanceEntity[]): number {
    let c = 0;
    for (const item of list) {
        c++;
        if (item.children) c += countAll(item.children);
    }
    return c;
}

function getAllIds(list: MaintenanceEntity[]): number[] {
    const ids: number[] = [];
    for (const item of list) {
        ids.push(item.id);
        if (item.children) ids.push(...getAllIds(item.children));
    }
    return ids;
}

export function MaintenanceSidebar({ entities, type, activeId }: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [allExpanded, setAllExpanded] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);
    const isTree = type === 'category';

    // Reset search when type changes
    useEffect(() => { setSearchTerm(''); setExpandedIds(new Set()); setAllExpanded(false); }, [type]);

    // Flat List Filtering
    const filteredEntities = useMemo(() => {
        if (isTree) return entities;
        if (!searchTerm.trim()) return entities;
        return entities.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [entities, searchTerm, isTree]);

    const totalCount = countAll(entities);

    // Toggle expand all for tree
    const toggleExpandAll = () => {
        if (allExpanded) {
            setExpandedIds(new Set());
            setAllExpanded(false);
        } else {
            setExpandedIds(new Set(getAllIds(entities)));
            setAllExpanded(true);
        }
    };

    // Keyboard: Ctrl+K focuses search
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    return (
        <div
            className="w-72 md:w-80 flex flex-col h-full flex-shrink-0"
            style={{
                borderRight: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
            }}
        >
            {/* Header */}
            <div
                className="flex-shrink-0 px-4 py-3"
                style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                }}
            >
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                color: 'var(--app-primary)',
                            }}
                        >
                            <TypeIcon type={type} size={12} />
                        </div>
                        <h2 className="text-[12px] font-black text-app-foreground uppercase tracking-wider capitalize">
                            {type} Browser
                        </h2>
                    </div>
                    <span
                        className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                        }}
                    >
                        {totalCount}
                    </span>
                </div>
                <p className="text-[10px] font-bold text-app-muted-foreground">
                    Select {type} to manage products
                </p>
            </div>

            {/* Search Bar */}
            <div
                className="flex-shrink-0 px-3 py-2.5"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}
            >
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder={`Search ${type}s... (Ctrl+K)`}
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-[11px] font-bold bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-1 focus:ring-app-primary/10 outline-none transition-all"
                        />
                    </div>
                    {isTree && (
                        <button
                            onClick={toggleExpandAll}
                            className="p-1.5 rounded-lg flex-shrink-0 transition-all"
                            style={{
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                color: 'var(--app-muted-foreground)',
                            }}
                            title={allExpanded ? 'Collapse all' : 'Expand all'}
                        >
                            {allExpanded ? <ChevronsDownUp size={12} /> : <ChevronsUpDown size={12} />}
                        </button>
                    )}
                </div>
            </div>

            {/* Entity List */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar px-2 py-2 space-y-0.5">
                {isTree ? (
                    filteredEntities.length > 0 ? (
                        filteredEntities.map(node => (
                            <SidebarNode
                                key={node.id}
                                node={node}
                                activeId={activeId}
                                type={type}
                                level={0}
                                expandedIds={expandedIds}
                                setExpandedIds={setExpandedIds}
                                searchTerm={searchTerm}
                            />
                        ))
                    ) : (
                        <SidebarEmpty type={type} />
                    )
                ) : (
                    filteredEntities.length > 0 ? (
                        filteredEntities.map((item) => (
                            <Link
                                key={item.id}
                                href={`/inventory/maintenance?tab=${type}&id=${item.id}`}
                                className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group no-underline"
                                style={{
                                    background: activeId === item.id
                                        ? 'color-mix(in srgb, var(--app-primary) 10%, var(--app-surface))'
                                        : 'transparent',
                                    border: activeId === item.id
                                        ? '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)'
                                        : '1px solid transparent',
                                }}
                            >
                                <span style={{
                                    color: activeId === item.id ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                }}>
                                    <TypeIcon type={type} size={14} />
                                </span>
                                <span className="flex-1 text-[12px] font-bold text-app-foreground truncate">
                                    {item.name}
                                </span>
                                {item.count > 0 && (
                                    <span
                                        className="text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded-md flex-shrink-0"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                                            color: 'var(--app-success)',
                                        }}
                                    >
                                        {item.count}
                                    </span>
                                )}
                            </Link>
                        ))
                    ) : (
                        <SidebarEmpty type={type} />
                    )
                )}
            </div>
        </div>
    );
}

/* ═══════════ Tree Node ═══════════ */
function SidebarNode({
    node, activeId, type, level, expandedIds, setExpandedIds, searchTerm
}: {
    node: MaintenanceEntity;
    activeId: number | null;
    type: string;
    level: number;
    expandedIds: Set<number>;
    setExpandedIds: React.Dispatch<React.SetStateAction<Set<number>>>;
    searchTerm: string;
}) {
    const hasChildren = node.children && node.children.length > 0;
    const isActive = activeId === node.id;
    const isExpanded = expandedIds.has(node.id);
    const isRoot = level === 0;

    // Filter tree nodes by search
    if (searchTerm) {
        const matchesSelf = node.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesChild = hasChildren && node.children!.some(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.children && c.children.some(gc => gc.name.toLowerCase().includes(searchTerm.toLowerCase())))
        );
        if (!matchesSelf && !matchesChild) return null;
    }

    const toggleExpand = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(node.id)) next.delete(node.id);
            else next.add(node.id);
            return next;
        });
    };

    return (
        <div>
            <div
                className="group flex items-center gap-1.5 rounded-xl transition-all duration-150 cursor-pointer"
                style={{
                    paddingLeft: `${8 + level * 16}px`,
                    paddingRight: '8px',
                    paddingTop: isRoot ? '8px' : '5px',
                    paddingBottom: isRoot ? '8px' : '5px',
                    background: isActive
                        ? 'color-mix(in srgb, var(--app-primary) 10%, var(--app-surface))'
                        : 'transparent',
                    borderLeft: isRoot
                        ? (isActive ? '3px solid var(--app-primary)' : '3px solid transparent')
                        : 'none',
                    border: isActive && !isRoot
                        ? '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)'
                        : isRoot
                            ? undefined
                            : '1px solid transparent',
                    marginLeft: isRoot ? 0 : `${level * 4}px`,
                }}
            >
                {/* Toggle */}
                {hasChildren ? (
                    <button
                        onClick={toggleExpand}
                        className="w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0"
                        style={{ color: 'var(--app-muted-foreground)' }}
                    >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                ) : (
                    <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                                background: isActive ? 'var(--app-primary)' : 'var(--app-border)',
                            }}
                        />
                    </div>
                )}

                {/* Link */}
                <Link
                    href={`/inventory/maintenance?tab=${type}&id=${node.id}`}
                    className="flex-1 flex items-center gap-2 truncate no-underline"
                >
                    <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                            background: isRoot
                                ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                : 'color-mix(in srgb, var(--app-border) 25%, transparent)',
                            color: isActive
                                ? 'var(--app-primary)'
                                : isRoot
                                    ? 'var(--app-primary)'
                                    : 'var(--app-muted-foreground)',
                        }}
                    >
                        <Folder size={isRoot ? 12 : 11} />
                    </div>
                    <span className={`truncate text-[12px] ${isRoot ? 'font-bold' : 'font-medium'} text-app-foreground`}>
                        {node.name}
                    </span>
                    {node.count > 0 && (
                        <span
                            className="ml-auto text-[9px] font-black tabular-nums px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                                color: 'var(--app-success)',
                            }}
                        >
                            {node.count}
                        </span>
                    )}
                </Link>
            </div>

            {/* Children */}
            {isExpanded && hasChildren && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children!.map(child => (
                        <SidebarNode
                            key={child.id}
                            node={child}
                            activeId={activeId}
                            type={type}
                            level={level + 1}
                            expandedIds={expandedIds}
                            setExpandedIds={setExpandedIds}
                            searchTerm={searchTerm}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/* ═══════════ Empty State ═══════════ */
function SidebarEmpty({ type }: { type: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <TypeIcon type={type} size={28} />
            <p className="text-[11px] font-bold text-app-muted-foreground mt-2">
                No {type}s found
            </p>
            <p className="text-[10px] text-app-muted-foreground mt-0.5">
                Try a different search term.
            </p>
        </div>
    );
}