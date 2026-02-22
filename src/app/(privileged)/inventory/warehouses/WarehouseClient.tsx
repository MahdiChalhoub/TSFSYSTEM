'use client'

import { useState } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { deleteWarehouse } from '@/app/actions/inventory/warehouses'
import WarehouseModal from './form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Building2, Store, Warehouse, MapPin, Layers, BarChart3, Plus, Trash2, Edit3 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function WarehouseClient({ initialWarehouses }: { initialWarehouses: any[] }) {
    const [data, setData] = useState(initialWarehouses)
    const [loading, setLoading] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingWarehouse, setEditingWarehouse] = useState<any>(null)
    const [deleteTarget, setDeleteTarget] = useState<any>(null)

    const totalNodes = data.length
    const retailActive = data.filter(w => w.can_sell).length
    const globalSKUCount = data.reduce((sum, w) => sum + (w.inventory_count || 0), 0)

    const columns = [
        {
            key: 'name',
            label: 'Terminal Name',
            alwaysVisible: true,
            render: (row: any) => (
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${row.can_sell ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        {row.can_sell ? <Store size={20} /> : <Warehouse size={20} />}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">{row.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono uppercase">{row.code || `NODE-${row.id}`}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'site_name',
            label: 'Location',
            render: (row: any) => (
                <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                    <MapPin size={14} className="text-gray-300" />
                    <span>{row.site_name || 'Primary Cluster'}</span>
                </div>
            )
        },
        {
            key: 'inventory_count',
            label: 'SKUs',
            align: 'center' as const,
            render: (row: any) => (
                <Badge className="bg-gray-900 text-white border-none font-mono">
                    {row.inventory_count || 0}
                </Badge>
            )
        }
    ]

    const handleDelete = async () => {
        if (!deleteTarget) return
        try {
            await deleteWarehouse(deleteTarget.id)
            setData(prev => prev.filter(w => w.id !== deleteTarget.id))
            toast.success('Terminal decommissioned')
        } catch (err) {
            toast.error('Failed to decommission terminal')
        }
        setDeleteTarget(null)
    }

    const renderCard = (row: any) => (
        <div
            className="group bg-white border border-gray-100 rounded-[2.5rem] p-8 shadow-sm hover:shadow-2xl hover:shadow-indigo-900/5 transition-all relative overflow-hidden cursor-pointer"
            onClick={() => { setEditingWarehouse(row); setIsFormOpen(true); }}
        >
            {!row.is_active && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
                    <Badge className="bg-stone-800 text-white font-black text-[10px] tracking-[0.2em] px-4 py-2 rounded-xl">DECOMMISSIONED</Badge>
                </div>
            )}

            <div className="flex justify-between items-start mb-8">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-sm transition-all group-hover:scale-110 ${row.can_sell ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {row.can_sell ? <Store size={32} /> : <Warehouse size={32} />}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); setEditingWarehouse(row); setIsFormOpen(true); }}
                        className="p-2.5 bg-gray-50 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                        <Edit3 size={18} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                        className="p-2.5 bg-gray-50 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            <div className="mb-8">
                <div className="text-[10px] font-black text-stone-300 uppercase tracking-[0.3em] mb-2 font-mono flex items-center gap-2">
                    <span className="w-3 h-[1px] bg-stone-200" />
                    {row.code || `NODE-${row.id.toString().padStart(3, '0')}`}
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3 truncate group-hover:text-indigo-600 transition-colors">{row.name}</h3>
                <div className="flex items-center gap-2 text-xs text-stone-500 font-bold uppercase tracking-tight">
                    <MapPin size={14} className="text-indigo-400" />
                    <span className="truncate">{row.site_name || 'Primary Cluster'}</span>
                    <span className="text-stone-200">/</span>
                    <span className="text-indigo-500">{row.type}</span>
                </div>
            </div>

            <div className="pt-8 border-t border-stone-50 flex justify-between items-center">
                <div>
                    <div className="text-[9px] text-stone-400 font-black uppercase tracking-widest mb-1">Asset Capacity</div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-gray-900">{row.inventory_count || 0}</span>
                        <span className="text-[10px] font-black text-stone-300 uppercase">Reserves</span>
                    </div>
                </div>
                {row.can_sell ? (
                    <div className="px-3 py-1.5 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-emerald-500/30 tracking-widest">
                        Point of Sale
                    </div>
                ) : (
                    <div className="px-3 py-1.5 bg-indigo-50 text-indigo-400 text-[9px] font-black uppercase rounded-lg border border-indigo-100 tracking-widest">
                        Pure Storage
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto p-4 md:p-8">
            {/* Infrastructure Intelligence */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                            <Layers size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Storage Nodes</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{totalNodes}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                            <Store size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Retail Points</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{retailActive}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-stone-50 text-stone-600 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                            <BarChart3 size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global SKUs</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{globalSKUCount}</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <TypicalListView
                title="Terminal & Node"
                data={data}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                onAdd={() => { setEditingWarehouse(null); setIsFormOpen(true); }}
                addLabel="ADD NODE"
                viewMode="grid"
                renderCard={renderCard}
                actions={{
                    onEdit: (r) => { setEditingWarehouse(r); setIsFormOpen(true); },
                    onDelete: (r) => setDeleteTarget(r)
                }}
            >
                <TypicalFilter
                    onFilter={() => { }}
                    searchPlaceholder="Filter Nodes by ID, Signature or Name..."
                />
            </TypicalListView>

            {isFormOpen && (
                <WarehouseModal
                    warehouse={editingWarehouse}
                    onClose={() => setIsFormOpen(false)}
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
    )
}
