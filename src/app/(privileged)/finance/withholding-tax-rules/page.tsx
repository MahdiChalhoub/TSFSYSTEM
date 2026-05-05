'use client'
/**
 * Withholding Tax Rules — Management Page
 * ========================================
 * Dajingo Pro V2 Design Language
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Loader2, X, Maximize2, Minimize2,
  Shield, Percent, Calendar, FileCheck, Edit2, Trash2,
  Save, ArrowLeft, Globe
} from 'lucide-react'

type WHT = Record<string, any>

const TAX_TYPES = ['INCOME','VAT','PROFESSIONAL','SERVICES','GOODS','FOREIGN','CUSTOM']
const APPLIES_TO = ['PURCHASES','SALES','BOTH']
const STATUSES = ['ACTIVE','SUSPENDED','EXPIRED']

const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const selectCls = inputCls
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

function RuleRow({ item, onEdit, onDelete }: { item: WHT; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3"
      onClick={onEdit}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: item.status === 'ACTIVE'
            ? 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)'
            : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
          color: item.status === 'ACTIVE' ? 'var(--app-success, #22c55e)' : 'var(--app-muted-foreground)',
        }}>
        <Shield size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="truncate text-[13px] font-bold text-app-foreground block">{item.name}</span>
        <span className="text-[10px] font-bold text-app-muted-foreground">{item.tax_type} · {item.applies_to}</span>
      </div>
      <div className="hidden sm:block w-20 flex-shrink-0">
        <span className="font-mono text-[13px] font-black text-app-foreground tabular-nums">
          {((item.rate || 0) * 100).toFixed(1)}%
        </span>
      </div>
      <div className="hidden md:block w-24 flex-shrink-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg"
          style={{
            background: item.status === 'ACTIVE'
              ? 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)'
              : 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
            color: item.status === 'ACTIVE' ? 'var(--app-success, #22c55e)' : 'var(--app-warning, #f59e0b)',
          }}>{item.status}</span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onEdit() }}
          className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors">
          <Edit2 size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function RuleEditor({ item, onSave, onCancel }: { item: WHT | null; onSave: (data: WHT) => void; onCancel: () => void }) {
  const [form, setForm] = useState<WHT>(item || {
    name: '', tax_type: 'INCOME', applies_to: 'PURCHASES', rate: 0,
    threshold_amount: 0, certificate_required: true, auto_generate_certificate: false,
    status: 'ACTIVE', country_code: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

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
            <Shield size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate">
              {item ? 'Edit Withholding Rule' : 'New Withholding Rule'}
            </h1>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
              Tax Engine · Withholding
            </p>
          </div>
        </div>
        <button onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl p-4"
        style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div>
            <label className={labelCls}>Rule Name</label>
            <input className={inputCls} value={form.name} onChange={e => upd('name', e.target.value)} placeholder="e.g. Lebanon Services WHT 7.5%" />
          </div>
          <div>
            <label className={labelCls}>Tax Type</label>
            <select className={selectCls} value={form.tax_type} onChange={e => upd('tax_type', e.target.value)}>
              {TAX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Applies To</label>
            <select className={selectCls} value={form.applies_to} onChange={e => upd('applies_to', e.target.value)}>
              {APPLIES_TO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Rate</label>
            <input className={inputCls} type="number" step="0.0001" min="0" max="1" value={form.rate} onChange={e => upd('rate', e.target.value)} />
            <p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Decimal (0.075 = 7.5%)</p>
          </div>
          <div>
            <label className={labelCls}>Threshold Amount</label>
            <input className={inputCls} type="number" min="0" value={form.threshold_amount} onChange={e => upd('threshold_amount', e.target.value)} />
            <p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Min invoice amount (0 = always)</p>
          </div>
          <div>
            <label className={labelCls}>Country Code</label>
            <input className={inputCls} value={form.country_code} onChange={e => upd('country_code', e.target.value)} placeholder="e.g. LB, CI, SA" maxLength={3} />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={selectCls} value={form.status} onChange={e => upd('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Certificate Required</label>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input type="checkbox" checked={form.certificate_required} onChange={e => upd('certificate_required', e.target.checked)} className="rounded" />
              <span className="text-[12px] font-bold text-app-foreground">Counterparty must provide WHT certificate</span>
            </label>
          </div>
          <div className="col-span-full">
            <label className={labelCls}>Notes</label>
            <textarea className={inputCls} rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Additional notes..." />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WithholdingTaxRulesPage() {
  const [items, setItems] = useState<WHT[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [editing, setEditing] = useState<WHT | null | 'new'>(null)
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
    try { setLoading(true); const d = await erpFetch('finance/withholding-tax-rules/'); setItems(Array.isArray(d) ? d : d?.results || []) }
    catch (e) { console.error(e) } finally { setLoading(false) }
  }

  async function handleSave(data: WHT) {
    try {
      if (data.id) {
        await erpFetch(`finance/withholding-tax-rules/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
      } else {
        await erpFetch('finance/withholding-tax-rules/', { method: 'POST', body: JSON.stringify(data) })
      }
      setEditing(null); load()
    } catch (e) { console.error(e); alert('Save failed') }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this withholding rule?')) return
    try { await erpFetch(`finance/withholding-tax-rules/${id}/`, { method: 'DELETE' }); load() }
    catch (e) { console.error(e) }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(i => i.name?.toLowerCase().includes(q) || i.tax_type?.toLowerCase().includes(q) || i.country_code?.toLowerCase().includes(q))
  }, [items, searchQuery])

  const kpis = [
    { label: 'Rules', value: items.length, icon: <Shield size={11} />, color: 'var(--app-primary)' },
    { label: 'Active', value: items.filter(i => i.status === 'ACTIVE').length, icon: <FileCheck size={11} />, color: 'var(--app-success, #22c55e)' },
    { label: 'Countries', value: new Set(items.map(i => i.country_code).filter(Boolean)).size, icon: <Globe size={11} />, color: 'var(--app-info, #3b82f6)' },
    { label: 'Avg Rate', value: items.length ? ((items.reduce((s, i) => s + parseFloat(i.rate || '0'), 0) / items.length) * 100).toFixed(1) + '%' : '—', icon: <Percent size={11} />, color: 'var(--app-accent)' },
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
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <h1>Withholding Tax Rules</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                    {items.length} Rules · WHT Engine
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><Shield size={14} style={{ color: '#fff' }} /></div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">WHT Rules</span>
            </div>
          )}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search rules... (Ctrl+K)" className={`w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all`} />
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
          <div className="flex-1 min-w-0">Rule</div>
          <div className="hidden sm:block w-20 flex-shrink-0">Rate</div>
          <div className="hidden md:block w-24 flex-shrink-0">Status</div>
          <div className="w-16 flex-shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
          ) : filtered.length > 0 ? (
            filtered.map(item => <RuleRow key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => handleDelete(item.id)} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Shield size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No withholding rules found</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">{searchQuery ? 'Try a different search.' : 'Create your first withholding tax rule.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
