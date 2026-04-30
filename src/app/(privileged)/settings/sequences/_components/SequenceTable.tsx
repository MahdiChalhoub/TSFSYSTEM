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

function getSequence(sequences: Sequence[], docType: string, tier: string): Sequence {
    const key = resolveSeqKey(docType, tier)
    return sequences.find(s => s.type === key) ?? {
        type: key,
        prefix: DEFAULT_PREFIXES[docType]?.[tier] || `${docType.slice(0, 3)}-`,
        suffix: '', next_number: 1, padding: 6,
    }
}

function getMasterSequence(sequences: Sequence[], id: string, defaultPrefix: string): Sequence {
    return sequences.find(s => s.type === id) ?? {
        type: id, prefix: defaultPrefix, suffix: '', next_number: 1, padding: 5,
    }
}

// ── Module section header ────────────────────────────────────
function ModuleSection({ label, color, count }: { label: string; color: string; count: number }) {
    return (
        <div
            className="flex items-center gap-3 px-5 py-2.5"
            style={{
                background: `color-mix(in srgb, ${color} 5%, var(--app-surface))`,
                borderBottom: `1px solid color-mix(in srgb, ${color} 15%, transparent)`,
            }}
        >
            <div className="w-1.5 h-5 rounded-full" style={{ background: color }} />
            <span className="text-[12px] font-black uppercase tracking-widest" style={{ color }}>
                {label}
            </span>
            <span
                className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full"
                style={{
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                    color,
                }}
            >
                {count}
            </span>
        </div>
    )
}

// ── Tier badge ───────────────────────────────────────────────
function TierBadge({ tier }: { tier: typeof TIERS[number] }) {
    return (
        <div
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md"
            style={{
                background: `color-mix(in srgb, ${tier.color} 10%, transparent)`,
                color: tier.color,
            }}
            title={tier.desc}
        >
            <tier.icon size={10} />
            <span className="text-[10px] font-bold uppercase tracking-wide">{tier.label}</span>
        </div>
    )
}

// ── Row divider ──────────────────────────────────────────────
function Divider() {
    return (
        <div
            className="h-px mx-4"
            style={{ background: 'color-mix(in srgb, var(--app-border) 35%, transparent)' }}
        />
    )
}

// ── Main export ──────────────────────────────────────────────
export function SequenceTable({ tab, sequences, dirtyKeys, onChange }: SequenceTableProps) {
    if (tab === 'documents') {
        return (
            <div className="space-y-3">
                {DOCUMENT_GROUPS.map(group => (
                    <div
                        key={group.module}
                        className="rounded-xl border border-app-border overflow-hidden"
                        style={{ background: 'var(--app-surface)' }}
                    >
                        <ModuleSection
                            label={group.module}
                            color={group.color}
                            count={group.items.length}
                        />
                        {group.items.map((docType, di) => (
                            <div key={docType.id}>
                                {di > 0 && <Divider />}
                                {TIERS.map((tier, ti) => {
                                    const seqKey = resolveSeqKey(docType.id, tier.key)
                                    const seq = getSequence(sequences, docType.id, tier.key)
                                    return (
                                        <SequenceRow
                                            key={seqKey}
                                            seqKey={seqKey}
                                            seq={seq}
                                            label={ti === 0 ? docType.label : ''}
                                            labelIcon={ti === 0 ? <docType.icon size={15} /> : undefined}
                                            labelColor={docType.color}
                                            tierBadge={<TierBadge tier={tier} />}
                                            isDirty={dirtyKeys.has(seqKey)}
                                            onChange={onChange}
                                        />
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        )
    }

    // ── Master-Data tab ──
    return (
        <div className="space-y-3">
            {MASTER_DATA_GROUPS.map(group => (
                <div
                    key={group.module}
                    className="rounded-xl border border-app-border overflow-hidden"
                    style={{ background: 'var(--app-surface)' }}
                >
                    <ModuleSection
                        label={group.module}
                        color={group.color}
                        count={group.items.length}
                    />
                    {group.items.map((ent, i) => {
                        const seq = getMasterSequence(sequences, ent.id, ent.defaultPrefix)
                        return (
                            <div key={ent.id}>
                                {i > 0 && <Divider />}
                                <SequenceRow
                                    seqKey={ent.id}
                                    seq={seq}
                                    label={ent.label}
                                    labelIcon={<ent.icon size={15} />}
                                    labelColor={ent.color}
                                    isDirty={dirtyKeys.has(ent.id)}
                                    onChange={onChange}
                                />
                            </div>
                        )
                    })}
                </div>
            ))}
        </div>
    )
}
