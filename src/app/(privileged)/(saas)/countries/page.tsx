'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Globe, Search, Loader2, Plus, Pencil, Trash2, Check, X,
  Maximize2, Minimize2, MapPin, DollarSign, Phone, Shield,
  ChevronRight, ChevronDown, Save, Filter, Hash,
  LayoutGrid, Rows3,
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'

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

/* ═══════════════════════════════════════════════════════
   Edit Modal
   ═══════════════════════════════════════════════════════ */

function CountryEditModal({ country, currencies, onClose, onSaved }: {
  country: Country | null
  currencies: Currency[]
  onClose: () => void
  onSaved: () => void
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
    default_currency: country?.default_currency || '',
    is_active: country?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        default_currency: form.default_currency || null,
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

  const fieldClass = "w-full px-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
  const labelClass = "text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-1 block"

  return (
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
            {/* Show the flag as soon as iso2 has the 2 letters we need to compute it.
                Falling back to the + icon for empty/invalid iso2 keeps the "creating
                a new record" affordance until the user starts typing. */}
            {form.iso2 && form.iso2.length >= 2 ? getFlagEmoji(form.iso2) : <Plus size={16} style={{ color: 'var(--app-primary)' }} />}
          </div>
          <div>
            <h3 className="text-[14px] font-black text-app-foreground">{isNew ? 'New Country' : `Edit ${form.name}`}</h3>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-wider">
              {isNew ? 'Add to global reference' : `${form.iso2} · ${form.iso3}`}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all">
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

          {/* Phone + Currency */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
            <div>
              <label className={labelClass}>Phone Code</label>
              <input className={fieldClass} value={form.phone_code} placeholder="+1"
                onChange={e => setForm(f => ({ ...f, phone_code: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Default Currency</label>
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

          {/* Active */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-app-border accent-[var(--app-primary)]" />
            <span className="text-[12px] font-bold text-app-foreground">Active</span>
          </label>

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
  )
}

/* ═══════════════════════════════════════════════════════
   Country Row
   ═══════════════════════════════════════════════════════ */

function CountryRow({ item, hasTaxTemplate, onEdit, onDelete }: {
  item: Country
  hasTaxTemplate: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const regionColor = REGION_COLORS[item.region] || 'var(--app-muted-foreground)'

  return (
    <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5"
      style={{ paddingLeft: '12px', paddingRight: '12px' }}>

      {/* Flag */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
        {getFlagEmoji(item.iso2)}
      </div>

      {/* Name + Official */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-app-foreground truncate">{item.name}</span>
          {!item.is_active && (
            <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
              Inactive
            </span>
          )}
          {hasTaxTemplate && (
            <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
              Tax Template
            </span>
          )}
        </div>
        {item.official_name && (
          <p className="text-[10px] text-app-muted-foreground truncate">{item.official_name}</p>
        )}
      </div>

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

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} title="Edit"
          className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
          <Pencil size={12} />
        </button>
        <button onClick={onDelete} title="Delete"
          className="p-1.5 hover:bg-app-border/50 rounded-lg transition-colors"
          style={{ color: 'var(--app-error, #ef4444)' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}


/* ═══════════════════════════════════════════════════════
   Country Card (compact tile for grid view)
   ═══════════════════════════════════════════════════════ */

function CountryCard({ item, hasTaxTemplate, onEdit, onDelete }: {
  item: Country
  hasTaxTemplate: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const regionColor = REGION_COLORS[item.region] || 'var(--app-muted-foreground)'

  return (
    <div
      className="group relative rounded-xl p-3 transition-all duration-150 cursor-pointer flex flex-col gap-2"
      style={{
        background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
        border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
      }}
      onClick={onEdit}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)';
        (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 90%, transparent)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--app-border) 50%, transparent)';
        (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 60%, transparent)';
      }}
    >
      {/* Top: flag + name + iso */}
      <div className="flex items-start gap-2.5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>
          {getFlagEmoji(item.iso2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-black text-app-foreground truncate">{item.name}</span>
            {!item.is_active && (
              <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
                Off
              </span>
            )}
          </div>
          {item.official_name && (
            <p className="text-[10px] text-app-muted-foreground truncate mt-0.5">{item.official_name}</p>
          )}
          <div className="flex items-center gap-1 mt-1">
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', color: 'var(--app-foreground)' }}>
              {item.iso2}
            </span>
            <span className="font-mono text-[9px] font-bold text-app-muted-foreground">{item.iso3}</span>
            {item.numeric_code && (
              <span className="font-mono text-[9px] text-app-muted-foreground">· {item.numeric_code}</span>
            )}
          </div>
        </div>
      </div>

      {/* Middle: chips row — region, currency, phone */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {item.region && (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: `color-mix(in srgb, ${regionColor} 10%, transparent)`, color: regionColor }}>
            <MapPin size={9} /> {item.region}
          </span>
        )}
        {item.default_currency_code && (
          <span className="flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
            <DollarSign size={9} /> {item.default_currency_code}
          </span>
        )}
        {item.phone_code && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-app-muted-foreground">
            <Phone size={9} /> {item.phone_code}
          </span>
        )}
        {hasTaxTemplate && (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ml-auto"
            style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)', color: 'var(--app-success, #22c55e)' }}>
            <Shield size={9} /> Tax
          </span>
        )}
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onEdit(); }}
          title="Edit"
          className="p-1.5 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"
          style={{ background: 'color-mix(in srgb, var(--app-background) 70%, transparent)' }}>
          <Pencil size={11} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          title="Delete"
          className="p-1.5 rounded-lg transition-colors"
          style={{
            color: 'var(--app-error, #ef4444)',
            background: 'color-mix(in srgb, var(--app-background) 70%, transparent)',
          }}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════ */

export default function SaaSCountriesPage() {
  const [countries, setCountries] = useState<Country[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [taxTemplateCountries, setTaxTemplateCountries] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState<string>('')
  const [focusMode, setFocusMode] = useState(false)
  const [editingCountry, setEditingCountry] = useState<Country | null | 'new'>(null)
  // View mode: persisted per user so the choice survives reloads. Defaults to
  // list — the historical view — so existing users see no change until they
  // opt in. Storage key namespaced with v1 in case we change shape later.
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem('saas_countries_view_v1')
    if (saved === 'cards' || saved === 'list') setViewMode(saved)
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('saas_countries_view_v1', viewMode)
  }, [viewMode])
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [countriesData, currenciesData, templatesData] = await Promise.all([
        erpFetch('reference/countries/?limit=300'),
        erpFetch('reference/currencies/?limit=300'),
        erpFetch('finance/country-tax-templates/').catch(() => []),
      ])
      const cList = Array.isArray(countriesData) ? countriesData : countriesData?.results || []
      const curList = Array.isArray(currenciesData) ? currenciesData : currenciesData?.results || []
      const tList = Array.isArray(templatesData) ? templatesData : templatesData?.results || []

      setCountries(cList)
      setCurrencies(curList)
      setTaxTemplateCountries(new Set(tList.map((t: any) => t.country_code)))
    } catch {
      toast.error('Failed to load data')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleDelete = async (c: Country) => {
    if (!confirm(`Delete ${c.name} (${c.iso2})?`)) return
    try {
      await erpFetch(`reference/countries/${c.id}/`, { method: 'DELETE' })
      toast.success(`${c.name} deleted`)
      fetchAll()
    } catch { toast.error('Failed to delete') }
  }

  // Computed
  const regions = useMemo(() => {
    const set = new Set(countries.map(c => c.region).filter(Boolean))
    return Array.from(set).sort()
  }, [countries])

  const filtered = useMemo(() => {
    let list = countries
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.iso3.toLowerCase().includes(q) ||
        c.official_name?.toLowerCase().includes(q) ||
        c.phone_code?.includes(q) ||
        c.default_currency_code?.toLowerCase().includes(q)
      )
    }
    if (regionFilter) {
      list = list.filter(c => c.region === regionFilter)
    }
    return list
  }, [countries, search, regionFilter])

  const stats = useMemo(() => {
    const active = countries.filter(c => c.is_active).length
    const withCurrency = countries.filter(c => c.default_currency_code).length
    const withTemplate = countries.filter(c => taxTemplateCountries.has(c.iso2)).length
    return { total: countries.length, active, regions: regions.length, withCurrency, withTemplate }
  }, [countries, regions, taxTemplateCountries])

  const kpis = [
    { label: 'Countries', value: stats.total, icon: <Globe size={13} />, color: 'var(--app-primary)' },
    { label: 'Active', value: stats.active, icon: <Check size={13} />, color: 'var(--app-success, #22c55e)' },
    { label: 'Regions', value: stats.regions, icon: <MapPin size={13} />, color: 'var(--app-info, #3b82f6)' },
    { label: 'With Currency', value: stats.withCurrency, icon: <DollarSign size={13} />, color: 'var(--app-accent)' },
    { label: 'Tax Templates', value: stats.withTemplate, icon: <Shield size={13} />, color: 'var(--app-warning, #f59e0b)' },
  ]

  return (
    <div className={`flex flex-col h-full animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-3rem)]' : 'max-h-[calc(100vh-6rem)]'}`}>

      {/* ── Header ── */}
      {!focusMode ? (
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="page-header-icon bg-app-primary" style={{ width: 36, height: 36, boxShadow: '0 3px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
              <Globe size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black text-app-foreground tracking-tight leading-tight">
                Countries & Regions
              </h1>
              <p className="text-[9px] md:text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                {stats.total} Countries · {stats.regions} Regions · SaaS Global Registry
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFocusMode(true)}
              className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-1.5 py-1 rounded-lg hover:bg-app-surface transition-all">
              <Maximize2 size={12} />
            </button>
            <button onClick={() => setEditingCountry('new' as any)}
              className="flex items-center gap-1 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-2.5 py-1 rounded-lg transition-all"
              style={{ boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
              <Plus size={13} />
              <span className="hidden sm:inline">New Country</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-6 h-6 rounded-md bg-app-primary flex items-center justify-center">
              <Globe size={12} className="text-white" />
            </div>
            <span className="text-[11px] font-black text-app-foreground hidden sm:inline">Countries</span>
            <span className="text-[9px] font-bold text-app-muted-foreground">{filtered.length}/{stats.total}</span>
          </div>
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search... (Ctrl+K)"
              className="w-full pl-8 pr-2.5 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
          </div>
          <button onClick={() => setFocusMode(false)}
            className="p-1 rounded-md border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
            <Minimize2 size={12} />
          </button>
        </div>
      )}

      {/* ── KPI Strip ── */}
      {!focusMode && (
        <div className="flex-shrink-0 mb-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}>
          {kpis.map(s => (
            <div key={s.label}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all text-left"
              style={{
                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
              }}>
              <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                <div className="text-[13px] font-black text-app-foreground tabular-nums leading-tight">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      {!focusMode && (
        <div className="flex-shrink-0 mb-2 flex items-center gap-2 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, code, phone, currency... (Ctrl+K)"
              className="w-full pl-8 pr-2.5 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
          </div>
          <div className="relative flex items-center">
            <Filter size={11} className="absolute left-2 text-app-muted-foreground pointer-events-none" />
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
              className="pl-6 pr-6 py-1.5 text-[11px] font-bold bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground appearance-none cursor-pointer focus:ring-2 focus:ring-app-primary/10 outline-none transition-all">
              <option value="">All Regions</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-2 text-app-muted-foreground pointer-events-none" />
          </div>
          {(search || regionFilter) && (
            <button onClick={() => { setSearch(''); setRegionFilter('') }}
              className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all"
              style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
              <X size={10} /> Clear
            </button>
          )}
          {/* View toggle — list vs card grid. Persists per user. */}
          <div className="flex items-center rounded-lg overflow-hidden ml-auto"
            style={{ border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              className="flex items-center justify-center px-2 py-1.5 transition-colors"
              style={{
                background: viewMode === 'list' ? 'var(--app-primary)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--app-muted-foreground)',
              }}>
              <Rows3 size={12} />
            </button>
            <button
              onClick={() => setViewMode('cards')}
              title="Card view"
              className="flex items-center justify-center px-2 py-1.5 transition-colors"
              style={{
                background: viewMode === 'cards' ? 'var(--app-primary)' : 'transparent',
                color: viewMode === 'cards' ? '#fff' : 'var(--app-muted-foreground)',
                borderLeft: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
              }}>
              <LayoutGrid size={12} />
            </button>
          </div>
          <span className="text-[10px] font-bold text-app-muted-foreground">
            {filtered.length} of {stats.total}
          </span>
        </div>
      )}

      {/* ── Body: list or card grid ── */}
      <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
        {/* Column Headers — only in list view */}
        {viewMode === 'list' && (
          <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
            <div className="w-8 flex-shrink-0" />
            <div className="flex-1 min-w-0">Country</div>
            <div className="hidden sm:block w-20 flex-shrink-0">Codes</div>
            <div className="hidden md:block w-16 flex-shrink-0">Phone</div>
            <div className="hidden sm:block w-16 flex-shrink-0">Currency</div>
            <div className="hidden lg:block w-24 flex-shrink-0">Region</div>
            <div className="w-16 flex-shrink-0" />
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-app-primary" />
            </div>
          ) : filtered.length > 0 ? (
            viewMode === 'list' ? (
              filtered.map(item => (
                <CountryRow
                  key={item.id}
                  item={item}
                  hasTaxTemplate={taxTemplateCountries.has(item.iso2)}
                  onEdit={() => setEditingCountry(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))
            ) : (
              <div
                className="p-3"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '10px',
                }}>
                {filtered.map(item => (
                  <CountryCard
                    key={item.id}
                    item={item}
                    hasTaxTemplate={taxTemplateCountries.has(item.iso2)}
                    onEdit={() => setEditingCountry(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Globe size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No countries found</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">
                {search || regionFilter ? 'Try adjusting your filters.' : 'Click "New Country" to add one.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editingCountry !== null && (
        <CountryEditModal
          country={editingCountry === 'new' ? null : editingCountry as Country}
          currencies={currencies}
          onClose={() => setEditingCountry(null)}
          onSaved={fetchAll}
        />
      )}
    </div>
  )
}
