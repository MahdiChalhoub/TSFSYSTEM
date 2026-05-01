'use client'

import { useState, useTransition } from 'react'
import {
    DeliveryZone, ShippingRate, ShippingRatePayload,
    createShippingRate, deleteShippingRate, getShippingRates,
} from '@/app/actions/ecommerce/shipping'
import { Truck, Plus, Trash2, MapPin, Package } from 'lucide-react'

interface Props { initialZones: DeliveryZone[]; initialRates: ShippingRate[] }

const emptyForm = (zoneId: number): ShippingRatePayload => ({
    zone: zoneId, min_order_value: '0', max_order_value: null,
    min_weight_kg: '0', max_weight_kg: null, fee: '0',
    estimated_days: null, is_active: true, sort_order: 0,
})

export default function ShippingClient({ initialZones, initialRates }: Props) {
    const [selectedZoneId, setSelectedZoneId] = useState<number | null>(initialZones[0]?.id ?? null)
    const [rates, setRates] = useState(initialRates)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState<ShippingRatePayload>(emptyForm(initialZones[0]?.id ?? 0))
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    const selectedZone = initialZones.find(z => z.id === selectedZoneId)
    const zoneRates = rates.filter(r => r.zone === selectedZoneId)

    const handleSelectZone = (zoneId: number) => {
        setSelectedZoneId(zoneId)
        setForm(emptyForm(zoneId))
        startTransition(async () => {
            const fetched = await getShippingRates(zoneId)
            setRates(prev => [...prev.filter(r => r.zone !== zoneId), ...fetched])
        })
    }

    const handleCreate = () => {
        setError('')
        startTransition(async () => {
            const payload = { ...form, zone: selectedZoneId! }
            const res = await createShippingRate(payload)
            if (!res.ok) { setError(res.error ?? 'Failed'); return }
            setRates(prev => [...prev, res.rate!])
            setShowModal(false)
            setForm(emptyForm(selectedZoneId!))
        })
    }

    const handleDelete = (id: number) => {
        if (!confirm('Delete this shipping tier?')) return
        startTransition(async () => {
            await deleteShippingRate(id)
            setRates(prev => prev.filter(r => r.id !== id))
        })
    }

    const fFee = (v: string) => {
        const n = parseFloat(v)
        return n === 0 ? <span className="text-app-success font-bold text-xs">FREE</span> : n.toLocaleString()
    }

    return (
        <div className="app-page">
            {/* Header */}
            <div className="app-page-header">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#06b6d4' }}>
                        <Truck size={18} color="#fff" />
                    </div>
                    <div>
                        <h1 className="app-page-title">Shipping Rates</h1>
                        <p className="app-page-subtitle">Value and weight-based fee tiers per delivery zone</p>
                    </div>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Zones', value: initialZones.length, icon: MapPin, color: '#06b6d4' },
                    { label: 'Tiers in Zone', value: zoneRates.length, icon: Truck, color: '#10b981' },
                    { label: 'Total Tiers', value: rates.length, icon: Package, color: '#8b5cf6' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="app-card flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                            <Icon size={18} style={{ color }} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-[var(--app-text)]">{value}</p>
                            <p className="text-xs text-[var(--app-text-muted)]">{label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main layout */}
            <div className="flex gap-5">
                {/* Zone sidebar */}
                <div className="w-56 shrink-0 app-card p-0 overflow-hidden self-start">
                    <div className="px-4 py-3 border-b border-[var(--app-border)]">
                        <p className="text-xs font-bold text-[var(--app-text-muted)] uppercase tracking-wider">Zones</p>
                    </div>
                    {initialZones.length === 0 ? (
                        <p className="p-4 text-xs text-[var(--app-text-muted)]">No zones configured</p>
                    ) : (
                        <div className="divide-y divide-[var(--app-border)]">
                            {initialZones.map(zone => (
                                <button key={zone.id} onClick={() => handleSelectZone(zone.id)} id={`zone-${zone.id}`}
                                    className={`w-full text-left px-4 py-3 transition-colors ${zone.id === selectedZoneId
                                        ? 'bg-[var(--app-accent)]/10 border-l-2 border-[var(--app-accent)]'
                                        : 'hover:bg-[var(--app-surface-hover)]'}`}>
                                    <div className="flex items-center gap-2">
                                        <MapPin size={12} className={zone.id === selectedZoneId ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'} />
                                        <p className={`text-sm font-medium ${zone.id === selectedZoneId ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'}`}>
                                            {zone.name}
                                        </p>
                                    </div>
                                    <p className="text-xs text-[var(--app-text-muted)] mt-1 pl-5">
                                        Base: {parseFloat(zone.base_fee).toLocaleString()} · {zone.estimated_days}d
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Rate tiers */}
                <div className="flex-1 app-card p-0 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--app-border)]">
                        <div>
                            <p className="text-sm font-semibold text-[var(--app-text)]">
                                {selectedZone?.name ?? 'Select a zone'} — Rate Tiers
                            </p>
                            <p className="text-xs text-[var(--app-text-muted)]">
                                First match wins · fallback to zone base fee
                            </p>
                        </div>
                        {selectedZoneId && (
                            <button onClick={() => setShowModal(true)} className="app-btn app-btn-primary text-sm flex items-center gap-1.5" id="add-rate-btn">
                                <Plus size={14} /> Add Tier
                            </button>
                        )}
                    </div>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--app-border)]">
                                {['Order Range', 'Weight Range', 'Fee', 'Days', '#', 'Active', ''].map(h => (
                                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {zoneRates.length === 0 && (
                                <tr><td colSpan={7} className="py-14 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#06b6d418' }}>
                                            <Truck size={20} style={{ color: '#06b6d4' }} />
                                        </div>
                                        <p className="font-semibold text-[var(--app-text)] text-sm">
                                            {selectedZoneId ? 'No tiers yet' : 'Select a zone'}
                                        </p>
                                        <p className="text-xs text-[var(--app-text-muted)]">
                                            {selectedZoneId ? 'Add your first shipping tier' : 'Choose a zone to manage its rates'}
                                        </p>
                                    </div>
                                </td></tr>
                            )}
                            {zoneRates.map(r => (
                                <tr key={r.id} className="border-b border-[var(--app-border)] hover:bg-[var(--app-surface-hover)] transition-colors">
                                    <td className="px-4 py-3 font-mono text-xs text-[var(--app-text)]">
                                        ≥{parseFloat(r.min_order_value).toLocaleString()}
                                        {r.max_order_value ? ` → ${parseFloat(r.max_order_value).toLocaleString()}` : '+'}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs text-[var(--app-text-muted)]">
                                        ≥{r.min_weight_kg}kg{r.max_weight_kg ? ` → ${r.max_weight_kg}kg` : '+'}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-[var(--app-text)]">{fFee(r.fee)}</td>
                                    <td className="px-4 py-3 text-[var(--app-text-muted)]">
                                        {r.estimated_days ?? selectedZone?.estimated_days}d
                                    </td>
                                    <td className="px-4 py-3 text-[var(--app-text-muted)]">{r.sort_order}</td>
                                    <td className="px-4 py-3">
                                        <span className={`w-2 h-2 rounded-full inline-block ${r.is_active ? 'bg-app-success' : 'bg-[var(--app-border)]'}`} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleDelete(r.id)} id={`delete-rate-${r.id}`}
                                            className="p-1.5 rounded-lg text-[var(--app-text-muted)] hover:text-app-error hover:bg-rose-500/10 transition-all">
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && selectedZoneId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="app-card w-full max-w-md space-y-5">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#06b6d4' }}>
                                <Plus size={16} color="#fff" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-[var(--app-text)]">Add Rate Tier</h2>
                                <p className="text-xs text-[var(--app-text-muted)]">{selectedZone?.name}</p>
                            </div>
                        </div>
                        {error && <p className="text-app-error text-sm bg-rose-500/10 px-3 py-2 rounded-lg">{error}</p>}
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider">Order Value Range</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="app-label">Min Value</label>
                                    <input id="rate-min-order" type="number" className="app-input" value={form.min_order_value ?? '0'}
                                        onChange={e => setForm(p => ({ ...p, min_order_value: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="app-label">Max Value</label>
                                    <input id="rate-max-order" type="number" className="app-input" placeholder="No limit"
                                        onChange={e => setForm(p => ({ ...p, max_order_value: e.target.value || null }))} />
                                </div>
                            </div>
                            <p className="text-xs font-semibold text-[var(--app-text-muted)] uppercase tracking-wider pt-1">Weight Range (kg)</p>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="app-label">Min Weight</label>
                                    <input id="rate-min-weight" type="number" step="0.001" className="app-input" value={form.min_weight_kg ?? '0'}
                                        onChange={e => setForm(p => ({ ...p, min_weight_kg: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="app-label">Max Weight</label>
                                    <input id="rate-max-weight" type="number" step="0.001" className="app-input" placeholder="No limit"
                                        onChange={e => setForm(p => ({ ...p, max_weight_kg: e.target.value || null }))} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="app-label">Fee (0 = free)</label>
                                    <input id="rate-fee" type="number" className="app-input" value={form.fee}
                                        onChange={e => setForm(p => ({ ...p, fee: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="app-label">Days Override</label>
                                    <input id="rate-days" type="number" className="app-input" placeholder={`${selectedZone?.estimated_days}d`}
                                        onChange={e => setForm(p => ({ ...p, estimated_days: e.target.value ? +e.target.value : null }))} />
                                </div>
                            </div>
                            <div>
                                <label className="app-label">Sort Order</label>
                                <input id="rate-sort" type="number" className="app-input" value={form.sort_order ?? 0}
                                    onChange={e => setForm(p => ({ ...p, sort_order: +e.target.value }))} />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setShowModal(false)} className="app-btn app-btn-ghost flex-1">Cancel</button>
                            <button id="rate-submit" onClick={handleCreate} disabled={isPending} className="app-btn app-btn-primary flex-1">
                                {isPending ? 'Adding…' : 'Add Tier'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
