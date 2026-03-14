'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import { Save, ArrowLeft, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ── Helpers ──────────────────────────────────────────────────── */

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

/* ── Page ─────────────────────────────────────────────────────── */

export default function CustomTaxRuleFormPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id === 'new' ? null : params?.id ? Number(params.id) : null
  const isEdit = id !== null

  const [form, setForm] = useState<Record<string, any>>({
    name: '', rate: '0.05', transaction_type: 'BOTH',
    math_behavior: 'ADDED_TO_TTC', purchase_cost_treatment: 'EXPENSE',
    tax_base_mode: 'HT', base_tax_type: '',
    calculation_order: 100, compound_group: '',
    liability_account: null, expense_account: null,
    is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)

  useEffect(() => {
    if (isEdit && id) {
      erpFetch(`finance/custom-tax-rules/${id}/`).then(data => {
        setForm(data)
        setLoading(false)
      })
    }
  }, [id, isEdit])

  const upd = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  async function handleSave() {
    // Validation
    if (form.tax_base_mode === 'PREVIOUS_TAX' && !form.base_tax_type) {
      toast.error('Base Tax Type is required when Tax Base Mode is PREVIOUS_TAX')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form }
      if (payload.tax_base_mode !== 'PREVIOUS_TAX') payload.base_tax_type = null
      if (!payload.compound_group) payload.compound_group = null

      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `finance/custom-tax-rules/${id}/` : 'finance/custom-tax-rules/'
      await erpFetch(url, { method, body: JSON.stringify(payload) })
      toast.success(isEdit ? 'Rule updated' : 'Rule created')
      router.push('/finance/custom-tax-rules')
    } catch (err: any) {
      toast.error(err?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-sm" style={{ color: 'var(--app-muted)' }}>Loading...</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-app-surface/80 transition-colors">
            <ArrowLeft size={18} style={{ color: 'var(--app-muted)' }} />
          </button>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--app-foreground)' }}>
              {isEdit ? 'Edit Custom Tax Rule' : 'New Custom Tax Rule'}
            </h1>
            <p className="text-xs" style={{ color: 'var(--app-muted)' }}>Configure compound tax behavior</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}
          className="h-9 px-5 bg-app-primary text-app-foreground hover:bg-app-primary rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">
          <Save size={14} className="mr-2" /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {/* ── Basic ───────────────────────────────────────────── */}
      <Section title="Basic">
        <Field label="Rule Name">
          <input className={inputCls} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Environmental Eco Tax" />
        </Field>
        <Field label="Active">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-app-surface accent-app-accent" />
            <span className="text-sm" style={{ color: 'var(--app-foreground)' }}>Rule is active</span>
          </label>
        </Field>
        <Field label="Transaction Type">
          <select className={selectCls} value={form.transaction_type} onChange={e => upd('transaction_type', e.target.value)}>
            <option value="BOTH">Both (Sale + Purchase)</option>
            <option value="SALE">Sale only</option>
            <option value="PURCHASE">Purchase only</option>
          </select>
        </Field>
        <Field label="Rate" help="Decimal format: 0.05 = 5%">
          <input className={inputCls} type="number" step="0.0001" min="0" max="1"
            value={form.rate} onChange={e => upd('rate', e.target.value)} />
        </Field>
      </Section>

      {/* ── Base Calculation ────────────────────────────────── */}
      <Section title="Base Calculation">
        <Field label="Tax Base Mode" help={
          form.tax_base_mode === 'TTC'
            ? 'Calculated on running gross: base_ht + VAT + prior taxes in calculation order'
            : form.tax_base_mode === 'PREVIOUS_TAX'
              ? 'Calculated on the amount of a specific prior tax (e.g. % of VAT amount)'
              : 'Calculated on the pre-tax amount (HT)'
        }>
          <select className={selectCls} value={form.tax_base_mode} onChange={e => upd('tax_base_mode', e.target.value)}>
            <option value="HT">HT — Pre-tax amount</option>
            <option value="TTC">TTC — After VAT (running gross)</option>
            <option value="PREVIOUS_TAX">Previous Tax — Based on a specific tax type</option>
          </select>
        </Field>

        {/* Progressive disclosure: base_tax_type only shown for PREVIOUS_TAX */}
        {form.tax_base_mode === 'PREVIOUS_TAX' && (
          <Field label="Base Tax Type" help="Which tax type to use as the base (e.g. VAT, EXCISE)">
            <input className={inputCls} value={form.base_tax_type || ''} onChange={e => upd('base_tax_type', e.target.value)}
              placeholder="e.g. VAT" />
            {!form.base_tax_type && (
              <div className="flex items-center gap-1 mt-1 text-amber-400">
                <AlertTriangle size={10} />
                <span className="text-[10px] font-semibold">Required when using PREVIOUS_TAX mode</span>
              </div>
            )}
          </Field>
        )}

        <Field label="Calculation Order" help="Lower = runs earlier. Core taxes: VAT=10, Withholding=20, Purchase Tax=30. Default=100.">
          <input className={inputCls} type="number" min="0"
            value={form.calculation_order} onChange={e => upd('calculation_order', parseInt(e.target.value) || 0)} />
        </Field>
        <Field label="Compound Group" help="Optional grouping tag for chained taxes (e.g. 'brazil_composite')">
          <input className={inputCls} value={form.compound_group || ''} onChange={e => upd('compound_group', e.target.value)}
            placeholder="Optional" />
        </Field>
      </Section>

      {/* ── Posting ─────────────────────────────────────────── */}
      <Section title="Posting & Cost">
        <Field label="Math Behavior" help="How this tax affects the total">
          <select className={selectCls} value={form.math_behavior} onChange={e => upd('math_behavior', e.target.value)}>
            <option value="ADDED_TO_TTC">Added to TTC (increases amount owed)</option>
            <option value="WITHHELD_FROM_AP">Withheld from AP (reduces amount paid to supplier)</option>
            <option value="EMBEDDED_IN_PRICE">Embedded in Price (no additional charge)</option>
          </select>
        </Field>
        <Field label="Purchase Cost Treatment" help={
          form.purchase_cost_treatment === 'CAPITALIZE'
            ? 'Tax amount is included in inventory cost'
            : 'Tax amount goes to expense (P&L)'
        }>
          <select className={selectCls} value={form.purchase_cost_treatment} onChange={e => upd('purchase_cost_treatment', e.target.value)}>
            <option value="EXPENSE">Expense (goes to P&L)</option>
            <option value="CAPITALIZE">Capitalize (added to inventory cost)</option>
          </select>
        </Field>

        {/* Progressive disclosure: expense_account only for EXPENSE */}
        {form.purchase_cost_treatment === 'EXPENSE' && (
          <Field label="Expense Account" help="Account to debit for expensed taxes">
            <input className={inputCls} type="number" value={form.expense_account || ''} onChange={e => upd('expense_account', e.target.value ? Number(e.target.value) : null)}
              placeholder="Account ID (optional)" />
          </Field>
        )}

        <Field label="Liability Account" help="Credit account for tax payable">
          <input className={inputCls} type="number" value={form.liability_account || ''} onChange={e => upd('liability_account', e.target.value ? Number(e.target.value) : null)}
            placeholder="Account ID (optional)" />
        </Field>
      </Section>

      {/* ── Preview ─────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/5 bg-app-surface/30 p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2 mb-3" style={{ color: 'var(--app-muted)' }}>
          <Info size={14} /> Preview Example
        </h3>
        <div className="text-xs space-y-1" style={{ color: 'var(--app-foreground)' }}>
          <PreviewExample form={form} />
        </div>
      </div>
    </div>
  )
}

/* ── Live Preview Component ───────────────────────────────── */
function PreviewExample({ form }: { form: Record<string, any> }) {
  const baseHT = 1000
  const vatRate = 0.18
  const vat = baseHT * vatRate
  const ttc = baseHT + vat
  const rate = parseFloat(form.rate || 0)

  let base = baseHT
  let baseLabel = 'HT'
  if (form.tax_base_mode === 'TTC') {
    base = ttc
    baseLabel = 'TTC'
  } else if (form.tax_base_mode === 'PREVIOUS_TAX') {
    base = vat
    baseLabel = `VAT amount`
  }
  const amount = base * rate

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1">
      <span style={{ color: 'var(--app-muted)' }}>Base HT:</span>
      <span className="font-mono">{baseHT.toLocaleString()} CFA</span>
      <span style={{ color: 'var(--app-muted)' }}>VAT (18%):</span>
      <span className="font-mono">{vat.toLocaleString()} CFA</span>
      <span style={{ color: 'var(--app-muted)' }}>TTC:</span>
      <span className="font-mono">{ttc.toLocaleString()} CFA</span>
      <div className="col-span-2 border-t border-white/5 my-1" />
      <span style={{ color: 'var(--app-accent)' }}>Tax base ({baseLabel}):</span>
      <span className="font-mono font-semibold" style={{ color: 'var(--app-accent)' }}>{base.toLocaleString()} CFA</span>
      <span style={{ color: 'var(--app-accent)' }}>Tax ({(rate * 100).toFixed(2)}%):</span>
      <span className="font-mono font-bold" style={{ color: 'var(--app-accent)' }}>{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CFA</span>
      <div className="col-span-2 border-t border-white/5 my-1" />
      <span style={{ color: 'var(--app-muted)' }}>Behavior:</span>
      <span className="font-semibold">{form.math_behavior?.replace(/_/g, ' ')}</span>
      <span style={{ color: 'var(--app-muted)' }}>Cost impact:</span>
      <span className="font-semibold">
        {form.math_behavior === 'WITHHELD_FROM_AP' ? 'AP reduced by ' : form.math_behavior === 'ADDED_TO_TTC' ? 'TTC becomes ' : 'No extra charge — '}
        {form.math_behavior === 'WITHHELD_FROM_AP'
          ? `${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} CFA`
          : form.math_behavior === 'ADDED_TO_TTC'
            ? `${(ttc + amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} CFA`
            : 'included in price'}
      </span>
    </div>
  )
}
