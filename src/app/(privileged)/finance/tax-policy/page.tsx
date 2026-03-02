'use client'

import { useState, useEffect } from 'react'
import { getOrgTaxPolicy, saveOrgTaxPolicy, getCounterpartyTaxProfiles, saveCounterpartyTaxProfile } from '@/app/actions/finance/tax-engine'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Shield, CheckCircle, Users, Save, Plus, RefreshCw } from 'lucide-react'

const AIRSI_OPTIONS = [
    { value: 'CAPITALIZE', label: 'Capitalize — add to inventory cost' },
    { value: 'EXPENSE', label: 'Expense — post to P&L expense account' },
    { value: 'RECOVER', label: 'Recover — deductible (REAL companies)' },
]

const SCOPE_MODES = [
    { value: 'TTC_ALWAYS', label: 'Always TTC (Internal scope = cost includes VAT)' },
    { value: 'SAME_AS_OFFICIAL', label: 'Same as Official scope' },
]

const PURCHASE_TAX_MODES = [
    { value: 'CAPITALIZE', label: 'Capitalize into inventory cost' },
    { value: 'EXPENSE', label: 'Expense to P&L' },
]

const SALES_TAX_TRIGGERS = [
    { value: 'ON_TURNOVER', label: 'Percentage of total revenue (period)' },
    { value: 'ON_PROFIT', label: 'Percentage of gross profit (period)' },
]

const PROFIT_TAX_MODES = [
    { value: 'STANDARD', label: 'Standard corporate tax' },
    { value: 'FORFAIT', label: 'Fixed / Forfait tax' },
    { value: 'EXEMPT', label: 'Tax exempt' },
]

const PERIODIC_INTERVALS = [
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'ANNUAL', label: 'Annual' },
]

export default function TaxPolicyPage() {
    const [policy, setPolicy] = useState<any>(null)
    const [profiles, setProfiles] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<Record<string, any>>({})

    useEffect(() => {
        async function load() {
            setLoading(true)
            try {
                const [pol, profs] = await Promise.all([
                    getOrgTaxPolicy(),
                    getCounterpartyTaxProfiles(),
                ])
                const p = Array.isArray(pol) ? pol[0] : pol?.results?.[0]
                setPolicy(p || null)
                setForm(p ? {
                    vat_output_enabled: p.vat_output_enabled ?? true,
                    vat_input_recoverability: p.vat_input_recoverability ?? '0.000',
                    airsi_treatment: p.airsi_treatment ?? 'CAPITALIZE',
                    internal_cost_mode: p.internal_cost_mode ?? 'TTC_ALWAYS',
                    purchase_tax_rate: p.purchase_tax_rate ?? '0.0000',
                    purchase_tax_mode: p.purchase_tax_mode ?? 'CAPITALIZE',
                    sales_tax_rate: p.sales_tax_rate ?? '0.0000',
                    sales_tax_trigger: p.sales_tax_trigger ?? 'ON_TURNOVER',
                    periodic_amount: p.periodic_amount ?? '0.00',
                    periodic_interval: p.periodic_interval ?? 'ANNUAL',
                    profit_tax_mode: p.profit_tax_mode ?? 'STANDARD',
                    name: p.name ?? '',
                } : {
                    vat_output_enabled: false,
                    vat_input_recoverability: '0.000',
                    airsi_treatment: 'CAPITALIZE',
                    internal_cost_mode: 'TTC_ALWAYS',
                    purchase_tax_rate: '0.0000',
                    purchase_tax_mode: 'CAPITALIZE',
                    sales_tax_rate: '0.0000',
                    sales_tax_trigger: 'ON_TURNOVER',
                    periodic_amount: '0.00',
                    periodic_interval: 'ANNUAL',
                    profit_tax_mode: 'STANDARD',
                    name: '',
                })
                setProfiles(Array.isArray(profs) ? profs : profs?.results || [])
            } catch {
                toast.error('Failed to load tax policy')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await saveOrgTaxPolicy(policy?.id ?? null, { ...form, is_default: true })
            toast.success('Tax policy saved')
            // Reload
            const pol = await getOrgTaxPolicy()
            const p = Array.isArray(pol) ? pol[0] : pol?.results?.[0]
            setPolicy(p)
        } catch {
            toast.error('Failed to save policy')
        } finally {
            setSaving(false)
        }
    }

    const f = (key: string) => form[key]
    const set = (key: string, val: any) => setForm(prev => ({ ...prev, [key]: val }))

    return (
        <div className="page-container">
            <header>
                <h1 className="page-header-title tracking-tighter text-app-text flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Shield size={28} className="text-white" />
                    </div>
                    Tax <span className="text-indigo-600">Policy</span>
                </h1>
                <p className="text-sm font-medium text-app-text-faint mt-2 uppercase tracking-widest">
                    OrgTaxPolicy · CounterpartyTaxProfiles · AIRSI · VAT Rules
                </p>
            </header>

            {loading ? (
                <div className="space-y-4">
                    <Skeleton className="h-64" />
                    <Skeleton className="h-48" />
                </div>
            ) : (
                <>
                    {/* OrgTaxPolicy Form */}
                    <Card>
                        <CardHeader className="py-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Shield size={16} className="text-indigo-400" />
                                Organization Tax Policy
                                {policy && <Badge className="bg-indigo-100 text-indigo-700 ml-2">ID #{policy.id}</Badge>}
                            </CardTitle>
                            {policy?.name && <span className="text-xs text-app-text-faint font-medium">{policy.name}</span>}
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {/* Policy Name */}
                            <div>
                                <label className="text-xs font-semibold text-app-text-muted uppercase mb-1 block">Policy Name</label>
                                <Input
                                    value={f('name')}
                                    onChange={e => set('name', e.target.value)}
                                    placeholder="e.g. TSF Global Demo — Policy (MIXED)"
                                    className="max-w-md"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* VAT Output */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase text-indigo-600 tracking-widest">VAT Output</h3>
                                    <div className="flex items-center justify-between p-3 rounded-xl bg-app-bg border">
                                        <div>
                                            <p className="text-sm font-semibold">VAT Output Enabled</p>
                                            <p className="text-xs text-app-text-faint">Org issues TVA invoices to clients</p>
                                        </div>
                                        <Switch
                                            checked={!!f('vat_output_enabled')}
                                            onCheckedChange={v => set('vat_output_enabled', v)}
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-app-text-muted uppercase">VAT Input Recoverability</label>
                                        <p className="text-[11px] text-app-text-faint">0 = fully capitalized, 1 = fully recoverable (REAL)</p>
                                        <Input
                                            type="number"
                                            min="0" max="1" step="0.001"
                                            value={f('vat_input_recoverability')}
                                            onChange={e => set('vat_input_recoverability', e.target.value)}
                                            className="max-w-[160px] font-mono"
                                        />
                                    </div>
                                </div>

                                {/* AIRSI + Internal Scope */}
                                <div className="space-y-4">
                                    <h3 className="text-xs font-black uppercase text-violet-600 tracking-widest">AIRSI & Purchase Tax</h3>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-app-text-muted uppercase">AIRSI Treatment</label>
                                        <Select value={f('airsi_treatment')} onValueChange={v => set('airsi_treatment', v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {AIRSI_OPTIONS.map(o => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-app-text-muted uppercase">Purchase Tax Rate</label>
                                        <p className="text-[11px] text-app-text-faint">e.g. 0.0300 = 3% on purchases</p>
                                        <Input
                                            type="number"
                                            min="0" max="1" step="0.0001"
                                            value={f('purchase_tax_rate')}
                                            onChange={e => set('purchase_tax_rate', e.target.value)}
                                            className="max-w-[160px] font-mono"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-app-text-muted uppercase">Purchase Tax Mode</label>
                                        <Select value={f('purchase_tax_mode')} onValueChange={v => set('purchase_tax_mode', v)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PURCHASE_TAX_MODES.map(o => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Periodic & Turnover Taxes */}
                                <div className="space-y-4 md:col-span-2 pt-4 border-t">
                                    <h3 className="text-xs font-black uppercase text-amber-600 tracking-widest">Periodic & Turnover Taxes</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Sales Tax / Turnover */}
                                        <div className="space-y-4 p-4 rounded-xl bg-amber-50/50 border border-amber-100">
                                            <h4 className="text-[11px] font-bold text-amber-800 uppercase">Sales / Turnover Tax</h4>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-app-text-muted uppercase">Tax Rate</label>
                                                <p className="text-[10px] text-app-text-faint">e.g. 0.0500 = 5% micro tax</p>
                                                <Input
                                                    type="number"
                                                    min="0" max="1" step="0.0001"
                                                    value={f('sales_tax_rate')}
                                                    onChange={e => set('sales_tax_rate', e.target.value)}
                                                    className="font-mono bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-app-text-muted uppercase">Tax Trigger</label>
                                                <Select value={f('sales_tax_trigger')} onValueChange={v => set('sales_tax_trigger', v)}>
                                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {SALES_TAX_TRIGGERS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Periodic Forfait */}
                                        <div className="space-y-4 p-4 rounded-xl bg-orange-50/50 border border-orange-100">
                                            <h4 className="text-[11px] font-bold text-orange-800 uppercase">Fixed Periodic Tax</h4>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-app-text-muted uppercase">Amount (Forfait)</label>
                                                <p className="text-[10px] text-app-text-faint">Fixed fee (e.g. minimum légal)</p>
                                                <Input
                                                    type="number"
                                                    min="0" step="0.01"
                                                    value={f('periodic_amount')}
                                                    onChange={e => set('periodic_amount', e.target.value)}
                                                    className="font-mono bg-white"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-app-text-muted uppercase">Interval</label>
                                                <Select value={f('periodic_interval')} onValueChange={v => set('periodic_interval', v)}>
                                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {PERIODIC_INTERVALS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>

                                        {/* Profit Tax Mode */}
                                        <div className="space-y-4 p-4 rounded-xl bg-app-surface border">
                                            <h4 className="text-[11px] font-bold text-app-text uppercase">Corporate Profit Tax</h4>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-semibold text-app-text-muted uppercase">Profit Tax Mode</label>
                                                <p className="text-[10px] text-app-text-faint">Standard, Forfait, or Exempt</p>
                                                <Select value={f('profit_tax_mode')} onValueChange={v => set('profit_tax_mode', v)}>
                                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {PROFIT_TAX_MODES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Internal Cost Mode */}
                                <div className="space-y-2 md:col-span-2">
                                    <h3 className="text-xs font-black uppercase text-app-text-muted tracking-widest">Internal Scope</h3>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-app-text-muted uppercase">Internal Cost Mode</label>
                                        <Select value={f('internal_cost_mode')} onValueChange={v => set('internal_cost_mode', v)}>
                                            <SelectTrigger className="max-w-md">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {SCOPE_MODES.map(o => (
                                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t flex items-center gap-3">
                                <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                    <Save size={14} className="mr-2" />
                                    {saving ? 'Saving…' : policy ? 'Update Policy' : 'Create Policy'}
                                </Button>
                                {policy && (
                                    <p className="text-xs text-app-text-faint">
                                        Last updated: {policy.updated_at ? new Date(policy.updated_at).toLocaleString() : '—'}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* CounterpartyTaxProfile Presets */}
                    <Card>
                        <CardHeader className="py-4 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Users size={16} className="text-app-text-faint" /> Counterparty Tax Profiles
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">{profiles.length} profiles</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            {profiles.length === 0 ? (
                                <div className="text-center py-10 text-app-text-faint text-sm">
                                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                                    No profiles found. Run <code className="bg-app-surface-2 rounded px-1 text-xs">seed_tax_profiles</code> to create presets.
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="bg-app-bg border-b">
                                        <tr>
                                            <th className="text-left px-4 py-2 font-semibold text-app-text-muted">Profile Name</th>
                                            <th className="text-center px-4 py-2 font-semibold text-app-text-muted">VAT Registered</th>
                                            <th className="text-center px-4 py-2 font-semibold text-app-text-muted">Reverse Charge</th>
                                            <th className="text-center px-4 py-2 font-semibold text-app-text-muted">AIRSI Subject</th>
                                            <th className="text-left px-4 py-2 font-semibold text-app-text-muted">Scopes</th>
                                            <th className="text-center px-4 py-2 font-semibold text-app-text-muted">Preset</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {profiles.map((p: any) => (
                                            <tr key={p.id} className="border-b hover:bg-app-bg">
                                                <td className="px-4 py-2 font-semibold text-app-text">{p.name}</td>
                                                <td className="px-4 py-2 text-center">
                                                    {p.vat_registered
                                                        ? <CheckCircle size={16} className="text-green-500 mx-auto" />
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    {p.reverse_charge
                                                        ? <CheckCircle size={16} className="text-amber-500 mx-auto" />
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    {p.airsi_subject
                                                        ? <CheckCircle size={16} className="text-violet-500 mx-auto" />
                                                        : <span className="text-gray-300">—</span>}
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex gap-1 flex-wrap">
                                                        {(p.allowed_scopes || []).map((s: string) => (
                                                            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    {p.is_system_preset && (
                                                        <Badge className="bg-blue-100 text-blue-700 text-[10px]">System</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    )
}
