'use client'

import { Input } from '@/components/ui/input'
import { RotateCcw } from 'lucide-react'
import type { ElementType } from 'react'
import type { Sequence, TierDef } from '../_lib/types'

interface TierRowProps {
    seqKey: string
    seq: Sequence
    tier?: TierDef
    isDirty: boolean
    isFirstOfEntity: boolean
    isLastOfEntity: boolean
    entity?: { label: string; icon: ElementType; color: string }
    onChange: (seqKey: string, field: keyof Sequence, value: string | number) => void
}

// Local override so Draft has presence (constants.ts maps it to muted-foreground = invisible)
function effectiveTierColor(tier?: TierDef): string {
    if (!tier) return 'var(--app-primary)'
    if (tier.key === 'DRAFT') return '#64748B' // slate-500
    return tier.color
}

const TIER_RULE: Record<string, { text: string; tone?: string }> = {
    DRAFT:    { text: '⚠ gaps · temporary',   tone: 'var(--app-warning)' },
    INTERNAL: { text: 'monotonic · mgmt' },
    OFFICIAL: { text: '✓ no-gap · fiscal',    tone: 'var(--app-success)' },
}

export function SequenceRow({
    seqKey, seq, tier, isDirty, isFirstOfEntity, isLastOfEntity, entity, onChange,
}: TierRowProps) {
    const tierColor = effectiveTierColor(tier)
    const padding = seq.padding || 1
    const next = Number.isFinite(seq.next_number) ? seq.next_number : 1
    const digitsStr = String(next)
    const padLen = Math.max(0, padding - digitsStr.length)
    const zeros = '0'.repeat(padLen)
    const rule = tier ? TIER_RULE[tier.key] : { text: 'auto-increment' }

    return (
        <div
            className="grid items-center gap-x-3 gap-y-0 px-4 group transition-colors hover:bg-app-background/30"
            style={{
                gridTemplateColumns:
                    'minmax(170px, 200px) 88px minmax(96px, 1.2fr) 56px 56px 70px minmax(150px, 1.5fr) minmax(120px, 0.9fr) 28px',
                paddingTop: 8,
                paddingBottom: 8,
                background: isDirty
                    ? 'color-mix(in srgb, var(--app-warning) 5%, transparent)'
                    : undefined,
                borderBottom: isLastOfEntity
                    ? '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)'
                    : '1px dashed color-mix(in srgb, var(--app-border) 25%, transparent)',
                borderLeft: isDirty
                    ? '2px solid var(--app-warning)'
                    : '2px solid transparent',
            }}
        >
            {/* COL 1 — Entity (only on first tier of each entity) */}
            <div className="flex items-center gap-2 min-w-0">
                {isFirstOfEntity && entity ? (
                    <>
                        <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{
                                background: `color-mix(in srgb, ${entity.color} 12%, transparent)`,
                                color: entity.color,
                            }}
                        >
                            <entity.icon size={14} />
                        </div>
                        <span className="text-[12.5px] font-bold text-app-foreground truncate">
                            {entity.label}
                        </span>
                    </>
                ) : (
                    <span className="w-7 flex-shrink-0" aria-hidden />
                )}
            </div>

            {/* COL 2 — Tier badge */}
            <div className="min-w-0">
                {tier ? (
                    <span
                        className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-md"
                        style={{
                            background: `color-mix(in srgb, ${tierColor} 10%, transparent)`,
                        }}
                        title={tier.desc}
                    >
                        <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: tierColor, boxShadow: `0 0 5px ${tierColor}` }}
                        />
                        <span
                            className="text-[9.5px] font-black uppercase tracking-[0.16em]"
                            style={{ color: tierColor }}
                        >
                            {tier.label}
                        </span>
                    </span>
                ) : (
                    <span className="text-[9.5px] font-black uppercase tracking-[0.16em] text-app-muted-foreground">
                        Code
                    </span>
                )}
            </div>

            {/* COL 3 — Prefix input */}
            <Input
                value={seq.prefix || ''}
                onChange={e => onChange(seqKey, 'prefix', e.target.value)}
                className="h-7 px-2 rounded-md text-[12px] font-mono font-bold border border-transparent bg-transparent hover:border-app-border focus-visible:border-app-primary focus-visible:ring-0 focus-visible:bg-app-background transition-colors"
                placeholder="—"
                aria-label="Prefix"
            />

            {/* COL 4 — Next */}
            <Input
                type="number"
                value={next}
                onChange={e => onChange(seqKey, 'next_number', parseInt(e.target.value) || 1)}
                className="h-7 px-2 rounded-md text-[12px] font-mono font-bold border border-transparent bg-transparent hover:border-app-border focus-visible:border-app-primary focus-visible:ring-0 focus-visible:bg-app-background transition-colors tabular-nums text-center"
                min={1}
                aria-label="Next number"
                title="Next sequence number"
            />

            {/* COL 5 — Pad */}
            <Input
                type="number"
                value={padding}
                onChange={e => onChange(seqKey, 'padding', parseInt(e.target.value) || 1)}
                className="h-7 px-2 rounded-md text-[12px] font-mono font-bold border border-transparent bg-transparent hover:border-app-border focus-visible:border-app-primary focus-visible:ring-0 focus-visible:bg-app-background transition-colors tabular-nums text-center"
                min={1} max={20}
                aria-label="Padding"
                title="Zero-pad width"
            />

            {/* COL 6 — Suffix */}
            <Input
                value={seq.suffix || ''}
                onChange={e => onChange(seqKey, 'suffix', e.target.value)}
                className="h-7 px-2 rounded-md text-[12px] font-mono font-bold border border-transparent bg-transparent hover:border-app-border focus-visible:border-app-primary focus-visible:ring-0 focus-visible:bg-app-background transition-colors"
                placeholder="—"
                aria-label="Suffix"
            />

            {/* COL 7 — Live preview */}
            <div className="font-mono font-black text-[14.5px] tabular-nums leading-none flex items-baseline truncate">
                <span style={{ color: tierColor }}>{seq.prefix || ''}</span>
                <span style={{ color: 'color-mix(in srgb, var(--app-foreground) 26%, transparent)' }}>
                    {zeros}
                </span>
                <span style={{ color: 'var(--app-foreground)' }}>{digitsStr}</span>
                <span style={{ color: 'var(--app-muted-foreground)' }}>{seq.suffix || ''}</span>
            </div>

            {/* COL 8 — Rule hint */}
            <div className="text-[10px] font-mono uppercase tracking-widest truncate">
                <span style={{ color: rule.tone || 'var(--app-muted-foreground)' }}>
                    {rule.text}
                </span>
            </div>

            {/* COL 9 — Reset */}
            <button
                type="button"
                onClick={() => onChange(seqKey, 'next_number', 1)}
                className="w-6 h-6 rounded-md flex items-center justify-center text-app-muted-foreground/60 hover:text-app-foreground hover:bg-app-background opacity-0 group-hover:opacity-100 transition-all"
                title="Reset counter to 1"
                aria-label="Reset counter"
            >
                <RotateCcw size={11} />
            </button>
        </div>
    )
}
