'use client'
/**
 * Import Declarations — Management Page
 * =======================================
 * Dajingo Pro V2 Design Language
 * Tracks customs duties, import VAT, and landed cost for international purchases.
 * Moved from finance/tax-engine to procurement as a cross-cutting business event.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Loader2, X, Maximize2, Minimize2,
  Ship, DollarSign, Calculator, Globe, Package,
  ArrowLeft, Save, Edit2, Trash2, FileCheck
} from 'lucide-react'

type Decl = Record<string, any>

const IMPORT_STATUSES = ['DRAFT','ASSESSED','PAID','CLEARED','CANCELLED']
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: 'color-mix(in srgb, var(--app-border) 30%, transparent)', fg: 'var(--app-muted-foreground)' },
  ASSESSED: { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', fg: 'var(--app-info, #3b82f6)' },
  PAID: { bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', fg: 'var(--app-warning, #f59e0b)' },
  CLEARED: { bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', fg: 'var(--app-success, #22c55e)' },
  CANCELLED: { bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', fg: 'var(--app-error, #ef4444)' },
}

const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

function DeclRow({ item, onEdit, onDelete }: { item: Decl; onEdit: () => void; onDelete: () => void }) {
  const sc = STATUS_COLORS[item.status] || STATUS_COLORS.DRAFT
  const cif = parseFloat(item.cif_value || 0)
  const landed = parseFloat(item.total_landed_cost || 0)
  return (
    <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3"
      onClick={onEdit}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: sc.bg, color: sc.fg }}>
        <Ship size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="truncate text-[13px] font-bold text-app-foreground block">
          {item.declaration_number || `Import #${item.id}`}
        </span>
        <span className="text-[10px] font-bold text-app-muted-foreground">
          {item.origin_country} → {item.destination_country} {item.po_number ? `· PO ${item.po_number}` : ''}
        </span>
      </div>
      <div className="hidden sm:block w-28 flex-shrink-0 text-right">
        <div className="font-mono text-[11px] font-bold text-app-muted-foreground">CIF {cif.toLocaleString()}</div>
        <div className="font-mono text-[13px] font-black text-app-foreground tabular-nums">{landed.toLocaleString()}</div>
      </div>
      <div className="hidden md:block w-24 flex-shrink-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: sc.bg, color: sc.fg }}>
          {item.status}
        </span>
      </div>
      <div className="hidden lg:block w-24 flex-shrink-0 text-[10px] font-bold text-app-muted-foreground">
        {item.declaration_date || '—'}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
          <Edit2 size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-red-500 transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function DeclEditor({ item, onSave, onCancel }: { item: Decl | null; onSave: (data: Decl) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Decl>(item || {
    declaration_number: '', origin_country: '', destination_country: '',
    fob_value: 0, freight_cost: 0, insurance_cost: 0, currency_code: 'USD',
    customs_duty_rate: 0, customs_duty_amount: 0, customs_duty_treatment: 'CAPITALIZE',
    import_vat_rate: 0, import_vat_amount: 0, import_vat_base: 'CIF_PLUS_DUTY',
    import_vat_recoverable: true, other_charges: [], status: 'DRAFT', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const cifValue = parseFloat(form.fob_value || 0) + parseFloat(form.freight_cost || 0) + parseFloat(form.insurance_cost || 0)
  const dutyAmount = cifValue * parseFloat(form.customs_duty_rate || 0)
  const vatBase = form.import_vat_base === 'CIF_PLUS_DUTY' ? cifValue + dutyAmount : cifValue
  const vatAmount = vatBase * parseFloat(form.import_vat_rate || 0)
  const landedCost = cifValue + (form.customs_duty_treatment === 'CAPITALIZE' ? dutyAmount : 0) + (form.import_vat_recoverable ? 0 : vatAmount)

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
          <ArrowLeft size={13} /> Back
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="page-header-icon bg-app-primary"
            style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
            <Ship size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-app-foreground tracking-tight truncate">
              {item ? 'Edit Import Declaration' : 'New Import Declaration'}
            </h1>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
              Procurement · Customs & Import VAT
            </p>
          </div>
        </div>
        <button onClick={async () => { setSaving(true); await onSave({ ...form, customs_duty_amount: dutyAmount, import_vat_amount: vatAmount }); setSaving(false) }} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
        {/* Live Cost Summary */}
        <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 6%, transparent), color-mix(in srgb, var(--app-surface) 80%, transparent))', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">LIVE COST CALCULATOR</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            {[
              { label: 'CIF Value', value: cifValue, color: 'var(--app-info, #3b82f6)' },
              { label: 'Duty', value: dutyAmount, color: 'var(--app-warning, #f59e0b)' },
              { label: 'Import VAT', value: vatAmount, color: form.import_vat_recoverable ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' },
              { label: 'Landed Cost', value: landedCost, color: 'var(--app-primary)' },
            ].map(c => (
              <div key={c.label} className="text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{c.label}</div>
                <div className="text-lg font-black tabular-nums" style={{ color: c.color }}>{c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>
          {form.import_vat_recoverable && <p className="text-[10px] font-bold mt-2" style={{ color: 'var(--app-success, #22c55e)' }}>✓ Import VAT ({vatAmount.toLocaleString()}) is recoverable — excluded from landed cost</p>}
        </div>

        {/* Form Fields */}
        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">DECLARATION DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label className={labelCls}>Declaration #</label><input className={inputCls} value={form.declaration_number} onChange={e => upd('declaration_number', e.target.value)} placeholder="DAU-2026-001" /></div>
            <div><label className={labelCls}>Origin Country</label><input className={inputCls} value={form.origin_country} onChange={e => upd('origin_country', e.target.value)} placeholder="CN" maxLength={3} /></div>
            <div><label className={labelCls}>Destination</label><input className={inputCls} value={form.destination_country} onChange={e => upd('destination_country', e.target.value)} placeholder="CI" maxLength={3} /></div>
            <div><label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => upd('status', e.target.value)}>
                {IMPORT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Currency</label><input className={inputCls} value={form.currency_code} onChange={e => upd('currency_code', e.target.value)} maxLength={3} /></div>
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">CIF COMPONENTS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label className={labelCls}>FOB Value</label><input className={inputCls} type="number" min={0} step={0.01} value={form.fob_value} onChange={e => upd('fob_value', e.target.value)} /></div>
            <div><label className={labelCls}>Freight Cost</label><input className={inputCls} type="number" min={0} step={0.01} value={form.freight_cost} onChange={e => upd('freight_cost', e.target.value)} /></div>
            <div><label className={labelCls}>Insurance Cost</label><input className={inputCls} type="number" min={0} step={0.01} value={form.insurance_cost} onChange={e => upd('insurance_cost', e.target.value)} /></div>
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">DUTIES & TAXES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label className={labelCls}>Customs Duty Rate</label><input className={inputCls} type="number" min={0} max={1} step={0.0001} value={form.customs_duty_rate} onChange={e => upd('customs_duty_rate', e.target.value)} /><p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Decimal (0.20 = 20%)</p></div>
            <div><label className={labelCls}>Duty Treatment</label>
              <select className={inputCls} value={form.customs_duty_treatment} onChange={e => upd('customs_duty_treatment', e.target.value)}>
                <option value="CAPITALIZE">Capitalize into cost</option>
                <option value="EXPENSE">Expense to P&L</option>
              </select>
            </div>
            <div><label className={labelCls}>Import VAT Rate</label><input className={inputCls} type="number" min={0} max={1} step={0.0001} value={form.import_vat_rate} onChange={e => upd('import_vat_rate', e.target.value)} /></div>
            <div><label className={labelCls}>VAT Base</label>
              <select className={inputCls} value={form.import_vat_base} onChange={e => upd('import_vat_base', e.target.value)}>
                <option value="CIF_PLUS_DUTY">CIF + Duty</option>
                <option value="CIF">CIF only</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>VAT Recoverable</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input type="checkbox" checked={form.import_vat_recoverable} onChange={e => upd('import_vat_recoverable', e.target.checked)} className="rounded" />
                <span className="text-[12px] font-bold text-app-foreground">Import VAT is recoverable</span>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">NOTES</div>
          <textarea className={inputCls} rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Additional notes..." />
        </div>
      </div>
    </div>
  )
}

export default function ImportDeclarationsPage() {
  const [items, setItems] = useState<Decl[]>([])
  const [dashboard, setDashboard] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [editing, setEditing] = useState<Decl | null | 'new'>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'q') { e.preventDefault(); setFocusMode(p => !p) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  async function load() {
    try {
      setLoading(true)
      const [d, s] = await Promise.all([
        erpFetch('finance/import-declarations/'),
        erpFetch('finance/import-declarations/dashboard/'),
      ])
      setItems(Array.isArray(d) ? d : d?.results || [])
      setDashboard(s || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSave(data: Decl) {
    try {
      if (data.id) {
        await erpFetch(`finance/import-declarations/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
      } else {
        await erpFetch('finance/import-declarations/', { method: 'POST', body: JSON.stringify(data) })
      }
      setEditing(null); load()
    } catch (e) { console.error(e); alert('Save failed') }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this import declaration?')) return
    try { await erpFetch(`finance/import-declarations/${id}/`, { method: 'DELETE' }); load() }
    catch (e) { console.error(e) }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(i =>
      i.declaration_number?.toLowerCase().includes(q) ||
      i.origin_country?.toLowerCase().includes(q) ||
      i.destination_country?.toLowerCase().includes(q) ||
      i.status?.toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  const kpis = [
    { label: 'Declarations', value: dashboard.total_declarations ?? items.length, icon: <Ship size={11} />, color: 'var(--app-primary)' },
    { label: 'Cleared', value: dashboard.cleared ?? 0, icon: <FileCheck size={11} />, color: 'var(--app-success, #22c55e)' },
    { label: 'Total Duties', value: (dashboard.total_duties ?? 0).toLocaleString(), icon: <DollarSign size={11} />, color: 'var(--app-warning, #f59e0b)' },
    { label: 'Import VAT', value: (dashboard.total_import_vat ?? 0).toLocaleString(), icon: <Calculator size={11} />, color: 'var(--app-info, #3b82f6)' },
  ]

  if (editing) {
    return <DeclEditor item={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
  }

  return (
    <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
        {!focusMode && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <Ship size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Import Declarations</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                    Procurement · Customs · Duties · Import VAT · Landed Cost
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setEditing('new')}
                  className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
                  style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /> New Declaration
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><Ship size={14} style={{ color: '#fff' }} /></div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Imports</span>
            </div>
          )}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search declarations... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
          </div>
          {focusMode && <>
            <button onClick={() => setEditing('new')} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg"><Plus size={12} /></button>
            <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all"><Minimize2 size={13} /></button>
          </>}
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0" style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)' }}><X size={13} /></button>}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
          <div className="w-7 flex-shrink-0" />
          <div className="flex-1 min-w-0">Declaration</div>
          <div className="hidden sm:block w-28 flex-shrink-0 text-right">CIF / Landed</div>
          <div className="hidden md:block w-24 flex-shrink-0">Status</div>
          <div className="hidden lg:block w-24 flex-shrink-0">Date</div>
          <div className="w-16 flex-shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
          ) : filtered.length > 0 ? (
            filtered.map(item => <DeclRow key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => handleDelete(item.id)} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Ship size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No import declarations</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">{searchQuery ? 'Try a different search.' : 'Create your first import declaration for customs tracking.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
