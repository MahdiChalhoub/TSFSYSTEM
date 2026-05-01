'use client'

import { Users, Check, Pencil, Globe } from 'lucide-react'

type Profile = Record<string, any>

/* ═══════════════════════════════════════════════════════════
 *  PROFILE ROW — Table row for a counterparty tax profile
 * ═══════════════════════════════════════════════════════════ */
export function ProfileRow({ item, onView }: { item: Profile; onView: (id: number) => void }) {
    return (
        <div className="group flex items-center gap-2 md:gap-3 transition-all duration-150 cursor-pointer border-b border-app-border/30 hover:bg-app-surface/40 py-2 md:py-2.5"
            style={{ paddingLeft: '12px', paddingRight: '12px' }}
            onClick={() => onView(item.id)}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                    background: item.is_system_preset ? 'color-mix(in srgb, var(--app-info, #3b82f6) 12%, transparent)' : 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                    color: item.is_system_preset ? 'var(--app-info, #3b82f6)' : 'var(--app-muted-foreground)',
                }}>
                <Users size={13} />
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2 md:gap-3">
                <span className="truncate text-[13px] font-bold text-app-foreground">{item.name}</span>
                {item.is_system_preset && (
                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }}>Preset</span>
                )}
            </div>
            <div className="hidden sm:flex w-16 items-center gap-1 flex-shrink-0">
                <Globe size={12} className="text-app-muted-foreground" />
                <span className="font-mono text-[11px] font-bold text-app-foreground">{item.country_code}</span>
            </div>
            <div className="hidden sm:flex w-16 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={item.vat_registered ? { color: 'var(--app-success, #22c55e)', background: 'color-mix(in srgb, var(--app-success, #22c55e) 8%, transparent)' } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                    {item.vat_registered ? <><Check size={10} />VAT</> : '—'}
                </span>
            </div>
            <div className="hidden md:flex w-14 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={item.reverse_charge ? { color: 'var(--app-warning, #f59e0b)', background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)' } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                    {item.reverse_charge ? 'RC' : '—'}
                </span>
            </div>
            <div className="hidden md:flex w-14 flex-shrink-0">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1"
                    style={item.airsi_subject ? { color: 'var(--app-accent)', background: 'color-mix(in srgb, var(--app-accent) 8%, transparent)' } : { color: 'var(--app-muted-foreground)', opacity: 0.5 }}>
                    {item.airsi_subject ? 'WHT' : '—'}
                </span>
            </div>
            <div className="hidden lg:flex w-28 gap-1 flex-shrink-0 flex-wrap">
                {(item.allowed_scopes || []).map((s: string) => (
                    <span key={s} className="text-[8px] font-black uppercase tracking-wider px-1 py-0.5 rounded"
                        style={{ color: 'var(--app-primary)', background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)' }}>{s}</span>
                ))}
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={e => { e.stopPropagation(); onView(item.id) }} className="p-1.5 hover:bg-app-border/50 rounded-lg text-app-muted-foreground hover:text-app-foreground transition-colors" title="View / Edit"><Pencil size={12} /></button>
            </div>
        </div>
    )
}
