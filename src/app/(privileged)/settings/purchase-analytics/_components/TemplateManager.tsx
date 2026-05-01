'use client'

/**
 * Template Manager Modal — Config Template CRUD
 * ================================================
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import type { PurchaseAnalyticsConfig } from '@/app/actions/settings/purchase-analytics-config'
import { fieldInput } from '../_lib/constants'

export function TemplateManager({ config, onClose, onLoad }: {
  config: PurchaseAnalyticsConfig
  onClose: () => void
  onLoad: (templateConfig: Record<string, any>) => void
}) {
  const [templateName, setTemplateName] = useState('')

  const handleSave = () => {
    if (!templateName.trim() || !config) return
    const { _last_modified_by, _last_modified_at, _version_count, _user_role, _restricted_fields, _active_editors, ...clean } = config as any
    const templates = JSON.parse(localStorage.getItem('pa_templates') || '{}')
    templates[templateName] = { config: clean, savedAt: new Date().toISOString() }
    localStorage.setItem('pa_templates', JSON.stringify(templates))
    setTemplateName('')
  }

  const handleDelete = (name: string) => {
    const templates = JSON.parse(localStorage.getItem('pa_templates') || '{}')
    delete templates[name]
    localStorage.setItem('pa_templates', JSON.stringify(templates))
    onClose()
    setTimeout(() => {}, 50) // force re-render on next open
  }

  const templates = JSON.parse(localStorage.getItem('pa_templates') || '{}')

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-app-surface border border-app-border rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
          <h3 className="text-[13px] font-bold text-app-foreground">📁 Config Templates</h3>
          <button type="button" onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground"><X size={14} /></button>
        </div>
        <div className="px-4 py-3 space-y-3">
          {/* Save current */}
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Template name..." value={templateName} onChange={e => setTemplateName(e.target.value)}
              className={`${fieldInput} text-[11px]`} />
            <button type="button" onClick={handleSave}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-app-primary text-white hover:opacity-90 transition-all whitespace-nowrap">
              Save
            </button>
          </div>
          {/* List saved */}
          <div className="space-y-1">
            {Object.entries(templates).map(([name, data]: [string, any]) => (
              <div key={name} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-app-background/50 border border-app-border/30">
                <div>
                  <span className="text-[10px] font-bold text-app-foreground">{name}</span>
                  <span className="text-[8px] text-app-muted-foreground ml-2">{new Date(data.savedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { if (data.config) { onLoad(data.config); onClose() } }}
                    className="text-[8px] px-1.5 py-0.5 rounded bg-app-primary/10 text-app-primary font-bold hover:bg-app-primary/20">
                    Load
                  </button>
                  <button type="button" onClick={() => handleDelete(name)}
                    className="text-[8px] px-1.5 py-0.5 rounded bg-app-error/10 text-app-error font-bold hover:bg-app-error/20">
                    ×
                  </button>
                </div>
              </div>
            ))}
            {Object.keys(templates).length === 0 && (
              <p className="text-[10px] text-app-muted-foreground text-center py-3">No templates saved yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
