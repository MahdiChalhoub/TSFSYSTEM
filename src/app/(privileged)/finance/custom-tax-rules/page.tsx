'use client'
/**
 * Custom Tax Rules — Management Page
 * ====================================
 * Tax Engine · Configuration Layer
 * Dajingo Pro V2 Design Language
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Loader2, X, Maximize2, Minimize2,
  ListChecks, Percent, Calculator, Edit2, Trash2,
  Save, ArrowLeft, Zap, Layers, Globe, ChevronRight,
  Download, ArrowDownCircle, CheckCircle2, Sparkles, FileText
} from 'lucide-react'

type CTR = Record<string, any>

type TemplatePreset = {
    name: string
    rate?: string
    transaction_type?: string
    math_behavior?: string
    calculation_order?: number
    already_imported?: boolean
    [key: string]: any
}

type TemplateData = {
    country_code: string | null
    country_name: string | null
    currency_code?: string
    presets: TemplatePreset[]
    total?: number
    imported?: number
}

const TRANSACTION_TYPES = ['PURCHASE', 'SALE', 'BOTH']
const MATH_BEHAVIORS = ['ADDED_TO_TTC', 'WITHHELD_FROM_AP']
const COST_TREATMENTS = ['CAPITALIZE', 'EXPENSE']
const TAX_BASE_MODES = ['HT', 'TTC', 'PREVIOUS_TAX']

const friendlyLabel: Record<string, string> = {
  PURCHASE: 'Purchase Only', SALE: 'Sale Only', BOTH: 'Purchases & Sales',
  ADDED_TO_TTC: 'Add to Invoice (like Sales Tax)', WITHHELD_FROM_AP: 'Withhold (like AIRSI)',
  CAPITALIZE: 'Capitalize into Cost', EXPENSE: 'Expense to P&L',
  HT: 'On HT (pre-tax)', TTC: 'On running gross (HT + prior taxes)', PREVIOUS_TAX: 'On a prior tax amount',
}

const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const selectCls = inputCls
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

/* ═══════════ Template Preset Card ═══════════ */
function PresetCard({ preset, onImport, importing }: {
    preset: TemplatePreset; onImport: (name: string) => void; importing: boolean
}) {
    const isImported = preset.already_imported
    const ratePct = preset.rate ? `${(parseFloat(preset.rate) * 100).toFixed(2)}%` : '—'

    return (
        <div className="relative flex flex-col gap-2 px-4 py-3 rounded-xl transition-all duration-200"
            style={{
                background: isImported
                    ? 'color-mix(in srgb, var(--app-success, #22c55e) 4%, var(--app-surface))'
                    : 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                border: isImported
                    ? '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)'
                    : '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                opacity: isImported ? 0.75 : 1,
            }}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                            background: isImported ? 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)' : 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: isImported ? 'var(--app-success, #22c55e)' : 'var(--app-primary)',
                        }}>
                        {isImported ? <CheckCircle2 size={13} /> : <Zap size={13} />}
                    </div>
                    <span className="text-[12px] font-bold text-app-foreground truncate">{preset.name}</span>
                </div>
                {isImported ? (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)' }}>Imported</span>
                ) : (
                    <button onClick={() => onImport(preset.name)} disabled={importing}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex-shrink-0 hover:brightness-110"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: importing ? 0.6 : 1 }}>
                        {importing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                        Import
                    </button>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '4px' }}>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Rate</span>
                    <span className="text-[11px] font-black font-mono text-app-foreground tabular-nums">{ratePct}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Type</span>
                    <span className="text-[10px] font-bold text-app-foreground">{friendlyLabel[preset.transaction_type || ''] || preset.transaction_type || '—'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Behavior</span>
                    <span className="text-[10px] font-bold text-app-foreground">{preset.math_behavior === 'WITHHELD_FROM_AP' ? 'Withhold' : 'Add to TTC'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Order</span>
                    <span className="text-[10px] font-bold font-mono text-app-muted-foreground">#{preset.calculation_order || 100}</span>
                </div>
            </div>
        </div>
    )
}

/* ═══════════ Rule Row ═══════════ */
function RuleRow({ item, onEdit, onDelete }: { item: CTR; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3"
      onClick={onEdit}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: item.is_active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
          color: item.is_active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
        }}>
        <Zap size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="truncate text-[13px] font-bold text-app-foreground block">{item.name}</span>
        <span className="text-[10px] font-bold text-app-muted-foreground">
          {friendlyLabel[item.transaction_type] || item.transaction_type} · {friendlyLabel[item.math_behavior] || item.math_behavior}
        </span>
      </div>
      <div className="hidden sm:block w-20 flex-shrink-0">
        <span className="font-mono text-[13px] font-black text-app-foreground tabular-nums">
          {((parseFloat(item.rate) || 0) * 100).toFixed(2)}%
        </span>
      </div>
      <div className="hidden md:block w-16 flex-shrink-0 text-center">
        <span className="font-mono text-[11px] font-bold text-app-muted-foreground tabular-nums">
          #{item.calculation_order || 100}
        </span>
      </div>
      <div className="hidden md:block w-20 flex-shrink-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
          style={{
            background: item.is_active ? 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)' : 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
            color: item.is_active ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)',
          }}>{item.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"><Edit2 size={12} /></button>
        <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

/* ═══════════ Rule Editor ═══════════ */
function RuleEditor({ item, onSave, onCancel }: { item: CTR | null; onSave: (data: CTR) => void; onCancel: () => void }) {
  const [form, setForm] = useState<CTR>(item || {
    name: '', rate: 0, transaction_type: 'BOTH', math_behavior: 'ADDED_TO_TTC',
    purchase_cost_treatment: 'EXPENSE', tax_base_mode: 'HT', base_tax_type: '',
    calculation_order: 100, compound_group: '', is_active: true,
  })
  const [saving, setSaving] = useState(false)
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
          <ArrowLeft size={13} /> Back
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}><ListChecks size={20} className="text-white" /></div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-app-foreground tracking-tight truncate">{item ? 'Edit Custom Tax Rule' : 'New Custom Tax Rule'}</h1>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Tax Engine · Configuration</p>
          </div>
        </div>
        <button onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div><label className={labelCls}>Rule Name</label><input className={inputCls} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Eco Tax, Tourism Levy" /></div>
          <div><label className={labelCls}>Rate</label><input className={inputCls} type="number" step="0.0001" min="0" max="1" value={form.rate} onChange={e => upd('rate', e.target.value)} /><p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Decimal (0.05 = 5%)</p></div>
          <div><label className={labelCls}>Transaction Type</label><select className={selectCls} value={form.transaction_type} onChange={e => upd('transaction_type', e.target.value)}>{TRANSACTION_TYPES.map(t => <option key={t} value={t}>{friendlyLabel[t]}</option>)}</select></div>
          <div><label className={labelCls}>Math Behavior</label><select className={selectCls} value={form.math_behavior} onChange={e => upd('math_behavior', e.target.value)}>{MATH_BEHAVIORS.map(t => <option key={t} value={t}>{friendlyLabel[t]}</option>)}</select></div>
          <div><label className={labelCls}>Purchase Cost Treatment</label><select className={selectCls} value={form.purchase_cost_treatment} onChange={e => upd('purchase_cost_treatment', e.target.value)}>{COST_TREATMENTS.map(t => <option key={t} value={t}>{friendlyLabel[t]}</option>)}</select></div>
          <div><label className={labelCls}>Tax Base Mode</label><select className={selectCls} value={form.tax_base_mode} onChange={e => upd('tax_base_mode', e.target.value)}>{TAX_BASE_MODES.map(t => <option key={t} value={t}>{friendlyLabel[t]}</option>)}</select></div>
          {form.tax_base_mode === 'PREVIOUS_TAX' && (<div><label className={labelCls}>Base Tax Type</label><input className={inputCls} value={form.base_tax_type || ''} onChange={e => upd('base_tax_type', e.target.value)} placeholder="e.g. VAT, AIRSI" /></div>)}
          <div><label className={labelCls}>Calculation Order</label><input className={inputCls} type="number" min="1" value={form.calculation_order} onChange={e => upd('calculation_order', parseInt(e.target.value) || 100)} /><p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Core: VAT=10, AIRSI=20. Custom default=100</p></div>
          <div><label className={labelCls}>Compound Group</label><input className={inputCls} value={form.compound_group || ''} onChange={e => upd('compound_group', e.target.value)} placeholder="e.g. brazil_composite" /></div>
          <div><label className={labelCls}>Active</label><label className="flex items-center gap-2 cursor-pointer mt-1"><input type="checkbox" checked={form.is_active} onChange={e => upd('is_active', e.target.checked)} className="rounded" /><span className="text-[12px] font-bold text-app-foreground">Enabled</span></label></div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════ Main Page ═══════════ */
export default function CustomTaxRulesPage() {
  const [items, setItems] = useState<CTR[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [editing, setEditing] = useState<CTR | null | 'new'>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Template state
  const [templateData, setTemplateData] = useState<TemplateData | null>(null)
  const [templateLoading, setTemplateLoading] = useState(true)
  const [templateCollapsed, setTemplateCollapsed] = useState(false)
  const [importingPreset, setImportingPreset] = useState<string | null>(null)
  const [importingAll, setImportingAll] = useState(false)

  useEffect(() => { load(); loadTemplates() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  async function load() {
    try { setLoading(true); const d = await erpFetch('finance/custom-tax-rules/'); setItems(Array.isArray(d) ? d : d?.results || []) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function loadTemplates() {
    try {
      setTemplateLoading(true)
      const data = await erpFetch('finance/custom-tax-rules/available-templates/')
      setTemplateData(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
      setTemplateData(null)
    } finally { setTemplateLoading(false) }
  }

  async function handleImportPreset(presetName: string) {
    if (!templateData?.country_code) return
    setImportingPreset(presetName)
    try {
      await erpFetch('finance/custom-tax-rules/import-from-template/', {
        method: 'POST',
        body: JSON.stringify({ country_code: templateData.country_code, preset_names: [presetName] }),
      })
      await Promise.all([load(), loadTemplates()])
    } catch (error) { console.error('Import failed:', error) }
    finally { setImportingPreset(null) }
  }

  async function handleImportAll() {
    if (!templateData?.country_code) return
    setImportingAll(true)
    try {
      await erpFetch('finance/custom-tax-rules/import-from-template/', {
        method: 'POST',
        body: JSON.stringify({ country_code: templateData.country_code, preset_names: [] }),
      })
      await Promise.all([load(), loadTemplates()])
    } catch (error) { console.error('Import all failed:', error) }
    finally { setImportingAll(false) }
  }

  async function handleSave(data: CTR) {
    try {
      if (data.id) {
        await erpFetch(`finance/custom-tax-rules/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
      } else {
        await erpFetch('finance/custom-tax-rules/', { method: 'POST', body: JSON.stringify(data) })
      }
      setEditing(null); load()
    } catch (e) { console.error(e); alert('Save failed') }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this custom tax rule?')) return
    try { await erpFetch(`finance/custom-tax-rules/${id}/`, { method: 'DELETE' }); load() }
    catch (e) { console.error(e) }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(i => i.name?.toLowerCase().includes(q) || i.transaction_type?.toLowerCase().includes(q) || i.compound_group?.toLowerCase().includes(q))
  }, [items, searchQuery])

  const pendingImports = templateData?.presets?.filter(p => !p.already_imported)?.length || 0
  const allImported = templateData?.presets && templateData.presets.length > 0 && pendingImports === 0

  const kpis = [
    { label: 'Rules', value: items.length, icon: <ListChecks size={11} />, color: 'var(--app-primary)' },
    { label: 'Active', value: items.filter(i => i.is_active).length, icon: <Zap size={11} />, color: 'var(--app-success, #22c55e)' },
    { label: 'Compound', value: items.filter(i => i.compound_group).length, icon: <Layers size={11} />, color: 'var(--app-info, #3b82f6)' },
    { label: 'Templates', value: pendingImports > 0 ? `${pendingImports} pending` : '✓ Synced', icon: <Sparkles size={11} />, color: pendingImports > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' },
  ]

  if (editing) {
    return <RuleEditor item={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
  }

  return (
    <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
        {!focusMode && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <ListChecks size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Custom Tax Rules</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                    Tax Engine · Configuration · {templateData?.country_name || 'Loading...'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setEditing('new')}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /> New Rule
                </button>
                <button onClick={() => setFocusMode(true)}
                  className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all">
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {kpis.map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                    <div className="text-sm font-black text-app-foreground tabular-nums truncate">{s.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          {focusMode && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><ListChecks size={14} style={{ color: '#fff' }} /></div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Custom Tax Rules</span>
            </div>
          )}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search rules... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
          </div>
          {focusMode && <>
            <button onClick={() => setEditing('new')} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg"><Plus size={12} /></button>
            <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all"><Minimize2 size={13} /></button>
          </>}
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0" style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)' }}><X size={13} /></button>}
        </div>
      </div>

      {/* ═══════ Country Template Banner ═══════ */}
      {!focusMode && !templateLoading && templateData && templateData.presets && templateData.presets.length > 0 && (
        <div className="flex-shrink-0 mb-3 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
          style={{
            background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, var(--app-surface))',
            border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, var(--app-border))',
            borderLeft: '3px solid var(--app-info, #3b82f6)',
          }}>
          <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
            onClick={() => setTemplateCollapsed(!templateCollapsed)}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{
                  background: allImported ? 'var(--app-success, #22c55e)' : 'var(--app-info, #3b82f6)',
                  boxShadow: allImported ? '0 4px 12px color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)' : '0 4px 12px color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)',
                }}>
                {allImported ? <CheckCircle2 size={15} className="text-white" /> : <Globe size={15} className="text-white" />}
              </div>
              <div>
                <h3 className="text-[12px] font-black text-app-foreground">{templateData.country_name} Tax Rule Templates</h3>
                <p className="text-[10px] font-bold text-app-muted-foreground">
                  {allImported ? `All ${templateData.presets.length} rules synced` : `${pendingImports} of ${templateData.presets.length} rules available`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!allImported && !templateCollapsed && (
                <button onClick={(e) => { e.stopPropagation(); handleImportAll() }} disabled={importingAll}
                  className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
                  style={{ background: 'var(--app-info, #3b82f6)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)', opacity: importingAll ? 0.6 : 1 }}>
                  {importingAll ? <Loader2 size={11} className="animate-spin" /> : <ArrowDownCircle size={11} />}
                  Import All
                </button>
              )}
              <button className="p-1 text-app-muted-foreground hover:text-app-foreground transition-colors">
                <ChevronRight size={14} className={`transition-transform duration-200 ${templateCollapsed ? '' : 'rotate-90'}`} />
              </button>
            </div>
          </div>
          {!templateCollapsed && (
            <div className="px-4 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                {templateData.presets.map(preset => (
                  <PresetCard key={preset.name} preset={preset} onImport={handleImportPreset} importing={importingPreset === preset.name} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ Table ═══════ */}
      <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
          <div className="w-7 flex-shrink-0" />
          <div className="flex-1 min-w-0">Rule</div>
          <div className="hidden sm:block w-20 flex-shrink-0">Rate</div>
          <div className="hidden md:block w-16 flex-shrink-0 text-center">Order</div>
          <div className="hidden md:block w-20 flex-shrink-0">Status</div>
          <div className="w-16 flex-shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
          ) : filtered.length > 0 ? (
            filtered.map(item => <RuleRow key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => handleDelete(item.id)} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <ListChecks size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No custom tax rules</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">
                {searchQuery ? 'Try a different search.' : templateData?.presets?.some(p => !p.already_imported) ? 'Import templates from above to get started.' : 'Create bespoke taxes like Eco Tax, Tourism Levy, etc.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
