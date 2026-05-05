'use client'

import { useState, useEffect } from 'react'
import { getLabelPolicy, updateLabelPolicy } from '@/app/actions/plm-governance'
import { Tag, Save, RefreshCw, Settings, Printer } from 'lucide-react'
import { toast } from 'sonner'

type LabelPolicy = {
    id?: number
    default_output_method?: string
    default_copies?: number
    [key: string]: unknown
}

export default function LabelPolicyPage() {
    const [policy, setPolicy] = useState<LabelPolicy>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => { loadData() }, [])

    async function loadData() {
        setLoading(true)
        const res = await getLabelPolicy()
        if (res.success) setPolicy((res.data as LabelPolicy) || {})
        else setPolicy({})
        setLoading(false)
    }

    async function handleSave() {
        setSaving(true)
        const payload = { id: policy.id ?? 'current', ...policy }
        const res = await updateLabelPolicy(payload)
        if (res.success) { toast.success('Label policy updated'); loadData() }
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
                        style={{ background: 'linear-gradient(135deg, var(--app-primary), var(--app-warning))', boxShadow: '0 4px 15px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                        <Tag className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">PLM Governance</p>
                        <h1 className="text-3xl font-black tracking-tight text-app-foreground">
                            Label <span style={{ color: 'var(--app-primary)' }}>Policy</span>
                        </h1>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all shadow-lg disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 80%, #000))' }}>
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />} Save Policy
                </button>
            </div>

            <div className="space-y-4">
                <div className="rounded-xl p-5" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <h3 className="text-xs font-black uppercase tracking-widest text-app-muted-foreground mb-4 flex items-center gap-2">
                        <Printer size={12} /> Print Settings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Default Output Method</label>
                            <select value={policy?.default_output_method || ''} onChange={e => setPolicy({ ...policy, default_output_method: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                <option value="PDF">PDF Export</option>
                                <option value="THERMAL">Direct to Thermal Printer</option>
                                <option value="BROWSER">Browser Print Dialog</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-app-muted-foreground mb-1">Default Copies</label>
                            <input type="number" min="1" value={policy?.default_copies || 1} onChange={e => setPolicy({ ...policy, default_copies: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl p-5" style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                    <h3 className="text-xs font-black uppercase tracking-widest text-app-muted-foreground mb-4 flex items-center gap-2">
                        <Settings size={12} /> Automation Rules
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {[
                            { key: 'auto_print_on_receive', label: 'Auto-print on goods receipt' },
                            { key: 'auto_print_on_price_change', label: 'Auto-print on price change' },
                            { key: 'auto_print_on_create', label: 'Auto-print on product create' },
                            { key: 'require_approval', label: 'Require approval before print' },
                            { key: 'track_label_history', label: 'Track label print history' },
                            { key: 'enforce_template', label: 'Enforce template per category' },
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
