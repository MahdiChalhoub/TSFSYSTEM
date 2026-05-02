'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Coins, Loader2, Plus, Pencil, Trash2, X, DollarSign, Save, Check, Hash,
  Power, PowerOff, Globe, Building2,
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { TreeMasterPage } from '@/components/templates/TreeMasterPage'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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

function CurrencyEditModal({ currency, onClose, onSaved }: {
  currency: Currency | null
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, code: form.code.toUpperCase() }
      if (isNew) {
        await erpFetch('reference/currencies/', { method: 'POST', body: JSON.stringify(payload) })
        toast.success(`Currency ${payload.code} created`)
      } else {
        await erpFetch(`reference/currencies/${currency!.id}/`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success(`Currency ${payload.code} updated`)
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
 * Same row template as CurrencyRow (icon w-9 h-9, name in text-tp-md font-bold,
 * subtitle below). Indentation + tree connector make hierarchy visible while
 * the typography stays consistent with the parent row — like categories.
 */
function LinkedLeaf({ node, isLast }: { node: TreeNode; isLast: boolean }) {
  const meta = LINKED_KIND_META[node.kind as Exclude<TreeNode['kind'], 'currency'>]
  const flag = node.kind === 'country' && node.data?.iso2 ? getFlagEmoji(node.data.iso2) : null
  return (
    <div className="relative" style={{ paddingLeft: '24px' }}>
      <div className="absolute pointer-events-none"
        style={{ left: '4px', top: 0, bottom: isLast ? '50%' : 0, width: '1px', background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
      <div className="absolute pointer-events-none"
        style={{ left: '4px', top: '50%', width: '14px', height: '1px', background: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }} />
      <a
        href={meta.href}
        className="group flex items-center gap-2 md:gap-3 transition-all duration-150 rounded-lg no-underline"
        style={{ padding: '8px 10px', color: 'inherit' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--app-surface) 50%, transparent)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `color-mix(in srgb, ${meta.color} 10%, transparent)`, color: meta.color }}>
          {flag ? <span className="text-tp-md leading-none">{flag}</span> : meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-tp-md font-bold text-app-foreground truncate">{node.name}</span>
            <span className="text-tp-xxs font-bold uppercase tracking-wide px-1.5 py-0.5 rounded flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${meta.color} 10%, transparent)`, color: meta.color }}>
              {meta.label}
            </span>
          </div>
          {node.subtitle && (
            <p className="text-tp-xxs font-medium text-app-muted-foreground truncate">{node.subtitle}</p>
          )}
        </div>
      </a>
    </div>
  )
}

/**
 * Flat list of children matching the parent row template — same row look,
 * connector indent shows hierarchy. Same pattern as countries / categories.
 */
function LinkedTree({ children: nodes }: { children: TreeNode[] }) {
  const ordered = nodes
    .filter(n => n.kind !== 'currency')
    .sort((a, b) => KIND_ORDER.indexOf(a.kind as any) - KIND_ORDER.indexOf(b.kind as any))

  if (ordered.length === 0) {
    return (
      <div className="ml-9 px-3 py-2 text-tp-xs text-app-muted-foreground italic">
        Not yet linked to any country or tenant.
      </div>
    )
  }

  return (
    <div className="relative ml-9 mr-2 mb-2 mt-1">
      <div className="absolute pointer-events-none"
        style={{ left: '11px', top: 0, bottom: '24px', width: '1px', background: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }} />
      {ordered.map((n, idx) => (
        <LinkedLeaf key={String(n.id)} node={n} isLast={idx === ordered.length - 1} />
      ))}
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

function CurrencyDetailPanel({ currency, onEdit, onDelete, onClose }: {
  currency: Currency
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}) {
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
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black flex-shrink-0"
          style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}>
          {currency.symbol || currency.code.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-[15px] font-black text-app-foreground truncate font-mono">{currency.code}</h2>
            {!currency.is_active && (
              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', color: 'var(--app-error)' }}>
                Inactive
              </span>
            )}
          </div>
          <p className="text-[11px] text-app-muted-foreground truncate mt-0.5">{currency.name}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-app-surface text-app-muted-foreground hover:text-app-foreground transition-all flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        <Stat label="ISO 4217 Code" value={currency.code} icon={<DollarSign size={12} />} color="var(--app-info, #3b82f6)" />
        <Stat label="Numeric Code" value={currency.numeric_code || '—'} icon={<Hash size={12} />} color="var(--app-muted-foreground)" />
        <Stat label="Symbol" value={currency.symbol || '—'} icon={<DollarSign size={12} />} color="var(--app-muted-foreground)" />
        <Stat label="Minor Unit" value={`${currency.minor_unit} decimal ${currency.minor_unit === 1 ? 'place' : 'places'}`} icon={<Hash size={12} />} color="var(--app-muted-foreground)" />
        <Stat label="Status" value={currency.is_active ? 'Active' : 'Inactive'} icon={<Check size={12} />} color={currency.is_active ? 'var(--app-success, #22c55e)' : 'var(--app-error)'} />
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-3" style={{ borderTop: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold text-white rounded-lg transition-all hover:brightness-110"
          style={{ background: 'var(--app-info, #3b82f6)' }}>
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
          // Navigation links to related SaaS-admin masters — same pattern
          // as categories (Cleanup link). Lets users hop between linked
          // reference data without going through the sidebar.
          secondaryActions: [
            { label: 'Countries',  icon: <Globe size={13} />,    href: '/countries' },
            { label: 'Tax Templates', icon: <DollarSign size={13} />, href: '/country-tax-templates' },
            { label: 'Payment Gateways', icon: <DollarSign size={13} />, href: '/payment-gateways' },
            { label: 'E-Invoice', icon: <DollarSign size={13} />, href: '/e-invoice-standards' },
          ],
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
        detailPanel={(node, { onClose }) => {
          const currency: Currency | null = node?.kind === 'currency' ? node.data : null
          if (!currency) return null
          return (
            <CurrencyDetailPanel
              currency={currency}
              onEdit={() => { setEditing(currency); onClose() }}
              onDelete={() => { requestDelete(currency); onClose() }}
              onClose={onClose}
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
    </div>
  )
}
