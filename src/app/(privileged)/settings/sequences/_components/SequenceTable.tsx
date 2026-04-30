'use client'

import {
    DOCUMENT_GROUPS, TIERS, MASTER_DATA_GROUPS,
    DEFAULT_PREFIXES, resolveSeqKey,
} from '../_lib/constants'
import type { Sequence, TabKey } from '../_lib/types'
import { SequenceRow } from './SequenceRow'

interface SequenceTableProps {
    tab: TabKey
    sequences: Sequence[]
    dirtyKeys: Set<string>
    onChange: (seqKey: string, field: keyof Sequence, value: string | number) => void
}

function getSeq(sequences: Sequence[], docType: string, tier: string): Sequence {
    const key = resolveSeqKey(docType, tier)
    return sequences.find(s => s.type === key) ?? {
        type: key,
        prefix: DEFAULT_PREFIXES[docType]?.[tier] || `${docType.slice(0, 3)}-`,
        suffix: '', next_number: 1, padding: 6,
    }
}

function getMasterSeq(sequences: Sequence[], id: string, dp: string): Sequence {
    return sequences.find(s => s.type === id) ?? {
        type: id, prefix: dp, suffix: '', next_number: 1, padding: 5,
    }
}

// Module section — color-railed container; common to both tabs
function ModuleSection({
    label, color, count, children, sublabel,
}: {
    label: string; color: string; count: number; sublabel?: string
    children: React.ReactNode
}) {
    return (
        <section
            className="relative rounded-2xl overflow-hidden"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 40%, transparent)',
                border: `1px solid color-mix(in srgb, var(--app-border) 50%, transparent)`,
            }}
        >
            {/* Left color rail running full height */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1"
                style={{ background: color }}
                aria-hidden
            />

            <header
                className="flex items-center justify-between px-5 py-3"
                style={{
                    borderBottom: `1px solid color-mix(in srgb, var(--app-border) 40%, transparent)`,
                    background: `color-mix(in srgb, ${color} 4%, transparent)`,
                }}
            >
                <div className="flex items-baseline gap-3">
                    <span
                        className="text-[11px] font-black uppercase tracking-[0.22em]"
                        style={{ color }}
                    >
                        {label}
                    </span>
                    <span
                        className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded"
                        style={{
                            background: `color-mix(in srgb, ${color} 10%, transparent)`,
                            color,
                        }}
                    >
                        {count}
                    </span>
                </div>
                {sublabel && (
                    <span className="text-[9px] font-mono uppercase tracking-widest text-app-muted-foreground">
                        {sublabel}
                    </span>
                )}
            </header>

            {children}
        </section>
    )
}

export function SequenceTable({ tab, sequences, dirtyKeys, onChange }: SequenceTableProps) {
    if (tab === 'documents') {
        return (
            <div className="flex flex-col gap-4">
                {DOCUMENT_GROUPS.map(group => (
                    <ModuleSection
                        key={group.module}
                        label={group.module}
                        color={group.color}
                        count={group.items.length}
                        sublabel="3 tiers per entity"
                    >
                        <div className="flex flex-col">
                            {group.items.map((dt, di) => (
                                <div
                                    key={dt.id}
                                    className="grid gap-3 px-5 py-3 items-center"
                                    style={{
                                        gridTemplateColumns: 'minmax(160px, 200px) 1fr',
                                        borderTop:
                                            di > 0
                                                ? `1px solid color-mix(in srgb, var(--app-border) 28%, transparent)`
                                                : 'none',
                                    }}
                                >
                                    {/* Entity header — appears once per document type */}
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{
                                                background: `color-mix(in srgb, ${dt.color} 12%, transparent)`,
                                                color: dt.color,
                                            }}
                                        >
                                            <dt.icon size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[13px] font-black text-app-foreground truncate leading-tight">
                                                {dt.label}
                                            </div>
                                            <div className="text-[9px] font-mono uppercase tracking-widest text-app-muted-foreground">
                                                document
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3 tier specimens, side by side */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        {TIERS.map(tier => {
                                            const seqKey = resolveSeqKey(dt.id, tier.key)
                                            return (
                                                <SequenceRow
                                                    key={seqKey}
                                                    seqKey={seqKey}
                                                    seq={getSeq(sequences, dt.id, tier.key)}
                                                    tier={tier}
                                                    isDirty={dirtyKeys.has(seqKey)}
                                                    onChange={onChange}
                                                />
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ModuleSection>
                ))}
            </div>
        )
    }

    // Master-Data tab — single specimen per entity, grouped
    return (
        <div className="flex flex-col gap-4">
            {MASTER_DATA_GROUPS.map(group => (
                <ModuleSection
                    key={group.module}
                    label={group.module}
                    color={group.color}
                    count={group.items.length}
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pl-5">
                        {group.items.map(ent => (
                            <div key={ent.id} className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 px-1">
                                    <div
                                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                        style={{
                                            background: `color-mix(in srgb, ${ent.color} 12%, transparent)`,
                                            color: ent.color,
                                        }}
                                    >
                                        <ent.icon size={13} />
                                    </div>
                                    <span className="text-[12px] font-black text-app-foreground truncate">
                                        {ent.label}
                                    </span>
                                </div>
                                <SequenceRow
                                    seqKey={ent.id}
                                    seq={getMasterSeq(sequences, ent.id, ent.defaultPrefix)}
                                    isDirty={dirtyKeys.has(ent.id)}
                                    onChange={onChange}
                                />
                            </div>
                        ))}
                    </div>
                </ModuleSection>
            ))}
        </div>
    )
}
