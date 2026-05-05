'use client'

import { useState, useEffect } from 'react'
import { getBarcodePolicy, updateBarcodePolicy } from '@/app/actions/plm-governance'
import { Barcode, Save, RefreshCw, Shield, Settings } from 'lucide-react'
import { toast } from 'sonner'

type BarcodePolicy = {
    id?: number
    default_mode?: string
    internal_prefix?: string
    [key: string]: unknown
}

export default function BarcodePolicyPage() {
    const [policy, setPolicy] = useState<BarcodePolicy>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const res = await getBarcodePolicy()
        if (res.success) setPolicy((res.data as BarcodePolicy) || {})
        else setPolicy({})
        setLoading(false)
    }

    async function handleSave() {
        setSaving(true)
        const payload = { id: policy.id ?? 'current', ...policy }
        const res = await updateBarcodePolicy(payload)
        if (res.success) { toast.success('Barcode policy updated'); loadData() }
        else toast.error(res.error || 'Failed to update')
        setSaving(false)
    }

    if (loading) return (
        <div className="min-h-screen layout-container-padding flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: 'var(--app-primary)' }} />
        </div>
    )

    return (
        <div className="min-h-screen layout-container-padding bg-app-bg">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-accent))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Barcode className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">PLM Governance</p>
                        <h1>
                            Barcode <span style={{ color: 'var(--app-primary)' }}>Policy</span>
                        </h1>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-lg disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 80%, #000))' }}>
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                    Save Policy
                </button>
            </div>

            <div className="space-y-4">
                {/* Generation Mode */}
                <div className="rounded-xl p-5" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <h3 className="uppercase text-app-muted-foreground mb-4 flex items-center gap-2">
                        <Settings size={12} /> Generation Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Default Generation Mode</label>
                            <select value={policy?.default_mode || ''} onChange={e => setPolicy({ ...policy, default_mode: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <option value="">Select...</option>
                                <option value="INTERNAL_AUTO">Internal Auto-generate (EAN-13)</option>
                                <option value="SUPPLIER">Require Supplier Barcode</option>
                                <option value="MANUAL">Manual Entry</option>
                                <option value="MIXED">Mixed (per-category override)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Internal Prefix</label>
                            <input type="text" value={policy?.internal_prefix || ''} onChange={e => setPolicy({ ...policy, internal_prefix: e.target.value })}
                                placeholder="e.g. 200" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    </div>
                </div>

                {/* Validation Rules */}
                <div className="rounded-xl p-5" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <h3 className="uppercase text-app-muted-foreground mb-4 flex items-center gap-2">
                        <Shield size={12} /> Validation Rules
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                            { key: 'require_unique', label: 'Require unique barcodes' },
                            { key: 'allow_duplicates_across_packaging', label: 'Allow duplicates across packaging' },
                            { key: 'validate_checksum', label: 'Validate EAN checksum' },
                            { key: 'auto_assign_on_create', label: 'Auto-assign on product create' },
                            { key: 'allow_manual_override', label: 'Allow manual override' },
                            { key: 'require_barcode_for_sale', label: 'Require barcode for sales' },
                        ].map(f => (
                            <label key={f.key} className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all"
                                style={{ background: policy?.[f.key] ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'var(--app-bg)', border: `1px solid ${policy?.[f.key] ? 'var(--app-primary)' : 'var(--app-border)'}` }}>
                                <input type="checkbox" checked={!!policy?.[f.key]}
                                    onChange={e => setPolicy({ ...policy, [f.key]: e.target.checked })} className="rounded" />
                                <span className="text-xs font-bold text-app-foreground">{f.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
