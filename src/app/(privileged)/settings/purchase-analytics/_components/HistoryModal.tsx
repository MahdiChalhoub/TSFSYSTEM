'use client'

/**
 * History Modal — Config Version History
 * =========================================
 */

import type { ConfigHistoryEntry } from '@/app/actions/settings/purchase-analytics-config'
import { getPurchaseAnalyticsConfig, rollbackConfig } from '@/app/actions/settings/purchase-analytics-config'
import { History, X } from 'lucide-react'

export function HistoryModal({ historyData, onClose, onRestore }: {
  historyData: ConfigHistoryEntry[]
  onClose: () => void
  onRestore: (cfg: any) => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between sticky top-0 bg-app-surface z-10">
          <div className="flex items-center gap-2">
            <History size={14} className="text-app-primary" />
            <h3 className="text-[13px] font-bold text-app-foreground">Config Version History</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary font-bold">{historyData.length} versions</span>
          </div>
          <button type="button" onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="px-4 py-3 space-y-2">
          {historyData.length === 0 ? (
            <p className="text-[11px] text-app-muted-foreground text-center py-8">No version history yet. Changes will be recorded on your next save.</p>
          ) : (
            [...historyData].reverse().map((entry, revIdx) => {
              const idx = historyData.length - 1 - revIdx
              return (
                <div key={revIdx} className="rounded-lg border border-app-border/40 bg-app-background/30 overflow-hidden">
                  <div className="px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-app-muted-foreground/10 text-app-muted-foreground font-mono font-bold">v{idx}</span>
                      <span className="text-[10px] font-bold text-app-foreground">{entry.changed_by}</span>
                      <span className="text-[9px] text-app-muted-foreground">
                        {new Date(entry.changed_at).toLocaleDateString()} {new Date(entry.changed_at).toLocaleTimeString()}
                      </span>
                      {entry.action !== 'save' && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold">{entry.action}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {entry.changes?.length > 0 && (
                        <span className="text-[8px] text-app-muted-foreground">{entry.changes.length} change{entry.changes.length !== 1 ? 's' : ''}</span>
                      )}
                      {idx < historyData.length - 1 && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await rollbackConfig(idx)
                            if (res.success) {
                              const cfg = await getPurchaseAnalyticsConfig()
                              onRestore(cfg)
                            }
                          }}
                          className="text-[8px] px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary font-bold hover:bg-app-primary/20 transition-colors"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  </div>
                  {entry.changes && entry.changes.length > 0 && (
                    <div className="px-3 pb-2 space-y-0.5">
                      {entry.changes.map((c: any, ci: number) => (
                        <div key={ci} className="flex items-center gap-2 text-[9px]">
                          <span className="text-app-muted-foreground min-w-[100px]">{c.field.replace(/_/g, ' ')}</span>
                          <span className="text-red-500/70 line-through">{typeof c.old === 'object' ? JSON.stringify(c.old) : String(c.old)}</span>
                          <span className="text-app-muted-foreground">→</span>
                          <span className="text-emerald-600 font-bold">{typeof c.new === 'object' ? JSON.stringify(c.new) : String(c.new)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
