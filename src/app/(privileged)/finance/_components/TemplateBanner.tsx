'use client'

import { useState } from 'react'
import {
    Loader2, Globe, ChevronRight, Download,
    ArrowDownCircle, CheckCircle2
} from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */
export type TemplatePreset = {
    name: string
    already_imported?: boolean
    [key: string]: any
}

export type TemplateData = {
    country_code: string | null
    country_name: string | null
    currency_code?: string
    presets: TemplatePreset[]
    total?: number
    imported?: number
    message?: string
}

type TemplateBannerProps = {
    templateData: TemplateData
    onImportPreset: (name: string) => Promise<void>
    onImportAll: () => Promise<void>
    renderPresetCard: (preset: TemplatePreset, importing: boolean) => React.ReactNode
    entityLabel?: string
}

/* ═══════════════════════════════════════════════════════════
 *  TEMPLATE BANNER — Shared across tax pages
 * ═══════════════════════════════════════════════════════════ */
export function TemplateBanner({
    templateData,
    onImportPreset,
    onImportAll,
    renderPresetCard,
    entityLabel = 'Templates',
}: TemplateBannerProps) {
    const [collapsed, setCollapsed] = useState(false)
    const [importingPreset, setImportingPreset] = useState<string | null>(null)
    const [importingAll, setImportingAll] = useState(false)

    const pendingImports = templateData.presets?.filter(p => !p.already_imported)?.length || 0
    const allImported = templateData.presets.length > 0 && pendingImports === 0

    const handleImportPreset = async (name: string) => {
        setImportingPreset(name)
        try { await onImportPreset(name) }
        finally { setImportingPreset(null) }
    }

    const handleImportAll = async () => {
        setImportingAll(true)
        try { await onImportAll() }
        finally { setImportingAll(false) }
    }

    return (
        <div className="flex-shrink-0 mb-3 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
            style={{
                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 4%, var(--app-surface))',
                border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 15%, var(--app-border))',
                borderLeft: '3px solid var(--app-info, #3b82f6)',
            }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                onClick={() => setCollapsed(!collapsed)}>
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{
                            background: allImported ? 'var(--app-success, #22c55e)' : 'var(--app-info, #3b82f6)',
                            boxShadow: allImported
                                ? '0 4px 12px color-mix(in srgb, var(--app-success, #22c55e) 30%, transparent)'
                                : '0 4px 12px color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)',
                        }}>
                        {allImported ? <CheckCircle2 size={15} className="text-white" /> : <Globe size={15} className="text-white" />}
                    </div>
                    <div>
                        <h3>
                            {templateData.country_name} {entityLabel}
                        </h3>
                        <p className="text-[10px] font-bold text-app-muted-foreground">
                            {allImported
                                ? `All ${templateData.presets.length} synced`
                                : `${pendingImports} of ${templateData.presets.length} available${templateData.currency_code ? ` · ${templateData.currency_code}` : ''}`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!allImported && !collapsed && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleImportAll() }}
                            disabled={importingAll}
                            className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:brightness-110"
                            style={{
                                background: 'var(--app-info, #3b82f6)',
                                color: '#fff',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-info, #3b82f6) 25%, transparent)',
                                opacity: importingAll ? 0.6 : 1,
                            }}>
                            {importingAll ? <Loader2 size={11} className="animate-spin" /> : <ArrowDownCircle size={11} />}
                            Import All
                        </button>
                    )}
                    <button className="p-1 text-app-muted-foreground hover:text-app-foreground transition-colors">
                        <ChevronRight size={14} className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`} />
                    </button>
                </div>
            </div>

            {/* Cards Grid */}
            {!collapsed && (
                <div className="px-4 pb-3 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '8px' }}>
                        {templateData.presets.map(preset =>
                            renderPresetCard(preset, importingPreset === preset.name)
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
