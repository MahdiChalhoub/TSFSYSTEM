'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Trash2, Loader2, Globe, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
    createRefPaymentGateway,
    updateRefPaymentGateway,
    type PaymentGatewayPayload,
} from '@/app/actions/reference'
import { runTimed } from '@/lib/perf-timing'

type ConfigField = NonNullable<PaymentGatewayPayload['config_schema']>[number]

interface Props {
    open: boolean
    onClose: () => void
    onSaved: () => void
    initial?: any
}

const EMPTY: PaymentGatewayPayload = {
    code: '',
    name: '',
    provider_family: '',
    logo_emoji: '💳',
    color: 'var(--app-accent)',
    description: '',
    is_global: false,
    country_codes: [],
    config_schema: [],
    website_url: '',
    is_active: true,
    sort_order: 0,
}

export function GatewayEditorDialog({ open, onClose, onSaved, initial }: Props) {
    const [form, setForm] = useState<PaymentGatewayPayload>(EMPTY)
    const [busy, setBusy] = useState(false)
    const [countryInput, setCountryInput] = useState('')

    useEffect(() => {
        if (!open) return
        if (initial) {
            setForm({
                code: initial.code || '',
                name: initial.name || '',
                provider_family: initial.provider_family || '',
                logo_emoji: initial.logo_emoji || '💳',
                color: initial.color || '#6366f1',
                description: initial.description || '',
                is_global: !!initial.is_global,
                country_codes: Array.isArray(initial.country_codes) ? [...initial.country_codes] : [],
                config_schema: Array.isArray(initial.config_schema) ? [...initial.config_schema] : [],
                website_url: initial.website_url || '',
                is_active: initial.is_active ?? true,
                sort_order: initial.sort_order ?? 0,
            })
        } else {
            setForm(EMPTY)
        }
        setCountryInput('')
    }, [open, initial])

    if (!open) return null

    const isEdit = !!initial?.id
    const set = <K extends keyof PaymentGatewayPayload>(k: K, v: PaymentGatewayPayload[K]) =>
        setForm(f => ({ ...f, [k]: v }))

    function addCountry() {
        const code = countryInput.trim().toUpperCase()
        if (!code || code.length !== 2) {
            toast.error('Country code must be 2 letters (ISO 3166-1 alpha-2)')
            return
        }
        if ((form.country_codes || []).includes(code)) {
            setCountryInput('')
            return
        }
        set('country_codes', [...(form.country_codes || []), code])
        setCountryInput('')
    }

    function removeCountry(code: string) {
        set('country_codes', (form.country_codes || []).filter(c => c !== code))
    }

    function addConfigField() {
        set('config_schema', [
            ...(form.config_schema || []),
            { key: '', label: '', type: 'text', required: false } as ConfigField,
        ])
    }

    function updateConfigField(idx: number, patch: Partial<ConfigField>) {
        const next = [...(form.config_schema || [])]
        next[idx] = { ...next[idx], ...patch } as ConfigField
        set('config_schema', next)
    }

    function removeConfigField(idx: number) {
        set('config_schema', (form.config_schema || []).filter((_, i) => i !== idx))
    }

    async function handleSave() {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error('Code and Name are required')
            return
        }
        setBusy(true)
        try {
            const res = isEdit
                ? await runTimed(
                    'saas.payment-gateways:update',
                    () => updateRefPaymentGateway(initial.id, form),
                )
                : await runTimed(
                    'saas.payment-gateways:create',
                    () => createRefPaymentGateway(form),
                )
            if (res.success) {
                toast.success(isEdit ? 'Gateway updated' : 'Gateway created')
                onSaved()
                onClose()
            } else {
                toast.error(res.error || 'Failed to save')
            }
        } finally {
            setBusy(false)
        }
    }

    const inputCls = "w-full text-[12px] font-bold px-3 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none focus:border-app-primary focus:ring-2 focus:ring-app-primary/10 transition-all"
    const labelCls = "text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1.5 block"

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-auto"
             onClick={() => !busy && onClose()}>
            <div onClick={e => e.stopPropagation()}
                 className="w-full max-w-2xl rounded-2xl shadow-2xl my-8"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>

                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4"
                     style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                         style={{ background: `color-mix(in srgb, ${form.color || '#6366f1'} 12%, transparent)` }}>
                        {form.logo_emoji || '💳'}
                    </div>
                    <div className="flex-1">
                        <h2>
                            {isEdit ? 'Edit Payment Gateway' : 'Add Payment Gateway'}
                        </h2>
                        <p className="text-[10px] text-app-muted-foreground">
                            {isEdit ? `${initial.code} · ${initial.name}` : 'Create a new entry in the global catalog'}
                        </p>
                    </div>
                    <button onClick={onClose} disabled={busy}
                            className="p-1.5 rounded-lg hover:bg-app-surface-hover text-app-muted-foreground">
                        <X size={14} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Identity row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Code</label>
                            <input value={form.code} onChange={e => set('code', e.target.value)}
                                   placeholder="stripe, wave_ci, …"
                                   className={`${inputCls} font-mono`} />
                        </div>
                        <div>
                            <label className={labelCls}>Name</label>
                            <input value={form.name} onChange={e => set('name', e.target.value)}
                                   placeholder="Display name" className={inputCls} />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className={labelCls}>Provider Family</label>
                            <input value={form.provider_family || ''} onChange={e => set('provider_family', e.target.value)}
                                   placeholder="wave, stripe, …" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Logo Emoji</label>
                            <input value={form.logo_emoji || ''} onChange={e => set('logo_emoji', e.target.value)}
                                   placeholder="💳" className={`${inputCls} text-center text-lg`} maxLength={4} />
                        </div>
                        <div>
                            <label className={labelCls}>Brand Color</label>
                            <div className="flex gap-2">
                                <input type="color" value={form.color || '#6366f1'} onChange={e => set('color', e.target.value)}
                                       className="w-10 h-9 rounded-lg cursor-pointer border border-app-border" />
                                <input value={form.color || ''} onChange={e => set('color', e.target.value)}
                                       placeholder="#6366f1" className={`${inputCls} font-mono`} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Description</label>
                        <textarea value={form.description || ''} onChange={e => set('description', e.target.value)}
                                  rows={2} placeholder="Short description shown on the catalog card"
                                  className={`${inputCls} resize-none`} />
                    </div>

                    <div>
                        <label className={labelCls}>Website</label>
                        <input value={form.website_url || ''} onChange={e => set('website_url', e.target.value)}
                               placeholder="https://stripe.com" className={inputCls} />
                    </div>

                    {/* Geography */}
                    <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={labelCls.replace('mb-1.5 block', '')}>Geography</span>
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold">
                                <input type="checkbox" checked={!!form.is_global}
                                       onChange={e => set('is_global', e.target.checked)}
                                       className="w-3.5 h-3.5 accent-app-primary" />
                                <Globe size={10} /> Global (worldwide)
                            </label>
                        </div>
                        {!form.is_global && (
                            <>
                                <div className="flex gap-2">
                                    <input value={countryInput} onChange={e => setCountryInput(e.target.value.toUpperCase())}
                                           onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCountry() } }}
                                           placeholder="ISO2 (CI, SN, FR…)" maxLength={2}
                                           className={`${inputCls} font-mono uppercase`} />
                                    <button type="button" onClick={addCountry}
                                            className="px-3 py-2 text-[11px] font-bold rounded-xl border border-app-border hover:bg-app-surface-hover">
                                        <Plus size={12} className="inline" /> Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {(form.country_codes || []).length === 0 && (
                                        <span className="text-[10px] text-app-muted-foreground italic">
                                            No countries — gateway will only show if marked Global.
                                        </span>
                                    )}
                                    {(form.country_codes || []).map(code => (
                                        <button key={code} type="button" onClick={() => removeCountry(code)}
                                                className="text-[10px] font-bold px-2 py-1 rounded-lg hover:line-through transition-all"
                                                style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                                            {code} ✕
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Config schema */}
                    <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <span className={labelCls.replace('mb-1.5 block', '')}>Credential Fields</span>
                                <p className="text-[10px] text-app-muted-foreground">Defines what the tenant must enter when activating.</p>
                            </div>
                            <button type="button" onClick={addConfigField}
                                    className="text-[10px] font-bold px-2 py-1 rounded-lg border border-app-border hover:bg-app-surface-hover">
                                <Plus size={11} className="inline" /> Field
                            </button>
                        </div>
                        {(form.config_schema || []).length === 0 && (
                            <span className="text-[10px] text-app-muted-foreground italic">
                                No credentials needed — tenants just toggle the gateway on/off.
                            </span>
                        )}
                        <div className="space-y-1.5">
                            {(form.config_schema || []).map((f, i) => (
                                <div key={i} className="grid gap-1.5 items-center"
                                     style={{ gridTemplateColumns: '1fr 1fr 110px auto auto' }}>
                                    <input value={f.key || ''} onChange={e => updateConfigField(i, { key: e.target.value })}
                                           placeholder="key (e.g. api_key)"
                                           className={`${inputCls} font-mono`} />
                                    <input value={f.label || ''} onChange={e => updateConfigField(i, { label: e.target.value })}
                                           placeholder="Label" className={inputCls} />
                                    <select value={f.type} onChange={e => updateConfigField(i, { type: e.target.value as ConfigField['type'] })}
                                            className={inputCls}>
                                        <option value="text">text</option>
                                        <option value="password">password</option>
                                        <option value="select">select</option>
                                    </select>
                                    <label className="flex items-center gap-1 cursor-pointer text-[10px] font-bold">
                                        <input type="checkbox" checked={!!f.required}
                                               onChange={e => updateConfigField(i, { required: e.target.checked })}
                                               className="w-3.5 h-3.5 accent-app-primary" />
                                        REQ
                                    </label>
                                    <button type="button" onClick={() => removeConfigField(i)}
                                            className="p-1.5 rounded-lg hover:bg-app-error/10 text-app-muted-foreground hover:text-app-error">
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Status + sort */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Sort Order</label>
                            <input type="number" value={form.sort_order ?? 0}
                                   onChange={e => set('sort_order', Number(e.target.value))}
                                   className={`${inputCls} font-mono`} />
                        </div>
                        <div>
                            <label className={labelCls}>Status</label>
                            <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-xl border border-app-border/50 bg-app-bg">
                                <input type="checkbox" checked={!!form.is_active}
                                       onChange={e => set('is_active', e.target.checked)}
                                       className="w-3.5 h-3.5 accent-app-primary" />
                                <span className="text-[11px] font-bold">{form.is_active ? 'Active' : 'Inactive'}</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-3"
                     style={{ borderTop: '1px solid var(--app-border)' }}>
                    <button onClick={onClose} disabled={busy}
                            className="px-4 py-2 text-[11px] font-bold rounded-xl text-app-muted-foreground hover:bg-app-surface-hover">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={busy || !form.code || !form.name}
                            className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-xl text-white disabled:opacity-50"
                            style={{ background: 'var(--app-primary)' }}>
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {isEdit ? 'Save Changes' : 'Create Gateway'}
                    </button>
                </div>
            </div>
        </div>
    )
}
