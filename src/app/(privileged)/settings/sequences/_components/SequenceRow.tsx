'use client'

import { Input } from '@/components/ui/input'
import { RotateCcw } from 'lucide-react'
import type { Sequence, TierDef } from '../_lib/types'

interface TierCardProps {
    seqKey: string
    seq: Sequence
    tier?: TierDef
    isDirty: boolean
    onChange: (seqKey: string, field: keyof Sequence, value: string | number) => void
}

// One tier specimen card: hero preview + inline editor + rules meta.
// Used for both Documents tab (with `tier`) and Master-Data tab (no `tier`).
export function SequenceRow({ seqKey, seq, tier, isDirty, onChange }: TierCardProps) {
    const tierColor = tier?.color || 'var(--app-primary)'
    const padding = seq.padding || 1
    const next = Number.isFinite(seq.next_number) ? seq.next_number : 1
    const digitsStr = String(next)
    const padLen = Math.max(0, padding - digitsStr.length)
    const zeros = '0'.repeat(padLen)

    const ruleHint = (() => {
        switch (tier?.key) {
            case 'OFFICIAL':
                return [{ label: '✓ no gaps', tone: 'var(--app-success)' }, { label: 'fiscal' }]
            case 'INTERNAL':
                return [{ label: 'monotonic' }, { label: 'management' }]
            case 'DRAFT':
                return [{ label: '⚠ gaps allowed', tone: 'var(--app-warning)' }, { label: 'temporary' }]
            default:
                return [{ label: 'auto-increment' }]
        }
    })()

    return (
        <div
            className="relative flex flex-col gap-2 p-3 rounded-xl transition-all"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 60%, transparent)',
                border: `1px solid color-mix(in srgb, ${isDirty ? 'var(--app-warning)' : tierColor} ${isDirty ? '45%' : '18%'}, transparent)`,
                boxShadow: isDirty
                    ? `0 0 0 3px color-mix(in srgb, var(--app-warning) 8%, transparent)`
                    : 'none',
            }}
        >
            {/* Header: tier tag + dirty pulse */}
            {tier && (
                <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1.5">
                        <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: tierColor, boxShadow: `0 0 6px ${tierColor}` }}
                        />
                        <span
                            className="text-[9px] font-black uppercase tracking-[0.18em]"
                            style={{ color: tierColor }}
                        >
                            {tier.label}
                        </span>
                    </div>
                    {isDirty && (
                        <span
                            className="text-[8px] font-mono uppercase tracking-widest inline-flex items-center gap-1"
                            style={{ color: 'var(--app-warning)' }}
                        >
                            <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: 'var(--app-warning)' }} />
                            unsaved
                        </span>
                    )}
                </div>
            )}

            {/* Hero preview render — the centerpiece */}
            <div className="flex items-baseline gap-0 font-mono font-black text-[22px] leading-none tabular-nums select-none">
                <span style={{ color: tierColor }}>{seq.prefix || ''}</span>
                <span style={{ color: 'color-mix(in srgb, var(--app-foreground) 28%, transparent)' }}>
                    {zeros}
                </span>
                <span style={{ color: 'var(--app-foreground)' }}>{digitsStr}</span>
                <span style={{ color: 'var(--app-muted-foreground)' }}>{seq.suffix || ''}</span>
            </div>

            {/* Inline editor — borderless, surfaces on hover/focus */}
            <div className="flex items-center gap-1">
                <Input
                    value={seq.prefix || ''}
                    onChange={e => onChange(seqKey, 'prefix', e.target.value)}
                    className="h-7 flex-1 min-w-0 rounded-md text-[11px] font-mono font-bold border-0 bg-transparent hover:bg-app-background/50 focus-visible:bg-app-background focus-visible:ring-0 px-2"
                    placeholder="prefix"
                    aria-label="Prefix"
                />
                <Input
                    type="number"
                    value={next}
                    onChange={e => onChange(seqKey, 'next_number', parseInt(e.target.value) || 1)}
                    className="h-7 w-[52px] rounded-md text-[11px] font-mono font-bold border-0 bg-transparent hover:bg-app-background/50 focus-visible:bg-app-background focus-visible:ring-0 px-2 tabular-nums"
                    min={1}
                    aria-label="Next number"
                    title="Next number"
                />
                <Input
                    type="number"
                    value={padding}
                    onChange={e => onChange(seqKey, 'padding', parseInt(e.target.value) || 1)}
                    className="h-7 w-[40px] rounded-md text-[11px] font-mono font-bold border-0 bg-transparent hover:bg-app-background/50 focus-visible:bg-app-background focus-visible:ring-0 px-2 tabular-nums"
                    min={1} max={20}
                    aria-label="Padding"
                    title="Pad width"
                />
                <Input
                    value={seq.suffix || ''}
                    onChange={e => onChange(seqKey, 'suffix', e.target.value)}
                    className="h-7 w-[52px] rounded-md text-[11px] font-mono font-bold border-0 bg-transparent hover:bg-app-background/50 focus-visible:bg-app-background focus-visible:ring-0 px-2"
                    placeholder="sfx"
                    aria-label="Suffix"
                />
                <button
                    type="button"
                    onClick={() => onChange(seqKey, 'next_number', 1)}
                    className="h-7 w-7 rounded-md flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-background/50 transition-colors"
                    title="Reset counter to 1"
                    aria-label="Reset counter"
                >
                    <RotateCcw size={11} />
                </button>
            </div>

            {/* Meta — tier policy hint */}
            <div className="text-[9px] font-mono uppercase tracking-widest text-app-muted-foreground flex items-center gap-2 pt-1.5"
                style={{ borderTop: '1px dashed color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                {ruleHint.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-2">
                        {i > 0 && <span style={{ color: 'var(--app-muted-foreground)' }}>·</span>}
                        <span style={{ color: r.tone || 'var(--app-muted-foreground)' }}>{r.label}</span>
                    </span>
                ))}
            </div>
        </div>
    )
}
