'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Plus, Monitor, Settings2, Loader2, RefreshCcw, Search, Key, X,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
  Maximize2, Minimize2, Banknote, Warehouse, MapPin,
} from 'lucide-react'

/* Fragmented Component Imports */
import { RegisterDrawer } from './_components/RegisterDrawer'
import { GlobalSettingsPanel } from './_components/GlobalSettingsPanel'
import { UsersPinsPanel } from './_components/UsersPinsPanel'

/* Server Actions */
import { loadPOSSettingsData } from '@/app/actions/pos/settings-actions'
import { erpFetch } from '@/lib/erp-api' // Keep for creation

/* Types */
import type { Reg, FA, UD, Site } from './types'

import { useKeyboardShortcuts } from '@/lib/settings-framework/hooks/useKeyboardShortcuts'
import { useAutoSaveDraft } from '@/lib/settings-framework/hooks/useAutoSaveDraft'
import { KeyboardShortcutsModal } from '@/lib/settings-framework/components/KeyboardShortcutsModal'
import { DraftIndicator } from '@/lib/settings-framework/components/DraftIndicator'

/* ═══════════════════════════════════════════════════════════════
   STATUS CONFIG — mirrors the COA TYPE_CONFIG pattern
   ═══════════════════════════════════════════════════════════════ */
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  TOTAL: { label: 'Total', color: 'var(--app-primary)', bg: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', border: 'color-mix(in srgb, var(--app-primary) 20%, transparent)' },
  ONLINE: { label: 'Online', color: 'var(--app-success)', bg: 'color-mix(in srgb, var(--app-success) 10%, transparent)', border: 'color-mix(in srgb, var(--app-success) 20%, transparent)' },
  OFFLINE: { label: 'Offline', color: 'var(--app-muted-foreground)', bg: 'color-mix(in srgb, var(--app-border) 30%, transparent)', border: 'color-mix(in srgb, var(--app-border) 50%, transparent)' },
  INCOMPLETE: { label: 'Incomplete', color: 'var(--app-error)', bg: 'color-mix(in srgb, var(--app-error) 10%, transparent)', border: 'color-mix(in srgb, var(--app-error) 20%, transparent)' },
  SITES: { label: 'Sites', color: 'var(--app-info)', bg: 'color-mix(in srgb, var(--app-info) 10%, transparent)', border: 'color-mix(in srgb, var(--app-info) 20%, transparent)' },
}

export default function POSSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [sites, setSites] = useState<Site[]>([])
  const [users, setUsers] = useState<UD[]>([])
  const [accounts, setAccounts] = useState<FA[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showUsers, setShowUsers] = useState(false)
  const [returnToRegisterId, setReturnToRegisterId] = useState<number | null>(null)
  const [expandedSites, setExpandedSites] = useState<Set<number>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  // Create form
  const [createForm, setCreateForm] = useState({ name: '', siteId: 0, warehouseId: 0, cashAccountId: 0, enableAccountBook: true })
  const [creating, setCreating] = useState(false)

  const filteredCreateWarehouses = useMemo(() => {
    if (!createForm.siteId) return []
    return warehouses.filter((w: any) =>
      (w.parent === createForm.siteId || w.parent_id === createForm.siteId) &&
      w.is_active !== false &&
      w.can_sell === true
    )
  }, [warehouses, createForm.siteId])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadPOSSettingsData();
      
      const mapped = data.sites.map((s: any) => ({
        ...s,
        registers: (s.registers || []).map((r: any) => ({ ...r, siteId: s.id, siteName: s.name })),
      }))
      
      setSites(mapped)
      setExpandedSites(prev => prev.size > 0 ? prev : new Set(mapped.map((s: any) => s.id)))
      setUsers(data.users)
      setAccounts(data.accounts)
      setWarehouses(data.warehouses)
    } catch { toast.error('Failed to load settings data') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Framework integration
  const { draftSavedAt } = useAutoSaveDraft('pos_settings_draft', sites, sites.length > 0);
  const { showOverlay, setShowOverlay, shortcuts } = useKeyboardShortcuts([
    { key: 'k', ctrl: true, label: 'Ctrl+K', description: 'Focus search', action: () => searchRef.current?.focus() },
    { key: 'n', ctrl: true, label: 'Ctrl+N', description: 'New register', action: () => setIsAdding(true) },
    { key: 'r', ctrl: true, label: 'Ctrl+R', description: 'Refresh data', action: load },
  ], [load]);

  // Stats + filtered data
  const { filteredSites, stats } = useMemo(() => {
    const allRegs = sites.flatMap(s => s.registers)
    const online = allRegs.filter(r => r.isOpen).length
    const incomplete = allRegs.filter(r => !r.isConfigComplete).length
    const stats = {
      TOTAL: allRegs.length,
      ONLINE: online,
      OFFLINE: allRegs.length - online,
      INCOMPLETE: incomplete,
      SITES: sites.length,
    }

    let filtered = sites.map(s => {
      let regs = s.registers
      if (activeFilter === 'ONLINE') regs = regs.filter(r => r.isOpen)
      else if (activeFilter === 'OFFLINE') regs = regs.filter(r => !r.isOpen)
      else if (activeFilter === 'INCOMPLETE') regs = regs.filter(r => !r.isConfigComplete)

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        regs = regs.filter(r =>
          r.name?.toLowerCase().includes(q) ||
          r.cashAccountName?.toLowerCase().includes(q) ||
          s.name?.toLowerCase().includes(q)
        )
      }
      return { ...s, registers: regs }
    }).filter(s => s.registers.length > 0)

    return { filteredSites: filtered, stats }
  }, [sites, searchQuery, activeFilter])

  const branchOptions = useMemo(() => {
    const branchesWithPOS = new Set(
      warehouses
        .filter((w: any) => w.is_active !== false && w.can_sell === true && (w.parent || w.parent_id))
        .map((w: any) => w.parent || w.parent_id)
    )
    if (sites.length > 0) {
      return sites
        .filter(s => branchesWithPOS.has(s.id))
        .map(s => ({ id: s.id, name: s.name }))
    }
    return warehouses
      .filter((w: any) => (w.location_type === 'BRANCH' || !w.parent) && w.is_active !== false && branchesWithPOS.has(w.id))
      .map((w: any) => ({ id: w.id, name: w.name }))
  }, [sites, warehouses])

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.siteId) { toast.error('Name and site required'); return }
    setCreating(true)
    try {
      await erpFetch('pos-registers/create-register/', {
        method: 'POST', body: JSON.stringify({
          name: createForm.name, site_id: createForm.siteId,
          warehouse_id: createForm.warehouseId || undefined,
          cash_account_id: createForm.cashAccountId || undefined,
          account_book_id: createForm.enableAccountBook && createForm.cashAccountId ? createForm.cashAccountId : undefined,
        })
      })
      toast.success('Register created!')
      setIsAdding(false)
      setCreateForm({ name: '', siteId: 0, warehouseId: 0, cashAccountId: 0, enableAccountBook: true })
      load()
    } catch (e: any) { toast.error(e?.message || 'Failed') }
    setCreating(false)
  }

  if (loading) return (
    <div className="app-page flex items-center justify-center py-32">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--app-primary)', opacity: 0.6 }} />
    </div>
  )

  const totalFiltered = filteredSites.reduce((s, site) => s + site.registers.length, 0)

  return (
    <div className={`flex flex-col h-full animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>

      {/* ═══ HEADER ═══ */}
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
        {focusMode ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-app-primary flex items-center justify-center">
                <Monitor size={14} className="text-white" />
              </div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">POS</span>
              <span className="text-[10px] font-bold text-app-muted-foreground">{totalFiltered}/{stats.TOTAL}</span>
            </div>
            <div className="flex-1 relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
              <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search registers…"
                className="w-full pl-8 pr-4 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border outline-none transition-all" />
            </div>
            <button onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg transition-all flex-shrink-0">
              <Plus size={12} /><span className="hidden sm:inline">New</span>
            </button>
            <button onClick={() => setFocusMode(false)} title="Exit focus mode"
              className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0">
              <Minimize2 size={13} />
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <Monitor size={20} className="text-white" />
                </div>
                <div>
                  <h1>POS Configuration</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                    {stats.TOTAL} Registers · {stats.SITES} Sites
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <DraftIndicator savedAt={draftSavedAt} />
                    <button type="button" onClick={() => setShowOverlay(true)}
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-app-surface border border-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-all"
                      title="Keyboard shortcuts (?)">?</button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                <button onClick={() => setShowUsers(true)} 
                  className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <Key size={13} /><span className="hidden md:inline">Users & PINs</span>
                </button>
                <button onClick={() => setShowSettings(true)}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <Settings2 size={13} /><span className="hidden md:inline">Global Rules</span>
                </button>
                <button onClick={load}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <RefreshCcw size={13} /><span className="hidden md:inline">Refresh</span>
                </button>
                <button onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /><span className="hidden sm:inline">New Register</span>
                </button>
                <button onClick={() => setFocusMode(true)} title="Focus mode"
                  className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, conf]) => {
                const count = stats[key as keyof typeof stats] || 0
                const isActive = activeFilter === key
                return (
                  <button key={key} onClick={() => setActiveFilter(isActive ? null : (key === 'TOTAL' || key === 'SITES' ? null : key))}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-left hover:border-app-border"
                    style={{
                      background: isActive ? conf.bg : 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                      border: isActive ? `2px solid ${conf.border}` : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                      boxShadow: isActive ? `0 2px 8px ${conf.bg}` : 'none',
                    }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: conf.bg, color: conf.color }}>
                      {key === 'TOTAL' && <Monitor size={11} />}
                      {key === 'ONLINE' && <CheckCircle2 size={11} />}
                      {key === 'OFFLINE' && <Monitor size={11} />}
                      {key === 'INCOMPLETE' && <AlertTriangle size={11} />}
                      {key === 'SITES' && <MapPin size={11} />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: isActive ? conf.color : 'var(--app-muted-foreground)' }}>
                        {conf.label}
                      </div>
                      <div className="text-sm font-black text-app-foreground tabular-nums">{count}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by register name, branch, or cash account…"
                  className="w-full pl-9 pr-4 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
              </div>
              {(searchQuery || activeFilter) && (
                <button onClick={() => { setSearchQuery(''); setActiveFilter(null) }}
                  className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0"
                  style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}>
                  <X size={13} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ═══ INLINE CREATE FORM ═══ */}
      {isAdding && (
        <div className="flex-shrink-0 mb-3 p-4 border rounded-2xl animate-in slide-in-from-top-2 duration-200"
          style={{ background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))', borderColor: 'var(--app-border)', borderLeft: '3px solid var(--app-primary)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="uppercase">New Register</h3>
            <button onClick={() => setIsAdding(false)} className="p-1 hover:bg-app-border/50 rounded-lg transition-colors">
              <X size={14} className="text-app-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 items-end">
            <div>
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Name *</label>
              <input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Caisse 1"
                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:border-app-primary/50 outline-none" />
            </div>
            <div>
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Branch *</label>
              <select value={createForm.siteId} onChange={e => { const v = +e.target.value; setCreateForm(f => ({ ...f, siteId: v, warehouseId: 0 })) }}
                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none">
                <option value={0}>Select…</option>
                {branchOptions.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Warehouse</label>
              <select value={createForm.warehouseId} onChange={e => setCreateForm(f => ({ ...f, warehouseId: +e.target.value }))}
                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none"
                disabled={!createForm.siteId}>
                <option value={0}>{createForm.siteId ? '-- none --' : 'Select branch first'}</option>
                {filteredCreateWarehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.location_type || 'WH'})</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block">Cash Account</label>
              <select value={createForm.cashAccountId} onChange={e => setCreateForm(f => ({ ...f, cashAccountId: +e.target.value }))}
                className="w-full text-[12px] font-bold px-2.5 py-2 bg-app-bg border border-app-border/50 rounded-xl text-app-foreground outline-none">
                <option value={0}>Auto-create</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type})</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 py-1">
              <button onClick={() => setCreateForm(f => ({ ...f, enableAccountBook: !f.enableAccountBook }))}
                className={`w-9 h-5 rounded-full relative transition-all shrink-0 ${createForm.enableAccountBook ? 'bg-app-primary' : 'bg-app-surface'}`}>
                <span className={`w-3.5 h-3.5 rounded-full bg-app-surface shadow absolute top-[3px] transition-all ${createForm.enableAccountBook ? 'left-[18px]' : 'left-[3px]'}`} />
              </button>
              <span className="text-[10px] text-app-muted-foreground font-bold">Book</span>
            </div>
            <div>
              <button onClick={handleCreate} disabled={creating}
                className="w-full text-[11px] font-bold bg-app-primary hover:brightness-110 text-white py-2 rounded-xl transition-all disabled:opacity-50">
                {creating ? '…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ REGISTER TABLE ═══ */}
      <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
        {/* Column Headers */}
        <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
          <div className="w-5 flex-shrink-0" />
          <div className="w-7 flex-shrink-0" />
          <div className="flex-1 min-w-0">Register</div>
          <div className="hidden md:block w-28 flex-shrink-0">Cash Account</div>
          <div className="hidden lg:block w-24 flex-shrink-0">Warehouse</div>
          <div className="w-20 flex-shrink-0">Status</div>
          <div className="w-16 flex-shrink-0" />
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar">
          {filteredSites.length > 0 ? (
            filteredSites.map(site => {
              const isExpanded = expandedSites.has(site.id)
              return (
                <div key={site.id}>
                  <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer hover:bg-app-surface py-2.5 md:py-3"
                    onClick={() => setExpandedSites(prev => {
                      const next = new Set(prev)
                      next.has(site.id) ? next.delete(site.id) : next.add(site.id)
                      return next
                    })}
                    style={{
                      paddingLeft: '12px', paddingRight: '12px',
                      background: 'color-mix(in srgb, var(--app-info) 4%, var(--app-surface))',
                      borderLeft: '3px solid var(--app-info)',
                    }}>
                    <button className="w-5 h-5 flex items-center justify-center rounded-md text-app-muted-foreground">
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: 'color-mix(in srgb, var(--app-info) 12%, transparent)', color: 'var(--app-info)' }}>
                      <MapPin size={14} />
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-bold text-[13px] text-app-foreground">{site.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                        {site.registers.length} register{site.registers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-150">
                      {site.registers.map(reg => (
                        <div key={reg.id}>
                          <div className={`group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer hover:bg-app-surface/40 py-1.5 md:py-2 border-b border-app-border/30 ${expandedId === reg.id ? 'bg-app-surface/50' : ''}`}
                            onClick={() => setExpandedId(expandedId === reg.id ? null : reg.id)}
                            style={{
                              paddingLeft: '44px', paddingRight: '12px',
                              borderLeft: `1px solid color-mix(in srgb, var(--app-border) 40%, transparent)`,
                              marginLeft: '22px',
                            }}>
                            <button className="w-5 h-5 flex items-center justify-center rounded-md text-app-muted-foreground">
                              {expandedId === reg.id ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </button>

                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                background: reg.isOpen
                                  ? 'color-mix(in srgb, var(--app-success) 12%, transparent)'
                                  : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                color: reg.isOpen ? 'var(--app-success)' : 'var(--app-muted-foreground)',
                              }}>
                              <Monitor size={13} />
                            </div>

                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="font-medium text-[13px] text-app-foreground truncate">{reg.name}</span>
                              {reg.isOpen && (
                                <span className="text-[8px] font-black px-1.5 py-0.5 rounded"
                                  style={{ color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)' }}>
                                  LIVE
                                </span>
                              )}
                            </div>

                            <div className="hidden md:flex w-28 items-center gap-1 flex-shrink-0">
                              {reg.cashAccountName ? (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded truncate"
                                  style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', color: 'var(--app-foreground)' }}>
                                  {reg.cashAccountName}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold" style={{ color: 'var(--app-error)' }}>⚠ None</span>
                              )}
                            </div>

                            <div className="hidden lg:flex w-24 items-center flex-shrink-0">
                              <span className="text-[10px] text-app-muted-foreground truncate">
                                {reg.warehouseId ? '✓ Set' : '—'}
                              </span>
                            </div>

                            <div className="w-20 flex-shrink-0">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full`}
                                style={reg.isConfigComplete
                                  ? { color: 'var(--app-success)', background: 'color-mix(in srgb, var(--app-success) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--app-success) 20%, transparent)' }
                                  : { color: 'var(--app-error)', background: 'color-mix(in srgb, var(--app-error) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)' }}>
                                {reg.isConfigComplete ? <><CheckCircle2 size={9} /> Ready</> : <><AlertTriangle size={9} /> Setup</>}
                              </span>
                            </div>

                            <div className="w-16 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-right">
                              <button onClick={e => { e.stopPropagation(); setExpandedId(reg.id) }}
                                className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
                                <Settings2 size={12} />
                              </button>
                            </div>
                          </div>

                          {expandedId === reg.id && (
                            <RegisterDrawer reg={reg} accounts={accounts} warehouses={warehouses} users={users}
                              onRefresh={() => { setExpandedId(null); load() }} onClose={() => setExpandedId(null)}
                              onOpenUsers={(regId) => { setExpandedId(null); setReturnToRegisterId(regId); setShowUsers(true) }}
                              onOpenSettings={(regId) => { setExpandedId(null); setReturnToRegisterId(regId); setShowSettings(true) }} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 15%, transparent), color-mix(in srgb, var(--app-primary) 5%, transparent))', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                <Monitor size={28} style={{ color: 'var(--app-primary)', opacity: 0.7 }} />
              </div>
              <p className="text-base font-bold text-app-muted-foreground mb-1">
                {searchQuery || activeFilter ? 'No matching registers' : 'No registers yet'}
              </p>
              <p className="text-xs text-app-muted-foreground mb-6 max-w-xs">
                {searchQuery || activeFilter
                  ? 'Try adjusting your search or filter.'
                  : 'Create your first POS register to get started.'}
              </p>
              {!searchQuery && !activeFilter && (
                <button onClick={() => setIsAdding(true)}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-4 py-2 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /> Create Register
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══ SLIDE-IN PANELS ═══ */}
      {showSettings && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200" onClick={() => setShowSettings(false)} />
          <GlobalSettingsPanel onClose={() => { setShowSettings(false); setReturnToRegisterId(null) }}
            onReturn={returnToRegisterId ? () => { setShowSettings(false); setExpandedId(returnToRegisterId); setReturnToRegisterId(null) } : undefined} />
        </>
      )}
      {showUsers && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200" onClick={() => { setShowUsers(false); setReturnToRegisterId(null) }} />
          <UsersPinsPanel users={users} onRefresh={load} onClose={() => { setShowUsers(false); setReturnToRegisterId(null) }}
            onReturn={returnToRegisterId ? () => { setShowUsers(false); setExpandedId(returnToRegisterId); setReturnToRegisterId(null) } : undefined} />
        </>
      )}
      {showOverlay && <KeyboardShortcutsModal shortcuts={shortcuts} onClose={() => setShowOverlay(false)} />}
    </div>
  )
}
