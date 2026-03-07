'use client'

import { useState, useMemo } from 'react'
import { deleteWarehouse } from '@/app/actions/inventory/warehouses'
import WarehouseModal from './form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Building2, Store, Warehouse, Cloud, MapPin, Layers, BarChart3,
    Plus, Trash2, Edit3, Phone, ChevronDown, ChevronRight,
    Package, GitBranch
} from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string; bg: string; border: string }> = {
    BRANCH: { icon: Building2, color: 'text-emerald-600', label: 'Branch / Site', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800' },
    STORE: { icon: Store, color: 'text-blue-600', label: 'Store', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
    WAREHOUSE: { icon: Warehouse, color: 'text-amber-600', label: 'Warehouse', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
    VIRTUAL: { icon: Cloud, color: 'text-purple-600', label: 'Virtual', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800' },
};

interface WarehouseNode {
    id: number;
    name: string;
    code: string;
    location_type: string;
    parent: number | null;
    parent_name?: string;
    can_sell: boolean;
    is_active: boolean;
    city?: string;
    phone?: string;
    address?: string;
    inventory_count?: number;
    children?: WarehouseNode[];
}

// ─── Build Tree ──────────────────────────────────────────────────────────────

function buildTree(flat: WarehouseNode[]): { branches: WarehouseNode[]; orphans: WarehouseNode[] } {
    const map = new Map<number, WarehouseNode>();
    flat.forEach(w => map.set(w.id, { ...w, children: [] }));

    const branches: WarehouseNode[] = [];
    const orphans: WarehouseNode[] = [];

    flat.forEach(w => {
        const node = map.get(w.id)!;
        if (w.parent && map.has(w.parent)) {
            map.get(w.parent)!.children!.push(node);
        } else if (w.location_type === 'BRANCH') {
            branches.push(node);
        } else {
            orphans.push(node);
        }
    });

    return { branches, orphans };
}

// ─── Child Row Component ─────────────────────────────────────────────────────

function ChildRow({ node, onEdit, onDelete }: {
    node: WarehouseNode;
    onEdit: (w: WarehouseNode) => void;
    onDelete: (w: WarehouseNode) => void;
}) {
    const cfg = TYPE_CONFIG[node.location_type] || TYPE_CONFIG.WAREHOUSE;
    const Icon = cfg.icon;

    return (
        <div
            className={`flex items-center gap-4 px-5 py-3 rounded-xl border ${cfg.border} ${cfg.bg} group hover:shadow-md transition-all cursor-pointer`}
            onClick={() => onEdit(node)}
        >
            {/* Indent connector */}
            <div className="w-6 flex justify-center">
                <div className="w-px h-full bg-emerald-300 dark:bg-emerald-700" />
            </div>

            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.bg} ${cfg.color}`}>
                <Icon size={20} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <p className="font-black text-app-foreground text-sm truncate">{node.name}</p>
                    <Badge className={`text-[8px] ${cfg.bg} ${cfg.color} border-none font-bold px-1.5 py-0`}>{cfg.label}</Badge>
                    {node.can_sell && (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none text-[8px] font-bold px-1.5 py-0">
                            POS
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-app-muted-foreground font-mono">{node.code || `LOC-${node.id}`}</span>
                    {node.city && (
                        <span className="text-[10px] text-app-muted-foreground flex items-center gap-1">
                            <MapPin size={10} />{node.city}
                        </span>
                    )}
                </div>
            </div>

            {/* SKU count */}
            <div className="text-right shrink-0">
                <p className="text-lg font-black text-app-foreground">{node.inventory_count || 0}</p>
                <p className="text-[9px] font-bold text-app-muted-foreground uppercase">SKUs</p>
            </div>

            {/* Actions */}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                    onClick={(e) => { e.stopPropagation(); onEdit(node); }}
                    className="p-2 rounded-lg hover:bg-app-surface transition-colors text-app-muted-foreground hover:text-app-foreground"
                >
                    <Edit3 size={14} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); onDelete(node); }}
                    className="p-2 rounded-lg hover:bg-rose-50 transition-colors text-app-muted-foreground hover:text-rose-600"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
}

// ─── Branch Card Component ───────────────────────────────────────────────────

function BranchCard({ branch, onEdit, onDelete, onAddChild }: {
    branch: WarehouseNode;
    onEdit: (w: WarehouseNode) => void;
    onDelete: (w: WarehouseNode) => void;
    onAddChild: (parent: WarehouseNode) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const children = branch.children || [];
    const stores = children.filter(c => c.location_type === 'STORE');
    const warehouses = children.filter(c => c.location_type === 'WAREHOUSE');
    const virtuals = children.filter(c => c.location_type === 'VIRTUAL');
    const totalSKUs = children.reduce((sum, c) => sum + (c.inventory_count || 0), 0);

    return (
        <div className="bg-app-surface border-2 border-emerald-200 dark:border-emerald-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-lg transition-all">
            {/* Branch Header */}
            <div
                className="p-6 cursor-pointer select-none"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-4">
                    {/* Expand/Collapse */}
                    <button className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shrink-0">
                        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    {/* Branch icon */}
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                        <Building2 size={28} className="text-emerald-600" />
                    </div>

                    {/* Name & metadata */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-xl font-black text-app-foreground truncate">{branch.name}</h3>
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none text-[9px] font-black uppercase">Branch</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-app-muted-foreground">
                            <span className="font-mono">{branch.code || `BR-${branch.id}`}</span>
                            {branch.city && <span className="flex items-center gap-1"><MapPin size={11} />{branch.city}</span>}
                            {branch.phone && <span className="flex items-center gap-1"><Phone size={11} />{branch.phone}</span>}
                        </div>
                    </div>

                    {/* Summary badges */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center px-3">
                            <p className="text-2xl font-black text-app-foreground">{children.length}</p>
                            <p className="text-[9px] font-bold text-app-muted-foreground uppercase">Locations</p>
                        </div>
                        <div className="text-center px-3 border-l border-app-border">
                            <p className="text-2xl font-black text-app-foreground">{totalSKUs}</p>
                            <p className="text-[9px] font-bold text-app-muted-foreground uppercase">SKUs</p>
                        </div>
                        <div className="flex gap-1 ml-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); onEdit(branch); }}
                                className="p-2 rounded-lg hover:bg-emerald-50 transition-colors text-app-muted-foreground hover:text-emerald-600"
                            >
                                <Edit3 size={16} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(branch); }}
                                className="p-2 rounded-lg hover:bg-rose-50 transition-colors text-app-muted-foreground hover:text-rose-600"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Children */}
            {expanded && (
                <div className="px-6 pb-5 space-y-2">
                    <div className="border-t border-emerald-100 dark:border-emerald-900/30 pt-4 ml-5 space-y-2">
                        {stores.map(child => (
                            <ChildRow key={child.id} node={child} onEdit={onEdit} onDelete={onDelete} />
                        ))}
                        {warehouses.map(child => (
                            <ChildRow key={child.id} node={child} onEdit={onEdit} onDelete={onDelete} />
                        ))}
                        {virtuals.map(child => (
                            <ChildRow key={child.id} node={child} onEdit={onEdit} onDelete={onDelete} />
                        ))}

                        {children.length === 0 && (
                            <div className="text-center py-6 text-app-muted-foreground text-sm">
                                <Package size={24} className="mx-auto mb-2 opacity-40" />
                                <p className="font-bold">No locations yet</p>
                                <p className="text-xs">Add a Store or Warehouse under this branch</p>
                            </div>
                        )}

                        {/* Add child button */}
                        <button
                            onClick={() => onAddChild(branch)}
                            className="w-full py-2 rounded-xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                        >
                            <Plus size={14} />
                            Add Location
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function WarehouseClient({ initialWarehouses }: { initialWarehouses: any[] }) {
    const [data, setData] = useState<WarehouseNode[]>(initialWarehouses);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [defaultParent, setDefaultParent] = useState<number | null>(null);

    const { branches, orphans } = useMemo(() => buildTree(data), [data]);

    // Stats
    const totalNodes = data.length;
    const branchCount = branches.length;
    const retailActive = data.filter(w => w.can_sell).length;
    const globalSKUCount = data.reduce((sum, w) => sum + (w.inventory_count || 0), 0);

    // Parent options for the form
    const parentOptions = data
        .filter(w => w.location_type === 'BRANCH')
        .map(w => ({ id: w.id, name: w.name }));

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteWarehouse(deleteTarget.id);
            setData(prev => prev.filter(w => w.id !== deleteTarget.id));
            toast.success('Location removed');
        } catch (err) {
            toast.error('Failed to remove location');
        }
        setDeleteTarget(null);
    };

    const handleAddChild = (parent: WarehouseNode) => {
        setEditingWarehouse(null);
        setDefaultParent(parent.id);
        setIsFormOpen(true);
    };

    const handleAdd = () => {
        setEditingWarehouse(null);
        setDefaultParent(null);
        setIsFormOpen(true);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 md:p-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/10 dark:to-app-surface overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Building2 size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Branches</p>
                            <h2 className="text-2xl font-black text-app-foreground mt-0.5 tracking-tighter">{branchCount}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white dark:from-slate-900/10 dark:to-app-surface overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Layers size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">All Locations</p>
                            <h2 className="text-2xl font-black text-app-foreground mt-0.5 tracking-tighter">{totalNodes}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/10 dark:to-app-surface overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Store size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Retail Points</p>
                            <h2 className="text-2xl font-black text-app-foreground mt-0.5 tracking-tighter">{retailActive}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-0 shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden group hover:shadow-xl transition-all">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 text-white flex items-center justify-center group-hover:scale-110 transition-transform backdrop-blur-sm">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global SKUs</p>
                            <h2 className="text-2xl font-black text-white mt-0.5 tracking-tighter">{globalSKUCount}</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <GitBranch size={16} className="text-emerald-600" />
                    <h2 className="text-lg font-black text-app-foreground">Branch Hierarchy</h2>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-none text-[9px] font-bold">
                        {branches.length} branches · {data.length - branches.length} locations
                    </Badge>
                </div>
                <Button
                    onClick={handleAdd}
                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20"
                >
                    <Plus size={16} className="mr-1.5" />
                    Create Branch
                </Button>
            </div>

            {/* Tree View */}
            <div className="space-y-4">
                {branches.map(branch => (
                    <BranchCard
                        key={branch.id}
                        branch={branch}
                        onEdit={(w) => { setEditingWarehouse(w); setDefaultParent(null); setIsFormOpen(true); }}
                        onDelete={(w) => setDeleteTarget(w)}
                        onAddChild={handleAddChild}
                    />
                ))}

                {/* Orphans (locations without a branch parent — legacy data) */}
                {orphans.length > 0 && (
                    <div className="bg-app-surface border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-3xl p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <MapPin size={20} className="text-amber-600" />
                            </div>
                            <div>
                                <h3 className="font-black text-app-foreground">Unassigned Locations</h3>
                                <p className="text-xs text-app-muted-foreground">These locations are not under any branch — assign them to organize your hierarchy</p>
                            </div>
                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-none text-[9px] font-bold ml-auto">
                                {orphans.length} locations
                            </Badge>
                        </div>
                        <div className="space-y-2 ml-5">
                            {orphans.map(node => (
                                <ChildRow
                                    key={node.id}
                                    node={node}
                                    onEdit={(w) => { setEditingWarehouse(w); setDefaultParent(null); setIsFormOpen(true); }}
                                    onDelete={(w) => setDeleteTarget(w)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {branches.length === 0 && orphans.length === 0 && (
                    <div className="text-center py-16">
                        <Building2 size={48} className="mx-auto mb-4 opacity-20" />
                        <h3 className="text-xl font-black text-app-foreground mb-2">No Branches Yet</h3>
                        <p className="text-sm text-app-muted-foreground mb-6">
                            Create your first branch to start organizing locations
                        </p>
                        <Button
                            onClick={handleAdd}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            <Plus size={16} className="mr-1.5" />
                            Create First Branch
                        </Button>
                    </div>
                )}
            </div>

            {/* Warehouse Modal */}
            {isFormOpen && (
                <WarehouseModal
                    warehouse={editingWarehouse}
                    onClose={() => { setIsFormOpen(false); setDefaultParent(null); }}
                    parentOptions={parentOptions}
                    defaultParent={defaultParent}
                />
            )}

            {/* Confirm Delete */}
            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                onConfirm={handleDelete}
                title="Remove Location?"
                description={
                    deleteTarget?.location_type === 'BRANCH'
                        ? "This will permanently remove this branch AND all locations under it. Stock data may be lost. This action cannot be undone."
                        : "This will permanently remove this location and all associated data. This action cannot be undone."
                }
                confirmText="Confirm Remove"
                variant="danger"
            />
        </div>
    );
}
