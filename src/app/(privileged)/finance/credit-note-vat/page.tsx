'use client'
/**
 * Credit Note VAT Reversals — Management Page
 * =============================================
 * Dajingo Pro V2 Design Language
 * Tracks VAT adjustments when credit notes reverse original invoices.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Loader2, X, Maximize2, Minimize2,
  ArrowLeft, Save, Edit2, Trash2,
  RotateCcw, DollarSign, ArrowDownRight, ArrowUpRight, Clock
} from 'lucide-react'

type Rev = Record<string, any>

const REVERSAL_TYPES = ['FULL','PARTIAL','CORRECTION','DISCOUNT']
const TYPE_LABELS: Record<string, string> = {
  FULL: 'Full Credit', PARTIAL: 'Partial Credit',
  CORRECTION: 'Error Correction', DISCOUNT: 'Post-sale Discount',
}
const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  FULL: { bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', fg: 'var(--app-error, #ef4444)' },
  PARTIAL: { bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', fg: 'var(--app-warning, #f59e0b)' },
  CORRECTION: { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', fg: 'var(--app-info, #3b82f6)' },
  DISCOUNT: { bg: 'color-mix(in srgb, var(--app-accent) 10%, transparent)', fg: 'var(--app-accent)' },
}

const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

function RevRow({ item, onEdit, onDelete }: { item: Rev; onEdit: () => void; onDelete: () => void }) {
  const tc = TYPE_COLORS[item.reversal_type] || TYPE_COLORS.FULL
  return (
    <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3" onClick={onEdit}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: tc.bg, color: tc.fg }}>
        <RotateCcw size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="truncate text-[13px] font-bold text-app-foreground block">
          {TYPE_LABELS[item.reversal_type] || item.reversal_type}
        </span>
        <span className="text-[10px] font-bold text-app-muted-foreground">
          Invoice: {item.original_invoice_number || `#${item.original_invoice || '—'}`}
          {item.vat_return_period ? ` · Period: ${item.vat_return_period}` : ''}
        </span>
      </div>
      <div className="hidden sm:block w-28 flex-shrink-0 text-right">
        <div className="text-[10px] font-bold text-app-muted-foreground">Original VAT</div>
        <div className="font-mono text-[12px] font-bold text-app-muted-foreground tabular-nums line-through">
          {parseFloat(item.original_vat_amount || 0).toLocaleString()}
        </div>
      </div>
      <div className="hidden md:block w-28 flex-shrink-0 text-right">
        <div className="text-[10px] font-bold text-app-muted-foreground">Reversed</div>
        <div className="font-mono text-[13px] font-black tabular-nums" style={{ color: tc.fg }}>
          -{parseFloat(item.reversed_vat_amount || 0).toLocaleString()}
        </div>
      </div>
      <div className="hidden lg:block w-24 flex-shrink-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-1 w-fit"
          style={{ background: item.is_output_adjustment ? 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)' : 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: item.is_output_adjustment ? 'var(--app-error, #ef4444)' : 'var(--app-info, #3b82f6)' }}>
          {item.is_output_adjustment ? <><ArrowDownRight size={9} /> Output</> : <><ArrowUpRight size={9} /> Input</>}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onEdit() }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors"><Edit2 size={12} /></button>
        <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-error transition-colors"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

function RevEditor({ item, onSave, onCancel }: { item: Rev | null; onSave: (d: Rev) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Rev>(item || {
    reversal_type: 'PARTIAL', original_vat_amount: 0, reversed_vat_amount: 0,
    credit_amount_ht: 0, vat_rate: 0.18, currency_code: 'XOF',
    is_output_adjustment: true, vat_return_period: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const reversedCalc = parseFloat(form.credit_amount_ht || 0) * parseFloat(form.vat_rate || 0)

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
          <ArrowLeft size={13} /> Back
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
            <RotateCcw size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate">
              {item ? 'Edit VAT Reversal' : 'New VAT Reversal'}
            </h1>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Credit Note Adjustment</p>
          </div>
        </div>
        <button onClick={async () => { setSaving(true); await onSave({ ...form, reversed_vat_amount: reversedCalc }); setSaving(false) }} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
        <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-error, #ef4444) 6%, transparent), color-mix(in srgb, var(--app-surface) 80%, transparent))', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">REVERSAL IMPACT</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Original VAT', value: parseFloat(form.original_vat_amount || 0), color: 'var(--app-muted-foreground)' },
              { label: 'Credit HT', value: parseFloat(form.credit_amount_ht || 0), color: 'var(--app-info, #3b82f6)' },
              { label: 'Reversed VAT', value: reversedCalc, color: 'var(--app-error, #ef4444)' },
            ].map(c => (
              <div key={c.label} className="text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{c.label}</div>
                <div className="text-lg font-black tabular-nums" style={{ color: c.color }}>{c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">REVERSAL DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label className={labelCls}>Reversal Type</label>
              <select className={inputCls} value={form.reversal_type} onChange={e => upd('reversal_type', e.target.value)}>
                {REVERSAL_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Original VAT Amount</label><input className={inputCls} type="number" min={0} step={0.01} value={form.original_vat_amount} onChange={e => upd('original_vat_amount', e.target.value)} /></div>
            <div><label className={labelCls}>Credit Amount HT</label><input className={inputCls} type="number" min={0} step={0.01} value={form.credit_amount_ht} onChange={e => upd('credit_amount_ht', e.target.value)} /></div>
            <div><label className={labelCls}>VAT Rate</label><input className={inputCls} type="number" min={0} max={1} step={0.0001} value={form.vat_rate} onChange={e => upd('vat_rate', e.target.value)} /></div>
            <div><label className={labelCls}>Currency</label><input className={inputCls} value={form.currency_code} onChange={e => upd('currency_code', e.target.value)} maxLength={3} /></div>
            <div><label className={labelCls}>VAT Return Period</label><input className={inputCls} value={form.vat_return_period} onChange={e => upd('vat_return_period', e.target.value)} placeholder="2026-Q1" /></div>
            <div>
              <label className={labelCls}>Adjustment Side</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input type="checkbox" checked={form.is_output_adjustment} onChange={e => upd('is_output_adjustment', e.target.checked)} className="rounded" />
                <span className="text-[12px] font-bold text-app-foreground">
                  {form.is_output_adjustment ? 'Output VAT (seller side)' : 'Input VAT (buyer side)'}
                </span>
              </label>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">NOTES</div>
          <textarea className={inputCls} rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Reason for credit note..." />
        </div>
      </div>
    </div>
  )
}

export default function CreditNoteVATReversalPage() {
  const [items, setItems] = useState<Rev[]>([])
  const [dashboard, setDashboard] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [editing, setEditing] = useState<Rev | null | 'new'>(null)
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
        erpFetch('finance/credit-note-vat/'),
        erpFetch('finance/credit-note-vat/dashboard/'),
      ])
      setItems(Array.isArray(d) ? d : d?.results || [])
      setDashboard(s || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSave(data: Rev) {
    try {
      if (data.id) {
        await erpFetch(`finance/credit-note-vat/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
      } else {
        await erpFetch('finance/credit-note-vat/', { method: 'POST', body: JSON.stringify(data) })
      }
      setEditing(null); load()
    } catch (e) { console.error(e); alert('Save failed') }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this VAT reversal?')) return
    try { await erpFetch(`finance/credit-note-vat/${id}/`, { method: 'DELETE' }); load() }
    catch (e) { console.error(e) }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(i =>
      i.reversal_type?.toLowerCase().includes(q) ||
      i.original_invoice_number?.toLowerCase().includes(q) ||
      i.vat_return_period?.toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  const kpis = [
    { label: 'Total Reversals', value: dashboard.total_reversals ?? items.length, icon: <RotateCcw size={11} />, color: 'var(--app-primary)' },
    { label: 'Output Adj.', value: dashboard.output_adjustments ?? 0, icon: <ArrowDownRight size={11} />, color: 'var(--app-error, #ef4444)' },
    { label: 'Input Adj.', value: dashboard.input_adjustments ?? 0, icon: <ArrowUpRight size={11} />, color: 'var(--app-info, #3b82f6)' },
    { label: 'VAT Reversed', value: (dashboard.total_reversed_vat ?? 0).toLocaleString(), icon: <DollarSign size={11} />, color: 'var(--app-warning, #f59e0b)' },
  ]

  if (editing) {
    return <RevEditor item={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
  }

  return (
    <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
        {!focusMode && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <RotateCcw size={20} className="text-white" />
                </div>
                <div>
                  <h1>Credit Note VAT Reversals</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">VAT Adjustment · Refunds & Credits</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all" style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /> New Reversal
                </button>
                <button onClick={() => setFocusMode(true)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"><Maximize2 size={13} /></button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {kpis.map(s => (
                <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div>
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><RotateCcw size={14} style={{ color: '#fff' }} /></div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Reversals</span>
            </div>
          )}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search reversals... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
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
          <div className="flex-1 min-w-0">Type / Invoice</div>
          <div className="hidden sm:block w-28 flex-shrink-0 text-right">Original VAT</div>
          <div className="hidden md:block w-28 flex-shrink-0 text-right">Reversed</div>
          <div className="hidden lg:block w-24 flex-shrink-0">Side</div>
          <div className="w-16 flex-shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
          ) : filtered.length > 0 ? (
            filtered.map(item => <RevRow key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => handleDelete(item.id)} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <RotateCcw size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No VAT reversals</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">Record VAT adjustments from credit notes and refunds.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
