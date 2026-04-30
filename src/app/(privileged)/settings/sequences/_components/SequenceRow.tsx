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
    const c = labelColor || 'var(--app-primary)'

    return (
        <div
            className="group flex items-center gap-2 md:gap-3 px-3 py-2 transition-all duration-150"
            style={{
                borderLeft: isDirty ? `3px solid var(--app-warning)` : '3px solid transparent',
                background: isDirty
                    ? 'color-mix(in srgb, var(--app-warning) 4%, transparent)'
                    : 'transparent',
            }}
        >
            {/* Entity name — only first tier of each doc type shows it */}
            <div className="flex items-center gap-2 w-[130px] flex-shrink-0 min-w-0">
                {labelIcon && (
                    <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                            background: `color-mix(in srgb, ${c} 12%, transparent)`,
                            color: c,
                        }}
                    >
                        {labelIcon}
                    </div>
                )}
                {!labelIcon && label && <div className="w-7 flex-shrink-0" />}
                <span className="text-[13px] font-bold text-app-foreground truncate">
                    {label}
                </span>
            </div>

            {/* Tier badge */}
            {tierBadge && <div className="w-[80px] flex-shrink-0">{tierBadge}</div>}

            {/* Fields — compact inline group */}
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Input
                    value={seq.prefix || ''}
                    onChange={e => onChange(seqKey, 'prefix', e.target.value)}
                    className="h-7 w-[72px] rounded-lg text-[12px] font-mono font-bold bg-app-background border-app-border/50 px-2 focus:border-app-primary/50 transition-colors"
                    placeholder="PFX-"
                />
                <Input
                    type="number"
                    value={seq.next_number}
                    onChange={e => onChange(seqKey, 'next_number', parseInt(e.target.value) || 1)}
                    className="h-7 w-[64px] rounded-lg text-[12px] font-mono font-bold bg-app-background border-app-border/50 px-2 focus:border-app-primary/50 transition-colors"
                    min={1}
                />
                <Input
                    type="number"
                    value={seq.padding}
                    onChange={e => onChange(seqKey, 'padding', parseInt(e.target.value) || 1)}
                    className="h-7 w-[48px] rounded-lg text-[12px] font-mono font-bold bg-app-background border-app-border/50 px-2 focus:border-app-primary/50 transition-colors"
                    min={1} max={20}
                />
                <Input
                    value={seq.suffix || ''}
                    onChange={e => onChange(seqKey, 'suffix', e.target.value)}
                    className="h-7 w-[56px] rounded-lg text-[12px] font-mono font-bold bg-app-background border-app-border/50 px-2 focus:border-app-primary/50 transition-colors"
                    placeholder="sfx"
                />
            </div>

            {/* Preview chip */}
            <div
                className="text-[12px] font-black font-mono px-2.5 py-1 rounded-lg flex-shrink-0 tabular-nums"
                style={{
                    background: `color-mix(in srgb, ${c} 8%, transparent)`,
                    color: c,
                    border: `1px solid color-mix(in srgb, ${c} 15%, transparent)`,
                }}
            >
                {preview}
            </div>
        </div>
    )
}
