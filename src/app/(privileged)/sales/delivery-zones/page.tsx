'use client'

import { useState, useEffect, useMemo } from "react"
import type { DeliveryZone } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
    MapPin, Plus, DollarSign, Clock, Layers, Edit2, Trash2, X, Check
} from "lucide-react"

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default function DeliveryZonesPage() {
    const [zones, setZones] = useState<DeliveryZone[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editId, setEditId] = useState<number | null>(null)
    const [form, setForm] = useState({ name: '', description: '', base_fee: '0', estimated_days: '1', is_active: true })

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('pos/delivery-zones/')
            setZones(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load zones")
        } finally {
            setLoading(false)
        }
    }

    function startEdit(zone: Record<string, any>) {
        setEditId(zone.id)
        setForm({
            name: zone.name || '',
            description: zone.description || '',
            base_fee: String(zone.base_fee || 0),
            estimated_days: String(zone.estimated_days || 1),
            is_active: zone.is_active !== false,
        })
        setShowForm(true)
    }

    function startCreate() {
        setEditId(null)
        setForm({ name: '', description: '', base_fee: '0', estimated_days: '1', is_active: true })
        setShowForm(true)
    }

    async function handleSave() {
        if (!form.name.trim()) { toast.error("Name is required"); return }
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const payload = {
                name: form.name,
                description: form.description,
                base_fee: form.base_fee,
                estimated_days: parseInt(form.estimated_days) || 1,
                is_active: form.is_active,
            }
            if (editId) {
                await erpFetch(`pos/delivery-zones/${editId}/`, { method: 'PATCH', body: JSON.stringify(payload) })
                toast.success("Zone updated")
            } else {
                await erpFetch('pos/delivery-zones/', { method: 'POST', body: JSON.stringify(payload) })
                toast.success("Zone created")
            }
            setShowForm(false)
            await loadData()
        } catch {
            toast.error("Failed to save zone")
        }
    }

    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    async function handleDelete() {
        if (deleteTarget === null) return
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            await erpFetch(`pos/delivery-zones/${deleteTarget}/`, { method: 'DELETE' })
            toast.success("Zone deleted")
            await loadData()
        } catch {
            toast.error("Failed to delete zone")
        }
        setDeleteTarget(null)
    }

    const activeZones = zones.filter(z => z.is_active !== false).length
    const avgFee = zones.length > 0 ? zones.reduce((s, z) => s + parseFloat(String(z.base_fee || 0)), 0) / zones.length : 0

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
                            <MapPin size={20} className="text-white" />
                        </div>
                        Delivery Zones
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Configure delivery zones with fees and estimated transit times</p>
                </div>
                <button onClick={startCreate}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-all flex items-center gap-2">
                    <Plus size={16} /> Add Zone
                </button>
            </header>

            <div className="grid grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Layers size={24} className="text-teal-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Total Zones</p>
                                <p className="text-2xl font-bold">{zones.length}</p>
                                <p className="text-[10px] text-gray-400">{activeZones} active</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <DollarSign size={24} className="text-emerald-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Avg Base Fee</p>
                                <p className="text-xl font-bold text-emerald-700">{fmt(avgFee)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
                    <CardContent className="py-4">
                        <div className="flex items-center gap-3">
                            <Clock size={24} className="text-blue-500" />
                            <div>
                                <p className="text-xs text-gray-500 uppercase">Avg Transit</p>
                                <p className="text-2xl font-bold text-blue-700">
                                    {zones.length > 0 ? (zones.reduce((s, z) => s + (z.estimated_days || 0), 0) / zones.length).toFixed(1) : '0'} days
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <Card className="border-2 border-teal-200">
                    <CardHeader className="py-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-base">{editId ? 'Edit Zone' : 'New Zone'}</CardTitle>
                        <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Zone Name *</label>
                                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Abidjan Nord" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
                                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Zone description" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Base Fee (XOF)</label>
                                <Input type="number" value={form.base_fee} onChange={e => setForm({ ...form, base_fee: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-500 block mb-1">Estimated Days</label>
                                <Input type="number" value={form.estimated_days} onChange={e => setForm({ ...form, estimated_days: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 mt-4">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                                Active
                            </label>
                            <div className="ml-auto flex gap-2">
                                <button onClick={() => setShowForm(false)}
                                    className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200">
                                    Cancel
                                </button>
                                <button onClick={handleSave}
                                    className="px-4 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700 flex items-center gap-1">
                                    <Check size={14} /> {editId ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Zone Cards */}
            {zones.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-16 text-gray-400">
                        <MapPin size={48} className="mx-auto mb-3 opacity-30" />
                        <p>No delivery zones configured</p>
                        <button onClick={startCreate} className="mt-3 text-teal-600 text-sm font-medium hover:underline">Create your first zone</button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                    {zones.map(z => (
                        <Card key={z.id} className={`hover:shadow-md transition-all ${z.is_active === false ? 'opacity-50' : ''}`}>
                            <CardContent className="py-4">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                                            <MapPin size={16} className="text-teal-600" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">{z.name}</p>
                                            {z.description && <p className="text-[10px] text-gray-400">{z.description}</p>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => startEdit(z)}
                                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => setDeleteTarget(z.id)}
                                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                                        <p className="text-xs text-gray-400">Base Fee</p>
                                        <p className="font-bold text-sm text-emerald-600">{fmt(parseFloat(String(z.base_fee || 0)))}</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                                        <p className="text-xs text-gray-400">Est. Transit</p>
                                        <p className="font-bold text-sm text-blue-600">{z.estimated_days || 1} day(s)</p>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center justify-between">
                                    <Badge className={z.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}>
                                        {z.is_active !== false ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
<<<<<<< HEAD
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
=======
                onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null) }}
>>>>>>> update-modules
                onConfirm={handleDelete}
                title="Delete Delivery Zone?"
                description="This will permanently remove this delivery zone."
                confirmText="Delete"
                variant="danger"
            />
        </div>
    )
}
