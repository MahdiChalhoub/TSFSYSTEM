'use client'
/**
 * Advance Payment VAT — Management Page
 * =======================================
 * Dajingo Pro V2 Design Language
 * Tracks VAT on deposits/advances received before final invoice.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Loader2, X, Maximize2, Minimize2,
  ArrowLeft, Save, Edit2,
  Banknote, DollarSign, CheckCircle2, Clock, FileText, Send
} from 'lucide-react'

type Rec = Record<string, any>

const STATUSES = ['PENDING','VAT_DECLARED','INVOICED','CANCELLED']
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', VAT_DECLARED: 'Declared', INVOICED: 'Invoiced', CANCELLED: 'Cancelled',
}
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  PENDING: { bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', fg: 'var(--app-warning, #f59e0b)' },
  VAT_DECLARED: { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', fg: 'var(--app-info, #3b82f6)' },
  INVOICED: { bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', fg: 'var(--app-success, #22c55e)' },
  CANCELLED: { bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', fg: 'var(--app-error, #ef4444)' },
}

const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

function RecRow({ item, onEdit, onDeclare }: { item: Rec; onEdit: () => void; onDeclare: () => void }) {
  const sc = STATUS_COLORS[item.status] || STATUS_COLORS.PENDING
  return (
    <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3" onClick={onEdit}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: sc.bg, color: sc.fg }}>
        <Banknote size={13} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="truncate text-[13px] font-bold text-app-foreground block">
          {item.contact_name || `Deposit #${item.id}`}
        </span>
        <span className="text-[10px] font-bold text-app-muted-foreground">
          {item.deposit_date} {item.invoice_number ? `· Inv: ${item.invoice_number}` : ''}
        </span>
      </div>
      <div className="hidden sm:block w-28 flex-shrink-0 text-right">
        <div className="text-[10px] font-bold text-app-muted-foreground">Deposit</div>
        <div className="font-mono text-[13px] font-black text-app-foreground tabular-nums">
          {parseFloat(item.deposit_amount || 0).toLocaleString()}
        </div>
      </div>
      <div className="hidden md:block w-24 flex-shrink-0 text-right">
        <div className="text-[10px] font-bold text-app-muted-foreground">VAT</div>
        <div className="font-mono text-[13px] font-black tabular-nums" style={{ color: sc.fg }}>
          {parseFloat(item.vat_amount || 0).toLocaleString()}
        </div>
      </div>
      <div className="hidden lg:block w-24 flex-shrink-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: sc.bg, color: sc.fg }}>
          {STATUS_LABELS[item.status] || item.status}
        </span>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status === 'PENDING' && (
          <button onClick={e => { e.stopPropagation(); onDeclare() }}
            className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-info hover:text-app-info transition-colors" title="Declare VAT">
            <Send size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

function RecEditor({ item, onSave, onCancel }: { item: Rec | null; onSave: (d: Rec) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Rec>(item || {
    deposit_date: new Date().toISOString().split('T')[0], deposit_amount: 0,
    deposit_ht: 0, vat_rate: 0.18, vat_amount: 0, currency_code: 'XOF',
    status: 'PENDING', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const upd = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const vatR = parseFloat(form.vat_rate || 0)
  const depAmount = parseFloat(form.deposit_amount || 0)
  const depHT = depAmount / (1 + vatR)
  const vatCalc = depAmount - depHT

  return (
    <div className="flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all">
          <ArrowLeft size={13} /> Back
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
            <Banknote size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-app-foreground tracking-tight truncate">
              {item ? 'Edit Advance Payment' : 'New Advance Payment'}
            </h1>
            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">Deposit VAT Tracking</p>
          </div>
        </div>
        <button onClick={async () => { setSaving(true); await onSave({ ...form, deposit_ht: depHT, vat_amount: vatCalc }); setSaving(false) }} disabled={saving}
          className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all"
          style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
        <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--app-primary) 6%, transparent), color-mix(in srgb, var(--app-surface) 80%, transparent))', border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">DEPOSIT BREAKDOWN</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
            {[
              { label: 'Deposit TTC', value: depAmount, color: 'var(--app-primary)' },
              { label: 'Amount HT', value: depHT, color: 'var(--app-info, #3b82f6)' },
              { label: `VAT (${(vatR * 100).toFixed(0)}%)`, value: vatCalc, color: 'var(--app-warning, #f59e0b)' },
            ].map(c => (
              <div key={c.label} className="text-center">
                <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{c.label}</div>
                <div className="text-lg font-black tabular-nums" style={{ color: c.color }}>{c.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
          <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-3">DEPOSIT DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            <div><label className={labelCls}>Deposit Date</label><input className={inputCls} type="date" value={form.deposit_date} onChange={e => upd('deposit_date', e.target.value)} /></div>
            <div><label className={labelCls}>Deposit Amount (TTC)</label><input className={inputCls} type="number" min={0} step={0.01} value={form.deposit_amount} onChange={e => upd('deposit_amount', e.target.value)} /></div>
            <div><label className={labelCls}>VAT Rate</label><input className={inputCls} type="number" min={0} max={1} step={0.0001} value={form.vat_rate} onChange={e => upd('vat_rate', e.target.value)} /></div>
            <div><label className={labelCls}>Currency</label><input className={inputCls} value={form.currency_code} onChange={e => upd('currency_code', e.target.value)} maxLength={3} /></div>
            <div><label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => upd('status', e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
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

export default function AdvancePaymentVATPage() {
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
        erpFetch('finance/advance-payment-vat/'),
        erpFetch('finance/advance-payment-vat/dashboard/'),
      ])
      setItems(Array.isArray(d) ? d : d?.results || [])
      setDashboard(s || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleSave(data: Rec) {
    try {
      if (data.id) {
        await erpFetch(`finance/advance-payment-vat/${data.id}/`, { method: 'PATCH', body: JSON.stringify(data) })
      } else {
        await erpFetch('finance/advance-payment-vat/', { method: 'POST', body: JSON.stringify(data) })
      }
      setEditing(null); load()
    } catch (e) { console.error(e); alert('Save failed') }
  }

  async function handleDeclare(id: number) {
    try {
      await erpFetch(`finance/advance-payment-vat/${id}/declare/`, { method: 'POST' })
      load()
    } catch (e) { console.error(e); alert('Declare failed') }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(i => i.contact_name?.toLowerCase().includes(q) || i.status?.toLowerCase().includes(q))
  }, [items, searchQuery])

  const kpis = [
    { label: 'Total Deposits', value: dashboard.total_deposits ?? items.length, icon: <Banknote size={11} />, color: 'var(--app-primary)' },
    { label: 'Pending', value: dashboard.pending ?? 0, icon: <Clock size={11} />, color: 'var(--app-warning, #f59e0b)' },
    { label: 'Declared', value: dashboard.declared ?? 0, icon: <CheckCircle2 size={11} />, color: 'var(--app-info, #3b82f6)' },
    { label: 'Total VAT', value: (dashboard.total_deposit_vat ?? 0).toLocaleString(), icon: <DollarSign size={11} />, color: 'var(--app-success, #22c55e)' },
  ]

  if (editing) {
    return <RecEditor item={editing === 'new' ? null : editing} onSave={handleSave} onCancel={() => setEditing(null)} />
  }

  return (
    <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
        {!focusMode && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <Banknote size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Advance Payment VAT</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">Deposit VAT · Pre-Invoice</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 text-[11px] font-bold bg-app-primary hover:brightness-110 text-white px-3 py-1.5 rounded-xl transition-all" style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                  <Plus size={14} /> New Deposit
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><Banknote size={14} style={{ color: '#fff' }} /></div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Advances</span>
            </div>
          )}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search deposits... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
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
          <div className="flex-1 min-w-0">Contact / Date</div>
          <div className="hidden sm:block w-28 flex-shrink-0 text-right">Deposit</div>
          <div className="hidden md:block w-24 flex-shrink-0 text-right">VAT</div>
          <div className="hidden lg:block w-24 flex-shrink-0">Status</div>
          <div className="w-10 flex-shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
          ) : filtered.length > 0 ? (
            filtered.map(item => <RecRow key={item.id} item={item} onEdit={() => setEditing(item)} onDeclare={() => handleDeclare(item.id)} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <Banknote size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No advance payments</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">Track deposit VAT by creating a new advance payment record.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
