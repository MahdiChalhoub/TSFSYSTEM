'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Coins, Loader2, Plus, Pencil, Trash2, X, DollarSign, Save, Check, Hash,
  Power, PowerOff, Globe, Building2, Pin, Unlink,
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAdmin } from '@/context/AdminContext'

/* ═══════════════════════════════════════════════════════
   Types — full Currency model from `reference/currencies/`
   ═══════════════════════════════════════════════════════ */

type Currency = {
  id: number
  code: string
  numeric_code: string
  name: string
  symbol: string
  minor_unit: number
  is_active: boolean
}

type RelatedCountry = {
  id: number
  iso2: string
  iso3: string
  name: string
  default_currency: number | null
  default_currency_code: string | null
  region: string
}

type TenantUsage = {
  org_id: number
  org_name: string
  is_default?: boolean
}

/** Discriminated union for the combined tree (currencies + linked rows). */
type TreeNode = {
  id: number | string
  parent?: number | null
  kind: 'currency' | 'country' | 'tenant'
  name: string
  subtitle?: string
  data?: any
  searchBlob?: string
}

/* ═══════════════════════════════════════════════════════
   Theme tokens — same shape as the countries page
   ═══════════════════════════════════════════════════════ */

const fieldClass = "w-full px-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all"
const labelClass = "text-[10px] font-black uppercase tracking-wider text-app-muted-foreground mb-1 block"

/* ═══════════════════════════════════════════════════════
   Currency Edit Modal — opens for create + edit
   ═══════════════════════════════════════════════════════ */

function CurrencyEditModal({ currency, allCountries = [], initialLinkedCountryIds = [], onClose, onSaved }: {
  currency: Currency | null
  /** Available countries to choose from — pass to enable the country-link picker. */
  allCountries?: RelatedCountry[]
  /** Pre-selected on open: countries whose default_currency is already this one. */
  initialLinkedCountryIds?: number[]
  onClose: () => void
  onSaved: () => void
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
  // Linked-countries multi-select. Saved on submit by PATCHing each
  // delta-country to set/unset its default_currency FK.
  const [linkedCountryIds, setLinkedCountryIds] = useState<Set<number>>(new Set(initialLinkedCountryIds))
  const [countrySearch, setCountrySearch] = useState('')

  const toggleCountry = (id: number) => setLinkedCountryIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return allCountries
    const q = countrySearch.trim().toLowerCase()
    return allCountries.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.iso2.toLowerCase().includes(q) ||
      c.iso3.toLowerCase().includes(q)
    )
  }, [allCountries, countrySearch])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, code: form.code.toUpperCase() }
      let savedId = currency?.id
      if (isNew) {
        const created = await erpFetch('reference/currencies/', { method: 'POST', body: JSON.stringify(payload) })
        savedId = created?.id
        toast.success(`Currency ${payload.code} created`)
      } else {
        await erpFetch(`reference/currencies/${currency!.id}/`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success(`Currency ${payload.code} updated`)
      }
      // Apply country-link deltas. Add new links by setting default_currency
      // on the country; remove unlinked countries by setting default_currency
      // back to null. Runs in parallel; failures get aggregated.
      if (savedId) {
        const initialSet = new Set(initialLinkedCountryIds)
        const toLink = Array.from(linkedCountryIds).filter(id => !initialSet.has(id))
        const toUnlink = initialLinkedCountryIds.filter(id => !linkedCountryIds.has(id))
        const ops: Promise<any>[] = []
        for (const cid of toLink) ops.push(
          erpFetch(`reference/countries/${cid}/`, { method: 'PATCH', body: JSON.stringify({ default_currency: savedId }) })
        )
        for (const cid of toUnlink) ops.push(
          erpFetch(`reference/countries/${cid}/`, { method: 'PATCH', body: JSON.stringify({ default_currency: null }) })
        )
        if (ops.length > 0) {
          const results = await Promise.allSettled(ops)
          const failed = results.filter(r => r.status === 'rejected').length
          if (failed > 0) toast.error(`${failed} country link${failed === 1 ? '' : 's'} failed to update`)
          else toast.success(`Linked ${toLink.length}, unlinked ${toUnlink.length} country/ies`)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
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
              <label className={labelClass} title="ISO 4217 numeric code — the 3-digit identifier assigned to this currency. Used by banking files (SWIFT, ISO 20022) and some payment processors. Optional.">
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

          {/* Linked countries — multi-select. Hidden when no country list
              was passed (e.g., when this modal is invoked inline from
              /countries' country form). Saving updates each country's
              default_currency FK so the linkage shows up on /countries. */}
          {allCountries.length > 0 && <div>
            <div className="flex items-center justify-between mb-1">
              <label className={labelClass + ' mb-0'}>Linked Countries</label>
              <span className="text-[10px] font-bold text-app-muted-foreground">
                {linkedCountryIds.size} selected
              </span>
            </div>
            <input
              type="text"
              value={countrySearch}
              onChange={e => setCountrySearch(e.target.value)}
              placeholder="Search countries..."
              className={fieldClass + ' mb-1.5'}
            />
            <div className="max-h-44 overflow-y-auto rounded-lg space-y-px"
              style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
              {filteredCountries.length === 0 ? (
                <div className="px-3 py-3 text-tp-xs text-app-muted-foreground italic">
                  No countries match.
                </div>
              ) : filteredCountries.map(c => {
                const checked = linkedCountryIds.has(c.id)
                return (
                  <label key={c.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer transition-colors hover:bg-app-surface"
                    style={{ background: checked ? 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)' : 'transparent' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCountry(c.id)}
                      className="w-3.5 h-3.5 rounded border-app-border accent-[var(--app-info,#3b82f6)] flex-shrink-0" />
                    <span className="text-tp-sm">{getFlagEmoji(c.iso2)}</span>
                    <span className="font-mono text-[10px] font-bold text-app-muted-foreground">{c.iso2}</span>
                    <span className="text-[12px] font-semibold text-app-foreground truncate flex-1">{c.name}</span>
                    {c.default_currency_code && (
                      <span className="font-mono text-[10px] font-bold text-app-muted-foreground">
                        currently {c.default_currency_code}
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
          </div>}

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
   Linked Entity Tree — mirrors countries page. Each currency
   can expand to show "Countries Using" + "Tenants Using"
   groups, each independently collapsible.
   ═══════════════════════════════════════════════════════ */

const LINKED_KIND_META: Record<Exclude<TreeNode['kind'], 'currency'>, { color: string; href: string; icon: React.ReactNode; label: string; group: string }> = {
  country: { color: 'var(--app-info, #3b82f6)', href: '/countries',     icon: <Globe size={11} />,     label: 'Country', group: 'Countries Using' },
  tenant:  { color: 'var(--app-primary)',       href: '/organizations', icon: <Building2 size={11} />, label: 'Tenant',  group: 'Tenants Using' },
}

const KIND_ORDER: Array<Exclude<TreeNode['kind'], 'currency'>> = ['country', 'tenant']

function getFlagEmoji(code: string): string {
  if (!code || code.length < 2) return '🌍'
  const cc = code.toUpperCase().slice(0, 2)
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

/**
 * Level-3 leaf — quieter than its parent row so the depth reads naturally:
 * smaller icon, lighter saturation, muted name color, smaller text size.
 */
function LinkedLeaf({ node, isLast }: { node: TreeNode; isLast: boolean }) {
  const meta = LINKED_KIND_META[node.kind as Exclude<TreeNode['kind'], 'currency'>]
  const flag = node.kind === 'country' && node.data?.iso2 ? getFlagEmoji(node.data.iso2) : null
  // In-app tab navigation — opens (or focuses) a tab in the navigator
  // instead of doing a full reload.
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
          {flag ? <span className="text-tp-sm leading-none">{flag}</span> : meta.icon}
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
 * Three-level tree: currency → group (Countries Using / Tenants Using) →
 * leaf. Group rows share the parent row template so all three levels use
 * the same typography; only indent + tree connector marks the level.
 * Each group is collapsible.
 */
function LinkedTree({ children: nodes }: { children: TreeNode[] }) {
  const buckets: Record<string, TreeNode[]> = {}
  for (const n of nodes) {
    if (n.kind === 'currency') continue
    const k = n.kind
    if (!buckets[k]) buckets[k] = []
    buckets[k].push(n)
  }
  // Always show every kind — empty groups still render with a "(none)"
  // expand-state, so the user sees the full hierarchy.
  const visibleKinds = KIND_ORDER
  const [openKinds, setOpenKinds] = useState<Record<string, boolean>>({})
  const toggleKind = (k: string) => setOpenKinds(prev => ({ ...prev, [k]: !prev[k] }))

  return (
    <div className="relative ml-9 mr-2 mb-2 mt-1">
      <div className="absolute pointer-events-none"
        style={{ left: '11px', top: 0, bottom: '24px', width: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
      {visibleKinds.map((kind, gIdx) => {
        const meta = LINKED_KIND_META[kind]
        const items = buckets[kind] || []
        const isOpen = !!openKinds[kind]
        const isLastGroup = gIdx === visibleKinds.length - 1
        return (
          <div key={kind} className="relative" style={{ paddingLeft: '24px' }}>
            <div className="absolute pointer-events-none"
              style={{ left: '11px', top: '24px', width: '14px', height: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
            {/* Level-2 group header — colored band so it sits visually
                between the parent currency row (L1) and the leaves (L3). */}
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

            {!isLastGroup && (
              <div className="absolute pointer-events-none"
                style={{ left: '11px', top: '24px', bottom: 0, width: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
            )}

            {isOpen && (
              <div className="relative" style={{ paddingLeft: '12px' }}>
                {items.length === 0 ? (
                  <div className="ml-6 px-3 py-1.5 text-tp-xs text-app-muted-foreground italic">
                    None linked yet.
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
   Currency Row — flat (no hierarchy), TreeMasterPage-shaped
   ═══════════════════════════════════════════════════════ */

function CurrencyRow({ item, isSelected, onSelect, onEdit, onDelete, compact, selectable, isCheckedFn, onToggleCheck, children, forceExpanded }: {
  item: Currency
  isSelected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  compact?: boolean
  selectable?: boolean
  isCheckedFn?: (id: number) => boolean
  onToggleCheck?: (id: number) => void
  children?: TreeNode[]
  forceExpanded?: boolean
}) {
  const checked = isCheckedFn ? isCheckedFn(item.id) : false
  const hasChildren = (children?.length ?? 0) > 0
  const [openLocal, setOpenLocal] = useState(false)
  const isOpen = forceExpanded ?? openLocal
  return (
    <div className="rounded-lg"
      style={{
        background: isSelected ? 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)' : 'transparent',
        border: isSelected ? '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)' : '1px solid transparent',
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
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M4 2 L8 6 L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
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
          className="w-3.5 h-3.5 rounded border-app-border accent-[var(--app-info,#3b82f6)] flex-shrink-0"
        />
      )}

      {/* Symbol badge */}
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[14px] font-black flex-shrink-0"
        style={{
          background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
          color: 'var(--app-info, #3b82f6)',
        }}>
        {item.symbol || item.code.slice(0, 2)}
      </div>

      {/* Code + Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-black text-app-foreground tracking-tight">{item.code}</span>
          <span className="text-[12px] font-bold text-app-muted-foreground truncate">{item.name}</span>
          {!item.is_active && (
            <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded flex-shrink-0"
              style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
              Inactive
            </span>
          )}
        </div>
        {!compact && (
          <p className="text-[10px] text-app-muted-foreground truncate">
            {item.numeric_code ? `Numeric ${item.numeric_code} · ` : ''}
            {item.minor_unit} decimal {item.minor_unit === 1 ? 'place' : 'places'}
          </p>
        )}
      </div>

      {!compact && (
        <>
          {/* Numeric */}
          <div className="hidden sm:flex items-center gap-1 w-16 flex-shrink-0">
            <Hash size={10} className="text-app-muted-foreground" />
            <span className="font-mono text-[11px] font-bold text-app-muted-foreground">{item.numeric_code || '—'}</span>
          </div>

          {/* Minor unit */}
          <div className="hidden md:flex items-center gap-1 w-16 flex-shrink-0">
            <span className="text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">DP</span>
            <span className="font-mono text-[11px] font-bold text-app-foreground">{item.minor_unit}</span>
          </div>

          {/* Symbol */}
          <div className="hidden sm:flex items-center justify-center w-12 flex-shrink-0">
            <span className="text-[14px] font-bold text-app-foreground">{item.symbol || '—'}</span>
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

    {/* Linked entities — countries using this currency, tenants enabled. */}
    {hasChildren && isOpen && (
      <LinkedTree>{children!}</LinkedTree>
    )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Detail Panel
   ═══════════════════════════════════════════════════════ */

type CurrencyPanelTab = 'overview' | 'countries' | 'tenants'

function getFlagEmojiForLeaf(code: string): string {
  if (!code || code.length < 2) return '🌍'
  const cc = code.toUpperCase().slice(0, 2)
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

function CurrencyDetailPanel({ currency, allCountries, countriesUsing, tenantsUsing, onEdit, onDelete, onClose, onPin, onUnlinkCountry, onLinkCountry }: {
  currency: Currency
  /** Full country list — used by the "Link a country" picker. */
  allCountries: RelatedCountry[]
  countriesUsing: RelatedCountry[]
  tenantsUsing: TenantUsage[]
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
  onPin?: () => void
  onUnlinkCountry?: (ct: RelatedCountry) => void
  onLinkCountry?: (ct: RelatedCountry) => void
}) {
  const [tab, setTab] = useState<CurrencyPanelTab>('overview')

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

  const tabs: { key: CurrencyPanelTab; label: string; icon: React.ReactNode; count?: number; color?: string }[] = [
    { key: 'overview',  label: 'Overview',  icon: <DollarSign size={13} /> },
    { key: 'countries', label: 'Countries', icon: <Globe size={13} />,    count: countriesUsing.length, color: 'var(--app-info, #3b82f6)' },
    { key: 'tenants',   label: 'Tenants',   icon: <Building2 size={13} />, count: tenantsUsing.length,   color: 'var(--app-primary)' },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
        style={{
          background: 'linear-gradient(180deg, color-mix(in srgb, var(--app-info, #3b82f6) 5%, var(--app-surface)), var(--app-surface))',
          borderBottom: '1px solid var(--app-border)',
        }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-black flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, var(--app-info, #3b82f6), color-mix(in srgb, var(--app-info, #3b82f6) 75%, var(--app-accent)))',
            color: 'white',
            boxShadow: '0 3px 10px color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)',
          }}>
          {currency.symbol || currency.code.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-tp-lg font-bold tracking-tight truncate leading-tight font-mono" style={{ color: 'var(--app-foreground)' }}>
            {currency.code}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-tp-xxs font-medium italic truncate" style={{ color: 'var(--app-muted-foreground)' }}>
              {currency.name}
            </span>
            {!currency.is_active && (
              <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
                Inactive
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
            style={{ color: 'var(--app-muted-foreground)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-info, #3b82f6)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent' }}
            title="Edit">
            <Pencil size={13} />
          </button>
          {onPin && (
            <button onClick={onPin}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
              style={{ color: 'var(--app-muted-foreground)' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-info, #3b82f6)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)' }}
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
      <div className="flex-shrink-0 flex items-center px-1 py-1" style={{ borderBottom: '1px solid var(--app-border)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-tp-sm font-semibold transition-colors"
            style={tab === t.key ? {
              background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)',
              color: 'var(--app-info, #3b82f6)',
            } : { color: 'var(--app-muted-foreground)' }}>
            {t.icon} {t.label}
            {t.count != null && t.count > 0 && (
              <span className="ml-0.5 text-tp-xxs font-bold px-1 py-[1px] rounded-full min-w-[16px] text-center"
                style={{
                  background: tab === t.key
                    ? `color-mix(in srgb, ${t.color || 'var(--app-info, #3b82f6)'} 15%, transparent)`
                    : 'color-mix(in srgb, var(--app-border) 40%, transparent)',
                  color: tab === t.key ? (t.color || 'var(--app-info, #3b82f6)') : 'var(--app-muted-foreground)',
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
            <Stat label="ISO 4217 Code" value={currency.code} icon={<DollarSign size={12} />} color="var(--app-info, #3b82f6)" />
            <Stat label="Numeric Code" value={currency.numeric_code || '—'} icon={<Hash size={12} />} color="var(--app-muted-foreground)" />
            <Stat label="Symbol" value={currency.symbol || '—'} icon={<DollarSign size={12} />} color="var(--app-muted-foreground)" />
            <Stat label="Minor Unit" value={`${currency.minor_unit} decimal ${currency.minor_unit === 1 ? 'place' : 'places'}`} icon={<Hash size={12} />} color="var(--app-muted-foreground)" />
            <Stat label="Status" value={currency.is_active ? 'Active' : 'Inactive'} icon={<Check size={12} />} color={currency.is_active ? 'var(--app-success, #22c55e)' : 'var(--app-error)'} />
          </>
        )}
        {tab === 'countries' && (
          <>
            {countriesUsing.length === 0 ? (
              <EmptyTab icon={<Globe size={24} />} title="No countries linked" subtitle="Pick one below to link, or edit a country and set its default currency." />
            ) : (
              countriesUsing.map(c => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-tp-md"
                    style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)' }}>
                    {getFlagEmojiForLeaf(c.iso2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground">
                      {c.region || c.iso2}
                    </div>
                    <div className="text-tp-sm font-bold text-app-foreground truncate">{c.name}</div>
                  </div>
                  {onUnlinkCountry && (
                    <button onClick={() => onUnlinkCountry(c)}
                      title={`Unlink ${c.name}`}
                      className="p-1.5 rounded-lg transition-all flex-shrink-0"
                      style={{ color: 'var(--app-warning, #f59e0b)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                      <Unlink size={12} />
                    </button>
                  )}
                </div>
              ))
            )}
            {/* Link picker — shows countries NOT currently using this
                currency. Picking one fires the link confirm dialog. */}
            {onLinkCountry && (() => {
              const linkedIds = new Set(countriesUsing.map(c => c.id))
              const available = allCountries.filter(c => !linkedIds.has(c.id))
              if (available.length === 0) return null
              return (
                <div className="pt-2 mt-2" style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                  <label className="text-tp-xxs font-bold uppercase tracking-wider text-app-muted-foreground mb-1 block">
                    Link another country
                  </label>
                  <select className={fieldClass}
                    value=""
                    onChange={e => {
                      const id = Number(e.target.value)
                      const ct = allCountries.find(c => c.id === id)
                      if (ct) onLinkCountry(ct)
                      e.target.value = ''
                    }}>
                    <option value="">Pick a country to link...</option>
                    {available.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.iso2}){c.default_currency_code ? ` — currently ${c.default_currency_code}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })()}
          </>
        )}
        {tab === 'tenants' && (
          tenantsUsing.length === 0 ? (
            <EmptyTab icon={<Building2 size={24} />} title="No tenants using this currency" subtitle="Tenants enable currencies from their own admin (Regional Settings)." />
          ) : (
            tenantsUsing.map(t => (
              <Stat key={t.org_id}
                label={t.is_default ? 'Default for tenant' : `Org #${t.org_id}`}
                value={t.org_name}
                icon={<Building2 size={12} />}
                color="var(--app-primary)" />
            ))
          )
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-tp-xs font-bold text-white rounded-lg transition-all hover:brightness-110"
          style={{ background: 'var(--app-info, #3b82f6)' }}>
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
   Bulk Action Bar — appears when N>0 currencies are selected.
   Mirrors the categories pattern: floating pill with the
   high-value ops for this entity (activate / deactivate / delete).
   ═══════════════════════════════════════════════════════ */

function BulkActionBar({ count, onActivate, onDeactivate, onDelete, onClear }: {
  count: number
  onActivate: () => void
  onDeactivate: () => void
  onDelete: () => void
  onClear: () => void
}) {
  if (count === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1.5 px-2 py-1.5 rounded-2xl animate-in slide-in-from-bottom-4 duration-200"
      style={{
        background: 'var(--app-surface)',
        border: '1px solid var(--app-border)',
        boxShadow: '0 12px 36px rgba(0,0,0,0.22)',
      }}>
      <div className="px-3 py-1.5 rounded-xl text-tp-sm font-bold"
        style={{
          background: 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)',
          color: 'var(--app-info, #3b82f6)',
        }}>
        {count} selected
      </div>
      <button onClick={onActivate}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
        style={{ background: 'var(--app-background)', color: 'var(--app-success, #22c55e)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)' }}>
        <Power size={13} /> Activate
      </button>
      <button onClick={onDeactivate}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
        style={{ background: 'var(--app-background)', color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
        <PowerOff size={13} /> Deactivate
      </button>
      <button onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-tp-sm font-bold transition-all hover:-translate-y-0.5"
        style={{
          background: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)',
          color: 'var(--app-error, #ef4444)',
          border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 25%, transparent)',
        }}>
        <Trash2 size={13} /> Delete
      </button>
      <button onClick={onClear}
        title="Clear selection"
        className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
        style={{ color: 'var(--app-muted-foreground)' }}>
        <X size={14} />
      </button>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════ */

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [relatedCountries, setRelatedCountries] = useState<RelatedCountry[]>([])
  const [tenantsByCurrency, setTenantsByCurrency] = useState<Record<number, TenantUsage[]>>({})
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Currency | null | 'new'>(null)
  /** Themed delete-confirm state — matches categories / countries pattern. */
  const [deleteTarget, setDeleteTarget] = useState<Currency | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  /** Same shape as the countries page — generic link/unlink prompt. */
  type LinkAction = {
    title: string
    description: string
    confirmText: string
    variant: 'danger' | 'warning' | 'info'
    run: () => Promise<void>
  }
  const [linkAction, setLinkAction] = useState<LinkAction | null>(null)

  /** Link a country to this currency. If the country already has a different
   *  default currency, warn before overwriting. */
  const promptLinkCountry = (currency: Currency, ct: RelatedCountry) => {
    const previous = ct.default_currency_code
    setLinkAction({
      title: previous && previous !== currency.code
        ? `Change ${ct.name}'s currency from ${previous} to ${currency.code}?`
        : `Link ${ct.name} to ${currency.code}?`,
      description: previous && previous !== currency.code
        ? `${ct.name} currently uses ${previous} as its default currency. After this change, new transactions in ${ct.name} will default to ${currency.code} (${currency.name}). Existing records keep their currency.`
        : `${ct.name} will use ${currency.code} (${currency.name}) as its default currency for new transactions.`,
      confirmText: previous && previous !== currency.code ? 'Change currency' : 'Link country',
      variant: previous && previous !== currency.code ? 'warning' : 'info',
      run: async () => {
        await erpFetch(`reference/countries/${ct.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ default_currency: currency.id }),
        })
        toast.success(`${ct.name} ${previous && previous !== currency.code ? 'switched to' : 'linked to'} ${currency.code}`)
        await fetchAll()
      },
    })
  }

  /** Unlink a country from this currency (set country.default_currency = null). */
  const promptUnlinkCountry = (currency: Currency, ct: RelatedCountry) => {
    setLinkAction({
      title: `Unlink ${ct.name} from ${currency.code}?`,
      description: `${ct.name} will no longer use ${currency.code} as its default currency. Tenants in ${ct.name} will need to pick another currency for new transactions.`,
      confirmText: 'Unlink country',
      variant: 'warning',
      run: async () => {
        await erpFetch(`reference/countries/${ct.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ default_currency: null }),
        })
        toast.success(`${ct.name} unlinked from ${currency.code}`)
        await fetchAll()
      },
    })
  }
  // Bulk-action selection ref kept in sync from the render-prop. Lets the
  // BulkActionBar handlers read the current selection without prop drilling.
  const selectionRef = React.useRef<{ selectedIds: Set<number>; clearSelection: () => void }>({
    selectedIds: new Set(),
    clearSelection: () => {},
  })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [currenciesData, countriesData, tenantsData] = await Promise.all([
        erpFetch('reference/currencies/?limit=300'),
        // Pull countries to render the "Countries Using" branch under each
        // currency. Same source we use on /countries.
        erpFetch('reference/countries/?limit=300').catch(() => []),
        // SU-only tenants endpoint. {} on older backends.
        erpFetch('reference/currencies/tenants/').catch(() => ({})),
      ])
      const list = Array.isArray(currenciesData) ? currenciesData : currenciesData?.results || []
      const cList = Array.isArray(countriesData) ? countriesData : countriesData?.results || []
      setCurrencies(list)
      setRelatedCountries(cList)
      setTenantsByCurrency(typeof tenantsData === 'object' && tenantsData !== null && !Array.isArray(tenantsData) ? tenantsData : {})
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load currencies')
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ConfirmDialog flow — replaces the native browser confirm.
  const requestDelete = (c: Currency) => setDeleteTarget(c)
  const handleConfirmedDelete = async () => {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await erpFetch(`reference/currencies/${target.id}/`, { method: 'DELETE' })
      toast.success(`${target.code} deleted`)
      fetchAll()
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete'
      if (/enabled by/i.test(msg)) {
        toast.error('Currency is enabled by one or more tenants. Disable it from those tenants first.', { duration: 7000 })
      } else {
        toast.error(msg)
      }
    }
  }

  /**
   * Bulk operations — iterate the selected ids in parallel. We don't have
   * a backend bulk endpoint for currencies, but ~200 records is small
   * enough that fan-out PATCH/DELETE is fine. Errors are aggregated so the
   * user sees a single summary toast at the end.
   */
  const handleBulkPatch = async (patch: Partial<Currency>, label: string) => {
    const ids = Array.from(selectionRef.current.selectedIds)
    if (ids.length === 0) return
    const t = toast.loading(`${label} ${ids.length} ${ids.length === 1 ? 'currency' : 'currencies'}...`)
    const results = await Promise.allSettled(ids.map(id =>
      erpFetch(`reference/currencies/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
    ))
    toast.dismiss(t)
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed === 0) toast.success(`${ids.length} ${label.toLowerCase()}`)
    else toast.error(`${failed} of ${ids.length} failed`)
    selectionRef.current.clearSelection()
    fetchAll()
  }
  const handleBulkActivate = () => handleBulkPatch({ is_active: true } as any, 'Activated')
  const handleBulkDeactivate = () => handleBulkPatch({ is_active: false } as any, 'Deactivated')
  // Bulk delete — opens the ConfirmDialog. Actual fan-out runs on confirm.
  const handleBulkDelete = () => {
    if (selectionRef.current.selectedIds.size === 0) return
    setBulkDeleteOpen(true)
  }
  const handleConfirmedBulkDelete = async () => {
    const ids = Array.from(selectionRef.current.selectedIds)
    setBulkDeleteOpen(false)
    if (ids.length === 0) return
    const t = toast.loading(`Deleting ${ids.length} ${ids.length === 1 ? 'currency' : 'currencies'}...`)
    const results = await Promise.allSettled(ids.map(id =>
      erpFetch(`reference/currencies/${id}/`, { method: 'DELETE' })
    ))
    toast.dismiss(t)
    const failed = results.filter(r => r.status === 'rejected').length
    if (failed === 0) toast.success(`${ids.length} deleted`)
    else toast.error(`${failed} of ${ids.length} failed (likely in use by countries)`)
    selectionRef.current.clearSelection()
    fetchAll()
  }

  const stats = useMemo(() => {
    const active = currencies.filter(c => c.is_active).length
    const inactive = currencies.length - active
    const withSymbol = currencies.filter(c => c.symbol).length
    return { total: currencies.length, active, inactive, withSymbol }
  }, [currencies])

  /**
   * Combined tree dataset. Each currency is a root; its children include
   * (1) every country whose default currency is this one, and (2) every
   * tenant that has enabled this currency. Mirrors the country page flow.
   */
  const treeData = useMemo<TreeNode[]>(() => {
    if (currencies.length === 0) return []
    const out: TreeNode[] = []
    // Group countries by currency id (and fall back to currency code) so
    // legacy rows where the FK is null but the code is set still attach.
    const countriesByCurrencyId = new Map<number, RelatedCountry[]>()
    const countriesByCurrencyCode = new Map<string, RelatedCountry[]>()
    for (const ct of relatedCountries) {
      if (ct.default_currency != null) {
        const arr = countriesByCurrencyId.get(ct.default_currency) || []
        arr.push(ct)
        countriesByCurrencyId.set(ct.default_currency, arr)
      } else if (ct.default_currency_code) {
        const arr = countriesByCurrencyCode.get(ct.default_currency_code) || []
        arr.push(ct)
        countriesByCurrencyCode.set(ct.default_currency_code, arr)
      }
    }

    for (const c of currencies) {
      const blob = [c.code, c.numeric_code, c.name, c.symbol].filter(Boolean).join(' ').toLowerCase()
      out.push({
        id: c.id,
        kind: 'currency',
        name: c.name,
        subtitle: c.symbol ? `${c.code} ${c.symbol}` : c.code,
        data: c,
        searchBlob: blob,
      })

      // 1) Countries using this currency
      const matchedById = countriesByCurrencyId.get(c.id) || []
      const matchedByCode = countriesByCurrencyCode.get(c.code) || []
      const seen = new Set<number>()
      for (const ct of [...matchedById, ...matchedByCode]) {
        if (seen.has(ct.id)) continue
        seen.add(ct.id)
        out.push({
          id: `cur${c.id}-ct-${ct.id}`,
          parent: c.id,
          kind: 'country',
          name: ct.name,
          subtitle: ct.region ? `${ct.iso2} · ${ct.region}` : ct.iso2,
          data: ct,
          searchBlob: `${blob} ${ct.name} ${ct.iso2} ${ct.iso3} ${ct.region}`.toLowerCase(),
        })
      }

      // 2) Tenants that have enabled this currency
      const tenants = tenantsByCurrency[c.id] || []
      for (const t of tenants) {
        out.push({
          id: `cur${c.id}-org-${t.org_id}`,
          parent: c.id,
          kind: 'tenant',
          name: t.org_name,
          subtitle: t.is_default ? 'Default for this tenant' : `Org #${t.org_id}`,
          data: t,
          searchBlob: `${blob} ${t.org_name}`.toLowerCase(),
        })
      }
    }
    return out
  }, [currencies, relatedCountries, tenantsByCurrency])

  if (loading && currencies.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: 'var(--app-info, #3b82f6)' }} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <TreeMasterPage
        config={{
          title: 'Currencies',
          subtitle: (_filtered, all) => `${all.length} Currencies · ${stats.active} Active · ISO 4217 Registry`,
          icon: <Coins size={20} />,
          iconColor: 'var(--app-info, #3b82f6)',
          searchPlaceholder: 'Search by code, name, symbol... (Ctrl+K)',
          primaryAction: {
            label: 'New Currency',
            icon: <Plus size={14} />,
            onClick: () => setEditing('new' as any),
          },
          // No nav-link secondary actions — those links lived in the toolbar
          // before but cluttered it. Audit and Split Panel are enough.
          dataTools: {
            title: 'Currency Data',
            exportFilename: 'currencies',
            exportColumns: [
              { key: 'code', label: 'Code' },
              { key: 'numeric_code', label: 'Numeric' },
              { key: 'name', label: 'Name' },
              { key: 'symbol', label: 'Symbol' },
              { key: 'minor_unit', label: 'Minor Unit' },
              { key: 'is_active', label: 'Active', format: (c: any) => c.is_active ? 'Yes' : 'No' },
            ],
            print: {
              title: 'Currencies',
              subtitle: 'ISO 4217 Registry',
              prefKey: 'print.saas-currencies',
              sortBy: 'code',
              columns: [
                { key: 'code', label: 'Code', mono: true, defaultOn: true, width: '70px' },
                { key: 'numeric', label: 'Numeric', mono: true, defaultOn: true, width: '70px' },
                { key: 'name', label: 'Name', defaultOn: true },
                { key: 'symbol', label: 'Symbol', defaultOn: true, width: '60px' },
                { key: 'minor_unit', label: 'Decimals', align: 'right', defaultOn: true, width: '70px' },
                { key: 'active', label: 'Status', defaultOn: false, width: '70px' },
              ],
              rowMapper: (c: any) => ({
                code: c.code,
                numeric: c.numeric_code || '',
                name: c.name,
                symbol: c.symbol || '',
                minor_unit: c.minor_unit ?? 2,
                active: c.is_active ? 'Active' : 'Inactive',
              }),
            },
            import: {
              entity: 'currency',
              entityPlural: 'currencies',
              endpoint: 'reference/currencies/',
              columns: [
                { name: 'code', required: true, desc: 'ISO 4217 alpha', example: 'USD' },
                { name: 'numeric_code', required: false, desc: 'ISO numeric', example: '840' },
                { name: 'name', required: true, desc: 'Currency name', example: 'US Dollar' },
                { name: 'symbol', required: false, desc: 'Display symbol', example: '$' },
                { name: 'minor_unit', required: false, desc: 'Decimal places (default 2)', example: '2' },
                { name: 'is_active', required: false, desc: 'true/false (default true)', example: 'true' },
              ],
              sampleCsv:
                'code,numeric_code,name,symbol,minor_unit,is_active\n' +
                'USD,840,US Dollar,$,2,true\n' +
                'EUR,978,Euro,€,2,true\n' +
                'JPY,392,Japanese Yen,¥,0,true\n',
              previewColumns: [
                { key: 'code', label: 'Code' },
                { key: 'name', label: 'Name' },
                { key: 'symbol', label: 'Symbol' },
                { key: 'minor_unit', label: 'Decimals' },
              ],
              buildPayload: (row) => ({
                code: (row.code || '').toUpperCase(),
                numeric_code: row.numeric_code || '',
                name: row.name || '',
                symbol: row.symbol || '',
                minor_unit: row.minor_unit ? Number(row.minor_unit) : 2,
                is_active: row.is_active ? row.is_active.toString().toLowerCase() !== 'false' : true,
              }),
            },
          },
          columnHeaders: [
            { label: 'Currency', width: 'auto' },
            { label: 'Numeric', width: '64px', hideOnMobile: true },
            { label: 'DP', width: '64px', hideOnMobile: true },
            { label: 'Symbol', width: '48px', hideOnMobile: true },
          ],
          // Single source of truth — combined tree (currencies + linked
          // country/tenant rows). KPI predicates filter on `kind === 'currency'`
          // so counts measure currencies only, not linked-row noise.
          data: treeData as unknown as Record<string, unknown>[],
          searchFields: ['searchBlob'],
          kpiPredicates: {
            active: (n: any) => n.kind === 'currency' && Boolean(n.data?.is_active),
            inactive: (n: any) => n.kind === 'currency' && !n.data?.is_active,
            withSymbol: (n: any) => n.kind === 'currency' && Boolean(n.data?.symbol),
            inUse: (n: any) => n.kind === 'currency' && (
              relatedCountries.some(ct => ct.default_currency === Number(n.data?.id) || ct.default_currency_code === n.data?.code)
              || (tenantsByCurrency[Number(n.data?.id)]?.length || 0) > 0
            ),
          },
          kpis: [
            { label: 'Total', icon: <Coins size={11} />, color: 'var(--app-info, #3b82f6)', filterKey: 'all', value: (_, all) => all.filter((n: any) => n.kind === 'currency').length },
            { label: 'Active', icon: <Check size={11} />, color: 'var(--app-success, #22c55e)', filterKey: 'active', value: (filtered) => filtered.filter((n: any) => n.kind === 'currency' && n.data?.is_active).length },
            { label: 'Inactive', icon: <X size={11} />, color: 'var(--app-error)', filterKey: 'inactive', value: (filtered) => filtered.filter((n: any) => n.kind === 'currency' && !n.data?.is_active).length },
            { label: 'With Symbol', icon: <DollarSign size={11} />, color: 'var(--app-accent)', filterKey: 'withSymbol', value: (filtered) => filtered.filter((n: any) => n.kind === 'currency' && n.data?.symbol).length },
            { label: 'In Use', icon: <Globe size={11} />, color: 'var(--app-primary)', filterKey: 'inUse', value: (filtered) => filtered.filter((n: any) => n.kind === 'currency' && (
              relatedCountries.some(ct => ct.default_currency === Number(n.data?.id) || ct.default_currency_code === n.data?.code)
              || (tenantsByCurrency[Number(n.data?.id)]?.length || 0) > 0
            )).length },
          ],
          emptyState: {
            icon: <Coins size={36} />,
            title: (hasSearch) => hasSearch ? 'No matching currencies' : 'No currencies defined yet',
            subtitle: (hasSearch) => hasSearch
              ? 'Try a different search term or clear filters.'
              : 'Click "New Currency" to add one.',
            actionLabel: 'Add First Currency',
          },
          onRefresh: fetchAll,
          // Bulk selection — drives the floating BulkActionBar below.
          selectable: true,
          // Audit history surfaces who created/edited/deleted each currency.
          auditTrail: {
            endpoint: 'audit-trail',
            resourceType: 'currency',
            title: 'Currency Audit Trail',
          },
        }}
        detailPanel={(node, { onClose, onPin }) => {
          const currency: Currency | null = node?.kind === 'currency' ? node.data : null
          if (!currency) return null
          const countriesUsing = relatedCountries.filter(ct =>
            ct.default_currency === currency.id || ct.default_currency_code === currency.code
          )
          return (
            <CurrencyDetailPanel
              currency={currency}
              allCountries={relatedCountries}
              countriesUsing={countriesUsing}
              tenantsUsing={tenantsByCurrency[currency.id] || []}
              onEdit={() => { setEditing(currency); onClose() }}
              onDelete={() => { requestDelete(currency); onClose() }}
              onClose={onClose}
              onPin={onPin ? () => onPin(node) : undefined}
              onUnlinkCountry={(ct) => promptUnlinkCountry(currency, ct)}
              onLinkCountry={(ct) => promptLinkCountry(currency, ct)}
            />
          )
        }}
        bulkActions={({ count, clearSelection: clear }) => (
          <BulkActionBar
            count={count}
            onActivate={handleBulkActivate}
            onDeactivate={handleBulkDeactivate}
            onDelete={handleBulkDelete}
            onClear={clear}
          />
        )}
      >
        {(renderProps) => {
          const { tree, isSelected, openNode, isCompact, selectedIds, toggleSelect, expandAll } = renderProps
          // Keep the ref in sync so BulkActionBar handlers read the current set.
          selectionRef.current = { selectedIds, clearSelection: renderProps.clearSelection }
          return tree
            .filter((n: any) => n.kind === 'currency')
            .map((n: any) => {
              const currency = n.data as Currency
              return (
                <CurrencyRow
                  key={String(n.id)}
                  item={currency}
                  isSelected={isSelected(n)}
                  onSelect={() => openNode(n, 'overview')}
                  onEdit={() => setEditing(currency)}
                  onDelete={() => requestDelete(currency)}
                  compact={isCompact}
                  selectable
                  isCheckedFn={(id) => selectedIds.has(id)}
                  onToggleCheck={toggleSelect}
                  forceExpanded={expandAll}
                  children={(n.children as TreeNode[]) || []}
                />
              )
            })
        }}
      </TreeMasterPage>

      {editing !== null && (
        <CurrencyEditModal
          currency={editing === 'new' ? null : editing as Currency}
          allCountries={relatedCountries}
          initialLinkedCountryIds={
            editing === 'new'
              ? []
              : relatedCountries
                  .filter(ct => ct.default_currency === (editing as Currency).id || ct.default_currency_code === (editing as Currency).code)
                  .map(ct => ct.id)
          }
          onClose={() => setEditing(null)}
          onSaved={fetchAll}
        />
      )}

      {/* Themed delete-confirm — single row */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={handleConfirmedDelete}
        title={`Delete ${deleteTarget?.code || 'currency'}?`}
        description={
          deleteTarget
            ? `This removes "${deleteTarget.code} — ${deleteTarget.name}" from the global registry. If any tenant has enabled this currency, the deletion will be blocked.`
            : 'This action cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
      />

      {/* Themed delete-confirm — bulk */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleConfirmedBulkDelete}
        title={`Delete ${selectionRef.current.selectedIds.size} ${selectionRef.current.selectedIds.size === 1 ? 'currency' : 'currencies'}?`}
        description="Currencies still in use by at least one tenant will be skipped. The rest will be removed from the registry."
        confirmText="Delete"
        variant="danger"
      />

      {/* Generic link/unlink prompt — variant + impact summary stay
          consistent across every guarded relationship action. */}
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
