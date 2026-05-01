'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
  Save, ArrowLeft, Shield, Globe, Percent,
  DollarSign, Eye, Loader2, ShieldCheck, Layers, Plus, Trash2, ChevronDown,
  ToggleRight, Coins, Info, BookOpen, TrendingUp, Sparkles, ExternalLink, Link2
} from 'lucide-react'
import { getCountryTaxTemplate } from '@/app/actions/finance/tax-engine'

/* ── Dajingo Pro V2 — Org Tax Policy Form ────────────────────── */

const HINTS: Record<string, Record<string, string>> = {
  official_vat_treatment: {
    RECOVERABLE: 'Standard regime — Input VAT is tracked as a recoverable asset. Offset against output VAT during settlement.',
    CAPITALIZE: 'Input VAT is added to inventory cost. Cannot reclaim VAT from tax authority.',
    EXPENSE: 'Input VAT is expensed directly to P&L. No VAT recovery.',
  },
  internal_vat_treatment: {
    RECOVERABLE: 'Internal transactions follow the same VAT treatment as official.',
    CAPITALIZE: 'VAT on internal transactions is capitalized into cost.',
    EXPENSE: 'VAT on internal transactions is expensed to P&L.',
  },
  purchase_tax_treatment: {
    CAPITALIZE: 'Purchase taxes added to inventory cost — increases COGS, no P&L impact at purchase time.',
    RECOVER: 'Withholding tax tracked as receivable, recoverable against future profit tax.',
    EXPENSE: 'Purchase taxes expensed directly to P&L at purchase time.',
  },
  sales_tax_trigger: {
    ON_TURNOVER: 'Tax calculated as percentage of total revenue for the period.',
    ON_PROFIT: 'Tax calculated as percentage of gross profit for the period.',
  },
  profit_tax_mode: {
    STANDARD: 'Standard corporate tax rate applied to taxable profit.',
    FORFAIT: 'Fixed/forfait tax — flat periodic amount regardless of actual profit.',
    EXEMPT: 'Organization exempt from profit tax (tax holiday, special zone, etc.).',
  },
  periodic_interval: {
    MONTHLY: 'Tax obligation accrued and filed every month.',
    ANNUAL: 'Tax obligation accrued and filed once per fiscal year.',
  },
  internal_cost_mode: {
    TTC_ALWAYS: 'Internal cost always includes all taxes (TTC).',
    SAME_AS_OFFICIAL: 'Internal cost follows same recoverability rules as official scope.',
    CUSTOM: 'Custom logic defined in code — for special transfer pricing.',
  },
  internal_sales_vat_mode: {
    NONE: 'No VAT on internal sales — totals are HT only.',
    DISPLAY_ONLY: 'VAT shown in UI for reference, but no statutory liability posted.',
  },
}

const inputCls = "w-full text-[12px] font-bold px-3 py-2 rounded-xl outline-none transition-all text-app-foreground"
const inputStyle = {
  background: 'var(--app-background)',
  border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
}
const inputFocusCls = "focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/40"

function HintSelect({ options, value, onChange, hintKey }: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; hintKey: string
}) {
  const hint = HINTS[hintKey]?.[value]
  return (
    <div>
      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle}
        value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {hint && (
        <div className="mt-1.5 flex items-start gap-1.5 px-2 py-1.5 rounded-lg animate-in fade-in duration-200"
          style={{
            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)',
            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',
          }}>
          <Info size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info, #3b82f6)' }} />
          <span className="text-[10px] font-bold leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>{hint}</span>
        </div>
      )}
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>{icon}</div>
        <h3 className="text-[11px] font-black text-app-foreground uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>{children}</div>
    </div>
  )
}

function Field({ label, help, children, full }: { label: string; help?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="text-[9px] font-black uppercase tracking-widest mb-1.5 block" style={{ color: 'var(--app-muted-foreground)' }}>{label}</label>
      {children}
      {help && <p className="mt-1 text-[10px] font-bold" style={{ color: 'var(--app-muted-foreground)', opacity: 0.6 }}>{help}</p>}
    </div>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer py-2">
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-9 h-5 rounded-full transition-all peer-checked:bg-app-primary"
          style={{ background: checked ? undefined : 'color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-app-surface shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <span className="text-[12px] font-bold text-app-foreground">{label}</span>
    </label>
  )
}

/* ── Tax GL → Posting Rule Event Code mapping ── */
const TAX_GL_POSTING_MAP: { field: string; label: string; eventCode: string; legacyCodes: string[]; help: string }[] = [
  { field: 'vat_collected_account', label: 'VAT Collected (Output)', eventCode: 'tax.vat.output', legacyCodes: ['sales.vat_collected', 'sales.invoice.vat_output'], help: 'TVA Collectée' },
  { field: 'vat_recoverable_account', label: 'VAT Recoverable (Input)', eventCode: 'tax.vat.input', legacyCodes: ['purchases.vat_recoverable', 'purchases.invoice.vat_input'], help: 'TVA Récupérable' },
  { field: 'vat_payable_account', label: 'VAT Payable (Net)', eventCode: 'tax.vat.payable', legacyCodes: ['tax.vat_payable', 'tax.settlement.vat_payable'], help: 'Settlement clearing' },
  { field: 'vat_refund_receivable_account', label: 'VAT Refund Receivable', eventCode: 'tax.vat.recoverable', legacyCodes: ['tax.vat_refund_receivable', 'tax.settlement.vat_recoverable'], help: 'Credit when input > output' },
  { field: 'vat_suspense_account', label: 'VAT Suspense', eventCode: 'tax.vat.suspense', legacyCodes: ['purchases.vat_suspense'], help: 'Cash-basis suspense' },
  { field: 'airsi_account', label: 'Withholding / AIRSI', eventCode: 'tax.airsi.payable', legacyCodes: ['purchases.airsi_payable', 'tax.airsi.purchases'], help: 'Withholding tax' },
  { field: 'reverse_charge_account', label: 'Reverse Charge', eventCode: 'tax.settlement.reverse_charge', legacyCodes: ['purchases.reverse_charge_vat'], help: 'Autoliquidation' },
]

/* ═══════════════════════════════════════════════════════════════════ */

export default function OrgTaxPolicyFormPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id === 'new' ? null : params?.id ? Number(params.id) : null
  const isEdit = id !== null

  const [form, setForm] = useState<Record<string, any>>({
    name: '', is_default: false, country_code: '', currency_code: '',
    vat_output_enabled: true, vat_input_recoverability: '1.000',
    official_vat_treatment: 'RECOVERABLE', internal_vat_treatment: 'CAPITALIZE',
    airsi_treatment: 'CAPITALIZE', purchase_tax_rate: '0.0000', purchase_tax_mode: 'CAPITALIZE',
    sales_tax_rate: '0.0000', sales_tax_trigger: 'ON_TURNOVER',
    periodic_amount: '0.00', periodic_interval: 'ANNUAL', profit_tax_mode: 'STANDARD',
    allowed_scopes: ['OFFICIAL', 'INTERNAL'],
    internal_cost_mode: 'TTC_ALWAYS', internal_sales_vat_mode: 'NONE',
    vat_collected_account: null, vat_recoverable_account: null,
    vat_payable_account: null, vat_refund_receivable_account: null,
    vat_suspense_account: null, airsi_account: null, reverse_charge_account: null,
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [accounts, setAccounts] = useState<{ id: number; code: string; name: string }[]>([])
  const [postingRules, setPostingRules] = useState<Record<string, { account_code: string; account_name: string; id: number }>>({})
  const [customRules, setCustomRules] = useState<Record<string, any>[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [templateApplied, setTemplateApplied] = useState<string | null>(null)

  // Org-scoped lookups from regional settings
  const [orgCountries, setOrgCountries] = useState<{ iso2: string; name: string; isDefault: boolean }[]>([])
  const [orgCurrencies, setOrgCurrencies] = useState<{ code: string; name: string; isDefault: boolean }[]>([])

  useEffect(() => {
    erpFetch('finance/accounts/?limit=500').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      setAccounts(list.map((a: { id: number; code?: string; name?: string }) => ({ id: a.id, code: a.code || '', name: a.name || '' })))
    }).catch(() => {})
    erpFetch('finance/custom-tax-rules/?limit=200').then(data => {
      setCustomRules(Array.isArray(data) ? data : data?.results || [])
    }).catch(() => {})

    // Fetch posting rules to resolve tax GL accounts
    erpFetch('finance/posting-rules/').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      const ruleMap: Record<string, { account_code: string; account_name: string; id: number }> = {}
      list.forEach((r: { event_code?: string; account?: number; account_code?: string; account_name?: string }) => {
        if (r.event_code && r.account) {
          ruleMap[r.event_code] = { account_code: r.account_code || '', account_name: r.account_name || '', id: r.account }
        }
      })
      setPostingRules(ruleMap)
    }).catch(() => {})

    // Fetch org countries & currencies from regional settings
    erpFetch('reference/org-countries/').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      const mapped = (list as Array<Record<string, unknown>>)
        .filter((c) => c.is_enabled)
        .map((c) => ({
          iso2: String(c.country_iso2 ?? c.country_iso3 ?? ''),
          name: String(c.country_name ?? ''),
          isDefault: !!c.is_default,
        }))
      setOrgCountries(mapped)
      // Auto-select: if creating new and no country set yet
      if (!isEdit) {
        const def = mapped.find((c) => c.isDefault) || (mapped.length === 1 ? mapped[0] : null)
        if (def) {
          setForm(f => ({ ...f, country_code: def.iso2 }))
          // Auto-apply country template for new policies
          setTimeout(() => applyCountryTemplate(def.iso2), 100)
        }
      }
    }).catch(() => {})

    erpFetch('reference/org-currencies/').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      const mapped = (list as Array<Record<string, unknown>>)
        .filter((c) => c.is_enabled)
        .map((c) => ({
          code: String(c.currency_code ?? ''),
          name: String(c.currency_name ?? ''),
          isDefault: !!c.is_default,
        }))
      setOrgCurrencies(mapped)
      // Auto-select: if creating new and no currency set yet
      if (!isEdit) {
        const def = mapped.find((c) => c.isDefault) || (mapped.length === 1 ? mapped[0] : null)
        if (def) setForm(f => ({ ...f, currency_code: def.code }))
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (isEdit && id) {
      erpFetch(`finance/org-tax-policies/${id}/`).then(data => { setForm(data); setLoading(false) })
    }
  }, [id, isEdit])

  const upd = (key: string, value: unknown) => setForm(f => ({ ...f, [key]: value }))

  // ── Policy presets from country template ──
  const [policyPresets, setPolicyPresets] = useState<Record<string, unknown>[]>([])
  const [selectedPreset, setSelectedPreset] = useState<number>(0)

  // ── Auto-populate from country template (NEW mode only) ──
  async function applyCountryTemplate(countryCode: string) {
    if (!countryCode || isEdit || templateApplied === countryCode) return
    try {
      const tpl = await getCountryTaxTemplate(countryCode)
      if (tpl) {
        const presets = Array.isArray(tpl.org_policy_defaults) ? tpl.org_policy_defaults : (tpl.org_policy_defaults ? [tpl.org_policy_defaults] : [])
        setPolicyPresets(presets)
        // Apply first preset by default
        if (presets.length > 0) {
          const { name: presetName, ...defaults } = presets[0]
          setForm(f => ({
            ...f,
            country_code: countryCode,
            currency_code: tpl.currency_code || f.currency_code,
            name: presetName || f.name,
            ...defaults,
          }))
          setSelectedPreset(0)
        }
        setTemplateApplied(countryCode)
        toast.success(`🌍 Applied ${tpl.country_name} — ${presets.length} policy preset(s) available`)
      }
    } catch { /* no template for this country — that's fine */ }
  }

  function applyPreset(idx: number) {
    if (idx < 0 || idx >= policyPresets.length) return
    const { name: presetName, ...defaults } = policyPresets[idx]
    setForm(f => ({ ...f, name: presetName || f.name, ...defaults }))
    setSelectedPreset(idx)
    toast.success(`Applied preset: ${presetName}`)
  }

  /* ── Custom Tax Rules inline CRUD ── */
  function addCustomRule() {
    setCustomRules(prev => [...prev, {
      _isNew: true, _key: Date.now(),
      name: '', rate: '0.0000', transaction_type: 'BOTH',
      math_behavior: 'ADDED_TO_TTC', purchase_cost_treatment: 'EXPENSE',
      tax_base_mode: 'HT', base_tax_type: null,
      calculation_order: 100, compound_group: null,
      liability_account: null, expense_account: null, is_active: true,
    }])
  }

  async function saveCustomRule(idx: number) {
    const rule = customRules[idx]
    const payload = { ...rule }
    delete payload._isNew; delete payload._key
    if (payload.tax_base_mode !== 'PREVIOUS_TAX') payload.base_tax_type = null
    if (!payload.compound_group) payload.compound_group = null
    try {
      if (rule._isNew) {
        const created = await erpFetch('finance/custom-tax-rules/', { method: 'POST', body: JSON.stringify(payload) })
        const upd = [...customRules]; upd[idx] = created; setCustomRules(upd)
        toast.success(`Rule "${payload.name}" created`)
      } else {
        await erpFetch(`finance/custom-tax-rules/${rule.id}/`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success(`Rule "${payload.name}" updated`)
      }
    } catch (err: unknown) { const m = err instanceof Error ? err.message : null; toast.error(m || 'Save failed') }
  }

  async function deleteCustomRule(idx: number) {
    const rule = customRules[idx]
    if (rule._isNew) { setCustomRules(prev => prev.filter((_, i) => i !== idx)); return }
    try {
      await erpFetch(`finance/custom-tax-rules/${rule.id}/`, { method: 'DELETE' })
      setCustomRules(prev => prev.filter((_, i) => i !== idx))
      toast.success('Rule deleted')
    } catch (err: unknown) { const m = err instanceof Error ? err.message : null; toast.error(m || 'Delete failed') }
  }

  function updRule(idx: number, key: string, val: unknown) {
    setCustomRules(prev => { const c = [...prev]; c[idx] = { ...c[idx], [key]: val }; return c })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `finance/org-tax-policies/${id}/` : 'finance/org-tax-policies/'
      await erpFetch(url, { method, body: JSON.stringify(form) })
      toast.success(isEdit ? 'Tax policy updated' : 'Tax policy created')
      router.push('/finance/org-tax-policies')
    } catch (err: unknown) { const m = err instanceof Error ? err.message : null; toast.error(m || 'Save failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>

  const isForfait = form.profit_tax_mode === 'FORFAIT'

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
            <ArrowLeft size={13} /><span className="hidden sm:inline">Back</span>
          </button>
          <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">{isEdit ? 'Edit Tax Policy' : 'New Tax Policy'}</h1>
            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">Universal Tax Engine · Organization Fiscal Configuration</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
          <Save size={14} /><span>{saving ? 'Saving...' : 'Save Policy'}</span>
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="flex-shrink-0 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
        {[
          { label: 'Country', value: form.country_code || '—', icon: <Globe size={14} />, color: 'var(--app-info, #3b82f6)' },
          { label: 'Currency', value: form.currency_code || '—', icon: <Coins size={14} />, color: 'var(--app-primary)' },
          { label: 'VAT Mode', value: form.official_vat_treatment || '—', icon: <Percent size={14} />, color: 'var(--app-success, #22c55e)' },
          { label: 'Profit Tax', value: form.profit_tax_mode || '—', icon: <TrendingUp size={14} />, color: '#8b5cf6' },
          { label: 'Custom Rules', value: `${customRules.length}`, icon: <Layers size={14} />, color: 'var(--app-warning, #f59e0b)' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
              <div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Form Sections ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pb-6">

        {/* 1. Identity */}
        <Section title="Identity & Region" icon={<Shield size={13} />}>
          <Field label="Policy Name"><input className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Standard VAT Policy" /></Field>
          {!isEdit && policyPresets.length > 1 && (
            <Field label="Tax Type Preset" help={`${policyPresets.length} presets available for this country`} full>
              <div className="flex gap-2 flex-wrap">
                {policyPresets.map((p, i) => (
                  <button key={i} type="button" onClick={() => applyPreset(i)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all"
                    style={{
                      background: selectedPreset === i ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                      color: selectedPreset === i ? '#fff' : 'var(--app-primary)',
                      border: `1px solid ${selectedPreset === i ? 'var(--app-primary)' : 'color-mix(in srgb, var(--app-primary) 20%, transparent)'}`,
                      cursor: 'pointer',
                    }}>
                    {selectedPreset === i && <Sparkles size={10} className="inline mr-1" />}
                    {String(p.name ?? '')}
                  </button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Default Policy"><Toggle checked={form.is_default} onChange={v => upd('is_default', v)} label="Organization default" /></Field>
          <Field label="Country" help={!isEdit && templateApplied ? `✨ Template applied for ${templateApplied}` : "From your organization's regional settings"}>
            {orgCountries.length <= 1 ? (
              <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} value={form.country_code ? `${form.country_code}${orgCountries[0]?.name ? ` — ${orgCountries[0].name}` : ''}` : '—'} readOnly />
            ) : (
              <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={form.country_code} onChange={e => { upd('country_code', e.target.value); if (!isEdit) applyCountryTemplate(e.target.value) }}>
                <option value="">— Select country —</option>
                {orgCountries.map(c => <option key={c.iso2} value={c.iso2}>{c.iso2} — {c.name}{c.isDefault ? ' ★' : ''}</option>)}
              </select>
            )}
          </Field>
          <Field label="Currency" help="From your organization's regional settings">
            {orgCurrencies.length <= 1 ? (
              <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} value={form.currency_code ? `${form.currency_code}${orgCurrencies[0]?.name ? ` — ${orgCurrencies[0].name}` : ''}` : '—'} readOnly />
            ) : (
              <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={form.currency_code} onChange={e => upd('currency_code', e.target.value)}>
                <option value="">— Select currency —</option>
                {orgCurrencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}{c.isDefault ? ' ★' : ''}</option>)}
              </select>
            )}
          </Field>
        </Section>

        {/* 2. VAT */}
        <Section title="VAT Configuration" icon={<Percent size={13} />}>
          <Field label="Charge VAT on Sales"><Toggle checked={form.vat_output_enabled} onChange={v => upd('vat_output_enabled', v)} label="VAT output enabled" /></Field>
          <Field label="Input VAT Recovery %" help="0.000 = none, 1.000 = full">
            <input className={`${inputCls} font-mono tabular-nums ${inputFocusCls}`} style={inputStyle} type="number" step="0.001" min="0" max="1" value={form.vat_input_recoverability} onChange={e => upd('vat_input_recoverability', e.target.value)} />
          </Field>
          <Field label="Official Scope Treatment">
            <HintSelect hintKey="official_vat_treatment" value={form.official_vat_treatment} onChange={v => upd('official_vat_treatment', v)}
              options={[{ value: 'RECOVERABLE', label: 'Recoverable / Standard' }, { value: 'CAPITALIZE', label: 'Capitalize into cost' }, { value: 'EXPENSE', label: 'Expense to P&L' }]} />
          </Field>
          <Field label="Internal Scope Treatment">
            <HintSelect hintKey="internal_vat_treatment" value={form.internal_vat_treatment} onChange={v => upd('internal_vat_treatment', v)}
              options={[{ value: 'RECOVERABLE', label: 'Recoverable / Standard' }, { value: 'CAPITALIZE', label: 'Capitalize into cost' }, { value: 'EXPENSE', label: 'Expense to P&L' }]} />
          </Field>
        </Section>

        {/* 3. Purchase Tax */}
        <Section title="Purchase Tax" icon={<DollarSign size={13} />}>
          <Field label="Purchase Tax Rate" help="Decimal: 0.02 = 2%">
            <input className={`${inputCls} font-mono tabular-nums ${inputFocusCls}`} style={inputStyle} type="number" step="0.0001" min="0" value={form.purchase_tax_rate} onChange={e => upd('purchase_tax_rate', e.target.value)} />
          </Field>
          <Field label="Purchase Tax Treatment">
            <HintSelect hintKey="purchase_tax_treatment" value={form.airsi_treatment} onChange={v => { upd('airsi_treatment', v); upd('purchase_tax_mode', v === 'RECOVER' ? 'CAPITALIZE' : v) }}
              options={[{ value: 'CAPITALIZE', label: 'Capitalize (inventory cost)' }, { value: 'RECOVER', label: 'Recover (receivable)' }, { value: 'EXPENSE', label: 'Expense (P&L)' }]} />
          </Field>
        </Section>

        {/* 4. Revenue & Profit */}
        <Section title="Revenue & Profit Tax" icon={<TrendingUp size={13} />}>
          <Field label="Profit Tax Mode">
            <HintSelect hintKey="profit_tax_mode" value={form.profit_tax_mode} onChange={v => upd('profit_tax_mode', v)}
              options={[{ value: 'STANDARD', label: 'Standard corporate tax' }, { value: 'FORFAIT', label: 'Forfait (fixed periodic)' }, { value: 'EXEMPT', label: 'Tax exempt' }]} />
          </Field>
          {isForfait && (<>
            <Field label="Forfait Amount"><input className={`${inputCls} font-mono tabular-nums ${inputFocusCls}`} style={inputStyle} type="number" step="0.01" min="0" value={form.periodic_amount} onChange={e => upd('periodic_amount', e.target.value)} /></Field>
            <Field label="Forfait Interval">
              <HintSelect hintKey="periodic_interval" value={form.periodic_interval} onChange={v => upd('periodic_interval', v)}
                options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'ANNUAL', label: 'Annual' }]} />
            </Field>
          </>)}
          <Field label="Sales/Turnover Tax Rate" help="Decimal: 0.02 = 2%">
            <input className={`${inputCls} font-mono tabular-nums ${inputFocusCls}`} style={inputStyle} type="number" step="0.0001" min="0" value={form.sales_tax_rate} onChange={e => upd('sales_tax_rate', e.target.value)} />
          </Field>
          <Field label="Sales Tax Base">
            <HintSelect hintKey="sales_tax_trigger" value={form.sales_tax_trigger} onChange={v => upd('sales_tax_trigger', v)}
              options={[{ value: 'ON_TURNOVER', label: 'On total revenue' }, { value: 'ON_PROFIT', label: 'On gross profit' }]} />
          </Field>
        </Section>

        {/* 5. Internal Scope */}
        <Section title="Internal Scope" icon={<Eye size={13} />}>
          <Field label="Internal Cost Mode">
            <HintSelect hintKey="internal_cost_mode" value={form.internal_cost_mode} onChange={v => upd('internal_cost_mode', v)}
              options={[{ value: 'TTC_ALWAYS', label: 'TTC Always' }, { value: 'SAME_AS_OFFICIAL', label: 'Same as Official' }, { value: 'CUSTOM', label: 'Custom (code)' }]} />
          </Field>
          <Field label="Internal Sales VAT">
            <HintSelect hintKey="internal_sales_vat_mode" value={form.internal_sales_vat_mode} onChange={v => upd('internal_sales_vat_mode', v)}
              options={[{ value: 'NONE', label: 'None (HT only)' }, { value: 'DISPLAY_ONLY', label: 'Display only' }]} />
          </Field>
          <Field label="Allowed Scopes" full>
            <div className="flex flex-wrap gap-3 py-1">
              {['OFFICIAL', 'INTERNAL'].map(scope => {
                const active = (form.allowed_scopes || []).includes(scope)
                return (
                  <button key={scope} type="button" onClick={() => {
                    const s = [...(form.allowed_scopes || [])]; active ? s.splice(s.indexOf(scope), 1) : s.push(scope); upd('allowed_scopes', s)
                  }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 20%, transparent)',
                      color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                      border: `1px solid ${active ? 'color-mix(in srgb, var(--app-primary) 30%, transparent)' : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                    }}><ToggleRight size={13} />{scope}</button>
                )
              })}
            </div>
          </Field>
        </Section>

        {/* 6. GL Accounts — read from Posting Rules */}
        <div className="rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))', borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                <BookOpen size={13} />
              </div>
              <h3 className="text-[11px] font-black text-app-foreground uppercase tracking-widest">GL Account Mapping</h3>
              <span className="text-[10px] font-bold text-app-muted-foreground hidden sm:inline">Resolved from Posting Rules</span>
            </div>
            <a href="/finance/settings/posting-rules" target="_blank"
              className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all hover:brightness-110"
              style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
              <ExternalLink size={11} /> Configure Posting Rules
            </a>
          </div>
          <div className="p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px' }}>
            {TAX_GL_POSTING_MAP.map(mapping => {
              const rule = postingRules[mapping.eventCode]
                || mapping.legacyCodes.reduce<typeof postingRules[string] | undefined>((found, code) => found || postingRules[code], undefined)
              const linked = !!rule
              return (
                <div key={mapping.field} className="rounded-xl px-3 py-2.5 transition-all"
                  style={{
                    background: linked
                      ? 'color-mix(in srgb, var(--app-success, #22c55e) 4%, var(--app-background))'
                      : 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, var(--app-background))',
                    border: `1px solid color-mix(in srgb, ${linked ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)'} 15%, transparent)`,
                  }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                      {mapping.label}
                    </span>
                    <div className="flex items-center gap-1" style={{ color: linked ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)' }}>
                      <Link2 size={10} />
                      <span className="text-[9px] font-bold uppercase">{linked ? 'Linked' : 'Not Set'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-app-foreground tabular-nums">
                      {linked ? `${rule.account_code} — ${rule.account_name}` : '— Not configured —'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] font-bold" style={{ color: 'var(--app-muted-foreground)', opacity: 0.6 }}>{mapping.help}</span>
                    <span className="text-[9px] font-mono" style={{ color: 'var(--app-muted-foreground)', opacity: 0.4 }}>{mapping.eventCode}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 7. Custom Tax Rules (collapsible Advanced) */}
        <div className="rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full px-4 py-2.5 flex items-center justify-between"
            style={{
              background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, var(--app-surface))',
              borderBottom: showAdvanced ? '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' : 'none',
            }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                <Layers size={13} />
              </div>
              <h3 className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Custom Tax Rules ({customRules.length})</h3>
              <span className="text-[10px] font-bold text-app-muted-foreground hidden sm:inline">Extra taxes beyond core engine</span>
            </div>
            <ChevronDown size={14} className={`text-app-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="p-4 space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={addCustomRule}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={13} /> Add Custom Rule
                </button>
              </div>

              {customRules.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Layers size={28} className="text-app-muted-foreground mb-2 opacity-30" />
                  <p className="text-[12px] font-bold text-app-muted-foreground">No custom tax rules</p>
                  <p className="text-[10px] text-app-muted-foreground mt-1">Add extra taxes that run alongside the core engine (Eco Tax, Tourism Levy, etc.)</p>
                </div>
              )}

              {customRules.map((rule, i) => (
                <div key={rule.id || rule._key} className="rounded-xl p-3 animate-in fade-in slide-in-from-top-1 duration-200"
                  style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', alignItems: 'end' }}>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Name</label>
                      <input className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.name} onChange={e => updRule(i, 'name', e.target.value)} placeholder="e.g. Eco Tax" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Rate</label>
                      <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} type="number" step="0.0001" min="0" value={rule.rate} onChange={e => updRule(i, 'rate', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Applies To</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.transaction_type} onChange={e => updRule(i, 'transaction_type', e.target.value)}>
                        <option value="BOTH">Both</option><option value="PURCHASE">Purchase</option><option value="SALE">Sale</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Behavior</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.math_behavior} onChange={e => updRule(i, 'math_behavior', e.target.value)}>
                        <option value="ADDED_TO_TTC">Add to invoice</option><option value="WITHHELD_FROM_AP">Withhold from AP</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Cost</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.purchase_cost_treatment} onChange={e => updRule(i, 'purchase_cost_treatment', e.target.value)}>
                        <option value="EXPENSE">Expense</option><option value="CAPITALIZE">Capitalize</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Base</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.tax_base_mode} onChange={e => updRule(i, 'tax_base_mode', e.target.value)}>
                        <option value="HT">HT</option><option value="TTC">TTC</option><option value="PREVIOUS_TAX">Prior tax</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Order</label>
                      <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} type="number" min="0" value={rule.calculation_order} onChange={e => updRule(i, 'calculation_order', parseInt(e.target.value) || 100)} />
                    </div>
                    <div className="flex items-end gap-1.5">
                      <button type="button" onClick={() => saveCustomRule(i)}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl text-white bg-app-primary hover:brightness-110">
                        <Save size={11} /> Save
                      </button>
                      <button type="button" onClick={() => deleteCustomRule(i)}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl hover:bg-app-surface"
                        style={{ color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
