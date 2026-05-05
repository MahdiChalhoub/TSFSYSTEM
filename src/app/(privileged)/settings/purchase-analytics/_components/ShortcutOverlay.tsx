'use client'

/**
 * Keyboard Shortcuts Overlay
 * ============================
 */

import { X } from 'lucide-react'

export function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
          <h3>⌨️ Keyboard Shortcuts</h3>
          <button type="button" onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground"><X size={14} /></button>
        </div>
        <div className="px-4 py-3 space-y-2">
          {[
            ['Ctrl + S', 'Save configuration'],
            ['Ctrl + Z', 'Undo last change'],
            ['Esc', 'Exit profile editing'],
            ['?', 'Toggle this overlay'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between">
              <kbd className="px-2 py-0.5 rounded bg-app-background border border-app-border text-[10px] font-mono font-bold text-app-foreground">{key}</kbd>
              <span className="text-[10px] text-app-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
