'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchConsignments } from '@/app/actions/pos/purchases'
import {
 Handshake, RefreshCw, ChevronRight, ChevronDown, ChevronLeft, ChevronsLeft, ChevronsRight,
 Clock, CheckCircle, Building2, Calendar, Search, DollarSign, FileText,
 X, Maximize2, Minimize2, Settings2
} from 'lucide-react'

type CS = { id: number; settlement_number?: string; ref_code?: string; supplier?: { id: number; name: string }; supplier_name?: string; contact_name?: string; status: string; total_amount?: number; settlement_amount?: number; settlement_date?: string; created_at?: string; notes?: string; lines?: Record<string, unknown>[] }

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 DRAFT: { label: 'Draft', color: 'var(--app-muted-foreground)' }, PENDING: { label: 'Pending', color: 'var(--app-warning)' },
 SETTLED: { label: 'Settled', color: 'var(--app-success)' }, CANCELLED: { label: 'Cancelled', color: 'var(--app-error)' },
}
const ALL_COLUMNS = [
 { key: 'supplier', label: 'Supplier', defaultVisible: true }, { key: 'date', label: 'Date', defaultVisible: true },
 { key: 'status', label: 'Status', defaultVisible: true }, { key: 'amount', label: 'Amount', defaultVisible: true },
]
const COLUMN_WIDTHS: Record<string, string> = { supplier: 'w-28', date: 'w-24', status: 'w-20', amount: 'w-24' }

const fmt = (n: number | string | null | undefined) => { if (n == null || n === '') return '—'; const v = typeof n === 'string' ? parseFloat(n) : n; if (isNaN(v)) return '—'; return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(v) }

interface CustomizePanelProps {
 isOpen: boolean
 onClose: () => void
 visibleColumns: Record<string, boolean>
 setVisibleColumns: (cols: Record<string, boolean>) => void
}
function CustomizePanel({ isOpen, onClose, visibleColumns, setVisibleColumns }: CustomizePanelProps) {
 if (!isOpen) return null; return (
  <div className="fixed inset-0 z-50"><div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
   <div className="fixed right-0 top-0 bottom-0 w-80 bg-app-surface border-l border-app-border shadow-2xl p-5 overflow-y-auto animate-in slide-in-from-right-5 duration-200">
    <div className="flex items-center justify-between mb-4"><h3>Customize View</h3><button onClick={onClose} className="p-1 rounded-lg hover:bg-app-muted/10"><X size={14} /></button></div>
    <div className="space-y-1"><p className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-2">Visible Columns</p>
     {ALL_COLUMNS.map(col => { const isOn = col.defaultVisible ? visibleColumns[col.key] !== false : visibleColumns[col.key]; return <label key={col.key} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-app-muted/10 cursor-pointer transition-all"><input type="checkbox" checked={!!isOn} onChange={() => setVisibleColumns({ ...visibleColumns, [col.key]: !isOn })} className="w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded" /><span className="text-[11px] font-bold text-app-foreground">{col.label}</span></label> })}
    </div></div></div>)
}

export default function ConsignmentsPage() {
 const [settlements, setSettlements] = useState<CS[]>([]); const [loading, setLoading] = useState(true); const [search, setSearch] = useState('')
 const [expandedId, setExpandedId] = useState<number | null>(null)
 const [focusMode, setFocusMode] = useState(false); const [showCustomize, setShowCustomize] = useState(false)
 const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({}); const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
 const [pageSize, setPageSize] = useState(50); const [currentPage, setCurrentPage] = useState(1); const searchRef = useRef<HTMLInputElement>(null)

 const load = useCallback(async () => { setLoading(true); try { const data = await fetchConsignments(); setSettlements(Array.isArray(data) ? data : (data?.results ?? [])) } catch { setSettlements([]) }; setLoading(false) }, [])
 useEffect(() => { load() }, [load])

 const filtered = useMemo(() => settlements.filter(s => { if (!search) return true; const q = search.toLowerCase(); const num = (s.settlement_number || s.ref_code || `CS-${s.id}`).toLowerCase(); const sup = (s.supplier?.name || s.supplier_name || s.contact_name || '').toLowerCase(); return num.includes(q) || sup.includes(q) }), [settlements, search])
 useEffect(() => { setCurrentPage(1) }, [search])
 const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize)); const clampedPage = Math.min(currentPage, totalPages)
 const paginated = useMemo(() => { const start = (clampedPage - 1) * pageSize; return filtered.slice(start, start + pageSize) }, [filtered, clampedPage, pageSize])

 const totalValue = filtered.reduce((s, c) => s + Number(c.settlement_amount || c.total_amount || 0), 0)
 const pendingCount = filtered.filter(c => ['DRAFT','PENDING'].includes(c.status)).length; const settledCount = filtered.filter(c => c.status === 'SETTLED').length

 const toggleSelect = (id: number) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
 const isAllPageSelected = paginated.length > 0 && paginated.every(p => selectedIds.has(p.id))
 const toggleSelectAll = () => { if (isAllPageSelected) setSelectedIds(prev => { const n = new Set(prev); paginated.forEach(p => n.delete(p.id)); return n }); else setSelectedIds(prev => { const n = new Set(prev); paginated.forEach(p => n.add(p.id)); return n }) }
 const vc = visibleColumns

 return (
  <div className="flex flex-col h-[calc(100vh-8rem)] animate-in fade-in duration-300 transition-all">
   <div className={`flex-shrink-0 space-y-4 transition-all duration-300 ${focusMode ? 'pb-2' : 'pb-4'}`}>
    {focusMode ? (
     <div className="flex items-center gap-2"><div className="flex items-center gap-2 flex-shrink-0"><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--app-accent)' }}><Handshake size={14} className="text-white" /></div><span className="text-[12px] font-black text-app-foreground hidden sm:inline">Consignments</span><span className="text-[10px] font-bold text-app-muted-foreground">{filtered.length}/{settlements.length}</span></div><div className="flex-1 relative"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground" /><input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-app-surface/50 border border-app-border/50 rounded-lg text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all" /></div><button onClick={() => setFocusMode(false)} className="p-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0"><Minimize2 size={13} /></button></div>
    ) : (
     <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
       <div className="flex items-center gap-3"><div className="page-header-icon" style={{ background: 'var(--app-accent)', boxShadow: '0 4px 14px color-mix(in srgb, var(--app-accent) 30%, transparent)' }}><Handshake size={20} className="text-white" /></div><div><h1>Consignment Settlements</h1><p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">{settlements.length} Settlements · {pendingCount} Pending · {settledCount} Settled</p></div></div>
       <div className="flex items-center gap-1.5 flex-shrink-0"><button onClick={load} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"><RefreshCw size={13} /></button><button onClick={() => setFocusMode(true)} className="flex items-center gap-1 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2 py-1.5 rounded-xl hover:bg-app-surface transition-all"><Maximize2 size={13} /></button></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
       {[{ label: 'Total Settled', value: fmt(totalValue), icon: <DollarSign size={11} />, color: 'var(--app-accent)' },{ label: 'Pending', value: pendingCount, icon: <Clock size={11} />, color: 'var(--app-warning)' },{ label: 'Settled', value: settledCount, icon: <CheckCircle size={11} />, color: 'var(--app-success)' }].map(s => (
        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}><div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>{s.icon}</div><div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div><div className="text-sm font-black text-app-foreground tabular-nums">{s.value}</div></div></div>))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
       <div className="flex-1 relative min-w-0"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" /><input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search settlements, suppliers..." className="w-full pl-9 pr-3 py-2 text-[12px] md:text-[13px] bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" /></div>
       {search && <button onClick={() => setSearch('')} className="text-[11px] font-bold px-2 py-2 rounded-xl border" style={{ color: 'var(--app-error)', borderColor: 'color-mix(in srgb, var(--app-error) 20%, transparent)', background: 'color-mix(in srgb, var(--app-error) 5%, transparent)' }}><X size={13} /></button>}
       <button onClick={() => setShowCustomize(true)} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl border border-app-border text-app-muted-foreground hover:text-app-foreground hover:bg-app-surface transition-all flex-shrink-0"><Settings2 size={13} /><span className="hidden sm:inline">Customize</span></button>
      </div>
     </>
    )}
   </div>
   <div className="flex-1 min-h-0 bg-app-surface/30 border border-app-border/50 rounded-2xl flex flex-col overflow-hidden">
    <div className="sm:hidden flex-shrink-0 px-3 py-2 bg-app-surface/60 border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider">{filtered.length} Settlement{filtered.length !== 1 ? 's' : ''}</div>
    <div className="hidden sm:flex sticky top-0 z-10 items-center py-2 bg-app-surface/90 backdrop-blur-sm border-b border-app-border/50 text-[10px] font-black text-app-muted-foreground uppercase tracking-wider" style={{ paddingLeft: "12px", paddingRight: "12px" }}>
     <div className="flex items-center gap-2" style={{ width: '280px', minWidth: '280px', flexShrink: 0 }}><div className="w-5 flex-shrink-0 flex items-center justify-center"><input type="checkbox" checked={isAllPageSelected} onChange={toggleSelectAll} className="w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded" /></div><div className="flex-1">Settlement</div></div>
     <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">{ALL_COLUMNS.map(col => { const isOn = col.defaultVisible ? vc[col.key] !== false : vc[col.key]; if (!isOn) return null; return <div key={col.key} className={`${COLUMN_WIDTHS[col.key] || 'w-20'} flex-shrink-0${col.key === 'amount' ? ' text-right' : ''}`}>{col.label}</div> })}</div>
    </div>
    <div className="flex-1 min-h-0 overflow-auto overscroll-contain custom-scrollbar">
     {loading ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-12 border-b border-app-border/20 animate-pulse" style={{ background: `color-mix(in srgb, var(--app-surface) ${40 + i * 5}%, transparent)` }} />)
      : paginated.length > 0 ? paginated.map(cs => {
       const sc = STATUS_CONFIG[cs.status] || { label: cs.status, color: 'var(--app-muted-foreground)' }; const supplier = cs.supplier?.name || cs.supplier_name || cs.contact_name || '—'; const ref = cs.settlement_number || cs.ref_code || `CS-${cs.id}`; const isExpanded = expandedId === cs.id; return (
        <div key={cs.id}>
         <div className="sm:hidden border-b border-app-border/30 px-3 py-3" onClick={() => setExpandedId(isExpanded ? null : cs.id)}>
          <div className="flex items-start gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}><Handshake size={15} /></div><div className="flex-1 min-w-0"><div className="text-[13px] font-bold text-app-foreground truncate">{ref}</div><div className="text-[11px] text-app-muted-foreground mt-0.5">{supplier}</div><span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded mt-1 inline-block" style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>{sc.label}</span></div><div className="text-[13px] font-mono font-bold tabular-nums text-app-foreground">{fmt(Number(cs.settlement_amount || cs.total_amount || 0))}</div></div>
         </div>
         <div className="hidden sm:flex items-center cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 transition-all duration-150 py-1.5 md:py-2"
    style={{ paddingLeft: "12px", paddingRight: "12px" }} onClick={() => setExpandedId(isExpanded ? null : cs.id)}>
          <div className="flex items-center gap-2" style={{ width: '280px', minWidth: '280px', flexShrink: 0 }}>
           <div className="w-5 flex-shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(cs.id)} onChange={() => toggleSelect(cs.id)} className="w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded" /></div>
           <div className="w-4 flex-shrink-0 text-app-muted-foreground">{isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</div>
           <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}><Handshake size={13} /></div>
           <div className="flex-1 min-w-0"><div className="text-[12px] font-bold text-app-foreground truncate">{ref}</div></div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
           {vc.supplier !== false && <div className="w-28 flex-shrink-0 text-[11px] text-app-muted-foreground truncate flex items-center gap-1"><Building2 size={10} /> {supplier}</div>}
           {vc.date !== false && <div className="w-24 flex-shrink-0 text-[11px] text-app-muted-foreground">{cs.settlement_date || (cs.created_at ? new Date(cs.created_at).toLocaleDateString('fr-FR') : '—')}</div>}
           {vc.status !== false && <div className="w-20 flex-shrink-0"><span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded whitespace-nowrap" style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>{sc.label}</span></div>}
           {vc.amount !== false && <div className="w-24 text-right flex-shrink-0 text-[12px] font-mono font-bold tabular-nums text-app-foreground">{fmt(Number(cs.settlement_amount || cs.total_amount || 0))}</div>}
          </div>
         </div>
         {isExpanded && <div className="border-b border-app-border/30 animate-in slide-in-from-top-1 duration-200 px-4 py-3" style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, var(--app-bg))' }}><div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3"><div><div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Supplier</div><div className="font-bold text-app-foreground text-sm">{supplier}</div></div><div><div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Date</div><div className="font-bold text-app-foreground text-sm">{cs.settlement_date || '—'}</div></div><div><div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Amount</div><div className="font-bold text-sm" style={{ color: 'var(--app-accent)' }}>{fmt(Number(cs.settlement_amount || cs.total_amount || 0))}</div></div><div><div className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Status</div><div className="font-bold text-sm" style={{ color: sc.color }}>{sc.label}</div></div></div>{cs.notes && <div className="text-xs text-app-muted-foreground p-2 rounded-lg border border-app-border/30 bg-app-surface/50"><FileText size={10} className="inline mr-1" />{cs.notes}</div>}</div>}
        </div>)
      }) : <div className="flex flex-col items-center justify-center py-20 text-app-muted-foreground gap-3"><Handshake size={36} className="opacity-40" /><p className="text-sm font-bold">No consignment settlements found</p></div>}
    </div>
    {selectedIds.size > 0 && <div className="flex-shrink-0 px-3 py-2 border-t border-app-primary/30 flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))' }}><span className="text-[11px] font-black text-app-primary">{selectedIds.size} selected</span><button onClick={() => setSelectedIds(new Set())} className="ml-auto text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground">Deselect</button></div>}
    {!loading && filtered.length > 0 && (
     <div className="flex-shrink-0 px-3 py-2 border-t border-app-border/50 text-[10px] font-bold text-app-muted-foreground flex items-center justify-between gap-2 flex-wrap" style={{ background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)' }}>
      <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      <div className="flex items-center gap-1"><button onClick={() => setCurrentPage(1)} disabled={clampedPage <= 1} className="p-1 rounded-md hover:bg-app-surface disabled:opacity-20"><ChevronsLeft size={12} /></button><button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={clampedPage <= 1} className="p-1 rounded-md hover:bg-app-surface disabled:opacity-20"><ChevronLeft size={12} /></button>{(() => { const pages: (number|'...')[] = []; if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i) } else { pages.push(1); if (clampedPage > 3) pages.push('...'); for (let i = Math.max(2, clampedPage-1); i <= Math.min(totalPages-1, clampedPage+1); i++) pages.push(i); if (clampedPage < totalPages-2) pages.push('...'); pages.push(totalPages) }; return pages.map((p,i) => p === '...' ? <span key={`d-${i}`} className="px-1 text-app-muted-foreground/50">…</span> : <button key={p} onClick={() => setCurrentPage(p as number)} className={`min-w-[24px] h-6 rounded-md text-[10px] font-bold transition-all ${p === clampedPage ? 'bg-app-primary text-white shadow-sm' : 'hover:bg-app-surface border border-transparent hover:border-app-border/50'}`}>{p}</button>) })()}<button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={clampedPage >= totalPages} className="p-1 rounded-md hover:bg-app-surface disabled:opacity-20"><ChevronRight size={12} /></button><button onClick={() => setCurrentPage(totalPages)} disabled={clampedPage >= totalPages} className="p-1 rounded-md hover:bg-app-surface disabled:opacity-20"><ChevronsRight size={12} /></button></div>
      <div className="flex items-center gap-1.5"><span className="text-[9px] uppercase tracking-wider">Show:</span>{[25,50,100].map(n => <button key={n} onClick={() => { setPageSize(n); setCurrentPage(1) }} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${pageSize === n ? 'bg-app-primary text-white' : 'hover:bg-app-surface border border-app-border/50'}`}>{n}</button>)}<button onClick={() => { setPageSize(filtered.length || 999999); setCurrentPage(1) }} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${pageSize >= filtered.length ? 'bg-app-primary text-white' : 'hover:bg-app-surface border border-app-border/50'}`}>All</button></div>
     </div>
    )}
   </div>
   <CustomizePanel isOpen={showCustomize} onClose={() => setShowCustomize(false)} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
  </div>
 )
}
