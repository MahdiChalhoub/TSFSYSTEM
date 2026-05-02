'use client'
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react'
import {
  Globe, Plus, Trash2, Loader2, FileText, Shield, ChevronDown,
  Save, ArrowLeft, Sparkles, Tag, Check, ArrowRight, Download,
  Pencil, AlertTriangle, Eye, Zap, Copy
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import {
  type TaxDef, type OrgPreset, type CounterpartyPreset, type DocReq,
  type TaxTreatment, DOC_TYPES, TAX_TYPE_OPTIONS, genId, migrateFromLegacy, type Template
} from './types'

const STEPS = [
  { key: 'identity', label: 'Identity', icon: <Globe size={14} />, color: 'var(--app-success, #22c55e)' },
  { key: 'taxes', label: 'Tax Catalog', icon: <Tag size={14} />, color: 'var(--app-warning, #f59e0b)' },
  { key: 'presets', label: 'Company Tax Policies', icon: <Shield size={14} />, color: 'var(--app-info, #3b82f6)' },
  { key: 'profiles', label: 'Customer & Supplier Profiles', icon: <Sparkles size={14} />, color: 'var(--app-accent)' },
]

const inputCls = "w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 focus:border-app-border transition-all"
const inputSmCls = "w-full text-[11px] font-bold px-1.5 py-1 bg-app-bg border border-app-border/50 rounded-md text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all"

type RefCountry = { iso2: string; name: string; default_currency_code?: string }
type RefCurrency = { code: string; name: string }

export default function TemplateEditor({ id, existing, onClose, prefetchedCountries, prefetchedCurrencies }: {
  id: number | 'new'; existing?: Template; onClose: () => void;
  prefetchedCountries?: RefCountry[]; prefetchedCurrencies?: RefCurrency[];
}) {
  const isNew = id === 'new'
  const [form, setForm] = useState<Record<string, any>>(existing || {
    country_code: '', country_name: '', currency_code: 'USD',
    org_policy_defaults: [], document_requirements: [], counterparty_presets: [],
    custom_tax_rule_presets: [], tax_catalog: [], is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)
  const [refCountries, setRefCountries] = useState<RefCountry[]>(prefetchedCountries || [])
  const [refCurrencies, setRefCurrencies] = useState<RefCurrency[]>(prefetchedCurrencies || [])
  const [editingTax, setEditingTax] = useState<number | null>(null)
  const [editingPreset, setEditingPreset] = useState<number | null>(null)
  const [editingProfile, setEditingProfile] = useState<number | null>(null)
  const [taxEditMode, setTaxEditMode] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollTopRef = useRef<number | null>(null)
  const saveScroll = () => { scrollTopRef.current = scrollRef.current?.scrollTop ?? null }
  useLayoutEffect(() => {
    if (scrollTopRef.current !== null && scrollRef.current) {
      scrollRef.current.scrollTop = scrollTopRef.current
      scrollTopRef.current = null
    }
  })

  // Migrate legacy data on mount
  const [catalog, setCatalog] = useState<TaxDef[]>([])
  const [orgPresets, setOrgPresets] = useState<OrgPreset[]>([])
  const [cpPresets, setCpPresets] = useState<CounterpartyPreset[]>([])

  useEffect(() => {
    const migrated = migrateFromLegacy(form)
    setCatalog(migrated.catalog)
    setOrgPresets(migrated.orgPresets)
    setCpPresets(migrated.cpPresets)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Only fetch if not pre-loaded
  const [einvoiceStds, setEinvoiceStds] = useState<{
    id: number;
    code: string;
    name: string;
    required_credentials: Array<Record<string, unknown>>;
    branding_fields: Array<Record<string, unknown>>;
    region: string;
  }[]>([])
  useEffect(() => {
    if (refCountries.length === 0) {
      erpFetch('reference/countries/?limit=300').then(data => {
        const list = (Array.isArray(data) ? data : data?.results || []) as Array<Record<string, unknown>>
        setRefCountries(list.map((c) => ({
          iso2: String(c.iso2 ?? c.code ?? ''),
          name: String(c.name ?? c.country_name ?? ''),
          default_currency_code: String(c.default_currency_code ?? c.currency_code ?? ''),
        })))
      }).catch(() => {})
    }
    if (refCurrencies.length === 0) {
      erpFetch('reference/currencies/?limit=200').then(data => {
        const list = (Array.isArray(data) ? data : data?.results || []) as Array<Record<string, unknown>>
        setRefCurrencies(list.map((c) => ({
          code: String(c.code ?? c.currency_code ?? ''),
          name: String(c.name ?? c.currency_name ?? ''),
        })))
      }).catch(() => {})
    }
    // Fetch e-invoice standards
    erpFetch('finance/einvoice-standards/').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      setEinvoiceStds(list)
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }))

  async function handleSave() {
    if (!form.country_code || !form.country_name) { toast.error('Country code and name are required'); return }
    setSaving(true)
    try {
      // Pack pipeline data back into the flat JSON fields
      const payload = {
        ...form,
        tax_catalog: catalog,
        custom_tax_rule_presets: catalog.filter(t => t.category === 'CUSTOM'),
        org_policy_defaults: orgPresets,
        counterparty_presets: cpPresets,
      }
      const method = isNew ? 'POST' : 'PUT'
      const url = isNew ? 'finance/country-tax-templates/' : `finance/country-tax-templates/${id}/`
      const result = await erpFetch(url, { method, body: JSON.stringify(payload) })
      toast.success(isNew ? 'Template created — you can continue editing' : 'Template saved')
      // If it was a new template, update the form with the server-assigned ID so subsequent saves use PUT
      if (isNew && result?.id) { upd('id', result.id) }
    } catch (err: unknown) { const m = err instanceof Error ? err.message : null; toast.error(m || 'Save failed') }
    finally { setSaving(false) }
  }

  /* ═══ SECTION CARD helper ═══ */
  const SectionCard = ({ title, icon, color, children, action }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode; action?: React.ReactNode }) => (
    <div className="rounded-xl overflow-hidden mb-2" style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: `color-mix(in srgb, ${color} 5%, var(--app-surface))`, borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
        <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>{icon}</div>
        <span className="text-[11px] font-black text-app-foreground uppercase tracking-wider flex-1">{title}</span>
        {action}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )

  const DOC_CONDITIONS = [
    { value: 'ALWAYS', label: 'Always', hint: 'Every company' },
    { value: 'WHEN_EXEMPT', label: 'When Exempt', hint: 'Rate = 0%, must prove exemption' },
    { value: 'WHEN_RECOVERABLE', label: 'When Recoverable', hint: 'Tax is deductible' },
    { value: 'WHEN_APPLIED', label: 'When Applied', hint: 'Rate > 0%' },
  ]

  /* ═══ DOC LIST helper ═══ */
  const DocList = ({ docs, onChange }: { docs: DocReq[]; onChange: (d: DocReq[]) => void }) => (
    <div className="space-y-1.5">
      {docs.map((d, i) => (
        <div key={i} className="rounded-lg overflow-hidden" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            <select className={inputSmCls + ' max-w-[100px]'} value={d.type} onChange={e => { const nd = [...docs]; nd[i] = { ...nd[i], type: e.target.value }; onChange(nd) }}>
              {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={inputSmCls + ' flex-1'} value={d.label} placeholder="Document label..." onChange={e => { const nd = [...docs]; nd[i] = { ...nd[i], label: e.target.value }; onChange(nd) }} />
            <button onClick={() => onChange(docs.filter((_, j) => j !== i))} className="p-0.5 hover:bg-app-border/50 rounded transition-colors flex-shrink-0" style={{ color: 'var(--app-error, #ef4444)' }}><Trash2 size={10} /></button>
          </div>
          <div className="flex items-center gap-1.5 px-2 pb-1.5" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
            <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest flex-shrink-0 mt-0.5">Required</span>
            <select className={inputSmCls + ' max-w-[130px]'} value={d.condition || 'ALWAYS'} onChange={e => { const nd = [...docs]; nd[i] = { ...nd[i], condition: e.target.value }; onChange(nd) }}>
              {DOC_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label} — {c.hint}</option>)}
            </select>
            <label className="flex items-center gap-0.5 text-[9px] font-bold text-app-foreground flex-shrink-0 cursor-pointer">
              <input type="checkbox" checked={d.required} onChange={e => { const nd = [...docs]; nd[i] = { ...nd[i], required: e.target.checked }; onChange(nd) }} /> Mandatory
            </label>
          </div>
        </div>
      ))}
      <button onClick={() => onChange([...docs, { type: 'CUSTOM', label: '', required: true, renewable: false, renewal_months: null, condition: 'ALWAYS' }])}
        className="flex items-center gap-1 text-[10px] font-bold text-app-primary hover:underline mt-1"><Plus size={10} /> Add Document</button>
    </div>
  )

  return (
    <div className="flex flex-col h-full p-3 md:p-4 animate-in fade-in duration-300">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 flex-wrap">
        <button onClick={onClose} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
          <ArrowLeft size={12} /> Back
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="page-header-icon bg-app-primary" style={{ width: 28, height: 28, boxShadow: '0 3px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
            {isNew ? <Plus size={14} className="text-white" /> : <Globe size={14} className="text-white" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-base font-black text-app-foreground tracking-tight truncate leading-tight">
              {isNew ? 'New Country Template' : `${form.country_code} — ${form.country_name}`}
            </h1>
            <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-widest">
              Step {step + 1} of {STEPS.length} · {STEPS[step].label}
            </p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all flex-shrink-0"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          <span className="hidden sm:inline">{isNew ? 'Create' : 'Save'}</span>
        </button>
      </div>

      {/* ═══ STEP INDICATOR ═══ */}
      <div className="flex items-center gap-1 mb-3 flex-shrink-0 px-1">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.key}>
            <button onClick={() => setStep(i)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition-all text-[11px] font-bold flex-shrink-0"
              style={{
                background: step === i ? `color-mix(in srgb, ${s.color} 12%, var(--app-surface))` : i < step ? `color-mix(in srgb, ${s.color} 5%, transparent)` : 'transparent',
                border: `1.5px solid ${step === i ? s.color : i < step ? `color-mix(in srgb, ${s.color} 30%, transparent)` : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                color: step === i ? s.color : i < step ? s.color : 'var(--app-muted-foreground)',
              }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                style={{ background: i <= step ? `color-mix(in srgb, ${s.color} 20%, transparent)` : 'color-mix(in srgb, var(--app-border) 20%, transparent)' }}>
                {i < step ? <Check size={10} /> : i + 1}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
              {i === 1 && catalog.length > 0 && <span className="text-[8px] font-black px-1.5 py-px rounded-full" style={{ background: `color-mix(in srgb, ${s.color} 15%, transparent)` }}>{catalog.length}</span>}
              {i === 2 && orgPresets.length > 0 && <span className="text-[8px] font-black px-1.5 py-px rounded-full" style={{ background: `color-mix(in srgb, ${s.color} 15%, transparent)` }}>{orgPresets.length}</span>}
              {i === 3 && cpPresets.length > 0 && <span className="text-[8px] font-black px-1.5 py-px rounded-full" style={{ background: `color-mix(in srgb, ${s.color} 15%, transparent)` }}>{cpPresets.length}</span>}
            </button>
            {i < STEPS.length - 1 && <div className="w-4 h-px flex-shrink-0" style={{ background: i < step ? s.color : 'color-mix(in srgb, var(--app-border) 40%, transparent)' }} />}
          </React.Fragment>
        ))}
      </div>

      {/* ═══ STEP CONTENT ═══ */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar rounded-xl p-3"
        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>

        {/* ═══ STEP 1: IDENTITY ═══ */}
        {step === 0 && (
          <div className="animate-in fade-in duration-200">
            <SectionCard title="Country & Currency" icon={<Globe size={12} />} color="var(--app-success, #22c55e)">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                <div>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Country</label>
                  <select className={inputCls} value={form.country_code || ''} onChange={e => {
                    const code = e.target.value; const country = refCountries.find(c => c.iso2 === code)
                    upd('country_code', code)
                    if (country) { upd('country_name', country.name); if (country.default_currency_code) upd('currency_code', country.default_currency_code) }
                  }}>
                    <option value="">— Select country —</option>
                    {refCountries.map(c => <option key={c.iso2} value={c.iso2}>{c.iso2} — {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Display Name</label>
                  <input className={inputCls} value={form.country_name || ''} onChange={e => upd('country_name', e.target.value)} placeholder="e.g. Côte d'Ivoire (OHADA)" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Currency</label>
                  <select className={inputCls} value={form.currency_code || ''} onChange={e => upd('currency_code', e.target.value)}>
                    <option value="">— Select —</option>
                    {refCurrencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Status</label>
                  <label className="flex items-center gap-1.5 cursor-pointer mt-1.5">
                    <input type="checkbox" checked={form.is_active !== false} onChange={e => upd('is_active', e.target.checked)} className="rounded" />
                    <span className="text-[12px] font-bold text-app-foreground">Active</span>
                  </label>
                </div>
              </div>
            </SectionCard>
            <SectionCard title="E-Invoicing" icon={<Zap size={12} />} color="var(--app-accent)">
              <p className="text-[10px] text-app-muted-foreground mb-2">Country default e-invoicing standard. Tenants inherit this and just add their API credentials + branding.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                <div>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">E-Invoice Standard</label>
                  <select className={inputCls} value={form.e_invoice_standard || ''} onChange={e => upd('e_invoice_standard', e.target.value ? parseInt(e.target.value) : null)}>
                    <option value="">None — No e-invoicing</option>
                    {einvoiceStds.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Enforcement</label>
                  <select className={inputCls} value={form.einvoice_enforcement || 'OPTIONAL'} onChange={e => upd('einvoice_enforcement', e.target.value)}>
                    <option value="OPTIONAL">Optional — Tenant can choose</option>
                    <option value="RECOMMENDED">Recommended — Shown as default</option>
                    <option value="MANDATORY">Mandatory — Required by law</option>
                  </select>
                </div>
              </div>
              {(() => {
                const sel = einvoiceStds.find(s => s.id === form.e_invoice_standard)
                if (!sel) return null
                return (
                  <div className="mt-2 pt-2 space-y-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <div className="flex items-center gap-2">
                      <Zap size={12} style={{ color: 'var(--app-accent)' }} />
                      <span className="text-[10px] font-bold text-app-foreground">
                        Tenants will see <strong>{sel.name}</strong>. They fill in their credentials and activate.
                      </span>
                    </div>
                    {sel.required_credentials.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-wider">Credentials:</span>
                        {sel.required_credentials.map((c, i: number) => (
                          <span key={i} className="text-[8px] font-bold px-1.5 py-px rounded" style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-foreground)' }}>
                            {String(c.label ?? c.key ?? '')}{c.required ? ' *' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {sel.branding_fields.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-wider">Branding:</span>
                        {sel.branding_fields.map((b, i: number) => (
                          <span key={i} className="text-[8px] font-bold px-1.5 py-px rounded" style={{ background: 'color-mix(in srgb, var(--app-info) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info) 15%, transparent)', color: 'var(--app-foreground)' }}>
                            {String(b.label ?? b.key ?? '')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}
            </SectionCard>
          </div>
        )}

        {/* ═══ STEP 2: TAX CATALOG ═══ */}
        {step === 1 && editingTax === null && (
          <div className="animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[13px] font-black text-app-foreground">Tax Catalog ({catalog.length})</span>
                <p className="text-[10px] text-app-muted-foreground mt-0.5">Define all taxes for this country — essential and custom. These become the building blocks for presets.</p>
              </div>
              <button onClick={() => {
                const newTax: TaxDef = { id: genId(), name: '', category: 'CUSTOM', tax_type: 'CUSTOM', rate: '0.00', applies_to: 'BOTH', math_behavior: 'ADDED_TO_TTC', cost_treatment: 'EXPENSE', coa_hint: '', documents: [], description: '' }
                setCatalog(c => [...c, newTax])
                setEditingTax(catalog.length)
              }} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary hover:brightness-110 text-white px-2.5 py-1.5 rounded-xl transition-all"
                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                <Plus size={12} /> Add Tax
              </button>
            </div>
            {catalog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Tag size={36} className="text-app-muted-foreground mb-3 opacity-30" />
                <p className="text-[13px] font-bold text-app-muted-foreground">No taxes defined yet</p>
                <p className="text-[11px] text-app-muted-foreground mt-1">Add taxes like &quot;TVA 18%&quot;, &quot;AIRSI 7.5%&quot;, &quot;Zakat 2.5%&quot;</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {catalog.map((tax, i) => (
                  <div key={tax.id} className="group rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-md"
                    onClick={() => setEditingTax(i)}
                    style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <div className="px-3 py-2.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${tax.category === 'ESSENTIAL' ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)'} 10%, transparent)`, color: tax.category === 'ESSENTIAL' ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)' }}>
                        <Tag size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-app-foreground truncate">{tax.name || 'Untitled Tax'}</div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className="text-[8px] font-black px-1.5 py-px rounded-full uppercase tracking-wider"
                            style={{ background: `color-mix(in srgb, ${tax.category === 'ESSENTIAL' ? 'var(--app-success)' : 'var(--app-warning)'} 10%, transparent)`, color: tax.category === 'ESSENTIAL' ? 'var(--app-success)' : 'var(--app-warning)' }}>{tax.category}</span>
                          <span className="text-[8px] font-black px-1.5 py-px rounded-full uppercase tracking-wider"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>{tax.tax_type}</span>
                          <span className="text-[11px] font-bold text-app-muted-foreground ml-1">{tax.rate}% · {tax.applies_to}</span>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setCatalog(c => c.filter((_, j) => j !== i)) }}
                        className="p-1 hover:bg-app-border/50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                        style={{ color: 'var(--app-error, #ef4444)' }}><Trash2 size={13} /></button>
                      <ChevronDown size={14} className="text-app-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 2: TAX DETAIL — VIEW + EDIT ═══ */}
        {step === 1 && editingTax !== null && (() => {
          const tax = catalog[editingTax]
          if (!tax) { setEditingTax(null); return null }
          const updT = <K extends keyof TaxDef>(key: K, val: TaxDef[K]) => {
            const scrollTop = scrollRef.current?.scrollTop || 0
            setCatalog(c => { const nc = [...c]; nc[editingTax] = { ...nc[editingTax], [key]: val }; return nc })
            requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollTop })
          }
          const typeLabel = TAX_TYPE_OPTIONS.find(o => o.value === tax.tax_type)?.label || tax.tax_type

          /* ── VIEW MODE ── */
          if (!taxEditMode) return (
            <div className="animate-in fade-in slide-in-from-right-2 duration-200 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => { setEditingTax(null); setTaxEditMode(false) }} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all">
                  <ArrowLeft size={12} /> Back to catalog
                </button>
                <div className="flex-1" />
                <button onClick={() => setTaxEditMode(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-app-primary hover:brightness-110 border border-app-primary/30 px-2.5 py-1 rounded-lg transition-all"
                  style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)' }}>
                  <Pencil size={11} /> Edit Tax
                </button>
              </div>
              {/* Summary Card */}
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ background: `color-mix(in srgb, ${tax.category === 'ESSENTIAL' ? 'var(--app-success)' : 'var(--app-warning)'} 5%, var(--app-surface))`, borderBottom: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${tax.category === 'ESSENTIAL' ? 'var(--app-success)' : 'var(--app-warning)'} 12%, transparent)`, color: tax.category === 'ESSENTIAL' ? 'var(--app-success)' : 'var(--app-warning)' }}><Tag size={18} /></div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[15px] font-black text-app-foreground">{tax.name || 'Untitled Tax'}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] font-black px-1.5 py-px rounded-full uppercase tracking-wider" style={{ background: `color-mix(in srgb, ${tax.category === 'ESSENTIAL' ? 'var(--app-success)' : 'var(--app-warning)'} 10%, transparent)`, color: tax.category === 'ESSENTIAL' ? 'var(--app-success)' : 'var(--app-warning)' }}>{tax.category}</span>
                      <span className="text-[8px] font-black px-1.5 py-px rounded-full uppercase tracking-wider" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>{typeLabel}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[20px] font-black text-app-foreground tabular-nums">{tax.rate}%</div>
                    <div className="text-[9px] font-bold text-app-muted-foreground uppercase">Default Rate</div>
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                    {[{ l: 'Applies To', v: tax.applies_to }, { l: 'Math', v: tax.math_behavior }, { l: 'Cost Treatment', v: tax.cost_treatment }, { l: 'COA Hint', v: tax.coa_hint || '—' }].map(f => (
                      <div key={f.l}><span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block mb-0.5">{f.l}</span><span className="text-[12px] font-bold text-app-foreground">{f.v}</span></div>
                    ))}
                  </div>
                  {tax.description && <p className="text-[11px] text-app-muted-foreground mt-2 pt-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>{tax.description}</p>}
                  {tax.documents.length > 0 && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                      <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest block mb-1">Documents ({tax.documents.length})</span>
                      <div className="flex flex-wrap gap-1">
                        {tax.documents.map((d, i) => (
                          <span key={i} className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-foreground)' }}>{d.label || d.type} · {d.condition || 'ALWAYS'}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )

          /* ── EDIT MODE ── */
          return (
            <div className="animate-in fade-in duration-200 space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setTaxEditMode(false)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all">
                  <Eye size={12} /> Back to View
                </button>
                <div className="flex-1" />
                <button onClick={() => { setEditingTax(null); setTaxEditMode(false) }} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all">
                  <ArrowLeft size={12} /> Catalog
                </button>
              </div>
              {/* Warning banner */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 25%, transparent)' }}>
                <AlertTriangle size={14} style={{ color: 'var(--app-warning)' }} />
                <span className="text-[11px] font-bold" style={{ color: 'var(--app-warning)' }}>Editing Mode — Changes affect all presets and profiles that reference this tax. Save when ready.</span>
              </div>
              <SectionCard title="Tax Identity" icon={<Tag size={12} />} color="var(--app-warning, #f59e0b)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Tax Name</label>
                    <input className={inputCls} value={tax.name} placeholder="e.g. TVA 18%, AIRSI 7.5%" onChange={e => updT('name', e.target.value)} /></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Category</label>
                    <select className={inputCls} value={tax.category} onChange={e => updT('category', e.target.value as TaxDef['category'])}>
                      <option value="ESSENTIAL">ESSENTIAL — Core tax (VAT, Purchase, Profit)</option>
                      <option value="CUSTOM">CUSTOM — Country-specific (AIRSI, Zakat, etc.)</option>
                    </select></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Tax Type</label>
                    <select className={inputCls} value={tax.tax_type} onChange={e => updT('tax_type', e.target.value)}>
                      {TAX_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Default Rate</label>
                    <div className="flex items-center gap-1"><input type="number" step="0.01" min="0" max="100" className={inputCls + ' flex-1'} value={tax.rate} placeholder="0.00" onChange={e => updT('rate', e.target.value)} /><span className="text-[12px] font-black text-app-muted-foreground">%</span></div></div>
                </div>
              </SectionCard>
              <SectionCard title="Behavior" icon={<Shield size={12} />} color="var(--app-info, #3b82f6)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Applies To</label>
                    <select className={inputCls} value={tax.applies_to} onChange={e => updT('applies_to', e.target.value)}>
                      <option value="BOTH">Both (Purchase & Sale)</option><option value="PURCHASE">Purchase Only</option><option value="SALE">Sale Only</option>
                    </select></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Math Behavior</label>
                    <select className={inputCls} value={tax.math_behavior} onChange={e => updT('math_behavior', e.target.value)}>
                      <option value="ADDED_TO_TTC">Added to TTC (increases invoice)</option><option value="WITHHELD_FROM_AP">Withheld from Payment</option>
                    </select></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Cost Treatment</label>
                    <select className={inputCls} value={tax.cost_treatment} onChange={e => updT('cost_treatment', e.target.value)}>
                      <option value="CAPITALIZE">Capitalize — into inventory cost</option><option value="EXPENSE">Expense — direct P&L</option><option value="RECOVERABLE">Recoverable — deductible</option>
                    </select></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">COA Hint (Suggested Account)</label>
                    <input className={inputCls} value={tax.coa_hint} placeholder="e.g. 4457 - TVA Collectée" onChange={e => updT('coa_hint', e.target.value)} /></div>
                </div>
              </SectionCard>
              <SectionCard title="Description" icon={<FileText size={12} />} color="var(--app-muted-foreground)">
                <textarea className={inputCls + ' min-h-[60px]'} value={tax.description} placeholder="Explain when this tax applies, legal reference, etc." onChange={e => updT('description', e.target.value)} />
              </SectionCard>
              {tax.tax_type === 'VAT' && (
                <SectionCard title="VAT Advanced Rules" icon={<Shield size={12} />} color="var(--app-success, #22c55e)">
                  <p className="text-[10px] text-app-muted-foreground mb-2">Country-level VAT rules that apply when this tax is active.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                    <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Bad Debt Recovery (months)</label>
                      <input className={inputCls} type="number" min={0} value={form.bad_debt_recovery_months ?? 12} onChange={e => upd('bad_debt_recovery_months', parseInt(e.target.value) || 12)} /></div>
                    <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Self-Supply Threshold</label>
                      <input className={inputCls} type="number" min={0} step={0.01} value={form.self_supply_vat_threshold ?? 0} onChange={e => upd('self_supply_vat_threshold', e.target.value)} /></div>
                    <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Gift VAT Threshold</label>
                      <input className={inputCls} type="number" min={0} step={0.01} value={form.gift_vat_threshold ?? 0} onChange={e => upd('gift_vat_threshold', e.target.value)} /></div>
                    <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">VAT on Advance Payment</label>
                      <label className="flex items-center gap-1.5 cursor-pointer mt-1.5">
                        <input type="checkbox" checked={form.vat_on_advance_payment === true} onChange={e => upd('vat_on_advance_payment', e.target.checked)} className="rounded" />
                        <span className="text-[11px] font-bold text-app-foreground">Due when deposit received</span>
                      </label></div>
                  </div>
                </SectionCard>
              )}
              <SectionCard title={`Required Documents (${tax.documents.length})`} icon={<FileText size={12} />} color="var(--app-warning, #f59e0b)">
                <DocList docs={tax.documents} onChange={d => updT('documents', d)} />
              </SectionCard>
            </div>
          )
        })()}

        {/* ═══ STEP 3: ORG PRESETS ═══ */}
        {step === 2 && editingPreset === null && (
          <div className="animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[13px] font-black text-app-foreground">Company Tax Policies ({orgPresets.length})</span>
                <p className="text-[10px] text-app-muted-foreground mt-0.5">Define how each type of company handles taxes. Pick taxes from the catalog like puzzle pieces.</p>
              </div>
              <button onClick={() => {
                const np: OrgPreset = { name: '', tax_ids: [], rate_overrides: {}, tax_treatments: {}, vat_output_enabled: true, vat_input_recoverability: '1.000', official_vat_treatment: 'RECOVERABLE', internal_vat_treatment: 'CAPITALIZE', cost_valuation: 'COST_EFFECTIVE', periodic_interval: 'ANNUAL', allowed_scopes: ['OFFICIAL','INTERNAL'], required_documents: [] }
                setOrgPresets(p => [...p, np])
                setEditingPreset(orgPresets.length)
              }} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary hover:brightness-110 text-white px-2.5 py-1.5 rounded-xl transition-all"
                style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                <Plus size={12} /> New Preset
              </button>
            </div>
            {orgPresets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Shield size={36} className="text-app-muted-foreground mb-3 opacity-30" />
                <p className="text-[13px] font-bold text-app-muted-foreground">No presets yet</p>
                <p className="text-[11px] text-app-muted-foreground mt-1">Add presets like &quot;Standard VAT&quot;, &quot;Simplified&quot;, &quot;Exempt&quot;</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {orgPresets.map((p, i) => {
                  const appliedCount = p.tax_ids.filter(tid => (p.tax_treatments || {})[tid] === 'APPLIED' || !(p.tax_treatments || {})[tid]).length
                  const exemptCount = p.tax_ids.filter(tid => (p.tax_treatments || {})[tid] === 'EXEMPT').length
                  const reducedCount = p.tax_ids.filter(tid => (p.tax_treatments || {})[tid] === 'REDUCED').length
                  return (
                  <div key={i} className="group rounded-xl cursor-pointer transition-all hover:shadow-md" onClick={() => setEditingPreset(i)}
                    style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <div className="px-3 py-2.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}><Shield size={16} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-app-foreground truncate">{p.name || `Preset ${i + 1}`}</div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {appliedCount > 0 && <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase" style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>{appliedCount} applied</span>}
                          {exemptCount > 0 && <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase" style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>{exemptCount} exempt</span>}
                          {reducedCount > 0 && <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>{reducedCount} reduced</span>}
                          <span className="text-[8px] font-bold text-app-muted-foreground">{p.official_vat_treatment} / {p.internal_vat_treatment}</span>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setOrgPresets(ps => [...ps, { ...JSON.parse(JSON.stringify(p)), name: `${p.name || 'Preset'} (copy)` }]) }}
                        className="p-1 hover:bg-app-border/50 rounded-md opacity-0 group-hover:opacity-100 transition-colors" style={{ color: 'var(--app-info)' }} title="Clone"><Copy size={13} /></button>
                      <button onClick={e => { e.stopPropagation(); setOrgPresets(ps => ps.filter((_, j) => j !== i)) }}
                        className="p-1 hover:bg-app-border/50 rounded-md opacity-0 group-hover:opacity-100 transition-colors" style={{ color: 'var(--app-error)' }} title="Delete"><Trash2 size={13} /></button>
                      <ChevronDown size={14} className="text-app-muted-foreground" />
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 3: PRESET DETAIL ═══ */}
        {step === 2 && editingPreset !== null && (() => {
          const p = orgPresets[editingPreset]
          if (!p) { setEditingPreset(null); return null }
          const updP = <K extends keyof OrgPreset>(key: K, val: OrgPreset[K]) => {
            saveScroll()
            setOrgPresets(ps => { const np = [...ps]; np[editingPreset] = { ...np[editingPreset], [key]: val }; return np })
          }
          return (
            <div className="space-y-2">
              <button onClick={() => setEditingPreset(null)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all mb-2">
                <ArrowLeft size={12} /> Back to list
              </button>
              <SectionCard title="Preset Identity" icon={<Shield size={12} />} color="var(--app-info, #3b82f6)">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Name</label>
                    <input className={inputCls} value={p.name} placeholder="e.g. Standard VAT" onChange={e => updP('name', e.target.value)} /></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Scopes</label>
                    <div className="flex items-center gap-3 mt-1.5">
                      {['OFFICIAL','INTERNAL'].map(s => (
                        <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={(p.allowed_scopes || []).includes(s)} onChange={e => { const sc = [...(p.allowed_scopes || [])]; if (e.target.checked && !sc.includes(s)) sc.push(s); else sc.splice(sc.indexOf(s), 1); updP('allowed_scopes', sc) }} />
                          <span className="text-[11px] font-bold text-app-foreground">{s}</span>
                        </label>
                      ))}
                    </div></div>
                </div>
              </SectionCard>
              {/* Tax picker with treatment */}
              <SectionCard title={`Taxes Applied (${p.tax_ids.length}/${catalog.length})`} icon={<Tag size={12} />} color="var(--app-warning, #f59e0b)"
                action={<span className="text-[9px] font-bold text-app-muted-foreground">Pick from catalog · set treatment per tax</span>}>
                {catalog.length === 0 ? (
                  <p className="text-[11px] text-app-muted-foreground italic">No taxes in catalog — go to Step 2 to define taxes first</p>
                ) : (
                  <div className="space-y-1">
                    {catalog.map(tax => {
                      const selected = p.tax_ids.includes(tax.id)
                      const overriddenRate = p.rate_overrides?.[tax.id]
                      const treatment: TaxTreatment = (p.tax_treatments || {})[tax.id] || 'APPLIED'
                      const isExempt = treatment === 'EXEMPT'
                      const isNA = treatment === 'NOT_APPLICABLE'
                      const treatmentColors: Record<TaxTreatment, string> = {
                        'APPLIED': 'var(--app-success, #22c55e)', 'EXEMPT': 'var(--app-warning, #f59e0b)',
                        'REDUCED': 'var(--app-info, #3b82f6)', 'NOT_APPLICABLE': 'var(--app-muted-foreground)',
                      }
                      const tc = treatmentColors[treatment]
                      return (
                        <div key={tax.id} className="rounded-lg overflow-hidden transition-all"
                          style={{
                            background: selected ? `color-mix(in srgb, ${tc} 4%, transparent)` : 'transparent',
                            border: `1px solid ${selected ? `color-mix(in srgb, ${tc} 25%, transparent)` : 'color-mix(in srgb, var(--app-border) 30%, transparent)'}`,
                            opacity: isNA ? 0.5 : 1,
                          }}>
                          <div className="flex items-center gap-2 px-2.5 py-2">
                            <input type="checkbox" checked={selected} onChange={e => {
                              const ids = e.target.checked ? [...p.tax_ids, tax.id] : p.tax_ids.filter(id => id !== tax.id)
                              updP('tax_ids', ids)
                              if (e.target.checked && !(p.tax_treatments || {})[tax.id]) {
                                updP('tax_treatments', { ...(p.tax_treatments || {}), [tax.id]: 'APPLIED' })
                              }
                            }} className="rounded flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[12px] font-bold text-app-foreground">{tax.name || 'Untitled'}</span>
                                <span className="text-[9px] font-bold text-app-muted-foreground">{tax.tax_type} · {tax.applies_to}</span>
                              </div>
                              {/* Treatment badge */}
                              {selected && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase tracking-wider"
                                    style={{ background: `color-mix(in srgb, ${tc} 12%, transparent)`, color: tc }}>
                                    {treatment.replace('_', ' ')}
                                  </span>
                                  {isExempt && <span className="text-[8px] font-bold text-app-muted-foreground">Rate forced to 0%</span>}
                                </div>
                              )}
                            </div>
                            {/* Treatment + Rate controls */}
                            {selected && (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <select className={inputSmCls + ' w-[110px]'}
                                  value={treatment}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => {
                                    const t = e.target.value as TaxTreatment
                                    updP('tax_treatments', { ...(p.tax_treatments || {}), [tax.id]: t })
                                    const ro = { ...(p.rate_overrides || {}) }
                                    if (t === 'EXEMPT') { ro[tax.id] = '0' }
                                    else { delete ro[tax.id] } // revert to catalog default
                                    updP('rate_overrides', ro)
                                  }}>
                                  <option value="APPLIED">✓ Applied</option>
                                  <option value="EXEMPT">○ Exempt</option>
                                  <option value="REDUCED">↓ Reduced</option>
                                  <option value="NOT_APPLICABLE">✗ N/A</option>
                                </select>
                                {!isExempt && !isNA && (
                                  <div className="flex items-center gap-0.5">
                                    <input type="number" step="0.01" className={inputSmCls + ' w-16'}
                                      value={overriddenRate ?? tax.rate} placeholder={tax.rate}
                                      onClick={e => e.stopPropagation()}
                                      onChange={e => updP('rate_overrides', { ...(p.rate_overrides || {}), [tax.id]: e.target.value })} />
                                    <span className="text-[10px] font-black text-app-muted-foreground">%</span>
                                  </div>
                                )}
                                {isExempt && <span className="text-[11px] font-black" style={{ color: 'var(--app-warning)' }}>0%</span>}
                              </div>
                            )}
                          </div>
                          {/* Documents — show relevant ones based on treatment */}
                          {selected && tax.documents.length > 0 && (
                            <div className="px-2.5 pb-2 pt-0.5 flex items-center gap-1 flex-wrap" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                              <FileText size={9} className="text-app-muted-foreground flex-shrink-0" />
                              <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-wider flex-shrink-0">Docs:</span>
                              {tax.documents.filter(d => {
                                const cond = d.condition || 'ALWAYS'
                                if (cond === 'ALWAYS') return true
                                if (cond === 'WHEN_EXEMPT' && isExempt) return true
                                if (cond === 'WHEN_APPLIED' && treatment === 'APPLIED') return true
                                if (cond === 'WHEN_RECOVERABLE') return true
                                return false
                              }).map((d, di) => (
                                <span key={di} className="text-[8px] font-bold px-1 py-px rounded" style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-foreground)' }}>
                                  {d.label || d.type} · {d.condition || 'ALWAYS'}
                                </span>
                              ))}
                              {tax.documents.filter(d => {
                                const cond = d.condition || 'ALWAYS'
                                if (cond === 'ALWAYS') return false
                                if (cond === 'WHEN_EXEMPT' && !isExempt) return true
                                if (cond === 'WHEN_APPLIED' && treatment !== 'APPLIED') return true
                                return false
                              }).length > 0 && <span className="text-[7px] font-bold text-app-muted-foreground italic ml-1">(other docs hidden — change treatment to see)</span>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
              <SectionCard title="VAT Configuration" icon={<span className="text-[10px] font-black">%</span>} color="var(--app-success, #22c55e)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">VAT Output</label>
                    <select className={inputCls} value={String(p.vat_output_enabled)} onChange={e => updP('vat_output_enabled', e.target.value === 'true')}>
                      <option value="true">Yes — Charges VAT</option><option value="false">No — Exempt</option></select></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">VAT Recoverability</label>
                    <div className="flex items-center gap-1"><input type="number" step="0.001" min="0" max="1" className={inputCls + ' flex-1'} value={p.vat_input_recoverability} onChange={e => updP('vat_input_recoverability', e.target.value)} />
                      <span className="text-[10px] font-bold text-app-muted-foreground">= {((parseFloat(p.vat_input_recoverability || '1') * 100) || 0).toFixed(1)}%</span></div></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Official Treatment</label>
                    <select className={inputCls} value={p.official_vat_treatment} onChange={e => updP('official_vat_treatment', e.target.value)}>
                      <option value="RECOVERABLE">RECOVERABLE — cost = HT</option>
                      <option value="CAPITALIZE">CAPITALIZE — cost = TTC, VAT forgotten</option>
                      <option value="CAPITALIZE_TRACKED">CAPITALIZE + TRACKED — cost = TTC, recovery = profit</option>
                      <option value="EXPENSE">EXPENSE — VAT charged to P&L</option>
                    </select></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Internal Treatment</label>
                    <select className={inputCls} value={p.internal_vat_treatment} onChange={e => updP('internal_vat_treatment', e.target.value)}>
                      <option value="RECOVERABLE">RECOVERABLE — cost = HT</option>
                      <option value="CAPITALIZE">CAPITALIZE — cost = TTC, VAT forgotten</option>
                      <option value="CAPITALIZE_TRACKED">CAPITALIZE + TRACKED — cost = TTC, recovery = profit</option>
                      <option value="EXPENSE">EXPENSE — VAT charged to P&L</option>
                    </select></div>
                </div>
                {/* ── Computed Cost Valuation Summary ── */}
                {(() => {
                  const explain = (label: string, t: string) => {
                    if (t === 'RECOVERABLE') return { cost: 'HT', color: 'var(--app-success)', desc: 'VAT deducted → cost = purchase price excl. tax', icon: '↓' }
                    if (t === 'CAPITALIZE_TRACKED') return { cost: 'TTC', color: 'var(--app-warning)', desc: 'VAT tracked separately → recovery booked as profit', icon: '◎' }
                    if (t === 'CAPITALIZE') return { cost: 'TTC', color: 'var(--app-muted-foreground)', desc: 'VAT absorbed into cost → not tracked', icon: '●' }
                    return { cost: 'P&L', color: 'var(--app-destructive)', desc: 'VAT expensed directly to Profit & Loss', icon: '!' }
                  }
                  const off = explain('Official', p.official_vat_treatment)
                  const int = explain('Internal', p.internal_vat_treatment)
                  const recov = parseFloat(p.vat_input_recoverability || '1')
                  return (
                    <div className="mt-2 pt-2 rounded-lg px-2.5 py-2" style={{ background: 'color-mix(in srgb, var(--app-surface) 70%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={10} style={{ color: 'var(--app-primary)' }} />
                        <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Cost Valuation Summary</span>
                        {recov < 1 && recov > 0 && <span className="text-[8px] font-bold px-1.5 py-px rounded-full" style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>Partial recovery: {(recov * 100).toFixed(1)}%</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div className="rounded-lg px-2 py-1.5" style={{ background: `color-mix(in srgb, ${off.color} 5%, transparent)`, border: `1px solid color-mix(in srgb, ${off.color} 15%, transparent)` }}>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: off.color }}>{off.icon} Official</span>
                            <span className="text-[11px] font-black ml-auto" style={{ color: off.color }}>Cost = {off.cost}</span>
                          </div>
                          <p className="text-[8px] font-bold text-app-muted-foreground mt-0.5">{off.desc}</p>
                        </div>
                        <div className="rounded-lg px-2 py-1.5" style={{ background: `color-mix(in srgb, ${int.color} 5%, transparent)`, border: `1px solid color-mix(in srgb, ${int.color} 15%, transparent)` }}>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] font-black uppercase tracking-widest" style={{ color: int.color }}>{int.icon} Internal</span>
                            <span className="text-[11px] font-black ml-auto" style={{ color: int.color }}>Cost = {int.cost}</span>
                          </div>
                          <p className="text-[8px] font-bold text-app-muted-foreground mt-0.5">{int.desc}</p>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </SectionCard>
              <SectionCard title="Filing Period" icon={<Sparkles size={12} />} color="var(--app-primary)">
                <div>
                  <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Tax Declaration Period</label>
                  <select className={inputCls} value={p.periodic_interval} onChange={e => updP('periodic_interval', e.target.value)}>
                    <option value="MONTHLY">MONTHLY</option><option value="QUARTERLY">QUARTERLY</option><option value="ANNUAL">ANNUAL</option>
                  </select>
                </div>
              </SectionCard>
              <SectionCard title={`Documents (${p.required_documents.length})`} icon={<FileText size={12} />} color="var(--app-warning, #f59e0b)">
                <DocList docs={p.required_documents} onChange={d => updP('required_documents', d)} />
              </SectionCard>
            </div>
          )
        })()}

        {/* ═══ STEP 4: COUNTERPARTY PROFILES ═══ */}
        {step === 3 && editingProfile === null && (
          <div className="animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[13px] font-black text-app-foreground">Customer & Supplier Profiles ({cpPresets.length})</span>
                <p className="text-[10px] text-app-muted-foreground mt-0.5">Tax profiles for your customers & suppliers. Import from company policies or create from scratch.</p>
              </div>
              <div className="flex items-center gap-1">
                {orgPresets.length > 0 && (
                  <div className="relative group">
                    <button className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                      <Download size={11} /> Import
                    </button>
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-xl overflow-hidden shadow-lg z-10 hidden group-hover:block"
                      style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                      {orgPresets.map((op, oi) => (
                        <button key={oi} onClick={() => {
                          setCpPresets(ps => [...ps, { name: `${op.name} (copy)`, vat_registered: op.vat_output_enabled, reverse_charge: false, tax_ids: [...op.tax_ids], tax_treatments: { ...(op.tax_treatments || {}) }, required_documents: [...op.required_documents] }])
                        }} className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-app-foreground hover:bg-app-border/30 transition-colors">{op.name || `Preset ${oi + 1}`}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => {
                  setCpPresets(ps => [...ps, { name: '', vat_registered: false, reverse_charge: false, tax_ids: [], tax_treatments: {}, required_documents: [] }])
                  setEditingProfile(cpPresets.length)
                }} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary hover:brightness-110 text-white px-2.5 py-1.5 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={12} /> New Profile
                </button>
              </div>
            </div>
            {cpPresets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles size={36} className="text-app-muted-foreground mb-3 opacity-30" />
                <p className="text-[13px] font-bold text-app-muted-foreground">No profiles yet</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {cpPresets.map((p, i) => {
                  const appliedCount = p.tax_ids.filter(tid => (p.tax_treatments || {})[tid] === 'APPLIED' || !(p.tax_treatments || {})[tid]).length
                  const exemptCount = p.tax_ids.filter(tid => (p.tax_treatments || {})[tid] === 'EXEMPT').length
                  return (
                  <div key={i} className="group rounded-xl cursor-pointer transition-all hover:shadow-md" onClick={() => setEditingProfile(i)}
                    style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                    <div className="px-3 py-2.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'color-mix(in srgb, var(--app-accent) 10%, transparent)', color: 'var(--app-accent)' }}><Sparkles size={16} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold text-app-foreground truncate">{p.name || `Profile ${i + 1}`}</div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {p.vat_registered && <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase" style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>VAT</span>}
                          {p.reverse_charge && <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase" style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>RC</span>}
                          {appliedCount > 0 && <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase" style={{ background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', color: 'var(--app-success)' }}>{appliedCount} applied</span>}
                          {exemptCount > 0 && <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase" style={{ background: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', color: 'var(--app-warning)' }}>{exemptCount} exempt</span>}
                          <span className="text-[8px] font-bold text-app-muted-foreground">{p.required_documents.length} docs</span>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); setCpPresets(ps => [...ps, { ...JSON.parse(JSON.stringify(p)), name: `${p.name || 'Profile'} (copy)` }]) }}
                        className="p-1 hover:bg-app-border/50 rounded-md opacity-0 group-hover:opacity-100 transition-colors" style={{ color: 'var(--app-info)' }} title="Clone"><Copy size={13} /></button>
                      <button onClick={e => { e.stopPropagation(); setCpPresets(ps => ps.filter((_, j) => j !== i)) }}
                        className="p-1 hover:bg-app-border/50 rounded-md opacity-0 group-hover:opacity-100 transition-colors" style={{ color: 'var(--app-error)' }} title="Delete"><Trash2 size={13} /></button>
                      <ChevronDown size={14} className="text-app-muted-foreground" />
                    </div>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 4: PROFILE DETAIL ═══ */}
        {step === 3 && editingProfile !== null && (() => {
          const p = cpPresets[editingProfile]
          if (!p) { setEditingProfile(null); return null }
          const updCP = <K extends keyof CounterpartyPreset>(key: K, val: CounterpartyPreset[K]) => {
            saveScroll()
            setCpPresets(ps => { const np = [...ps]; np[editingProfile] = { ...np[editingProfile], [key]: val }; return np })
          }
          return (
            <div className="space-y-2">
              <button onClick={() => setEditingProfile(null)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1 rounded-lg hover:bg-app-surface transition-all mb-2">
                <ArrowLeft size={12} /> Back to list
              </button>
              <SectionCard title="Profile Identity" icon={<Sparkles size={12} />} color="var(--app-accent)">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Profile Name</label>
                    <input className={inputCls} value={p.name} placeholder="e.g. VAT Registered Supplier" onChange={e => updCP('name', e.target.value)} /></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">VAT Registered</label>
                    <select className={inputCls} value={String(p.vat_registered)} onChange={e => updCP('vat_registered', e.target.value === 'true')}>
                      <option value="true">Yes</option><option value="false">No</option></select></div>
                  <div><label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Reverse Charge</label>
                    <select className={inputCls} value={String(p.reverse_charge)} onChange={e => updCP('reverse_charge', e.target.value === 'true')}>
                      <option value="false">No</option><option value="true">Yes — Auto-liquidation</option></select></div>
                </div>
              </SectionCard>
              <SectionCard title={`Taxes Applied (${p.tax_ids.length})`} icon={<Tag size={12} />} color="var(--app-warning, #f59e0b)"
                action={<span className="text-[9px] font-bold text-app-muted-foreground">Set treatment per tax</span>}>
                {catalog.length === 0 ? <p className="text-[11px] text-app-muted-foreground italic">No taxes in catalog</p> : (
                  <div className="space-y-1">
                    {catalog.map(tax => {
                      const selected = p.tax_ids.includes(tax.id)
                      const treatment: TaxTreatment = (p.tax_treatments || {})[tax.id] || 'APPLIED'
                      const isExempt = treatment === 'EXEMPT'
                      const isNA = treatment === 'NOT_APPLICABLE'
                      const treatmentColors: Record<TaxTreatment, string> = {
                        'APPLIED': 'var(--app-success, #22c55e)', 'EXEMPT': 'var(--app-warning, #f59e0b)',
                        'REDUCED': 'var(--app-info, #3b82f6)', 'NOT_APPLICABLE': 'var(--app-muted-foreground)',
                      }
                      const tc = treatmentColors[treatment]
                      return (
                        <div key={tax.id} className="rounded-lg overflow-hidden transition-all"
                          style={{
                            background: selected ? `color-mix(in srgb, ${tc} 4%, transparent)` : 'transparent',
                            border: `1px solid ${selected ? `color-mix(in srgb, ${tc} 25%, transparent)` : 'color-mix(in srgb, var(--app-border) 30%, transparent)'}`,
                            opacity: isNA ? 0.5 : 1,
                          }}>
                          <div className="flex items-center gap-2 px-2.5 py-1.5">
                            <input type="checkbox" checked={selected} onChange={e => {
                              const ids = e.target.checked ? [...p.tax_ids, tax.id] : p.tax_ids.filter(id => id !== tax.id)
                              updCP('tax_ids', ids)
                              if (e.target.checked && !(p.tax_treatments || {})[tax.id]) {
                                updCP('tax_treatments', { ...(p.tax_treatments || {}), [tax.id]: 'APPLIED' })
                              }
                            }} className="rounded" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[12px] font-bold text-app-foreground">{tax.name || 'Untitled'}</span>
                              <span className="text-[9px] font-bold text-app-muted-foreground ml-1.5">{tax.tax_type}</span>
                              {selected && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className="text-[7px] font-black px-1.5 py-px rounded-full uppercase tracking-wider"
                                    style={{ background: `color-mix(in srgb, ${tc} 12%, transparent)`, color: tc }}>
                                    {treatment.replace('_', ' ')}
                                  </span>
                                </div>
                              )}
                            </div>
                            {selected && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <select className={inputSmCls + ' w-[100px]'}
                                  value={treatment}
                                  onChange={e => updCP('tax_treatments', { ...(p.tax_treatments || {}), [tax.id]: e.target.value as TaxTreatment })}>
                                  <option value="APPLIED">✓ Applied</option>
                                  <option value="EXEMPT">○ Exempt</option>
                                  <option value="REDUCED">↓ Reduced</option>
                                  <option value="NOT_APPLICABLE">✗ N/A</option>
                                </select>
                                {!isExempt && !isNA && <span className="text-[10px] font-bold text-app-muted-foreground">{tax.rate}%</span>}
                                {isExempt && <span className="text-[10px] font-black" style={{ color: 'var(--app-warning)' }}>0%</span>}
                              </div>
                            )}
                            {!selected && <span className="text-[10px] font-bold text-app-muted-foreground">{tax.rate}%</span>}
                          </div>
                          {selected && tax.documents.length > 0 && (
                            <div className="px-2.5 pb-1.5 pt-0.5 flex items-center gap-1 flex-wrap" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 15%, transparent)' }}>
                              <FileText size={9} className="text-app-muted-foreground flex-shrink-0" />
                              <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-wider flex-shrink-0">Docs:</span>
                              {tax.documents.filter(d => {
                                const cond = d.condition || 'ALWAYS'
                                if (cond === 'ALWAYS') return true
                                if (cond === 'WHEN_EXEMPT' && isExempt) return true
                                if (cond === 'WHEN_APPLIED' && treatment === 'APPLIED') return true
                                return false
                              }).map((d, di) => (
                                <span key={di} className="text-[8px] font-bold px-1 py-px rounded" style={{ background: 'color-mix(in srgb, var(--app-warning) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning) 15%, transparent)', color: 'var(--app-foreground)' }}>
                                  {d.label || d.type} · {d.condition || 'ALWAYS'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </SectionCard>
              <SectionCard title={`Documents (${p.required_documents.length})`} icon={<FileText size={12} />} color="var(--app-warning, #f59e0b)">
                <DocList docs={p.required_documents} onChange={d => updCP('required_documents', d)} />
              </SectionCard>
            </div>
          )
        })()}
      </div>

      {/* ═══ NAVIGATION FOOTER ═══ */}
      <div className="flex items-center justify-between mt-2 flex-shrink-0">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-xl hover:bg-app-surface transition-all disabled:opacity-30">
          <ArrowLeft size={12} /> Previous
        </button>
        <div className="text-[10px] font-bold text-app-muted-foreground">
          {catalog.length} taxes · {orgPresets.length} presets · {cpPresets.length} profiles
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
            style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
          </button>
          {step < STEPS.length - 1 && (
            <button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-xl hover:bg-app-surface transition-all">
              Next <ArrowRight size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
