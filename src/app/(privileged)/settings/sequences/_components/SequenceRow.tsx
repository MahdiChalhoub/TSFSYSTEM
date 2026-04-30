'use client'

import { Input } from '@/components/ui/input'
import type { Sequence } from '../_lib/types'

interface SequenceRowProps {
    seqKey: string
    seq: Sequence
    label: string
    labelIcon?: React.ReactNode
    labelColor?: string
    tierBadge?: React.ReactNode
    isDirty: boolean
    onChange: (seqKey: string, field: keyof Sequence, value: string | number) => void
}

export function SequenceRow({
    seqKey, seq, label, labelIcon, labelColor,
    tierBadge, isDirty, onChange,
}: SequenceRowProps) {
    const preview = `${seq.prefix || ''}${String(seq.next_number).padStart(seq.padding || 1, '0')}${seq.suffix || ''}`
    const accentColor = labelColor || 'var(--app-primary)'

    return (
        <div
            className="flex items-center gap-4 px-4 py-3 transition-all group"
            style={{
                borderLeft: isDirty
                    ? '3px solid var(--app-warning)'
                    : '3px solid transparent',
                background: isDirty
                    ? 'color-mix(in srgb, var(--app-warning) 3%, transparent)'
                    : 'transparent',
            }}
        >
            {/* ── Entity name ── */}
            <div className="flex items-center gap-2.5 w-[180px] flex-shrink-0 min-w-0">
                {labelIcon ? (
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                            color: accentColor,
                        }}
                    >
                        {labelIcon}
                    </div>
                ) : (
                    <div className="w-8 flex-shrink-0" />
                )}
                <span className="text-[13px] font-semibold text-app-foreground truncate">
                    {label}
                </span>
            </div>

            {/* ── Tier badge (documents only) ── */}
            {tierBadge && (
                <div className="w-[88px] flex-shrink-0">{tierBadge}</div>
            )}

            {/* ── Editable fields ── */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-app-muted-foreground/70">
                        Prefix
                    </label>
                    <Input
                        value={seq.prefix || ''}
                        onChange={e => onChange(seqKey, 'prefix', e.target.value)}
                        className="h-8 w-[80px] rounded-lg text-[13px] font-mono font-semibold bg-app-background border-app-border/50 px-2.5 focus:border-app-primary/60 transition-colors"
                        placeholder="PFX-"
                    />
                </div>
                <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-app-muted-foreground/70">
                        Next #
                    </label>
                    <Input
                        type="number"
                        value={seq.next_number}
                        onChange={e => onChange(seqKey, 'next_number', parseInt(e.target.value) || 1)}
                        className="h-8 w-[80px] rounded-lg text-[13px] font-mono font-semibold bg-app-background border-app-border/50 px-2.5 focus:border-app-primary/60 transition-colors"
                        min={1}
                    />
                </div>
                <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-app-muted-foreground/70">
                        Padding
                    </label>
                    <Input
                        type="number"
                        value={seq.padding}
                        onChange={e => onChange(seqKey, 'padding', parseInt(e.target.value) || 1)}
                        className="h-8 w-[60px] rounded-lg text-[13px] font-mono font-semibold bg-app-background border-app-border/50 px-2.5 focus:border-app-primary/60 transition-colors"
                        min={1}
                        max={20}
                    />
                </div>
                <div className="flex flex-col gap-0.5">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-app-muted-foreground/70">
                        Suffix
                    </label>
                    <Input
                        value={seq.suffix || ''}
                        onChange={e => onChange(seqKey, 'suffix', e.target.value)}
                        className="h-8 w-[70px] rounded-lg text-[13px] font-mono font-semibold bg-app-background border-app-border/50 px-2.5 focus:border-app-primary/60 transition-colors"
                        placeholder=""
                    />
                </div>
            </div>

            {/* ── Live preview ── */}
            <div className="flex-shrink-0">
                <div className="text-[8px] font-bold uppercase tracking-wider text-app-muted-foreground/70 mb-0.5">
                    Preview
                </div>
                <div
                    className="text-[14px] font-black font-mono tracking-wide px-3 py-1 rounded-lg"
                    style={{
                        background: `color-mix(in srgb, ${accentColor} 8%, transparent)`,
                        color: accentColor,
                        border: `1px solid color-mix(in srgb, ${accentColor} 15%, transparent)`,
                    }}
                >
                    {preview}
                </div>
            </div>
        </div>
    )
}
