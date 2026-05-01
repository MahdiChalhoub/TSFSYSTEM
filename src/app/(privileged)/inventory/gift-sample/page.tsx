'use client'
/**
 * Gift / Sample Events — Management Page
 * ========================================
 * Dajingo Pro V2 Design Language
 * Tracks gifts, samples, and promotional items (inventory + VAT).
 * Moved from finance/tax-engine to inventory as a cross-cutting business event.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Loader2, X, Maximize2, Minimize2,
  ArrowLeft, Save, Edit2, Trash2,
  Gift, DollarSign, CheckCircle2, Clock, AlertTriangle
} from 'lucide-react'

type Rec = Record<string, any>

const GIFT_TYPES = ['GIFT','SAMPLE','PROMOTIONAL','EMPLOYEE','CHARITY']
const GIFT_LABELS: Record<string, string> = {
  GIFT: 'Business Gift', SAMPLE: 'Product Sample', PROMOTIONAL: 'Promotional',
  EMPLOYEE: 'Employee', CHARITY: 'Charity',
}
const STATUSES = ['BELOW_THRESHOLD','VAT_DUE','DECLARED']
const STATUS_LABELS: Record<string, string> = {
  BELOW_THRESHOLD: 'Below Threshold', VAT_DUE: 'VAT Due', DECLARED: 'Declared',
}
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  BELOW_THRESHOLD: { bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', fg: 'var(--app-success, #22c55e)' },
  VAT_DUE: { bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', fg: 'var(--app-warning, #f59e0b)' },
  DECLARED: { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', fg: 'var(--app-info, #3b82f6)' },
}

const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

function GiftRow({ item, onEdit, onAssess }: { item: Rec; onEdit: () => void; onAssess: () => void }) {
  const sc = STATUS_COLORS[item.status] || STATUS_COLORS.BELOW_THRESHOLD
  const aboveThreshold = parseFloat(item.cumulative_value_ytd || 0) > parseFloat(item.threshold || 0) && parseFloat(item.threshold || 0) > 0
  return (
    <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3" onClick={onEdit}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: sc.bg, color: sc.fg }}>
        <Gift size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="truncate text-[13px] font-bold text-app-foreground block">
          {GIFT_LABELS[item.gift_type] || item.gift_type}
        </span>
        <span className="text-[10px] font-bold text-app-muted-foreground truncate block">
          {item.recipient_display || item.recipient_name || 'Unknown'} · {item.description || `#${item.id}`}
        </span>
      </div>
      <div className="hidden sm:block w-24 flex-shrink-0 text-right">
        <div className="text-[10px] font-bold text-app-muted-foreground">Cost</div>
        <div className="font-mono text-[13px] font-black text-app-foreground tabular-nums">
          {parseFloat(item.cost_value || 0).toLocaleString()}
        </div>
      </div>
      <div className="hidden md:block w-28 flex-shrink-0 text-right">
        <div className="text-[10px] font-bold text-app-muted-foreground">YTD / Threshold</div>
        <div className="font-mono text-[11px] font-bold tabular-nums" style={{ color: aboveThreshold ? 'var(--app-error, #ef4444)' : 'var(--app-muted-foreground)' }}>
          {parseFloat(item.cumulative_value_ytd || 0).toLocaleString()} / {parseFloat(item.threshold || 0).toLocaleString()}
        </div>
      </div>
      <div className="hidden lg:block w-24 flex-shrink-0 text-right">
        <div className="text-[10px] font-bold text-app-muted-foreground">VAT</div>
        <div className="font-mono text-[13px] font-black tabular-nums" style={{ color: parseFloat(item.vat_amount || 0) > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' }}>
          {parseFloat(item.vat_amount || 0).toLocaleString()}
        </div>
      </div>
      <div className="hidden xl:block w-20 flex-shrink-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: sc.bg, color: sc.fg }}>
          {STATUS_LABELS[item.status] || item.status}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status !== 'DECLARED' && (
          <button onClick={e => { e.stopPropagation(); onAssess() }}
            className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-info hover:text-app-info transition-colors" title="Assess VAT">
            <CheckCircle2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function GiftEditor({ item, onSave, onCancel }: { item: Rec | null; onSave: (d: Rec) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Rec>(item || {
    gift_date: new Date().toISOString().split('T')[0], gift_type: 'GIFT',
    description: '', recipient_name: '', cost_value: 0, market_value: 0,
    cumulative_value_ytd: 0, threshold: 0, vat_rate: 0.18, vat_amount: 0,
    currency_code: 'XOF', status: 'BELOW_THRESHOLD', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const cumYtd = parseFloat(form.cumulative_value_ytd || 0)
  const threshold = parseFloat(form.threshold || 0)
  const aboveThreshold = cumYtd > threshold && threshold > 0
  const vatCalc = aboveThreshold ? parseFloat(form.cost_value || 0) * parseFloat(form.vat_rate || 0) : 0

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
          <ArrowLeft size={13} /> Back
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
            <Gift size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-app-foreground tracking-tight truncate">
              {item ? 'Edit Gift/Sample' : 'New Gift/Sample'}
            </h1>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Threshold-Based VAT</p>
          </div>
        </div>
        <button onClick={async () => { setSaving(true); await onSave({ ...form, vat_amount: vatCalc, status: aboveThreshold ? 'VAT_DUE' : 'BELOW_THRESHOLD' }); setSaving(false) }} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
        {/* Threshold Gauge */}
        <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${aboveThreshold ? 'var(--app-error)' : 'var(--app-success)'} 6%, transparent), color-mix(in srgb, var(--app-surface) 80%, transparent))`, border: `1px solid color-mix(in srgb, ${aboveThreshold ? 'var(--app-error)' : 'var(--app-success)'} 15%, transparent)` }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">THRESHOLD CHECK</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Cost', value: parseFloat(form.cost_value || 0), color: 'var(--app-muted-foreground)' },
              { label: 'YTD Total', value: cumYtd, color: aboveThreshold ? 'var(--app-error, #ef4444)' : 'var(--app-info, #3b82f6)' },
              { label: 'Threshold', value: threshold, color: 'var(--app-muted-foreground)' },
              { label: 'VAT Due', value: vatCalc, color: vatCalc > 0 ? 'var(--app-warning, #f59e0b)' : 'var(--app-success, #22c55e)' },
            ].map(c => (
              <div key={c.label} className="text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{c.label}</div>
                <div className="text-lg font-black tabular-nums" style={{ color: c.color }}>{c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 w-full bg-app-border/30 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min((cumYtd / (threshold || 1)) * 100, 100)}%`, background: aboveThreshold ? 'var(--app-error, #ef4444)' : 'var(--app-success, #22c55e)' }} />
          </div>
          <p className="text-[10px] font-bold mt-1" style={{ color: aboveThreshold ? 'var(--app-error, #ef4444)' : 'var(--app-success, #22c55e)' }}>
            {aboveThreshold ? `⚠ Above threshold — VAT of ${vatCalc.toLocaleString()} is due` : '✓ Below threshold — no VAT required'}
          </p>
        </div>
        {/* Fields */}
        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">GIFT DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label className={labelCls}>Gift Date</label><input className={inputCls} type="date" value={form.gift_date} onChange={e => upd('gift_date', e.target.value)} /></div>
            <div><label className={labelCls}>Gift Type</label>
              <select className={inputCls} value={form.gift_type} onChange={e => upd('gift_type', e.target.value)}>
                {GIFT_TYPES.map(t => <option key={t} value={t}>{GIFT_LABELS[t]}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Recipient</label><input className={inputCls} value={form.recipient_name} onChange={e => upd('recipient_name', e.target.value)} placeholder="Contact name" /></div>
            <div><label className={labelCls}>Currency</label><input className={inputCls} value={form.currency_code} onChange={e => upd('currency_code', e.target.value)} maxLength={3} /></div>
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">VALUES & THRESHOLD</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label className={labelCls}>Cost Value</label><input className={inputCls} type="number" min={0} step={0.01} value={form.cost_value} onChange={e => upd('cost_value', e.target.value)} /></div>
            <div><label className={labelCls}>Market Value</label><input className={inputCls} type="number" min={0} step={0.01} value={form.market_value} onChange={e => upd('market_value', e.target.value)} /></div>
            <div><label className={labelCls}>Cumulative YTD</label><input className={inputCls} type="number" min={0} step={0.01} value={form.cumulative_value_ytd} onChange={e => upd('cumulative_value_ytd', e.target.value)} /><p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Total gifts to this recipient this year</p></div>
            <div><label className={labelCls}>Threshold</label><input className={inputCls} type="number" min={0} step={0.01} value={form.threshold} onChange={e => upd('threshold', e.target.value)} /><p className="text-[9px] font-bold text-app-muted-foreground mt-0.5">Country annual gift limit</p></div>
            <div><label className={labelCls}>VAT Rate</label><input className={inputCls} type="number" min={0} max={1} step={0.0001} value={form.vat_rate} onChange={e => upd('vat_rate', e.target.value)} /></div>
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">DESCRIPTION & NOTES</div>
          <div className="space-y-3">
            <div><label className={labelCls}>Description</label><input className={inputCls} value={form.description} onChange={e => upd('description', e.target.value)} placeholder="e.g. 5x Branded polo shirts for client meeting" /></div>
            <div><label className={labelCls}>Notes</label><textarea className={inputCls} rows={3} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Additional notes..." /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function GiftSampleVATPage() {
  const [items, setItems] = useState<Rec[]>([])
  const [dashboard, setDashboard] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [editing, setEditing] = useState<Rec | null | 'new'>(null)
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
        erpFetch('finance/gift-sample-vat/'),
        erpFetch('finance/gift-sample-vat/dashboard/'),
      ])
      setItems(Array.isArray(d) ? d : d?.results || [])
      setDashboard(s || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSave(data: Rec) {
    try {
      if (data.id) {
        await erpFetch(`finance/gift-sample-vat/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
      } else {
        await erpFetch('finance/gift-sample-vat/', { method: 'POST', body: JSON.stringify(data) })
      }
      setEditing(null); load()
    } catch (e) { console.error(e); alert('Save failed') }
  }

  async function handleAssess(id: number) {
    try {
      await erpFetch(`finance/gift-sample-vat/${id}/assess/`, { method: 'POST' })
      load()
    } catch (e) { console.error(e); alert('Assess failed') }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(i =>
      i.gift_type?.toLowerCase().includes(q) ||
      i.recipient_name?.toLowerCase().includes(q) ||
      i.recipient_display?.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  const kpis = [
    { label: 'Total Gifts', value: dashboard.total_gifts ?? items.length, icon: <Gift size={11} />, color: 'var(--app-primary)' },
    { label: 'Below Threshold', value: dashboard.below_threshold ?? 0, icon: <CheckCircle2 size={11} />, color: 'var(--app-success, #22c55e)' },
    { label: 'VAT Due', value: dashboard.vat_due ?? 0, icon: <AlertTriangle size={11} />, color: 'var(--app-warning, #f59e0b)' },
    { label: 'Total VAT', value: (dashboard.total_vat_due ?? 0).toLocaleString(), icon: <DollarSign size={11} />, color: 'var(--app-error, #ef4444)' },
  ]

  if (editing) {
    return <GiftEditor item={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
  }

  return (
    <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
        {!focusMode && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <Gift size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Gift & Sample Events</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">Inventory · Business Gifts · Promotional Items</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all" style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /> New Gift
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><Gift size={14} style={{ color: '#fff' }} /></div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Gifts</span>
            </div>
          )}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search gifts... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
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
          <div className="flex-1 min-w-0">Type / Recipient</div>
          <div className="hidden sm:block w-24 flex-shrink-0 text-right">Cost</div>
          <div className="hidden md:block w-28 flex-shrink-0 text-right">YTD / Limit</div>
          <div className="hidden lg:block w-24 flex-shrink-0 text-right">VAT</div>
          <div className="hidden xl:block w-20 flex-shrink-0">Status</div>
          <div className="w-10 flex-shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
          ) : filtered.length > 0 ? (
            filtered.map(item => <GiftRow key={item.id} item={item} onEdit={() => setEditing(item)} onAssess={() => handleAssess(item.id)} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Gift size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No gift/sample records</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">Track business gift VAT obligations with threshold monitoring.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
