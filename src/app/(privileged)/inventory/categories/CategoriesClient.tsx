'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import {
    ChevronRight, ChevronDown, Plus, Folder, FolderOpen,
    RefreshCcw, Eye, EyeOff, Pencil, X, Search, FolderTree,
    Trash2, BarChart3, Layers, Box, GitBranch,
    Maximize2, Minimize2, ChevronsUpDown, ChevronsDownUp, Bookmark, Tag, AlertCircle, Wrench
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { deleteCategory } from '@/app/actions/inventory/categories'
import { buildTree } from '@/lib/utils/tree'
import { CategoryFormModal } from '@/components/admin/categories/CategoryFormModal'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */
interface CategoryNode {
    id: number; name: string; parent: number | null; code?: string; short_name?: string;
    children?: CategoryNode[]; product_count?: number; brand_count?: number; parfum_count?: number; level?: number;
}

/* ═══════════════════════════════════════════════════════════
 *  RECURSIVE TREE NODE (COA-style)
 * ═══════════════════════════════════════════════════════════ */
const CategoryRow = ({
    node, level, onEdit, onAdd, onDelete, searchQuery, forceExpanded,
}: {
    node: CategoryNode; level: number; searchQuery: string; forceExpanded?: boolean;
    onEdit: (n: CategoryNode) => void; onAdd: (parentId?: number) => void; onDelete: (n: CategoryNode) => void;
}) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(forceExpanded ?? level < 2)

    useEffect(() => { if (searchQuery) setIsOpen(true) }, [searchQuery])
    useEffect(() => { if (forceExpanded !== undefined) setIsOpen(forceExpanded) }, [forceExpanded])

    const isRoot = level === 0

    return (
        <div>
            {/* ── ROW ── */}
            <div
                className={`
                    group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-default
                    border-b border-app-border/30
                    ${level === 0
                        ? 'hover:bg-app-surface py-2.5 md:py-3'
                        : 'hover:bg-app-surface/40 py-1.5 md:py-2'
                    }
                `}
                style={{
                    paddingLeft: `${12 + level * 20}px`,
                    paddingRight: '12px',
                    background: isRoot
                        ? 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))'
                        : undefined,
                    borderLeft: isRoot
                        ? '3px solid var(--app-primary)'
                        : level > 0
                            ? '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)'
                            : undefined,
                    marginLeft: level > 0 ? `${12 + (level - 1) * 20 + 10}px` : undefined,
                }}
            >
                {/* Toggle */}
                <button
                    onClick={() => isParent && setIsOpen(!isOpen)}
                    className={`w-5 h-5 flex items-center justify-center rounded-md transition-all flex-shrink-0 ${isParent ? 'hover:bg-app-border/50 text-app-muted-foreground' : 'text-app-border'}`}
                >
                    {isParent ? (
                        isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-primary)' }} />
                    )}
                </button>

                {/* Icon */}
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                        background: isRoot
                            ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                            : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                        color: isRoot ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    }}
                >
                    {isRoot
                        ? <Bookmark size={14} strokeWidth={2.5} />
                        : isParent
                            ? (isOpen ? <FolderOpen size={14} /> : <Folder size={14} />)
                            : <Folder size={13} />}
                </div>

                {/* Code + Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                    {node.code && (
                        <span
                            className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                                background: isRoot
                                    ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)'
                                    : 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                                color: isRoot ? 'var(--app-primary)' : 'var(--app-foreground)',
                            }}
                        >
                            {node.code}
                        </span>
                    )}
                    <span className={`truncate text-[13px] ${isRoot ? 'font-bold text-app-foreground' : 'font-medium text-app-foreground'}`}>
                        {node.name}
                    </span>
                    {node.short_name && (
                        <span className="hidden md:inline text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider bg-app-border/30 px-1.5 py-0.5 rounded flex-shrink-0">
                            {node.short_name}
                        </span>
                    )}
                    {isRoot && (
                        <span
                            className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{
                                background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                color: 'var(--app-primary)',
                                border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                            }}
                        >
                            Root
                        </span>
                    )}
                </div>

                {/* Children count */}
                <div className="hidden sm:flex w-24 flex-shrink-0">
                    <span className="text-[10px] font-bold text-app-muted-foreground">
                        {isParent ? `${node.children!.length} sub` : 'Leaf'}
                    </span>
                </div>

                {/* Products */}
                <div className="hidden sm:flex w-20 flex-shrink-0">
                    {(node.product_count ?? 0) > 0 && (
                        <span
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                            style={{
                                color: 'var(--app-success)',
                                background: 'color-mix(in srgb, var(--app-success) 8%, transparent)',
                            }}
                        >
                            <Box size={10} />
                            {node.product_count}
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(node)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                        <Pencil size={12} />
                    </button>
                    <button onClick={() => onAdd(node.id)} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-primary transition-colors" title="Add sub-category">
                        <Plus size={13} />
                    </button>
                    <button
                        onClick={() => { if (isParent) { toast.error('Delete sub-categories first.'); return; } onDelete(node); }}
                        className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
                        style={{ color: isParent ? 'var(--app-border)' : 'var(--app-muted-foreground)', cursor: isParent ? 'not-allowed' : 'pointer' }}
                        title={isParent ? 'Delete sub-categories first' : 'Delete'}
                    >
                        {isParent ? <AlertCircle size={12} /> : <Trash2 size={12} />}
                    </button>
                </div>
            </div>

            {/* ── CHILDREN ── */}
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                    {node.children!.map((child) => (
                        <CategoryRow
                            key={child.id}
                            node={child}
                            level={level + 1}
                            onEdit={onEdit}
                            onAdd={onAdd}
                            onDelete={onDelete}
                            searchQuery={searchQuery}
                            forceExpanded={forceExpanded}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN VIEWER (COA-style)
 * ═══════════════════════════════════════════════════════════ */
export function CategoriesClient({ initialCategories }: { initialCategories: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [modalState, setModalState] = useState<{ open: boolean; category?: CategoryNode; parentId?: number }>({ open: false })
    const [searchQuery, setSearchQuery] = useState('')
    const [focusMode, setFocusMode] = useState(false)
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined)
    const [expandKey, setExpandKey] = useState(0)
    const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)
    const data = initialCategories

    // ── Keyboard shortcut: Cmd+K to focus search ──
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // ── Build tree with search filter ──
    const { tree, stats } = useMemo(() => {
        let filtered = data

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            filtered = filtered.filter(a =>
                a.name?.toLowerCase().includes(q) ||
                a.code?.toLowerCase().includes(q) ||
                a.short_name?.toLowerCase().includes(q)
            )
        }

        const builtTree = buildTree(filtered)

        const leafCount = filtered.filter(d => !filtered.some(c => c.parent === d.id)).length
        const totalProducts = filtered.reduce((sum: number, d: any) => sum + (d.product_count || 0), 0)

        return {
            tree: builtTree,
            stats: { total: data.length, filtered: filtered.length, roots: builtTree.length, leafCount, totalProducts }
        }
    }, [data, searchQuery])

    // ── Actions ──
    const openAddModal = useCallback((parentId?: number) => {
        setModalState({ open: true, parentId })
    }, [])

    const openEditModal = useCallback((cat: CategoryNode) => {
        setModalState({ open: true, category: cat })
    }, [])

    const requestDelete = useCallback((cat: CategoryNode) => {
        setDeleteTarget(cat)
    }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        startTransition(async () => {
            const result = await deleteCategory(deleteTarget.id)
            if (result?.success) {
                toast.success(`"${deleteTarget.name}" deleted`)
                router.refresh()
            } else {
                toast.error(result?.message || 'Failed to delete')
            }
            setDeleteTarget(null)
        })
    }

    const closeModal = useCallback(() => {
        setModalState({ open: false })
    }, [])

    return (
        <div className={`flex flex-col animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}
            style={{ height: '100%' }}>

            {/* ═══════════════════════════════════════════════════════
             *  HEADER
             * ═══════════════════════════════════════════════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    /* ── FOCUS MODE: Compact bar ── */
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}>
                                <FolderTree size={14} style={{ color: '#fff' }} />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Categories</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground">{stats.filtered}/{stats.total}</span>
                        </div>

                        <div className="flex-1 relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                            <input
                                ref={searchRef}
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all"
                            />
                        </div>

                        <button onClick={() => openAddModal()}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <Plus size={12} /><span className="hidden sm:inline">New</span>
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    /* ── NORMAL MODE: Full header ── */
                    <>
                        {/* Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                                    <FolderTree size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Categories</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {stats.total} Nodes · Hierarchical Tree
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <Link
                                    href="/inventory/maintenance?tab=category"
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Wrench size={13} />
                                    <span className="hidden md:inline">Cleanup</span>
                                </Link>
                                <button
                                    onClick={() => openAddModal()}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">New Category</span>
                                </button>
                                <button onClick={() => setFocusMode(true)} title="Focus mode — maximize tree"
                                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Strip */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { label: 'Root', value: stats.roots, icon: <FolderTree size={11} />, color: 'var(--app-primary)' },
                                { label: 'Leaf', value: stats.leafCount, icon: <GitBranch size={11} />, color: '#8b5cf6' },
                                { label: 'Total', value: stats.total, icon: <Layers size={11} />, color: 'var(--app-info)' },
                                { label: 'Products', value: stats.totalProducts, icon: <Box size={11} />, color: 'var(--app-success)' },
                            ].map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Search Bar */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search by name, code, or short name... (Ctrl+K)"
                                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            {/* Expand / Collapse All */}
                            <button
                                onClick={() => { setExpandAll(prev => !prev); setExpandKey(k => k + 1) }}
                                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                {expandAll ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                <span className="hidden sm:inline">{expandAll ? 'Collapse' : 'Expand'}</span>
                            </button>

                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')}
                                    className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════
             *  CATEGORY FORM MODAL (popup)
             * ═══════════════════════════════════════════════════════ */}
            <CategoryFormModal
                isOpen={modalState.open}
                onClose={closeModal}
                category={modalState.category}
                parentId={modalState.parentId}
                potentialParents={data}
            />

            {/* ═══════════════════════════════════════════════════════
             *  TREE TABLE
             * ═══════════════════════════════════════════════════════ */}
            <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
                {/* Column Headers */}
                <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
                    <div className="w-5 flex-shrink-0" />
                    <div className="w-7 flex-shrink-0" />
                    <div className="flex-1 min-w-0">Category</div>
                    <div className="hidden sm:block w-24 flex-shrink-0">Children</div>
                    <div className="hidden sm:block w-20 flex-shrink-0">Products</div>
                    <div className="w-16 flex-shrink-0" />
                </div>

                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                    {tree.length > 0 ? (
                        tree.map((node) => (
                            <CategoryRow
                                key={`${node.id}-${expandKey}`}
                                node={node}
                                level={0}
                                onEdit={openEditModal}
                                onAdd={openAddModal}
                                onDelete={requestDelete}
                                searchQuery={searchQuery}
                                forceExpanded={expandAll}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                                style={{
                                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 15%, transparent), color-mix(in srgb, var(--app-primary) 5%, transparent))',
                                    border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                <FolderTree size={28} style={{ color: 'var(--app-primary)', opacity: 0.7 }} />
                            </div>
                            <p className="text-base font-bold text-app-muted-foreground mb-1">
                                {searchQuery ? 'No matching categories' : 'No categories defined yet'}
                            </p>
                            <p className="text-xs text-app-muted-foreground mb-6 max-w-xs">
                                {searchQuery
                                    ? 'Try a different search term or clear filters.'
                                    : 'Create a root category to start organizing your product catalog.'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={() => openAddModal()}
                                    className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all"
                                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={16} className="inline mr-1.5" />Create First Category
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Delete Confirm ── */}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleConfirmDelete}
                title={`Delete "${deleteTarget?.name}"?`}
                description="This will permanently remove this category. Make sure it has no products assigned."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    )
}
