'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
    Plus, Search, X, Pencil, Trash2, ChevronDown, ChevronRight,
    Sparkles, Factory, Globe, Package, Layers, Tag, Hash,
    Wrench, Maximize2, Minimize2, ChevronsUpDown, ChevronsDownUp,
    Loader2
} from 'lucide-react';
import { getAttributeHierarchy } from '@/app/actions/attributes';
import { AttributeFormModal } from './AttributeFormModal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { deleteAttribute } from '@/app/actions/attributes';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';

type AttributeManagerProps = {
    attributes: Record<string, any>[];
    categories: Record<string, any>[];
};

export function AttributeManager({ attributes = [], categories = [] }: AttributeManagerProps) {
    const router = useRouter()
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAttribute, setEditingAttribute] = useState<Record<string, any> | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Record<string, any> | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [allExpanded, setAllExpanded] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    const searchRef = useRef<HTMLInputElement>(null);

    // Ctrl+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [])

    // Filter
    const filtered = useMemo(() => {
        return attributes.filter(a => {
            const q = searchQuery.toLowerCase()
            const matchesSearch = !searchQuery.trim() ||
                a.name?.toLowerCase().includes(q) ||
                a.short_name?.toLowerCase().includes(q)
            const matchesCategory = selectedCategory === 'all' ||
                (a.categories && a.categories.some((c: Record<string, any>) => c.id === Number(selectedCategory)));
            return matchesSearch && matchesCategory;
        })
    }, [attributes, searchQuery, selectedCategory])

    // Stats
    const stats = useMemo(() => ({
        total: attributes.length,
        filtered: filtered.length,
        totalProducts: attributes.reduce((s: number, a: any) => s + (a.product_count || 0), 0),
        totalCategories: new Set(attributes.flatMap((a: any) => (a.categories || []).map((c: any) => c.id))).size,
        universal: attributes.filter(a => !a.categories || a.categories.length === 0).length,
    }), [attributes, filtered])

    const openAdd = useCallback(() => { setEditingAttribute(null); setIsModalOpen(true) }, [])
    const openEdit = useCallback((a: any) => { setEditingAttribute(a); setIsModalOpen(true) }, [])

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return
        try {
            const fd = new FormData()
            const result = await deleteAttribute(deleteTarget.id, { message: '' }, fd)
            if (result?.message === 'success') {
                toast.success(`"${deleteTarget.name}" deleted`)
                router.refresh()
            } else {
                toast.error(result?.message || 'Failed to delete')
            }
        } catch {
            toast.error('Failed to delete attribute')
        }
        setDeleteTarget(null)
    }

    return (
        <div className={`flex flex-col animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`} style={{ height: '100%' }}>

            {/* ═══════════════ HEADER ═══════════════ */}
            <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>

                {focusMode ? (
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-warning)' }}>
                                <Sparkles size={14} style={{ color: '#fff' }} />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Attributes</span>
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

                        <button onClick={openAdd}
                            className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
                            <Plus size={12} /><span className="hidden sm:inline">New</span>
                        </button>

                        <button onClick={() => setFocusMode(false)} title="Exit focus mode"
                            className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
                            <Minimize2 size={13} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="page-header-icon" style={{ background: 'var(--app-warning)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                                    <Sparkles size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Attributes</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                        {stats.total} Attributes · Scents, Flavors & Variants
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <Link
                                    href="/inventory/maintenance?tab=attribute"
                                    className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"
                                >
                                    <Wrench size={13} />
                                    <span className="hidden md:inline">Cleanup</span>
                                </Link>
                                <button
                                    onClick={openAdd}
                                    className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                                    style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                                >
                                    <Plus size={14} />
                                    <span className="hidden sm:inline">New Attribute</span>
                                </button>
                                <button onClick={() => setFocusMode(true)} title="Focus mode — maximize content"
                                    className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                                    <Maximize2 size={13} />
                                </button>
                            </div>
                        </div>

                        {/* KPI Strip */}
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                            {[
                                { label: 'Total', value: stats.total, icon: <Sparkles size={11} />, color: 'var(--app-warning)' },
                                { label: 'Products', value: stats.totalProducts, icon: <Package size={11} />, color: 'var(--app-success)' },
                                { label: 'Categories', value: stats.totalCategories, icon: <Tag size={11} />, color: 'var(--app-accent, #8b5cf6)' },
                                { label: 'Universal', value: stats.universal, icon: <Globe size={11} />, color: 'var(--app-info)' },
                                { label: 'Showing', value: stats.filtered, icon: <Search size={11} />, color: 'var(--app-muted-foreground)' },
                            ].map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl transition-all text-left"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    }}
                                >
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                        {s.icon}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Search + Filters */}
                        <div className="flex items-center gap-2">
                            <div className="flex-1 relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search attributes by name or code... (Ctrl+K)"
                                    className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
                                />
                            </div>

                            {/* Category filter */}
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="text-[11px] font-bold px-2.5 py-2 rounded-xl border appearance-none outline-none flex-shrink-0 max-w-[140px]"
                                style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)', color: 'var(--app-foreground)' }}
                            >
                                <option value="all">All Categories</option>
                                {categories.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>

                            {/* View toggle */}
                            <div className="flex rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--app-border)' }}>
                                <button onClick={() => setViewMode('list')}
                                    className="p-2 text-[11px] transition-all"
                                    style={{
                                        background: viewMode === 'list' ? 'var(--app-primary)' : 'transparent',
                                        color: viewMode === 'list' ? '#fff' : 'var(--app-muted-foreground)',
                                    }}
                                    title="List view"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                                </button>
                                <button onClick={() => setViewMode('grid')}
                                    className="p-2 text-[11px] transition-all"
                                    style={{
                                        background: viewMode === 'grid' ? 'var(--app-primary)' : 'transparent',
                                        color: viewMode === 'grid' ? '#fff' : 'var(--app-muted-foreground)',
                                    }}
                                    title="Grid view"
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
                                </button>
                            </div>

                            <button
                                onClick={() => {
                                    if (allExpanded) { setExpandedIds(new Set()); setAllExpanded(false) }
                                    else { setExpandedIds(new Set(filtered.map(a => a.id))); setAllExpanded(true) }
                                }}
                                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl border transition-all flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)',
                                    color: 'var(--app-primary)',
                                    borderColor: 'color-mix(in srgb, var(--app-primary) 20%, transparent)',
                                }}
                            >
                                {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
                                <span className="hidden sm:inline">{allExpanded ? 'Collapse' : 'Expand'}</span>
                            </button>

                            {(searchQuery || selectedCategory !== 'all') && (
                                <button onClick={() => { setSearchQuery(''); setSelectedCategory('all') }}
                                    className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                                    style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* ═══════════════ FORM MODAL ═══════════════ */}
            <AttributeFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} attribute={editingAttribute} categories={categories} />

            {/* ═══════════════ DELETE DIALOG ═══════════════ */}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleConfirmDelete}
                title={`Delete "${deleteTarget?.name}"?`}
                description="This will permanently remove this attribute. Products using it may be affected."
                confirmText="Delete"
                variant="danger"
            />

            {/* ═══════════════ CONTENT ═══════════════ */}
            <div className="flex-1 min-h-0 rounded-2xl overflow-hidden flex flex-col"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 30%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>

                {viewMode === 'list' ? (
                    <>
                        {/* Column Headers */}
                        <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                            <div className="w-5 flex-shrink-0" />
                            <div className="w-7 flex-shrink-0" />
                            <div className="flex-1 min-w-0">Attribute</div>
                            <div className="hidden md:block w-36 flex-shrink-0">Categories</div>
                            <div className="hidden sm:block w-16 flex-shrink-0">Products</div>
                            <div className="w-14 flex-shrink-0" />
                        </div>

                        {/* List Body */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
                            {filtered.length > 0 ? (
                                filtered.map(attr => (
                                    <AttributeRow
                                        key={attr.id}
                                        attribute={attr}
                                        onEdit={openEdit}
                                        onDelete={setDeleteTarget}
                                        isExpanded={expandedIds.has(attr.id)}
                                        onToggle={() => {
                                            setExpandedIds(prev => {
                                                const next = new Set(prev)
                                                if (next.has(attr.id)) next.delete(attr.id)
                                                else next.add(attr.id)
                                                return next
                                            })
                                        }}
                                    />
                                ))
                            ) : (
                                <EmptyState searchQuery={searchQuery} onAdd={openAdd} />
                            )}
                        </div>
                    </>
                ) : (
                    /* Grid Body */
                    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar p-4">
                        {filtered.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {filtered.map(attr => (
                                    <AttributeCard key={attr.id} attribute={attr} onEdit={openEdit} onDelete={setDeleteTarget} />
                                ))}
                            </div>
                        ) : (
                            <EmptyState searchQuery={searchQuery} onAdd={openAdd} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
 *  ATTRIBUTE CARD (Grid View)
 * ═══════════════════════════════════════════════════════════ */
function AttributeCard({ attribute, onEdit, onDelete }: { attribute: any, onEdit: (a: any) => void, onDelete: (a: any) => void }) {
    return (
        <div className="group rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl cursor-pointer h-full flex flex-col"
            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}
            onClick={() => onEdit(attribute)}
        >
            {/* Top accent */}
            <div className="h-1 w-full" style={{ background: 'var(--app-warning)' }} />

            <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>
                        <Sparkles size={18} />
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); onEdit(attribute) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                            <Pencil size={12} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); onDelete(attribute) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground transition-colors" title="Delete">
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>

                <h3 className="text-[14px] font-bold text-app-foreground mb-0.5 truncate">{attribute.name}</h3>
                {attribute.short_name && (
                    <span className="text-[10px] font-mono font-bold text-app-muted-foreground mb-2">{attribute.short_name}</span>
                )}

                <div className="mt-auto flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                    <div className="flex flex-wrap gap-1 max-w-[80%]">
                        {attribute.categories?.slice(0, 3).map((c: any) => (
                            <span key={c.id} className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-accent, #8b5cf6) 8%, transparent)', color: 'var(--app-accent, #8b5cf6)', border: '1px solid color-mix(in srgb, var(--app-accent, #8b5cf6) 15%, transparent)' }}>
                                {c.name}
                            </span>
                        ))}
                        {(attribute.categories?.length || 0) > 3 && (
                            <span className="text-[8px] font-bold text-app-muted-foreground">+{attribute.categories.length - 3}</span>
                        )}
                        {(!attribute.categories || attribute.categories.length === 0) && (
                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                                style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', color: 'var(--app-info)' }}>
                                <Globe size={8} className="inline mr-0.5" />Universal
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold"
                        style={{ color: (attribute.product_count || 0) > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)' }}>
                        <Package size={10} />
                        <span>{attribute.product_count || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
 *  ATTRIBUTE ROW (List View — Expandable)
 * ═══════════════════════════════════════════════════════════ */
function AttributeRow({ attribute, onEdit, onDelete, isExpanded, onToggle }: {
    attribute: any, onEdit: (a: any) => void, onDelete: (a: any) => void, isExpanded: boolean, onToggle: () => void
}) {
    const [data, setData] = useState<any[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isExpanded && !data) {
            setIsLoading(true)
            getAttributeHierarchy(attribute.id).then(res => {
                setData(res)
                setIsLoading(false)
            })
        }
    }, [isExpanded, data, attribute.id])

    const productCount = attribute.product_count || 0

    return (
        <div>
            <div
                className="group flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2.5 md:py-3 border-b transition-all duration-150 cursor-pointer hover:bg-app-surface"
                style={{ borderColor: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}
                onClick={onToggle}
            >
                {/* Toggle */}
                <button className="w-5 h-5 flex items-center justify-center rounded-md text-app-muted-foreground transition-all flex-shrink-0">
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>

                {/* Icon */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black uppercase overflow-hidden flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-warning)' }}>
                    <Sparkles size={16} />
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-[13px] font-bold text-app-foreground truncate">{attribute.name}</span>
                    {attribute.short_name && (
                        <span className="hidden md:inline text-[9px] font-mono font-bold text-app-muted-foreground bg-app-border/30 px-1.5 py-0.5 rounded flex-shrink-0">{attribute.short_name}</span>
                    )}
                    {(!attribute.categories || attribute.categories.length === 0) && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)', border: '1px solid color-mix(in srgb, var(--app-info) 20%, transparent)' }}>
                            Universal
                        </span>
                    )}
                </div>

                {/* Categories */}
                <div className="hidden md:flex w-36 flex-shrink-0 flex-wrap gap-0.5">
                    {attribute.categories?.slice(0, 2).map((c: any) => (
                        <span key={c.id} className="text-[8px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--app-accent, #8b5cf6) 8%, transparent)', color: 'var(--app-accent, #8b5cf6)' }}>
                            {c.name}
                        </span>
                    ))}
                    {(attribute.categories?.length || 0) > 2 && (
                        <span className="text-[8px] font-bold text-app-muted-foreground">+{attribute.categories.length - 2}</span>
                    )}
                </div>

                {/* Products */}
                <div className="hidden sm:flex w-16 flex-shrink-0">
                    <span className="text-[10px] font-bold flex items-center gap-1"
                        style={{ color: productCount > 0 ? 'var(--app-success)' : 'var(--app-muted-foreground)', opacity: productCount > 0 ? 1 : 0.5 }}>
                        <Package size={10} /> {productCount}
                    </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={e => { e.stopPropagation(); onEdit(attribute) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="Edit">
                        <Pencil size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); onDelete(attribute) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground transition-colors" title="Delete">
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Expanded Hierarchy */}
            {isExpanded && (
                <div className="animate-in slide-in-from-top-1 duration-150">
                    <AttributeHierarchy data={data} isLoading={isLoading} />
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
 *  ATTRIBUTE HIERARCHY (Expansion Panel)
 * ═══════════════════════════════════════════════════════════ */
function AttributeHierarchy({ data, isLoading }: { data: any[] | null, isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-6 gap-2" style={{ background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                <span className="text-[11px] font-bold text-app-muted-foreground">Loading hierarchy...</span>
            </div>
        )
    }
    if (!data || data.length === 0) {
        return (
            <div className="py-4 px-6 text-center" style={{ background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                <span className="text-[11px] text-app-muted-foreground italic">No products found with this attribute.</span>
            </div>
        )
    }

    return (
        <div className="px-4 py-3 space-y-3" style={{ background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
            {data.map((brand: any) => (
                <div key={brand.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--app-border)', background: 'var(--app-surface)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-accent, #8b5cf6) 5%, var(--app-surface))' }}>
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-accent, #8b5cf6) 12%, transparent)', color: 'var(--app-accent, #8b5cf6)' }}>
                                <Factory size={12} />
                            </div>
                            <span className="text-[12px] font-black text-app-foreground">{brand.name}</span>
                            <span className="text-[9px] font-bold text-app-muted-foreground">{brand.products?.length || 0} products</span>
                        </div>
                        <span className="text-[10px] font-black tabular-nums"
                            style={{ color: 'var(--app-success)' }}>
                            Stock: {brand.totalStock ?? (brand.products?.reduce((acc: number, p: any) => acc + (p.stock || 0), 0) || 0)}
                        </span>
                    </div>
                    <div className="divide-y divide-app-border/30">
                        {brand.products?.map((p: any) => (
                            <div key={p.id} className="flex items-center justify-between px-4 py-2 hover:bg-app-surface/60 transition-all">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-black"
                                        style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                        {p.country_name?.substring(0, 2) || 'WW'}
                                    </div>
                                    <div>
                                        <span className="text-[11px] font-bold text-app-foreground">{p.name} {p.size && `– ${p.size}${p.unit_name || ''}`}</span>
                                        {p.country_name && (
                                            <span className="text-[9px] text-app-muted-foreground ml-2 flex items-center gap-0.5 inline-flex">
                                                <Globe size={8} /> {p.country_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-[12px] font-black tabular-nums ${p.stock > 0 ? 'text-app-foreground' : 'text-app-error'}`}>
                                    {p.stock ?? 0}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  EMPTY STATE
 * ═══════════════════════════════════════════════════════════ */
function EmptyState({ searchQuery, onAdd }: { searchQuery: string, onAdd: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{
                    background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-warning) 15%, transparent), rgba(245, 158, 11, 0.05))',
                    border: '1px solid color-mix(in srgb, var(--app-warning) 20%, transparent)',
                }}>
                <Sparkles size={28} style={{ color: 'var(--app-warning)', opacity: 0.7 }} />
            </div>
            <p className="text-base font-bold text-app-muted-foreground mb-1">
                {searchQuery ? 'No matching attributes' : 'No attributes defined yet'}
            </p>
            <p className="text-xs text-app-muted-foreground mb-6 max-w-xs">
                {searchQuery ? 'Try a different search term or clear filters.' : 'Create an attribute like "Vanilla" or "Mint" to get started.'}
            </p>
            {!searchQuery && (
                <button onClick={onAdd}
                    className="px-4 py-2 rounded-xl bg-app-primary text-white text-sm font-bold hover:brightness-110 transition-all"
                    style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                    <Plus size={16} className="inline mr-1.5" />Create First Attribute
                </button>
            )}
        </div>
    )
}
