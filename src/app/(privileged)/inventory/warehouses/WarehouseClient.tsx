'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { deleteWarehouse } from '@/app/actions/inventory/warehouses'
import WarehouseModal from './form'
import {
    Building2, Store, Warehouse, Cloud, MapPin, Layers, BarChart3,
    Plus, Trash2, Edit3, Phone, ChevronDown, ChevronRight,
    Package, GitBranch, Search, Sparkles, ArrowRight, Settings2,
    Eye, EyeOff, X, Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

/* ─── TYPE CONFIG (all theme-dynamic via app-* variables) ──────────────── */

const TYPE_CONFIG: Record<string, {
    icon: any; label: string;
    cssVar: string; // primary CSS variable for this type
}> = {
    BRANCH: { icon: Building2, label: 'Branch', cssVar: '--app-success' },
    STORE: { icon: Store, label: 'Store', cssVar: '--app-info' },
    WAREHOUSE: { icon: Warehouse, label: 'Warehouse', cssVar: '--app-warning' },
    VIRTUAL: { icon: Cloud, label: 'Virtual', cssVar: '--app-primary' },
}

/* ─── HELPER: inline gradient from a CSS variable ──────────────────────── */

function gradientBg(cssVar: string, opacity = 1) {
    return { background: `linear-gradient(135deg, color-mix(in srgb, var(${cssVar}) ${Math.round(opacity * 100)}%, transparent), color-mix(in srgb, var(${cssVar}) ${Math.round(opacity * 60)}%, transparent))` }
}

function solidBg(cssVar: string, opacity = 1) {
    return { backgroundColor: `color-mix(in srgb, var(${cssVar}) ${Math.round(opacity * 100)}%, transparent)` }
}

function textColor(cssVar: string) {
    return { color: `var(${cssVar})` }
}

function dotStyle(cssVar: string) {
    return { backgroundColor: `var(${cssVar})` }
}

function borderColor(cssVar: string, opacity = 0.3) {
    return { borderColor: `color-mix(in srgb, var(${cssVar}) ${Math.round(opacity * 100)}%, transparent)` }
}

function shadowColor(cssVar: string) {
    return { boxShadow: `0 8px 24px -4px color-mix(in srgb, var(${cssVar}) 25%, transparent)` }
}

/* ─── TYPES ───────────────────────────────────────────────────────────── */

interface WarehouseNode {
    id: number; name: string; code: string; location_type: string;
    parent: number | null; parent_name?: string;
    can_sell: boolean; is_active: boolean;
    city?: string; phone?: string; address?: string;
    country?: number | null; country_name?: string; country_iso2?: string;
    inventory_count?: number; children?: WarehouseNode[];
}

/* ─── TREE BUILDER ────────────────────────────────────────────────────── */

function buildTree(flat: WarehouseNode[]): { branches: WarehouseNode[]; orphans: WarehouseNode[] } {
    const map = new Map<number, WarehouseNode>()
    flat.forEach(w => map.set(w.id, { ...w, children: [] }))
    const branches: WarehouseNode[] = []
    const orphans: WarehouseNode[] = []
    flat.forEach(w => {
        const node = map.get(w.id)!
        if (w.parent && map.has(w.parent)) {
            map.get(w.parent)!.children!.push(node)
        } else if (w.location_type === 'BRANCH') {
            branches.push(node)
        } else {
            orphans.push(node)
        }
    })
    return { branches, orphans }
}

/* ─── CHILD ROW ───────────────────────────────────────────────────────── */

function ChildRow({ node, onEdit, onDelete }: {
    node: WarehouseNode; onEdit: (w: WarehouseNode) => void; onDelete: (w: WarehouseNode) => void;
}) {
    const cfg = TYPE_CONFIG[node.location_type] || TYPE_CONFIG.WAREHOUSE
    const Icon = cfg.icon
    const cv = cfg.cssVar

    return (
        <div
            className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border group hover:shadow-md hover:scale-[1.005] transition-all duration-200 cursor-pointer"
            style={{ ...solidBg(cv, 0.08), ...borderColor(cv, 0.2) }}
            onClick={() => onEdit(node)}
        >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={gradientBg(cv)}>
                <Icon size={14} className="text-white sm:hidden" />
                <Icon size={16} className="text-white hidden sm:block" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <p className="font-bold text-app-foreground text-[12px] sm:text-[13px] truncate">{node.name}</p>
                    <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full hidden sm:inline" style={{ ...textColor(cv), ...solidBg(cv, 0.12) }}>{cfg.label}</span>
                    {node.can_sell && (
                        <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-app-success bg-app-success/10 px-1.5 py-0.5 rounded-full">POS</span>
                    )}
                    {!node.is_active && (
                        <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-app-error bg-app-error/10 px-1.5 py-0.5 rounded-full">Inactive</span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-app-muted-foreground font-mono">{node.code || `LOC-${node.id}`}</span>
                    {node.city && <span className="text-[10px] text-app-muted-foreground flex items-center gap-1"><MapPin size={9} />{node.city}</span>}
                    {!node.country_name && (
                        <span className="text-[10px] text-app-warning font-bold flex items-center gap-1"><Globe size={9} />⚠ No Country</span>
                    )}
                </div>
            </div>
            <div className="text-right shrink-0 hidden sm:block">
                <p className="text-[15px] font-black text-app-foreground">{node.inventory_count || 0}</p>
                <p className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-widest">SKUs</p>
            </div>
            <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                <button onClick={(e) => { e.stopPropagation(); onEdit(node) }} className="p-1.5 rounded-lg hover:bg-app-surface transition-colors text-app-muted-foreground hover:text-app-foreground">
                    <Edit3 size={13} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(node) }} className="p-1.5 rounded-lg hover:bg-app-error/10 transition-colors text-app-muted-foreground hover:text-app-error">
                    <Trash2 size={13} />
                </button>
            </div>
        </div>
    )
}

/* ─── BRANCH CARD ─────────────────────────────────────────────────────── */

function BranchCard({ branch, onEdit, onDelete, onAddChild, isExpanded, onToggle }: {
    branch: WarehouseNode; onEdit: (w: WarehouseNode) => void; onDelete: (w: WarehouseNode) => void;
    onAddChild: (parent: WarehouseNode) => void; isExpanded: boolean; onToggle: () => void;
}) {
    const children = branch.children || []
    const totalSKUs = children.reduce((sum, c) => sum + (c.inventory_count || 0), 0) + (branch.inventory_count || 0)
    const branchCv = TYPE_CONFIG.BRANCH.cssVar

    return (
        <div className="bg-app-surface border border-app-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group">
            {/* Branch Header */}
            <div className="p-3 sm:p-5 cursor-pointer select-none" onClick={onToggle}>
                <div className="flex items-center gap-2 sm:gap-4">
                    <button
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200"
                        style={{ ...solidBg(branchCv, 0.1), ...textColor(branchCv), transform: isExpanded ? 'rotate(0)' : 'rotate(-90deg)' }}
                    >
                        <ChevronDown size={12} className="sm:hidden" />
                        <ChevronDown size={14} className="hidden sm:block" />
                    </button>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300" style={{ ...gradientBg(branchCv), ...shadowColor(branchCv) }}>
                        <Building2 size={18} className="text-white sm:hidden" />
                        <Building2 size={22} className="text-white hidden sm:block" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                            <h3 className="text-[14px] sm:text-[17px] font-black text-app-foreground truncate">{branch.name}</h3>
                            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest px-1.5 sm:px-2 py-0.5 rounded-full hidden sm:inline" style={{ ...textColor(branchCv), ...solidBg(branchCv, 0.12) }}>Branch</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-app-muted-foreground flex-wrap">
                            <span className="font-mono">{branch.code || `BR-${branch.id}`}</span>
                            {branch.country_name && <span className="flex items-center gap-1"><Globe size={10} />{branch.country_name}</span>}
                            {!branch.country_name && (
                                <span className="flex items-center gap-1 text-app-warning font-bold"><Globe size={10} />⚠ No Country</span>
                            )}
                            {branch.city && <span className="flex items-center gap-1"><MapPin size={10} />{branch.city}</span>}
                            {branch.phone && <span className="flex items-center gap-1"><Phone size={10} />{branch.phone}</span>}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-center hidden sm:block">
                            <p className="text-xl font-black text-app-foreground">{children.length}</p>
                            <p className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-widest">Locations</p>
                        </div>
                        <div className="w-px h-8 bg-app-border hidden sm:block" />
                        <div className="text-center hidden sm:block">
                            <p className="text-xl font-black text-app-foreground">{totalSKUs}</p>
                            <p className="text-[8px] font-bold text-app-muted-foreground uppercase tracking-widest">SKUs</p>
                        </div>
                        {/* Mobile: compact stats */}
                        <span className="text-[10px] font-bold text-app-muted-foreground sm:hidden">{children.length} loc</span>
                        <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); onEdit(branch) }} className="p-1.5 rounded-lg hover:bg-app-primary/10 transition-colors text-app-muted-foreground hover:text-app-primary">
                                <Edit3 size={14} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onDelete(branch) }} className="p-1.5 rounded-lg hover:bg-app-error/10 transition-colors text-app-muted-foreground hover:text-app-error">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Children */}
            {isExpanded && (
                <div className="px-5 pb-4 space-y-1.5">
                    <div className="border-t border-app-border/50 pt-3 ml-2 sm:ml-11 space-y-1.5">
                        {children.map(c => <ChildRow key={c.id} node={c} onEdit={onEdit} onDelete={onDelete} />)}

                        {children.length === 0 && (
                            <div className="text-center py-8">
                                <Package size={24} className="mx-auto mb-2 text-app-muted-foreground/30" />
                                <p className="text-[12px] font-bold text-app-muted-foreground">No locations yet</p>
                                <p className="text-[10px] text-app-muted-foreground/70">Add a store or warehouse under this branch</p>
                            </div>
                        )}

                        <button
                            onClick={() => onAddChild(branch)}
                            className="w-full py-2.5 rounded-xl border-2 border-dashed border-app-border hover:border-app-primary/40 text-app-muted-foreground hover:text-app-primary bg-transparent hover:bg-app-primary/5 transition-all duration-200 flex items-center justify-center gap-2 text-[11px] font-bold"
                        >
                            <Plus size={13} />
                            Add Location
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

/* ─── MAIN COMPONENT ──────────────────────────────────────────────────── */

export function WarehouseClient({ initialWarehouses, countries = [], defaultCountryId = null }: { initialWarehouses: any[]; countries?: { id: number; name: string; iso2: string }[]; defaultCountryId?: number | null }) {
    const router = useRouter()
    const [data, setData] = useState<WarehouseNode[]>(initialWarehouses)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingWarehouse, setEditingWarehouse] = useState<any>(null)
    const [deleteTarget, setDeleteTarget] = useState<any>(null)
    const [defaultParent, setDefaultParent] = useState<number | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set(data.filter(w => w.location_type === 'BRANCH').map(w => w.id)))
    const [focusMode, setFocusMode] = useState(false)

    const { branches, orphans } = useMemo(() => buildTree(data), [data])

    // Stats
    const totalNodes = data.length
    const branchCount = branches.length
    const storeCount = data.filter(w => w.location_type === 'STORE').length
    const warehouseCount = data.filter(w => w.location_type === 'WAREHOUSE').length
    const retailActive = data.filter(w => w.can_sell).length
    const globalSKUCount = data.reduce((sum, w) => sum + (w.inventory_count || 0), 0)

    // Filter
    const filteredBranches = useMemo(() => {
        if (!searchQuery.trim()) return branches
        const q = searchQuery.toLowerCase()
        return branches.filter(b => {
            const branchMatch = b.name.toLowerCase().includes(q) || b.code?.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q)
            const childMatch = b.children?.some(c => c.name.toLowerCase().includes(q) || c.code?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q))
            return branchMatch || childMatch
        })
    }, [branches, searchQuery])

    const filteredOrphans = useMemo(() => {
        if (!searchQuery.trim()) return orphans
        const q = searchQuery.toLowerCase()
        return orphans.filter(o => o.name.toLowerCase().includes(q) || o.code?.toLowerCase().includes(q) || o.city?.toLowerCase().includes(q))
    }, [orphans, searchQuery])

    const parentOptions = data.filter(w => w.location_type === 'BRANCH').map(w => ({ id: w.id, name: w.name, country: w.country, country_name: w.country_name }))

    const handleDelete = async () => {
        const target = deleteTarget
        if (!target) return
        try {
            const result = await deleteWarehouse(target.id)
            if (!result.success) {
                toast.error(result.message || 'Failed to remove location')
            } else if (result.deactivated) {
                // Soft-deactivated — update data in-place
                setData(prev => prev.map(w => w.id === target.id ? { ...w, is_active: false } : w))
                toast.warning(result.message || `"${target.name}" deactivated — has active data`, {
                    description: result.blockers?.join(', '),
                    duration: 6000,
                })
            } else {
                // Hard deleted — remove from local state immediately
                setData(prev => prev.filter(w => w.id !== target.id))
                toast.success('Location permanently removed')
            }
            router.refresh()
        } catch (err) {
            toast.error('Failed to remove location')
        }
        setDeleteTarget(null)
    }

    const handleAddChild = (parent: WarehouseNode) => {
        setEditingWarehouse(null)
        setDefaultParent(parent.id)
        setIsFormOpen(true)
    }

    const handleAdd = () => {
        setEditingWarehouse(null)
        setDefaultParent(null)
        setIsFormOpen(true)
    }

    const toggleExpand = useCallback((id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }, [])

    /* ─── KPI config (theme-dynamic) ──────────────────────────── */
    const kpis = [
        { label: 'Branches', value: branchCount, color: 'var(--app-success)', icon: Building2 },
        { label: 'Stores', value: storeCount, color: 'var(--app-info)', icon: Store },
        { label: 'Warehouses', value: warehouseCount, color: 'var(--app-warning)', icon: Warehouse },
        { label: 'Retail Points', value: retailActive, color: 'var(--app-primary)', icon: Package },
        { label: 'Total', value: totalNodes, color: '#8b5cf6', icon: Layers },
        { label: 'SKUs', value: globalSKUCount, color: 'var(--app-error)', icon: BarChart3 },
    ]

    return (
        <div className={`flex flex-col animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`} style={{ height: '100%' }}>

            {/* ─── Header ──────────────────────────────────────────────── */}
            <div className={`flex-shrink-0 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-5'}`}>
                {focusMode ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm" style={gradientBg('--app-primary')}>
                                <GitBranch size={14} className="text-white" />
                            </div>
                            <span className="text-[13px] font-black text-app-foreground">Location Hierarchy</span>
                            <span className="text-[10px] font-bold text-app-muted-foreground ml-1">{data.length} locations</span>
                        </div>
                        <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-colors">
                            <Eye size={14} />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Title row */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={gradientBg('--app-primary')}>
                                    <GitBranch size={16} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-lg sm:text-xl font-black tracking-tight text-app-foreground leading-none">
                                        Branch <span className="text-app-primary">Hierarchy</span>
                                    </h1>
                                    <p className="text-[10px] text-app-muted-foreground mt-0.5 hidden sm:block">
                                        Branches, stores, warehouses & virtual stock points
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setFocusMode(true)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all hidden sm:flex" title="Focus Mode">
                                <EyeOff size={12} />
                            </button>
                        </div>

                        {/* KPI Grid — equal-width cards, same pattern as chart-of-accounts */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-3">
                            {kpis.map(kpi => {
                                const KIcon = kpi.icon
                                const c = kpi.color
                                return (
                                    <div
                                        key={kpi.label}
                                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all hover:shadow-sm"
                                        style={{
                                            background: `color-mix(in srgb, ${c} 8%, var(--app-surface))`,
                                            border: `1px solid color-mix(in srgb, ${c} 20%, transparent)`,
                                        }}
                                    >
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                            style={{
                                                background: `color-mix(in srgb, ${c} 15%, transparent)`,
                                                color: c,
                                            }}
                                        >
                                            <KIcon size={13} />
                                        </div>
                                        <div className="min-w-0">
                                            <div
                                                className="text-[10px] font-bold uppercase tracking-wider"
                                                style={{ color: c }}
                                            >
                                                {kpi.label}
                                            </div>
                                            <div className="text-sm font-black text-app-foreground tabular-nums">{kpi.value}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}

                {/* Search + Actions Bar */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search locations..."
                            className="w-full bg-app-surface border border-app-border rounded-xl pl-9 pr-8 py-2 text-[12px] font-medium text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground transition-colors">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-3 sm:px-5 py-2 rounded-xl bg-app-primary text-white text-[12px] font-bold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 shrink-0"
                    >
                        <Plus size={14} />
                        <span className="hidden sm:inline">Create Branch</span>
                    </button>
                </div>
            </div>

            {/* ─── Content (Scrollable) ─────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar space-y-3 pr-1">
                {filteredBranches.length === 0 && filteredOrphans.length === 0 && !searchQuery ? (
                    /* Empty State */
                    <div className="text-center py-16">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-app-primary/10">
                            <Building2 size={28} className="text-app-primary/40" />
                        </div>
                        <h3 className="text-xl font-black text-app-foreground mb-2">No Locations Yet</h3>
                        <p className="text-[12px] text-app-muted-foreground mb-6 max-w-sm mx-auto">
                            Create your first branch to start organizing your stores, warehouses, and virtual stock points.
                        </p>
                        <button
                            onClick={handleAdd}
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-app-primary text-white text-[13px] font-bold shadow-lg hover:shadow-xl transition-all"
                        >
                            <Plus size={15} />
                            Create First Branch
                        </button>
                    </div>
                ) : filteredBranches.length === 0 && filteredOrphans.length === 0 && searchQuery ? (
                    /* Search empty */
                    <div className="text-center py-16">
                        <Search size={28} className="mx-auto mb-3 text-app-muted-foreground/30" />
                        <h3 className="text-[15px] font-black text-app-foreground mb-1">No results for &ldquo;{searchQuery}&rdquo;</h3>
                        <p className="text-[11px] text-app-muted-foreground">Try a different search term</p>
                    </div>
                ) : (
                    <>
                        {/* Branches */}
                        {filteredBranches.map(branch => (
                            <BranchCard
                                key={branch.id}
                                branch={branch}
                                isExpanded={expandedIds.has(branch.id)}
                                onToggle={() => toggleExpand(branch.id)}
                                onEdit={(w) => { setEditingWarehouse(w); setDefaultParent(null); setIsFormOpen(true) }}
                                onDelete={(w) => setDeleteTarget(w)}
                                onAddChild={handleAddChild}
                            />
                        ))}

                        {/* Orphans */}
                        {filteredOrphans.length > 0 && (
                            <div className="bg-app-surface border-2 border-dashed rounded-2xl p-5" style={borderColor('--app-warning', 0.5)}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={gradientBg('--app-warning')}>
                                        <MapPin size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-[14px] font-black text-app-foreground">Unassigned Locations</h3>
                                        <p className="text-[10px] text-app-muted-foreground">Not under any branch — assign them to organize your hierarchy</p>
                                    </div>
                                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ ...textColor('--app-warning'), ...solidBg('--app-warning', 0.15) }}>
                                        {filteredOrphans.length}
                                    </span>
                                </div>
                                <div className="space-y-1.5 ml-3">
                                    {filteredOrphans.map(node => (
                                        <ChildRow
                                            key={node.id}
                                            node={node}
                                            onEdit={(w) => { setEditingWarehouse(w); setDefaultParent(null); setIsFormOpen(true) }}
                                            onDelete={(w) => setDeleteTarget(w)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ─── Modals ──────────────────────────────────────────── */}
            {isFormOpen && (
                <WarehouseModal
                    warehouse={editingWarehouse}
                    onClose={() => { setIsFormOpen(false); setDefaultParent(null) }}
                    parentOptions={parentOptions}
                    defaultParent={defaultParent}
                    countries={countries}
                    defaultCountryId={defaultCountryId}
                    onSaved={async () => {
                        try {
                            const { getWarehouses } = await import('@/app/actions/inventory/warehouses');
                            const fresh = await getWarehouses();
                            const list = Array.isArray(fresh) ? fresh : (fresh?.results ?? []);
                            setData(list);
                        } catch { /* router.refresh fallback already called */ }
                    }}
                />
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleDelete}
                title="Remove Location?"
                description={
                    deleteTarget?.location_type === 'BRANCH'
                        ? "This will permanently remove this branch AND all locations under it. Stock data may be lost."
                        : "This will permanently remove this location and all associated data."
                }
                confirmText="Confirm Remove"
                variant="danger"
            />
        </div>
    )
}
