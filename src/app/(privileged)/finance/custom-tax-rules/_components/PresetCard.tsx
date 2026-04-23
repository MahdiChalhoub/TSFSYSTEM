'use client'

import { CheckCircle2, Zap, Loader2, Download } from 'lucide-react'
import type { TemplatePreset } from '../../_components/TemplateBanner'

const friendlyLabel: Record<string, string> = {
    PURCHASE: 'Purchase Only', SALE: 'Sale Only', BOTH: 'Purchases & Sales',
}

/* ═══════════════════════════════════════════════════════════
 *  PRESET CARD — For displaying available template presets
 * ═══════════════════════════════════════════════════════════ */
export function CTRPresetCard({ preset, onImport, importing }: {
    preset: TemplatePreset; onImport: (name: string) => void; importing: boolean
}) {
    const isImported = preset.already_imported
    const ratePct = preset.rate ? `${(parseFloat(preset.rate) * 100).toFixed(2)}%` : '—'

    return (
        <div className="relative flex flex-col gap-2 px-4 py-3 rounded-xl transition-all duration-200"
            style={{
                background: isImported
                    ? 'color-mix(in srgb, var(--app-success, #22c55e) 4%, var(--app-surface))'
                    : 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                border: isImported
                    ? '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)'
                    : '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                opacity: isImported ? 0.75 : 1,
            }}>
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                            background: isImported ? 'color-mix(in srgb, var(--app-success, #22c55e) 12%, transparent)' : 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                            color: isImported ? 'var(--app-success, #22c55e)' : 'var(--app-primary)',
                        }}>
                        {isImported ? <CheckCircle2 size={13} /> : <Zap size={13} />}
                    </div>
                    <span className="text-[12px] font-bold text-app-foreground truncate">{preset.name}</span>
                </div>
                {isImported ? (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)', border: '1px solid color-mix(in srgb, var(--app-success, #22c55e) 20%, transparent)' }}>Imported</span>
                ) : (
                    <button onClick={() => onImport(preset.name)} disabled={importing}
                        className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg transition-all flex-shrink-0 hover:brightness-110"
                        style={{ background: 'var(--app-primary)', color: '#fff', boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)', opacity: importing ? 0.6 : 1 }}>
                        {importing ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                        Import
                    </button>
                )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '4px' }}>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Rate</span>
                    <span className="text-[11px] font-black font-mono text-app-foreground tabular-nums">{ratePct}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Type</span>
                    <span className="text-[10px] font-bold text-app-foreground">{friendlyLabel[preset.transaction_type || ''] || preset.transaction_type || '—'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Behavior</span>
                    <span className="text-[10px] font-bold text-app-foreground">{preset.math_behavior === 'WITHHELD_FROM_AP' ? 'Withhold' : 'Add to TTC'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-[8px] font-black uppercase tracking-wider text-app-muted-foreground">Order</span>
                    <span className="text-[10px] font-bold font-mono text-app-muted-foreground">#{preset.calculation_order || 100}</span>
                </div>
            </div>
        </div>
    )
}
