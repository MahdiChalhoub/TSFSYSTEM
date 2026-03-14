'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import { Save, ArrowLeft, Shield, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ── Sectioned form for OrgTaxPolicy ──────────────────────────── */

const TREATMENT_OPTIONS = ['CAPITALIZE', 'RECOVER', 'EXPENSE']

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-app-surface/50 p-5 space-y-4">
      <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--app-accent)' }}>
        {icon} {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  )
}

function Field({ label, help, children, full }: { label: string; help?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--app-muted)' }}>
        {label}
      </label>
      {children}
      {help && <p className="mt-1 text-[10px]" style={{ color: 'var(--app-muted)', opacity: 0.7 }}>{help}</p>}
    </div>
  )
}

const inputCls = "w-full px-3 py-2 rounded-xl text-sm border border-white/10 bg-app-surface focus:border-app-accent focus:ring-1 focus:ring-app-accent outline-none transition-colors"
const selectCls = inputCls

export default function OrgTaxPolicyFormPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id === 'new' ? null : params?.id ? Number(params.id) : null
  const isEdit = id !== null

  const [form, setForm] = useState<Record<string, any>>({
    name: '',
    is_default: false,
    country_code: 'CI',
    currency_code: 'XOF',
    vat_output_enabled: true,
    vat_input_recoverability: '1.000',
    official_vat_treatment: 'STANDARD',
    internal_vat_treatment: 'NONE',
    airsi_treatment: 'CAPITALIZE',
    purchase_tax_rate: '0.0000',
    purchase_tax_mode: 'CAPITALIZE',
    sales_tax_rate: '0.0000',
    sales_tax_trigger: 'NONE',
    periodic_amount: '0.00',
    periodic_interval: 'MONTHLY',
    profit_tax_mode: 'NONE',
    allowed_scopes: ['OFFICIAL', 'INTERNAL'],
    internal_cost_mode: 'TTC_ALWAYS',
    internal_sales_vat_mode: 'NONE',
    vat_collected_account: null, vat_recoverable_account: null,
    vat_payable_account: null, vat_refund_receivable_account: null,
    vat_suspense_account: null, airsi_account: null, reverse_charge_account: null,
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (isEdit && id) {
      erpFetch(`finance/org-tax-policies/${id}/`).then(data => {
        setForm(data)
        setLoading(false)
      })
    }
  }, [id, isEdit])

  const upd = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  async function handleSave() {
    setSaving(true)
    try {
      if (isEdit) {
        await erpFetch(`finance/org-tax-policies/${id}/`, {
          method: 'PUT', body: JSON.stringify(form)
        })
        toast.success('Tax policy updated')
      } else {
        await erpFetch('finance/org-tax-policies/', {
          method: 'POST', body: JSON.stringify(form)
        })
        toast.success('Tax policy created')
      }
      router.push('/finance/org-tax-policies')
    } catch (err: any) {
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--app-muted)' }}>Loading...</div>
  }

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
              {isEdit ? 'Edit Tax Policy' : 'New Tax Policy'}
            </h1>
            <p className="text-xs" style={{ color: 'var(--app-muted)' }}>Configure your organization&apos;s fiscal behavior</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}
          className="h-9 px-5 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">
          <Save size={14} className="mr-2" /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* Identity */}
      <Section title="Identity & Region" icon={<Shield size={14} />}>
        <Field label="Policy Name" help="Descriptive name for this tax configuration">
          <input className={inputCls} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Default CI Policy" />
        </Field>
        <Field label="Default Policy">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_default} onChange={e => upd('is_default', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
            <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Use as organization default</span>
          </label>
        </Field>
        <Field label="Country Code" help="ISO 3166-1 alpha-2/3">
          <input className={inputCls} value={form.country_code} onChange={e => upd('country_code', e.target.value.toUpperCase())} maxLength={3} />
        </Field>
        <Field label="Currency Code">
          <input className={inputCls} value={form.currency_code} onChange={e => upd('currency_code', e.target.value.toUpperCase())} maxLength={3} />
        </Field>
      </Section>

      {/* VAT */}
      <Section title="VAT Configuration">
        <Field label="VAT Output Enabled" help="Does this org charge VAT on official sales?">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.vat_output_enabled} onChange={e => upd('vat_output_enabled', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
            <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Enabled</span>
          </label>
        </Field>
        <Field label="VAT Input Recoverability" help="0.000 = none, 1.000 = full recovery">
          <input className={inputCls} type="number" step="0.001" min="0" max="1"
            value={form.vat_input_recoverability} onChange={e => upd('vat_input_recoverability', e.target.value)} />
        </Field>
        <Field label="Official VAT Treatment">
          <select className={selectCls} value={form.official_vat_treatment} onChange={e => upd('official_vat_treatment', e.target.value)}>
            <option value="STANDARD">Standard</option>
            <option value="SIMPLIFIED">Simplified</option>
            <option value="EXEMPT">Exempt</option>
          </select>
        </Field>
        <Field label="Internal VAT Treatment">
          <select className={selectCls} value={form.internal_vat_treatment} onChange={e => upd('internal_vat_treatment', e.target.value)}>
            <option value="NONE">None</option>
            <option value="STANDARD">Standard</option>
            <option value="SHADOW">Shadow (track only)</option>
          </select>
        </Field>
      </Section>

      {/* Withholding / AIRSI */}
      <Section title="Withholding Tax (AIRSI)">
        <Field label="Withholding Treatment" help="How to account for purchase withholding taxes">
          <select className={selectCls} value={form.airsi_treatment} onChange={e => upd('airsi_treatment', e.target.value)}>
            {TREATMENT_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </Section>

      {/* Purchase Tax */}
      <Section title="Purchase Tax">
        <Field label="Purchase Tax Rate" help="Decimal format: 0.05 = 5%">
          <input className={inputCls} type="number" step="0.0001" min="0"
            value={form.purchase_tax_rate} onChange={e => upd('purchase_tax_rate', e.target.value)} />
        </Field>
        <Field label="Purchase Tax Mode">
          <select className={selectCls} value={form.purchase_tax_mode} onChange={e => upd('purchase_tax_mode', e.target.value)}>
            <option value="CAPITALIZE">Capitalize (add to inventory cost)</option>
            <option value="EXPENSE">Expense (P&L)</option>
          </select>
        </Field>
      </Section>

      {/* Sales Tax */}
      <Section title="Sales Tax">
        <Field label="Sales Tax Rate" help="Decimal format: 0.02 = 2%">
          <input className={inputCls} type="number" step="0.0001" min="0"
            value={form.sales_tax_rate} onChange={e => upd('sales_tax_rate', e.target.value)} />
        </Field>
        <Field label="Sales Tax Trigger">
          <select className={selectCls} value={form.sales_tax_trigger} onChange={e => upd('sales_tax_trigger', e.target.value)}>
            <option value="NONE">None</option>
            <option value="ON_INVOICE">On Invoice</option>
            <option value="ON_PAYMENT">On Payment</option>
          </select>
        </Field>
      </Section>

      {/* Periodic */}
      <Section title="Periodic Tax">
        <Field label="Periodic Amount">
          <input className={inputCls} type="number" step="0.01" min="0"
            value={form.periodic_amount} onChange={e => upd('periodic_amount', e.target.value)} />
        </Field>
        <Field label="Periodic Interval">
          <select className={selectCls} value={form.periodic_interval} onChange={e => upd('periodic_interval', e.target.value)}>
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="ANNUALLY">Annually</option>
          </select>
        </Field>
      </Section>

      {/* Internal */}
      <Section title="Internal Scope Settings">
        <Field label="Internal Cost Mode" help="How to calculate cost for INTERNAL scope transactions">
          <select className={selectCls} value={form.internal_cost_mode} onChange={e => upd('internal_cost_mode', e.target.value)}>
            <option value="TTC_ALWAYS">TTC Always (ignore VAT recoverability)</option>
            <option value="COST_BASED">Cost-Based</option>
          </select>
        </Field>
        <Field label="Internal Sales VAT Mode">
          <select className={selectCls} value={form.internal_sales_vat_mode} onChange={e => upd('internal_sales_vat_mode', e.target.value)}>
            <option value="NONE">None (no VAT on internal sales)</option>
            <option value="CHARGE">Charge VAT</option>
            <option value="SHADOW">Shadow (track but don&apos;t post)</option>
          </select>
        </Field>
        <Field label="Allowed Scopes" full>
          <div className="flex gap-3">
            {['OFFICIAL', 'INTERNAL'].map(scope => (
              <label key={scope} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={(form.allowed_scopes || []).includes(scope)}
                  onChange={e => {
                    const scopes = [...(form.allowed_scopes || [])]
                    if (e.target.checked) scopes.push(scope)
                    else scopes.splice(scopes.indexOf(scope), 1)
                    upd('allowed_scopes', scopes)
                  }}
                  className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
                <span className="text-xs font-semibold uppercase" style={{ color: 'var(--app-foreground)' }}>{scope}</span>
              </label>
            ))}
          </div>
        </Field>
      </Section>
    </div>
  )
}
