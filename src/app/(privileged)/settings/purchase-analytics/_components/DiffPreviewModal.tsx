'use client'

/**
 * DiffPreviewModal — Unsaved Changes Preview (with Save button)
 * ================================================================
 */

import { GitCompare, X } from 'lucide-react'
import type { PurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'

export function DiffPreviewModal({ config, originalConfig, onClose, onSave }: {
  config: PurchaseAnalyticsConfig
  originalConfig: PurchaseAnalyticsConfig
  onClose: () => void
  onSave: () => void
}) {
  const changedKeys = Object.keys(config).filter(k =>
    JSON.stringify((config as any)[k]) !== JSON.stringify((originalConfig as any)[k])
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl w-full max-w-md max-h-[70vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare size={14} className="text-app-primary" />
            <h3>Unsaved Changes</h3>
          </div>
          <button type="button" onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="px-4 py-3 space-y-2">
          {changedKeys.length === 0 ? (
            <p className="text-[11px] text-app-muted-foreground text-center py-4">No changes detected</p>
          ) : (
            changedKeys.map(k => (
              <div key={k} className="flex items-start gap-2 text-[10px] bg-app-background/50 rounded-lg p-2 border border-app-border/30">
                <span className="font-bold text-app-foreground min-w-[120px] shrink-0">{k.replace(/_/g, ' ')}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-app-error line-through">{typeof (originalConfig as any)[k] === 'object' ? JSON.stringify((originalConfig as any)[k]) : String((originalConfig as any)[k])}</span>
                  <span className="text-app-success font-bold">{typeof (config as any)[k] === 'object' ? JSON.stringify((config as any)[k]) : String((config as any)[k])}</span>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-3 border-t border-app-border flex justify-end gap-2">
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-app-muted-foreground border border-app-border hover:text-app-foreground transition-all">
            Close
          </button>
          <button type="button" onClick={() => { onClose(); onSave() }}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-app-primary text-white hover:opacity-90 transition-all">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
