// @ts-nocheck
'use client';

import { useState } from 'react';
import type { Warehouse as WarehouseType } from '@/types/erp';
import { Plus, Search, Warehouse, MapPin, Edit3, Trash2, Store } from "lucide-react";
import WarehouseModal from './form';
import { deleteWarehouse } from '@/app/actions/inventory/warehouses';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function WarehouseManager({ warehouses }: { warehouses: Record<string, any>[] }) {
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
        else toast.success('Warehouse deleted');
        setDeleteTarget(null);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Warehouses</h1>
                    <p className="text-gray-500">Manage storage locations, multi-site logistics, and retail points.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingWarehouse(null);
                        setIsModalOpen(true);
                    }}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-emerald-900/20 hover:shadow-emerald-900/40 hover:-translate-y-0.5 transition-all flex items-center gap-2 group"
                >
                    <Plus size={20} className="group-hover:rotate-90 transition-transform" />
                    <span>Add New Site</span>
                </button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Warehouse size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Total Sites</div>
                        <div className="text-2xl font-black text-gray-900">{warehouses.length}</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Store size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-400 uppercase tracking-wider">Retail Stores</div>
                        <div className="text-2xl font-black text-gray-900">{warehouses.filter(w => w.can_sell).length}</div>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        className="w-full h-full min-h-[76px] pl-12 pr-6 rounded-3xl border border-gray-100 shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all placeholder:font-bold"
                        placeholder="Search name or ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-20 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <Warehouse size={40} />
                        </div>
                        <p className="text-gray-400 font-bold">No sites matching your search.</p>
                    </div>
                ) : (
                    filtered.map((wh) => (
                        <div key={wh.id} className="group bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-2xl hover:shadow-emerald-900/5 transition-all relative overflow-hidden">
                            {!wh.is_active && (
                                <div className="absolute top-0 right-0 bg-gray-100 text-gray-400 px-3 py-1 text-[10px] font-black uppercase rounded-bl-xl">
                                    Disabled
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${wh.can_sell ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600'
                                    }`}>
                                    {wh.can_sell ? <Store size={28} /> : <Warehouse size={28} />}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingWarehouse(wh);
                                            setIsModalOpen(true);
                                        }}
                                        className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-xl transition-colors"
                                    >
                                        <Edit3 size={18} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(wh.id)}
                                        className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <div className="mb-6">
                                <div className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-1">
                                    {wh.code || `SITE-${wh.id.toString().padStart(3, '0')}`}
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2 truncate">{wh.name}</h3>
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium capitalize">
                                    <MapPin size={14} className="text-emerald-500" />
                                    {wh.site_name ? `${wh.site_name} · ${wh.type.toLowerCase()}` : `${wh.type.toLowerCase()} site`}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-gray-50 flex justify-between items-end">
                                <div>
                                    <div className="text-[10px] text-gray-400 font-black uppercase tracking-tighter mb-1 font-mono">Stock Level</div>
                                    <div className="text-xl font-black text-gray-900">{wh.inventory_count || 0} <span className="text-xs text-gray-300 font-bold ml-1">SKUs</span></div>
                                </div>
                                {wh.can_sell && (
                                    <div className="px-3 py-1 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-emerald-500/30">
                                        Active Store
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
                title="Delete Warehouse?"
                description="This will permanently remove this warehouse and its configuration. Inventory data may be affected."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
}