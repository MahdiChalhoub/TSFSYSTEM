'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Globe, Plus, Pencil, Trash2, Search, Loader2,
  FileText, Shield, Maximize2, Minimize2, Sparkles
} from 'lucide-react'
import { toast } from 'sonner'
import { erpFetch } from '@/lib/erp-api'
import { type Template } from './types'
import TemplateEditor from './editor'

/* ═══════════════════════════════════════════════════════
   SaaS — Country Tax Templates Management
   Global templates that auto-fill tax settings per country
   ═══════════════════════════════════════════════════════ */

function getFlagEmoji(code: string): string {
  if (!code || code.length < 2) return '🌍'
  const cc = code.toUpperCase().slice(0, 2)
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

function getPolicies(t: Template): Record<string, any>[] {
  return Array.isArray(t.org_policy_defaults) ? t.org_policy_defaults : (t.org_policy_defaults && typeof t.org_policy_defaults === 'object' ? [t.org_policy_defaults] : [])
}

/* ── Main Page ─────────────────────────────────────────── */
export default function CountryTaxTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [refCountries, setRefCountries] = useState<{ iso2: string; name: string; default_currency_code?: string }[]>([])
  const [refCurrencies, setRefCurrencies] = useState<{ code: string; name: string }[]>([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const data = await erpFetch('finance/country-tax-templates/')
      setTemplates(Array.isArray(data) ? data : data?.results || [])
    } catch { toast.error('Failed to load templates') }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Pre-fetch reference data once — passed to editor as props for instant load
  useEffect(() => {
    erpFetch('reference/countries/?limit=300').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      setRefCountries(list.map((c: any) => ({ iso2: c.iso2 || c.code || '', name: c.name || c.country_name || '', default_currency_code: c.default_currency_code || c.currency_code || '' })))
    }).catch(() => {})
    erpFetch('reference/currencies/?limit=200').then(data => {
      const list = Array.isArray(data) ? data : data?.results || []
      setRefCurrencies(list.map((c: any) => ({ code: c.code || c.currency_code || '', name: c.name || c.currency_name || '' })))
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this country template?')) return
    try {
      await erpFetch(`finance/country-tax-templates/${id}/`, { method: 'DELETE' })
      toast.success('Template deleted')
      fetchAll()
    } catch { toast.error('Failed to delete') }
  }

  const filtered = templates.filter(t => {
    if (!search) return true
    const s = search.toLowerCase()
    return t.country_code.toLowerCase().includes(s) || t.country_name.toLowerCase().includes(s) || t.currency_code.toLowerCase().includes(s)
  })

  if (editingId !== null) {
    return <TemplateEditor
      id={editingId}
      existing={editingId !== 'new' ? templates.find(t => t.id === editingId) : undefined}
      onClose={() => { setEditingId(null); fetchAll() }}
      prefetchedCountries={refCountries}
      prefetchedCurrencies={refCurrencies}
    />
  }

  const kpis = [
    { label: 'Templates', value: templates.length, icon: <Globe size={13} />, color: 'var(--app-primary)' },
    { label: 'Active', value: templates.filter(t => t.is_active).length, icon: <Shield size={13} />, color: 'var(--app-success, #22c55e)' },
    { label: 'Policies', value: templates.reduce((s, t) => s + getPolicies(t).length, 0), icon: <FileText size={13} />, color: 'var(--app-info, #3b82f6)' },
    { label: 'Profiles', value: templates.reduce((s, t) => s + (t.counterparty_presets?.length || 0), 0), icon: <Sparkles size={13} />, color: 'var(--app-accent)' },
  ]

  return (
    <div className={`flex flex-col h-full p-3 md:p-4 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-3rem)]' : 'max-h-[calc(100vh-6rem)]'}`}>

      {/* ── Header ── */}
      {!focusMode ? (
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="page-header-icon bg-app-primary" style={{ width: 32, height: 32, boxShadow: '0 3px 10px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
              <Globe size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-black text-app-foreground tracking-tight leading-tight">
                Country Tax Templates
              </h1>
              <p className="text-[9px] md:text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                {templates.length} Templates · SaaS Governed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setFocusMode(true)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-1.5 py-1 rounded-lg hover:bg-app-surface transition-all">
              <Maximize2 size={12} />
            </button>
            <button onClick={() => setEditingId('new')}
              className="flex items-center gap-1 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-2.5 py-1 rounded-lg transition-all"
              style={{ boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
              <Plus size={13} />
              <span className="hidden sm:inline">New Template</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-6 h-6 rounded-md bg-app-primary flex items-center justify-center">
              <Globe size={12} className="text-white" />
            </div>
            <span className="text-[11px] font-black text-app-foreground hidden sm:inline">Tax Templates</span>
            <span className="text-[9px] font-bold text-app-muted-foreground">{filtered.length}/{templates.length}</span>
          </div>
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search... (Ctrl+K)"
              className="w-full pl-8 pr-2.5 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
          </div>
          <button onClick={() => setFocusMode(false)} className="p-1 rounded-md border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
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

      {/* ── Search (non-focus) ── */}
      {!focusMode && (
        <div className="flex-shrink-0 mb-2 relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
          <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by country code, name, or currency... (Ctrl+K)"
            className="w-full pl-8 pr-2.5 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-app-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-3 text-center">
            <Globe size={32} className="text-app-muted-foreground mb-2 opacity-40" />
            <p className="text-sm font-bold text-app-muted-foreground">No templates found</p>
            <p className="text-[11px] text-app-muted-foreground mt-0.5">
              Click &quot;New Template&quot; to create country-specific tax defaults.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '6px' }}>
            {filtered.map(t => {
              const policies = getPolicies(t)
              return (
                <div key={t.id}
                  className="group rounded-xl overflow-hidden transition-all hover:shadow-md"
                  style={{
                    background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                  }}>
                  {/* Card Header */}
                  <div className="px-2.5 py-2 flex items-center gap-2"
                    style={{
                      background: 'color-mix(in srgb, var(--app-primary) 4%, var(--app-surface))',
                      borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)' }}>
                      {getFlagEmoji(t.country_code)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-bold text-app-foreground truncate leading-tight">
                        {t.country_code} — {t.country_name}
                      </div>
                      <p className="text-[9px] font-bold text-app-muted-foreground uppercase tracking-wider leading-tight">
                        {t.currency_code} · {policies.length} pol · {t.document_requirements?.length || 0} docs · {t.counterparty_presets?.length || 0} profiles
                      </p>
                    </div>
                    <div className="flex items-center gap-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingId(t.id)} title="Edit"
                        className="p-1 hover:bg-app-border/50 rounded-md text-app-muted-foreground hover:text-app-foreground transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => handleDelete(t.id)} title="Delete"
                        className="p-1 hover:bg-app-border/50 rounded-md transition-colors"
                        style={{ color: 'var(--app-error, #ef4444)' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="px-2.5 py-1.5 space-y-1">
                    {/* Policy Presets */}
                    <div>
                      <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest mb-0.5">
                        Policies
                      </div>
                      <div className="flex flex-wrap gap-0.5">
                        {policies.map((p: any, i: number) => (
                          <span key={i} className="text-[9px] font-bold px-1.5 py-px rounded"
                            style={{
                              background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                              border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                              color: 'var(--app-foreground)',
                            }}>{p.name || `P${i + 1}`}</span>
                        ))}
                        {policies.length === 0 && <span className="text-[9px] text-app-muted-foreground italic">None</span>}
                      </div>
                    </div>

                    {/* Counterparty Profiles */}
                    {(t.counterparty_presets?.length || 0) > 0 && (
                      <div>
                        <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest mb-0.5">
                          Profiles
                        </div>
                        <div className="flex flex-wrap gap-0.5">
                          {t.counterparty_presets.map((p, i) => (
                            <span key={i} className="text-[9px] font-bold px-1.5 py-px rounded"
                              style={{
                                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, transparent)',
                                color: 'var(--app-foreground)',
                              }}>{p.name}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Document Summary */}
                    {(t.document_requirements?.length || 0) > 0 && (
                      <div>
                        <div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest mb-0.5">
                          Docs ({t.document_requirements.length})
                        </div>
                        <div className="flex flex-wrap gap-0.5">
                          {t.document_requirements.map((d, i) => (
                            <span key={i} className="text-[9px] font-bold px-1.5 py-px rounded"
                              style={{
                                background: d.required
                                  ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)'
                                  : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                border: `1px solid ${d.required
                                  ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)'
                                  : 'color-mix(in srgb, var(--app-border) 40%, transparent)'}`,
                                color: 'var(--app-foreground)',
                              }}>
                              {d.type}{d.required ? ' ★' : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
