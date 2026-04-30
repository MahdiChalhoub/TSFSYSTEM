'use client'

import {
    DOCUMENT_GROUPS, TIERS, MASTER_DATA_GROUPS,
    DEFAULT_PREFIXES, resolveSeqKey,
} from '../_lib/constants'
import type { Sequence, TabKey } from '../_lib/types'
import { SequenceRow } from './SequenceRow'

interface SequenceTableProps {
    tab: TabKey
    moduleKey?: string
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

const COL_GRID =
    'minmax(170px, 200px) 88px minmax(96px, 1.2fr) 56px 56px 70px minmax(150px, 1.5fr) minmax(120px, 0.9fr) 28px'

function ColumnHeader({ showTier }: { showTier: boolean }) {
    const cells = [
        { label: 'Entity' },
        { label: showTier ? 'Tier' : 'Type' },
        { label: 'Prefix' },
        { label: 'Next', align: 'center' },
        { label: 'Pad', align: 'center' },
        { label: 'Suffix' },
        { label: 'Preview' },
        { label: 'Policy' },
        { label: '' },
    ]
    return (
        <div
            className="grid items-center gap-x-3 px-4 py-2"
            style={{
                gridTemplateColumns: COL_GRID,
                background: 'color-mix(in srgb, var(--app-surface) 80%, transparent)',
                borderBottom: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
            }}
        >
            {cells.map((c, i) => (
                <span
                    key={i}
                    className="text-[9px] font-black uppercase tracking-[0.18em] text-app-muted-foreground"
                    style={{ textAlign: c.align as 'center' | undefined }}
                >
                    {c.label}
                </span>
            ))}
        </div>
    )
}

function ModuleSection({
    label, color, count, sublabel, children,
}: {
    label: string; color: string; count: number; sublabel?: string
    children: React.ReactNode
}) {
    return (
        <section
            className="relative rounded-2xl overflow-hidden"
            style={{
                background: 'color-mix(in srgb, var(--app-surface) 35%, transparent)',
                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
            }}
        >
            <div
                className="absolute left-0 top-0 bottom-0 w-1 z-10"
                style={{ background: color }}
                aria-hidden
            />

            <header
                className="flex items-center justify-between px-5 py-2.5"
                style={{
                    borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
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

export function SequenceTable({ tab, moduleKey, sequences, dirtyKeys, onChange }: SequenceTableProps) {
    if (tab === 'documents') {
        const groups = moduleKey
            ? DOCUMENT_GROUPS.filter(g => g.module === moduleKey)
            : DOCUMENT_GROUPS

        return (
            <div className="flex flex-col gap-4">
                {groups.map(group => (
                    <ModuleSection
                        key={group.module}
                        label={group.module}
                        color={group.color}
                        count={group.items.length * TIERS.length}
                        sublabel={`${group.items.length} entities · ${TIERS.length} tiers each`}
                    >
                        <ColumnHeader showTier />
                        <div className="flex flex-col">
                            {group.items.map(dt =>
                                TIERS.map((tier, ti) => {
                                    const seqKey = resolveSeqKey(dt.id, tier.key)
                                    return (
                                        <SequenceRow
                                            key={seqKey}
                                            seqKey={seqKey}
                                            seq={getSeq(sequences, dt.id, tier.key)}
                                            tier={tier}
                                            entity={{ label: dt.label, icon: dt.icon, color: dt.color }}
                                            isFirstOfEntity={ti === 0}
                                            isLastOfEntity={ti === TIERS.length - 1}
                                            isDirty={dirtyKeys.has(seqKey)}
                                            onChange={onChange}
                                        />
                                    )
                                })
                            )}
                        </div>
                    </ModuleSection>
                ))}
            </div>
        )
    }

    // Master-Data tab — one row per entity (no tier dimension)
    const masterGroups = moduleKey
        ? MASTER_DATA_GROUPS.filter(g => g.module === moduleKey)
        : MASTER_DATA_GROUPS

    return (
        <div className="flex flex-col gap-4">
            {masterGroups.map(group => (
                <ModuleSection
                    key={group.module}
                    label={group.module}
                    color={group.color}
                    count={group.items.length}
                    sublabel={`${group.items.length} entities`}
                >
                    <ColumnHeader showTier={false} />
                    <div className="flex flex-col">
                        {group.items.map(ent => (
                            <SequenceRow
                                key={ent.id}
                                seqKey={ent.id}
                                seq={getMasterSeq(sequences, ent.id, ent.defaultPrefix)}
                                entity={{ label: ent.label, icon: ent.icon, color: ent.color }}
                                isFirstOfEntity
                                isLastOfEntity
                                isDirty={dirtyKeys.has(ent.id)}
                                onChange={onChange}
                            />
                        ))}
                    </div>
                </ModuleSection>
            ))}
        </div>
    )
}
