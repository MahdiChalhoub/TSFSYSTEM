'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Globe, Loader2, Plus, Pencil, Trash2, Check, X,
  MapPin, DollarSign, Phone, Shield, Save, Hash,
  CreditCard, FileText, Power, PowerOff, Pin,
  Link2, Unlink, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAdmin } from '@/context/AdminContext'

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

type Currency = {
  id: number; code: string; numeric_code: string; name: string
  symbol: string; minor_unit: number; is_active: boolean
}

type Country = {
  id: number; iso2: string; iso3: string; numeric_code: string
  name: string; official_name: string; phone_code: string
  region: string; subregion: string
  default_currency: number | null
  default_currency_code: string | null
  default_currency_symbol: string | null
  is_active: boolean
}

type PaymentGateway = {
  id: number
  code: string
  name: string
  family?: string
  /** Empty array / null = available globally; otherwise list of ISO2 codes. */
  country_codes?: string[] | null
  is_active?: boolean
}

type EInvoiceStandard = {
  id: number
  code: string
  name: string
  region?: string
  invoice_format?: string
  is_active?: boolean
}

type TaxTemplate = {
  id: number
  country_code: string
  country_name?: string
  name?: string
  e_invoice_standard?: number | null
  einvoice_enforcement?: string
}

/**
 * A discriminated union that lives in the same flat array TreeMasterPage
 * consumes. The template builds a tree by `parent` — country rows have no
 * parent (roots), child rows point at the country.id they belong to.
 */
type TreeNode = {
  /** Synthetic ids for child rows; numeric for actual countries. */
  id: number | string
  parent?: number | null
  /** Discriminator for the row renderer. */
  kind: 'country' | 'currency' | 'gateway' | 'einvoice' | 'tax' | 'tenant'
  /** Unified search/display field. */
  name: string
  /** Optional secondary line. */
  subtitle?: string
  /** Type-specific payload (only the originating type knows the shape). */
  data?: any
  /**
   * Pre-computed lowercase blob covering every searchable token for THIS
   * node + its parent country. TreeMasterPage's search does a flat
   * `item[field].includes(q)` check — without this, deep fields like
   * iso2 / phone_code / currency_code wouldn't match. Carrying the parent's
   * blob on each child also keeps children visible when the user searches
   * for the country (e.g. "USA" → US row + all its children).
   */
  searchBlob?: string
}

type TenantUsage = {
  org_id: number
  org_name: string
  is_default?: boolean
}

/* ═══════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════ */

function getFlagEmoji(code: string): string {
  if (!code || code.length < 2) return '🌍'
  const cc = code.toUpperCase().slice(0, 2)
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

const REGION_COLORS: Record<string, string> = {
  'Africa': 'var(--app-warning)',
  'Americas': 'var(--app-info)',
  'Asia': 'var(--app-error)',
  'Europe': 'var(--app-success)',
  'Oceania': 'var(--app-accent)',
  '': 'var(--app-muted-foreground)',
}

const fieldClass = "w-full px-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
const labelClass = "text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-1 block"

/* ═══════════════════════════════════════════════════════
   Currency Edit Modal
   ─────────────────────────────────────────────────────────
   Inline currency CRUD so users don't have to leave the
   country form to add a missing currency. Reused from the
   country form's "+" button.
   ═══════════════════════════════════════════════════════ */

function CurrencyEditModal({ currency, onClose, onSaved }: {
  currency: Currency | null
  onClose: () => void
  onSaved: (newId?: number) => void
}) {
  const isNew = !currency
  const [form, setForm] = useState({
    code: currency?.code || '',
    numeric_code: currency?.numeric_code || '',
    name: currency?.name || '',
    symbol: currency?.symbol || '',
    minor_unit: currency?.minor_unit ?? 2,
    is_active: currency?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, code: form.code.toUpperCase() }
      let result: any
      if (isNew) {
        result = await erpFetch('reference/currencies/', { method: 'POST', body: JSON.stringify(payload) })
        toast.success(`Currency ${payload.code} created`)
      } else {
        result = await erpFetch(`reference/currencies/${currency!.id}/`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success(`Currency ${payload.code} updated`)
      }
      onSaved(result?.id)
      onClose()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save currency')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl animate-in zoom-in-95 duration-200"
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' }}>
            <DollarSign size={16} style={{ color: 'var(--app-info, #3b82f6)' }} />
          </div>
          <div className="flex-1">
            <h3>
              {isNew ? 'New Currency' : `Edit ${form.code}`}
            </h3>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">
              {isNew ? 'Add to global reference' : form.name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label className={labelClass}>Code (ISO 4217)</label>
              <input className={fieldClass} value={form.code} maxLength={3} placeholder="USD"
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required />
            </div>
            <div>
              <label className={labelClass} title="ISO 4217 numeric code — 3-digit identifier (e.g., USD=840, EUR=978). Used by banking files (SWIFT/ISO 20022) and some payment processors. Optional.">
                Numeric
              </label>
              <input className={fieldClass} value={form.numeric_code} maxLength={3} placeholder="840"
                title="3-digit ISO 4217 code (e.g., USD=840, EUR=978, JPY=392)"
                onChange={e => setForm(f => ({ ...f, numeric_code: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Symbol</label>
              <input className={fieldClass} value={form.symbol} maxLength={5} placeholder="$"
                onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Name</label>
            <input className={fieldClass} value={form.name} placeholder="US Dollar"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>

          <div>
            <label className={labelClass}>Minor Unit (decimal places)</label>
            <input className={fieldClass} type="number" min={0} max={6} value={form.minor_unit}
              onChange={e => setForm(f => ({ ...f, minor_unit: Number(e.target.value) }))} />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-app-border accent-[var(--app-primary)]" />
            <span className="text-[12px] font-bold text-app-foreground">Active</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[11px] font-bold text-app-muted-foreground border border-app-border rounded-lg hover:bg-app-surface transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white rounded-lg transition-all hover:brightness-110"
              style={{ background: 'var(--app-info, #3b82f6)', boxShadow: '0 2px 6px color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)' }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Country Edit Modal
   ─────────────────────────────────────────────────────────
   Adds a "+" button next to the currency dropdown that
   opens CurrencyEditModal. After save, the new currency
   is auto-selected and the local list refreshes.
   ═══════════════════════════════════════════════════════ */

function CountryEditModal({ country, currencies, taxTemplates, eInvoiceStandards, onClose, onSaved, onCurrenciesChanged, onTaxTemplatesChanged }: {
  country: Country | null
  currencies: Currency[]
  taxTemplates: TaxTemplate[]
  eInvoiceStandards: EInvoiceStandard[]
  onClose: () => void
  onSaved: () => void
  onCurrenciesChanged: () => Promise<void> | void
  onTaxTemplatesChanged: () => Promise<void> | void
}) {
  const isNew = !country
  // Find the existing tax template for this country (matches iso2 OR iso3).
  const existingTpl = country
    ? taxTemplates.find(t => t.country_code === country.iso2 || t.country_code === country.iso3)
    : null
  const [form, setForm] = useState({
    iso2: country?.iso2 || '',
    iso3: country?.iso3 || '',
    numeric_code: country?.numeric_code || '',
    name: country?.name || '',
    official_name: country?.official_name || '',
    phone_code: country?.phone_code || '',
    region: country?.region || '',
    subregion: country?.subregion || '',
    default_currency: country?.default_currency || ('' as number | string),
    is_active: country?.is_active ?? true,
    // Tax-policy parameters routed via CountryTaxTemplate. Saved as a
    // separate PATCH/POST after the country itself saves.
    e_invoice_standard: existingTpl?.e_invoice_standard ?? ('' as number | string),
    einvoice_enforcement: existingTpl?.einvoice_enforcement || 'OPTIONAL',
  })
  const [saving, setSaving] = useState(false)
  const [showCurrencyModal, setShowCurrencyModal] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        iso2: form.iso2,
        iso3: form.iso3,
        numeric_code: form.numeric_code,
        name: form.name,
        official_name: form.official_name,
        phone_code: form.phone_code,
        region: form.region,
        subregion: form.subregion,
        default_currency: form.default_currency || null,
        is_active: true, // Force-on; per-tenant gate lives in OrgCountry.
      }
      let savedCountryIso = form.iso2
      if (isNew) {
        await erpFetch('reference/countries/', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Country created')
      } else {
        await erpFetch(`reference/countries/${country!.id}/`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Country updated')
      }

      // Tax-policy parameters live on CountryTaxTemplate. We upsert a
      // template row (or PATCH the existing one) keyed by ISO2 so the
      // e-invoice link surfaces on /e-invoice-standards and /countries.
      const wantsTplFields = form.e_invoice_standard !== '' || (form.einvoice_enforcement && form.einvoice_enforcement !== 'NONE')
      if (savedCountryIso && (existingTpl || wantsTplFields)) {
        try {
          const tplPayload: Record<string, unknown> = {
            country_code: savedCountryIso,
            country_name: form.name || country?.name || savedCountryIso,
            currency_code: currencies.find(c => c.id === form.default_currency)?.code || 'USD',
            e_invoice_standard: form.e_invoice_standard || null,
            einvoice_enforcement: form.einvoice_enforcement || 'OPTIONAL',
          }
          if (existingTpl) {
            await erpFetch(`finance/country-tax-templates/${existingTpl.id}/`, { method: 'PATCH', body: JSON.stringify(tplPayload) })
          } else if (wantsTplFields) {
            await erpFetch('finance/country-tax-templates/', { method: 'POST', body: JSON.stringify(tplPayload) })
          }
          await onTaxTemplatesChanged()
        } catch (err: any) {
          toast.error(`Country saved, but tax-template update failed: ${err?.message || 'unknown error'}`)
        }
      }

      onSaved()
      onClose()
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl animate-in zoom-in-95 duration-200"
        style={{
          background: 'var(--app-surface)',
          border: '1px solid var(--app-border)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}>
            {form.iso2 && form.iso2.length >= 2
              ? getFlagEmoji(form.iso2)
              : <Plus size={16} style={{ color: 'var(--app-primary)' }} />}
          </div>
          <div className="flex-1">
            <h3>{isNew ? 'New Country' : `Edit ${form.name}`}</h3>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">
              {isNew ? 'Add to global reference' : `${form.iso2} · ${form.iso3}`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all">
            <X size={14} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Codes Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label className={labelClass}>ISO Alpha-2</label>
              <input className={fieldClass} value={form.iso2} maxLength={2} placeholder="US"
                onChange={e => setForm(f => ({ ...f, iso2: e.target.value.toUpperCase() }))} required />
            </div>
            <div>
              <label className={labelClass}>ISO Alpha-3</label>
              <input className={fieldClass} value={form.iso3} maxLength={3} placeholder="USA"
                onChange={e => setForm(f => ({ ...f, iso3: e.target.value.toUpperCase() }))} required />
            </div>
            <div>
              <label className={labelClass} title="ISO 3166-1 numeric code — 3-digit identifier for the country (e.g., US=840, FR=250, LB=422). Used by customs/UN systems. Optional.">
                Numeric
              </label>
              <input className={fieldClass} value={form.numeric_code} maxLength={3} placeholder="840"
                title="3-digit ISO 3166-1 country code (e.g., US=840, FR=250, LB=422)"
                onChange={e => setForm(f => ({ ...f, numeric_code: e.target.value }))} />
            </div>
          </div>

          {/* Names */}
          <div>
            <label className={labelClass}>Common Name</label>
            <input className={fieldClass} value={form.name} placeholder="United States"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className={labelClass}>Official Name</label>
            <input className={fieldClass} value={form.official_name} placeholder="United States of America"
              onChange={e => setForm(f => ({ ...f, official_name: e.target.value }))} />
          </div>

          {/* Phone + Currency (with inline create) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div>
              <label className={labelClass}>Phone Code</label>
              <input className={fieldClass} value={form.phone_code} placeholder="+1"
                onChange={e => setForm(f => ({ ...f, phone_code: e.target.value }))} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelClass + ' mb-0'}>Default Currency</label>
                <button
                  type="button"
                  onClick={() => setShowCurrencyModal(true)}
                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider transition-colors"
                  style={{ color: 'var(--app-info, #3b82f6)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-primary)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--app-info, #3b82f6)' }}
                >
                  <Plus size={10} /> New
                </button>
              </div>
              <select className={fieldClass} value={form.default_currency}
                onChange={e => setForm(f => ({ ...f, default_currency: e.target.value }))}>
                <option value="">— None —</option>
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Region */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label className={labelClass}>Region</label>
              <input className={fieldClass} value={form.region} placeholder="Americas"
                onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Subregion</label>
              <input className={fieldClass} value={form.subregion} placeholder="Northern America"
                onChange={e => setForm(f => ({ ...f, subregion: e.target.value }))} />
            </div>
          </div>

          {/* Tax-policy parameters — saved as a CountryTaxTemplate row.
              Picking an e-invoice standard here links it to this country
              so it surfaces under the country in the tree on /countries. */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
            <div>
              <label className={labelClass}>E-Invoice Standard</label>
              <select className={fieldClass} value={form.e_invoice_standard}
                onChange={e => setForm(f => ({ ...f, e_invoice_standard: e.target.value }))}>
                <option value="">— None —</option>
                {eInvoiceStandards.filter(ei => ei.is_active !== false).map(ei => (
                  <option key={ei.id} value={ei.id}>{ei.code} — {ei.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Enforcement</label>
              <select className={fieldClass} value={form.einvoice_enforcement}
                onChange={e => setForm(f => ({ ...f, einvoice_enforcement: e.target.value }))}>
                <option value="NONE">None</option>
                <option value="OPTIONAL">Optional</option>
                <option value="RECOMMENDED">Recommended</option>
                <option value="MANDATORY">Mandatory</option>
              </select>
            </div>
          </div>

          {/* Note: `is_active` is NOT exposed here — country availability
              is managed per-tenant via OrgCountry. */}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[11px] font-bold text-app-muted-foreground border border-app-border rounded-lg hover:bg-app-surface transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white rounded-lg transition-all hover:brightness-110"
              style={{ background: 'var(--app-primary)', boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {/* Inline currency creation. After save we refresh the parent's currency
        list and auto-select the newly created one. */}
    {showCurrencyModal && (
      <CurrencyEditModal
        currency={null}
        onClose={() => setShowCurrencyModal(false)}
        onSaved={async (newId) => {
          await onCurrenciesChanged()
          if (newId) setForm(f => ({ ...f, default_currency: newId }))
        }}
      />
    )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════
   Linked Entity Tree — children grouped by kind with
   connector lines. Renders inside an expanded country.
   ─────────────────────────────────────────────────────────
   Layout per country:
       [country row]
        │
        ├── 💵  Currency
        │       └── USD — US Dollar         →
        ├── 🛡️   Tax Templates
        │       └── US Federal Tax          →
        ├── 💳  Payment Gateways
        │       ├── Stripe                  →
        │       └── PayPal (global)         →
        └── 📄  E-Invoice Standards
                └── PEPPOL (XML)            →
   ═══════════════════════════════════════════════════════ */

const LINKED_KIND_META: Record<Exclude<TreeNode['kind'], 'country'>, { color: string; href: string; icon: React.ReactNode; label: string; group: string }> = {
  currency:  { color: 'var(--app-info, #3b82f6)',    href: '/currencies',             icon: <DollarSign size={11} />, label: 'Currency',        group: 'Currency' },
  tax:       { color: 'var(--app-success, #22c55e)', href: '/country-tax-templates',  icon: <Shield size={11} />,     label: 'Tax Template',    group: 'Tax Templates' },
  gateway:   { color: 'var(--app-accent)',           href: '/payment-gateways',       icon: <CreditCard size={11} />, label: 'Payment Gateway', group: 'Payment Gateways' },
  einvoice:  { color: 'var(--app-warning, #f59e0b)', href: '/e-invoice-standards',    icon: <FileText size={11} />,   label: 'E-invoice',       group: 'E-Invoice Standards' },
  tenant:    { color: 'var(--app-primary)',          href: '/organizations',          icon: <Globe size={11} />,      label: 'Tenant',          group: 'Tenants Using' },
}

const KIND_ORDER: Array<Exclude<TreeNode['kind'], 'country'>> = ['currency', 'tax', 'gateway', 'einvoice', 'tenant']

/**
 * Level-3 leaf row. Uses the same row template as the parent country row
 * (w-8 h-8 icon, text-tp-md name) but with a quieter visual treatment so
 * the eye reads it as the deepest level:
 *   • Smaller icon (28×28 vs 32×32 on level 1/2)
 *   • Lighter icon-bg saturation (7% vs 12%)
 *   • Muted-foreground name color
 *   • Smaller text-tp-sm (12px vs 13px)
 * The kind-specific color survives only in the icon + tag, so type is
 * still scannable.
 */
function LinkedLeaf({ node, isLast }: { node: TreeNode; isLast: boolean }) {
  const meta = LINKED_KIND_META[node.kind as Exclude<TreeNode['kind'], 'country'>]
  // Use the in-app tab navigator (categories pattern) instead of <a href>
  // so clicking opens (or focuses) a tab in the navigator without a full
  // page reload. Falls back to a normal link if no admin context exists.
  const { openTab } = useAdmin()
  return (
    <div className="relative" style={{ paddingLeft: '24px' }}>
      <div className="absolute pointer-events-none"
        style={{ left: '4px', top: 0, bottom: isLast ? '50%' : 0, width: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
      <div className="absolute pointer-events-none"
        style={{ left: '4px', top: '50%', width: '14px', height: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
      <button
        type="button"
        onClick={() => openTab(meta.group, meta.href)}
        className="group w-full text-left flex items-center gap-2 md:gap-3 transition-all duration-150 rounded-lg cursor-pointer"
        style={{ padding: '6px 10px', color: 'inherit', background: 'transparent' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 40%, transparent)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${meta.color} 7%, transparent)`, color: meta.color, opacity: 0.85 }}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-tp-sm font-semibold text-app-muted-foreground truncate">{node.name}</span>
            <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${meta.color} 8%, transparent)`, color: meta.color }}>
              {meta.label}
            </span>
          </div>
          {node.subtitle && (
            <p className="text-tp-xxs font-medium text-app-muted-foreground truncate" style={{ opacity: 0.75 }}>{node.subtitle}</p>
          )}
        </div>
      </button>
    </div>
  )
}

/**
 * Three-level tree: country → group (Currency / Tax / Gateways / E-Invoice
 * / Tenants) → leaf. Group headers use the same row template as the parent
 * country row (w-8 h-8 icon, text-tp-md label) so the hierarchy reads with
 * consistent typography across all three levels — only depth indentation
 * and the tree connector mark the level. Each group is collapsible.
 */
function LinkedTree({ children: nodes }: { children: TreeNode[] }) {
  // Bucket once by kind, preserving the fixed visual order.
  const buckets: Record<string, TreeNode[]> = {}
  for (const n of nodes) {
    if (n.kind === 'country') continue
    const k = n.kind
    if (!buckets[k]) buckets[k] = []
    buckets[k].push(n)
  }
  // Always render every kind (Currency / Tax / Gateway / E-Invoice / Tenant)
  // so the user sees the full hierarchy and can drill into empty sections
  // to discover what's available. Empty groups show a "(none)" leaf inside.
  const visibleKinds = KIND_ORDER
  const [openKinds, setOpenKinds] = useState<Record<string, boolean>>({})
  const toggleKind = (k: string) => setOpenKinds(prev => ({ ...prev, [k]: !prev[k] }))

  return (
    <div className="relative ml-9 mr-2 mb-2 mt-1">
      {/* Trunk vertical line — runs through the column of group headers. */}
      <div className="absolute pointer-events-none"
        style={{ left: '11px', top: 0, bottom: '24px', width: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
      {visibleKinds.map((kind, gIdx) => {
        const meta = LINKED_KIND_META[kind]
        const items = buckets[kind] || []
        const isOpen = !!openKinds[kind]
        const isLastGroup = gIdx === visibleKinds.length - 1
        return (
          <div key={kind} className="relative" style={{ paddingLeft: '24px' }}>
            {/* Horizontal branch from trunk into this group's row. */}
            <div className="absolute pointer-events-none"
              style={{ left: '11px', top: '24px', width: '14px', height: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />

            {/* Level-2 group header. Carries a subtle colored band (left
                accent stripe + faint kind-tinted background) so the eye
                reads it as a "section divider" between the country (L1)
                and the leaves (L3). Same row geometry as L1 so heights
                still line up. */}
            <button
              type="button"
              onClick={() => toggleKind(kind)}
              className="w-full group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer rounded-lg text-left relative overflow-hidden"
              style={{
                padding: '8px 10px',
                background: `color-mix(in srgb, ${meta.color} 4%, transparent)`,
                border: `1px solid color-mix(in srgb, ${meta.color} 12%, transparent)`,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${meta.color} 8%, transparent)` }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `color-mix(in srgb, ${meta.color} 4%, transparent)` }}
            >
              {/* Left accent stripe in the kind's color — depth marker. */}
              <span className="absolute left-0 top-0 bottom-0 w-[3px] pointer-events-none"
                style={{ background: meta.color, opacity: 0.7 }} />
              <span className="w-4 h-4 flex items-center justify-center text-app-muted-foreground flex-shrink-0 ml-1"
                style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 150ms' }}>
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2 L8 6 L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}>
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-tp-md font-bold truncate" style={{ color: meta.color }}>{meta.group}</span>
                  <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded tabular-nums"
                    style={{ background: `color-mix(in srgb, ${meta.color} 14%, transparent)`, color: meta.color }}>
                    {items.length}
                  </span>
                </div>
              </div>
            </button>

            {/* Inner trunk that continues to the next group when this one
                is closed (so the vertical guide line never breaks). */}
            {!isLastGroup && (
              <div className="absolute pointer-events-none"
                style={{ left: '11px', top: '24px', bottom: 0, width: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
            )}

            {/* Leaf list — only when this group is expanded. Empty groups
                show a "(none configured)" hint instead of disappearing. */}
            {isOpen && (
              <div className="relative" style={{ paddingLeft: '12px' }}>
                {items.length === 0 ? (
                  <div className="ml-6 px-3 py-1.5 text-tp-xs text-app-muted-foreground italic">
                    None configured for this country yet.
                  </div>
                ) : items.map((n, idx) => (
                  <LinkedLeaf key={String(n.id)} node={n} isLast={idx === items.length - 1} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Country Row — TreeMasterPage-compatible flat row
   ═══════════════════════════════════════════════════════ */

function CountryRow({ item, hasTaxTemplate, isSelected, onSelect, onEdit, onDelete, compact, selectable, isCheckedFn, onToggleCheck, children, forceExpanded }: {
  item: Country
  hasTaxTemplate: boolean
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  compact?: boolean
  selectable?: boolean
  isCheckedFn?: (id: number) => boolean
  onToggleCheck?: (id: number) => void
  /** Linked-entity rows to render nested under this country. */
  children?: TreeNode[]
  /** When set, overrides the per-row expand state (from "Expand all"). */
  forceExpanded?: boolean
}) {
  const regionColor = REGION_COLORS[item.region] || 'var(--app-muted-foreground)'
  const checked = isCheckedFn ? isCheckedFn(item.id) : false
  const hasChildren = (children?.length ?? 0) > 0
  const [openLocal, setOpenLocal] = useState(false)
  const isOpen = forceExpanded ?? openLocal

  return (
    <div className="rounded-lg"
      style={{
        background: isSelected ? 'color-mix(in srgb, var(--app-primary) 6%, transparent)' : 'transparent',
        border: isSelected ? '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)' : '1px solid transparent',
      }}
    >
    <div
      className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer"
      style={{ padding: '8px 10px' }}
      onClick={onSelect}
      onMouseEnter={e => { if (!isSelected) (e.currentTarget.parentElement as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}
      onMouseLeave={e => { if (!isSelected) (e.currentTarget.parentElement as HTMLElement).style.background = 'transparent' }}
    >
      {/* Expand toggle */}
      {hasChildren ? (
        <button
          onClick={e => { e.stopPropagation(); setOpenLocal(o => !o) }}
          className="w-5 h-5 rounded-md flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 150ms' }}
          title={isOpen ? 'Collapse' : 'Expand'}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M4 2 L8 6 L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      ) : (
        <div className="w-5 h-5 flex-shrink-0" />
      )}

      {/* Selection checkbox */}
      {selectable && (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleCheck?.(item.id)}
          onClick={e => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded border-app-border accent-[var(--app-primary)] flex-shrink-0"
        />
      )}

      {/* Flag */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
        {getFlagEmoji(item.iso2)}
      </div>

      {/* Name + Official */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-app-foreground truncate">{item.name}</span>
          {/* Note: per-row activate intentionally removed — see comment in
              parent component. Activation is a tenant-level concern. */}
          {hasTaxTemplate && (
            <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
              Tax
            </span>
          )}
        </div>
        {item.official_name && !compact && (
          <p className="text-[10px] text-app-muted-foreground truncate">{item.official_name}</p>
        )}
      </div>

      {!compact && (
        <>
          {/* Codes */}
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
            <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', color: 'var(--app-foreground)' }}>
              {item.iso2}
            </span>
            <span className="font-mono text-[10px] font-bold text-app-muted-foreground">{item.iso3}</span>
          </div>

          {/* Phone */}
          <div className="hidden md:flex items-center gap-1 w-16 flex-shrink-0">
            <Phone size={10} className="text-app-muted-foreground" />
            <span className="text-[11px] font-bold text-app-muted-foreground">{item.phone_code || '—'}</span>
          </div>

          {/* Currency */}
          <div className="hidden sm:flex items-center gap-1 w-16 flex-shrink-0">
            <DollarSign size={10} style={{ color: 'var(--app-info, #3b82f6)' }} />
            <span className="font-mono text-[11px] font-bold" style={{ color: 'var(--app-info, #3b82f6)' }}>
              {item.default_currency_code || '—'}
            </span>
          </div>

          {/* Region */}
          <div className="hidden lg:flex w-24 flex-shrink-0">
            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded truncate"
              style={{ background: `color-mix(in srgb, ${regionColor} 10%, transparent)`, color: regionColor }}>
              {item.region || 'None'}
            </span>
          </div>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onEdit() }} title="Edit"
          className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
          <Pencil size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete() }} title="Delete"
          className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
          style={{ color: 'var(--app-error, #ef4444)' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>

    {/* Linked entities — grouped by kind with tree connectors so the
        relationship hierarchy reads naturally instead of as a flat list. */}
    {hasChildren && isOpen && (
      <LinkedTree>{children!}</LinkedTree>
    )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Country Detail Panel — sidebar / split-pane content
   ═══════════════════════════════════════════════════════ */

type CountryPanelTab = 'overview' | 'currency' | 'tax' | 'gateways' | 'tenants'

function CountryDetailPanel({ country, hasTaxTemplate, currencies, taxTemplates, eInvoiceStandards, paymentGateways, tenantsForCountry, onEdit, onDelete, onClose, onPin, onUnlinkCurrency, onLinkCurrency, onToggleGateway, onUnlinkEInvoice, onLinkEInvoice }: {
  country: Country
  hasTaxTemplate: boolean
  currencies: Currency[]
  taxTemplates: TaxTemplate[]
  eInvoiceStandards: EInvoiceStandard[]
  paymentGateways: PaymentGateway[]
  tenantsForCountry: TenantUsage[]
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  onPin?: () => void
  /** Open the unlink-currency confirm dialog. */
  onUnlinkCurrency?: () => void
  /** Open the link/change-currency confirm dialog with a chosen currency id. */
  onLinkCurrency?: (currencyId: number) => void
  /** Open the toggle-gateway confirm dialog. */
  onToggleGateway?: (gateway: PaymentGateway) => void
  /** Open the unlink-e-invoice confirm dialog. */
  onUnlinkEInvoice?: (tpl: TaxTemplate, eiName: string) => void
  /** Open the link/change e-invoice confirm dialog with a chosen standard id. */
  onLinkEInvoice?: (eiId: number) => void
}) {
  const [tab, setTab] = useState<CountryPanelTab>('overview')
  const regionColor = REGION_COLORS[country.region] || 'var(--app-muted-foreground)'
  const currency = currencies.find(c => c.id === country.default_currency)
    || currencies.find(c => c.code === country.default_currency_code)
  const taxTpl = taxTemplates.find(t => t.country_code === country.iso2 || t.country_code === country.iso3)
  const eiStandard = taxTpl?.e_invoice_standard
    ? eInvoiceStandards.find(s => s.id === taxTpl.e_invoice_standard)
    : null
  const matchingGateways = paymentGateways.filter(g => {
    const codes = g.country_codes || []
    return !codes.length || codes.includes(country.iso2)
  })

  const Stat = ({ label, value, icon, color }: { label: string; value: React.ReactNode; icon: React.ReactNode; color?: string }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color || 'var(--app-muted-foreground)'} 10%, transparent)`, color: color || 'var(--app-muted-foreground)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground">{label}</div>
        <div className="text-tp-sm font-bold text-app-foreground truncate">{value}</div>
      </div>
    </div>
  )

  // Categories-style tab strip with counts.
  const tabs: { key: CountryPanelTab; label: string; icon: React.ReactNode; count?: number; color?: string }[] = [
    { key: 'overview', label: 'Overview', icon: <Globe size={13} /> },
    { key: 'currency', label: 'Currency', icon: <DollarSign size={13} />, count: currency ? 1 : 0, color: 'var(--app-info, #3b82f6)' },
    { key: 'tax',      label: 'Tax',      icon: <Shield size={13} />,      count: hasTaxTemplate ? 1 : 0, color: 'var(--app-success, #22c55e)' },
    { key: 'gateways', label: 'Gateways', icon: <CreditCard size={13} />, count: matchingGateways.length, color: 'var(--app-accent)' },
    { key: 'tenants',  label: 'Tenants',  icon: <Globe size={13} />,       count: tenantsForCountry.length, color: 'var(--app-primary)' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-primary) 5%, var(--app-surface)), var(--app-surface))',
          borderBottom: '1px solid var(--app-border)',
        }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--app-primary), color-mix(in srgb, var(--app-primary) 75%, var(--app-accent)))',
            boxShadow: '0 3px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)',
          }}>
          {getFlagEmoji(country.iso2)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-tp-lg truncate" style={{ color: 'var(--app-foreground)' }}>
            {country.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-tp-xxs font-bold">
              <span className="uppercase tracking-widest opacity-60" style={{ color: 'var(--app-muted-foreground)' }}>ISO</span>
              <span className="font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                {country.iso2}
              </span>
              <span className="font-mono opacity-60" style={{ color: 'var(--app-muted-foreground)' }}>{country.iso3}</span>
            </span>
            {country.official_name && (
              <span className="text-tp-xxs font-medium italic truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                {country.official_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--app-muted-foreground)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent' }}
            title="Edit">
            <Pencil size={13} />
          </button>
          {onPin && (
            <button onClick={onPin}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
              style={{ color: 'var(--app-muted-foreground)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 10%, transparent)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent' }}
              title="Pin sidebar">
              <Pin size={13} />
            </button>
          )}
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--app-muted-foreground)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-error, #ef4444)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent' }}
            title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex-shrink-0 flex items-center px-1 py-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--app-border)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-tp-sm font-semibold transition-colors flex-shrink-0"
            style={tab === t.key ? {
              background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
              color: 'var(--app-primary)',
            } : { color: 'var(--app-muted-foreground)' }}>
            {t.icon} {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-0.5 text-tp-xxs font-bold px-1 py-[1px] rounded-full min-w-[16px] text-center"
                style={{
                  background: tab === t.key
                    ? `color-mix(in srgb, ${t.color || 'var(--app-primary)'} 15%, transparent)`
                    : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                  color: tab === t.key ? (t.color || 'var(--app-primary)') : 'var(--app-muted-foreground)',
                }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
        {tab === 'overview' && (
          <>
            <Stat label="Region" value={country.region || '—'} icon={<MapPin size={12} />} color={regionColor} />
            {country.subregion && <Stat label="Subregion" value={country.subregion} icon={<MapPin size={12} />} color={regionColor} />}
            <Stat label="Phone Code" value={country.phone_code || '—'} icon={<Phone size={12} />} color="var(--app-muted-foreground)" />
            <Stat label="Default Currency"
              value={currency ? `${currency.code} ${currency.symbol ? `(${currency.symbol})` : ''} — ${currency.name}` : '—'}
              icon={<DollarSign size={12} />} color="var(--app-info, #3b82f6)" />
            {country.numeric_code && (
              <Stat label="ISO Numeric" value={country.numeric_code} icon={<Hash size={12} />} color="var(--app-muted-foreground)" />
            )}
            <Stat label="Tax Template"
              value={hasTaxTemplate ? 'Configured' : 'Not configured'}
              icon={<Shield size={12} />}
              color={hasTaxTemplate ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)'} />
          </>
        )}
        {tab === 'currency' && (
          <>
            {currency ? (
              <>
                <Stat label="Code" value={currency.code} icon={<DollarSign size={12} />} color="var(--app-info, #3b82f6)" />
                <Stat label="Name" value={currency.name} icon={<DollarSign size={12} />} color="var(--app-muted-foreground)" />
                <Stat label="Symbol" value={currency.symbol || '—'} icon={<DollarSign size={12} />} color="var(--app-muted-foreground)" />
                <Stat label="Numeric Code" value={currency.numeric_code || '—'} icon={<Hash size={12} />} color="var(--app-muted-foreground)" />
                <Stat label="Decimal Places" value={String(currency.minor_unit ?? 2)} icon={<Hash size={12} />} color="var(--app-muted-foreground)" />
                {onUnlinkCurrency && (
                  <button onClick={onUnlinkCurrency}
                    className="w-full flex items-center justify-center gap-1.5 mt-1 px-3 py-2 text-tp-xs font-bold rounded-lg border transition-all"
                    style={{ color: 'var(--app-warning, #f59e0b)', borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                    <Unlink size={12} /> Unlink currency from {country.iso2}
                  </button>
                )}
              </>
            ) : (
              <EmptyTab icon={<DollarSign size={24} />} title="No currency linked" subtitle="Pick one below to link, or edit this country." />
            )}
            {/* Link-picker — present whether linked or not. Picking another
                currency fires the link/change confirm dialog. */}
            {onLinkCurrency && (
              <div className="pt-2 mt-2" style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <label className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">
                  {currency ? 'Change currency' : 'Link currency'}
                </label>
                <select className={fieldClass}
                  value=""
                  onChange={e => {
                    const id = Number(e.target.value)
                    if (id) onLinkCurrency(id)
                    e.target.value = ''
                  }}>
                  <option value="">{currency ? `Pick a different currency...` : 'Pick a currency...'}</option>
                  {currencies.filter(c => c.is_active !== false && c.id !== currency?.id).map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
        {tab === 'tax' && (
          <>
            {taxTpl ? (
              <>
                <Stat label="Template Country" value={taxTpl.country_code} icon={<Shield size={12} />} color="var(--app-success, #22c55e)" />
                {taxTpl.country_name && (
                  <Stat label="Template Name" value={taxTpl.country_name} icon={<Shield size={12} />} color="var(--app-muted-foreground)" />
                )}
                <Stat label="E-Invoice Standard"
                  value={eiStandard ? `${eiStandard.code} — ${eiStandard.name}` : '—'}
                  icon={<FileText size={12} />} color="var(--app-warning, #f59e0b)" />
                {taxTpl.einvoice_enforcement && (
                  <Stat label="Enforcement" value={taxTpl.einvoice_enforcement} icon={<Shield size={12} />} color="var(--app-muted-foreground)" />
                )}
                {eiStandard && onUnlinkEInvoice && (
                  <button onClick={() => onUnlinkEInvoice(taxTpl, eiStandard.name)}
                    className="w-full flex items-center justify-center gap-1.5 mt-1 px-3 py-2 text-tp-xs font-bold rounded-lg border transition-all"
                    style={{ color: 'var(--app-warning, #f59e0b)', borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                    <Unlink size={12} /> Unlink {eiStandard.code}
                  </button>
                )}
              </>
            ) : (
              <EmptyTab icon={<Shield size={24} />} title="No tax template" subtitle="Pick an e-invoice standard below — a tax template will be auto-created." />
            )}
            {/* Link/change e-invoice picker — works whether a tax template
                exists or not (it'll be auto-created on first link). */}
            {onLinkEInvoice && eInvoiceStandards.length > 0 && (
              <div className="pt-2 mt-2" style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                <label className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">
                  {eiStandard ? 'Change e-invoice standard' : 'Link e-invoice standard'}
                </label>
                <select className={fieldClass}
                  value=""
                  onChange={e => {
                    const id = Number(e.target.value)
                    if (id) onLinkEInvoice(id)
                    e.target.value = ''
                  }}>
                  <option value="">{eiStandard ? 'Pick a different standard...' : 'Pick a standard...'}</option>
                  {eInvoiceStandards.filter(s => s.is_active !== false && s.id !== eiStandard?.id).map(s => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
        {tab === 'gateways' && (
          <>
            {matchingGateways.length === 0 ? (
              <EmptyTab icon={<CreditCard size={24} />} title="No payment gateways available" subtitle="Pick one below to link, or none exist yet." />
            ) : (
              matchingGateways.map(g => {
                const codes = g.country_codes || []
                const isGlobal = codes.length === 0
                const isLinked = codes.includes(country.iso2)
                return (
                  <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                    <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--app-accent) 10%, transparent)', color: 'var(--app-accent)' }}>
                      <CreditCard size={12} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground">
                        {isGlobal ? 'Global gateway' : (g.family || g.code)}
                      </div>
                      <div className="text-tp-sm font-bold text-app-foreground truncate">{g.name}</div>
                    </div>
                    {onToggleGateway && (
                      <button onClick={() => onToggleGateway(g)}
                        title={isLinked ? `Unlink from ${country.iso2}` : `Link to ${country.iso2}`}
                        className="p-1.5 rounded-lg transition-all flex-shrink-0"
                        style={{ color: isLinked ? 'var(--app-warning, #f59e0b)' : 'var(--app-info, #3b82f6)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        {isLinked ? <Unlink size={12} /> : <Link2 size={12} />}
                      </button>
                    )}
                  </div>
                )
              })
            )}
            {/* Link picker for gateways NOT currently in the matched list. */}
            {onToggleGateway && (() => {
              const unlinkedGateways = paymentGateways.filter(g => {
                const codes = g.country_codes || []
                return codes.length > 0 && !codes.includes(country.iso2)
              })
              if (unlinkedGateways.length === 0) return null
              return (
                <div className="pt-2 mt-2" style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                  <label className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">
                    Add another gateway
                  </label>
                  <select className={fieldClass}
                    value=""
                    onChange={e => {
                      const id = Number(e.target.value)
                      const g = paymentGateways.find(p => p.id === id)
                      if (g) onToggleGateway(g)
                      e.target.value = ''
                    }}>
                    <option value="">Pick a gateway to link...</option>
                    {unlinkedGateways.map(g => (
                      <option key={g.id} value={g.id}>{g.name} ({g.code})</option>
                    ))}
                  </select>
                </div>
              )
            })()}
          </>
        )}
        {tab === 'tenants' && (
          tenantsForCountry.length === 0 ? (
            <EmptyTab icon={<Globe size={24} />} title="No tenants using this country" subtitle="Tenants enable countries from their own admin (Regional Settings)." />
          ) : (
            tenantsForCountry.map(t => (
              <Stat key={t.org_id} label={t.is_default ? 'Default for this tenant' : `Org #${t.org_id}`}
                value={t.org_name} icon={<Globe size={12} />} color="var(--app-primary)" />
            ))
          )
        )}
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-tp-xs font-bold text-white rounded-lg transition-all hover:brightness-110"
          style={{ background: 'var(--app-primary)' }}>
          <Pencil size={12} /> Edit
        </button>
        <button onClick={onDelete}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-tp-xs font-bold rounded-lg border transition-all"
          style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
          <Trash2 size={12} /> Delete
        </button>
      </div>
    </div>
  )
}

/** Generic centered empty state used inside detail-panel tabs. */
function EmptyTab({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2 opacity-40 text-app-muted-foreground"
        style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)' }}>
        {icon}
      </div>
      <p className="text-tp-sm font-bold text-app-muted-foreground">{title}</p>
      {subtitle && <p className="text-tp-xxs text-app-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Floating Bulk Action Bar — shown when N>0 rows selected.
   Mirrors the categories BulkActionBar shape for visual parity.
   ═══════════════════════════════════════════════════════ */

function BulkActionBar({ count, onDelete, onClear }: { count: number; onDelete: () => void; onClear: () => void }) {
  if (count === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-2xl animate-in slide-in-from-bottom-4 duration-200"
      style={{
        background: 'var(--app-surface)',
        border: '1px solid var(--app-border)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
      }}>
      <div className="px-3 py-1.5 rounded-xl text-tp-sm font-bold"
        style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
        {count} selected
      </div>
      <button onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
        style={{
          background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
          color: 'var(--app-error, #ef4444)',
          border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)',
        }}>
        <Trash2 size={13} /> Delete
      </button>
      <button onClick={onClear} title="Clear selection"
        className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
        style={{ color: 'var(--app-muted-foreground)' }}>
        <X size={14} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Main Page — TreeMasterPage consumer
   ═══════════════════════════════════════════════════════ */

export default function SaaSCountriesPage() {
  const [countries, setCountries] = useState<Country[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([])
  const [eInvoiceStandards, setEInvoiceStandards] = useState<EInvoiceStandard[]>([])
  const [taxTemplates, setTaxTemplates] = useState<TaxTemplate[]>([])
  /** Map of country_id → tenants that have this country enabled. Populated
   *  via the SU-only `reference/countries/tenants/` endpoint. Empty {} when
   *  the call fails (older backend) — UI falls back to no Tenants group. */
  const [tenantsByCountry, setTenantsByCountry] = useState<Record<number, TenantUsage[]>>({})
  const [loading, setLoading] = useState(true)
  const [editingCountry, setEditingCountry] = useState<Country | null | 'new'>(null)
  const [editingCurrency, setEditingCurrency] = useState<Currency | null | 'new'>(null)
  /** Friendly delete-confirm state — matches the categories pattern. */
  const [deleteTarget, setDeleteTarget] = useState<Country | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  /**
   * Generic link/unlink action prompt. Each entry describes what to do
   * (`run`), how to phrase it (`title`, `description`), and what severity
   * to render the dialog with. We re-use ConfirmDialog so the gating UX
   * matches every other guarded action in the app.
   */
  type LinkAction = {
    title: string
    description: string
    confirmText: string
    variant: 'danger' | 'warning' | 'info'
    run: () => Promise<void>
  }
  const [linkAction, setLinkAction] = useState<LinkAction | null>(null)
  /** Selection ref kept in sync from TreeMasterPage's render-prop. */
  const selectionRef = React.useRef<{ selectedIds: Set<number>; clearSelection: () => void }>({
    selectedIds: new Set(),
    clearSelection: () => {},
  })

  const fetchCurrencies = useCallback(async () => {
    try {
      const data = await erpFetch('reference/currencies/?limit=300')
      const list = Array.isArray(data) ? data : data?.results || []
      setCurrencies(list)
    } catch { /* swallow — modal will show empty list */ }
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [countriesData, _curr, templatesData, gatewaysData, eiData, tenantsData] = await Promise.all([
        erpFetch('reference/countries/?limit=300'),
        fetchCurrencies(),
        erpFetch('finance/country-tax-templates/').catch(() => []),
        erpFetch('reference/payment-gateways/?limit=200').catch(() => []),
        erpFetch('finance/einvoice-standards/?limit=200').catch(() => []),
        // SU-only tenants endpoint — returns {} on older backends.
        erpFetch('reference/countries/tenants/').catch(() => ({})),
      ])
      const cList = Array.isArray(countriesData) ? countriesData : countriesData?.results || []
      const tList = Array.isArray(templatesData) ? templatesData : templatesData?.results || []
      const gList = Array.isArray(gatewaysData) ? gatewaysData : gatewaysData?.results || []
      const eList = Array.isArray(eiData) ? eiData : eiData?.results || []
      setCountries(cList)
      setTaxTemplates(tList)
      setPaymentGateways(gList)
      setEInvoiceStandards(eList)
      setTenantsByCountry(typeof tenantsData === 'object' && tenantsData !== null && !Array.isArray(tenantsData) ? tenantsData : {})
    } catch {
      toast.error('Failed to load data')
    }
    setLoading(false)
  }, [fetchCurrencies])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Friendly delete via ConfirmDialog state — keeps the modal stack
  // consistent across the app (chart-of-accounts / categories pattern).
  const requestDelete = (c: Country) => setDeleteTarget(c)
  const handleConfirmedDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await erpFetch(`reference/countries/${target.id}/`, { method: 'DELETE' })
      toast.success(`${target.name} deleted`)
      fetchAll()
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete'
      if (/enabled by/i.test(msg)) {
        toast.error('Country is enabled by one or more tenants. Disable it from those tenants first.', { duration: 7000 })
      } else {
        toast.error(msg)
      }
    }
  }

  // Bulk delete — fan-out DELETEs in parallel, aggregate result.
  const handleConfirmedBulkDelete = async () => {
    const ids = Array.from(selectionRef.current.selectedIds)
    setBulkDeleteOpen(false)
    if (ids.length === 0) return
    const t = toast.loading(`Deleting ${ids.length} ${ids.length === 1 ? 'country' : 'countries'}...`)
    const results = await Promise.allSettled(ids.map(id =>
      erpFetch(`reference/countries/${id}/`, { method: 'DELETE' })
    ))
    toast.dismiss(t)
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed === 0) toast.success(`${ids.length} deleted`)
    else toast.error(`${failed} of ${ids.length} failed (likely enabled by tenants)`)
    selectionRef.current.clearSelection()
    fetchAll()
  }

  // ─── Link / unlink helpers ───────────────────────────────────────────
  // Each builder returns a LinkAction prompt rather than running directly,
  // so every operation goes through the ConfirmDialog with a severity-
  // tinted variant + impact summary. Matches the categories migrate-and-
  // delete pattern: never mutate without an explicit confirmation step.

  /** Unlink a country's default currency (PATCH default_currency = null). */
  const promptUnlinkCurrency = (country: Country) => {
    const code = country.default_currency_code || 'this currency'
    setLinkAction({
      title: `Unlink ${code} from ${country.name}?`,
      description: `${country.name} will no longer have a default currency. Tenants enabled in this country will need to pick a currency manually for new transactions. Existing records keep their currency.`,
      confirmText: 'Unlink currency',
      variant: 'warning',
      run: async () => {
        await erpFetch(`reference/countries/${country.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ default_currency: null }),
        })
        toast.success(`Currency unlinked from ${country.name}`)
        await fetchAll()
      },
    })
  }

  /** Add or remove a country's iso2 from a gateway's country_codes list. */
  const promptToggleGateway = (country: Country, gateway: PaymentGateway) => {
    const codes = gateway.country_codes || []
    const isCurrentlyLinked = codes.includes(country.iso2)
    const isGlobal = codes.length === 0
    if (isGlobal) {
      // Linking a country to a global gateway implicitly converts it to
      // a country-scoped gateway (only listed codes will see it). Warn.
      setLinkAction({
        title: `Restrict ${gateway.name} to ${country.name}?`,
        description: `${gateway.name} is currently a GLOBAL gateway (available to every country). Linking only ${country.name} will convert it to a country-scoped gateway and REMOVE it from every other country. Use "Add country to existing list" only when you want to scope a global gateway down. This change is rarely what you want — usually you'd edit the gateway directly.`,
        confirmText: 'Make country-only',
        variant: 'danger',
        run: async () => {
          await erpFetch(`reference/payment-gateways/${gateway.id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ country_codes: [country.iso2] }),
          })
          toast.success(`${gateway.name} restricted to ${country.name}`)
          await fetchAll()
        },
      })
      return
    }
    if (isCurrentlyLinked) {
      setLinkAction({
        title: `Unlink ${gateway.name} from ${country.name}?`,
        description: `${gateway.name} will no longer be offered in ${country.name}. Tenants in ${country.name} that have already configured ${gateway.name} keep their setup; new tenants won't see this option.`,
        confirmText: 'Unlink gateway',
        variant: 'warning',
        run: async () => {
          const next = codes.filter(c => c !== country.iso2)
          await erpFetch(`reference/payment-gateways/${gateway.id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ country_codes: next }),
          })
          toast.success(`${gateway.name} unlinked from ${country.name}`)
          await fetchAll()
        },
      })
    } else {
      setLinkAction({
        title: `Link ${gateway.name} to ${country.name}?`,
        description: `${gateway.name} will be available to tenants in ${country.name}.`,
        confirmText: 'Link gateway',
        variant: 'info',
        run: async () => {
          const next = [...codes, country.iso2]
          await erpFetch(`reference/payment-gateways/${gateway.id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ country_codes: next }),
          })
          toast.success(`${gateway.name} linked to ${country.name}`)
          await fetchAll()
        },
      })
    }
  }

  /** Link / change a country's default currency. */
  const promptLinkCurrency = (country: Country, newCurrencyId: number) => {
    const next = currencies.find(c => c.id === newCurrencyId)
    if (!next) return
    const previousCode = country.default_currency_code || 'none'
    setLinkAction({
      title: previousCode === 'none'
        ? `Link ${next.code} as default currency for ${country.name}?`
        : `Change ${country.name}'s currency from ${previousCode} to ${next.code}?`,
      description: previousCode === 'none'
        ? `${country.name} will use ${next.code} (${next.name}) as its default currency. Tenants enabled in this country will get ${next.code} as the default for new transactions.`
        : `${country.name} currently uses ${previousCode}. After this change, new transactions will default to ${next.code} (${next.name}). Existing records keep their currency.`,
      confirmText: previousCode === 'none' ? 'Link currency' : 'Change currency',
      variant: previousCode === 'none' ? 'info' : 'warning',
      run: async () => {
        await erpFetch(`reference/countries/${country.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ default_currency: newCurrencyId }),
        })
        toast.success(`${next.code} ${previousCode === 'none' ? 'linked to' : 'set as default for'} ${country.name}`)
        await fetchAll()
      },
    })
  }

  /** Link / change a country's e-invoice standard (creates tax template if needed). */
  const promptLinkEInvoice = (country: Country, newEiId: number) => {
    const ei = eInvoiceStandards.find(s => s.id === newEiId)
    if (!ei) return
    const tpl = taxTemplates.find(t => t.country_code === country.iso2 || t.country_code === country.iso3)
    const previousEi = tpl?.e_invoice_standard
      ? eInvoiceStandards.find(s => s.id === tpl.e_invoice_standard)
      : null
    setLinkAction({
      title: previousEi
        ? `Change ${country.name}'s e-invoice standard from ${previousEi.code} to ${ei.code}?`
        : `Link ${ei.code} as e-invoice standard for ${country.name}?`,
      description: previousEi
        ? `${country.name} currently uses ${previousEi.code} (${previousEi.name}). Switching to ${ei.code} (${ei.name}) means tenants in ${country.name} will configure credentials for the new standard. Existing submitted invoices keep their original standard.`
        : `${country.name} will use ${ei.code} (${ei.name}) for e-invoicing. Tenants in ${country.name} will be prompted to configure ${ei.code} credentials. ${tpl ? '' : 'A tax template will be auto-created for this country.'}`,
      confirmText: previousEi ? 'Change standard' : 'Link standard',
      variant: previousEi ? 'warning' : 'info',
      run: async () => {
        const currCode = currencies.find(c => c.id === country.default_currency)?.code
          || country.default_currency_code
          || 'USD'
        if (tpl) {
          await erpFetch(`finance/country-tax-templates/${tpl.id}/`, {
            method: 'PATCH',
            body: JSON.stringify({ e_invoice_standard: newEiId }),
          })
        } else {
          await erpFetch('finance/country-tax-templates/', {
            method: 'POST',
            body: JSON.stringify({
              country_code: country.iso2,
              country_name: country.name,
              currency_code: currCode,
              e_invoice_standard: newEiId,
              einvoice_enforcement: 'OPTIONAL',
            }),
          })
        }
        toast.success(`${ei.code} linked to ${country.name}`)
        await fetchAll()
      },
    })
  }

  /** Unlink the e-invoice standard from a country's tax template. */
  const promptUnlinkEInvoice = (country: Country, tpl: TaxTemplate, eiName: string) => {
    setLinkAction({
      title: `Unlink ${eiName} from ${country.name}?`,
      description: `${country.name} will lose its e-invoicing standard. Tenants in ${country.name} won't be required to submit e-invoices going forward (the tax template stays). Re-link any time from the country form.`,
      confirmText: 'Unlink standard',
      variant: 'warning',
      run: async () => {
        await erpFetch(`finance/country-tax-templates/${tpl.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ e_invoice_standard: null, einvoice_enforcement: 'NONE' }),
        })
        toast.success('E-invoice standard unlinked')
        await fetchAll()
      },
    })
  }

  // Note: country activation is intentionally NOT exposed here. The global
  // ref-country list is fixed (every ISO country exists, period). What
  // changes per-tenant is whether the tenant has *enabled* it in their
  // OrgCountry table — that's done from each tenant's own admin, not from
  // this SaaS-wide registry.

  // Quick-lookup set — keyed by every country_code we've seen on a template.
  // Values are uppercase to match the `iso2 / iso3` we test against later.
  const taxTemplateCountries = useMemo(() => new Set(taxTemplates.map(t => (t.country_code || '').toUpperCase())), [taxTemplates])
  /** Returns true if any tax template references this country by iso2 OR iso3. */
  const hasTaxTemplateFor = useCallback(
    (c?: { iso2?: string | null; iso3?: string | null } | null) =>
      Boolean(c && (taxTemplateCountries.has((c.iso2 || '').toUpperCase()) || taxTemplateCountries.has((c.iso3 || '').toUpperCase()))),
    [taxTemplateCountries],
  )

  // Computed sets
  const regions = useMemo(() => Array.from(new Set(countries.map(c => c.region).filter(Boolean))).sort(), [countries])
  const stats = useMemo(() => {
    const active = countries.filter(c => c.is_active).length
    const withCurrency = countries.filter(c => c.default_currency_code).length
    const withTemplate = countries.filter(c => hasTaxTemplateFor(c)).length
    return { total: countries.length, active, regions: regions.length, withCurrency, withTemplate }
  }, [countries, regions, taxTemplateCountries])

  /**
   * Build the combined tree dataset: each country is a root, with synthetic
   * child rows for the entities linked to it. TreeMasterPage's `data` +
   * default `treeParentKey: 'parent'` flattens this into the expected
   * country → linked-entity hierarchy.
   *
   * Linking rules:
   *  - Currency: country.default_currency (1 child if set)
   *  - Tax template: any tax template with matching country_code
   *  - Payment gateway: any gateway whose country_codes includes the iso2
   *    (gateways with empty country_codes are global → attached to every
   *    country so users can see "what's available here?" at a glance)
   *  - E-invoice: any standard whose region matches country.region
   */
  const treeData = useMemo<TreeNode[]>(() => {
    if (countries.length === 0) return []
    const out: TreeNode[] = []
    const currencyById = new Map(currencies.map(c => [c.id, c]))
    const taxByCountry = new Map<string, TaxTemplate[]>()
    for (const t of taxTemplates) {
      const arr = taxByCountry.get(t.country_code) || []
      arr.push(t)
      taxByCountry.set(t.country_code, arr)
    }

    for (const c of countries) {
      // Searchable blob for the country itself — every token a user might
      // type to find this country: names, ISO codes, phone, currency, region.
      const countryBlob = [
        c.name, c.official_name, c.iso2, c.iso3, c.numeric_code,
        c.phone_code, c.region, c.subregion, c.default_currency_code,
      ].filter(Boolean).join(' ').toLowerCase()

      out.push({
        id: c.id,
        kind: 'country',
        name: c.name,
        subtitle: c.official_name || undefined,
        data: c,
        searchBlob: countryBlob,
      })

      // 1) Currency — try FK first, fall back to default_currency_code so
      //    countries whose FK is null but code is set (legacy seed data, e.g.
      //    Côte d'Ivoire / XOF) still get a currency child.
      const currByFk = c.default_currency != null ? currencyById.get(c.default_currency) : undefined
      const currByCode = !currByFk && c.default_currency_code
        ? currencies.find(cc => cc.code === c.default_currency_code)
        : undefined
      const curr = currByFk || currByCode
      if (curr || c.default_currency_code) {
        const childName = curr ? `${curr.code} — ${curr.name}` : (c.default_currency_code || 'Currency')
        out.push({
          id: `c${c.id}-cur`,
          parent: c.id,
          kind: 'currency',
          name: childName,
          subtitle: curr?.symbol ? `Symbol ${curr.symbol}` : undefined,
          data: curr,
          searchBlob: `${countryBlob} ${childName} ${curr?.code || ''} ${curr?.name || ''}`.toLowerCase(),
        })
      }

      // 2) Tax templates — match by iso2 OR iso3 since seed data uses both.
      const taxes = [
        ...(taxByCountry.get(c.iso2) || []),
        ...(taxByCountry.get(c.iso3) || []),
      ]
      for (const tx of taxes) {
        const childName = tx.name || `Tax template ${tx.country_code}`
        out.push({
          id: `c${c.id}-tax-${tx.id}`,
          parent: c.id,
          kind: 'tax',
          name: childName,
          subtitle: 'Country tax profile',
          data: tx,
          searchBlob: `${countryBlob} ${childName} tax`.toLowerCase(),
        })
      }

      // 3) Payment gateways — country-scoped + global (empty country_codes)
      for (const g of paymentGateways) {
        const codes = g.country_codes || []
        const isGlobal = !codes || codes.length === 0
        const matches = isGlobal || codes.includes(c.iso2)
        if (!matches) continue
        out.push({
          id: `c${c.id}-pg-${g.id}`,
          parent: c.id,
          kind: 'gateway',
          name: g.name,
          subtitle: isGlobal ? 'Global gateway' : (g.family || g.code),
          data: g,
          searchBlob: `${countryBlob} ${g.name} ${g.code} ${g.family || ''}`.toLowerCase(),
        })
      }

      // 4) E-invoice standards — proper linkage chain:
      //    Country → CountryTaxTemplate (by country_code) → e_invoice_standard FK.
      // Each country has at most one standard via its tax template. We also
      // tolerate templates linked by either ISO2 or ISO3 (the seed file
      // uses both shapes inconsistently across countries).
      const tplsForCountry = taxes // taxes was matched above by iso2 only
      // Re-match including iso3 to find tax templates that use 3-letter codes.
      const allTplsForCountry = taxTemplates.filter(t =>
        t.country_code === c.iso2 || t.country_code === c.iso3
      )
      const seenStandards = new Set<number>()
      for (const tpl of allTplsForCountry) {
        const eiId = tpl.e_invoice_standard
        if (eiId == null || seenStandards.has(eiId)) continue
        const ei = eInvoiceStandards.find(s => s.id === eiId)
        if (!ei) continue
        seenStandards.add(eiId)
        out.push({
          id: `c${c.id}-ei-${ei.id}`,
          parent: c.id,
          kind: 'einvoice',
          name: ei.name,
          subtitle: [
            ei.code,
            ei.invoice_format,
            tpl.einvoice_enforcement && tpl.einvoice_enforcement !== 'NONE' ? tpl.einvoice_enforcement.toLowerCase() : null,
          ].filter(Boolean).join(' · '),
          data: ei,
          searchBlob: `${countryBlob} ${ei.name} ${ei.code} ${ei.invoice_format || ''}`.toLowerCase(),
        })
      }
      // Silence the unused-var lint since we kept tplsForCountry for clarity.
      void tplsForCountry

      // 5) Tenants that have enabled this country (cross-tenant view)
      const tenants = tenantsByCountry[c.id] || []
      for (const t of tenants) {
        out.push({
          id: `c${c.id}-org-${t.org_id}`,
          parent: c.id,
          kind: 'tenant',
          name: t.org_name,
          subtitle: t.is_default ? 'Default for this tenant' : `Org #${t.org_id}`,
          data: t,
          searchBlob: `${countryBlob} ${t.org_name}`.toLowerCase(),
        })
      }
    }
    return out
  }, [countries, currencies, paymentGateways, eInvoiceStandards, taxTemplates, tenantsByCountry])

  // Loading splash — TreeMasterPage handles empty-state but not initial spinner.
  if (loading && countries.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-app-primary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <TreeMasterPage
        config={{
          title: 'Countries & Regions',
          subtitle: (_filtered, all) => `${all.length} Countries · ${stats.regions} Regions · SaaS Global Registry`,
          icon: <Globe size={20} />,
          iconColor: 'var(--app-primary)',
          searchPlaceholder: 'Search by name, code, phone, currency... (Ctrl+K)',
          primaryAction: {
            label: 'New Country',
            icon: <Plus size={14} />,
            onClick: () => setEditingCountry('new' as any),
          },
          secondaryActions: [
            {
              label: 'New Currency',
              icon: <DollarSign size={13} />,
              onClick: () => setEditingCurrency('new' as any),
            },
          ],
          dataTools: {
            title: 'Country Data',
            exportFilename: 'countries',
            exportColumns: [
              { key: 'iso2', label: 'ISO2' },
              { key: 'iso3', label: 'ISO3' },
              { key: 'numeric_code', label: 'Numeric' },
              { key: 'name', label: 'Name' },
              { key: 'official_name', label: 'Official Name' },
              { key: 'phone_code', label: 'Phone' },
              { key: 'region', label: 'Region' },
              { key: 'subregion', label: 'Subregion' },
              { key: 'default_currency_code', label: 'Currency' },
              { key: 'is_active', label: 'Active', format: (c: any) => c.is_active ? 'Yes' : 'No' },
            ],
            print: {
              title: 'Countries',
              subtitle: 'Global Registry',
              prefKey: 'print.saas-countries',
              sortBy: 'name',
              columns: [
                { key: 'name', label: 'Country', defaultOn: true },
                { key: 'iso2', label: 'ISO2', mono: true, defaultOn: true, width: '60px' },
                { key: 'iso3', label: 'ISO3', mono: true, defaultOn: true, width: '60px' },
                { key: 'phone', label: 'Phone', mono: true, defaultOn: true, width: '70px' },
                { key: 'currency', label: 'Currency', mono: true, defaultOn: true, width: '70px' },
                { key: 'region', label: 'Region', defaultOn: true, width: '100px' },
              ],
              rowMapper: (c: any) => ({
                name: c.name,
                iso2: c.iso2,
                iso3: c.iso3,
                phone: c.phone_code || '',
                currency: c.default_currency_code || '',
                region: c.region || '',
              }),
            },
          },
          columnHeaders: [
            { label: 'Country', width: 'auto', sortKey: 'name' },
            { label: 'Codes', width: '80px', hideOnMobile: true, sortKey: 'iso2' },
            { label: 'Phone', width: '64px', hideOnMobile: true, sortKey: 'phone_code' },
            { label: 'Currency', width: '64px', color: 'var(--app-info, #3b82f6)', hideOnMobile: true, sortKey: 'currency_code' },
            { label: 'Region', width: '96px', hideOnMobile: true, sortKey: 'region' },
          ],
          // Single-source-of-truth: template owns search + KPI filtering.
          // Combined dataset = countries (kind:'country') + linked entities
          // (kind: currency/gateway/einvoice/tax). buildTree groups children
          // under their country via the synthetic `parent` field.
          data: treeData as unknown as Record<string, unknown>[],
          // `searchBlob` is the pre-flattened lowercase-concat of every
          // searchable token for this node + its parent country. Searching
          // by ISO2/ISO3/phone/currency/region all hit this single field.
          searchFields: ['searchBlob'],
          kpiPredicates: {
            // Predicates only inspect TREE NODES; we route on `kind` so KPI
            // counts measure countries, not linked-row noise.
            withCurrency: (n: any) => n.kind === 'country' && Boolean(n.data?.default_currency_code),
            withTaxTemplate: (n: any) => n.kind === 'country' && hasTaxTemplateFor(n.data),
            inUse: (n: any) => n.kind === 'country' && (tenantsByCountry[Number(n.data?.id)]?.length || 0) > 0,
          },
          kpis: [
            { label: 'Total', icon: <Globe size={11} />, color: 'var(--app-primary)', filterKey: 'all', value: (_, all) => all.filter((n: any) => n.kind === 'country').length },
            { label: 'Regions', icon: <MapPin size={11} />, color: 'var(--app-info, #3b82f6)', value: () => stats.regions },
            { label: 'With Currency', icon: <DollarSign size={11} />, color: 'var(--app-accent)', filterKey: 'withCurrency', value: (filtered) => filtered.filter((n: any) => n.kind === 'country' && n.data?.default_currency_code).length },
            { label: 'Tax Templates', icon: <Shield size={11} />, color: 'var(--app-warning, #f59e0b)', filterKey: 'withTaxTemplate', value: (filtered) => filtered.filter((n: any) => n.kind === 'country' && hasTaxTemplateFor(n.data)).length },
            { label: 'In Use', icon: <Check size={11} />, color: 'var(--app-success, #22c55e)', filterKey: 'inUse', value: (filtered) => filtered.filter((n: any) => n.kind === 'country' && (tenantsByCountry[Number(n.data?.id)]?.length || 0) > 0).length },
          ],
          emptyState: {
            icon: <Globe size={36} />,
            title: (hasSearch) => hasSearch ? 'No matching countries' : 'No countries defined yet',
            subtitle: (hasSearch) => hasSearch
              ? 'Try a different search term or clear filters.'
              : 'Click "New Country" to add one.',
            actionLabel: 'Add First Country',
          },
          onRefresh: fetchAll,
          // Bulk-selection mode — drives the BulkActionBar below.
          selectable: true,
          // Audit trail panel — same shape as categories.
          auditTrail: {
            endpoint: 'audit-trail',
            resourceType: 'country',
            title: 'Country Audit Trail',
          },
        }}
        bulkActions={({ count, clearSelection: clear }) => (
          <BulkActionBar
            count={count}
            onDelete={() => setBulkDeleteOpen(true)}
            onClear={clear}
          />
        )}
        detailPanel={(node, { onClose, onPin }) => {
          const country: Country | null = node?.kind === 'country' ? node.data : null
          if (!country) return null
          return (
            <CountryDetailPanel
              country={country}
              hasTaxTemplate={hasTaxTemplateFor(country)}
              currencies={currencies}
              taxTemplates={taxTemplates}
              eInvoiceStandards={eInvoiceStandards}
              paymentGateways={paymentGateways}
              tenantsForCountry={tenantsByCountry[country.id] || []}
              onEdit={() => { setEditingCountry(country); onClose() }}
              onDelete={() => { requestDelete(country); onClose() }}
              onClose={onClose}
              onPin={onPin ? () => onPin(node) : undefined}
              onUnlinkCurrency={() => promptUnlinkCurrency(country)}
              onLinkCurrency={(id) => promptLinkCurrency(country, id)}
              onToggleGateway={(g) => promptToggleGateway(country, g)}
              onUnlinkEInvoice={(tpl, eiName) => promptUnlinkEInvoice(country, tpl, eiName)}
              onLinkEInvoice={(id) => promptLinkEInvoice(country, id)}
            />
          )
        }}
      >
        {(renderProps) => {
          const { tree, isSelected, openNode, isCompact, expandAll, selectedIds, toggleSelect, clearSelection } = renderProps
          // Sync selection ref for the BulkActionBar handlers.
          selectionRef.current = { selectedIds, clearSelection }
          // tree contains TreeNode objects (built by buildTree) with `children`.
          // We only render top-level country nodes here — linked children are
          // rendered inside CountryRow when expanded.
          return tree
            .filter((n: any) => n.kind === 'country')
            .map((n: any) => {
              const country = n.data as Country
              return (
                <CountryRow
                  key={String(n.id)}
                  item={country}
                  hasTaxTemplate={hasTaxTemplateFor(country)}
                  isSelected={isSelected(n)}
                  onSelect={() => openNode(n, 'overview')}
                  onEdit={() => setEditingCountry(country)}
                  onDelete={() => requestDelete(country)}
                  compact={isCompact}
                  forceExpanded={expandAll}
                  selectable
                  isCheckedFn={(id) => selectedIds.has(id)}
                  onToggleCheck={toggleSelect}
                  // `children` is populated by buildTree on the wrapper node;
                  // pass it through so CountryRow can render linked rows.
                  children={(n.children as TreeNode[]) || []}
                />
              )
            })
        }}
      </TreeMasterPage>

      {/* Country edit modal */}
      {editingCountry !== null && (
        <CountryEditModal
          country={editingCountry === 'new' ? null : editingCountry as Country}
          currencies={currencies}
          taxTemplates={taxTemplates}
          eInvoiceStandards={eInvoiceStandards}
          onClose={() => setEditingCountry(null)}
          onSaved={fetchAll}
          onCurrenciesChanged={fetchCurrencies}
          onTaxTemplatesChanged={fetchAll}
        />
      )}

      {/* Standalone currency modal (from secondaryActions "New Currency") */}
      {editingCurrency !== null && (
        <CurrencyEditModal
          currency={editingCurrency === 'new' ? null : editingCurrency as Currency}
          onClose={() => setEditingCurrency(null)}
          onSaved={() => fetchCurrencies()}
        />
      )}

      {/* Single-row delete — themed confirm dialog (matches categories). */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={handleConfirmedDelete}
        title={`Delete ${deleteTarget?.name || 'country'}?`}
        description={
          deleteTarget
            ? `This removes "${deleteTarget.name}" (${deleteTarget.iso2}) from the global registry. If any tenant has enabled this country, the deletion will be blocked.`
            : 'This action cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
      />

      {/* Bulk delete — same shape as the single-row dialog. */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleConfirmedBulkDelete}
        title={`Delete ${selectionRef.current.selectedIds.size} ${selectionRef.current.selectedIds.size === 1 ? 'country' : 'countries'}?`}
        description="Any country still enabled by at least one tenant will be skipped — the rest will be removed from the registry."
        confirmText="Delete"
        variant="danger"
      />

      {/* Generic link/unlink prompt — every link/unlink action goes through
          this dialog so the variant + impact summary stay consistent. */}
      <ConfirmDialog
        open={linkAction !== null}
        onOpenChange={(open) => { if (!open) setLinkAction(null) }}
        onConfirm={async () => {
          const a = linkAction
          if (!a) return
          setLinkAction(null)
          try { await a.run() }
          catch (err: any) { toast.error(err?.message || 'Action failed') }
        }}
        title={linkAction?.title || ''}
        description={linkAction?.description || ''}
        confirmText={linkAction?.confirmText || 'Confirm'}
        variant={linkAction?.variant || 'warning'}
      />
    </div>
  )
}
