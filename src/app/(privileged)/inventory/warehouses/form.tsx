'use client'

import { useState, useEffect } from 'react'
import { createWarehouse, updateWarehouse, type WarehouseState } from '@/app/actions/inventory/warehouses'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import {
    X, Building2, Store, Warehouse, Cloud,
    Check, MapPin, Globe, Shield, Phone,
    ArrowRight, Sparkles, Loader2, GitBranch,
    FileText, Share2
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
 *  TYPE CONFIG
 * ═══════════════════════════════════════════════════════════ */

const LOCATION_TYPES = [
    {
        value: 'BRANCH',
        label: 'Branch',
        icon: Building2,
        color: 'var(--app-success)',
        desc: 'Top-level location',
    },
    {
        value: 'STORE',
        label: 'Store',
        icon: Store,
        color: 'var(--app-info)',
        desc: 'Retail POS point',
    },
    {
        value: 'WAREHOUSE',
        label: 'Warehouse',
        icon: Warehouse,
        color: 'var(--app-warning)',
        desc: 'Storage / fulfillment',
    },
    {
        value: 'VIRTUAL',
        label: 'Virtual',
        icon: Cloud,
        color: 'var(--app-primary)',
        desc: 'Transit / virtual pool',
    },
]

/* ═══════════════════════════════════════════════════════════
 *  PROPS
 * ═══════════════════════════════════════════════════════════ */

type WarehouseInput = {
    id?: number
    name?: string
    code?: string
    location_type?: string
    address?: string
    city?: string
    phone?: string
    country?: number | null
    vat_number?: string
    is_active?: boolean
    can_sell?: boolean
    parent?: number | null
    tax_policy_mode?: 'INHERIT' | 'CUSTOM' | string
    tax_policy?: number | null
    product_sharing_scope?: 'NONE' | 'SAME_COUNTRY' | 'SELECTED' | 'ALL' | string
    product_sharing_targets?: number[]
}

interface WarehouseModalProps {
    warehouse?: WarehouseInput | null
    onClose: () => void
    parentOptions?: { id: number; name: string; country?: number | null; country_name?: string }[]
    defaultParent?: number | null
    countries?: { id: number; name: string; iso2?: string }[]
    defaultCountryId?: number | null
    taxPolicies?: { id: number; name: string }[]
    allBranches?: { id: number; name: string }[]
    onSaved?: () => void | Promise<void>
}

/* ═══════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════ */

export default function WarehouseModal({
    warehouse,
    onClose,
    parentOptions = [],
    defaultParent = null,
    countries = [],
    defaultCountryId = null,
    taxPolicies = [],
    allBranches = [],
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

    // Phase 2: Tax Engine & Product Sharing (Branch only)
    const [taxPolicyMode, setTaxPolicyMode] = useState(warehouse?.tax_policy_mode || 'INHERIT')
    const [taxPolicyId, setTaxPolicyId] = useState<number | string>(warehouse?.tax_policy || '')
    const [sharingScope, setSharingScope] = useState(warehouse?.product_sharing_scope || 'NONE')
    const [sharingTargets, setSharingTargets] = useState<number[]>(warehouse?.product_sharing_targets || [])

    const [isPending, setIsPending] = useState(false)
    const [error, setError] = useState('')

    // City dropdown state (cascading from country)
    const [cityOptions, setCityOptions] = useState<{ id: number; name: string; state_province?: string; is_capital?: boolean }[]>([])
    const [loadingCities, setLoadingCities] = useState(false)

    // Fetch cities when country changes
    useEffect(() => {
        if (!countryId) {
            setCityOptions([])
            return
        }
        let cancelled = false
        setLoadingCities(true)
        erpFetch(`reference/cities/?country=${countryId}`)
            .then(data => {
                if (cancelled) return
                const items = Array.isArray(data) ? data : (data?.results ?? [])
                setCityOptions(items)
                setLoadingCities(false)
            })
            .catch(() => {
                if (!cancelled) {
                    setCityOptions([])
                    setLoadingCities(false)
                }
            })
        return () => { cancelled = true }
    }, [countryId])

    // When locationType changes, auto-set canSell
    useEffect(() => {
        if (!isEditing) {
            setCanSell(locationType === 'STORE')
            if (locationType === 'BRANCH') setParentId('')
        }
    }, [locationType, isEditing])

    const typeCfg = LOCATION_TYPES.find(t => t.value === locationType) || LOCATION_TYPES[0]

    /* ─── Phone validation: only digits, +, -, (, ), spaces ─── */
    const handlePhoneChange = (val: string) => {
        const cleaned = val.replace(/[^0-9+\-() ]/g, '')
        setPhone(cleaned)
    }

    /* ─── VAT: uppercase alphanumeric + dashes only ─── */
    const handleVatChange = (val: string) => {
        const cleaned = val.replace(/[^A-Za-z0-9\-]/g, '').toUpperCase()
        setVatNumber(cleaned)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) {
            setError('Location name is required')
            return
        }
        if (locationType !== 'BRANCH' && !parentId) {
            setError(`${typeCfg.label} must belong to a Branch`)
            return
        }

        setIsPending(true)
        setError('')

        const payload: Record<string, unknown> = {
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

        // Phase 2 fields (Branch only)
        if (locationType === 'BRANCH') {
            payload.tax_policy_mode = taxPolicyMode
            payload.tax_policy = taxPolicyMode === 'CUSTOM' ? (taxPolicyId || null) : null
            payload.product_sharing_scope = sharingScope
            if (sharingScope === 'SELECTED') {
                payload.product_sharing_targets = sharingTargets
            }
        }

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

            let result: WarehouseState
            if (isEditing && warehouse?.id !== undefined) {
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
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save')
            setIsPending(false)
        }
    }

    /* ═══════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════ */

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-2xl sm:mx-4 sm:rounded-2xl rounded-none overflow-hidden animate-in zoom-in-95 duration-200 sm:max-h-[90vh] max-h-screen flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* ── Header ──────────────────────────────────────────── */}
                <div
                    className="px-4 sm:px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: `color-mix(in srgb, ${typeCfg.color} 6%, var(--app-surface))`, borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: typeCfg.color, boxShadow: `0 4px 12px color-mix(in srgb, ${typeCfg.color} 30%, transparent)` }}
                        >
                            <typeCfg.icon size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-app-foreground">
                                {isEditing ? 'Edit Location' : 'New Location'}
                            </h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground">
                                {isEditing ? `Editing "${warehouse?.name}"` : 'Configure a new location in your hierarchy'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* ── Body ─────────────────────────────────────────────── */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4">

                        {/* ── Section: Location Type ── */}
                        <div>
                            <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground mb-2">
                                Location Type
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {LOCATION_TYPES.map(lt => {
                                    const Icon = lt.icon
                                    const selected = locationType === lt.value
                                    return (
                                        <button
                                            key={lt.value}
                                            type="button"
                                            onClick={() => setLocationType(lt.value)}
                                            className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                                                selected ? 'shadow-md' : 'border-transparent hover:bg-app-surface'
                                            }`}
                                            style={selected ? {
                                                borderColor: `color-mix(in srgb, ${lt.color} 50%, transparent)`,
                                                background: `color-mix(in srgb, ${lt.color} 8%, var(--app-surface))`,
                                            } : { borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                                        >
                                            <div
                                                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                                style={{
                                                    background: selected
                                                        ? lt.color
                                                        : `color-mix(in srgb, ${lt.color} 12%, transparent)`,
                                                    color: selected ? 'white' : lt.color,
                                                }}
                                            >
                                                <Icon size={14} />
                                            </div>
                                            <div className="min-w-0 text-left">
                                                <p className={`text-tp-sm font-bold truncate ${selected ? 'text-app-foreground' : 'text-app-foreground/60'}`}>{lt.label}</p>
                                                <p className="text-tp-xxs text-app-muted-foreground truncate">{lt.desc}</p>
                                            </div>
                                            {selected && (
                                                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: lt.color }}>
                                                    <Check size={8} className="text-white" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* ── Section: Identity ── */}
                        <div
                            className="rounded-xl p-3 sm:p-4 space-y-3"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-background))', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                        >
                            <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex items-center gap-1.5">
                                <GitBranch size={10} /> Identity
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-3">
                                <div>
                                    <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                        Name <span style={{ color: 'var(--app-error)' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        placeholder="e.g., Central Warehouse, Downtown Store..."
                                        className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none focus:border-app-primary/50 focus:ring-2 focus:ring-app-primary/10 transition-all placeholder:text-app-muted-foreground/40"
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">Code</label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, ''))}
                                        placeholder="Auto"
                                        className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md font-mono font-bold text-app-foreground outline-none focus:border-app-primary/50 transition-all placeholder:text-app-muted-foreground/40"
                                    />
                                </div>
                            </div>

                            {/* Parent (non-branch) */}
                            {locationType !== 'BRANCH' && parentOptions.length > 0 && (
                                <div>
                                    <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                        <Building2 size={9} className="inline mr-1" /> Parent Branch <span style={{ color: 'var(--app-error)' }}>*</span>
                                    </label>
                                    <select
                                        value={parentId}
                                        onChange={e => setParentId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none focus:border-app-primary/50 transition-all"
                                        required
                                    >
                                        <option value="">— Select Parent Branch —</option>
                                        {parentOptions.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} {p.country_name ? `(${p.country_name})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* ── Section: Address ── */}
                        <div
                            className="rounded-xl p-3 sm:p-4 space-y-3"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-background))', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                        >
                            <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex items-center gap-1.5">
                                <MapPin size={10} /> Physical Address
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                        <Globe size={9} className="inline mr-1" /> Country
                                        {locationType === 'BRANCH' && <span style={{ color: 'var(--app-error)' }}> *</span>}
                                    </label>
                                    <select
                                        value={countryId}
                                        onChange={e => setCountryId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none focus:border-app-primary/50 transition-all"
                                    >
                                        <option value="">— Select Country —</option>
                                        {countries.map(c => (
                                            <option key={c.id} value={c.id}>{c.name} {c.iso2 ? `(${c.iso2})` : ''}</option>
                                        ))}
                                    </select>
                                    {locationType === 'BRANCH' && (
                                        <p className="text-tp-xxs font-bold mt-1 flex items-center gap-1" style={{ color: 'var(--app-warning)' }}>
                                            ⚠ Children inherit this country
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">City</label>
                                    {cityOptions.length > 0 ? (
                                        <select
                                            value={city}
                                            onChange={e => setCity(e.target.value)}
                                            className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none focus:border-app-primary/50 transition-all"
                                        >
                                            <option value="">— Select City —</option>
                                            {cityOptions.map(c => (
                                                <option key={c.id} value={c.name}>
                                                    {c.name}{c.state_province ? ` (${c.state_province})` : ''}{c.is_capital ? ' ★' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={city}
                                            onChange={e => setCity(e.target.value)}
                                            placeholder={loadingCities ? 'Loading...' : (countryId ? 'Type city name' : 'Select country first')}
                                            disabled={loadingCities}
                                            className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md text-app-foreground outline-none focus:border-app-primary/50 transition-all placeholder:text-app-muted-foreground/40 disabled:opacity-50"
                                        />
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">Street Address</label>
                                <input
                                    type="text"
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    placeholder="Full street address..."
                                    className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md text-app-foreground outline-none focus:border-app-primary/50 transition-all placeholder:text-app-muted-foreground/40"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                        <Phone size={9} className="inline mr-1" /> Phone
                                    </label>
                                    <input
                                        type="tel"
                                        inputMode="tel"
                                        value={phone}
                                        onChange={e => handlePhoneChange(e.target.value)}
                                        placeholder="+961 1 234 567"
                                        className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md font-mono text-app-foreground outline-none focus:border-app-primary/50 transition-all placeholder:text-app-muted-foreground/40"
                                    />
                                </div>
                                <div>
                                    <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                        <Shield size={9} className="inline mr-1" /> VAT / Tax ID
                                    </label>
                                    <input
                                        type="text"
                                        value={vatNumber}
                                        onChange={e => handleVatChange(e.target.value)}
                                        placeholder="e.g., LB12345678"
                                        className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md font-mono text-app-foreground outline-none focus:border-app-primary/50 transition-all placeholder:text-app-muted-foreground/40"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── Section: Settings ── */}
                        <div
                            className="rounded-xl p-3 sm:p-4 space-y-3"
                            style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-background))', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                        >
                            <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex items-center gap-1.5">
                                <Sparkles size={10} /> Settings
                            </p>

                            {/* Active toggle */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                        style={{ background: 'color-mix(in srgb, var(--app-success) 12%, transparent)', color: 'var(--app-success)' }}>
                                        <Sparkles size={11} />
                                    </div>
                                    <div>
                                        <p className="text-tp-sm font-bold text-app-foreground">Active</p>
                                        <p className="text-tp-xxs text-app-muted-foreground">Location is visible and operational</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsActive(!isActive)}
                                    className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${isActive ? 'bg-app-success' : 'bg-app-border'}`}
                                >
                                    <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${isActive ? 'left-[22px]' : 'left-[2px]'}`} />
                                </button>
                            </div>

                            {/* Can Sell toggle */}
                            {locationType !== 'BRANCH' && (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                            style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                                            <Store size={11} />
                                        </div>
                                        <div>
                                            <p className="text-tp-sm font-bold text-app-foreground">Can Sell (POS)</p>
                                            <p className="text-tp-xxs text-app-muted-foreground">Products can be sold from this location</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCanSell(!canSell)}
                                        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${canSell ? 'bg-app-info' : 'bg-app-border'}`}
                                    >
                                        <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${canSell ? 'left-[22px]' : 'left-[2px]'}`} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── Section: Tax Engine (Branch only) ── */}
                        {locationType === 'BRANCH' && (
                            <div
                                className="rounded-xl p-3 sm:p-4 space-y-3"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-background))', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                            >
                                <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex items-center gap-1.5">
                                    <FileText size={10} /> Tax Engine
                                </p>

                                <div className="grid grid-cols-2 gap-1.5">
                                    {(['INHERIT', 'CUSTOM'] as const).map(mode => {
                                        const selected = taxPolicyMode === mode
                                        const cfg = mode === 'INHERIT'
                                            ? { label: 'Inherit from Org', desc: 'Uses organization default', color: 'var(--app-success)' }
                                            : { label: 'Custom Policy', desc: 'Select a specific tax policy', color: 'var(--app-warning)' }
                                        return (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setTaxPolicyMode(mode)}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                                                    selected ? 'shadow-sm' : 'border-transparent'
                                                }`}
                                                style={selected ? {
                                                    borderColor: `color-mix(in srgb, ${cfg.color} 40%, transparent)`,
                                                    background: `color-mix(in srgb, ${cfg.color} 6%, var(--app-surface))`,
                                                } : { borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                                            >
                                                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                                                    style={{ background: selected ? cfg.color : `color-mix(in srgb, ${cfg.color} 12%, transparent)`, color: selected ? 'white' : cfg.color }}>
                                                    {selected ? <Check size={10} /> : <FileText size={10} />}
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <p className={`text-tp-xs font-bold ${selected ? 'text-app-foreground' : 'text-app-foreground/50'}`}>{cfg.label}</p>
                                                    <p className="text-tp-xxs text-app-muted-foreground truncate">{cfg.desc}</p>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                {taxPolicyMode === 'CUSTOM' && (
                                    <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                                        <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                            Select Tax Policy
                                        </label>
                                        {taxPolicies.length > 0 ? (
                                            <select
                                                value={taxPolicyId}
                                                onChange={e => setTaxPolicyId(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2 text-tp-md font-medium text-app-foreground outline-none focus:border-app-primary/50 transition-all"
                                            >
                                                <option value="">— Select Policy —</option>
                                                {taxPolicies.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <p className="text-tp-xs text-app-muted-foreground italic">
                                                No tax policies available. Configure them in Settings → Tax Engine.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Section: Product Sharing (Branch only) ── */}
                        {locationType === 'BRANCH' && (
                            <div
                                className="rounded-xl p-3 sm:p-4 space-y-3"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-background))', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                            >
                                <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex items-center gap-1.5">
                                    <Share2 size={10} /> Product Sharing
                                </p>
                                <p className="text-tp-xxs text-app-muted-foreground -mt-1">
                                    Control which branches can see and sell products from this location
                                </p>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                    {([
                                        { value: 'NONE', label: 'No Sharing', color: 'var(--app-muted-foreground)' },
                                        { value: 'SAME_COUNTRY', label: 'Same Country', color: 'var(--app-info)' },
                                        { value: 'SELECTED', label: 'Selected', color: 'var(--app-warning)' },
                                        { value: 'ALL', label: 'All Branches', color: 'var(--app-success)' },
                                    ] as const).map(opt => {
                                        const selected = sharingScope === opt.value
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setSharingScope(opt.value)}
                                                className={`px-2.5 py-2 rounded-xl border text-center transition-all ${
                                                    selected ? 'shadow-sm' : ''
                                                }`}
                                                style={selected ? {
                                                    borderColor: `color-mix(in srgb, ${opt.color} 50%, transparent)`,
                                                    background: `color-mix(in srgb, ${opt.color} 8%, var(--app-surface))`,
                                                    color: opt.color,
                                                } : { borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)', color: 'var(--app-muted-foreground)' }}
                                            >
                                                <p className={`text-tp-xs font-bold ${selected ? '' : 'opacity-60'}`}>{opt.label}</p>
                                            </button>
                                        )
                                    })}
                                </div>

                                {sharingScope === 'SELECTED' && (
                                    <div className="animate-in fade-in slide-in-from-top-1 duration-150 space-y-2">
                                        <label className="text-tp-xs font-bold text-app-muted-foreground block">
                                            Select Target Branches
                                        </label>
                                        {allBranches.filter(b => b.id !== warehouse?.id).length > 0 ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                                                {allBranches.filter(b => b.id !== warehouse?.id).map(b => {
                                                    const checked = sharingTargets.includes(b.id)
                                                    return (
                                                        <button
                                                            key={b.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSharingTargets(prev =>
                                                                    checked ? prev.filter(id => id !== b.id) : [...prev, b.id]
                                                                )
                                                            }}
                                                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                                                                checked ? 'shadow-sm' : ''
                                                            }`}
                                                            style={checked ? {
                                                                borderColor: 'color-mix(in srgb, var(--app-warning) 50%, transparent)',
                                                                background: 'color-mix(in srgb, var(--app-warning) 6%, var(--app-surface))',
                                                            } : { borderColor: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                                                        >
                                                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                                                                checked ? 'bg-app-warning text-white' : 'border border-app-border'
                                                            }`}>
                                                                {checked && <Check size={9} />}
                                                            </div>
                                                            <span className={`text-tp-sm font-bold truncate ${checked ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>
                                                                {b.name}
                                                            </span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        ) : (
                                            <p className="text-tp-xs text-app-muted-foreground italic">
                                                No other branches available to share with.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Section: Auto-Create (Branch only, new only) ── */}
                        {!isEditing && locationType === 'BRANCH' && (
                            <div
                                className="rounded-xl p-3 sm:p-4 space-y-3"
                                style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-background))', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                            >
                                <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex items-center gap-1.5">
                                    <Building2 size={10} /> Auto-Create Child Locations
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                                style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                                                <Store size={11} />
                                            </div>
                                            <div>
                                                <p className="text-tp-sm font-bold text-app-foreground">Main Store</p>
                                                <p className="text-tp-xxs text-app-muted-foreground">POS point</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAutoStore(!autoStore)}
                                            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${autoStore ? 'bg-app-info' : 'bg-app-border'}`}
                                        >
                                            <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${autoStore ? 'left-[22px]' : 'left-[2px]'}`} />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                                                style={{ background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)', color: 'var(--app-warning)' }}>
                                                <Warehouse size={11} />
                                            </div>
                                            <div>
                                                <p className="text-tp-sm font-bold text-app-foreground">Main Warehouse</p>
                                                <p className="text-tp-xxs text-app-muted-foreground">Storage hub</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setAutoWarehouse(!autoWarehouse)}
                                            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${autoWarehouse ? 'bg-app-warning' : 'bg-app-border'}`}
                                        >
                                            <div className={`absolute top-[2px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${autoWarehouse ? 'left-[22px]' : 'left-[2px]'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Error ── */}
                        {error && (
                            <div
                                className="rounded-xl px-4 py-2.5 text-tp-sm font-bold flex items-center gap-2"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-error) 8%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-error) 25%, transparent)',
                                    color: 'var(--app-error)',
                                }}
                            >
                                <X size={12} />
                                {error}
                            </div>
                        )}
                    </div>

                    {/* ── Footer (INSIDE form) ──────────────────────────── */}
                    <div className="flex items-center justify-end gap-2 px-4 sm:px-5 py-3 flex-shrink-0"
                        style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-surface) 90%, var(--app-background))' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-tp-sm font-bold text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="px-5 py-2 rounded-xl text-tp-sm font-bold text-white hover:brightness-110 transition-all duration-200 disabled:opacity-50 flex items-center gap-1.5"
                            style={{
                                background: typeCfg.color,
                                boxShadow: `0 2px 8px color-mix(in srgb, ${typeCfg.color} 25%, transparent)`,
                            }}
                        >
                            {isPending ? (
                                <><Loader2 size={13} className="animate-spin" /> Saving...</>
                            ) : (
                                <>{isEditing ? 'Update Location' : 'Create Location'} <ArrowRight size={13} /></>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}