'use client'
/**
 * Margin Scheme — Management Page
 * ================================
 * VAT on Margin (Régime de la marge)
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Loader2, X, Maximize2, Minimize2,
  ArrowLeft, Save, TrendingUp, DollarSign, CheckCircle2, Clock
} from 'lucide-react'

type Rec = Record<string, any>
const SCHEMES = ['SECOND_HAND','ART_ANTIQUE','TRAVEL','REAL_ESTATE','VEHICLE','OTHER']
const SCHEME_LABELS: Record<string, string> = { SECOND_HAND:'Second-Hand', ART_ANTIQUE:'Art & Antiques', TRAVEL:'Travel', REAL_ESTATE:'Real Estate', VEHICLE:'Used Vehicles', OTHER:'Other' }
const STATUSES = ['DRAFT','CALCULATED','DECLARED','CANCELLED']
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', fg: 'var(--app-warning, #f59e0b)' },
  CALCULATED: { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', fg: 'var(--app-info, #3b82f6)' },
  DECLARED: { bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', fg: 'var(--app-success, #22c55e)' },
  CANCELLED: { bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', fg: 'var(--app-error, #ef4444)' },
}
const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

function Editor({ item, onSave, onCancel }: { item: Rec | null; onSave: (d: Rec) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Rec>(item || { transaction_date: new Date().toISOString().split('T')[0], scheme_type: 'SECOND_HAND', reference: '', description: '', purchase_price_ht: 0, sale_price_ht: 0, vat_rate: 0.18, currency_code: 'XOF', status: 'DRAFT', notes: '' })
  const [saving, setSaving] = useState(false)
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const margin = Math.max(parseFloat(form.sale_price_ht || 0) - parseFloat(form.purchase_price_ht || 0), 0)
  const vatOnMargin = margin * parseFloat(form.vat_rate || 0)
  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all"><ArrowLeft size={13} /> Back</button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}><TrendingUp size={20} className="text-white" /></div>
          <div className="min-w-0"><h1 className="text-lg font-black text-app-foreground tracking-tight truncate">{item ? 'Edit Margin Scheme' : 'New Margin Scheme'}</h1><p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">VAT on Profit Margin</p></div>
        </div>
        <button onClick={async () => { setSaving(true); await onSave(form); setSaving(false) }} disabled={saving} className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all" style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save</button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
        <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 6%, transparent), color-mix(in srgb, var(--app-surface) 80%, transparent))', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">MARGIN CALCULATION</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px' }}>
            {[{ label: 'Purchase HT', value: parseFloat(form.purchase_price_ht || 0), color: 'var(--app-muted-foreground)' }, { label: 'Sale HT', value: parseFloat(form.sale_price_ht || 0), color: 'var(--app-info, #3b82f6)' }, { label: 'Margin', value: margin, color: margin > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }, { label: 'VAT on Margin', value: vatOnMargin, color: 'var(--app-warning, #f59e0b)' }].map(c => (
              <div key={c.label} className="text-center"><div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{c.label}</div><div className="text-lg font-black tabular-nums" style={{ color: c.color }}>{c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div></div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label className={labelCls}>Date</label><input className={inputCls} type="date" value={form.transaction_date} onChange={e => upd('transaction_date', e.target.value)} /></div>
            <div><label className={labelCls}>Scheme Type</label><select className={inputCls} value={form.scheme_type} onChange={e => upd('scheme_type', e.target.value)}>{SCHEMES.map(s => <option key={s} value={s}>{SCHEME_LABELS[s]}</option>)}</select></div>
            <div><label className={labelCls}>Purchase Price HT</label><input className={inputCls} type="number" min={0} step={0.01} value={form.purchase_price_ht} onChange={e => upd('purchase_price_ht', e.target.value)} /></div>
            <div><label className={labelCls}>Sale Price HT</label><input className={inputCls} type="number" min={0} step={0.01} value={form.sale_price_ht} onChange={e => upd('sale_price_ht', e.target.value)} /></div>
            <div><label className={labelCls}>VAT Rate</label><input className={inputCls} type="number" min={0} max={1} step={0.0001} value={form.vat_rate} onChange={e => upd('vat_rate', e.target.value)} /></div>
            <div><label className={labelCls}>Reference</label><input className={inputCls} value={form.reference} onChange={e => upd('reference', e.target.value)} placeholder="Invoice ref" /></div>
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

export default function MarginSchemePage() {
  const [items, setItems] = useState<Rec[]>([]); const [dashboard, setDashboard] = useState<Record<string, any>>({}); const [loading, setLoading] = useState(true); const [searchQuery, setSearchQuery] = useState(''); const [focusMode, setFocusMode] = useState(false); const [editing, setEditing] = useState<Rec | null | 'new'>(null); const searchRef = useRef<HTMLInputElement>(null)
  useEffect(() => { load() }, [])
  async function load() { try { setLoading(true); const [d, s] = await Promise.all([erpFetch('finance/margin-scheme/'), erpFetch('finance/margin-scheme/dashboard/')]); setItems(Array.isArray(d) ? d : d?.results || []); setDashboard(s || {}) } catch (e) { console.error(e) } finally { setLoading(false) } }
  async function handleSave(data: Rec) { try { if (data.id) { await erpFetch(`finance/margin-scheme/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) }) } else { await erpFetch('finance/margin-scheme/', { method: 'POST', body: JSON.stringify(data) }) }; setEditing(null); load() } catch (e) { console.error(e); alert('Save failed') } }
  const filtered = useMemo(() => { if (!searchQuery.trim()) return items; const q = searchQuery.toLowerCase(); return items.filter(i => i.scheme_type?.toLowerCase().includes(q) || i.reference?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)) }, [items, searchQuery])
  const kpis = [{ label: 'Transactions', value: dashboard.total_transactions ?? items.length, icon: <TrendingUp size={11} />, color: 'var(--app-primary)' }, { label: 'Draft', value: dashboard.draft ?? 0, icon: <Clock size={11} />, color: 'var(--app-warning, #f59e0b)' }, { label: 'Total Margin', value: (dashboard.total_margin ?? 0).toLocaleString(), icon: <CheckCircle2 size={11} />, color: 'var(--app-success, #22c55e)' }, { label: 'VAT on Margin', value: (dashboard.total_vat_on_margin ?? 0).toLocaleString(), icon: <DollarSign size={11} />, color: 'var(--app-error, #ef4444)' }]
  if (editing) return <Editor item={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300"><div className={`flex-shrink-0 space-y-4 ${focusMode ? 'pb-2' : 'pb-4'}`}>
      {!focusMode && (<><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div className="flex items-center gap-3"><div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}><TrendingUp size={20} className="text-white" /></div><div><h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Margin Scheme</h1><p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">VAT on Profit Margin · Régime de la Marge</p></div></div><div className="flex items-center gap-1.5 flex-shrink-0"><button onClick={() => setEditing('new')} className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all" style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}><Plus size={14} /> New</button><button onClick={() => setFocusMode(true)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"><Maximize2 size={13} /></button></div></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>{kpis.map(s => (<div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div><div className="text-sm font-black text-app-foreground tabular-nums truncate">{s.value}</div></div></div>))}</div>
      </>)}
      <div className="flex items-center gap-2">
        {focusMode && <div className="flex items-center gap-2 flex-shrink-0"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><TrendingUp size={14} style={{ color: '#fff' }} /></div><span className="text-[12px] font-black text-app-foreground hidden sm:inline">Margin</span></div>}
        <div className="flex-1 relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" /><input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search..." className="w-full pl-9 pr-3 py-2 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" /></div>
        {focusMode && <><button onClick={() => setEditing('new')} className="flex items-center gap-1 text-[10px] font-bold bg-app-primary text-white px-2 py-1.5 rounded-lg"><Plus size={12} /></button><button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all"><Minimize2 size={13} /></button></>}
        {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[11px] font-bold px-2 py-2 rounded-xl border" style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)' }}><X size={13} /></button>}
      </div>
    </div>
    <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
      <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider"><div className="w-7 flex-shrink-0" /><div className="flex-1 min-w-0">Scheme / Ref</div><div className="hidden sm:block w-24 flex-shrink-0 text-right">Purchase</div><div className="hidden md:block w-24 flex-shrink-0 text-right">Sale</div><div className="hidden lg:block w-24 flex-shrink-0 text-right">Margin</div><div className="hidden lg:block w-20 flex-shrink-0">Status</div></div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div> : filtered.length > 0 ? filtered.map(item => {
          const sc = STATUS_COLORS[item.status] || STATUS_COLORS.DRAFT; const m = Math.max(parseFloat(item.sale_price_ht || 0) - parseFloat(item.purchase_price_ht || 0), 0)
          return <div key={item.id} className="group flex items-center gap-2 md:gap-3 transition-all cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3" onClick={() => setEditing(item)}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: sc.bg, color: sc.fg }}><TrendingUp size={13} /></div>
            <div className="flex-1 min-w-0"><span className="truncate text-[13px] font-bold text-app-foreground block">{SCHEME_LABELS[item.scheme_type] || item.scheme_type}</span><span className="text-[10px] font-bold text-app-muted-foreground">{item.reference || `#${item.id}`} · {item.transaction_date}</span></div>
            <div className="hidden sm:block w-24 flex-shrink-0 text-right font-mono text-[13px] font-black text-app-foreground tabular-nums">{parseFloat(item.purchase_price_ht || 0).toLocaleString()}</div>
            <div className="hidden md:block w-24 flex-shrink-0 text-right font-mono text-[13px] font-black text-app-foreground tabular-nums">{parseFloat(item.sale_price_ht || 0).toLocaleString()}</div>
            <div className="hidden lg:block w-24 flex-shrink-0 text-right font-mono text-[13px] font-black tabular-nums" style={{ color: m > 0 ? 'var(--app-success, #22c55e)' : 'var(--app-error, #ef4444)' }}>{m.toLocaleString()}</div>
            <div className="hidden lg:block w-20 flex-shrink-0"><span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: sc.bg, color: sc.fg }}>{item.status}</span></div>
          </div>
        }) : <div className="flex flex-col items-center justify-center py-20 px-4 text-center"><TrendingUp size={36} className="text-app-muted-foreground mb-3 opacity-40" /><p className="text-sm font-bold text-app-muted-foreground">No margin scheme transactions</p></div>}
      </div>
    </div></div>
  )
}
