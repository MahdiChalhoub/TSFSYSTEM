'use client'

import { useState, useEffect } from 'react'
import { getWarehouseZones, getAisles, createAisle, getRacks, createRack, getShelves, createShelf, getBins, createBin } from '@/app/actions/inventory/locations'
import { getWarehouses } from '@/app/actions/inventory/warehouses'
import { Building2, ChevronRight, ChevronDown, Plus, MapPin, Layers, Grid3X3, Package, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

type Warehouse = { id: number; name: string; code: string }
type Zone = { id: number; name: string; code: string; zone_type: string }
type Aisle = { id: number; name: string; code: string }
type Rack = { id: number; name: string; code: string; rack_type?: string }
type Shelf = { id: number; name: string; code: string; shelf_level?: number }
type Bin = { id: number; name: string; code: string; max_weight?: number }

function AddForm({ placeholder, onSave, onCancel }: { placeholder: string; onSave: (name: string, code: string) => Promise<void>; onCancel: () => void }) {
    const [name, setName] = useState('')
    const [code, setCode] = useState('')
    const [saving, setSaving] = useState(false)

    async function handle() {
        if (!name || !code) return
        setSaving(true)
        await onSave(name, code)
        setSaving(false)
    }

    return (
        <div className="flex gap-2 my-2 ml-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder={`${placeholder} name`} className="flex-1 bg-[#070D1B] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-600" />
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Code" className="w-24 bg-[#070D1B] border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-600" />
            <button onClick={handle} disabled={saving} className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50">
                {saving ? '...' : 'Add'}
            </button>
            <button onClick={onCancel} className="px-2 py-1 rounded-lg bg-gray-800 text-gray-400 text-xs hover:bg-gray-700">✕</button>
        </div>
    )
}

export default function WarehouseLocationsPage() {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [selectedWH, setSelectedWH] = useState<Warehouse | null>(null)
    const [zones, setZones] = useState<Zone[]>([])
    const [aisles, setAisles] = useState<Record<number, Aisle[]>>({})
    const [racks, setRacks] = useState<Record<number, Rack[]>>({})
    const [shelves, setShelves] = useState<Record<number, Shelf[]>>({})
    const [bins, setBins] = useState<Record<number, Bin[]>>({})
    const [expanded, setExpanded] = useState<Record<string, boolean>>({})
    const [adding, setAdding] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

    useEffect(() => { loadWarehouses() }, [])

    async function loadWarehouses() {
        try {
            const data = await getWarehouses()
            const list = Array.isArray(data) ? data : (data?.results ?? [])
            setWarehouses(list)
            if (list.length > 0) selectWarehouse(list[0])
        } catch { /* no warehouses */ }
    }

    async function selectWarehouse(wh: Warehouse) {
        setSelectedWH(wh)
        setLoading(true)
        const z = await getWarehouseZones(wh.id)
        setZones(Array.isArray(z) ? z : [])
        setLoading(false)
    }

    async function toggle(key: string) {
        setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
    }

    async function loadAisles(zoneId: number) {
        if (aisles[zoneId]) return toggle(`zone-${zoneId}`)
        const data = await getAisles(zoneId)
        setAisles(prev => ({ ...prev, [zoneId]: Array.isArray(data) ? data : [] }))
        toggle(`zone-${zoneId}`)
    }

    async function loadRacks(aisleId: number) {
        if (racks[aisleId]) return toggle(`aisle-${aisleId}`)
        const data = await getRacks(aisleId)
        setRacks(prev => ({ ...prev, [aisleId]: Array.isArray(data) ? data : [] }))
        toggle(`aisle-${aisleId}`)
    }

    async function loadShelves(rackId: number) {
        if (shelves[rackId]) return toggle(`rack-${rackId}`)
        const data = await getShelves(rackId)
        setShelves(prev => ({ ...prev, [rackId]: Array.isArray(data) ? data : [] }))
        toggle(`rack-${rackId}`)
    }

    async function loadBins(shelfId: number) {
        if (bins[shelfId]) return toggle(`shelf-${shelfId}`)
        const data = await getBins(shelfId)
        setBins(prev => ({ ...prev, [shelfId]: Array.isArray(data) ? data : [] }))
        toggle(`shelf-${shelfId}`)
    }

    function showToast(msg: string, type: 'ok' | 'err') {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const ZONE_COLORS: Record<string, string> = {
        RECEIVING: 'bg-amber-900/30 text-amber-400 border-amber-800',
        STORAGE: 'bg-blue-900/30 text-blue-400 border-blue-800',
        PICKING: 'bg-purple-900/30 text-purple-400 border-purple-800',
        SHIPPING: 'bg-emerald-900/30 text-emerald-400 border-emerald-800',
    }

    return (
        <div className="min-h-screen bg-[#070D1B] text-gray-100 p-6 flex flex-col gap-6">
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-medium border ${toast.type === 'ok' ? 'bg-emerald-900/80 border-emerald-700 text-emerald-300' : 'bg-red-900/80 border-red-700 text-red-300'}`}>
                    {toast.type === 'ok' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {toast.msg}
                </div>
            )}

            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
                    <MapPin size={22} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Location Management</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Manage zones, aisles, racks, shelves, and bins</p>
                </div>
            </div>

            <div className="flex gap-6">
                {/* Warehouse selector */}
                <div className="w-56 flex flex-col gap-2 shrink-0">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Warehouses</h3>
                    {warehouses.map(wh => (
                        <button
                            key={wh.id}
                            onClick={() => selectWarehouse(wh)}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${selectedWH?.id === wh.id ? 'bg-sky-900/30 border-sky-700 text-sky-300' : 'bg-[#0F1729] border-gray-800 hover:border-gray-700 text-gray-300'}`}
                        >
                            <Building2 size={14} className="shrink-0" />
                            <div>
                                <div className="text-sm font-medium">{wh.name}</div>
                                <div className="text-xs text-gray-500 font-mono">{wh.code}</div>
                            </div>
                        </button>
                    ))}
                </div>

                {/* Location tree */}
                <div className="flex-1 bg-[#0F1729] rounded-2xl border border-gray-800 p-4 overflow-y-auto max-h-[75vh]">
                    {loading ? (
                        <div className="flex flex-col gap-2">
                            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-10 bg-gray-800/50 rounded-xl animate-pulse" />)}
                        </div>
                    ) : zones.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-3">
                            <Layers size={40} className="opacity-20" />
                            <p className="text-sm">No zones found. Add zones from the warehouse settings.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {zones.map(zone => (
                                <div key={zone.id}>
                                    {/* Zone row */}
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => loadAisles(zone.id)} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-gray-800/60 transition-colors text-left">
                                            {expanded[`zone-${zone.id}`] ? <ChevronDown size={14} className="text-gray-500 shrink-0" /> : <ChevronRight size={14} className="text-gray-500 shrink-0" />}
                                            <Layers size={14} className="text-sky-400 shrink-0" />
                                            <span className="font-medium text-sm text-white">{zone.name}</span>
                                            <span className="font-mono text-xs text-gray-500">{zone.code}</span>
                                            {zone.zone_type && <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] border font-bold ${ZONE_COLORS[zone.zone_type] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>{zone.zone_type}</span>}
                                        </button>
                                        <button onClick={() => setAdding(`aisle-in-zone-${zone.id}`)} className="p-1.5 rounded-lg text-gray-600 hover:text-sky-400 hover:bg-sky-900/20 transition-colors">
                                            <Plus size={12} />
                                        </button>
                                    </div>

                                    {adding === `aisle-in-zone-${zone.id}` && (
                                        <AddForm
                                            placeholder="Aisle"
                                            onSave={async (name, code) => {
                                                await createAisle({ name, code, zone: zone.id })
                                                const data = await getAisles(zone.id)
                                                setAisles(prev => ({ ...prev, [zone.id]: Array.isArray(data) ? data : [] }))
                                                setAdding(null)
                                                showToast('Aisle added', 'ok')
                                            }}
                                            onCancel={() => setAdding(null)}
                                        />
                                    )}

                                    {expanded[`zone-${zone.id}`] && (aisles[zone.id] || []).map(aisle => (
                                        <div key={aisle.id} className="ml-6">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => loadRacks(aisle.id)} className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-800/40 transition-colors text-left">
                                                    {expanded[`aisle-${aisle.id}`] ? <ChevronDown size={12} className="text-gray-600 shrink-0" /> : <ChevronRight size={12} className="text-gray-600 shrink-0" />}
                                                    <Grid3X3 size={12} className="text-purple-400 shrink-0" />
                                                    <span className="text-sm text-gray-200">{aisle.name}</span>
                                                    <span className="font-mono text-xs text-gray-600">{aisle.code}</span>
                                                </button>
                                                <button onClick={() => setAdding(`rack-in-aisle-${aisle.id}`)} className="p-1 rounded-lg text-gray-600 hover:text-purple-400 hover:bg-purple-900/20 transition-colors">
                                                    <Plus size={11} />
                                                </button>
                                            </div>

                                            {adding === `rack-in-aisle-${aisle.id}` && (
                                                <AddForm
                                                    placeholder="Rack"
                                                    onSave={async (name, code) => {
                                                        await createRack({ name, code, aisle: aisle.id })
                                                        const data = await getRacks(aisle.id)
                                                        setRacks(prev => ({ ...prev, [aisle.id]: Array.isArray(data) ? data : [] }))
                                                        setAdding(null)
                                                        showToast('Rack added', 'ok')
                                                    }}
                                                    onCancel={() => setAdding(null)}
                                                />
                                            )}

                                            {expanded[`aisle-${aisle.id}`] && (racks[aisle.id] || []).map(rack => (
                                                <div key={rack.id} className="ml-6">
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => loadShelves(rack.id)} className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-800/30 transition-colors text-left">
                                                            {expanded[`rack-${rack.id}`] ? <ChevronDown size={11} className="text-gray-700 shrink-0" /> : <ChevronRight size={11} className="text-gray-700 shrink-0" />}
                                                            <Layers size={11} className="text-amber-400 shrink-0" />
                                                            <span className="text-sm text-gray-300">{rack.name}</span>
                                                            <span className="font-mono text-xs text-gray-600">{rack.code}</span>
                                                        </button>
                                                        <button onClick={() => setAdding(`shelf-in-rack-${rack.id}`)} className="p-1 rounded-lg text-gray-600 hover:text-amber-400 hover:bg-amber-900/20 transition-colors">
                                                            <Plus size={10} />
                                                        </button>
                                                    </div>

                                                    {adding === `shelf-in-rack-${rack.id}` && (
                                                        <AddForm
                                                            placeholder="Shelf"
                                                            onSave={async (name, code) => {
                                                                await createShelf({ name, code, rack: rack.id })
                                                                const data = await getShelves(rack.id)
                                                                setShelves(prev => ({ ...prev, [rack.id]: Array.isArray(data) ? data : [] }))
                                                                setAdding(null)
                                                                showToast('Shelf added', 'ok')
                                                            }}
                                                            onCancel={() => setAdding(null)}
                                                        />
                                                    )}

                                                    {expanded[`rack-${rack.id}`] && (shelves[rack.id] || []).map(shelf => (
                                                        <div key={shelf.id} className="ml-6">
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={() => loadBins(shelf.id)} className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-gray-800/20 transition-colors text-left">
                                                                    {expanded[`shelf-${shelf.id}`] ? <ChevronDown size={10} className="text-gray-700 shrink-0" /> : <ChevronRight size={10} className="text-gray-700 shrink-0" />}
                                                                    <Package size={10} className="text-emerald-400 shrink-0" />
                                                                    <span className="text-xs text-gray-400">{shelf.name}</span>
                                                                    <span className="font-mono text-[10px] text-gray-600">{shelf.code}</span>
                                                                    {shelf.shelf_level != null && <span className="text-[10px] text-gray-600">L{shelf.shelf_level}</span>}
                                                                </button>
                                                                <button onClick={() => setAdding(`bin-in-shelf-${shelf.id}`)} className="p-0.5 rounded text-gray-700 hover:text-emerald-400 transition-colors">
                                                                    <Plus size={9} />
                                                                </button>
                                                            </div>

                                                            {adding === `bin-in-shelf-${shelf.id}` && (
                                                                <AddForm
                                                                    placeholder="Bin"
                                                                    onSave={async (name, code) => {
                                                                        await createBin({ name, code, shelf: shelf.id })
                                                                        const data = await getBins(shelf.id)
                                                                        setBins(prev => ({ ...prev, [shelf.id]: Array.isArray(data) ? data : [] }))
                                                                        setAdding(null)
                                                                        showToast('Bin added', 'ok')
                                                                    }}
                                                                    onCancel={() => setAdding(null)}
                                                                />
                                                            )}

                                                            {expanded[`shelf-${shelf.id}`] && (
                                                                <div className="ml-6 flex flex-wrap gap-1.5 py-1">
                                                                    {(bins[shelf.id] || []).map(bin => (
                                                                        <span key={bin.id} className="px-2 py-1 rounded-lg bg-emerald-900/20 border border-emerald-900/40 text-emerald-400 text-[10px] font-mono">
                                                                            {bin.code}
                                                                        </span>
                                                                    ))}
                                                                    {(bins[shelf.id] || []).length === 0 && (
                                                                        <span className="text-[10px] text-gray-700 py-1">No bins</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 flex-wrap">
                {[
                    { label: 'Zone', color: 'text-sky-400', icon: Layers },
                    { label: 'Aisle', color: 'text-purple-400', icon: Grid3X3 },
                    { label: 'Rack', color: 'text-amber-400', icon: Layers },
                    { label: 'Shelf', color: 'text-emerald-400', icon: Package },
                    { label: 'Bin', color: 'text-emerald-400', icon: Package },
                ].map(({ label, color, icon: Icon }) => (
                    <div key={label} className={`flex items-center gap-1.5 text-xs ${color}`}>
                        <Icon size={12} />
                        {label}
                    </div>
                ))}
            </div>
        </div>
    )
}
