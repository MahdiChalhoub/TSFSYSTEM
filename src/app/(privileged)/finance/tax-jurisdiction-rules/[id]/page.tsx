'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import { Save, ArrowLeft, Globe, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/5 bg-app-surface/50 p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--app-accent)' }}>
                {icon} {title}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
        </div>
    )
}

function Field({ label, help, children, full }: { label: string; help?: string; children: React.ReactNode; full?: boolean }) {
    return (
        <div className={full ? 'md:col-span-2' : ''}>
            <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-muted)' }}>{label}</label>
            {children}
            {help && <p className="mt-1 text-[10px]" style={{ color: 'var(--app-muted)', opacity: 0.7 }}>{help}</p>}
        </div>
    )
}

const inputCls = "w-full px-3 py-2 rounded-xl text-sm border border-white/10 bg-app-surface focus:border-app-accent focus:ring-1 focus:ring-app-accent outline-none transition-colors"
const selectCls = inputCls

export default function TaxJurisdictionRuleFormPage() {
    const router = useRouter()
    const params = useParams()
    const id = params?.id === 'new' ? null : params?.id ? Number(params.id) : null
    const isEdit = id !== null

    const [form, setForm] = useState<Record<string, any>>({
        name: '', country_code: '', region_code: '',
        tax_type: 'VAT', rate: '0.1800',
        place_of_supply_mode: 'ORIGIN',
        reverse_charge_allowed: false, zero_rate_export: true,
        registration_threshold: '', priority: 100,
        is_active: true, effective_from: '', effective_to: '',
    })
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(isEdit)
    const [resolveResult, setResolveResult] = useState<Record<string, any> | null>(null)

    useEffect(() => {
        if (isEdit && id) {
            erpFetch(`finance/tax-jurisdiction-rules/${id}/`).then(data => {
                setForm(data)
                setLoading(false)
            })
        }
    }, [id, isEdit])

    const upd = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

    async function handleSave() {
        if (!form.name || !form.country_code) {
            toast.error('Name and Country Code are required')
            return
        }
        setSaving(true)
        try {
            const payload = { ...form }
            if (!payload.region_code) payload.region_code = null
            if (!payload.registration_threshold) payload.registration_threshold = null
            if (!payload.effective_from) payload.effective_from = null
            if (!payload.effective_to) payload.effective_to = null

            const method = isEdit ? 'PUT' : 'POST'
            const url = isEdit ? `finance/tax-jurisdiction-rules/${id}/` : 'finance/tax-jurisdiction-rules/'
            await erpFetch(url, { method, body: JSON.stringify(payload) })
            toast.success(isEdit ? 'Rule updated' : 'Rule created')
            router.push('/finance/tax-jurisdiction-rules')
        } catch (err: any) {
            toast.error(err?.message || 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    async function handleTestResolve() {
        try {
            const result = await erpFetch('finance/tax-jurisdiction-rules/resolve/', {
                method: 'POST',
                body: JSON.stringify({
                    origin_country: 'CI',
                    destination_country: form.country_code,
                    destination_region: form.region_code || '',
                    is_export: form.country_code !== 'CI',
                    is_b2b: false,
                    tax_type: form.tax_type,
                }),
            })
            setResolveResult(result)
        } catch (err: any) {
            toast.error(err?.message || 'Resolve failed')
        }
    }

    if (loading) return <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--app-muted)' }}>Loading...</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-16">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-app-surface/80 transition-colors">
                        <ArrowLeft size={18} style={{ color: 'var(--app-muted)' }} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold" style={{ color: 'var(--app-foreground)' }}>
                            {isEdit ? 'Edit Jurisdiction Rule' : 'New Jurisdiction Rule'}
                        </h1>
                        <p className="text-xs" style={{ color: 'var(--app-muted)' }}>Define tax behavior for a specific country or region</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={saving}
                    className="h-9 px-5 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">
                    <Save size={14} className="mr-2" /> {saving ? 'Saving...' : 'Save'}
                </Button>
            </div>

            {/* ── Jurisdiction Identity ──────────────────────────── */}
            <Section title="Jurisdiction Identity" icon={<Globe size={14} />}>
                <Field label="Rule Name" help="Descriptive name (e.g. 'France VAT Standard')">
                    <input className={inputCls} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. France VAT Standard" />
                </Field>
                <Field label="Active">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)}
                            className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
                        <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Active</span>
                    </label>
                </Field>
                <Field label="Country Code" help="ISO 3166-1 alpha-2/3">
                    <input className={inputCls} value={form.country_code} onChange={e => upd('country_code', e.target.value.toUpperCase())} maxLength={3} placeholder="e.g. FR" />
                </Field>
                <Field label="Region / State Code" help="For sub-national taxes (e.g. CA, QC, ON)">
                    <input className={inputCls} value={form.region_code || ''} onChange={e => upd('region_code', e.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Tax Type">
                    <select className={selectCls} value={form.tax_type} onChange={e => upd('tax_type', e.target.value)}>
                        <option value="VAT">VAT — Value Added Tax</option>
                        <option value="SALES_TAX">Sales Tax</option>
                        <option value="GST">GST — Goods & Services Tax</option>
                        <option value="EXCISE">Excise Duty</option>
                        <option value="WITHHOLDING">Withholding Tax</option>
                        <option value="OTHER">Other</option>
                    </select>
                </Field>
                <Field label="Priority" help="Higher = matched first. Use 1000+ for specific, 100 for defaults.">
                    <input className={inputCls} type="number" min="0" value={form.priority} onChange={e => upd('priority', parseInt(e.target.value) || 0)} />
                </Field>
            </Section>

            {/* ── Tax Rate & Behavior ───────────────────────────── */}
            <Section title="Tax Rate & Behavior">
                <Field label="Standard Rate" help="Decimal format: 0.20 = 20%">
                    <input className={inputCls} type="number" step="0.0001" min="0" max="1"
                        value={form.rate} onChange={e => upd('rate', e.target.value)} />
                </Field>
                <Field label="Place of Supply Mode" help="Determines which jurisdiction's rate applies">
                    <select className={selectCls} value={form.place_of_supply_mode} onChange={e => upd('place_of_supply_mode', e.target.value)}>
                        <option value="ORIGIN">Origin — seller&apos;s location</option>
                        <option value="DESTINATION">Destination — buyer/delivery location</option>
                        <option value="REVERSE_CHARGE">Reverse Charge — buyer self-assesses</option>
                    </select>
                </Field>
                <Field label="Reverse Charge Allowed" help="Can B2B buyers self-assess under this jurisdiction?">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.reverse_charge_allowed} onChange={e => upd('reverse_charge_allowed', e.target.checked)}
                            className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
                        <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Yes</span>
                    </label>
                </Field>
                <Field label="Zero-Rate Exports" help="Automatically zero-rate cross-border exports?">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={form.zero_rate_export} onChange={e => upd('zero_rate_export', e.target.checked)}
                            className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
                        <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Yes</span>
                    </label>
                </Field>
            </Section>

            {/* ── Thresholds & Dates ────────────────────────────── */}
            <Section title="Thresholds & Effective Dates">
                <Field label="Registration Threshold" help="Turnover threshold for mandatory registration (optional)">
                    <input className={inputCls} type="number" step="0.01" min="0"
                        value={form.registration_threshold || ''} onChange={e => upd('registration_threshold', e.target.value || null)} placeholder="Optional" />
                </Field>
                <div />
                <Field label="Effective From" help="Leave blank for no start constraint">
                    <input className={inputCls} type="date" value={form.effective_from || ''} onChange={e => upd('effective_from', e.target.value || null)} />
                </Field>
                <Field label="Effective To" help="Leave blank for no end constraint">
                    <input className={inputCls} type="date" value={form.effective_to || ''} onChange={e => upd('effective_to', e.target.value || null)} />
                </Field>
            </Section>

            {/* ── Jurisdiction Preview ──────────────────────────── */}
            <div className="rounded-2xl border border-white/5 bg-app-surface/30 p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--app-muted)' }}>
                        <Zap size={14} /> Jurisdiction Resolution Preview
                    </h3>
                    <Button onClick={handleTestResolve} variant="outline"
                        className="h-7 px-3 rounded-lg text-[10px] font-bold uppercase tracking-wider border-white/10">
                        Test Resolve
                    </Button>
                </div>
                {resolveResult ? (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                        {Object.entries(resolveResult).map(([k, v]) => (
                            <div key={k} className="contents">
                                <span className="font-medium" style={{ color: 'var(--app-muted)' }}>{k.replace(/_/g, ' ')}:</span>
                                <span className="font-mono" style={{ color: 'var(--app-foreground)' }}>{String(v)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-[11px]" style={{ color: 'var(--app-muted)' }}>
                        Click &quot;Test Resolve&quot; to preview how this rule would resolve for a transaction from CI → {form.country_code || '??'}
                    </p>
                )}
            </div>
        </div>
    )
}
