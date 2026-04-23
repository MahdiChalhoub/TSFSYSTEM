'use client'

import { ShieldCheck, Check, Pencil, Globe } from 'lucide-react'

type OrgTaxPolicy = Record<string, any>

/* ═══════════════════════════════════════════════════════════
 *  POLICY ROW — Table row for displaying a single policy
 * ═══════════════════════════════════════════════════════════ */
export function PolicyRow({ item, onView }: { item: OrgTaxPolicy; onView: (id: number) => void }) {
    return (
        <div
            className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5"
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
            onClick={() => onView(item.id)}
        >
            {/* Icon */}
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: item.is_default
                        ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)'
                        : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                    color: item.is_default ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                }}>
                <ShieldCheck size={13} />
            </div>

            {/* Name + Country */}
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                <span className="truncate text-[13px] font-bold text-app-foreground">{item.name}</span>
                {item.is_default && (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{
                            background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)',
                            color: 'var(--app-primary)',
                            border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)',
                        }}>Default</span>
                )}
                <span className="hidden md:inline font-mono text-[11px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-background) 60%, transparent)',
                        color: 'var(--app-foreground)',
                    }}>{item.country_code}</span>
            </div>

            {/* Currency */}
            <div className="hidden sm:block w-16 flex-shrink-0">
                <span className="font-mono text-[11px] font-bold text-app-muted-foreground">{item.currency_code || '—'}</span>
            </div>

            {/* VAT Output */}
            <div className="hidden sm:flex w-20 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={item.vat_output_enabled ? {
                        color: 'var(--app-success, #22c55e)',
                        background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)',
                    } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                    {item.vat_output_enabled ? <><Check size={10} />VAT</> : '—'}
                </span>
            </div>

            {/* Recovery */}
            <div className="hidden md:block w-16 text-right flex-shrink-0 font-mono text-[11px] font-bold tabular-nums"
                style={{ color: 'var(--app-foreground)' }}>
                {item.vat_input_recoverability != null ? `${(parseFloat(item.vat_input_recoverability) * 100).toFixed(0)}%` : '—'}
            </div>

            {/* AIRSI */}
            <div className="hidden md:flex w-20 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                        background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                        color: 'var(--app-muted-foreground)',
                    }}>
                    {item.airsi_treatment || '—'}
                </span>
            </div>

            {/* Scopes */}
            <div className="hidden lg:flex w-28 gap-1 flex-shrink-0 flex-wrap">
                {(item.allowed_scopes || []).map((s: string) => (
                    <span key={s} className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
                        style={{
                            color: 'var(--app-primary)',
                            background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                        }}>{s}</span>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); onView(item.id) }}
                    className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="View / Edit">
                    <Pencil size={12} />
                </button>
            </div>
        </div>
    )
}
