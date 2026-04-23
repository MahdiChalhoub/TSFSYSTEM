'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import {
    ChevronRight, Folder, FolderOpen, Tag, Package, Globe, Ruler, Database,
    Search, ChevronsUpDown, ChevronsDownUp, X, Bookmark,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'

/* ═══════════════════════════════════════════════════════════
 *  MaintenanceSidebar — entity picker on the left of the
 *  reorganize tool. Reuses the V2 design tokens + row pattern
 *  from CategoryRow so it feels native alongside the main
 *  Categories page.
 * ═══════════════════════════════════════════════════════════ */

type MaintenanceEntity = {
    id: number
    name: string
    count: number
    children?: MaintenanceEntity[]
    [key: string]: any
}

type Props = {
    entities: MaintenanceEntity[]
    type: string
    activeId: number | null
}

const TYPE_META: Record<string, { color: string; Icon: any }> = {
    category: { color: 'var(--app-primary)', Icon: Folder },
    brand: { color: 'var(--app-info)', Icon: Tag },
    attribute: { color: 'var(--app-warning)', Icon: Package },
    unit: { color: 'var(--app-success)', Icon: Ruler },
    country: { color: '#8b5cf6', Icon: Globe },
}

function countAll(list: MaintenanceEntity[]): number {
    let c = 0
    for (const item of list) {
        c++
        if (item.children) c += countAll(item.children)
    }
    return c
}
function getAllIds(list: MaintenanceEntity[]): number[] {
    const ids: number[] = []
    for (const item of list) {
        ids.push(item.id)
        if (item.children) ids.push(...getAllIds(item.children))
    }
    return ids
}
function matchesSearch(item: MaintenanceEntity, needle: string): boolean {
    if (!needle) return true
    if (item.name?.toLowerCase().includes(needle)) return true
    if (item.children) return item.children.some(c => matchesSearch(c, needle))
    return false
}

export function MaintenanceSidebar({ entities, type, activeId }: Props) {
    const searchParams = useSearchParams()
    const [searchTerm, setSearchTerm] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())
    const [allExpanded, setAllExpanded] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)
    const isTree = type === 'category'
    const meta = TYPE_META[type] || TYPE_META.category

    useEffect(() => {
        setSearchTerm(''); setExpandedIds(new Set()); setAllExpanded(false)
    }, [type])

    useEffect(() => {
        if (!isTree || !searchTerm.trim()) return
        setExpandedIds(new Set(getAllIds(entities)))
    }, [searchTerm, isTree, entities])

    useEffect(() => {
        if (!activeId || !isTree) return
        const path: number[] = []
        const find = (list: MaintenanceEntity[], target: number, chain: number[]): boolean => {
            for (const item of list) {
                const next = [...chain, item.id]
                if (item.id === target) { path.push(...chain); return true }
                if (item.children && find(item.children, target, next)) return true
            }
            return false
        }
        find(entities, activeId, [])
        if (path.length) setExpandedIds(prev => new Set([...prev, ...path]))
    }, [activeId, entities, isTree])

    const filtered = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase()
        if (!needle) return entities
        if (isTree) return entities.filter(e => matchesSearch(e, needle))
        return entities.filter(e => e.name?.toLowerCase().includes(needle))
    }, [entities, searchTerm, isTree])

    const total = countAll(entities)
    const filteredTotal = countAll(filtered)

    const toggleExpandAll = () => {
        if (allExpanded) { setExpandedIds(new Set()); setAllExpanded(false) }
        else { setExpandedIds(new Set(getAllIds(entities))); setAllExpanded(true) }
    }

    return (
        <div className="flex flex-col h-full">
            {/* ── Header: search + expand/collapse ── */}
            <div className="flex-shrink-0 p-3 space-y-2"
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                            style={{ color: 'var(--app-muted-foreground)' }} />
                        <input ref={searchRef} type="text" value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={`Search ${type}…`}
                            className="w-full pl-8 pr-8 py-1.5 text-tp-sm rounded-lg outline-none transition-all"
                            style={{
                                background: 'var(--app-background)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)',
                            }} />
                        {searchTerm && (
                            <button onClick={() => { setSearchTerm(''); searchRef.current?.focus() }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-app-border/40">
                                <X size={12} style={{ color: 'var(--app-muted-foreground)' }} />
                            </button>
                        )}
                    </div>
                    {isTree && (
                        <button onClick={toggleExpandAll}
                            className="p-1.5 rounded-lg transition-all flex-shrink-0"
                            title={allExpanded ? 'Collapse all' : 'Expand all'}
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                color: 'var(--app-primary)',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                            }}>
                            {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                        </button>
                    )}
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-tp-xxs font-black uppercase tracking-widest"
                        style={{ color: 'var(--app-muted-foreground)' }}>
                        {searchTerm ? `${filteredTotal} of ${total}` : `${total} total`}
                    </span>
                </div>
            </div>

            {/* ── Tree / list body ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-3 text-center">
                        <Database size={22} className="mb-2 opacity-40"
                            style={{ color: 'var(--app-muted-foreground)' }} />
                        <p className="text-tp-sm font-bold"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            {searchTerm ? 'No matches' : 'No entries'}
                        </p>
                    </div>
                ) : isTree ? (
                    filtered.map(item => (
                        <TreeRow key={item.id} item={item} level={0} activeId={activeId}
                            type={type} expandedIds={expandedIds} setExpandedIds={setExpandedIds}
                            searchParams={searchParams} meta={meta} />
                    ))
                ) : (
                    filtered.map(item => (
                        <FlatRow key={item.id} item={item} active={item.id === activeId}
                            type={type} searchParams={searchParams} meta={meta} />
                    ))
                )}
            </div>
        </div>
    )
}

/* ─── Tree row (categories) ─── */
function TreeRow({
    item, level, activeId, type, expandedIds, setExpandedIds, searchParams, meta,
}: {
    item: MaintenanceEntity; level: number; activeId: number | null
    type: string; expandedIds: Set<number>
    setExpandedIds: (fn: (s: Set<number>) => Set<number>) => void
    searchParams: any; meta: { color: string; Icon: any }
}) {
    const hasChildren = item.children && item.children.length > 0
    const isOpen = expandedIds.has(item.id)
    const isActive = item.id === activeId
    const isRoot = level === 0

    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('tab', type); params.set('id', String(item.id))

    const toggle = (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        setExpandedIds(prev => {
            const next = new Set(prev)
            next.has(item.id) ? next.delete(item.id) : next.add(item.id)
            return next
        })
    }

    return (
        <div>
            <Link href={`/inventory/maintenance?${params.toString()}`}
                className="group flex items-center gap-2 py-2 cursor-pointer transition-colors relative no-underline"
                style={{
                    paddingLeft: `${12 + level * 18}px`, paddingRight: 12,
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                    background: isActive
                        ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                        : undefined,
                }}>
                {isActive && (
                    <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r-full"
                        style={{ background: meta.color }} />
                )}
                <button onClick={toggle}
                    className="w-5 h-5 flex items-center justify-center rounded-md flex-shrink-0">
                    {hasChildren ? (
                        <ChevronRight size={13}
                            className="transition-transform duration-200"
                            style={{
                                transform: isOpen ? 'rotate(90deg)' : 'none',
                                color: isOpen ? meta.color : 'var(--app-muted-foreground)',
                            }} />
                    ) : (
                        <div className="w-1 h-1 rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
                    )}
                </button>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isRoot
                            ? `color-mix(in srgb, ${meta.color} 15%, transparent)`
                            : 'color-mix(in srgb, var(--app-border) 18%, transparent)',
                        color: isRoot ? meta.color : 'var(--app-muted-foreground)',
                    }}>
                    {isRoot ? <Bookmark size={11} />
                        : hasChildren ? (isOpen ? <FolderOpen size={11} /> : <Folder size={11} />)
                            : <Folder size={11} />}
                </div>
                <span className={`flex-1 min-w-0 truncate text-tp-sm ${isActive ? 'font-bold' : 'font-medium'}`}
                    style={{ color: isActive ? meta.color : 'var(--app-foreground)' }}>
                    {item.name}
                </span>
                <span className="text-tp-xxs font-bold tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded-full"
                    style={{
                        background: item.count > 0
                            ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                            : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                        color: item.count > 0 ? meta.color : 'var(--app-muted-foreground)',
                    }}>
                    {item.count ?? 0}
                </span>
            </Link>
            {hasChildren && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {item.children!.map(child => (
                        <TreeRow key={child.id} item={child} level={level + 1}
                            activeId={activeId} type={type}
                            expandedIds={expandedIds} setExpandedIds={setExpandedIds}
                            searchParams={searchParams} meta={meta} />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ─── Flat row (brands / attributes / units / countries) ─── */
function FlatRow({ item, active, type, searchParams, meta }: {
    item: MaintenanceEntity; active: boolean; type: string
    searchParams: any; meta: { color: string; Icon: any }
}) {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('tab', type); params.set('id', String(item.id))
    const Icon = meta.Icon
    return (
        <Link href={`/inventory/maintenance?${params.toString()}`}
            className="flex items-center gap-2 py-2 px-3 transition-colors relative no-underline"
            style={{
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 25%, transparent)',
                background: active
                    ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                    : undefined,
            }}>
            {active && (
                <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r-full"
                    style={{ background: meta.color }} />
            )}
            <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
                    color: meta.color,
                }}>
                <Icon size={11} />
            </div>
            <span className={`flex-1 min-w-0 truncate text-tp-sm ${active ? 'font-bold' : 'font-medium'}`}
                style={{ color: active ? meta.color : 'var(--app-foreground)' }}>
                {item.name}
            </span>
            <span className="text-tp-xxs font-bold tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded-full"
                style={{
                    background: item.count > 0
                        ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                        : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                    color: item.count > 0 ? meta.color : 'var(--app-muted-foreground)',
                }}>
                {item.count ?? 0}
            </span>
        </Link>
    )
}
