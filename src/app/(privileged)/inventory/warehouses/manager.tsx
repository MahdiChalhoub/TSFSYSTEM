'use client'

import { useState, useCallback, useMemo } from 'react'
import type { Warehouse as WarehouseType } from '@/types/erp'
import { Plus, Search, Warehouse, MapPin, Edit3, Trash2, Store, Building2, RefreshCw, BarChart3, Package, Layers } from "lucide-react"
import WarehouseModal from './form'
import { deleteWarehouse } from '@/app/actions/inventory/warehouses'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function TerminalNodeControl({ initialWarehouses }: { initialWarehouses: Record<string, any>[] }) {
    const [warehouses, setWarehouses] = useState(initialWarehouses);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWarehouse, setEditingWarehouse] = useState<WarehouseType | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

    const filtered = warehouses.filter(w =>
        w.name.toLowerCase().includes(search.toLowerCase()) ||
        w.code?.toLowerCase().includes(search.toLowerCase())
    );

    const handleDelete = async () => {
        if (deleteTarget === null) return;
        const res = await deleteWarehouse(deleteTarget);
        if (!res.success) toast.error(res.message);
        else {
            toast.success('Warehouse deleted');
            setWarehouses(prev => prev.filter(w => w.id !== deleteTarget));
        }
        setDeleteTarget(null);
    };

    // Analytics
    const totalNodes = warehouses.length
    const retailActive = warehouses.filter(w => w.can_sell).length
    const globalSKUCount = warehouses.reduce((sum, w) => sum + (w.inventory_count || 0), 0)

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Standardized Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <Building2 size={28} className="text-white" />
                        </div>
                        Terminal <span className="text-indigo-600">& Node</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Multi-Site Infrastructure & Storage Governance</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-2xl border border-emerald-100">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Global Nodes Active</span>
                    </div>
                    <button
                        onClick={() => { setEditingWarehouse(null); setIsModalOpen(true); }}
                        className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 group text-xs uppercase tracking-widest"
                    >
                        <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                        Add Node
                    </button>
                </div>
            </header>

            {/* Infrastructure Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Layers size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Storage Nodes</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{totalNodes}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Store size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Retail Points</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{retailActive}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-stone-50 text-stone-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <BarChart3 size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Global SKUs</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{globalSKUCount}</h2>
                        </div>
                    </CardContent>
                </Card>

                <div className="relative flex items-center h-full">
                    <Search className="absolute left-6 text-indigo-400 group-focus-within:text-indigo-600 transition-colors" size={20} />
                    <input
                        className="w-full h-full min-h-[88px] pl-16 pr-8 rounded-[2.5rem] border-0 shadow-sm bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all placeholder:font-black placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest"
                        placeholder="Filter Nodes by ID or Signature..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Terminal Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-32 text-center">
                        <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-200">
                            <Building2 size={48} />
                        </div>
                        <p className="text-stone-400 font-black uppercase tracking-widest text-xs">No active nodes detected in current scope.</p>
                    </div>
                ) : (
                    filtered.map((wh) => (
                        <div key={wh.id} className="group bg-white border-0 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-indigo-900/5 transition-all relative overflow-hidden border border-transparent hover:border-indigo-50">
                            {!wh.is_active && (
                                <div className="absolute top-0 left-0 w-full h-full bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                                    <Badge className="bg-stone-800 text-white font-black text-[10px] tracking-[0.2em] px-4 py-2 rounded-xl">DECOMMISSIONED</Badge>
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-8">
                                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-sm transition-all group-hover:scale-110 ${wh.can_sell ? 'bg-emerald-50 text-emerald-600 shadow-emerald-100' : 'bg-indigo-50 text-indigo-600 shadow-indigo-100'}`}>
                                    {wh.can_sell ? <Store size={32} /> : <Warehouse size={32} />}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setEditingWarehouse(wh); setIsModalOpen(true); }}
                                        className="p-2.5 bg-gray-50 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                    >
                                        <Edit3 size={18} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(wh.id)}
                                        className="p-2.5 bg-gray-50 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-8">
                                <div className="text-[10px] font-black text-stone-300 uppercase tracking-[0.3em] mb-2 font-mono flex items-center gap-2">
                                    <span className="w-3 h-[1px] bg-stone-200" />
                                    {wh.code || `NODE-${wh.id.toString().padStart(3, '0')}`}
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 mb-3 truncate group-hover:text-indigo-600 transition-colors">{wh.name}</h3>
                                <div className="flex items-center gap-2 text-xs text-stone-500 font-bold uppercase tracking-tight">
                                    <MapPin size={14} className="text-indigo-400" />
                                    <span className="truncate">{wh.site_name || 'Primary Cluster'}</span>
                                    <span className="text-stone-200">/</span>
                                    <span className="text-indigo-500">{wh.type}</span>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-stone-50 flex justify-between items-center">
                                <div>
                                    <div className="text-[9px] text-stone-400 font-black uppercase tracking-widest mb-1">Asset Capacity</div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-gray-900">{wh.inventory_count || 0}</span>
                                        <span className="text-[10px] font-black text-stone-300 uppercase">Reserves</span>
                                    </div>
                                </div>
                                {wh.can_sell ? (
                                    <div className="px-3 py-1.5 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-emerald-500/30 tracking-widest animate-pulse">
                                        Point of Sale
                                    </div>
                                ) : (
                                    <div className="px-3 py-1.5 bg-indigo-50 text-indigo-400 text-[9px] font-black uppercase rounded-lg border border-indigo-100 tracking-widest">
                                        Pure Storage
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {isModalOpen && (
                <WarehouseModal
                    warehouse={editingWarehouse}
                    onClose={() => setIsModalOpen(false)}
                />
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={handleDelete}
                title="Decommission Terminal Node?"
                description="Removing this node will purge its signature from the global logistics fabric. This action is irreversible."
                confirmText="Confirm Decommission"
                variant="danger"
            />
        </div>
    );
}