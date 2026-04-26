'use client'

import { Check, CheckCircle2, FileText, Loader2, Download } from 'lucide-react'
import type { TemplatePreset } from '../../_components/TemplateBanner'

/* ═══════════════════════════════════════════════════════════
 *  PRESET CARD — For displaying available template presets
 * ═══════════════════════════════════════════════════════════ */
export function OrgTaxPolicyPresetCard({ preset, onImport, importing }: {
    preset: TemplatePreset
    onImport: (name: string) => void
    importing: boolean
}) {
    const isImported = preset.already_imported
    const recoveryPct = preset.vat_input_recoverability
        ? `${(parseFloat(preset.vat_input_recoverability) * 100).toFixed(0)}%`
        : '—'

    return (
        <div
            className="relative flex flex-col gap-2 px-4 py-3 rounded-xl transition-all duration-200"
            style={{
                background: isImported
                    ? 'color-mix(in srgb, var(--app-success, #22c55e) 4%, var(--app-surface))'
                    : 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                border: isImported
                    ? '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)'
                    : '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                opacity: isImported ? 0.75 : 1,
            }}
        >
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                            background: isImported
                                ? 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)'
                                : 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: isImported ? 'var(--app-success, #22c55e)' : 'var(--app-primary)',
                        }}>
                        {isImported ? <CheckCircle2 size={13} /> : <FileText size={13} />}
                    </div>
                    <span className="text-[12px] font-bold text-app-foreground truncate">{preset.name}</span>
                </div>
                {isImported ? (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)',
                            color: 'var(--app-success, #22c55e)',
                            border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)',
                        }}>Imported</span>
                ) : (
                    <button
                        onClick={() => onImport(preset.name)}
                        disabled={importing}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex-shrink-0 hover:brightness-110"
                        style={{
                            background: 'var(--app-primary)',
                            color: '#fff',
                            boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            opacity: importing ? 0.6 : 1,
                        }}>
                        {importing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                        Import
                    </button>
                )}
            </div>

            {/* Details Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '4px' }}>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">VAT</span>
                    <span className="text-[10px] font-bold flex items-center gap-1"
                        style={preset.vat_output_enabled ? {
                            color: 'var(--app-success, #22c55e)',
                        } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                        {preset.vat_output_enabled ? <><Check size={9} />Enabled</> : 'Disabled'}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Recovery</span>
                    <span className="text-[10px] font-bold font-mono text-app-foreground">{recoveryPct}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Treatment</span>
                    <span className="text-[10px] font-bold text-app-foreground">{preset.official_vat_treatment || '—'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Profit Tax</span>
                    <span className="text-[10px] font-bold text-app-foreground">{preset.profit_tax_mode || '—'}</span>
                </div>
            </div>

            {/* Scopes */}
            {preset.allowed_scopes && preset.allowed_scopes.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                    {preset.allowed_scopes.map((s: string) => (
                        <span key={s} className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
                            style={{
                                color: 'var(--app-primary)',
                                background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                            }}>{s}</span>
                    ))}
                    {preset.required_documents && preset.required_documents.length > 0 && (
                        <span className="text-[7px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
                            style={{
                                color: '#8b5cf6',
                                background: 'color-mix(in srgb, #8b5cf6 8%, transparent)',
                            }}>{preset.required_documents.length} docs</span>
                    )}
                </div>
            )}
        </div>
    )
}
