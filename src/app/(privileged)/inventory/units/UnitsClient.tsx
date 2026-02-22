'use client'

import { useState } from 'react'
import { TypicalListView } from '@/components/common/TypicalListView'
import { useListViewSettings } from '@/hooks/useListViewSettings'
import { TypicalFilter } from '@/components/common/TypicalFilter'
import { createUnit, updateUnit, deleteUnit } from '@/app/actions/inventory/units'
import { Badge } from '@/components/ui/badge'
import { Ruler, Scale, Box, Calculator, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { UnitCalculator } from '@/components/admin/UnitCalculator'
import { Button } from '@/components/ui/button'
import { ProductList } from '@/components/inventory/ProductList'

export function UnitsClient({ initialUnits }: { initialUnits: any[] }) {
    const settings = useListViewSettings('inv_units', {
        columns: ['name', 'multiplier', 'product_count'],
        pageSize: 25,
        sortKey: 'name',
        sortDir: 'asc',
    })
    const [data, setData] = useState(initialUnits)
    const [loading, setLoading] = useState(false)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingUnit, setEditingUnit] = useState<any>(null)

    const columns = [
        {
            key: 'name',
            label: 'Unit Name',
            alwaysVisible: true,
            render: (row: any) => (
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${!row.base_unit ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                        {!row.base_unit ? <Scale size={16} /> : <Box size={16} />}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">{row.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono uppercase">{row.short_name || 'NO-CODE'}</p>
                    </div>
                </div>
            )
        },
        {
            key: 'multiplier',
            label: 'Multiplier',
            render: (row: any) => row.base_unit ? (
                <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-600">x{row.multiplier}</span>
                    <span className="text-xs text-gray-400">of {row.base_unit_name || row.base_unit}</span>
                </div>
            ) : <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold">Base Unit</Badge>
        },
        {
            key: 'product_count',
            label: 'Products',
            align: 'center' as const,
            render: (row: any) => (
                <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-none font-bold">
                    {row.product_count || 0}
                </Badge>
            )
        }
    ]

    const handleSave = async (formData: FormData) => {
        const name = formData.get('name') as string
        const short_name = formData.get('short_name') as string
        const multiplier = parseFloat(formData.get('multiplier') as string)
        const base_unit = formData.get('base_unit') ? parseInt(formData.get('base_unit') as string) : null

        try {
            if (editingUnit) {
                await updateUnit(editingUnit.id, { name, short_name, multiplier, base_unit })
                toast.success('Unit updated')
            } else {
                await createUnit({ name, short_name, multiplier, base_unit })
                toast.success('Unit created')
            }
            setIsFormOpen(false)
            // Refresh logic - in a real app we'd revalidate or update state
            window.location.reload()
        } catch (err) {
            toast.error('Failed to save unit')
        }
    }

    const renderCard = (row: any) => (
        <div
            className={`group p-6 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden h-full flex flex-col justify-between cursor-pointer ${!row.base_unit
                ? 'bg-white border-indigo-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-900/5'
                : 'bg-gray-50 border-transparent hover:bg-white hover:border-gray-200'
                }`}
            onClick={() => { setEditingUnit(row); setIsFormOpen(true); }}
        >
            <div className="flex justify-between items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${!row.base_unit ? 'bg-indigo-100 text-indigo-600' : 'bg-white text-gray-400'
                    }`}>
                    {!row.base_unit ? <Scale size={24} /> : <Box size={24} />}
                </div>
                {!row.base_unit && (
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black uppercase tracking-widest text-[10px]">
                        Primary Node
                    </Badge>
                )}
            </div>

            <div>
                <h4 className="text-xl font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {row.name}
                </h4>
                {row.base_unit_name && (
                    <p className="text-xs text-gray-400 font-medium mb-3">
                        Packaging unit for <span className="text-gray-600">{row.base_unit_name}</span>
                    </p>
                )}

                <div className="flex items-center gap-2 mt-4">
                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[10px] font-bold">
                        {row.multiplier}x SCALE
                    </Badge>
                    <Badge className="bg-gray-50 text-gray-500 border-gray-100 text-[10px] font-bold">
                        {row.product_count || 0} SKUS
                    </Badge>
                </div>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <TypicalListView
                title="Units & Packaging"
                data={data}
                loading={loading}
                getRowId={r => r.id}
                columns={columns}
                visibleColumns={settings.visibleColumns}
                onToggleColumn={settings.toggleColumn}
                pageSize={settings.pageSize}
                onPageSizeChange={settings.setPageSize}
                sortKey={settings.sortKey}
                sortDir={settings.sortDir}
                onSort={settings.setSort}
                onAdd={() => { setEditingUnit(null); setIsFormOpen(true); }}
                addLabel="ADD UNIT"
                renderCard={renderCard}
                renderExpanded={(row: any) => <ProductList unitId={row.id} />}
                headerExtras={
                    <Link
                        href="/inventory/maintenance?tab=unit"
                        className="text-xs font-bold text-gray-400 hover:text-emerald-600 transition-colors flex items-center gap-1.5 ml-2"
                    >
                        <Wrench size={14} />
                        <span>Reorganize</span>
                    </Link>
                }
                actions={{
                    onEdit: (r) => { setEditingUnit(r); setIsFormOpen(true); },
                    onDelete: async (r) => {
                        if (confirm(`Delete unit ${r.name}?`)) {
                            await deleteUnit(r.id)
                            window.location.reload()
                        }
                    }
                }}
            >
                <TypicalFilter
                    search={{
                        placeholder: "Search units by name, short name...",
                        value: "",
                        onChange: () => { }
                    }}
                />
            </TypicalListView>

            {/* Quick Calculator */}
            <div className="mt-8">
                <UnitCalculator units={data} />
            </div>

            {isFormOpen && (
                <UnitFormModal
                    unit={editingUnit}
                    potentialParents={data.filter(u => !u.base_unit)} // Only allow base units as parents for simplicity in this UI
                    onClose={() => setIsFormOpen(false)}
                    onSave={handleSave}
                />
            )}
        </div>
    )
}

function UnitFormModal({ unit, potentialParents, onClose, onSave }: { unit?: any, potentialParents: any[], onClose: () => void, onSave: (f: FormData) => Promise<void> }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-900">
                            {unit ? 'Modify Unit' : 'Define Unit'}
                        </h3>
                        <p className="text-gray-400 text-sm font-medium">Scaling & Packaging Logic</p>
                    </div>
                </div>

                <form action={onSave} className="p-8 space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                            <input name="name" defaultValue={unit?.name} className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-semibold" placeholder="e.g. Dozen" required />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Short Name</label>
                            <input name="short_name" defaultValue={unit?.short_name} className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-mono font-bold uppercase" placeholder="DZ" required />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Base Unit (Parent)</label>
                        <select
                            name="base_unit"
                            defaultValue={unit?.base_unit || ''}
                            className="w-full h-12 px-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-semibold appearance-none"
                        >
                            <option value="">No Base Unit (This is a Base unit)</option>
                            {potentialParents.filter(p => p.id !== unit?.id).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Scaling Multiplier</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-300">x</span>
                            <input name="multiplier" type="number" step="0.0001" defaultValue={unit?.multiplier || 1} className="w-full h-12 pl-8 pr-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-bold" placeholder="1.0000" required />
                        </div>
                        <p className="text-[10px] text-gray-400 italic mt-1 px-1">Example: Box of 12 has multiplier 12.0</p>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 h-12 rounded-xl border border-gray-100 font-bold text-gray-400 hover:bg-gray-50 transition-colors">Cancel</button>
                        <button type="submit" className="flex-1 h-12 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                            <Calculator size={18} /> Save Logic
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
