// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createWarehouse, updateWarehouse } from '@/app/actions/inventory/warehouses'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
    X, Building2, Store, Warehouse, Cloud,
    Check, MapPin, Globe, Shield, Phone,
    ArrowRight, Sparkles, Loader2
} from 'lucide-react'

/* ── Type Config ─────────────────────────────────────────────────────────── */

const LOCATION_TYPES = [
    {
        value: 'BRANCH',
        label: 'Branch',
        icon: Building2,
        color: 'var(--app-success)',
        bullets: ['Top-level location', 'Groups stores &\nwarehouses'],
    },
    {
        value: 'STORE',
        label: 'Store',
        icon: Store,
        color: 'var(--app-info)',
        bullets: ['Retail POS', 'Customer-facing\ntransactions'],
    },
    {
        value: 'WAREHOUSE',
        label: 'inventory.warehouse',
        icon: Warehouse,
        color: 'var(--app-warning)',
        bullets: ['Storage hub', 'Fulfillment center'],
    },
    {
        value: 'VIRTUAL',
        label: 'Virtual',
        icon: Cloud,
        color: 'var(--app-primary)',
        bullets: ['Transit stock', 'Virtual inventory pool'],
    },
]

/* ── Props ────────────────────────────────────────────────────────────────── */

interface WarehouseModalProps {
    warehouse?: any
    onClose: () => void
    parentOptions?: { id: number; name: string; country?: number | null; country_name?: string }[]
    defaultParent?: number | null
    countries?: { id: number; name: string; iso2?: string }[]
    defaultCountryId?: number | null
    onSaved?: () => void | Promise<void>
}

/* ── Component ───────────────────────────────────────────────────────────── */

export default function WarehouseModal({
    warehouse,
    onClose,
    parentOptions = [],
    defaultParent = null,
    countries = [],
    defaultCountryId = null,
    onSaved,
}: WarehouseModalProps) {
    const router = useRouter()
    const isEditing = !!warehouse

    // Form state
    const [locationType, setLocationType] = useState(warehouse?.location_type || 'BRANCH')
    const [name, setName] = useState(warehouse?.name || '')
    const [code, setCode] = useState(warehouse?.code || '')
    const [address, setAddress] = useState(warehouse?.address || '')
    const [city, setCity] = useState(warehouse?.city || '')
    const [phone, setPhone] = useState(warehouse?.phone || '')
    const [countryId, setCountryId] = useState<number | string>(warehouse?.country || defaultCountryId || '')
    const [vatNumber, setVatNumber] = useState(warehouse?.vat_number || '')
    const [isActive, setIsActive] = useState(warehouse?.is_active !== false)
    const [canSell, setCanSell] = useState(warehouse?.can_sell ?? (locationType === 'STORE'))
    const [parentId, setParentId] = useState<number | string>(warehouse?.parent || defaultParent || '')

    // Auto-create child locations (Branch only, new only)
    const [autoStore, setAutoStore] = useState(true)
    const [autoWarehouse, setAutoWarehouse] = useState(true)

    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState('')

    // When locationType changes, auto-set canSell
    useEffect(() => {
        if (!isEditing) {
            setCanSell(locationType === 'STORE')
            // Branches don't need a parent
            if (locationType === 'BRANCH') setParentId('')
        }
    }, [locationType, isEditing])

    const typeCfg = LOCATION_TYPES.find(t => t.value === locationType) || LOCATION_TYPES[0]

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError('Location name is required')
            return
        }

        setIsPending(true)
        setError('')

        const payload: Record<string, any> = {
            name: name.trim(),
            code: code.trim() || undefined,
            location_type: locationType,
            address: address.trim() || undefined,
            city: city.trim() || undefined,
            phone: phone.trim() || undefined,
            country: countryId || undefined,
            vat_number: vatNumber.trim() || undefined,
            is_active: isActive,
            can_sell: canSell,
            parent: parentId || null,
        }

        // For new branches with auto-create enabled
        if (!isEditing && locationType === 'BRANCH') {
            payload.auto_create_store = autoStore
            payload.auto_create_warehouse = autoWarehouse
        }

        try {
            const formData = new FormData()
            Object.entries(payload).forEach(([k, v]) => {
                if (v !== undefined && v !== null) {
                    formData.set(k, String(v))
                }
            })

            let result: any
            if (isEditing) {
                result = await updateWarehouse(warehouse.id, { message: '' }, formData)
            } else {
                result = await createWarehouse({ message: '' }, formData)
            }

            if (result?.message && result.message !== 'success') {
                setError(result.message)
                setIsPending(false)
                return
            }

            toast.success(isEditing ? 'Location updated' : 'Location created')
            if (onSaved) await onSaved()
            router.refresh()
            onClose()
        } catch (err: any) {
            setError(err?.message || 'Failed to save')
            setIsPending(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-app-surface rounded-2xl shadow-2xl w-full max-w-[1100px] overflow-hidden animate-in fade-in zoom-in-95 duration-300"
                onClick={e => e.stopPropagation()}
            >
                {/* ── Header ──────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                            style={{
                                background: `linear-gradient(135deg, ${typeCfg.color}, color-mix(in srgb, ${typeCfg.color} 70%, transparent))`,
                            }}
                        >
                            <typeCfg.icon size={20} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-app-foreground">
                                {isEditing ? 'Edit Location' : 'New Location'}
                            </h2>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeCfg.color }} />
                                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: typeCfg.color }}>
                                    {typeCfg.value}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-app-surface-2 text-app-muted-foreground hover:text-app-foreground transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* ── Body ─────────────────────────────────────────────── */}
                <form onSubmit={handleSubmit} className="flex">
                    {/* Left: Type Selector */}
                    <div className="w-[260px] shrink-0 border-r border-app-border p-5 space-y-2.5 bg-app-surface-2/30">
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-4 px-1">
                            Location Type
                        </p>
                        {LOCATION_TYPES.map(lt => {
                            const Icon = lt.icon
                            const selected = locationType === lt.value
                            return (
                                <button
                                    key={lt.value}
                                    type="button"
                                    onClick={() => setLocationType(lt.value)}
                                    className={`w-full text-left px-4 py-4 rounded-2xl border-2 transition-all duration-200 relative ${
                                        selected
                                            ? 'shadow-lg scale-[1.02]'
                                            : 'border-transparent hover:border-app-border/50 hover:bg-app-surface'
                                    }`}
                                    style={selected ? {
                                        borderColor: `color-mix(in srgb, ${lt.color} 50%, transparent)`,
                                        background: `color-mix(in srgb, ${lt.color} 8%, var(--app-surface))`,
                                    } : {}}
                                >
                                    {selected && (
                                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center shadow-sm" style={{ backgroundColor: lt.color }}>
                                            <Check size={12} className="text-white" />
                                        </div>
                                    )}
                                    <div className="flex items-center gap-3 mb-2">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
                                            style={{
                                                background: selected
                                                    ? `linear-gradient(135deg, ${lt.color}, color-mix(in srgb, ${lt.color} 70%, transparent))`
                                                    : `color-mix(in srgb, ${lt.color} 12%, transparent)`,
                                                color: selected ? 'white' : lt.color,
                                            }}
                                        >
                                            <Icon size={20} />
                                        </div>
                                        <span className={`text-[14px] font-black ${selected ? 'text-app-foreground' : 'text-app-foreground/70'}`}>{lt.label}</span>
                                    </div>
                                    <div className="pl-[52px] space-y-0.5">
                                        {lt.bullets.map((b, i) => (
                                            <p key={i} className="text-[10px] text-app-muted-foreground flex items-start gap-1.5">
                                                <span className="mt-[3px] w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: lt.color }} /> {b}
                                            </p>
                                        ))}
                                    </div>
                                </button>
                            )
                        })}
                    </div>

                    {/* Right: Form Fields */}
                    <div className="flex-1 p-5 space-y-4 overflow-y-auto max-h-[65vh]">
                        {/* Name + Code */}
                        <div className="grid grid-cols-[1fr_180px] gap-3">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 block">
                                    Location Name <span className="text-app-error">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g., Central Warehouse, Downtown Store..."
                                    className="w-full bg-app-surface border-2 border-app-primary/30 rounded-xl px-4 py-2.5 text-[13px] font-medium text-app-foreground outline-none focus:border-app-primary/60 focus:shadow-lg transition-all placeholder:text-app-muted-foreground/50"
                                    autoFocus
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 block">
                                    Code
                                </label>
                                <input
                                    type="text"
                                    value={code}
                                    onChange={e => setCode(e.target.value.toUpperCase())}
                                    placeholder="Auto-generated"
                                    className="w-full bg-app-surface-2/50 border border-app-border rounded-xl px-4 py-2.5 text-[13px] font-medium text-app-foreground outline-none focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground/40"
                                />
                            </div>
                        </div>

                        {/* Parent (for non-branch types) */}
                        {locationType !== 'BRANCH' && parentOptions.length > 0 && (
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 block">
                                    <Building2 size={10} className="inline mr-1" /> Parent Branch
                                </label>
                                <select
                                    value={parentId}
                                    onChange={e => setParentId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full bg-app-surface border border-app-border rounded-xl px-4 py-2.5 text-[13px] font-medium text-app-foreground outline-none focus:border-app-primary/30 transition-all"
                                >
                                    <option value="">— Select Parent Branch —</option>
                                    {parentOptions.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Physical Address Section */}
                        <div className="bg-app-surface-2/30 rounded-xl p-4 space-y-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-1.5">
                                <MapPin size={11} /> Physical Address
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                <input
                                    type="text"
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    placeholder="Street address..."
                                    className="col-span-1 bg-app-surface border border-app-border rounded-xl px-3 py-2 text-[12px] text-app-foreground outline-none focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground/40"
                                />
                                <input
                                    type="text"
                                    value={city}
                                    onChange={e => setCity(e.target.value)}
                                    placeholder="inventory.city"
                                    className="bg-app-surface border border-app-border rounded-xl px-3 py-2 text-[12px] text-app-foreground outline-none focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground/40"
                                />
                                <div className="relative">
                                    <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground/40" />
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                        placeholder="inventory.phone"
                                        className="w-full bg-app-surface border border-app-border rounded-xl pl-8 pr-3 py-2 text-[12px] text-app-foreground outline-none focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground/40"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="relative">
                                    <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground/40" />
                                    <select
                                        value={countryId}
                                        onChange={e => setCountryId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full bg-app-surface border border-app-border rounded-xl pl-8 pr-3 py-2 text-[12px] text-app-foreground outline-none focus:border-app-primary/30 transition-all"
                                    >
                                        <option value="">— Country —</option>
                                        {countries.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="relative">
                                    <Shield size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground/40" />
                                    <input
                                        type="text"
                                        value={vatNumber}
                                        onChange={e => setVatNumber(e.target.value)}
                                        placeholder="VAT / Tax ID"
                                        className="w-full bg-app-surface border border-app-border rounded-xl pl-8 pr-3 py-2 text-[12px] text-app-foreground outline-none focus:border-app-primary/30 transition-all placeholder:text-app-muted-foreground/40"
                                    />
                                </div>
                            </div>
                            {locationType === 'BRANCH' && (
                                <p className="text-[10px] font-bold text-app-warning flex items-center gap-1">
                                    ⚠ Required — all child locations will inherit this country
                                </p>
                            )}
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2.5">
                                <Sparkles size={14} className="text-app-success" />
                                <div>
                                    <p className="text-[12px] font-bold text-app-foreground">Active</p>
                                    <p className="text-[10px] text-app-muted-foreground">Branch is visible and active</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsActive(!isActive)}
                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                                    isActive ? 'bg-app-success' : 'bg-app-surface-2'
                                }`}
                            >
                                <div className={`absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                    isActive ? 'left-[26px]' : 'left-[2px]'
                                }`} />
                            </button>
                        </div>

                        {/* Auto-Create Child Locations (Branch only, new only) */}
                        {!isEditing && locationType === 'BRANCH' && (
                            <div className="bg-app-surface-2/30 rounded-xl p-4 space-y-3">
                                <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-1.5">
                                    <Building2 size={11} /> Auto-Create Child Locations
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Main Store */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-info) 15%, transparent)', color: 'var(--app-info)' }}>
                                                <Store size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-app-foreground">Main Store</p>
                                                <p className="text-[9px] text-app-muted-foreground">Retail POS point (can sell)</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAutoStore(!autoStore)}
                                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                                autoStore ? 'bg-app-info' : 'bg-app-surface-2'
                                            }`}
                                        >
                                            <div className={`absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                                autoStore ? 'left-[22px]' : 'left-[2px]'
                                            }`} />
                                        </button>
                                    </div>
                                    {/* Main Warehouse */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-warning)' }}>
                                                <Warehouse size={14} />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-bold text-app-foreground">Main Warehouse</p>
                                                <p className="text-[9px] text-app-muted-foreground">Storage hub (no sales)</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAutoWarehouse(!autoWarehouse)}
                                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                                autoWarehouse ? 'bg-app-warning' : 'bg-app-surface-2'
                                            }`}
                                        >
                                            <div className={`absolute top-[2px] w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                                autoWarehouse ? 'left-[22px]' : 'left-[2px]'
                                            }`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="bg-app-error/10 border border-app-error/20 rounded-xl px-4 py-2.5 text-[12px] font-bold text-app-error">
                                {error}
                            </div>
                        )}
                    </div>
                </form>

                {/* ── Footer ──────────────────────────────────────────── */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-app-border bg-app-surface-2/20">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-[12px] font-bold text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface border border-app-border transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending}
                        className="px-6 py-2.5 rounded-xl text-[12px] font-bold text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                        style={{
                            background: `linear-gradient(135deg, ${typeCfg.color}, color-mix(in srgb, ${typeCfg.color} 80%, black))`,
                        }}
                    >
                        {isPending ? (
                            <><Loader2 size={14} className="animate-spin" /> Saving...</>
                        ) : (
                            <>{isEditing ? 'Update Location' : 'Create Location'} <ArrowRight size={14} /></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}