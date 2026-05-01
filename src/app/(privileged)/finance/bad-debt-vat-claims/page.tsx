'use client'
/**
 * Bad Debt VAT Claims — Management Page
 * =======================================
 * Dajingo Pro V2 Design Language
 * Tracks VAT recovery on unpaid customer invoices.
 */
import { useState, useEffect, useMemo, useRef } from 'react'
import { erpFetch } from '@/lib/erp-api'
import {
  Plus, Search, Loader2, X, Maximize2, Minimize2,
  AlertTriangle, DollarSign, CheckCircle2, Clock, FileX,
  Send, RotateCcw, ArrowLeft, Save
} from 'lucide-react'

type Claim = Record<string, any>
type Stats = Record<string, any>

const STATUSES = ['ELIGIBLE','CLAIMED','RECOVERED','REJECTED','REVERSED']
const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  ELIGIBLE: { bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)', fg: 'var(--app-warning, #f59e0b)' },
  CLAIMED: { bg: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', fg: 'var(--app-info, #3b82f6)' },
  RECOVERED: { bg: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', fg: 'var(--app-success, #22c55e)' },
  REJECTED: { bg: 'color-mix(in srgb, var(--app-error, #ef4444) 10%, transparent)', fg: 'var(--app-error, #ef4444)' },
  REVERSED: { bg: 'color-mix(in srgb, var(--app-accent) 10%, transparent)', fg: 'var(--app-accent)' },
}

const inputCls = 'w-full text-[12px] font-bold bg-app-surface/60 border border-app-border/50 rounded-xl px-3 py-2 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-primary/40 focus:ring-2 focus:ring-app-primary/10 outline-none transition-all'
const labelCls = 'text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1 block'

function ClaimRow({ item, onAction }: { item: Claim; onAction: (action: string) => void }) {
  const sc = STATUS_COLORS[item.status] || STATUS_COLORS.ELIGIBLE
  return (
    <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 border-b border-app-border/30 hover:bg-app-surface/40 py-2.5 px-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: sc.bg, color: sc.fg }}>
        {item.status === 'RECOVERED' ? <CheckCircle2 size={13} /> :
         item.status === 'REJECTED' ? <FileX size={13} /> :
         item.status === 'CLAIMED' ? <Send size={13} /> :
         <AlertTriangle size={13} />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="truncate text-[13px] font-bold text-app-foreground block">
          Invoice #{item.invoice_number || item.invoice || '—'}
        </span>
        <span className="text-[10px] font-bold text-app-muted-foreground">{item.contact_name || 'Unknown'}</span>
      </div>
      <div className="hidden sm:block w-28 flex-shrink-0 text-right">
        <span className="font-mono text-[13px] font-black text-app-foreground tabular-nums">
          {parseFloat(item.original_vat_amount || 0).toLocaleString()} {item.currency_code}
        </span>
      </div>
      <div className="hidden md:block w-24 flex-shrink-0">
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg" style={{ background: sc.bg, color: sc.fg }}>
          {item.status}
        </span>
      </div>
      <div className="hidden lg:block w-24 flex-shrink-0 text-[10px] font-bold text-app-muted-foreground">
        {item.eligible_date || '—'}
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.status === 'ELIGIBLE' && (
          <button onClick={() => onAction('submit')}
            className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-info hover:text-app-info transition-colors" title="Submit Claim">
            <Send size={12} />
          </button>
        )}
        {(item.status === 'CLAIMED' || item.status === 'ELIGIBLE') && (
          <button onClick={() => onAction('recover')}
            className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-success hover:text-app-success transition-colors" title="Mark Recovered">
            <CheckCircle2 size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function BadDebtVATClaimsPage() {
  const [items, setItems] = useState<Claim[]>([])
  const [dashboard, setDashboard] = useState<Stats>({})
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [focusMode, setFocusMode] = useState(false)
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
        erpFetch('finance/bad-debt-vat-claims/'),
        erpFetch('finance/bad-debt-vat-claims/dashboard/'),
      ])
      setItems(Array.isArray(d) ? d : d?.results || [])
      setDashboard(s || {})
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleAction(id: number, action: string) {
    try {
      if (action === 'submit') {
        await erpFetch(`finance/bad-debt-vat-claims/${id}/submit-claim/`, { method: 'POST' })
      } else if (action === 'recover') {
        await erpFetch(`finance/bad-debt-vat-claims/${id}/mark-recovered/`, { method: 'POST', body: JSON.stringify({}) })
      }
      load()
    } catch (e) { console.error(e); alert('Action failed') }
  }

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items
    const q = searchQuery.toLowerCase()
    return items.filter(i =>
      i.invoice_number?.toLowerCase().includes(q) ||
      i.contact_name?.toLowerCase().includes(q) ||
      i.status?.toLowerCase().includes(q)
    )
  }, [items, searchQuery])

  const kpis = [
    { label: 'Total Claims', value: dashboard.total_claims ?? items.length, icon: <AlertTriangle size={11} />, color: 'var(--app-primary)' },
    { label: 'Eligible', value: dashboard.eligible ?? 0, icon: <Clock size={11} />, color: 'var(--app-warning, #f59e0b)' },
    { label: 'Claimed', value: dashboard.claimed ?? 0, icon: <Send size={11} />, color: 'var(--app-info, #3b82f6)' },
    { label: 'Recovered', value: (dashboard.total_recovered ?? 0).toLocaleString(), icon: <DollarSign size={11} />, color: 'var(--app-success, #22c55e)' },
  ]

  return (
    <div className={`flex flex-col h-full p-4 md:p-6 animate-in fade-in duration-300 transition-all ${focusMode ? 'max-h-[calc(100vh-4rem)]' : 'max-h-[calc(100vh-8rem)]'}`}>
      <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
        {!focusMode && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="page-header-icon bg-app-primary" style={{ boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                  <AlertTriangle size={20} className="text-white" />
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight">Bad Debt VAT Claims</h1>
                  <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                    VAT Recovery · Unpaid Invoices
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
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
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-primary)' }}><AlertTriangle size={14} style={{ color: '#fff' }} /></div>
              <span className="text-[12px] font-black text-app-foreground hidden sm:inline">Bad Debt Claims</span>
            </div>
          )}
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
            <input ref={searchRef} type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search claims... (Ctrl+K)" className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
          </div>
          {focusMode && <button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all"><Minimize2 size={13} /></button>}
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-[11px] font-bold px-2 py-2 rounded-xl border transition-all flex-shrink-0" style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)' }}><X size={13} /></button>}
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center gap-2 md:gap-3 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">
          <div className="w-7 flex-shrink-0" />
          <div className="flex-1 min-w-0">Invoice / Contact</div>
          <div className="hidden sm:block w-28 flex-shrink-0 text-right">VAT Amount</div>
          <div className="hidden md:block w-24 flex-shrink-0">Status</div>
          <div className="hidden lg:block w-24 flex-shrink-0">Eligible</div>
          <div className="w-16 flex-shrink-0" />
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-app-primary" /></div>
          ) : filtered.length > 0 ? (
            filtered.map(item => <ClaimRow key={item.id} item={item} onAction={a => handleAction(item.id, a)} />)
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <AlertTriangle size={36} className="text-app-muted-foreground mb-3 opacity-40" />
              <p className="text-sm font-bold text-app-muted-foreground">No bad debt claims</p>
              <p className="text-[11px] text-app-muted-foreground mt-1">
                Claims are automatically created when invoices go past the recovery threshold.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
