'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Globe, Loader2, Plus, Pencil, Trash2, Check, X,
  MapPin, DollarSign, Phone, Shield, Save, Hash,
  CreditCard, FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'

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
  name?: string
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
            <h3 className="text-[14px] font-black text-app-foreground">
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
              <label className={labelClass}>Numeric</label>
              <input className={fieldClass} value={form.numeric_code} maxLength={3} placeholder="840"
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

function CountryEditModal({ country, currencies, onClose, onSaved, onCurrenciesChanged }: {
  country: Country | null
  currencies: Currency[]
  onClose: () => void
  onSaved: () => void
  onCurrenciesChanged: () => Promise<void> | void
}) {
  const isNew = !country
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
  })
  const [saving, setSaving] = useState(false)
  const [showCurrencyModal, setShowCurrencyModal] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        default_currency: form.default_currency || null,
        is_active: true, // Force-on; per-tenant gate lives in OrgCountry.
      }
      if (isNew) {
        await erpFetch('reference/countries/', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Country created')
      } else {
        await erpFetch(`reference/countries/${country!.id}/`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Country updated')
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
            <h3 className="text-[14px] font-black text-app-foreground">{isNew ? 'New Country' : `Edit ${form.name}`}</h3>
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
              <label className={labelClass}>Numeric</label>
              <input className={fieldClass} value={form.numeric_code} maxLength={3} placeholder="840"
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

          {/* Note: `is_active` is NOT exposed here — country availability
              is managed per-tenant via OrgCountry (see /organizations).
              We always submit is_active:true so legacy false rows in the
              global registry don't keep cascading. */}

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

function LinkedLeaf({ node, isLast }: { node: TreeNode; isLast: boolean }) {
  const meta = LINKED_KIND_META[node.kind as Exclude<TreeNode['kind'], 'country'>]
  return (
    <div className="relative" style={{ paddingLeft: '20px' }}>
      {/* Vertical connector segment for this row (extends only to mid-row if last) */}
      <div className="absolute pointer-events-none"
        style={{
          left: '4px',
          top: 0,
          bottom: isLast ? '50%' : 0,
          width: '1px',
          background: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
        }} />
      {/* Horizontal branch into the row */}
      <div className="absolute pointer-events-none"
        style={{
          left: '4px',
          top: '50%',
          width: '12px',
          height: '1px',
          background: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
        }} />
      <a
        href={meta.href}
        className="group flex items-center gap-2 transition-all duration-150 rounded-md no-underline"
        style={{
          padding: '4px 8px',
          color: 'inherit',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 70%, transparent)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${meta.color} 10%, transparent)`, color: meta.color }}>
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-bold text-app-foreground truncate">{node.name}</div>
          {node.subtitle && (
            <div className="text-[10px] text-app-muted-foreground truncate">{node.subtitle}</div>
          )}
        </div>
      </a>
    </div>
  )
}

/**
 * Render the linked entities for a single country, grouped by kind.
 * Groups sit at the same level (sibling sections) and each can be
 * expanded / collapsed independently. Default = collapsed so the
 * country row stays compact; user clicks a group to reveal leaves.
 */
function LinkedTree({ children: nodes }: { children: TreeNode[] }) {
  // Bucket by kind once
  const buckets: Record<string, TreeNode[]> = {}
  for (const n of nodes) {
    if (n.kind === 'country') continue
    const k = n.kind
    if (!buckets[k]) buckets[k] = []
    buckets[k].push(n)
  }
  const visibleKinds = KIND_ORDER.filter(k => buckets[k]?.length)

  // Per-group expand/collapse — local to this country's expanded view.
  // Defaulting to collapsed keeps the surface scannable when a country has
  // many gateways or templates; clicking a group's chevron expands just it.
  const [openKinds, setOpenKinds] = useState<Record<string, boolean>>({})
  const toggleKind = (k: string) => setOpenKinds(prev => ({ ...prev, [k]: !prev[k] }))

  if (visibleKinds.length === 0) {
    return (
      <div className="px-12 py-2 text-[11px] text-app-muted-foreground italic">
        No linked currency, tax template, payment gateway, or e-invoice standard.
      </div>
    )
  }

  return (
    <div className="relative ml-9 mr-2 mb-2 mt-1">
      {/* Trunk vertical line — runs through the column of group headers. */}
      <div className="absolute pointer-events-none"
        style={{
          left: '11px',
          top: 0,
          bottom: '14px',
          width: '1px',
          background: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
        }} />
      {visibleKinds.map((kind, gIdx) => {
        const meta = LINKED_KIND_META[kind]
        const items = buckets[kind]
        const isOpen = !!openKinds[kind]
        return (
          <div key={kind} className="relative" style={{ paddingLeft: '24px', marginTop: gIdx === 0 ? 0 : 2 }}>
            {/* Horizontal branch from trunk into this group's chevron row. */}
            <div className="absolute pointer-events-none"
              style={{
                left: '11px',
                top: '14px',
                width: '12px',
                height: '1px',
                background: 'color-mix(in srgb, var(--app-border) 50%, transparent)',
              }} />

            {/* Group header — clickable, with chevron and count. */}
            <button
              type="button"
              onClick={() => toggleKind(kind)}
              className="w-full flex items-center gap-1.5 py-1 px-1.5 rounded-md transition-all text-left"
              style={{ background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 70%, transparent)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >
              {/* Chevron */}
              <span className="w-4 h-4 flex items-center justify-center text-app-muted-foreground flex-shrink-0"
                style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 150ms' }}>
                <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                  <path d="M4 2 L8 6 L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {/* Kind icon */}
              <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${meta.color} 10%, transparent)`, color: meta.color }}>
                {meta.icon}
              </div>
              {/* Label */}
              <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: meta.color }}>
                {meta.group}
              </span>
              {/* Count badge */}
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{
                  background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
                  color: meta.color,
                }}>
                {items.length}
              </span>
            </button>

            {/* Leaf list — only when this group is expanded */}
            {isOpen && (
              <div className="relative ml-3 mt-0.5 pb-1">
                {items.length > 1 && (
                  <div className="absolute pointer-events-none"
                    style={{
                      left: '4px',
                      top: 0,
                      bottom: '50%',
                      width: '1px',
                      background: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                    }} />
                )}
                {items.map((n, idx) => (
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

function CountryDetailPanel({ country, hasTaxTemplate, currencies, onEdit, onDelete, onClose }: {
  country: Country
  hasTaxTemplate: boolean
  currencies: Currency[]
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const regionColor = REGION_COLORS[country.region] || 'var(--app-muted-foreground)'
  const currency = currencies.find(c => c.id === country.default_currency)

  const Stat = ({ label, value, icon, color }: { label: string; value: React.ReactNode; icon: React.ReactNode; color?: string }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
        style={{ background: `color-mix(in srgb, ${color || 'var(--app-muted-foreground)'} 10%, transparent)`, color: color || 'var(--app-muted-foreground)' }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-wider text-app-muted-foreground">{label}</div>
        <div className="text-[12px] font-black text-app-foreground truncate">{value}</div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 flex items-start gap-3 px-4 py-3" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
          {getFlagEmoji(country.iso2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-[15px] font-black text-app-foreground truncate">{country.name}</h2>
            {!country.is_active && (
              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
                Inactive
              </span>
            )}
          </div>
          {country.official_name && (
            <p className="text-[11px] text-app-muted-foreground truncate mt-0.5">{country.official_name}</p>
          )}
          <div className="flex items-center gap-1 mt-1.5">
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', color: 'var(--app-foreground)' }}>
              {country.iso2}
            </span>
            <span className="font-mono text-[9px] font-bold text-app-muted-foreground">{country.iso3}</span>
            {country.numeric_code && (
              <span className="font-mono text-[9px] text-app-muted-foreground">· {country.numeric_code}</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        <Stat label="Region" value={country.region || '—'} icon={<MapPin size={12} />} color={regionColor} />
        {country.subregion && <Stat label="Subregion" value={country.subregion} icon={<MapPin size={12} />} color={regionColor} />}
        <Stat label="Phone Code" value={country.phone_code || '—'} icon={<Phone size={12} />} color="var(--app-muted-foreground)" />
        <Stat
          label="Default Currency"
          value={currency ? `${currency.code} ${currency.symbol ? `(${currency.symbol})` : ''} — ${currency.name}` : '—'}
          icon={<DollarSign size={12} />}
          color="var(--app-info, #3b82f6)"
        />
        {country.numeric_code && (
          <Stat label="ISO Numeric" value={country.numeric_code} icon={<Hash size={12} />} color="var(--app-muted-foreground)" />
        )}
        <Stat
          label="Tax Template"
          value={hasTaxTemplate ? 'Configured' : 'Not configured'}
          icon={<Shield size={12} />}
          color={hasTaxTemplate ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)'}
        />
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-white rounded-lg transition-all hover:brightness-110"
          style={{ background: 'var(--app-primary)' }}>
          <Pencil size={12} /> Edit
        </button>
        <button onClick={onDelete}
          className="flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-lg border transition-all"
          style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 25%, transparent)' }}>
          <Trash2 size={12} /> Delete
        </button>
      </div>
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
        erpFetch('reference/e-invoice-standards/?limit=200').catch(() => []),
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

  const handleDelete = async (c: Country) => {
    if (!confirm(`Delete ${c.name} (${c.iso2})?`)) return
    try {
      await erpFetch(`reference/countries/${c.id}/`, { method: 'DELETE' })
      toast.success(`${c.name} deleted`)
      fetchAll()
    } catch { toast.error('Failed to delete') }
  }

  // Note: country activation is intentionally NOT exposed here. The global
  // ref-country list is fixed (every ISO country exists, period). What
  // changes per-tenant is whether the tenant has *enabled* it in their
  // OrgCountry table — that's done from each tenant's own admin, not from
  // this SaaS-wide registry.

  // Quick-lookup sets
  const taxTemplateCountries = useMemo(() => new Set(taxTemplates.map(t => t.country_code)), [taxTemplates])

  // Computed sets
  const regions = useMemo(() => Array.from(new Set(countries.map(c => c.region).filter(Boolean))).sort(), [countries])
  const stats = useMemo(() => {
    const active = countries.filter(c => c.is_active).length
    const withCurrency = countries.filter(c => c.default_currency_code).length
    const withTemplate = countries.filter(c => taxTemplateCountries.has(c.iso2)).length
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

      // 2) Tax templates
      const taxes = taxByCountry.get(c.iso2) || []
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

      // 4) E-invoice standards by region match
      if (c.region) {
        for (const ei of eInvoiceStandards) {
          if (!ei.region) continue
          if (ei.region.toLowerCase() === c.region.toLowerCase()) {
            out.push({
              id: `c${c.id}-ei-${ei.id}`,
              parent: c.id,
              kind: 'einvoice',
              name: ei.name,
              subtitle: ei.invoice_format ? `${ei.code} · ${ei.invoice_format}` : ei.code,
              data: ei,
              searchBlob: `${countryBlob} ${ei.name} ${ei.code} ${ei.invoice_format || ''}`.toLowerCase(),
            })
          }
        }
      }

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
          // Currencies are manageable here; activation is tenant-level so
          // there's no global "Activate All" — see the per-tenant org-
          // countries admin for that.
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
            { label: 'Country', width: 'auto' },
            { label: 'Codes', width: '80px', hideOnMobile: true },
            { label: 'Phone', width: '64px', hideOnMobile: true },
            { label: 'Currency', width: '64px', color: 'var(--app-info, #3b82f6)', hideOnMobile: true },
            { label: 'Region', width: '96px', hideOnMobile: true },
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
            withTaxTemplate: (n: any) => n.kind === 'country' && taxTemplateCountries.has(String(n.data?.iso2)),
            inUse: (n: any) => n.kind === 'country' && (tenantsByCountry[Number(n.data?.id)]?.length || 0) > 0,
          },
          kpis: [
            { label: 'Total', icon: <Globe size={11} />, color: 'var(--app-primary)', filterKey: 'all', value: (_, all) => all.filter((n: any) => n.kind === 'country').length },
            { label: 'Regions', icon: <MapPin size={11} />, color: 'var(--app-info, #3b82f6)', value: () => stats.regions },
            { label: 'With Currency', icon: <DollarSign size={11} />, color: 'var(--app-accent)', filterKey: 'withCurrency', value: (filtered) => filtered.filter((n: any) => n.kind === 'country' && n.data?.default_currency_code).length },
            { label: 'Tax Templates', icon: <Shield size={11} />, color: 'var(--app-warning, #f59e0b)', filterKey: 'withTaxTemplate', value: (filtered) => filtered.filter((n: any) => n.kind === 'country' && taxTemplateCountries.has(n.data?.iso2)).length },
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
        }}
        detailPanel={(node, { onClose }) => {
          // The tree node is our combined-shape; only country rows have the
          // detail panel — children open the editor for their own type.
          const country: Country | null = node?.kind === 'country' ? node.data : null
          if (!country) return null
          return (
            <CountryDetailPanel
              country={country}
              hasTaxTemplate={taxTemplateCountries.has(country.iso2)}
              currencies={currencies}
              onEdit={() => { setEditingCountry(country); onClose() }}
              onDelete={() => { handleDelete(country); onClose() }}
              onClose={onClose}
            />
          )
        }}
      >
        {(renderProps) => {
          const { tree, isSelected, openNode, isCompact, expandAll } = renderProps
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
                  hasTaxTemplate={taxTemplateCountries.has(country.iso2)}
                  isSelected={isSelected(n)}
                  onSelect={() => openNode(n, 'overview')}
                  onEdit={() => setEditingCountry(country)}
                  onDelete={() => handleDelete(country)}
                  compact={isCompact}
                  forceExpanded={expandAll}
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
          onClose={() => setEditingCountry(null)}
          onSaved={fetchAll}
          onCurrenciesChanged={fetchCurrencies}
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
    </div>
  )
}
