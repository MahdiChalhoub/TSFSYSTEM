'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { erpFetch } from '@/lib/erp-api'
import { toast } from 'sonner'
import {
  Save, ArrowLeft, Shield, Globe, Users, FileCheck, Plus,
  Trash2, Loader2, ShieldCheck, ToggleRight, Info, AlertTriangle,
  ChevronDown, Layers, MapPin, Sparkles, Zap
} from 'lucide-react'
import { getCountryTaxTemplate } from '@/app/actions/finance/tax-engine'

/* ── Dajingo Pro V2 — Counterparty Tax Profile Form ──────────── */

/* ── Universal document type presets ── */
const DOC_PRESETS = [
  { type: 'TAX_ID', label: 'Tax Identification Number (TIN / NIF / EIN / NCC)' },
  { type: 'BIZ_REG', label: 'Business Registration (RCCM / Companies House / Secretary of State)' },
  { type: 'VAT_CERT', label: 'VAT / GST Registration Certificate' },
  { type: 'TAX_CLEARANCE', label: 'Tax Clearance / Good Standing Certificate' },
  { type: 'TAX_DECLARATION', label: 'Tax Declaration of Existence (DFE / Fiscal Filing Proof)' },
  { type: 'INSURANCE', label: 'Professional / Liability Insurance' },
  { type: 'IMPORT_LICENSE', label: 'Import License / Permit' },
  { type: 'EXPORT_LICENSE', label: 'Export License / Permit' },
  { type: 'PHYTO', label: 'Phytosanitary / Health Certificate' },
  { type: 'BANK_DETAILS', label: 'Bank Account Verification (RIB / IBAN / ACH)' },
  { type: 'ID_PROOF', label: 'Owner / Director ID (Passport / National ID)' },
  { type: 'ADDRESS_PROOF', label: 'Proof of Address (Utility Bill / Lease)' },
  { type: 'CUSTOM', label: '(Custom — define your own)' },
]

type DocRequirement = {
  type: string;
  label: string;
  required: boolean;
  renewable: boolean;
  renewal_months: number | null;
}

const inputCls = "w-full text-[12px] font-bold px-3 py-2 rounded-xl outline-none transition-all text-app-foreground"
const inputStyle = {
  background: 'var(--app-background)',
  border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
}
const inputFocusCls = "focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/40"

function Section({ title, icon, children, noPad }: { title: string; icon?: React.ReactNode; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div className="rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
      style={{
        background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
      }}>
      <div className="px-4 py-2.5 flex items-center gap-2"
        style={{
          background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
          borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
        }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center"
          style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
          {icon}
        </div>
        <h3 className="text-[11px] font-black text-app-foreground uppercase tracking-widest">{title}</h3>
      </div>
      {noPad ? children : (
        <div className="p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function Field({ label, help, children, full }: { label: string; help?: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <label className="text-[9px] font-black uppercase tracking-widest mb-1.5 block"
        style={{ color: 'var(--app-muted-foreground)' }}>{label}</label>
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
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
        </div>
      </div>
      <span className="text-[12px] font-bold text-app-foreground">{label}</span>
    </label>
  )
}

const HINTS: Record<string, Record<string, string>> = {
  vat_registered: {
    true: 'This counterparty charges VAT on their invoices (supplier) or is eligible for TVA Invoice (client).',
    false: 'Non-VAT registered — no VAT on their invoices. May trigger withholding obligations.',
  },
  reverse_charge: {
    true: 'Foreign B2B inbound — your organization self-assesses VAT (autoliquidation). Net VAT impact = 0.',
    false: 'Normal domestic transaction — VAT is charged by the supplier as usual.',
  },
  airsi_subject: {
    true: 'Buying from this supplier triggers purchase withholding tax (AIRSI). Amount is calculated based on your Org Tax Policy treatment.',
    false: 'No withholding obligation when buying from this supplier.',
  },
}

export default function CounterpartyTaxProfileFormPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id === 'new' ? null : params?.id ? Number(params.id) : null
  const isEdit = id !== null

  const [form, setForm] = useState<Record<string, any>>({
    name: '', country_code: '', state_code: '',
    vat_registered: true, reverse_charge: false, airsi_subject: false,
    allowed_scopes: ['OFFICIAL', 'INTERNAL'],
    required_documents: [] as DocRequirement[],
    enforce_compliance: false,
  })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [jurisRules, setJurisRules] = useState<Record<string, any>[]>([])
  const [showJuris, setShowJuris] = useState(false)
  const [templateApplied, setTemplateApplied] = useState<string | null>(null)
  const [customRules, setCustomRules] = useState<Record<string, any>[]>([])
  const [showCustomRules, setShowCustomRules] = useState(false)

  // Org-scoped lookups from regional settings
  const [orgCountries, setOrgCountries] = useState<{ iso2: string; name: string; isDefault: boolean }[]>([])

  useEffect(() => {
    if (isEdit && id) {
      erpFetch(`finance/counterparty-tax-profiles/${id}/`).then(data => {
        if (data.required_documents && data.required_documents.length > 0 && typeof data.required_documents[0] === 'string') {
          data.required_documents = data.required_documents.map((d: string) => ({
            type: d, label: DOC_PRESETS.find(p => p.type === d)?.label || d,
            required: true, renewable: false, renewal_months: null,
          }))
        }
        setForm(data)
        setLoading(false)
      })
    }
    erpFetch('finance/tax-jurisdiction-rules/?limit=200').then(data => {
      setJurisRules(Array.isArray(data) ? data : data?.results || [])
    }).catch(() => {})
    erpFetch('finance/custom-tax-rules/?limit=200').then(data => {
      setCustomRules(Array.isArray(data) ? data : data?.results || [])
    }).catch(() => {})

    // Fetch org countries from regional settings
    erpFetch('reference/org-countries/').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      const mapped = list
        .filter((c: any) => c.is_enabled)
        .map((c: any) => ({ iso2: c.country_iso2 || c.country_iso3 || '', name: c.country_name || '', isDefault: !!c.is_default }))
      setOrgCountries(mapped)
      if (!isEdit) {
        const def = mapped.find((c: any) => c.isDefault) || (mapped.length === 1 ? mapped[0] : null)
        if (def) {
          setForm(f => ({ ...f, country_code: def.iso2 }))
          setTimeout(() => applyCountryTemplate(def.iso2), 100)
        }
      }
    }).catch(() => {})
  }, [id, isEdit])

  const upd = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }))

  // ── Auto-populate documents from country template (NEW mode only) ──
  async function applyCountryTemplate(countryCode: string) {
    if (!countryCode || isEdit || templateApplied === countryCode) return
    try {
      const tpl = await getCountryTaxTemplate(countryCode)
      if (tpl && tpl.document_requirements && Array.isArray(tpl.document_requirements)) {
        setForm(f => ({
          ...f,
          country_code: countryCode,
          required_documents: tpl.document_requirements,
        }))
        setTemplateApplied(countryCode)
        toast.success(`🌍 Applied ${tpl.country_name} document template`)
      }
    } catch { /* no template — ok */ }
  }

  // ── Jurisdiction Rules inline CRUD ──
  function addJurisRule() {
    setJurisRules(prev => [...prev, {
      _isNew: true, _key: Date.now(),
      name: '', country_code: form.country_code || 'CI', region_code: '',
      tax_type: 'VAT', rate: '0.0000', place_of_supply_mode: 'ORIGIN',
      reverse_charge_allowed: false, zero_rate_export: true,
      registration_threshold: null, priority: 100, is_active: true, is_system_preset: false,
    }])
  }

  async function saveJurisRule(idx: number) {
    const rule = jurisRules[idx]
    const payload = { ...rule }
    delete payload._isNew; delete payload._key
    if (!payload.registration_threshold) payload.registration_threshold = null
    if (!payload.region_code) payload.region_code = null
    try {
      if (rule._isNew) {
        const created = await erpFetch('finance/tax-jurisdiction-rules/', { method: 'POST', body: JSON.stringify(payload) })
        const upd = [...jurisRules]; upd[idx] = created; setJurisRules(upd)
        toast.success(`Rule "${payload.name}" created`)
      } else {
        await erpFetch(`finance/tax-jurisdiction-rules/${rule.id}/`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success(`Rule "${payload.name}" updated`)
      }
    } catch (err: any) { toast.error(err?.message || 'Save failed') }
  }

  async function deleteJurisRule(idx: number) {
    const rule = jurisRules[idx]
    if (rule._isNew) { setJurisRules(prev => prev.filter((_, i) => i !== idx)); return }
    try {
      await erpFetch(`finance/tax-jurisdiction-rules/${rule.id}/`, { method: 'DELETE' })
      setJurisRules(prev => prev.filter((_, i) => i !== idx))
      toast.success('Rule deleted')
    } catch (err: any) { toast.error(err?.message || 'Delete failed') }
  }

  // ── Custom Tax Rules inline CRUD ──
  function addCustomRule() {
    setCustomRules(prev => [...prev, {
      _isNew: true, _key: Date.now(),
      name: '', rate: '0.0000', transaction_type: 'BOTH',
      math_behavior: 'ADDED_TO_TTC', purchase_cost_treatment: 'EXPENSE',
      tax_base_mode: 'HT', calculation_order: 100, is_active: true,
    }])
  }

  async function saveCustomRule(idx: number) {
    const rule = customRules[idx]
    const payload = { ...rule }
    delete payload._isNew; delete payload._key
    try {
      if (rule._isNew) {
        const created = await erpFetch('finance/custom-tax-rules/', { method: 'POST', body: JSON.stringify(payload) })
        const upd = [...customRules]; upd[idx] = created; setCustomRules(upd)
        toast.success(`Rule "${payload.name}" created`)
      } else {
        await erpFetch(`finance/custom-tax-rules/${rule.id}/`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success(`Rule "${payload.name}" updated`)
      }
    } catch (err: any) { toast.error(err?.message || 'Save failed') }
  }

  async function deleteCustomRule(idx: number) {
    const rule = customRules[idx]
    if (rule._isNew) { setCustomRules(prev => prev.filter((_, i) => i !== idx)); return }
    try {
      await erpFetch(`finance/custom-tax-rules/${rule.id}/`, { method: 'DELETE' })
      setCustomRules(prev => prev.filter((_, i) => i !== idx))
      toast.success('Rule deleted')
    } catch (err: any) { toast.error(err?.message || 'Delete failed') }
  }

  function updCustomRule(idx: number, key: string, val: any) {
    setCustomRules(prev => { const c = [...prev]; c[idx] = { ...c[idx], [key]: val }; return c })
  }

  function updJuris(idx: number, key: string, val: any) {
    setJurisRules(prev => { const c = [...prev]; c[idx] = { ...c[idx], [key]: val }; return c })
  }

  const docs: DocRequirement[] = form.required_documents || []
  const setDocs = (newDocs: DocRequirement[]) => upd('required_documents', newDocs)

  function addDoc() {
    const usedTypes = new Set(docs.map(d => d.type))
    const firstAvailable = DOC_PRESETS.find(p => !usedTypes.has(p.type)) || DOC_PRESETS[DOC_PRESETS.length - 1]
    setDocs([...docs, { type: firstAvailable.type, label: firstAvailable.label, required: true, renewable: false, renewal_months: null }])
  }

  function updateDoc(index: number, patch: Partial<DocRequirement>) {
    const updated = [...docs]; updated[index] = { ...updated[index], ...patch }; setDocs(updated)
  }

  function removeDoc(index: number) { setDocs(docs.filter((_, i) => i !== index)) }

  async function handleSave() {
    setSaving(true)
    try {
      const method = isEdit ? 'PUT' : 'POST'
      const url = isEdit ? `finance/counterparty-tax-profiles/${id}/` : 'finance/counterparty-tax-profiles/'
      await erpFetch(url, { method, body: JSON.stringify(form) })
      toast.success(isEdit ? 'Profile updated' : 'Profile created')
      router.push('/finance/counterparty-tax-profiles')
    } catch (err: any) { toast.error(err?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()}
            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
            <ArrowLeft size={13} /><span className="hidden sm:inline">Back</span>
          </button>
          <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">{isEdit ? 'Edit Tax Profile' : 'New Tax Profile'}</h1>
            <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">Counterparty Fiscal Identity · Supplier or Client</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-4 py-2 rounded-xl transition-all disabled:opacity-50"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
          <Save size={14} /><span>{saving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </div>

      {/* ── KPI Strip ── */}
      <div className="flex-shrink-0 mb-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
        {[
          { label: 'Country', value: form.country_code || '—', icon: <Globe size={14} />, color: 'var(--app-info, #3b82f6)' },
          { label: 'VAT Status', value: form.vat_registered ? 'REGISTERED' : 'UNREGISTERED', icon: <Shield size={14} />, color: form.vat_registered ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)' },
          { label: 'Documents', value: `${docs.length} Required`, icon: <FileCheck size={14} />, color: '#8b5cf6' },
          { label: 'Jurisdiction', value: `${jurisRules.length} Rules`, icon: <MapPin size={14} />, color: 'var(--app-primary)' },
          { label: 'Compliance', value: form.enforce_compliance ? 'ENFORCED' : 'ADVISORY', icon: <AlertTriangle size={14} />, color: form.enforce_compliance ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' },
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

      {/* ── Form ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pb-6">

        {/* Identity */}
        <Section title="Identity" icon={<Shield size={13} />}>
          <Field label="Profile Name" help="e.g. 'Assujetti TVA', 'Foreign B2B Import'">
            <input className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="Profile name" />
          </Field>
          <Field label="Country" help={!isEdit && templateApplied ? `✨ Documents pre-filled from ${templateApplied} template` : "From your organization's regional settings"}>
            {orgCountries.length <= 1 ? (
              <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} value={form.country_code ? `${form.country_code}${orgCountries[0]?.name ? ` — ${orgCountries[0].name}` : ''}` : '—'} readOnly />
            ) : (
              <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={form.country_code} onChange={e => { upd('country_code', e.target.value); if (!isEdit) applyCountryTemplate(e.target.value) }}>
                <option value="">— Select country —</option>
                {orgCountries.map(c => <option key={c.iso2} value={c.iso2}>{c.iso2} — {c.name}{c.isDefault ? ' ★' : ''}</option>)}
              </select>
            )}
          </Field>
          <Field label="State / Region Code" help="Sub-national tax rules (leave blank if N/A)">
            <input className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={form.state_code || ''} onChange={e => upd('state_code', e.target.value)} placeholder="e.g. CA, ON" />
          </Field>
        </Section>

        {/* Tax Behavior */}
        <Section title="Tax Behavior" icon={<ShieldCheck size={13} />}>
          <Field label="VAT Registered">
            <Toggle checked={form.vat_registered} onChange={v => upd('vat_registered', v)} label="Charges / collects VAT" />
            <div className="mt-1 flex items-start gap-1.5 px-2 py-1.5 rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' }}>
              <Info size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info, #3b82f6)' }} />
              <span className="text-[10px] font-bold leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>{HINTS.vat_registered[String(form.vat_registered)]}</span>
            </div>
          </Field>
          <Field label="Reverse Charge">
            <Toggle checked={form.reverse_charge} onChange={v => upd('reverse_charge', v)} label="Autoliquidation (foreign B2B)" />
            <div className="mt-1 flex items-start gap-1.5 px-2 py-1.5 rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' }}>
              <Info size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info, #3b82f6)' }} />
              <span className="text-[10px] font-bold leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>{HINTS.reverse_charge[String(form.reverse_charge)]}</span>
            </div>
          </Field>
          <Field label="Withholding Subject">
            <Toggle checked={form.airsi_subject} onChange={v => upd('airsi_subject', v)} label="Triggers purchase withholding" />
            <div className="mt-1 flex items-start gap-1.5 px-2 py-1.5 rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' }}>
              <Info size={11} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--app-info, #3b82f6)' }} />
              <span className="text-[10px] font-bold leading-relaxed" style={{ color: 'var(--app-muted-foreground)' }}>{HINTS.airsi_subject[String(form.airsi_subject)]}</span>
            </div>
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

        {/* Required Documents */}
        <Section title="Required Documents" icon={<FileCheck size={13} />} noPad>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Toggle checked={form.enforce_compliance} onChange={v => upd('enforce_compliance', v)} label="Block transactions if documents missing/expired" />
              <button type="button" onClick={addDoc}
                className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                <Plus size={13} /> Add Document
              </button>
            </div>
            {docs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileCheck size={32} className="text-app-muted-foreground mb-3 opacity-40" />
                <p className="text-sm font-bold text-app-muted-foreground">No documents required</p>
              </div>
            )}
            {docs.map((doc, i) => (
              <div key={i} className="rounded-xl p-3 animate-in fade-in slide-in-from-top-1 duration-200"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', alignItems: 'end' }}>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Type</label>
                    <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={doc.type} onChange={e => {
                      const preset = DOC_PRESETS.find(p => p.type === e.target.value)
                      updateDoc(i, { type: e.target.value, label: preset?.label || doc.label })
                    }}>{DOC_PRESETS.map(p => <option key={p.type} value={p.type}>{p.type}</option>)}</select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Label</label>
                    <input className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={doc.label} onChange={e => updateDoc(i, { label: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Obligation</label>
                    <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={doc.required ? 'REQUIRED' : 'OPTIONAL'}
                      onChange={e => updateDoc(i, { required: e.target.value === 'REQUIRED' })}>
                      <option value="REQUIRED">Required</option><option value="OPTIONAL">Optional</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Renewal</label>
                    <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={doc.renewable ? 'YES' : 'NO'}
                      onChange={e => updateDoc(i, { renewable: e.target.value === 'YES', renewal_months: e.target.value === 'YES' ? (doc.renewal_months || 12) : null })}>
                      <option value="NO">One-time</option><option value="YES">Renewable</option>
                    </select>
                  </div>
                  {doc.renewable && (
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Every (months)</label>
                      <input className={`${inputCls} font-mono tabular-nums ${inputFocusCls}`} style={inputStyle} type="number" min="1" max="120" value={doc.renewal_months || 12}
                        onChange={e => updateDoc(i, { renewal_months: parseInt(e.target.value) || 12 })} />
                    </div>
                  )}
                  <div className="flex items-end">
                    <button type="button" onClick={() => removeDoc(i)}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl transition-all hover:bg-app-surface"
                      style={{ color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 20%, transparent)' }}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Jurisdiction Rules (collapsible) */}
        <div className="rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <button type="button" onClick={() => setShowJuris(!showJuris)}
            className="w-full px-4 py-2.5 flex items-center justify-between"
            style={{
              background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
              borderBottom: showJuris ? '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' : 'none',
            }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                <MapPin size={13} />
              </div>
              <h3 className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Jurisdiction Rules ({jurisRules.length})</h3>
              <span className="text-[10px] font-bold text-app-muted-foreground hidden sm:inline">Location-based tax rates & thresholds</span>
            </div>
            <ChevronDown size={14} className={`text-app-muted-foreground transition-transform ${showJuris ? 'rotate-180' : ''}`} />
          </button>

          {showJuris && (
            <div className="p-4 space-y-3">
              <div className="flex justify-end">
                <button type="button" onClick={addJurisRule}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={13} /> Add Jurisdiction Rule
                </button>
              </div>

              {jurisRules.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <MapPin size={28} className="text-app-muted-foreground mb-2 opacity-30" />
                  <p className="text-[12px] font-bold text-app-muted-foreground">No jurisdiction rules</p>
                  <p className="text-[10px] text-app-muted-foreground mt-1">Define location-specific tax rates (e.g. US state sales tax, EU country VAT)</p>
                </div>
              )}

              {jurisRules.map((rule, i) => (
                <div key={rule.id || rule._key} className="rounded-xl p-3 animate-in fade-in slide-in-from-top-1 duration-200"
                  style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', alignItems: 'end' }}>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Name</label>
                      <input className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.name} onChange={e => updJuris(i, 'name', e.target.value)} placeholder="e.g. CI Domestic VAT" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Country</label>
                      <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} value={rule.country_code} onChange={e => updJuris(i, 'country_code', e.target.value.toUpperCase())} maxLength={3} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Region</label>
                      <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} value={rule.region_code || ''} onChange={e => updJuris(i, 'region_code', e.target.value)} placeholder="e.g. CA" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Tax Type</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.tax_type} onChange={e => updJuris(i, 'tax_type', e.target.value)}>
                        <option value="VAT">VAT</option><option value="SALES_TAX">Sales Tax</option><option value="GST">GST</option>
                        <option value="EXCISE">Excise</option><option value="WITHHOLDING">Withholding</option><option value="OTHER">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Rate</label>
                      <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} type="number" step="0.0001" min="0" value={rule.rate} onChange={e => updJuris(i, 'rate', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Supply</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.place_of_supply_mode} onChange={e => updJuris(i, 'place_of_supply_mode', e.target.value)}>
                        <option value="ORIGIN">Origin</option><option value="DESTINATION">Destination</option><option value="REVERSE_CHARGE">Reverse Charge</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <button type="button" onClick={() => saveJurisRule(i)}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-2 rounded-xl text-white bg-app-primary hover:brightness-110"><Save size={11} /> Save</button>
                      <button type="button" onClick={() => deleteJurisRule(i)}
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

        {/* Custom Tax Rules (collapsible) */}
        <div className="rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <button type="button" onClick={() => setShowCustomRules(!showCustomRules)}
            className="w-full px-4 py-2.5 flex items-center justify-between"
            style={{
              background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 4%, var(--app-surface))',
              borderBottom: showCustomRules ? '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' : 'none',
            }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', color: 'var(--app-warning, #f59e0b)' }}>
                <Zap size={13} />
              </div>
              <h3 className="text-[11px] font-black text-app-foreground uppercase tracking-widest">Custom Tax Rules ({customRules.length})</h3>
              <span className="text-[10px] font-bold text-app-muted-foreground hidden sm:inline">Extra taxes beyond core engine</span>
            </div>
            <ChevronDown size={14} className={`text-app-muted-foreground transition-transform ${showCustomRules ? 'rotate-180' : ''}`} />
          </button>

          {showCustomRules && (
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
                  <Zap size={28} className="text-app-muted-foreground mb-2 opacity-30" />
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
                      <input className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.name} onChange={e => updCustomRule(i, 'name', e.target.value)} placeholder="e.g. Eco Tax" />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Rate</label>
                      <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} type="number" step="0.0001" min="0" value={rule.rate} onChange={e => updCustomRule(i, 'rate', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Applies To</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.transaction_type} onChange={e => updCustomRule(i, 'transaction_type', e.target.value)}>
                        <option value="BOTH">Both</option><option value="PURCHASE">Purchase</option><option value="SALE">Sale</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Behavior</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.math_behavior} onChange={e => updCustomRule(i, 'math_behavior', e.target.value)}>
                        <option value="ADDED_TO_TTC">Add to invoice</option><option value="WITHHELD_FROM_AP">Withhold from AP</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Cost</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.purchase_cost_treatment} onChange={e => updCustomRule(i, 'purchase_cost_treatment', e.target.value)}>
                        <option value="EXPENSE">Expense</option><option value="CAPITALIZE">Capitalize</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Base</label>
                      <select className={`${inputCls} ${inputFocusCls}`} style={inputStyle} value={rule.tax_base_mode} onChange={e => updCustomRule(i, 'tax_base_mode', e.target.value)}>
                        <option value="HT">HT</option><option value="TTC">TTC</option><option value="PREVIOUS_TAX">Prior tax</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block" style={{ color: 'var(--app-muted-foreground)' }}>Order</label>
                      <input className={`${inputCls} font-mono ${inputFocusCls}`} style={inputStyle} type="number" min="0" value={rule.calculation_order} onChange={e => updCustomRule(i, 'calculation_order', parseInt(e.target.value) || 100)} />
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

