'use client'

/**
 * PO Row
 * =======
 * Purchase order row with inline status change, transfer actions,
 * expandable detail cards, and responsive mobile/desktop layouts.
 */

import React, { useState, useRef, useEffect } from 'react'
import { fetchPurchaseOrder, submitPO, approvePO, cancelPO, sendToSupplier, completePO, revertToDraft } from '@/app/actions/pos/purchases'
import {
  ClipboardList, Package, Eye, Edit,
  ChevronRight, ChevronDown, MoreHorizontal,
  ArrowRightCircle, Receipt, Truck, Check, X, Loader2,
} from 'lucide-react'
import { DCell } from '@/components/ui/DCell'
import { toast } from 'sonner'
import type { PO } from '../_lib/types'
import { STATUS_CONFIG, fmt } from '../_lib/constants'

// ── Valid transitions (mirrored from backend) ──
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  REJECTED: ['DRAFT'],
  SENT: ['CONFIRMED', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
  CONFIRMED: ['IN_TRANSIT', 'CANCELLED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
  IN_TRANSIT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: ['INVOICED', 'COMPLETED'],
  INVOICED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
}

// Map status transitions to server action calls
const STATUS_ACTIONS: Record<string, (id: number | string) => Promise<any>> = {
  SUBMITTED: submitPO,
  APPROVED: approvePO,
  SENT: sendToSupplier,
  CANCELLED: cancelPO,
  COMPLETED: completePO,
  DRAFT: revertToDraft,
}

interface PORowProps {
  po: PO
  onView: (id: number) => void
  onRefresh?: () => void
  visibleColumns: Record<string, boolean>
  isSelected: boolean
  onToggleSelect: (id: number) => void
}

export const PORow = React.memo(function PORow({ po, onView, onRefresh, visibleColumns: vc, isSelected, onToggleSelect }: PORowProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [detail, setDetail] = useState<PO | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const sc = STATUS_CONFIG[po.status] || { label: po.status, color: 'var(--app-muted-foreground)' }
  const supplier = po.supplier?.name || po.supplier_name || po.supplier_display || '—'
  const transitions = VALID_TRANSITIONS[po.status] || []

  // Close menus on outside click
  useEffect(() => {
    if (!showStatusMenu) return
    const handle = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setShowStatusMenu(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showStatusMenu])

  async function handleExpand() {
    if (isOpen) { setIsOpen(false); return }
    setIsOpen(true)
    if (!detail) {
      try { const d = await fetchPurchaseOrder(po.id); setDetail(d) } catch { setDetail(po) }
    }
  }

  async function handleTransition(newStatus: string) {
    setTransitioning(true)
    setShowStatusMenu(false)
    try {
      const action = STATUS_ACTIONS[newStatus]
      if (action) {
        await action(po.id)
      } else {
        // For statuses without a dedicated action, use generic PATCH
        const { erpFetch } = await import('@/lib/erp-api')
        await erpFetch(`purchase-orders/${po.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ status: newStatus }),
        })
      }
      toast.success(`PO ${po.po_number || po.id} → ${newStatus.replace(/_/g, ' ')}`)
      onRefresh?.()
    } catch (e: any) {
      toast.error(e?.message || `Failed to transition to ${newStatus}`)
    } finally {
      setTransitioning(false)
    }
  }

  return (
    <div>
      {/* ── MOBILE CARD (≤640px) ── */}
      <div
        className="sm:hidden border-b border-app-border/30 px-3 py-3 active:bg-app-surface/60 transition-all"
        onClick={handleExpand}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
            <ClipboardList size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-app-foreground truncate">{po.po_number || `PO-${po.id}`}</div>
            <div className="text-[11px] font-mono text-app-muted-foreground mt-0.5">{supplier}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                style={{ color: sc.color, background: `color-mix(in srgb, ${sc.color} 10%, transparent)` }}>
                {sc.label}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-[13px] font-mono font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>
              {fmt(po.total_amount)}
            </div>
            <div className="text-[10px] text-app-muted-foreground mt-0.5">{po.order_date || '—'}</div>
          </div>
        </div>
        {isOpen && <div className="flex items-center gap-2 mt-2 pt-2 border-t border-app-border/20">
          <button onClick={e => { e.stopPropagation(); onView(po.id) }}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-app-primary py-2 rounded-xl border border-app-primary/30 hover:bg-app-primary/5 transition-all">
            <Eye size={13} /> View Details
          </button>
        </div>}
      </div>

      {/* ── TABLE ROW (≥640px) ── */}
      <div
        className={`hidden sm:flex group items-center transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-1.5 md:py-2 ${isSelected ? 'bg-app-primary/5' : ''}`}
        style={{ paddingLeft: '12px', paddingRight: '12px' }}
        onClick={handleExpand}
      >
        {/* LEFT SECTION */}
        <div className="flex items-center gap-2" style={{ width: '280px', minWidth: '280px', flexShrink: 0 }}>
          <div className="w-5 flex-shrink-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(po.id)}
              className="w-3.5 h-3.5 accent-[var(--app-primary)] cursor-pointer rounded" />
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => onView(po.id)}
              className="p-1 hover:bg-app-primary/10 rounded-md transition-colors text-app-muted-foreground hover:text-app-primary"
              title="View Details">
              <Eye size={12} />
            </button>
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowMenu(!showMenu)}
                className="p-1 hover:bg-app-border/50 rounded-md transition-colors text-app-muted-foreground hover:text-app-foreground"
                title="More actions">
                <MoreHorizontal size={12} />
              </button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 w-52 py-1 rounded-xl border border-app-border shadow-xl animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{ background: 'var(--app-surface)' }}>
                    <button onClick={() => { onView(po.id); setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <Eye size={12} className="text-app-primary" /> View Details
                    </button>
                    <button onClick={() => { window.location.href = `/purchases/${po.id}/edit`; setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <Edit size={12} className="text-app-muted-foreground" /> Edit Order
                    </button>
                    <div className="h-px mx-2 my-1" style={{ background: 'var(--app-border)' }} />
                    <div className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">Transfer To</div>
                    <button onClick={() => { window.location.href = `/purchases/receipts/new?from_po=${po.id}`; setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <Truck size={12} style={{ color: 'var(--app-success)' }} /> Purchase Receipt
                    </button>
                    <button onClick={() => { window.location.href = `/finance/invoices/new?from_po=${po.id}&type=purchase`; setShowMenu(false) }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-app-foreground hover:bg-app-surface-hover transition-colors">
                      <Receipt size={12} style={{ color: 'var(--app-warning)' }} /> Purchase Invoice
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="w-4 flex-shrink-0 flex items-center justify-center text-app-muted-foreground">
            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </div>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${sc.color} 12%, transparent)`, color: sc.color }}>
            <ClipboardList size={13} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-[12px] font-bold text-app-foreground">{po.po_number || `PO-${po.id}`}</div>
            <div className="text-[10px] font-mono text-app-muted-foreground">{supplier}</div>
          </div>
        </div>

        {/* RIGHT SECTION: dynamic columns */}
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 fill-cols">
          {vc.supplier !== false && <div className="w-28 flex-shrink-0 text-[11px] text-app-foreground truncate">{supplier}</div>}
          {vc.date !== false && <div className="w-24 flex-shrink-0 text-[11px] text-app-muted-foreground">{po.order_date || '—'}</div>}
          {vc.expected !== false && <div className="w-24 flex-shrink-0 text-[11px] text-app-muted-foreground">{po.expected_delivery || '—'}</div>}
          {vc.status !== false && (
            <div className="w-24 flex-shrink-0" ref={statusRef} onClick={e => e.stopPropagation()}>
              {/* Inline Status Cell — clickable dropdown */}
              <button
                onClick={() => transitions.length > 0 && setShowStatusMenu(!showStatusMenu)}
                disabled={transitions.length === 0 || transitioning}
                className="relative flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.5 rounded transition-all"
                style={{
                  color: sc.color,
                  background: `color-mix(in srgb, ${sc.color} 10%, transparent)`,
                  cursor: transitions.length > 0 ? 'pointer' : 'default',
                  border: transitions.length > 0 ? `1px solid color-mix(in srgb, ${sc.color} 20%, transparent)` : 'none',
                }}
              >
                {transitioning ? <Loader2 size={8} className="animate-spin" /> : null}
                {sc.label}
                {transitions.length > 0 && <ChevronDown size={8} className="opacity-50" />}
              </button>

              {/* Status Dropdown */}
              {showStatusMenu && transitions.length > 0 && (
                <div className="absolute z-50 mt-1 w-44 py-1 rounded-xl border border-app-border shadow-xl animate-in fade-in slide-in-from-top-1 duration-100"
                  style={{ background: 'var(--app-surface)' }}>
                  <div className="px-3 py-1 text-[8px] font-black uppercase tracking-widest text-app-muted-foreground">
                    Transition to
                  </div>
                  {transitions.map(t => {
                    const tc = STATUS_CONFIG[t] || { label: t, color: 'var(--app-muted-foreground)' }
                    const isCancel = t === 'CANCELLED'
                    return (
                      <button
                        key={t}
                        onClick={() => handleTransition(t)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold hover:bg-app-surface-hover transition-colors"
                        style={{ color: isCancel ? 'var(--app-error)' : 'var(--app-foreground)' }}
                      >
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tc.color }} />
                        {tc.label}
                        {t === 'CANCELLED' && <X size={10} className="ml-auto opacity-50" />}
                        {t === 'COMPLETED' && <Check size={10} className="ml-auto opacity-50" style={{ color: 'var(--app-success)' }} />}
                        {t === 'SUBMITTED' && <ArrowRightCircle size={10} className="ml-auto opacity-50" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {vc.amount !== false && <div className="w-24 text-right flex-shrink-0 text-[12px] font-mono font-bold tabular-nums" style={{ color: 'var(--app-success, #22c55e)' }}>{fmt(po.total_amount)}</div>}
          {vc.priority && <div className="w-16 flex-shrink-0 text-[10px] font-bold text-app-muted-foreground uppercase">{po.priority || '—'}</div>}
          {vc.subtype && <div className="w-24 flex-shrink-0 text-[10px] font-bold text-app-muted-foreground uppercase">{po.purchase_sub_type || '—'}</div>}
          {vc.currency && <div className="w-14 flex-shrink-0 text-[10px] font-mono text-app-muted-foreground">{po.currency || '—'}</div>}
          {vc.supplierRef && <div className="w-24 flex-shrink-0 text-[10px] font-mono text-app-muted-foreground truncate">{po.supplier_ref || '—'}</div>}
          {vc.warehouse && <div className="w-24 flex-shrink-0 text-[10px] text-app-foreground truncate">{po.warehouse?.name || '—'}</div>}
          {vc.subtotal && <div className="w-20 text-right flex-shrink-0 text-[11px] font-mono tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{fmt(po.subtotal)}</div>}
          {vc.tax && <div className="w-16 text-right flex-shrink-0 text-[10px] font-mono tabular-nums text-app-muted-foreground">{fmt(po.tax_amount)}</div>}
          {vc.shipping && <div className="w-16 text-right flex-shrink-0 text-[10px] font-mono tabular-nums text-app-muted-foreground">{fmt(po.shipping_cost)}</div>}
          {vc.discount && <div className="w-16 text-right flex-shrink-0 text-[10px] font-mono tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>{fmt(po.discount_amount)}</div>}
          {vc.invoicePolicy && <div className="w-24 flex-shrink-0 text-[9px] font-bold text-app-muted-foreground uppercase truncate">{po.invoice_policy === 'RECEIVED_QTY' ? 'Received' : po.invoice_policy === 'ORDERED_QTY' ? 'Ordered' : po.invoice_policy || '—'}</div>}
          {vc.received && <div className="w-24 flex-shrink-0 text-[9px] text-app-muted-foreground truncate">{po.received_date || '—'}</div>}
          {vc.created && <div className="w-24 flex-shrink-0 text-[9px] text-app-muted-foreground truncate">{po.created_at ? new Date(po.created_at).toLocaleDateString() : '—'}</div>}
        </div>
      </div>

      {/* Detail Row */}
      {isOpen && (
        <div className="border-b border-app-border/30 animate-in slide-in-from-top-1 duration-200"
          style={{ background: 'color-mix(in srgb, var(--app-surface) 40%, var(--app-bg))' }}>
          <div className="sticky left-0 px-4 py-3" style={{ width: 'min(100vw - 280px, 100%)' }}>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button onClick={() => onView(po.id)}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-app-primary text-white hover:brightness-110 transition-all">
                <Eye size={11} /> View Details
              </button>
              <button onClick={() => { window.location.href = `/purchases/${po.id}/edit` }}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
                <Edit size={11} /> Edit
              </button>
              <div className="h-4 w-px bg-app-border/40 mx-1" />
              <button onClick={() => { window.location.href = `/purchases/receipts/new?from_po=${po.id}` }}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
                <Truck size={11} style={{ color: 'var(--app-success)' }} /> → Receipt
              </button>
              <button onClick={() => { window.location.href = `/finance/invoices/new?from_po=${po.id}&type=purchase` }}
                className="flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-app-border text-app-foreground hover:bg-app-surface transition-all">
                <Receipt size={11} style={{ color: 'var(--app-warning)' }} /> → Invoice
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {/* Order Info */}
              <CardSection color="var(--app-primary)" title="Order Info">
                <DCell label="PO Number" value={po.po_number || `PO-${po.id}`} mono />
                <DCell label="Supplier" value={supplier} />
                <DCell label="Status" value={sc.label} color={sc.color} />
                <DCell label="Order Date" value={po.order_date} />
                <DCell label="Expected" value={po.expected_delivery} />
                <DCell label="Priority" value={po.priority} />
              </CardSection>
              {/* Financials */}
              <CardSection color="var(--app-info)" title="Financials">
                <DCell label="Total" value={fmt(po.total_amount)} mono color="var(--app-success)" />
                <DCell label="Lines" value={detail?.lines?.length ?? '...'} />
                <DCell label="Created" value={po.created_at ? new Date(po.created_at).toLocaleDateString() : null} />
              </CardSection>
              {/* Lines */}
              {detail?.lines && detail.lines.length > 0 && (
                <div className="rounded-xl border border-app-border/40 overflow-hidden md:col-span-2 xl:col-span-1" style={{ background: 'var(--app-surface)' }}>
                  <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
                    style={{ background: 'color-mix(in srgb, var(--app-success) 6%, transparent)' }}>
                    <div className="w-1 h-3 rounded-full" style={{ background: 'var(--app-success)' }} />
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-success)' }}>Lines ({detail.lines.length})</span>
                  </div>
                  <div className="px-3 py-2 space-y-1 max-h-[160px] overflow-y-auto custom-scrollbar">
                    {detail.lines.map((line: any) => (
                      <div key={line.id} className="flex items-center gap-2 text-[10px] py-1 border-b border-app-border/20 last:border-0">
                        <Package size={10} className="text-app-muted-foreground flex-shrink-0" />
                        <span className="flex-1 min-w-0 truncate font-bold text-app-foreground">{line.product?.name || line.product_name || '—'}</span>
                        <span className="font-mono text-app-muted-foreground flex-shrink-0">{line.quantity || line.quantity_ordered || 0} × {fmt(line.unit_price)}</span>
                        <span className="font-mono font-bold text-app-foreground flex-shrink-0">{fmt(line.line_total || line.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {po.notes && (
              <div className="mt-2.5 px-3 py-2 rounded-xl border border-app-border/30" style={{ background: 'var(--app-surface)' }}>
                <span className="text-[8px] font-black text-app-muted-foreground uppercase tracking-widest">Notes</span>
                <div className="text-[10px] font-medium text-app-foreground/80 line-clamp-2 mt-0.5">{po.notes}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

/* ── Reusable Card Section wrapper ── */
function CardSection({ color, title, children }: { color: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-app-border/40 overflow-hidden" style={{ background: 'var(--app-surface)' }}>
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-app-border/30"
        style={{ background: `color-mix(in srgb, ${color} 6%, transparent)` }}>
        <div className="w-1 h-3 rounded-full" style={{ background: color }} />
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>{title}</span>
      </div>
      <div className="px-3 py-2 grid grid-cols-3 gap-x-3 gap-y-1.5 text-[10px]">
        {children}
      </div>
    </div>
  )
}
