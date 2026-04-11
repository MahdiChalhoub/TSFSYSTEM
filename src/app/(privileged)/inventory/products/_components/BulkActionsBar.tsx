'use client'

/**
 * Bulk Actions Bar
 * =================
 * Floating bar that appears when items are selected.
 */

import React from 'react'
import { ShoppingCart, ArrowRightLeft, Download } from 'lucide-react'

interface BulkActionsBarProps {
  selectedCount: number
  onRequestPurchase: () => void
  onRequestTransfer: () => void
  onExport?: () => void
  onDeselectAll: () => void
}

export const BulkActionsBar = React.memo(function BulkActionsBar({
  selectedCount, onRequestPurchase, onRequestTransfer, onExport, onDeselectAll,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="flex-shrink-0 px-3 py-2 border-t border-app-primary/30 flex items-center gap-2 flex-wrap"
      style={{ background: 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))' }}>
      <span className="text-[11px] font-black text-app-primary">{selectedCount} selected</span>
      <div className="flex items-center gap-1.5 ml-2">
        <button onClick={onRequestPurchase}
          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-app-info/30 text-app-info hover:bg-app-info/10 transition-all">
          <ShoppingCart size={11} /> Request Purchase
        </button>
        <button onClick={onRequestTransfer}
          className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-app-warning/30 text-app-warning hover:bg-app-warning/10 transition-all">
          <ArrowRightLeft size={11} /> Request Transfer
        </button>
        {onExport && (
          <button onClick={onExport}
            className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-app-border text-app-muted-foreground hover:bg-app-surface transition-all">
            <Download size={11} /> Export
          </button>
        )}
      </div>
      <button onClick={onDeselectAll} className="ml-auto text-[10px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all">
        Deselect All
      </button>
    </div>
  )
})
